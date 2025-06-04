import { Order } from '@prisma/client';
import { EventEmitter } from 'events';
import { monitoringService } from './monitoring';

export enum OrderEventType {
  ORDER_CREATED = 'ORDER_CREATED',
  ORDER_UPDATED = 'ORDER_UPDATED',
  ORDER_CANCELLED = 'ORDER_CANCELLED',
  ORDER_FILLED = 'ORDER_FILLED',
  ORDER_EXPIRED = 'ORDER_EXPIRED',
  ORDER_FAILED = 'ORDER_FAILED',
  ORDER_EXECUTED = 'ORDER_EXECUTED'
}

export interface OrderEvent {
  type: OrderEventType;
  order: Order;
  timestamp: Date;
  metadata?: Record<string, any>;
}

class OrderEventService {
  private eventEmitter: EventEmitter;

  constructor() {
    this.eventEmitter = new EventEmitter();
    this.setupEventListeners();
  }

  private setupEventListeners() {
    this.eventEmitter.on('orderEvent', (event: OrderEvent) => {
      // Registrar el evento en el sistema de monitoreo
      monitoringService.logOrderEvent(event);
    });
  }

  emitOrderEvent(event: OrderEvent) {
    this.eventEmitter.emit('orderEvent', event);
  }

  onOrderEvent(callback: (event: OrderEvent) => void) {
    this.eventEmitter.on('orderEvent', callback);
  }

  removeOrderEventListener(callback: (event: OrderEvent) => void) {
    this.eventEmitter.removeListener('orderEvent', callback);
  }
}

export const orderEventService = new OrderEventService(); 