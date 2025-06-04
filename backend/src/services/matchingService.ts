import { prisma } from '../db';
import { Order, OrderStatus, OrderType } from '@prisma/client';
import { TRPCError } from '@trpc/server';
import { monitoringService } from './monitoring';
import { blockchainService } from './blockchainService';
import { orderEventService, OrderEventType } from './orderEvents';

export class MatchingService {
  private static instance: MatchingService;

  private constructor() {}

  public static getInstance(): MatchingService {
    if (!MatchingService.instance) {
      MatchingService.instance = new MatchingService();
    }
    return MatchingService.instance;
  }

  async findMatchingOrders(order: Order): Promise<Order[]> {
    const startTime = Date.now();
    try {
      // Buscar órdenes que coincidan con los criterios
      const matchingOrders = await prisma.order.findMany({
        where: {
          status: OrderStatus.PENDING,
          tokenIn: order.tokenOut,
          tokenOut: order.tokenIn,
          type: order.type === OrderType.BUY ? OrderType.SELL : OrderType.BUY,
          // El precio debe ser compatible (para órdenes de compra, el precio de venta debe ser menor o igual)
          price: order.type === OrderType.BUY 
            ? { lte: order.price }
            : { gte: order.price },
        },
        orderBy: {
          price: order.type === OrderType.BUY ? 'asc' : 'desc', // Para compras, ordenar por precio ascendente
          createdAt: 'asc', // En caso de empate, la orden más antigua primero
        },
      });

      monitoringService.trackOperationTime('findMatchingOrders', Date.now() - startTime);
      return matchingOrders;
    } catch (error) {
      monitoringService.trackOrderError(order, error as Error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to find matching orders',
        cause: error,
      });
    }
  }

  async matchOrders(order: Order): Promise<void> {
    const startTime = Date.now();
    try {
      const matchingOrders = await this.findMatchingOrders(order);
      let remainingAmount = order.amountIn;

      for (const matchingOrder of matchingOrders) {
        if (remainingAmount <= 0n) break;

        const matchAmount = this.calculateMatchAmount(order, matchingOrder, remainingAmount);
        if (matchAmount <= 0n) continue;

        // Ejecutar el matching en la blockchain
        const txHash = await blockchainService.executeOrder(matchingOrder.id);

        // Actualizar las órdenes en la base de datos
        await this.updateOrdersAfterMatch(order, matchingOrder, matchAmount, txHash);

        remainingAmount -= matchAmount;
      }

      monitoringService.trackOperationTime('matchOrders', Date.now() - startTime);
    } catch (error) {
      monitoringService.trackOrderError(order, error as Error);
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: 'Failed to match orders',
        cause: error,
      });
    }
  }

  private calculateMatchAmount(order: Order, matchingOrder: Order, remainingAmount: bigint): bigint {
    // Calcular la cantidad que se puede intercambiar
    const orderAmount = order.amountIn;
    const matchingOrderAmount = matchingOrder.amountIn;
    
    // La cantidad máxima que se puede intercambiar es el mínimo entre:
    // 1. La cantidad restante de la orden original
    // 2. La cantidad disponible en la orden matching
    return remainingAmount < matchingOrderAmount ? remainingAmount : matchingOrderAmount;
  }

  private async updateOrdersAfterMatch(
    order: Order,
    matchingOrder: Order,
    matchAmount: bigint,
    txHash: `0x${string}`
  ): Promise<void> {
    // Actualizar la orden matching
    const updatedMatchingOrder = await prisma.order.update({
      where: { id: matchingOrder.id },
      data: {
        amountIn: matchingOrder.amountIn - matchAmount,
        status: matchingOrder.amountIn - matchAmount <= 0n ? OrderStatus.COMPLETED : OrderStatus.PENDING,
        blockchainTxHash: txHash,
      },
    });

    // Actualizar la orden original
    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: {
        amountIn: order.amountIn - matchAmount,
        status: order.amountIn - matchAmount <= 0n ? OrderStatus.COMPLETED : OrderStatus.PENDING,
      },
    });

    // Registrar el fill
    await prisma.fill.create({
      data: {
        orderId: matchingOrder.id,
        amount: matchAmount,
        price: matchingOrder.price,
      },
    });

    // Emitir eventos
    orderEventService.emitOrderEvent({
      type: OrderEventType.ORDER_EXECUTED,
      order: updatedMatchingOrder,
      timestamp: new Date(),
    });

    if (updatedOrder.status === OrderStatus.COMPLETED) {
      orderEventService.emitOrderEvent({
        type: OrderEventType.ORDER_EXECUTED,
        order: updatedOrder,
        timestamp: new Date(),
      });
    }
  }

  async startMatchingEngine(): Promise<void> {
    // Buscar órdenes pendientes y procesarlas
    const pendingOrders = await prisma.order.findMany({
      where: { status: OrderStatus.PENDING },
      orderBy: { createdAt: 'asc' },
    });

    for (const order of pendingOrders) {
      try {
        await this.matchOrders(order);
      } catch (error) {
        console.error(`Failed to match order ${order.id}:`, error);
      }
    }
  }
}

export const matchingService = MatchingService.getInstance(); 