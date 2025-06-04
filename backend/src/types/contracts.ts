export interface OrderParams {
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  expiryTime: bigint;
}

export interface OrderCreatedEvent {
  orderId: bigint;
  user: string;
  tokenIn: string;
  tokenOut: string;
  amountIn: bigint;
  minAmountOut: bigint;
  expiryTime: bigint;
}

export interface OrderExecutedEvent {
  orderId: bigint;
  user: string;
  executor: string;
  amountIn: bigint;
  amountOut: bigint;
  protocolFee: bigint;
  keeperFee: bigint;
}

export interface OrderCancelledEvent {
  orderId: bigint;
  user: string;
}

export const ORDER_CONTRACT_ABI = [
  {
    name: 'placeOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'amountIn', type: 'uint256' },
      { name: 'amountOutMin', type: 'uint256' },
      { name: 'price', type: 'uint256' },
      { name: 'isBuy', type: 'bool' }
    ],
    outputs: [{ name: 'orderId', type: 'uint256' }]
  },
  {
    name: 'cancelOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'executeOrder',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'orderId', type: 'uint256' }],
    outputs: [{ name: '', type: 'bool' }]
  },
  {
    name: 'OrderPlaced',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOutMin', type: 'uint256', indexed: false },
      { name: 'price', type: 'uint256', indexed: false },
      { name: 'isBuy', type: 'bool', indexed: false },
      { name: 'expiryTime', type: 'uint32', indexed: false }
    ]
  },
  {
    name: 'OrderExecuted',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
      { name: 'taker', type: 'address', indexed: true },
      { name: 'amountIn', type: 'uint256', indexed: false },
      { name: 'amountOut', type: 'uint256', indexed: false },
      { name: 'executionPrice', type: 'uint256', indexed: false },
      { name: 'uniswapPrice', type: 'uint256', indexed: false },
      { name: 'protocolFee', type: 'uint256', indexed: false },
      { name: 'keeperFee', type: 'uint256', indexed: false }
    ]
  },
  {
    name: 'OrderCancelled',
    type: 'event',
    anonymous: false,
    inputs: [
      { name: 'orderId', type: 'uint256', indexed: true },
      { name: 'maker', type: 'address', indexed: true },
      { name: 'refundAmount', type: 'uint256', indexed: false }
    ]
  }
] as const; 