// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "lib/openzeppelin-contracts/contracts/access/Ownable.sol";
import "lib/openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import "lib/openzeppelin-contracts/contracts/utils/ReentrancyGuard.sol";
import "lib/openzeppelin-contracts/contracts/utils/Pausable.sol";
import "../interfaces/IUniswapV3Pool.sol";
import "../interfaces/IUniswapV3Factory.sol";

/**
 * @title LimitOrderProtocol
 * @notice Protocol for limit orders specifically for USDC/WETH pair
 * @dev Optimized for USDC (6 decimals) / WETH (18 decimals) pair
 */
contract LimitOrderProtocol is Ownable, ReentrancyGuard, Pausable {
    // Token addresses - immutable for gas savings
    address public immutable USDC;
    address public immutable WETH;
    
    // Uniswap V3 - immutable for gas savings
    IUniswapV3Factory public immutable uniswapFactory;
    uint24 public constant UNISWAP_FEE = 3000; // 0.3%
    uint256 public constant PRICE_TOLERANCE = 50; // 0.5% tolerance
    
    // Constants - packed for gas savings
    uint256 public constant PRICE_PRECISION = 1e18;
    uint256 public constant USDC_DECIMALS = 6;
    uint256 public constant WETH_DECIMALS = 18;
    uint256 public constant DECIMAL_ADJUSTMENT = 1e12; // To adjust USDC (6) to WETH (18) decimals
    uint256 public constant MAX_ORDERS_PER_USER = 100; // Maximum number of active orders per user

    // Structs - optimized for storage packing
    struct Order {
        address maker;           // Order creator
        uint256 amountIn;        // Amount to sell
        uint256 amountOutMin;    // Minimum amount to receive
        uint256 price;           // Limit price in USDC per WETH (18 decimals)
        uint32 timestamp;        // Creation timestamp
        uint32 expiryTime;       // Expiration time
        bool isBuy;             // true = buy WETH with USDC, false = sell WETH for USDC
        bool isActive;          // Order status
    }

    // Fee configuration structure - optimized for storage packing
    struct FeeConfig {
        uint256 protocolFee;      // Protocol fee (in basis points, 1 = 0.01%)
        uint256 keeperFee;        // Keeper fee (in basis points)
        address feeCollector;     // Address that receives protocol fees
        bool feesEnabled;         // Flag to enable/disable fees
    }

    // Fee statistics structure - optimized for storage packing
    struct FeeStats {
        uint256 totalProtocolFees;
        uint256 totalKeeperFees;
        uint32 lastUpdate;
    }

    // Keeper related structures and variables
    struct KeeperStats {
        uint256 totalExecutions;
        uint256 totalVolume;
        uint32 lastExecution;
        bool isActive;
    }

    // Events - optimized for gas
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed maker,
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 price,
        bool isBuy,
        uint32 expiryTime
    );

    event OrderExecuted(
        uint256 indexed orderId,
        address indexed maker,
        address indexed taker,
        uint256 amountIn,
        uint256 amountOut,
        uint256 executionPrice,
        uint256 uniswapPrice,
        uint256 protocolFee,
        uint256 keeperFee
    );

    event OrderCancelled(
        uint256 indexed orderId,
        address indexed maker,
        uint256 refundAmount
    );

    event ProtocolPaused(address indexed by);
    event ProtocolUnpaused(address indexed by);
    event MinOrderAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event MaxOrderAmountUpdated(uint256 oldAmount, uint256 newAmount);
    event OrderExpiryTimeUpdated(uint256 oldTime, uint256 newTime);
    event FeesUpdated(uint256 protocolFee, uint256 keeperFee, address feeCollector);
    event FeesCollected(uint256 protocolFee, uint256 keeperFee, address keeper);
    event KeeperFeesClaimed(address keeper, uint256 amount);
    event EmergencyWithdraw(address token, uint256 amount, address to);

    // Events for keeper operations
    event KeeperRegistered(address indexed keeper);
    event KeeperUnregistered(address indexed keeper);
    event KeeperExecution(
        address indexed keeper,
        uint256 indexed orderId,
        uint256 executionPrice,
        uint256 gasUsed
    );

    // State variables - optimized for storage packing
    mapping(uint256 => Order) public orders;
    mapping(address => uint256[]) public userOrders;
    uint256 private _nextOrderId;
    
    // Protocol parameters - packed for gas savings
    uint256 public minOrderAmount;
    uint256 public maxOrderAmount;
    uint256 public orderExpiryTime;
    
    // Fee state variables - optimized for storage packing
    FeeConfig public feeConfig;
    FeeStats public feeStats;
    mapping(address => uint256) public keeperFees;

    // Fee constants - packed for gas savings
    uint256 public constant BASIS_POINTS = 10000; // 100%
    uint256 public constant MAX_PROTOCOL_FEE = 100; // 1%
    uint256 public constant MAX_KEEPER_FEE = 50;   // 0.5%

    // State variables for keepers
    mapping(address => KeeperStats) public keeperStats;
    uint256 public totalKeepers;
    uint256 public constant MAX_KEEPERS = 100;

    // Modifiers
    modifier validAmount(uint256 amount) {
        require(amount >= minOrderAmount && amount <= maxOrderAmount, "Invalid amount");
        _;
    }

    modifier validOrder(uint256 orderId) {
        require(orderId > 0 && orderId < _nextOrderId, "Invalid order ID");
        _;
    }

    modifier validUser() {
        require(userOrders[msg.sender].length < MAX_ORDERS_PER_USER, "Too many active orders");
        _;
    }

    constructor(
        address _usdc,
        address _weth,
        address _uniswapFactory,
        uint256 _minOrderAmount,
        uint256 _maxOrderAmount,
        uint256 _orderExpiryTime,
        uint256 _protocolFee,
        uint256 _keeperFee,
        address _feeCollector
    ) Ownable(msg.sender) {
        require(_usdc != address(0) && _weth != address(0), "Zero address");
        require(_uniswapFactory != address(0), "Zero factory address");
        require(_minOrderAmount > 0 && _maxOrderAmount > _minOrderAmount, "Invalid amounts");
        require(_orderExpiryTime > 0 && _orderExpiryTime <= 7 days, "Invalid expiry time");

        USDC = _usdc;
        WETH = _weth;
        uniswapFactory = IUniswapV3Factory(_uniswapFactory);
        minOrderAmount = _minOrderAmount;
        maxOrderAmount = _maxOrderAmount;
        orderExpiryTime = _orderExpiryTime;
        _nextOrderId = 1;

        require(_protocolFee <= MAX_PROTOCOL_FEE, "Protocol fee too high");
        require(_keeperFee <= MAX_KEEPER_FEE, "Keeper fee too high");
        require(_feeCollector != address(0), "Zero fee collector");

        feeConfig = FeeConfig({
            protocolFee: _protocolFee,
            keeperFee: _keeperFee,
            feeCollector: _feeCollector,
            feesEnabled: true
        });

        feeStats = FeeStats({
            totalProtocolFees: 0,
            totalKeeperFees: 0,
            lastUpdate: uint32(block.timestamp)
        });
    }

    /**
     * @notice Gets the current Uniswap V3 price for USDC/WETH
     * @return price Current price in USDC per WETH (18 decimals)
     */
    function getUniswapPrice() public view returns (uint256 price) {
        address pool = uniswapFactory.getPool(USDC, WETH, UNISWAP_FEE);
        require(pool != address(0), "Pool not found");
        
        (uint160 sqrtPriceX96,,,,,,) = IUniswapV3Pool(pool).slot0();
        
        // Optimization: Use unchecked for operations that cannot overflow
        unchecked {
            uint256 priceX96 = uint256(sqrtPriceX96) * uint256(sqrtPriceX96) * (1e18) >> 192;
            price = priceX96 * DECIMAL_ADJUSTMENT;
        }
    }

    /**
     * @notice Verifies if the execution price is within the Uniswap price tolerance
     * @param executionPrice Proposed execution price
     * @return bool true if price is within tolerance
     */
    function isPriceWithinTolerance(uint256 executionPrice) public view returns (bool) {
        uint256 uniswapPrice = getUniswapPrice();
        uint256 tolerance = (uniswapPrice * PRICE_TOLERANCE) / 10000;
        
        return executionPrice >= uniswapPrice - tolerance && 
               executionPrice <= uniswapPrice + tolerance;
    }

    /**
     * @notice Creates a new limit order for USDC/WETH
     */
    function placeOrder(
        uint256 amountIn,
        uint256 amountOutMin,
        uint256 price,
        bool isBuy
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        validAmount(amountIn)
        validUser
        returns (uint256 orderId) 
    {
        require(price > 0, "Invalid price");
        require(amountOutMin > 0, "Invalid min output");

        orderId = _nextOrderId++;
        uint32 expiryTime = uint32(block.timestamp + orderExpiryTime);
        
        orders[orderId] = Order({
            maker: msg.sender,
            amountIn: amountIn,
            amountOutMin: amountOutMin,
            price: price,
            timestamp: uint32(block.timestamp),
            expiryTime: expiryTime,
            isBuy: isBuy,
            isActive: true
        });

        userOrders[msg.sender].push(orderId);

        // Transfer tokens to contract
        if (isBuy) {
            require(IERC20(USDC).transferFrom(msg.sender, address(this), amountIn), "USDC transfer failed");
        } else {
            require(IERC20(WETH).transferFrom(msg.sender, address(this), amountIn), "WETH transfer failed");
        }

        emit OrderPlaced(
            orderId,
            msg.sender,
            amountIn,
            amountOutMin,
            price,
            isBuy,
            expiryTime
        );
    }

    /**
     * @notice Executes an existing order with fees
     */
    function executeOrder(
        uint256 orderId,
        uint256 amountIn,
        uint256 amountOut
    ) 
        external 
        nonReentrant 
        whenNotPaused 
        validOrder(orderId)
    {
        require(keeperStats[msg.sender].isActive, "Not registered keeper");
        
        Order storage order = orders[orderId];
        require(order.isActive, "Order not active");
        require(block.timestamp <= order.expiryTime, "Order expired");
        require(amountOut >= order.amountOutMin, "Slippage too high");
        require(amountIn > 0 && amountOut > 0, "Invalid amounts");

        // Validate current price vs limit price
        uint256 executionPrice = (amountOut * PRICE_PRECISION) / amountIn;
        require(
            order.isBuy ? executionPrice <= order.price : executionPrice >= order.price,
            "Price not met"
        );

        // Validate against Uniswap price
        require(isPriceWithinTolerance(executionPrice), "Price too far from Uniswap");

        order.isActive = false;

        // Calculate fees if enabled
        uint256 protocolFeeAmount;
        uint256 keeperFeeAmount;

        if (feeConfig.feesEnabled) {
            protocolFeeAmount = (amountIn * feeConfig.protocolFee) / BASIS_POINTS;
            keeperFeeAmount = (amountIn * feeConfig.keeperFee) / BASIS_POINTS;
        }

        // Transfer tokens
        if (order.isBuy) {
            // Buy order: taker sends WETH, receives USDC
            require(IERC20(WETH).transferFrom(msg.sender, order.maker, amountOut), "WETH transfer failed");
            require(IERC20(USDC).transfer(msg.sender, amountIn - protocolFeeAmount - keeperFeeAmount), "USDC transfer failed");
            
            // Transfer fees
            if (feeConfig.feesEnabled) {
                require(IERC20(USDC).transfer(feeConfig.feeCollector, protocolFeeAmount), "Protocol fee transfer failed");
                require(IERC20(USDC).transfer(msg.sender, keeperFeeAmount), "Keeper fee transfer failed");
            }
        } else {
            // Sell order: taker sends USDC, receives WETH
            require(IERC20(USDC).transferFrom(msg.sender, order.maker, amountOut), "USDC transfer failed");
            require(IERC20(WETH).transfer(msg.sender, amountIn - protocolFeeAmount - keeperFeeAmount), "WETH transfer failed");
            
            // Transfer fees
            if (feeConfig.feesEnabled) {
                require(IERC20(WETH).transfer(feeConfig.feeCollector, protocolFeeAmount), "Protocol fee transfer failed");
                require(IERC20(WETH).transfer(msg.sender, keeperFeeAmount), "Keeper fee transfer failed");
            }
        }

        // Update keeper stats
        KeeperStats storage stats = keeperStats[msg.sender];
        stats.totalExecutions++;
        stats.totalVolume += amountIn;
        stats.lastExecution = uint32(block.timestamp);

        // Update fee statistics
        if (feeConfig.feesEnabled) {
            feeStats.totalProtocolFees += protocolFeeAmount;
            feeStats.totalKeeperFees += keeperFeeAmount;
            feeStats.lastUpdate = uint32(block.timestamp);
            keeperFees[msg.sender] += keeperFeeAmount;
        }

        uint256 uniswapPrice = getUniswapPrice();
        emit OrderExecuted(
            orderId,
            order.maker,
            msg.sender,
            amountIn,
            amountOut,
            executionPrice,
            uniswapPrice,
            protocolFeeAmount,
            keeperFeeAmount
        );

        emit KeeperExecution(
            msg.sender,
            orderId,
            executionPrice,
            gasleft()
        );
    }

    /**
     * @notice Cancels an existing order
     */
    function cancelOrder(uint256 orderId) 
        external 
        nonReentrant 
        whenNotPaused 
        validOrder(orderId)
    {
        Order storage order = orders[orderId];
        require(order.maker == msg.sender, "Not order maker");
        require(order.isActive, "Order not active");
        require(block.timestamp <= order.expiryTime, "Order expired");

        order.isActive = false;
        
        // Return tokens to maker
        if (order.isBuy) {
            require(IERC20(USDC).transfer(order.maker, order.amountIn), "USDC transfer failed");
        } else {
            require(IERC20(WETH).transfer(order.maker, order.amountIn), "WETH transfer failed");
        }

        emit OrderCancelled(orderId, msg.sender, order.amountIn);
    }

    // Admin functions
    function pause() external onlyOwner {
        _pause();
        emit ProtocolPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
        emit ProtocolUnpaused(msg.sender);
    }

    function setMinOrderAmount(uint256 _minOrderAmount) external onlyOwner {
        require(_minOrderAmount > 0 && _minOrderAmount < maxOrderAmount, "Invalid amount");
        uint256 oldAmount = minOrderAmount;
        minOrderAmount = _minOrderAmount;
        emit MinOrderAmountUpdated(oldAmount, _minOrderAmount);
    }

    function setMaxOrderAmount(uint256 _maxOrderAmount) external onlyOwner {
        require(_maxOrderAmount > minOrderAmount, "Invalid amount");
        uint256 oldAmount = maxOrderAmount;
        maxOrderAmount = _maxOrderAmount;
        emit MaxOrderAmountUpdated(oldAmount, _maxOrderAmount);
    }

    function setOrderExpiryTime(uint256 _orderExpiryTime) external onlyOwner {
        require(_orderExpiryTime > 0 && _orderExpiryTime <= 7 days, "Invalid expiry time");
        uint256 oldTime = orderExpiryTime;
        orderExpiryTime = _orderExpiryTime;
        emit OrderExpiryTimeUpdated(oldTime, _orderExpiryTime);
    }

    /**
     * @notice Updates fee configuration
     */
    function updateFees(
        uint256 _protocolFee,
        uint256 _keeperFee,
        address _feeCollector
    ) external onlyOwner {
        require(_protocolFee <= MAX_PROTOCOL_FEE, "Protocol fee too high");
        require(_keeperFee <= MAX_KEEPER_FEE, "Keeper fee too high");
        require(_feeCollector != address(0), "Zero fee collector");

        feeConfig.protocolFee = _protocolFee;
        feeConfig.keeperFee = _keeperFee;
        feeConfig.feeCollector = _feeCollector;

        emit FeesUpdated(_protocolFee, _keeperFee, _feeCollector);
    }

    /**
     * @notice Enables or disables fees
     */
    function setFeesEnabled(bool _enabled) external onlyOwner {
        feeConfig.feesEnabled = _enabled;
    }

    /**
     * @notice Allows a keeper to claim their accumulated fees
     */
    function claimKeeperFees() external nonReentrant {
        uint256 amount = keeperFees[msg.sender];
        require(amount > 0, "No fees to claim");

        keeperFees[msg.sender] = 0;
        
        // Transfer fees to keeper
        if (orders[0].isBuy) {
            require(IERC20(USDC).transfer(msg.sender, amount), "USDC transfer failed");
        } else {
            require(IERC20(WETH).transfer(msg.sender, amount), "WETH transfer failed");
        }

        emit KeeperFeesClaimed(msg.sender, amount);
    }

    /**
     * @notice Emergency withdraw function for stuck tokens
     * @dev Only owner can call this function
     */
    function emergencyWithdraw(
        address token,
        uint256 amount,
        address to
    ) external onlyOwner {
        require(token != address(0) && to != address(0), "Zero address");
        require(amount > 0, "Zero amount");
        require(IERC20(token).transfer(to, amount), "Transfer failed");
        emit EmergencyWithdraw(token, amount, to);
    }

    // View functions
    function getUserOrders(address user) external view returns (uint256[] memory) {
        return userOrders[user];
    }

    function getOrderDetails(uint256 orderId) external view validOrder(orderId) returns (Order memory) {
        return orders[orderId];
    }

    function getActiveOrdersCount(address user) external view returns (uint256) {
        uint256 count = 0;
        uint256[] memory userOrderIds = userOrders[user];
        for (uint256 i = 0; i < userOrderIds.length; i++) {
            if (orders[userOrderIds[i]].isActive) {
                count++;
            }
        }
        return count;
    }

    function getTotalOrders() external view returns (uint256) {
        return _nextOrderId - 1;
    }

    function getFeeStats() external view returns (FeeStats memory) {
        return feeStats;
    }

    function getFeeConfig() external view returns (FeeConfig memory) {
        return feeConfig;
    }

    /**
     * @notice Register as a keeper
     * @dev Allows an address to register as a keeper
     */
    function registerKeeper() external {
        require(!keeperStats[msg.sender].isActive, "Already registered");
        require(totalKeepers < MAX_KEEPERS, "Max keepers reached");
        
        keeperStats[msg.sender] = KeeperStats({
            totalExecutions: 0,
            totalVolume: 0,
            lastExecution: uint32(block.timestamp),
            isActive: true
        });
        
        totalKeepers++;
        emit KeeperRegistered(msg.sender);
    }

    /**
     * @notice Unregister as a keeper
     * @dev Allows a keeper to unregister
     */
    function unregisterKeeper() external {
        require(keeperStats[msg.sender].isActive, "Not registered");
        keeperStats[msg.sender].isActive = false;
        totalKeepers--;
        emit KeeperUnregistered(msg.sender);
    }

    /**
     * @notice Get executable orders for keepers
     * @param startIndex Starting index to search from
     * @param limit Maximum number of orders to return
     * @return executableOrders Array of order IDs that can be executed
     */
    function getExecutableOrders(
        uint256 startIndex,
        uint256 limit
    ) external view returns (uint256[] memory executableOrders) {
        require(startIndex < _nextOrderId, "Invalid start index");
        require(limit > 0 && limit <= 50, "Invalid limit");

        executableOrders = new uint256[](limit);
        uint256 count = 0;
        uint256 currentIndex = startIndex;
        
        while (count < limit && currentIndex < _nextOrderId) {
            Order storage order = orders[currentIndex];
            if (order.isActive && block.timestamp <= order.expiryTime) {
                uint256 currentPrice = getUniswapPrice();
                if ((order.isBuy && currentPrice <= order.price) || 
                    (!order.isBuy && currentPrice >= order.price)) {
                    executableOrders[count] = currentIndex;
                    count++;
                }
            }
            currentIndex++;
        }
    }

    /**
     * @notice Get keeper statistics
     * @param keeper Address of the keeper
     * @return stats Keeper statistics
     */
    function getKeeperStats(address keeper) external view returns (KeeperStats memory stats) {
        return keeperStats[keeper];
    }
} 