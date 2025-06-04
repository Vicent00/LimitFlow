import { createPublicClient, http } from 'viem';
import { arbitrum } from 'viem/chains';
import { prisma } from '../db';
import { OrderStatus, OrderType } from '@prisma/client';
import { monitoringService } from './monitoring';
import { ORDER_CONTRACT_ABI } from '../types/contracts';
import { orderEventService, OrderEventType } from './orderEvents';

export class EventService {
  private static instance: EventService;
  private publicClient;
  private readonly orderContractAddress: `0x${string}`;
  private isListening: boolean = false;

  private constructor() {
    const rpcUrl = process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc';
    this.orderContractAddress = (process.env.ORDER_CONTRACT_ADDRESS || '0x0000000000000000000000000000000000000000') as `0x${string}`;
    
    this.publicClient = createPublicClient({
      chain: arbitrum,
      transport: http(rpcUrl),
    });
  }

  public static getInstance(): EventService {
    if (!EventService.instance) {
      EventService.instance = new EventService();
    }
    return EventService.instance;
  }

  async startListening() {
    if (this.isListening) return;

    try {
      this.publicClient.watchEvent({
        address: this.orderContractAddress,
        events: ORDER_CONTRACT_ABI.filter(item => item.type === 'event'),
        onLogs: async (logs) => {
          for (const log of logs) {
            await this.handleEvent(log);
          }
        },
      });

      this.isListening = true;
      console.log('Started listening to blockchain events');
    } catch (error) {
      console.error('Failed to start event listener:', error);
      throw error;
    }
  }

  private async handleEvent(log: any) {
    const startTime = Date.now();
    try {
      switch (log.eventName) {
        case 'OrderCreated':
          await this.handleOrderCreated(log);
          break;
        case 'OrderCancelled':
          await this.handleOrderCancelled(log);
          break;
        case 'OrderExecuted':
          await this.handleOrderExecuted(log);
          break;
      }

      monitoringService.trackOperationTime('handleEvent', Date.now() - startTime);
    } catch (error) {
      console.error('Error handling event:', error);
      monitoringService.trackOrderError({} as any, error as Error);
    }
  }

  private async handleOrderCreated(log: any) {
    // Primero obtener o crear el usuario
    const user = await prisma.user.upsert({
      where: { address: log.args.user.toLowerCase() },
      create: {
        address: log.args.user.toLowerCase(),
        nonce: '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`  ,
      },
      update: {}
    });

    const orderData = {
      userId: user.id,
      userAddress: log.args.user.toLowerCase(),
      tokenIn: log.args.tokenIn.toLowerCase(),
      tokenOut: log.args.tokenOut.toLowerCase(),
      amountIn: BigInt(log.args.amountIn),
      amountOut: BigInt(log.args.minAmountOut),
      status: OrderStatus.PENDING,
      blockchainTxHash: log.transactionHash,
      expiresAt: new Date(Number(log.args.deadline) * 1000),
      type: OrderType.BUY,
      price: 0,
    };

    const order = await prisma.order.create({
      data: orderData,
      include: {
        user: true,
        fills: true
      }
    });

    orderEventService.emitOrderEvent({
      type: OrderEventType.ORDER_CREATED,
      order,
      timestamp: new Date(),
    });

    return order;
  }

  private async handleOrderCancelled(log: any) {
    const order = await prisma.order.findFirst({
      where: { blockchainTxHash: log.transactionHash },
    });

    if (!order) {
      console.error('Order not found for cancellation:', log.transactionHash);
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.CANCELLED },
    });

    orderEventService.emitOrderEvent({
      type: OrderEventType.ORDER_CANCELLED,
      order: updatedOrder,
      timestamp: new Date(),
    });
  }

  private async handleOrderExecuted(log: any) {
    const order = await prisma.order.findFirst({
      where: { blockchainTxHash: log.transactionHash },
    });

    if (!order) {
      console.error('Order not found for execution:', log.transactionHash);
      return;
    }

    const updatedOrder = await prisma.order.update({
      where: { id: order.id },
      data: { status: OrderStatus.COMPLETED },
    });

    orderEventService.emitOrderEvent({
      type: OrderEventType.ORDER_EXECUTED,
      order: updatedOrder,
      timestamp: new Date(),
    });
  }
}

export const eventService = EventService.getInstance(); 