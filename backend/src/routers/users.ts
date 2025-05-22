import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../server/trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

// Schemas de validación
const addressSchema = z.string().regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid Ethereum address');

export const usersRouter = router({
  // Procedimientos protegidos
  getProfile: protectedProcedure
    .query(async ({ ctx }) => {
      try {
        const user = await prisma.user.findUnique({
          where: { address: ctx.user?.address },
          include: {
            orders: {
              orderBy: {
                createdAt: 'desc',
              },
            },
          },
        });

        if (!user) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'User not found',
          });
        }

        return user;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch user profile',
          cause: error,
        });
      }
    }),

  // Procedimientos de admin
  getAllUsers: adminProcedure
    .input(z.object({
      isAdmin: z.boolean().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const users = await prisma.user.findMany({
          where: {
            ...(input.isAdmin !== undefined && { isAdmin: input.isAdmin }),
          },
          include: {
            orders: true,
          },
        });
        return users;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch users',
          cause: error,
        });
      }
    }),

  updateUser: adminProcedure
    .input(z.object({
      address: addressSchema,
      isAdmin: z.boolean(),
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await prisma.user.update({
          where: { address: input.address.toLowerCase() },
          data: { isAdmin: input.isAdmin },
        });
        return user;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update user',
          cause: error,
        });
      }
    }),

  deleteUser: adminProcedure
    .input(z.object({
      address: addressSchema,
    }))
    .mutation(async ({ input }) => {
      try {
        const user = await prisma.user.delete({
          where: { address: input.address.toLowerCase() },
        });
        return user;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete user',
          cause: error,
        });
      }
    }),
});
