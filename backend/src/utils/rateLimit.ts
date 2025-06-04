import { Redis } from 'ioredis';
import { prisma } from '../db';

interface RateLimitParams {
  ip: string;
  userId: string;
  action: string;
}

interface RateLimitResult {
  success: boolean;
  retryAfter?: number;
}

export class RateLimiter {
  private static readonly WINDOW_MS = 60 * 1000; // 1 minuto
  private static readonly MAX_REQUESTS = {
    'order.create': 5,
    'order.cancel': 10,
    'default': 20
  } as const;

  private redis: Redis;

  constructor() {
    if (!process.env.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is not set');
    }
    this.redis = new Redis(process.env.REDIS_URL);
  }

  async check({ ip, userId, action }: RateLimitParams): Promise<RateLimitResult> {
    const key = `ratelimit:${ip}:${userId}:${action}`;
    const maxRequests = RateLimiter.MAX_REQUESTS[action as keyof typeof RateLimiter.MAX_REQUESTS] || RateLimiter.MAX_REQUESTS.default;

    try {
      // Obtener número actual de requests
      const current = await this.redis.get(key);
      const count = current ? parseInt(current) : 0;

      if (count >= maxRequests) {
        // Obtener tiempo restante
        const ttl = await this.redis.ttl(key);
        return {
          success: false,
          retryAfter: ttl
        };
      }

      // Incrementar contador
      if (!current) {
        await this.redis.set(key, 1, 'EX', RateLimiter.WINDOW_MS);
      } else {
        await this.redis.incr(key);
      }

      // Registrar en base de datos para análisis usando SQL directo
      await prisma.$executeRaw`
        INSERT INTO "RateLimitLog" (id, ip, "userId", action, timestamp)
        VALUES (gen_random_uuid(), ${ip}, ${userId}, ${action}, NOW())
      `;

      return { success: true };
    } catch (error) {
      console.error('Rate limit error:', error);
      // En caso de error, permitir la request
      return { success: true };
    }
  }

  async reset(userId: string): Promise<void> {
    const pattern = `ratelimit:*:${userId}:*`;
    const keys = await this.redis.keys(pattern);
    if (keys.length > 0) {
      await this.redis.del(...keys);
    }
  }
} 