import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../db.js';
import { TRPCError } from '@trpc/server';
import { createTRPCContext, createCaller } from '../trpc.js';
import { appRouter } from '../routers/_app.js';
import { addMinutes } from 'date-fns';
import { Prisma } from '@prisma/client';
import { signMessage } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';

describe('Complete Authentication Flow Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;
  
  // Direcciones y claves de prueba
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const testAccount = privateKeyToAccount(testPrivateKey);
  const testAddress = testAccount.address.toLowerCase();
  const newUserAddress = testAddress; // Usar la misma dirección que la cuenta de prueba
  const adminPrivateKey = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'; // Nueva clave privada para admin
  const adminAccount = privateKeyToAccount(adminPrivateKey);
  const adminAddress = adminAccount.address.toLowerCase();

  beforeAll(async () => {
    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });

    // Limpiar usuarios existentes
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [testAddress, newUserAddress, adminAddress]
        }
      }
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [testAddress, newUserAddress, adminAddress]
        }
      }
    });
  });

  describe('Complete User Authentication Flow', () => {
    it('should handle complete user registration and authentication flow', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // 1. Registrar nuevo usuario
      const registeredUser = await caller.auth.register({
        address: newUserAddress,
        isAdmin: false
      });

      expect(registeredUser).toBeDefined();
      expect(registeredUser.address.toLowerCase()).toBe(newUserAddress);
      expect(registeredUser.isAdmin).toBe(false);
      expect(registeredUser.nonce).toBeDefined();
      expect(registeredUser.nonceExpiresAt > new Date()).toBe(true);
      const initialNonce = registeredUser.nonce;

      // 2. Obtener nonce para firma
      const nonceResult = await caller.auth.getNonce({
        address: newUserAddress
      });

      expect(nonceResult.nonce).toBeDefined();

      // 3. Firmar mensaje con el nonce
      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonceResult.nonce}`;
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      // 4. Verificar firma
      const verificationResult = await caller.auth.verifySignature({
        address: newUserAddress,
        signature,
        nonce: nonceResult.nonce
      });

      expect(verificationResult.verified).toBe(true);
      expect(verificationResult.user).toBeDefined();
      expect(verificationResult.user.address.toLowerCase()).toBe(newUserAddress);

      // 5. Login después de verificación exitosa
      const loginResult = await caller.auth.login({
        address: newUserAddress
      });

      expect(loginResult.user).toBeDefined();
      expect(loginResult.user.address.toLowerCase()).toBe(newUserAddress);

      // 6. Verificar en la base de datos
      const dbUser = await prisma.user.findUnique({
        where: { address: newUserAddress }
      });

      expect(dbUser).toBeDefined();
      expect(dbUser?.address.toLowerCase()).toBe(newUserAddress);
      expect(dbUser?.nonce).toBeDefined();
      expect(dbUser?.nonceExpiresAt).toBeDefined();
      expect(dbUser?.nonceExpiresAt! > new Date()).toBe(true);
    });

    it('should handle admin user registration and authentication', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // 1. Registrar usuario admin
      const adminUser = await caller.auth.register({
        address: adminAddress,
        isAdmin: true
      });

      expect(adminUser).toBeDefined();
      expect(adminUser.address.toLowerCase()).toBe(adminAddress);
      expect(adminUser.isAdmin).toBe(true);

      // 2. Obtener nonce y verificar firma
      const nonceResult = await caller.auth.getNonce({
        address: adminAddress
      });

      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonceResult.nonce}`;
      const signature = await signMessage({
        message,
        privateKey: adminPrivateKey // Usar la clave privada del admin
      });

      const verificationResult = await caller.auth.verifySignature({
        address: adminAddress,
        signature,
        nonce: nonceResult.nonce
      });

      expect(verificationResult.verified).toBe(true);
      expect(verificationResult.user.isAdmin).toBe(true);
    });

    it('should handle concurrent authentication attempts', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // 1. Obtener nonce
      const nonceResult = await caller.auth.getNonce({
        address: newUserAddress
      });

      // 2. Firmar mensaje
      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonceResult.nonce}`;
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      // 3. Primera verificación (debería funcionar)
      const firstVerification = await caller.auth.verifySignature({
        address: newUserAddress,
        signature,
        nonce: nonceResult.nonce
      });

      expect(firstVerification.verified).toBe(true);

      // 4. Segunda verificación con el mismo nonce (debería fallar)
      await expect(caller.auth.verifySignature({
        address: newUserAddress,
        signature,
        nonce: nonceResult.nonce
      })).rejects.toThrow(TRPCError);

      // 5. Verificar que el nonce ha cambiado
      const updatedUser = await prisma.user.findUnique({
        where: { address: newUserAddress }
      });

      expect(updatedUser?.nonce).toBeDefined();
    });

    it('should handle nonce expiration and renewal', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // 1. Crear usuario con nonce expirado
      await prisma.user.update({
        where: { address: newUserAddress },
        data: {
          nonce: 'expired-nonce',
          nonceExpiresAt: new Date(Date.now() - 60000) // 1 minuto en el pasado
        }
      });

      // 2. Intentar verificar con nonce expirado
      const message = `Sign this message to verify your wallet ownership. Nonce: expired-nonce`;
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      await expect(caller.auth.verifySignature({
        address: newUserAddress,
        signature,
        nonce: 'expired-nonce'
      })).rejects.toThrow(TRPCError);

      // 3. Obtener nuevo nonce
      const newNonceResult = await caller.auth.getNonce({
        address: newUserAddress
      });

      expect(newNonceResult.nonce).toBeDefined();

      // 4. Verificar con nuevo nonce
      const newMessage = `Sign this message to verify your wallet ownership. Nonce: ${newNonceResult.nonce}`;
      const newSignature = await signMessage({
        message: newMessage,
        privateKey: testPrivateKey
      });

      const verificationResult = await caller.auth.verifySignature({
        address: newUserAddress,
        signature: newSignature,
        nonce: newNonceResult.nonce
      });

      expect(verificationResult.verified).toBe(true);
    });
  });
});
