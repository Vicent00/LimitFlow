import { z } from 'zod';
import { router, protectedProcedure, adminProcedure } from '../server/trpc';
import { prisma } from '../db';
import { TRPCError } from '@trpc/server';
import { OrderType, OrderStatus } from '@prisma/client';
import { orderEventService, OrderEventType } from '../services/orderEvents';
import { orderValidationService } from '../services/orderValidation';
import { monitoringService } from '../services/monitoring';
import { orderService } from '../services/orderService';

// Schemas de validación
const orderInputSchema = z.object({
  tokenIn: z.string().length(42).regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  tokenOut: z.string().length(42).regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address'),
  amountIn: z.bigint().positive('Amount must be positive'),
  amountOut: z.bigint().positive('Amount must be positive'),
  price: z.number().positive('Price must be positive'),
  type: z.nativeEnum(OrderType),
  expiresAt: z.date().optional(),
});

const orderIdSchema = z.object({
  orderId: z.string().min(1, 'Order ID is required'),
});

const orderUpdateSchema = z.object({
  price: z.number().positive('Price must be positive').optional(),
  amountIn: z.bigint().positive('Amount must be positive').optional(),
  amountOut: z.bigint().positive('Amount must be positive').optional(),
});

export const ordersRouter = router({
  // Procedimientos públicos
  getOrders: protectedProcedure
    .input(z.object({
      status: z.nativeEnum(OrderStatus).optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const orders = await orderService.getOrders({
          userAddress: ctx.user.address,
          ...input,
        });

        monitoringService.trackOperationTime('getOrders', Date.now() - startTime);
        return orders;
      } catch (error) {
        monitoringService.trackOrderError({
          tokenIn: '',
          tokenOut: '',
          amountIn: BigInt(0),
          price: Number(0),
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          userId: ctx.user.address
        }, error as Error);
        throw error;
      }
    }),

  // Procedimientos protegidos
  createOrder: protectedProcedure
    .input(orderInputSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        // Validar la orden
        await orderValidationService.validateOrder(input);

        // Crear la orden
        const order = await orderService.createOrder({
          ...input,
          userAddress: ctx.user.address,
        });

        monitoringService.trackOperationTime('createOrder', Date.now() - startTime);
        return order;
      } catch (error) {
        monitoringService.trackOrderError({
          tokenIn: input.tokenIn,
          tokenOut: input.tokenOut,
          amountIn: input.amountIn,
          price: Number(input.price),
          type: input.type,
          status: OrderStatus.PENDING,
          userId: ctx.user.address
        }, error as Error);
        throw error;
      }
    }),

  cancelOrder: protectedProcedure
    .input(orderIdSchema)
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const order = await orderService.cancelOrder(input.orderId, ctx.user.address);
        monitoringService.trackOperationTime('cancelOrder', Date.now() - startTime);
        return order;
      } catch (error) {
        monitoringService.trackOrderError({
          id: input.orderId,
          tokenIn: '',
          tokenOut: '',
          amountIn: BigInt(0),
          price: Number(0),
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          userId: ctx.user.address
        }, error as Error);
        throw error;
      }
    }),

  // Procedimientos de admin
  getAllOrders: adminProcedure
    .input(z.object({
      status: z.nativeEnum(OrderStatus).optional(),
      userAddress: z.string().optional(),
      limit: z.number().min(1).max(100).optional(),
      offset: z.number().min(0).optional(),
    }))
    .query(async ({ input }) => {
      try {
        const orders = await prisma.order.findMany({
          where: {
            ...(input.status && { status: input.status }),
            ...(input.userAddress && { userAddress: input.userAddress }),
          },
          include: {
            user: true,
            fills: true,
          },
          orderBy: {
            createdAt: 'desc',
          },
          take: input.limit ?? 10,
          skip: input.offset ?? 0,
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

  getOrderById: protectedProcedure
    .input(orderIdSchema)
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const order = await orderService.getOrderById(input.orderId, ctx.user.address);
        monitoringService.trackOperationTime('getOrderById', Date.now() - startTime);
        return order;
      } catch (error) {
        monitoringService.trackOrderError({
          id: input.orderId,
          tokenIn: '',
          tokenOut: '',
          amountIn: BigInt(0),
          price: Number(0),
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          userId: ctx.user.address
        }, error as Error);
        throw error;
      }
    }),

  updateOrder: protectedProcedure
    .input(z.object({
      orderId: z.string(),
      updates: orderUpdateSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        // Validar la actualización
        await orderValidationService.validateOrderUpdate(input.orderId, input.updates);

        // Actualizar la orden
        const order = await orderService.updateOrder(
          input.orderId,
          ctx.user.address,
          input.updates
        );

        monitoringService.trackOperationTime('updateOrder', Date.now() - startTime);
        return order;
      } catch (error) {
        monitoringService.trackOrderError({
          id: input.orderId,
          tokenIn: '',
          tokenOut: '',
          amountIn: BigInt(0),
          price: Number(0),
          type: OrderType.BUY,
          status: OrderStatus.PENDING,
          userId: ctx.user.address
        }, error as Error);
        throw error;
      }
    }),
});
