// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Script.sol";
import "../src/core/LimitOrderProtocol.sol";
import "../mocks/MockERC20.sol";

contract DeployAnvil is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // Deploy mock tokens
        MockERC20 usdc = new MockERC20("USD Coin", "USDC", 6);
        MockERC20 weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Deploy protocol
        LimitOrderProtocol protocol = new LimitOrderProtocol(
            address(usdc),
            address(weth),
            address(0), // No Uniswap factory needed for testing
            1e6,        // minOrderAmount
            1e9,        // maxOrderAmount
            1 days,     // orderExpiryTime
            10,         // protocolFee (0.1%)
            5,          // keeperFee (0.05%)
            msg.sender  // feeCollector
        );

        vm.stopBroadcast();

        // Log addresses for easy reference
        console.log("USDC deployed to:", address(usdc));
        console.log("WETH deployed to:", address(weth));
        console.log("Protocol deployed to:", address(protocol));
    }
}
