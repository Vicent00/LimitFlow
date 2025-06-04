import { TRPCError } from '@trpc/server';
import { OrderType } from '@prisma/client';
import { monitoringService } from './monitoring';

export class OrderValidationService {
  async validateOrder(data: {
    tokenIn: string;
    tokenOut: string;
    amountIn: bigint;
    amountOut: bigint;
    price: number;
    type: OrderType;
  }) {
    const startTime = Date.now();
    try {
      // Validar direcciones de tokens
      this.validateTokenAddresses(data.tokenIn, data.tokenOut);

      // Validar montos
      this.validateAmounts(data.amountIn, data.amountOut);

      // Validar precio
      this.validatePrice(data.price);

      // Validar tipo de orden
      this.validateOrderType(data.type);

      monitoringService.trackOperationTime('validateOrder', Date.now() - startTime);
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw error;
    }
  }

  async validateOrderUpdate(orderId: string, data: {
    price?: number;
    amountIn?: bigint;
    amountOut?: bigint;
  }) {
    const startTime = Date.now();
    try {
      if (data.price !== undefined) {
        this.validatePrice(data.price);
      }

      if (data.amountIn !== undefined) {
        this.validateAmount(data.amountIn, 'amountIn');
      }

      if (data.amountOut !== undefined) {
        this.validateAmount(data.amountOut, 'amountOut');
      }

      monitoringService.trackOperationTime('validateOrderUpdate', Date.now() - startTime);
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw error;
    }
  }

  private validateTokenAddresses(tokenIn: string, tokenOut: string) {
    if (!this.isValidEthereumAddress(tokenIn)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid tokenIn address',
      });
    }

    if (!this.isValidEthereumAddress(tokenOut)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid tokenOut address',
      });
    }

    if (tokenIn === tokenOut) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'tokenIn and tokenOut must be different',
      });
    }
  }

  private validateAmounts(amountIn: bigint, amountOut: bigint) {
    this.validateAmount(amountIn, 'amountIn');
    this.validateAmount(amountOut, 'amountOut');
  }

  private validateAmount(amount: bigint, fieldName: string) {
    if (amount <= BigInt(0)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: `${fieldName} must be greater than 0`,
      });
    }
  }

  private validatePrice(price: number) {
    if (price <= 0) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Price must be greater than 0',
      });
    }
  }

  private validateOrderType(type: OrderType) {
    if (!Object.values(OrderType).includes(type)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Invalid order type',
      });
    }
  }

  private isValidEthereumAddress(address: string): boolean {
    return /^0x[a-fA-F0-9]{40}$/.test(address);
  }
}

export const orderValidationService = new OrderValidationService(); 