import { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.js';
import { errorResponse } from '../utils/apiResponse.js';

export const errorHandler = (err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = res.getHeader('X-Request-Id');

  // Log estruturado do erro
  const errorLog = {
    timestamp: new Date().toISOString(),
    method: req.method,
    url: req.originalUrl,
    requestId: requestId ? String(requestId) : undefined,
    error: {
      name: err.name,
      message: err.message,
      stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    },
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  };

  console.error(JSON.stringify(errorLog));

  // Tratamento específico para AppError
  if (err instanceof AppError) {
    return res
      .status(err.statusCode)
      .json(
        errorResponse(
          err.message,
          err.details && typeof err.details === 'object' && 'message' in err.details
            ? (err.details as any).message
            : undefined,
          err.statusCode
        )
      );
  }

  // Para erros não esperados
  if (process.env.NODE_ENV === 'development') {
    return res.status(500).json({
      error: err.message,
      stack: err.stack,
      requestId: requestId ? String(requestId) : undefined,
    });
  }

  // Em produção, retornar mensagem genérica usando o padrão de resposta
  return res.status(500).json(errorResponse('Erro interno do servidor', undefined, 500));
};
