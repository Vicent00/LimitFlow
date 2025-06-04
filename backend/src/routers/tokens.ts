import { z } from 'zod';
import { router, protectedProcedure } from '../server/trpc';
import { blockchainService } from '../services/blockchainService';
import { monitoringService } from '../services/monitoring';
import { TRPCError } from '@trpc/server';

// Schemas de validación
const tokenAddressSchema = z.string().length(42).regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid token address');
const amountSchema = z.string().regex(/^\d+$/, 'Amount must be a positive integer');

export const tokensRouter = router({
  // Obtener el allowance de un token
  getAllowance: protectedProcedure
    .input(z.object({
      tokenAddress: tokenAddressSchema,
    }))
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const allowance = await blockchainService.getTokenAllowance(
          input.tokenAddress,
          ctx.user.address
        );

        monitoringService.trackOperationTime('getTokenAllowance', Date.now() - startTime);
        return { allowance: allowance.toString() };
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get token allowance',
          cause: error,
        });
      }
    }),

  // Aprobar un token
  approveToken: protectedProcedure
    .input(z.object({
      tokenAddress: tokenAddressSchema,
      amount: amountSchema,
    }))
    .mutation(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        // Verificar si ya hay suficiente allowance
        const currentAllowance = await blockchainService.getTokenAllowance(
          input.tokenAddress,
          ctx.user.address
        );

        const amount = BigInt(input.amount);
        
        if (currentAllowance >= amount) {
          return {
            txHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
            message: 'Token already approved with sufficient allowance'
          };
        }

        // Crear la transacción de aprobación
        const txHash = await blockchainService.approveToken(
          input.tokenAddress,
          amount
        );

        monitoringService.trackOperationTime('approveToken', Date.now() - startTime);
        return {
          txHash,
          message: 'Token approval transaction sent'
        };
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to approve token',
          cause: error,
        });
      }
    }),

  // Obtener el balance de un token
  getBalance: protectedProcedure
    .input(z.object({
      tokenAddress: tokenAddressSchema,
    }))
    .query(async ({ input, ctx }) => {
      const startTime = Date.now();
      try {
        const balance = await blockchainService.getTokenBalance(
          input.tokenAddress,
          ctx.user.address
        );

        monitoringService.trackOperationTime('getTokenBalance', Date.now() - startTime);
        return { balance: balance.toString() };
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Failed to get token balance',
          cause: error,
        });
      }
    }),
});
