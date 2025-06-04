import { prisma } from '../db';
import { monitoringService } from './monitoring';
import { TRPCError } from '@trpc/server';

export class PriceService {
  private static instance: PriceService;
  private priceCache: Map<string, { price: number; timestamp: Date }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 1 minuto

  private constructor() {}

  public static getInstance(): PriceService {
    if (!PriceService.instance) {
      PriceService.instance = new PriceService();
    }
    return PriceService.instance;
  }

  async getPrice(tokenIn: string, tokenOut: string): Promise<number> {
    const startTime = Date.now();
    try {
      const cacheKey = `${tokenIn}-${tokenOut}`;
      const cachedPrice = this.priceCache.get(cacheKey);

      if (cachedPrice && Date.now() - cachedPrice.timestamp.getTime() < this.CACHE_TTL) {
        return cachedPrice.price;
      }

      const price = await prisma.price.findFirst({
        where: {
          tokenIn,
          tokenOut,
        },
        orderBy: {
          timestamp: 'desc',
        },
      });

      if (!price) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Price not found for token pair',
        });
      }

      this.priceCache.set(cacheKey, {
        price: price.price,
        timestamp: new Date(),
      });

      monitoringService.trackOperationTime('getPrice', Date.now() - startTime);
      return price.price;
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw error;
    }
  }

  async updatePrice(tokenIn: string, tokenOut: string, price: number, source: string = 'MANUAL', chainId: number = 1) {
    const startTime = Date.now();
    try {
      const newPrice = await prisma.price.create({
        data: {
          tokenIn,
          tokenOut,
          price,
          timestamp: new Date(),
          source,
          chainId,
        },
      });

      const cacheKey = `${tokenIn}-${tokenOut}`;
      this.priceCache.set(cacheKey, {
        price: newPrice.price,
        timestamp: new Date(),
      });

      monitoringService.trackOperationTime('updatePrice', Date.now() - startTime);
      return newPrice;
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw error;
    }
  }

  async getPriceHistory(tokenIn: string, tokenOut: string, limit: number = 100) {
    const startTime = Date.now();
    try {
      const prices = await prisma.price.findMany({
        where: {
          tokenIn,
          tokenOut,
        },
        orderBy: {
          timestamp: 'desc',
        },
        take: limit,
      });

      monitoringService.trackOperationTime('getPriceHistory', Date.now() - startTime);
      return prices;
    } catch (error) {
      monitoringService.trackOrderError({} as any, error as Error);
      throw error;
    }
  }

  clearCache() {
    this.priceCache.clear();
  }
}

export const priceService = PriceService.getInstance(); 