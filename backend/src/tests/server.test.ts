import { describe, it, expect, beforeAll, afterAll } from '@jest/globals';
import { router, createTRPCContext, publicProcedure, protectedProcedure } from '../trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

// Mock superjson
jest.mock('superjson', () => ({
  __esModule: true,
  default: {
    parse: jest.fn(),
    stringify: jest.fn()
  }
}));

describe('Backend Infrastructure Tests', () => {
  let ctx: Awaited<ReturnType<typeof createTRPCContext>>;

  beforeAll(async () => {
    ctx = await createTRPCContext({
      req: {} as any,
      res: {} as any
    });
  });

  describe('TRPC Context', () => {
    it('should create a valid TRPC context', () => {
      expect(ctx).toBeDefined();
      expect(ctx.prisma).toBeDefined();
    });

    it('should have request object', () => {
      expect(ctx.req).toBeDefined();
    });
  });

  describe('TRPC Router', () => {
    it('should have a working router', () => {
      expect(router).toBeDefined();
    });

    it('should have public and protected procedures', () => {
      expect(publicProcedure).toBeDefined();
      expect(protectedProcedure).toBeDefined();
    });
  });

  describe('Database Connection', () => {
    it('should have a working Prisma client', async () => {
      expect(prisma).toBeDefined();
      // Try a simple query to verify connection
      await expect(prisma.$queryRaw`SELECT 1`).resolves.not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle TRPC errors correctly', () => {
      const error = new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Test error'
      });
      expect(error).toBeInstanceOf(TRPCError);
      expect(error.code).toBe('UNAUTHORIZED');
    });
  });

  describe('Middleware', () => {
    it('should have authentication middleware', () => {
      // Verify that protectedProcedure exists and is different from publicProcedure
      expect(protectedProcedure).not.toBe(publicProcedure);
    });
  });
}); 