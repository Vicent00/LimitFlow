# Limit Order Protocol

Un sistema que permite a cualquier usuario colocar órdenes “compra X por ≤ P” o “vende X por ≥ P” y que éstas solo se ejecuten cuando el precio en el AMM cruce ese umbral.

---

## 📋 Resumen rápido

### 1. Contrato Core

- Guarda y gestiona órdenes en una estructura ordenada por precio  
- **Funciones clave**:  
  - `placeOrder()`  
  - `cancelOrder()`  
  - `executeOrder()`  
- Validación on-chain de precio contra Uniswap (o Chainlink)

### 2. Keepers (Bots)

- Escuchan eventos de nuevas órdenes  
- Monitorean el precio (tick de Uniswap o Feed de Chainlink)  
- Ejecutan `executeOrder()` cuando se cumple la condición  
- Se incentivan cobrando una pequeña comisión o gas-refund en tokens

### 3. Indexador / Subgraph

- Indexa órdenes abiertas y ejecuciones para el frontend  
- Facilita la construcción de un “order book” on-chain

### 4. Frontend

- Formulario de creación / cancelación de órdenes  
- Visualización del order book y del histórico de ejecuciones  
- Integración con Wagmi / Viem para firmas y lectura de eventos

### 5. Redes y Tokens

| Entorno          | Redes principales                          | Tokens soportados  |
|------------------|--------------------------------------------|--------------------|
| **Producción**   | Ethereum Mainnet                           | WETH / USDC        |
|                  | Arbitrum One, Optimism, Polygon PoS        | (ERC-20 sólo)      |
| **Testnets**     | Goerli (incl. Goerli-Arbitrum)             | WETH / USDC        |
|                  | Mumbai (Polygon)                           | (ERC-20 sólo)      |

> **Nota:** Se utiliza WETH en lugar de ETH para permitir llamadas a `approve()` y rutas multihop sin lógica especial.

---
