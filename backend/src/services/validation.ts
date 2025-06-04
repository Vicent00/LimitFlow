import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { SecurityConfig } from '../config/security';
import { validateTokenPair, isValidTokenAddress } from '../config/tokens';
import { ValidationError } from '../errors/ErrorTypes';

export class ValidationService {
  private config: SecurityConfig;
  private orderSchema: z.ZodObject<any>;

  constructor(config: SecurityConfig) {
    this.config = config;
    this.orderSchema = z.object({
      tokenIn: z.string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .refine(isValidTokenAddress, {
          message: 'Invalid tokenIn address. Only USDC and WETH are supported.'
        }),
      tokenOut: z.string()
        .length(42)
        .regex(/^0x[a-fA-F0-9]{40}$/)
        .refine(isValidTokenAddress, {
          message: 'Invalid tokenOut address. Only USDC and WETH are supported.'
        }),
      amountIn: z.bigint().positive()
        .min(this.config.MIN_ORDER_AMOUNT)
        .max(this.config.MAX_ORDER_AMOUNT),
      minAmountOut: z.bigint().positive(),
      maxAmountOut: z.bigint().positive(),
      deadline: z.number().int()
        .min(Math.floor(Date.now() / 1000))
        .max(Math.floor(Date.now() / 1000) + 86400)
    });
  }

  validateOrder(data: unknown) {
    try {
      const validatedData = this.orderSchema.parse(data);
      
      // Validar que los tokens sean diferentes
      validateTokenPair(validatedData.tokenIn, validatedData.tokenOut);
      
      return validatedData;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new ValidationError('Invalid order data', {
          errors: error.errors,
          code: 'INVALID_ORDER_DATA'
        });
      }
      if (error instanceof Error) {
        throw new ValidationError(error.message, {
          code: 'INVALID_TOKEN_PAIR'
        });
      }
      throw error;
    }
  }
} 