// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

/* 


Comando para ejecutar el script:
forge script script/DeployLimitOrderProtocol.s.sol --rpc-url $RPC_URL --broadcast --verify -vvvv



 */

import "forge-std/Script.sol";
import "../src/core/LimitOrderProtocol.sol";

contract DeployLimitOrderProtocol is Script {
    // Arbitrum Mainnet addresses
    address constant USDC = 0xaf88d065e77c8cC2239327C5EDb3A432268e5831;
    address constant WETH = 0x82aF49447D8a07e3bd95BD0d56f35241523fBab1;
    address constant UNISWAP_V3_FACTORY = 0x1F98431c8aD98523631AE4a59f267346ea31F984;

    // Deploy parameters
    uint256 constant MIN_ORDER_AMOUNT = 1e6;        // 1 USDC
    uint256 constant MAX_ORDER_AMOUNT = 1e9;        // 1000 USDC
    uint256 constant ORDER_EXPIRY_TIME = 1 days;    // 1 day
    uint256 constant PROTOCOL_FEE = 10;             // 0.1%
    uint256 constant KEEPER_FEE = 5;                // 0.05%

    function run() external {
        // Load environment variables
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address feeCollector = vm.envAddress("FEE_COLLECTOR");
        
        // Validate environment variables
        require(deployerPrivateKey != 0, "Invalid private key");
        require(feeCollector != address(0), "Invalid fee collector address");

        // Log deployment parameters
        console2.log("Deploying LimitOrderProtocol with parameters:");
        console2.log("USDC:", USDC);
        console2.log("WETH:", WETH);
        console2.log("Uniswap V3 Factory:", UNISWAP_V3_FACTORY);
        console2.log("Min Order Amount:", MIN_ORDER_AMOUNT);
        console2.log("Max Order Amount:", MAX_ORDER_AMOUNT);
        console2.log("Order Expiry Time:", ORDER_EXPIRY_TIME);
        console2.log("Protocol Fee:", PROTOCOL_FEE);
        console2.log("Keeper Fee:", KEEPER_FEE);
        console2.log("Fee Collector:", feeCollector);

        // Start broadcasting transactions
        vm.startBroadcast(deployerPrivateKey);

        // Deploy the contract
        LimitOrderProtocol protocol = new LimitOrderProtocol(
            USDC,
            WETH,
            UNISWAP_V3_FACTORY,
            MIN_ORDER_AMOUNT,
            MAX_ORDER_AMOUNT,
            ORDER_EXPIRY_TIME,
            PROTOCOL_FEE,
            KEEPER_FEE,
            feeCollector
        );

        vm.stopBroadcast();

        // Verify deployment
        require(address(protocol) != address(0), "Deployment failed");
        
        // Log deployment success
        console2.log("\nDeployment successful!");
        console2.log("LimitOrderProtocol deployed at:", address(protocol));

        // Verify contract parameters
        console2.log("\nVerifying contract parameters:");
        console2.log("USDC:", protocol.USDC());
        console2.log("WETH:", protocol.WETH());
        console2.log("Uniswap Factory:", address(protocol.uniswapFactory()));
        console2.log("Min Order Amount:", protocol.minOrderAmount());
        console2.log("Max Order Amount:", protocol.maxOrderAmount());
        console2.log("Order Expiry Time:", protocol.orderExpiryTime());
        
        // Verify fee configuration
        LimitOrderProtocol.FeeConfig memory feeConfig = protocol.getFeeConfig();
        console2.log("\nFee Configuration:");
        console2.log("Protocol Fee:", feeConfig.protocolFee);
        console2.log("Keeper Fee:", feeConfig.keeperFee);
        console2.log("Fee Collector:", feeConfig.feeCollector);
        console2.log("Fees Enabled:", feeConfig.feesEnabled);

        // Verify initial state
        console2.log("\nInitial State:");
        console2.log("Total Orders:", protocol.getTotalOrders());
        console2.log("Total Keepers:", protocol.totalKeepers());
    }
} 