import { Order } from '@prisma/client';
import { OrderEvent } from './orderEvents';
import winston from 'winston';
import { format } from 'winston';

// Configuración básica de Winston
const logger = winston.createLogger({
  level: 'info',
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/combined.log' }),
    new winston.transports.Console({
      format: format.combine(
        format.colorize(),
        format.simple()
      )
    })
  ]
});

export interface Metric {
  name: string;
  value: number;
  timestamp: Date;
}

export interface TimeRange {
  start: Date;
  end: Date;
}

export class MonitoringService {
  private static instance: MonitoringService;
  private metrics: Map<string, number> = new Map();
  private operationTimes: Map<string, number[]> = new Map();
  private errors: Error[] = [];
  private readonly MAX_METRICS_HISTORY = 1000;

  private constructor() {}

  public static getInstance(): MonitoringService {
    if (!MonitoringService.instance) {
      MonitoringService.instance = new MonitoringService();
    }
    return MonitoringService.instance;
  }

  // Métodos de Logging
  public logOrderEvent(event: OrderEvent) {
    this.incrementMetric(`events_${event.type.toLowerCase()}`);
    console.log(`Order Event: ${event.type}`, {
      orderId: event.order.id,
      timestamp: event.timestamp.toISOString(),
      metadata: event.metadata,
    });
  }

  public logError(error: Error, context?: Record<string, any>) {
    logger.error('Error occurred', {
      error: error.message,
      stack: error.stack,
      context
    });
  }

  // Métodos de Métricas
  public recordMetric(name: string, value: number = 1) {
    this.incrementMetric(name, value);
  }

  private incrementMetric(name: string, value: number = 1) {
    const currentValue = this.metrics.get(name) || 0;
    this.metrics.set(name, currentValue + value);
  }

  public getMetrics(name?: string, timeRange?: TimeRange): Metric[] {
    const metrics: Metric[] = [];
    this.metrics.forEach((value, key) => {
      if (!name || key === name) {
        metrics.push({
          name: key,
          value,
          timestamp: new Date()
        });
      }
    });
    return metrics;
  }

  public getOperationTimes() {
    const result: Record<string, { avg: number; min: number; max: number }> = {};
    this.operationTimes.forEach((times, operation) => {
      result[operation] = {
        avg: times.reduce((a, b) => a + b, 0) / times.length,
        min: Math.min(...times),
        max: Math.max(...times),
      };
    });
    return result;
  }

  public getErrors() {
    return this.errors;
  }

  // Métodos específicos para órdenes
  public trackOrderMetrics(order: Order) {
    this.incrementMetric('total_orders');
    this.incrementMetric(`orders_${order.status.toLowerCase()}`);
    this.incrementMetric(`orders_${order.type.toLowerCase()}`);
  }

  public trackOrderError(order: Partial<Order>, error: Error) {
    this.errors.push(error);
    this.incrementMetric('order_errors');
    console.error(`Order Error: ${error.message}`, {
      order,
      error,
      timestamp: new Date().toISOString(),
    });
  }

  public trackOperationTime(operation: string, timeMs: number) {
    if (!this.operationTimes.has(operation)) {
      this.operationTimes.set(operation, []);
    }
    this.operationTimes.get(operation)?.push(timeMs);
  }

  // Métodos de limpieza
  public cleanup() {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    this.metrics.clear();
    this.operationTimes.clear();
    this.errors = [];
  }
}

export const monitoringService = MonitoringService.getInstance(); 