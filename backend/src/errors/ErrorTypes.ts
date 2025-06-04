import { AppError } from './AppError';

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'VALIDATION_ERROR',
      message,
      400,
      details,
      'errors.validation'
    );
    this.name = 'ValidationError';
  }
}

export class AuthenticationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'AUTHENTICATION_ERROR',
      message,
      401,
      details,
      'errors.authentication'
    );
    this.name = 'AuthenticationError';
  }
}

export class AuthorizationError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'AUTHORIZATION_ERROR',
      message,
      403,
      details,
      'errors.authorization'
    );
    this.name = 'AuthorizationError';
  }
}

export class NotFoundError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'NOT_FOUND_ERROR',
      message,
      404,
      details,
      'errors.notFound'
    );
    this.name = 'NotFoundError';
  }
}

export class BlockchainError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'BLOCKCHAIN_ERROR',
      message,
      500,
      details,
      'errors.blockchain'
    );
    this.name = 'BlockchainError';
  }
}

export class RateLimitError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'RATE_LIMIT_ERROR',
      message,
      429,
      details,
      'errors.rateLimit'
    );
    this.name = 'RateLimitError';
  }
}

export class DatabaseError extends AppError {
  constructor(message: string, details?: any) {
    super(
      'DATABASE_ERROR',
      message,
      500,
      details,
      'errors.database'
    );
    this.name = 'DatabaseError';
  }
} 