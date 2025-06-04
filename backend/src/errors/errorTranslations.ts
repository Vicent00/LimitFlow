export const errorTranslations = {
  'errors.validation': {
    en: 'Validation error',
    es: 'Error de validación'
  },
  'errors.authentication': {
    en: 'Authentication error',
    es: 'Error de autenticación'
  },
  'errors.authorization': {
    en: 'Authorization error',
    es: 'Error de autorización'
  },
  'errors.notFound': {
    en: 'Resource not found',
    es: 'Recurso no encontrado'
  },
  'errors.blockchain': {
    en: 'Blockchain error',
    es: 'Error de blockchain'
  },
  'errors.rateLimit': {
    en: 'Too many requests',
    es: 'Demasiadas solicitudes'
  },
  'errors.database': {
    en: 'Database error',
    es: 'Error de base de datos'
  },
  // Mensajes específicos
  'errors.invalidTokenAddress': {
    en: 'Invalid token address',
    es: 'Dirección de token inválida'
  },
  'errors.insufficientBalance': {
    en: 'Insufficient balance',
    es: 'Saldo insuficiente'
  },
  'errors.invalidSignature': {
    en: 'Invalid signature',
    es: 'Firma inválida'
  },
  'errors.orderNotFound': {
    en: 'Order not found',
    es: 'Orden no encontrada'
  },
  'errors.invalidOrderAmount': {
    en: 'Invalid order amount',
    es: 'Monto de orden inválido'
  }
} as const;

export type ErrorTranslationKey = keyof typeof errorTranslations;
export type Language = 'en' | 'es'; 