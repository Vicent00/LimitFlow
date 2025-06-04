import { describe, it, expect, beforeAll } from '@jest/globals';
import { blockchainService } from '../services/blockchainService';

describe('Blockchain Service Tests', () => {
  let ethBalance: bigint;
  let usdcBalance: bigint;
  let wethBalance: bigint;
  const usdcAddress = process.env.USDC_ADDRESS || '';
  const wethAddress = process.env.WETH_ADDRESS || '';
  const walletAddress = process.env.WALLET_ADDRESS || '';

  beforeAll(async () => {
    console.log('Iniciando pruebas de blockchain...');
    
    // Verificar balances iniciales
    ethBalance = await blockchainService.getBalance(walletAddress);
    usdcBalance = await blockchainService.getTokenBalance(usdcAddress, walletAddress);
    wethBalance = await blockchainService.getTokenBalance(wethAddress, walletAddress);
    
    console.log('Balances iniciales:');
    console.log('ETH:', ethBalance.toString(), 'wei and in eth:', Number(ethBalance) / 10 ** 18);
    console.log('USDC:', usdcBalance.toString(), 'wei and in usdc:', Number(usdcBalance) / 10 ** 6);
    console.log('WETH:', wethBalance.toString(), 'wei and in weth:', Number(wethBalance) / 10 ** 18);
  });

  describe('Balance Checks', () => {
    it('should have ETH balance', () => {
      expect(ethBalance).toBeGreaterThan(0n);
      console.log('Balance de ETH:', ethBalance.toString(), 'wei and in eth:', Number(ethBalance) / 10 ** 18);
    });

    it('should check USDC balance', () => {
      expect(usdcBalance).toBeDefined();
      console.log('Balance de USDC:', usdcBalance.toString(), 'wei and in usdc:', Number(usdcBalance) / 10 ** 6);
    });

    it('should check WETH balance', () => {
      expect(wethBalance).toBeDefined();
      console.log('Balance de WETH:', wethBalance.toString(), 'wei and in weth:', Number(wethBalance) / 10 ** 18);
    });
  });

  describe('Token Approvals', () => {
    it('should approve USDC for contract if has balance', async () => {
      if (usdcBalance > 0n) {
        const approveTx = await blockchainService.approveToken(usdcAddress, 1000000n); // 1 USDC
        expect(approveTx).toBeDefined();
        expect(typeof approveTx).toBe('string');
        expect(approveTx.startsWith('0x')).toBe(true);
        console.log('Transacción de aprobación:', approveTx);
      } else {
        console.log('Saltando aprobación de USDC: balance insuficiente');
      }
    });
  });

  describe('Order Creation', () => {
    it('should create a limit order if has sufficient balances', async () => {
      // Solo proceder si hay balance de USDC
      if (usdcBalance > 0n) {
        // Verificar allowance antes de crear la orden
        const allowance = await blockchainService.getTokenAllowance(usdcAddress, walletAddress);
        expect(allowance).toBeGreaterThan(0n);
        
        const orderTx = await blockchainService.createOrder({
          tokenIn: usdcAddress,
          tokenOut: wethAddress,
          amountIn: 1000000n, // 1 USDC
          minAmountOut: 500000000000000000n, // 0.5 WETH
          expiryTime: BigInt(Math.floor(Date.now() / 1000) + 3600) // 1 hora
        });
        
        expect(orderTx).toBeDefined();
        expect(typeof orderTx).toBe('string');
        expect(orderTx.startsWith('0x')).toBe(true);
        console.log('Orden creada:', orderTx);
      } else {
        console.log('Saltando creación de orden: balance de USDC insuficiente');
      }
    });
  });

  describe('Order Details', () => {
    it('should get order details if exists', async () => {
      try {
        const orderDetails = await blockchainService.getOrderDetails('0');
        expect(orderDetails).toBeDefined();
        console.log('Detalles de la orden:', orderDetails);
      } catch (error) {
        console.log('No se encontraron detalles de la orden');
      }
    });
  });
}); 