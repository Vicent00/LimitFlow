import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../db.js';
import { TRPCError } from '@trpc/server';
import { createTRPCContext, createCaller } from '../../trpc.js';
import { appRouter } from '../../routers/_app.js';
import { addMinutes } from 'date-fns';
import { Prisma } from '@prisma/client';
import { signMessage } from 'viem/accounts';
import { privateKeyToAccount } from 'viem/accounts';

describe('Signature Verification Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;
  
  // Direcciones y claves de prueba
  const testPrivateKey = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80';
  const testAccount = privateKeyToAccount(testPrivateKey);
  const testAddress = testAccount.address.toLowerCase();
  const invalidAddress = '0x2222222222222222222222222222222222222222';

  beforeAll(async () => {
    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });

    // Limpiar usuarios existentes
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [testAddress, invalidAddress]
        }
      }
    });

    // Crear usuario de prueba
    await prisma.user.create({
      data: {
        address: testAddress,
        isAdmin: false,
        nonce: 'test-nonce-1',
        nonceExpiresAt: addMinutes(new Date(), 5)
      } as Prisma.UserCreateInput
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [testAddress, invalidAddress]
        }
      }
    });
  });

  describe('Signature Verification', () => {
    it('should verify a valid signature', async () => {
      const caller = createCaller(appRouter)(ctx);
      const nonce = 'test-nonce-1';
      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonce}`;
      
      // Firmar el mensaje con la clave privada de prueba
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      // Verificar la firma
      const result = await caller.auth.verifySignature({
        address: testAddress,
        signature,
        nonce
      });

      expect(result.verified).toBe(true);
      expect(result.user).toBeDefined();
      expect(result.user.address).toBe(testAddress);
      expect(result.user.nonce).not.toBe(nonce); // El nonce debería haber cambiado
    });

    it('should reject an invalid signature', async () => {
      const caller = createCaller(appRouter)(ctx);
      const nonce = 'test-nonce-1';
      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonce}`;
      
      // Firmar el mensaje con una clave privada diferente
      const invalidSignature = await signMessage({
        message,
        privateKey: '0x0000000000000000000000000000000000000000000000000000000000000001'
      });

      // Intentar verificar la firma inválida
      await expect(caller.auth.verifySignature({
        address: testAddress,
        signature: invalidSignature,
        nonce
      })).rejects.toThrow(TRPCError);
    });

    it('should reject an expired nonce', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Crear usuario con nonce expirado
      await prisma.user.update({
        where: { address: testAddress },
        data: {
          nonce: 'expired-nonce',
          nonceExpiresAt: new Date(Date.now() - 60000) // 1 minuto en el pasado
        }
      });

      const message = `Sign this message to verify your wallet ownership. Nonce: expired-nonce`;
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      // Intentar verificar con nonce expirado
      await expect(caller.auth.verifySignature({
        address: testAddress,
        signature,
        nonce: 'expired-nonce'
      })).rejects.toThrow(TRPCError);
    });

    it('should reject a non-existent user', async () => {
      const caller = createCaller(appRouter)(ctx);
      const nonce = 'test-nonce-1';
      const message = `Sign this message to verify your wallet ownership. Nonce: ${nonce}`;
      
      const signature = await signMessage({
        message,
        privateKey: testPrivateKey
      });

      // Intentar verificar con usuario inexistente
      await expect(caller.auth.verifySignature({
        address: invalidAddress,
        signature,
        nonce
      })).rejects.toMatchObject({
        code: 'NOT_FOUND',
        message: 'User not found'
      });
    });
  });
});
