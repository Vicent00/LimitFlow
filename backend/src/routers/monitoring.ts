import { z } from 'zod';
import { router, adminProcedure } from '../server/trpc';
import { monitoringService } from '../services/monitoring';

export const monitoringRouter = router({
  getMetrics: adminProcedure
    .input(z.object({
      name: z.string().optional(),
      startTime: z.date().optional(),
      endTime: z.date().optional(),
    }))
    .query(async ({ input }) => {
      const timeRange = input.startTime && input.endTime
        ? { start: input.startTime, end: input.endTime }
        : undefined;

      return monitoringService.getMetrics(input.name, timeRange);
    }),

  getOrderMetrics: adminProcedure
    .input(z.object({
      timeRange: z.object({
        start: z.date(),
        end: z.date(),
      }).optional(),
    }))
    .query(async ({ input }) => {
      const metrics = monitoringService.getMetrics(undefined, input.timeRange);
      
      // Agrupar métricas por tipo
      return {
        total: metrics.filter(m => m.name === 'total_orders'),
        byStatus: metrics.filter(m => m.name.endsWith('_orders')),
        byType: metrics.filter(m => m.name.includes('_orders') && !m.name.endsWith('_orders')),
        errors: metrics.filter(m => m.name === 'order_errors'),
      };
    }),
}); 