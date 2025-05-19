// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/core/LimitOrderProtocol.sol";
import "./mocks/MockERC20.sol";

contract LimitOrderProtocolForkTest is Test {
    // Arbitrum Mainnet addresses
    address constant ARBITRUM_USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant ARBITRUM_WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant ARBITRUM_UNISWAP_V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;
    
    // Whale addresses for testing
    address constant USDC_WHALE = 0x489ee077994B6658eAfA855C308275EAd8097C4A; // GMX Router
    address constant WETH_WHALE = 0x489ee077994B6658eAfA855C308275EAd8097C4A; // GMX Router

    // Contratos
    IERC20 public usdc;
    IERC20 public weth;
    LimitOrderProtocol public protocol;

    // Test accounts
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public keeper = makeAddr("keeper");

    // Constantes
    uint256 public constant INITIAL_BALANCE = 10000e6;  // 10k USDC (reducido para evitar problemas con balances)
    uint256 public constant INITIAL_WETH = 10e18;       // 10 WETH (reducido para evitar problemas con balances)
    uint256 public constant ORDER_AMOUNT = 100e6;       // 100 USDC
    uint256 public constant WETH_AMOUNT = 0.05e18;      // 0.05 WETH

    function setUp() public {
        // Fork Arbitrum mainnet with specific block number for consistency
        vm.createSelectFork("https://arb1.arbitrum.io/rpc"); // Usando un block number específico

        // Initialize real tokens
        usdc = IERC20(ARBITRUM_USDC);
        weth = IERC20(ARBITRUM_WETH);

        // Verify token balances of whales
        uint256 usdcWhaleBalance = usdc.balanceOf(USDC_WHALE);
        uint256 wethWhaleBalance = weth.balanceOf(WETH_WHALE);
        require(usdcWhaleBalance >= INITIAL_BALANCE * 3, "USDC whale balance too low");
        require(wethWhaleBalance >= INITIAL_WETH * 3, "WETH whale balance too low");

        // Deploy protocol with real addresses
        protocol = new LimitOrderProtocol(
            ARBITRUM_USDC,
            ARBITRUM_WETH,
            ARBITRUM_UNISWAP_V3_FACTORY,
            1e6,        // minOrderAmount
            1e9,        // maxOrderAmount
            1 days,     // orderExpiryTime
            10,         // protocolFee (0.1%)
            5,          // keeperFee (0.05%)
            address(this) // feeCollector
        );

        // Register keeper
        vm.startPrank(keeper);
        protocol.registerKeeper();
        vm.stopPrank();

        // Setup test accounts with real tokens
        vm.startPrank(USDC_WHALE);
        require(usdc.transfer(alice, INITIAL_BALANCE), "USDC transfer to alice failed");
        require(usdc.transfer(bob, INITIAL_BALANCE), "USDC transfer to bob failed");
        require(usdc.transfer(keeper, INITIAL_BALANCE), "USDC transfer to keeper failed");
        vm.stopPrank();

        vm.startPrank(WETH_WHALE);
        require(weth.transfer(alice, INITIAL_WETH), "WETH transfer to alice failed");
        require(weth.transfer(bob, INITIAL_WETH), "WETH transfer to bob failed");
        require(weth.transfer(keeper, INITIAL_WETH), "WETH transfer to keeper failed");
        vm.stopPrank();

        // Verify initial balances
        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE, "Alice USDC balance incorrect");
        assertEq(weth.balanceOf(alice), INITIAL_WETH, "Alice WETH balance incorrect");
    }


    function testSetUp() public view {
        // Verify token addresses
        assertEq(address(usdc), ARBITRUM_USDC, "USDC address incorrect");
        assertEq(address(weth), ARBITRUM_WETH, "WETH address incorrect");

        // Verify protocol configuration
        
        assertEq(protocol.minOrderAmount(), 1e6, "Min order amount incorrect");
        assertEq(protocol.maxOrderAmount(), 1e9, "Max order amount incorrect");
        assertEq(protocol.orderExpiryTime(), 1 days, "Order expiry time incorrect");

        // Verify fee configuration
        LimitOrderProtocol.FeeConfig memory feeConfig = protocol.getFeeConfig();
        assertEq(feeConfig.protocolFee, 10, "Protocol fee incorrect");
        assertEq(feeConfig.keeperFee, 5, "Keeper fee incorrect");
        assertEq(feeConfig.feeCollector, address(this), "Fee collector incorrect");
        assertTrue(feeConfig.feesEnabled, "Fees should be enabled");

        // Verify keeper registration
        LimitOrderProtocol.KeeperStats memory keeperStats = protocol.getKeeperStats(keeper);
        assertTrue(keeperStats.isActive, "Keeper should be registered"); 
               
        assertEq(protocol.totalKeepers(), 1, "Total keepers should be 1");

        // Verify initial balancesd
        assertEq(usdc.balanceOf(alice), INITIAL_BALANCE, "Alice USDC balance incorrect");
        assertEq(weth.balanceOf(alice), INITIAL_WETH, "Alice WETH balance incorrect");
        assertEq(usdc.balanceOf(bob), INITIAL_BALANCE, "Bob USDC balance incorrect");
        assertEq(weth.balanceOf(bob), INITIAL_WETH, "Bob WETH balance incorrect");
        assertEq(usdc.balanceOf(keeper), INITIAL_BALANCE, "Keeper USDC balance incorrect");
        assertEq(weth.balanceOf(keeper), INITIAL_WETH, "Keeper WETH balance incorrect");

        // Verify Uniswap factory
        assertEq(address(protocol.uniswapFactory()), ARBITRUM_UNISWAP_V3_FACTORY, "Uniswap factory address incorrect");

        // Verify initial protocol state
        assertEq(protocol.getTotalOrders(), 0, "Should start with 0 orders");
        assertEq(protocol.getActiveOrdersCount(alice), 0, "Alice should start with 0 active orders");
        assertEq(protocol.getActiveOrdersCount(bob), 0, "Bob should start with 0 active orders");
        assertEq(protocol.getActiveOrdersCount(keeper), 0, "Keeper should start with 0 active orders");

        // Verify fee stats
        LimitOrderProtocol.FeeStats memory feeStats = protocol.getFeeStats();
        assertEq(feeStats.totalProtocolFees, 0, "Should start with 0 protocol fees");
        assertEq(feeStats.totalKeeperFees, 0, "Should start with 0 keeper fees");
    }


    function testPlaceOrderWithRealTokens() public {
        vm.startPrank(alice);
        
        // Approve tokens
        require(usdc.approve(address(protocol), type(uint256).max), "USDC approval failed");
        
        // Get current Uniswap price
        uint256 currentPrice = protocol.getUniswapPrice();
        require(currentPrice > 0, "Invalid Uniswap price");
        
        // Place buy order slightly above current price
        protocol.placeOrder(
            ORDER_AMOUNT,    // 100 USDC
            WETH_AMOUNT,     // 0.05 WETH
            currentPrice + (currentPrice * 1) / 100, // 1% above current price
            true            // buy
        );
        
        vm.stopPrank();

        // Verify order was placed
        LimitOrderProtocol.Order memory order = protocol.getOrderDetails(1);
        assertEq(order.maker, alice, "Order maker incorrect");
        assertEq(order.amountIn, ORDER_AMOUNT, "Order amount incorrect");
        assertEq(order.amountOutMin, WETH_AMOUNT, "Order min output incorrect");
        assertTrue(order.isActive, "Order should be active");
        assertTrue(order.isBuy, "Order should be buy order");
    }

    function testExecuteOrderWithRealTokens() public {
        // First place an order
        vm.startPrank(alice);
        require(usdc.approve(address(protocol), type(uint256).max), "USDC approval failed");
        
        // Get current Uniswap price
        uint256 currentPrice = protocol.getUniswapPrice();
        require(currentPrice > 0, "Invalid Uniswap price");
        
        // Place order with a price 15% above current price to ensure execution
        protocol.placeOrder(
            ORDER_AMOUNT,    // 100 USDC
            WETH_AMOUNT,     // 0.05 WETH
            currentPrice + (currentPrice * 15) / 100, // 15% above current price
            true            // buy
        );
        vm.stopPrank();

        // Execute order as keeper
        vm.startPrank(keeper);
        require(weth.approve(address(protocol), type(uint256).max), "WETH approval failed");
        
        // Get balances before execution
        uint256 keeperWethBefore = weth.balanceOf(keeper);
        uint256 aliceUsdcBefore = usdc.balanceOf(alice);
        
        // Get current price again to verify
        uint256 executionPrice = protocol.getUniswapPrice();
        require(executionPrice > 0, "Invalid Uniswap price at execution");
        
        // Execute order
        try protocol.executeOrder(1, ORDER_AMOUNT, WETH_AMOUNT) {
            // Verify balances after execution
            uint256 keeperWethAfter = weth.balanceOf(keeper);
            uint256 aliceUsdcAfter = usdc.balanceOf(alice);
            
            assertTrue(keeperWethBefore > keeperWethAfter, "Keeper WETH balance should decrease");
            assertTrue(aliceUsdcBefore < aliceUsdcAfter, "Alice USDC balance should increase");
            
            // Verify order is no longer active
            LimitOrderProtocol.Order memory order = protocol.getOrderDetails(1);
            assertFalse(order.isActive, "Order should be inactive after execution");
        } catch Error(string memory reason) {
            emit log_string(string.concat("Order execution failed: ", reason));
            emit log_named_uint("Current Price", currentPrice);
            emit log_named_uint("Execution Price", executionPrice);
            emit log_named_uint("Order Price", currentPrice + (currentPrice * 15) / 100);
            fail();
        } catch {
            emit log_string("Order execution failed with unknown error");
            fail();
        }
        
        vm.stopPrank();
    }

    function testCancelOrderWithRealTokens() public {
        // Get initial balance
        uint256 initialBalance = usdc.balanceOf(alice);
        
        // First place an order
        vm.startPrank(alice);
        require(usdc.approve(address(protocol), type(uint256).max), "USDC approval failed");
        
        uint256 currentPrice = protocol.getUniswapPrice();
        require(currentPrice > 0, "Invalid Uniswap price");
        
        protocol.placeOrder(
            ORDER_AMOUNT,
            WETH_AMOUNT,
            currentPrice + (currentPrice * 1) / 100, // 1% above current price
            true
        );
        
        // Verify balance after placing order
        assertEq(usdc.balanceOf(alice), initialBalance - ORDER_AMOUNT, "Balance incorrect after placing order");
        
        // Cancel order
        protocol.cancelOrder(1);
        
        // Verify balance was returned exactly
        assertEq(usdc.balanceOf(alice), initialBalance, "Balance not fully returned after cancellation");
        
        // Verify order is inactive
        LimitOrderProtocol.Order memory order = protocol.getOrderDetails(1);
        assertFalse(order.isActive, "Order should be inactive after cancellation");
        assertEq(order.maker, alice, "Order maker incorrect");
        assertEq(order.amountIn, ORDER_AMOUNT, "Order amount incorrect");
        assertEq(order.amountOutMin, WETH_AMOUNT, "Order min output incorrect");
        
        vm.stopPrank();
    }
} 