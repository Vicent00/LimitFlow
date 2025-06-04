import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { prisma } from '../../db.js';
import { TRPCError } from '@trpc/server';
import { createTRPCContext, createCaller } from '../../trpc.js';
import { appRouter } from '../../routers/_app.js';

describe('User Registration Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;
  const testAddress = '0x1234567890123456789012345678901234567890';
  const validAddress = '0x2222222222222222222222222222222222222222';
  const newUserAddress = '0x3333333333333333333333333333333333333333';
  const duplicateAddress = '0x4444444444444444444444444444444444444444';
  const adminAddress = '0x5555555555555555555555555555555555555555';

  beforeAll(async () => {
    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });
  });

  afterAll(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: {
        address: {
          in: [testAddress, validAddress, newUserAddress, duplicateAddress, adminAddress]
        }
      }
    });
  });

  describe('Wallet Address Validation', () => {
    it('should reject invalid wallet address format', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Test invalid address format (too short)
      await expect(caller.auth.register({
        address: '0x123',
        isAdmin: false
      })).rejects.toThrow(TRPCError);

      // Test invalid address format (too long)
      await expect(caller.auth.register({
        address: '0x1234567890123456789012345678901234567890123',
        isAdmin: false
      })).rejects.toThrow(TRPCError);

      // Test invalid address format (wrong prefix)
      await expect(caller.auth.register({
        address: '1234567890123456789012345678901234567890',
        isAdmin: false
      })).rejects.toThrow(TRPCError);

      // Test invalid address format (invalid characters)
      await expect(caller.auth.register({
        address: '0x123456789012345678901234567890123456789g',
        isAdmin: false
      })).rejects.toThrow(TRPCError);

      // Test invalid address format (uppercase letters)
      await expect(caller.auth.register({
        address: '0x123456789012345678901234567890123456789A',
        isAdmin: false
      })).rejects.toThrow(TRPCError);
    });

    it('should accept valid wallet address format', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      const result = await caller.auth.register({
        address: validAddress,
        isAdmin: false
      });

      expect(result.address).toBe(validAddress);
      expect(result.address.length).toBe(42); // 0x + 40 hex characters
      expect(result.isAdmin).toBe(false);
    });
  });

  describe('User Registration Process', () => {
    it('should successfully register a new user', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // Verify user doesn't exist before registration
      const existingUser = await prisma.user.findUnique({
        where: { address: newUserAddress }
      });
      expect(existingUser).toBeNull();
      
      const result = await caller.auth.register({
        address: newUserAddress,
        isAdmin: false
      });

      expect(result).toBeDefined();
      expect(result.address).toBe(newUserAddress);
      expect(result.isAdmin).toBe(false);
      expect(result.id).toBeDefined();
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });

    it('should prevent duplicate address registration', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      // First registration
      await caller.auth.register({
        address: duplicateAddress,
        isAdmin: false
      });

      // Verify first registration was successful
      const firstUser = await prisma.user.findUnique({
        where: { address: duplicateAddress }
      });
      expect(firstUser).not.toBeNull();

      // Attempt duplicate registration
      await expect(caller.auth.register({
        address: duplicateAddress,
        isAdmin: false
      })).rejects.toThrow(TRPCError);

      // Verify no duplicate was created
      const users = await prisma.user.findMany({
        where: { address: duplicateAddress }
      });
      expect(users.length).toBe(1);
    });

    it('should create admin user when specified', async () => {
      const caller = createCaller(appRouter)(ctx);
      
      const result = await caller.auth.register({
        address: adminAddress,
        isAdmin: true
      });

      expect(result.isAdmin).toBe(true);
      
      // Verify admin status in database
      const adminUser = await prisma.user.findUnique({
        where: { address: adminAddress }
      });
      expect(adminUser?.isAdmin).toBe(true);
    });
  });
}); 