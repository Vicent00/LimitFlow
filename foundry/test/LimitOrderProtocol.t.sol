// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import "forge-std/Test.sol";
import "../src/core/LimitOrderProtocol.sol";
import "./mocks/MockERC20.sol";

contract LimitOrderProtocolTest is Test {
    // Contratos
    MockERC20 public usdc;
    MockERC20 public weth;
    LimitOrderProtocol public protocol;

    // Test accounts
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public keeper = makeAddr("keeper");

    // Constantes
    uint256 public constant INITIAL_BALANCE = 1000000e6; // 1M USDC
    uint256 public constant INITIAL_WETH = 1000e18;      // 1000 WETH
    uint256 public constant ORDER_AMOUNT = 1000e6;       // 1000 USDC
    uint256 public constant WETH_AMOUNT = 0.5e18;        // 0.5 WETH

    function setUp() public {
        // Deploy tokens
        usdc = new MockERC20("USD Coin", "USDC", 6);
        weth = new MockERC20("Wrapped Ether", "WETH", 18);

        // Deploy protocol
        protocol = new LimitOrderProtocol(
            address(usdc),
            address(weth),
            address(0), // No Uniswap factory needed
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

        // Setup test accounts
        usdc.mint(alice, INITIAL_BALANCE);
        weth.mint(alice, INITIAL_WETH);
        usdc.mint(bob, INITIAL_BALANCE);
        weth.mint(bob, INITIAL_WETH);
        usdc.mint(keeper, INITIAL_BALANCE);
        weth.mint(keeper, INITIAL_WETH);
    }

    function testPlaceOrder() public {
        vm.startPrank(alice);
        
        // Approve tokens
        usdc.approve(address(protocol), type(uint256).max);
        
        // Place buy order
        protocol.placeOrder(
            ORDER_AMOUNT,    // 1000 USDC
            WETH_AMOUNT,     // 0.5 WETH
            2000e18,         // price (2000 USDC per WETH)
            true            // buy
        );
        
        vm.stopPrank();

        // Verify order was placed
        LimitOrderProtocol.Order memory order = protocol.getOrderDetails(1);
        assertEq(order.maker, alice);
        assertEq(order.amountIn, ORDER_AMOUNT);
        assertEq(order.amountOutMin, WETH_AMOUNT);
        assertTrue(order.isActive);
    }

    function testCancelOrder() public {
        // Get initial balance
        uint256 initialBalance = usdc.balanceOf(alice);
        
        // First place an order
        vm.startPrank(alice);
        usdc.approve(address(protocol), type(uint256).max);
        
        protocol.placeOrder(
            ORDER_AMOUNT,
            WETH_AMOUNT,
            2000e18,
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
        
        // Verify order details
        assertEq(order.maker, alice, "Order maker incorrect");
        assertEq(order.amountIn, ORDER_AMOUNT, "Order amount incorrect");
        assertEq(order.amountOutMin, WETH_AMOUNT, "Order min output incorrect");
        assertEq(order.price, 2000e18, "Order price incorrect");
        assertTrue(order.isBuy, "Order should be buy order");
        
        vm.stopPrank();
    }

    function testOrderExpiry() public {
        vm.startPrank(alice);
        usdc.approve(address(protocol), type(uint256).max);
        
        protocol.placeOrder(
            ORDER_AMOUNT,
            WETH_AMOUNT,
            2000e18,
            true
        );
        
        // Fast forward past expiry
        vm.warp(block.timestamp + 2 days);
        
        // Try to execute expired order
        vm.stopPrank();
        vm.startPrank(keeper);
        weth.approve(address(protocol), type(uint256).max);
        
        vm.expectRevert("Order expired");
        protocol.executeOrder(1, ORDER_AMOUNT, WETH_AMOUNT);
        
        vm.stopPrank();
    }

    function testMaxOrdersPerUser() public {
        vm.startPrank(alice);
        usdc.approve(address(protocol), type(uint256).max);
        
        // Place maximum number of orders
        for(uint i = 0; i < 100; i++) {
            protocol.placeOrder(
                ORDER_AMOUNT,
                WETH_AMOUNT,
                2000e18,
                true
            );
        }
        
        // Try to place one more order
        vm.expectRevert("Too many active orders");
        protocol.placeOrder(
            ORDER_AMOUNT,
            WETH_AMOUNT,
            2000e18,
            true
        );
        
        vm.stopPrank();
    }
} 