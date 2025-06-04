import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../db.js';
import { TRPCError } from '@trpc/server';
import { createTRPCContext, createCaller } from '../../trpc.js';
import { appRouter } from '../../routers/_app.js';
import { addMinutes, subMinutes } from 'date-fns';
import { Prisma, User } from '@prisma/client';

describe('User Login Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;
  
  // Direcciones de prueba más distintivas
  const testAddress = '0x1111111111111111111111111111111111111111';  // Usuario normal
  const adminAddress = '0x2222222222222222222222222222222222222222';  // Usuario admin
  const nonExistentAddress = '0x3333333333333333333333333333333333333333';  // Usuario no existente
  const invalidShortAddress = '0x4444444444444444444444444444444444444444';  // Para test de dirección corta
  const invalidLongAddress = '0x5555555555555555555555555555555555555555';  // Para test de dirección larga
  const newUserAddress = '0x6666666666666666666666666666666666666666';  // Para test de registro + login

  beforeAll(async () => {
    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });

    // Limpiar usuarios existentes antes de crear los nuevos
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [
            testAddress,
            adminAddress,
            nonExistentAddress,
            invalidShortAddress,
            invalidLongAddress,
            newUserAddress
          ]
        }
      }
    });

    // Crear usuarios de prueba con nonce expirado
    await prisma.user.create({
      data: {
        address: testAddress,
        isAdmin: false,
        nonce: 'test-nonce-1',
        nonceExpiresAt: subMinutes(new Date(), 1) // Nonce expirado
      } as Prisma.UserCreateInput
    });

    await prisma.user.create({
      data: {
        address: adminAddress,
        isAdmin: true,
        nonce: 'test-nonce-2',
        nonceExpiresAt: addMinutes(new Date(), 5) // Nonce válido
      } as Prisma.UserCreateInput
    });
  });

  afterAll(async () => {
    // Limpiar datos de prueba
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [
            testAddress,
            adminAddress,
            nonExistentAddress,
            invalidShortAddress,
            invalidLongAddress,
            newUserAddress
          ]
        }
      }
    });
  });

  describe('Complete Registration and Login Flow', () => {
    it('should handle complete registration -> login flow', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // 1. Verificar que el usuario no existe
      const existingUser = await prisma.user.findUnique({
        where: { address: newUserAddress }
      });
      expect(existingUser).toBeNull();

      // 2. Registrar nuevo usuario
      const registeredUser = await caller.auth.register({
        address: newUserAddress,
        isAdmin: false
      });

      // 3. Verificar registro exitoso
      expect(registeredUser).toBeDefined();
      expect(registeredUser.address).toBe(newUserAddress);
      expect(registeredUser.isAdmin).toBe(false);
      expect(registeredUser.nonce).toBeDefined();
      expect(registeredUser.nonceExpiresAt).toBeDefined();
      expect(registeredUser.nonceExpiresAt > new Date()).toBe(true);
      const initialNonce = registeredUser.nonce;

      // 4. Intentar login inmediatamente después del registro
      const loginResult = await caller.auth.login({
        address: newUserAddress
      });

      // 5. Verificar login exitoso
      expect(loginResult.user).toBeDefined();
      expect(loginResult.user.address).toBe(newUserAddress);
      expect(loginResult.user.isAdmin).toBe(false);
      expect(loginResult.user.nonce).toBeDefined();
      expect(loginResult.user.nonceExpiresAt).toBeDefined();
      expect(loginResult.user.nonceExpiresAt > new Date()).toBe(true);
      expect(loginResult.user.nonce).not.toBe(initialNonce);

      // 6. Verificar en la base de datos
      const dbUser = await prisma.user.findUnique({
        where: { address: newUserAddress }
      }) as User | null;
      expect(dbUser).toBeDefined();
      expect(dbUser?.address).toBe(newUserAddress);
      expect(dbUser?.nonce).toBe(loginResult.user.nonce);
      expect(dbUser && (dbUser as any).nonceExpiresAt).toBeDefined();
      expect(dbUser && (dbUser as any).nonceExpiresAt > new Date()).toBe(true);
    });

    it('should prevent duplicate registration and handle login', async () => {
      const caller = createCaller(appRouter)(ctx);
      const duplicateAddress = '0x7777777777777777777777777777777777777777';

      // 1. Primer registro
      const firstRegistration = await caller.auth.register({
        address: duplicateAddress,
        isAdmin: false
      });
      expect(firstRegistration.address).toBe(duplicateAddress);
      expect(firstRegistration.nonceExpiresAt > new Date()).toBe(true);

      // 2. Intentar registro duplicado
      await expect(caller.auth.register({
        address: duplicateAddress,
        isAdmin: false
      })).rejects.toMatchObject({
        code: 'CONFLICT',
        message: 'User already exists'
      });

      // 3. Login con el usuario registrado
      const loginResult = await caller.auth.login({
        address: duplicateAddress
      });

      // 4. Verificar login exitoso
      expect(loginResult.user).toBeDefined();
      expect(loginResult.user.address).toBe(duplicateAddress);
      expect(loginResult.user.nonce).not.toBe(firstRegistration.nonce);
      expect(loginResult.user.nonceExpiresAt > new Date()).toBe(true);
    });
  });

  describe('Login Process', () => {
    it('should successfully login a normal user', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      const result = await caller.auth.login({
        address: testAddress
      });

      expect(result.user).toBeDefined();
      expect(result.user.address).toBe(testAddress);
      expect(result.user.isAdmin).toBe(false);
      expect(result.user.nonce).toBeDefined();
      expect(result.user.nonceExpiresAt).toBeDefined();
      expect(result.user.nonceExpiresAt > new Date()).toBe(true);
      expect(result.user.nonce).not.toBe('test-nonce-1');
    });

    it('should successfully login an admin user', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      const result = await caller.auth.login({
        address: adminAddress
      });

      expect(result.user).toBeDefined();
      expect(result.user.address).toBe(adminAddress);
      expect(result.user.isAdmin).toBe(true);
      expect(result.user.nonce).toBeDefined();
      expect(result.user.nonceExpiresAt).toBeDefined();
      expect(result.user.nonceExpiresAt > new Date()).toBe(true);
      expect(result.user.nonce).not.toBe('test-nonce-2');
    });

    it('should reject login for non-existent user', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      await expect(caller.auth.login({
        address: nonExistentAddress
      })).rejects.toThrow(TRPCError);
    });

    it('should generate a new nonce after successful login', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Primer login
      const firstLogin = await caller.auth.login({
        address: testAddress
      });
      const firstNonce = firstLogin.user.nonce;
      const firstExpiration = firstLogin.user.nonceExpiresAt;

      // Segundo login
      const secondLogin = await caller.auth.login({
        address: testAddress
      });
      const secondNonce = secondLogin.user.nonce;
      const secondExpiration = secondLogin.user.nonceExpiresAt;

      expect(firstNonce).not.toBe(secondNonce);
      expect(firstExpiration).not.toBe(secondExpiration);
      expect(secondExpiration > new Date()).toBe(true);
    });
  });

  describe('Nonce Expiration', () => {
    it('should generate new nonce when current one is expired', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // El usuario test tiene un nonce expirado
      const result = await caller.auth.getNonce({
        address: testAddress
      });

      expect(result.nonce).toBeDefined();
      expect(result.nonce).not.toBe('test-nonce-1');

      // Verificar en la base de datos
      const dbUser = await prisma.user.findUnique({
        where: { address: testAddress }
      }) as User | null;
      expect(dbUser?.nonce).toBe(result.nonce);
      expect(dbUser && (dbUser as any).nonceExpiresAt).toBeDefined();
      expect(dbUser && (dbUser as any).nonceExpiresAt > new Date()).toBe(true);
    });

    it('should keep nonce when it is still valid', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // El usuario admin tiene un nonce válido
      const userBefore = await prisma.user.findUnique({ where: { address: adminAddress } }) as any;
      const result = await caller.auth.getNonce({
        address: adminAddress
      });
      expect(result.nonce).toBe(userBefore.nonce);
    });
  });

  describe('Input Validation', () => {
    it('should reject invalid wallet address format', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Test dirección inválida (muy corta)
      await expect(caller.auth.login({
        address: '0x123'
      })).rejects.toThrow(TRPCError);

      // Test dirección inválida (muy larga)
      await expect(caller.auth.login({
        address: '0x1234567890123456789012345678901234567890123'
      })).rejects.toThrow(TRPCError);

      // Test dirección inválida (prefijo incorrecto)
      await expect(caller.auth.login({
        address: '1234567890123456789012345678901234567890'
      })).rejects.toThrow(TRPCError);

      // Test dirección inválida (caracteres inválidos)
      await expect(caller.auth.login({
        address: '0x123456789012345678901234567890123456789g'
      })).rejects.toThrow(TRPCError);
    });
  });
});
