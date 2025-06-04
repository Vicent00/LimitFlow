import { prisma } from '../db';
import { PriceOracle } from './priceOracle';
import { matchingService } from './matchingService';
import { blockchainService } from './blockchainService';
import { monitoringService } from './monitoring';
import { orderEventService, OrderEventType } from './orderEvents';
import { Order, OrderStatus, OrderType, Prisma } from '@prisma/client';
import { TRPCError } from '@trpc/server';

export class OrderService {
  private static instance: OrderService;
  private priceOracle: PriceOracle;

  private constructor() {
    this.priceOracle = new PriceOracle();
  }

  public static getInstance(): OrderService {
    if (!OrderService.instance) {
      OrderService.instance = new OrderService();
    }
    return OrderService.instance;
  }

  async createOrder(data: {
    userAddress: string;
    type: OrderType;
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOut: bigint;
    price: number;
    expiresAt?: Date;
  }) {
    const startTime = Date.now();
    try {
      // Validar precio contra oráculo
      const isValidPrice = await this.priceOracle.validateOrderPrice(
        BigInt(Math.floor(data.price * 1e18)), // Convertir a wei
        data.tokenIn,
        data.tokenOut
      );

      if (!isValidPrice) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Order price deviates too much from oracle price'
        });
      }

      // Verificar que el usuario tenga suficiente balance
      const balance = await blockchainService.getTokenBalance(data.userAddress, data.tokenIn);
      if (balance < data.amountIn) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Insufficient balance'
        });
      }

      // Obtener el usuario por su dirección
      const user = await prisma.user.findUnique({
        where: { address: data.userAddress.toLowerCase() }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      // Crear la orden usando Prisma.OrderCreateInput
      const orderData = {
        user: { connect: { id: user.id } },
        type: data.type,
        tokenIn: data.tokenIn.toLowerCase(),
        tokenOut: data.tokenOut.toLowerCase(),
        amountIn: data.amountIn,
        amountOut: data.amountOut,
        price: data.price,
        status: OrderStatus.PENDING,
        expiresAt: data.expiresAt
      } as const;

      const order = await prisma.order.create({
        data: orderData,
        include: {
          user: true,
          fills: true
        }
      });

      // Emitir evento de creación
      await orderEventService.emitOrderEvent({
        type: OrderEventType.ORDER_CREATED,
        order,
        timestamp: new Date()
      });

      // Intentar hacer matching con órdenes existentes
      await matchingService.matchOrders(order);

      monitoringService.trackOperationTime('createOrder', Date.now() - startTime);

      return order;
    } catch (error) {
      console.error('Error creating order:', error);
      if (error instanceof TRPCError) throw error;
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to create order',
        cause: error
      });
    }
  }

  async getOrders(params: {
    userAddress: string;
    status?: OrderStatus;
    limit?: number;
    offset?: number;
  }) {
    const startTime = Date.now();
    try {
      const user = await prisma.user.findUnique({
        where: { address: params.userAddress.toLowerCase() }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const orders = await prisma.order.findMany({
        where: {
          userId: user.id,
          ...(params.status && { status: params.status }),
        },
        include: {
          user: true,
          fills: true,
        },
        orderBy: {
          createdAt: 'desc',
        },
        take: params.limit ?? 10,
        skip: params.offset ?? 0,
      });

      monitoringService.trackOperationTime('getOrders', Date.now() - startTime);
      return orders;
    } catch (error) {
      monitoringService.trackOrderError({ 
        userId: params.userAddress,
        status: params.status 
      }, error as Error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to get orders',
        cause: error,
      });
    }
  }

  async getOrderById(orderId: string, userAddress: string): Promise<Order> {
    const startTime = Date.now();
    try {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
        },
        include: {
          user: true,
          fills: true,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      monitoringService.trackOperationTime('getOrderById', Date.now() - startTime);
      return order;
    } catch (error) {
      monitoringService.trackOrderError({ 
        id: orderId,
        userId: userAddress 
      }, error as Error);
      throw error;
    }
  }

  async updateOrder(
    orderId: string,
    userAddress: string,
    updates: {
      price?: number;
      amountIn?: bigint;
      amountOut?: bigint;
    }
  ): Promise<Order> {
    const startTime = Date.now();
    try {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only update pending orders',
        });
      }

      const updateData: Prisma.OrderUpdateInput = {
        ...(updates.price && { price: updates.price }),
        ...(updates.amountIn && { amountIn: updates.amountIn }),
        ...(updates.amountOut && { amountOut: updates.amountOut }),
      };

      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: updateData,
        include: {
          user: true,
          fills: true
        }
      });

      await orderEventService.emitOrderEvent({
        type: OrderEventType.ORDER_UPDATED,
        order: updatedOrder,
        timestamp: new Date(),
      });

      monitoringService.trackOperationTime('updateOrder', Date.now() - startTime);
      return updatedOrder;
    } catch (error) {
      monitoringService.trackOrderError({ 
        id: orderId,
        userId: userAddress 
      }, error as Error);
      throw error;
    }
  }

  async cancelOrder(orderId: string, userAddress: string): Promise<Order> {
    const startTime = Date.now();
    try {
      const user = await prisma.user.findUnique({
        where: { address: userAddress.toLowerCase() }
      });

      if (!user) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'User not found'
        });
      }

      const order = await prisma.order.findFirst({
        where: {
          id: orderId,
          userId: user.id,
        },
      });

      if (!order) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Order not found',
        });
      }

      if (order.status !== OrderStatus.PENDING) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Can only cancel pending orders',
        });
      }

      const cancelledOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
        include: {
          user: true,
          fills: true
        }
      });

      await orderEventService.emitOrderEvent({
        type: OrderEventType.ORDER_CANCELLED,
        order: cancelledOrder,
        timestamp: new Date(),
      });

      monitoringService.trackOperationTime('cancelOrder', Date.now() - startTime);
      return cancelledOrder;
    } catch (error) {
      monitoringService.trackOrderError({ 
        id: orderId,
        userId: userAddress 
      }, error as Error);
      throw error;
    }
  }
}

export const orderService = OrderService.getInstance(); 