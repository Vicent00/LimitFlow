import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../server/trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';

// Schemas de validación
const orderSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  amount: z.number().positive('Amount must be positive'),
  price: z.number().positive('Price must be positive'),
});

const orderIdSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

export const ordersRouter = router({
  // Procedimientos públicos
  getOrders: protectedProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
    }))
    .query(async ({ input, ctx }) => {
      try {
        const orders = await prisma.order.findMany({
          where: {
            userId: ctx.user?.address,
            ...(input.status && { status: input.status }),
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        return orders;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch orders',
          cause: error,
        });
      }
    }),

  // Procedimientos protegidos
  createOrder: protectedProcedure
    .input(orderSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const order = await prisma.order.create({
          data: {
            token: input.token,
            amount: input.amount,
            price: input.price,
            userId: ctx.user!.address,
            status: 'PENDING',
          },
        });
        return order;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to create order',
          cause: error,
        });
      }
    }),

  cancelOrder: protectedProcedure
    .input(orderIdSchema)
    .mutation(async ({ input, ctx }) => {
      try {
        const order = await prisma.order.findUnique({
          where: { id: input.orderId },
        });

        if (!order) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Order not found',
          });
        }

        if (order.userId !== ctx.user?.address) {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Not authorized to cancel this order',
          });
        }

        const updatedOrder = await prisma.order.update({
          where: { id: input.orderId },
          data: { status: 'CANCELLED' },
        });

        return updatedOrder;
      } catch (error) {
        if (error instanceof TRPCError) throw error;
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to cancel order',
          cause: error,
        });
      }
    }),

  // Procedimientos de admin
  getAllOrders: adminProcedure
    .input(z.object({
      status: z.enum(['PENDING', 'COMPLETED', 'CANCELLED']).optional(),
      userId: z.string().optional(),
    }))
    .query(async ({ input }) => {
      try {
        const orders = await prisma.order.findMany({
          where: {
            ...(input.status && { status: input.status }),
            ...(input.userId && { userId: input.userId }),
          },
          include: {
            user: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
        });
        return orders;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to fetch all orders',
          cause: error,
        });
      }
    }),

  deleteOrder: adminProcedure
    .input(orderIdSchema)
    .mutation(async ({ input }) => {
      try {
        const order = await prisma.order.delete({
          where: { id: input.orderId },
        });
        return order;
      } catch (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to delete order',
          cause: error,
        });
      }
    }),
});
