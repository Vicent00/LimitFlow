import { z } from 'zod';
import { router, publicProcedure, protectedProcedure } from '../server/trpc';
import { priceService } from '../services/priceService';
import { monitoringService } from '../services/monitoring';

const priceInputSchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
});

const priceUpdateSchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
  price: z.number().positive(),
  source: z.string().optional(),
  chainId: z.number().optional(),
});

const priceHistorySchema = z.object({
  tokenIn: z.string(),
  tokenOut: z.string(),
  limit: z.number().min(1).max(1000).optional(),
});

export const pricesRouter = router({
  getPrice: publicProcedure
    .input(priceInputSchema)
    .query(async ({ input }) => {
      const startTime = Date.now();
      try {
        const price = await priceService.getPrice(input.tokenIn, input.tokenOut);
        monitoringService.trackOperationTime('getPrice', Date.now() - startTime);
        return price;
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw error;
      }
    }),

  updatePrice: protectedProcedure
    .input(priceUpdateSchema)
    .mutation(async ({ input }) => {
      const startTime = Date.now();
      try {
        const price = await priceService.updatePrice(
          input.tokenIn,
          input.tokenOut,
          input.price,
          input.source,
          input.chainId
        );
        monitoringService.trackOperationTime('updatePrice', Date.now() - startTime);
        return price;
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw error;
      }
    }),

  getPriceHistory: publicProcedure
    .input(priceHistorySchema)
    .query(async ({ input }) => {
      const startTime = Date.now();
      try {
        const prices = await priceService.getPriceHistory(
          input.tokenIn,
          input.tokenOut,
          input.limit
        );
        monitoringService.trackOperationTime('getPriceHistory', Date.now() - startTime);
        return prices;
      } catch (error) {
        monitoringService.trackOrderError({} as any, error as Error);
        throw error;
      }
    }),
});
