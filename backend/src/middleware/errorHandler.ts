import { TRPCError } from '@trpc/server';
import { AppError } from '../errors/AppError';
import { logger } from '../utils/logger';   

export const errorHandler = (error: unknown) => {
  // Si es un error de tRPC, lo convertimos a nuestro formato
  if (error instanceof TRPCError) {
    const appError = new AppError(
      error.code,
      error.message,
      getStatusCodeFromTRPCError(error),
      error.cause
    );
    return handleAppError(appError);
  }

  // Si es nuestro error personalizado
  if (error instanceof AppError) {
    return handleAppError(error);
  }

  // Si es un error desconocido
  const unknownError = new AppError(
    'INTERNAL_SERVER_ERROR',
    'An unexpected error occurred',
    500,
    error
  );
  return handleAppError(unknownError);
};

const handleAppError = (error: AppError) => {
  // Log del error
  logger.error('Error occurred:', {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    stack: error.stack
  });

  // Preparar respuesta para el cliente
  return {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    details: error.details,
    translationKey: error.translationKey
  };
};

const getStatusCodeFromTRPCError = (error: TRPCError): number => {
  switch (error.code) {
    case 'BAD_REQUEST':
      return 400;
    case 'UNAUTHORIZED':
      return 401;
    case 'FORBIDDEN':
      return 403;
    case 'NOT_FOUND':
      return 404;
    case 'METHOD_NOT_SUPPORTED':
      return 405;
    case 'TIMEOUT':
      return 408;
    case 'CONFLICT':
      return 409;
    case 'PRECONDITION_FAILED':
      return 412;
    case 'PAYLOAD_TOO_LARGE':
      return 413;
    case 'UNPROCESSABLE_CONTENT':
      return 422;
    case 'TOO_MANY_REQUESTS':
      return 429;
    case 'CLIENT_CLOSED_REQUEST':
      return 499;
    case 'INTERNAL_SERVER_ERROR':
    default:
      return 500;
  }
}; 