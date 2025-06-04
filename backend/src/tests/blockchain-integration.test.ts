import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { createPublicClient, http, createWalletClient, custom, formatEther } from 'viem';
import { localhost } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { prisma } from '../db.js';
import { createTRPCContext, createCaller } from '../trpc.js';
import { appRouter } from '../routers/_app.js';

// Configuración de la red local de Anvil
const anvilChain = {
  ...localhost,
  id: 31337, // ChainId por defecto de Anvil
  name: 'Anvil',
  network: 'anvil',
  nativeCurrency: {
    decimals: 18,
    name: 'Ether',
    symbol: 'ETH',
  },
  rpcUrls: {
    default: { http: ['http://127.0.0.1:8545'] },
    public: { http: ['http://127.0.0.1:8545'] },
  },
} as const;

describe('Blockchain Integration Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;
  
  // Configuración de cliente blockchain para Anvil
  const publicClient = createPublicClient({
    chain: anvilChain,
    transport: http()
  });

  // Cuentas de Anvil
  const accounts = {
    user1: {
      privateKey: '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80' as `0x${string}`,
      address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266' as `0x${string}`
    },
    user2: {
      privateKey: '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d' as `0x${string}`,
      address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8' as `0x${string}`
    },
    admin: {
      privateKey: '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a' as `0x${string}`,
      address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC' as `0x${string}`
    }
  };

  const user1Account = privateKeyToAccount(accounts.user1.privateKey);
  const user2Account = privateKeyToAccount(accounts.user2.privateKey);
  const adminAccount = privateKeyToAccount(accounts.admin.privateKey);

  beforeAll(async () => {
    // Verificar que Anvil está corriendo
    try {
      await publicClient.getBlockNumber();
      console.log('Anvil está corriendo correctamente');
    } catch (error) {
      throw new Error('Anvil no está corriendo. Por favor, inicia Anvil con: anvil');
    }

    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });

    // Limpiar usuarios existentes
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [
            accounts.user1.address.toLowerCase(),
            accounts.user2.address.toLowerCase(),
            accounts.admin.address.toLowerCase()
          ]
        }
      }
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [
            accounts.user1.address.toLowerCase(),
            accounts.user2.address.toLowerCase(),
            accounts.admin.address.toLowerCase()
          ]
        }
      }
    });
  });

  describe('Local Blockchain Interactions', () => {
    it('should verify initial balances of all accounts', async () => {
      const user1Balance = await publicClient.getBalance({
        address: accounts.user1.address
      });
      const user2Balance = await publicClient.getBalance({
        address: accounts.user2.address
      });
      const adminBalance = await publicClient.getBalance({
        address: accounts.admin.address
      });

      console.log('Balances iniciales:');
      console.log(`User1: ${user1Balance} wei in ETH (${formatEther(user1Balance)})`);
      console.log(`User2: ${user2Balance} wei in ETH (${formatEther(user2Balance)})`);
      console.log(`Admin: ${adminBalance} wei in ETH (${formatEther(adminBalance)})`);

      expect(user1Balance).toBeGreaterThan(0n);
      expect(user2Balance).toBeGreaterThan(0n);
      expect(adminBalance).toBeGreaterThan(0n);
    });

    it('should handle user registration and authentication', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Registrar usuario normal
      const user1 = await caller.auth.register({
        address: accounts.user1.address.toLowerCase(),
        isAdmin: false
      });

      // Registrar admin
      const admin = await caller.auth.register({
        address: accounts.admin.address.toLowerCase(),
        isAdmin: true
      });

      expect(user1.isAdmin).toBe(false);
      expect(admin.isAdmin).toBe(true);
    });

    it('should handle message signing and verification for multiple users', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Proceso para User1
      const nonce1 = await caller.auth.getNonce({
        address: accounts.user1.address.toLowerCase()
      });

      const message1 = `Sign this message to verify your wallet ownership. Nonce: ${nonce1.nonce}`;
      const signature1 = await user1Account.signMessage({ message: message1 });

      const verification1 = await caller.auth.verifySignature({
        address: accounts.user1.address.toLowerCase(),
        signature: signature1,
        nonce: nonce1.nonce
      });

      expect(verification1.verified).toBe(true);

      // Proceso para Admin
      const nonce2 = await caller.auth.getNonce({
        address: accounts.admin.address.toLowerCase()
      });

      const message2 = `Sign this message to verify your wallet ownership. Nonce: ${nonce2.nonce}`;
      const signature2 = await adminAccount.signMessage({ message: message2 });

      const verification2 = await caller.auth.verifySignature({
        address: accounts.admin.address.toLowerCase(),
        signature: signature2,
        nonce: nonce2.nonce
      });

      expect(verification2.verified).toBe(true);
      expect(verification2.user.isAdmin).toBe(true);
    });

    it('should handle transaction between accounts', async () => {
      const walletClient = createWalletClient({
        chain: anvilChain,
        transport: http()
      });

      // Transferir ETH de User1 a User2
      const hash = await walletClient.sendTransaction({
        account: user1Account,
        to: accounts.user2.address,
        value: 1000000000000000000n // 1 ETH
      });

      // Esperar a que la transacción se confirme
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).toBe('success');

      // Verificar balances después de la transferencia
      const user1Balance = await publicClient.getBalance({
        address: accounts.user1.address
      });
      const user2Balance = await publicClient.getBalance({
        address: accounts.user2.address
      });

      console.log('Balances después de la transferencia:');
      console.log(`User1: ${user1Balance} wei in ETH (${formatEther(user1Balance)})`);
      console.log(`User2: ${user2Balance} wei in ETH (${formatEther(user2Balance)})`);
    });

    it('should handle gas estimation for different operations', async () => {
      // Estimar gas para transferencia simple
      const transferGas = await publicClient.estimateGas({
        account: accounts.user1.address,
        to: accounts.user2.address,
        value: 1000000000000000000n
      });

      console.log(`Gas estimado para transferencia: ${transferGas} in ETH (${formatEther(transferGas)})`);

      // Estimar gas para una transacción más compleja
      const complexGas = await publicClient.estimateGas({
        account: accounts.user1.address,
        to: accounts.user2.address,
        value: 0n,
        data: '0x' as `0x${string}`
      });

      console.log(`Gas estimado para transacción compleja: ${complexGas} in ETH (${formatEther(complexGas)})`);
    });
  });
}); 