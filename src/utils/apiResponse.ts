// Tipos genéricos para respostas da API
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  statusCode: number;
  timestamp: string;
  requestId?: string;
}

export interface PaginatedResponse<T> extends ApiResponse {
  data: {
    items: T[];
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

// Funções utilitárias para criação de respostas padronizadas
export const successResponse = <T>(
  data: T,
  message?: string,
  statusCode: number = 200
): ApiResponse<T> => ({
  success: true,
  data,
  message,
  statusCode,
  timestamp: new Date().toISOString()
});

export const errorResponse = (
  error: string,
  message?: string,
  statusCode: number = 400
): ApiResponse => ({
  success: false,
  error,
  message,
  statusCode,
  timestamp: new Date().toISOString()
});

export const notFoundResponse = (resource: string): ApiResponse => ({
  success: false,
  error: `${resource} não encontrado(a)`,
  statusCode: 404,
  timestamp: new Date().toISOString()
});

export const unauthorizedResponse = (): ApiResponse => ({
  success: false,
  error: 'Não autorizado',
  statusCode: 401,
  timestamp: new Date().toISOString()
});