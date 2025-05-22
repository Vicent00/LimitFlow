import { z } from 'zod';
import { router, publicProcedure, adminProcedure } from '../server/trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

// Schemas de validación
const priceSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  price: z.number().positive('Price must be positive'),
});

export const pricesRouter = router({
  // Procedimientos públicos
  getPrice: publicProcedure
    .input(z.object({
      token: z.string().min(1, 'Token is required'),
    }))
    .query(async ({ input }) => {
      try {
        const price = await prisma.price.findUnique({
          where: { token: input.token },
        });

        if (!price) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: `Price for token ${input.token} not found`,
          });
        }

        return price;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch price',
          cause: error,
        });
      }
    }),

  getAllPrices: publicProcedure
    .query(async () => {
      try {
        return await prisma.price.findMany({
          orderBy: {
            token: 'asc',
          },
        });
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch prices',
          cause: error,
        });
      }
    }),

  // Procedimientos de admin
  updatePrice: adminProcedure
    .input(priceSchema)
    .mutation(async ({ input }) => {
      try {
        const price = await prisma.price.upsert({
          where: { token: input.token },
          update: { price: input.price },
          create: {
            token: input.token,
            price: input.price,
          },
        });
        return price;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to update price',
          cause: error,
        });
      }
    }),

  deletePrice: adminProcedure
    .input(z.object({
      token: z.string().min(1, 'Token is required'),
    }))
    .mutation(async ({ input }) => {
      try {
        const price = await prisma.price.delete({
          where: { token: input.token },
        });
        return price;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete price',
          cause: error,
        });
      }
    }),
});
