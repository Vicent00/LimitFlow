# Limit Order Protocol

A system that allows any user to place "buy X for ≤ P" or "sell X for ≥ P" orders that only execute when the AMM price crosses that threshold.

---

## 📋 Quick Overview

### 1. Core Contract

- Stores and manages orders in a price-sorted structure  
- **Key Functions**:  
  - `placeOrder()`  
  - `cancelOrder()`  
  - `executeOrder()`  
- On-chain price validation against Uniswap (or Chainlink)

### 2. Keepers (Bots)

- Listen for new order events  
- Monitor price (Uniswap tick or Chainlink feed)  
- Execute `executeOrder()` when conditions are met  
- Incentivized through small commission or token gas-refund

### 3. Indexer / Subgraph

- Indexes open orders and executions for the frontend  
- Facilitates building an on-chain "order book"

### 4. Frontend

- Order creation/cancellation form  
- Order book and execution history visualization  
- Wagmi / Viem integration for signatures and event reading

### 5. Networks and Tokens

| Environment      | Main Networks                          | Supported Tokens  |
|------------------|----------------------------------------|-------------------|
| **Production**   | Ethereum Mainnet                       | WETH / USDC       |
|                  | Arbitrum One, Optimism, Polygon PoS    | (ERC-20 only)     |
| **Testnets**     | Goerli (incl. Goerli-Arbitrum)         | WETH / USDC       |
|                  | Mumbai (Polygon)                       | (ERC-20 only)     |

> **Note:** WETH is used instead of ETH to allow `approve()` calls and multihop routes without special logic.

---

## 🚧 Project Status

### Completed
- Basic frontend structure
- Theme implementation (light/dark mode)
- Basic layout and components

### In Progress
- Smart contract development
- Frontend-backend connection
- Order management system

### Pending
- Integration with Uniswap/Chainlink for price feeds
- Keeper bot implementation
- Subgraph development
- Order execution system
- Testing and deployment scripts

## 🔗 Connection Status
Currently, the frontend is not connected to any backend or smart contracts. The following connections need to be implemented:
- Smart contract integration
- Web3 wallet connection
- Price feed integration
- Order management system
- Event listening and handling

---

## 🛠️ Tech Stack
- Frontend: Next.js, TailwindCSS, TypeScript
- Smart Contracts: Solidity 0.8.26, Foundry
- Web3: Wagmi, Viem
- Testing: Foundry, Jest
