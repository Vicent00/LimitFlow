## Foundry

**Foundry is a blazing fast, portable and modular toolkit for Ethereum application development written in Rust.**

Foundry consists of:

-   **Forge**: Ethereum testing framework (like Truffle, Hardhat and DappTools).
-   **Cast**: Swiss army knife for interacting with EVM smart contracts, sending transactions and getting chain data.
-   **Anvil**: Local Ethereum node, akin to Ganache, Hardhat Network.
-   **Chisel**: Fast, utilitarian, and verbose solidity REPL.

## Deployed Contracts (Arbitrum One)

### Main Protocol
- **LimitOrderProtocol**: `0x4988f109Dc583C1cd78A9035bdD238910ba31300`
  - Min Order Amount: 1,000,000
  - Max Order Amount: 1,000,000,000
  - Order Expiry Time: 86,400 (24 hours)
  - Protocol Fee: 10
  - Keeper Fee: 5
  - Fee Collector: `0x6e6b7C85fb7a1a9f0cbd7a6233d36E9f2EF23151`

### Token Addresses
- **USDC**: `0xaf88d065e77c8cC2239327C5EDb3A432268e5831`
- **WETH**: `0x82aF49447D8a07e3bd95BD0d56f35241523fBab1`

### Dependencies
- **Uniswap V3 Factory**: `0x1F98431c8aD98523631AE4a59f267346ea31F984`

## Documentation

https://book.getfoundry.sh/

## Usage

### Build

```shell
$ forge build
```

### Test

```shell
$ forge test
```

### Format

```shell
$ forge fmt
```

### Gas Snapshots

```shell
$ forge snapshot
```

### Anvil

```shell
$ anvil
```

### Deploy

```shell
$ forge script script/DeployLimitOrderProtocol.s.sol --rpc-url https://arb1.arbitrum.io/rpc --broadcast --verify -vvvv --legacy
```

### Cast

```shell
$ cast <subcommand>
```

### Help

```shell
$ forge --help
$ anvil --help
$ cast --help
```

## Interacting with Contracts

### Using Forge
```shell
# Read functions
$ forge call 0x4988f109Dc583C1cd78A9035bdD238910ba31300 --rpc-url https://arb1.arbitrum.io/rpc "getTotalOrders()"

# Write functions
$ forge send 0x4988f109Dc583C1cd78A9035bdD238910ba31300 --rpc-url https://arb1.arbitrum.io/rpc "createOrder()"
```

### Using Cast
```shell
# Get contract code
$ cast code 0x4988f109Dc583C1cd78A9035bdD238910ba31300 --rpc-url https://arb1.arbitrum.io/rpc

# Get contract storage
$ cast storage 0x4988f109Dc583C1cd78A9035bdD238910ba31300 --rpc-url https://arb1.arbitrum.io/rpc
```
