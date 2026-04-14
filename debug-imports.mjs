// Script de depuração para testar imports (ES Modules)
import express from 'express';
import { createApp } from './src/app.js';
import { validateEnv } from './src/env.js';

console.log("Tentando importar módulos...");

try {
  console.log("✓ Express importado");
  console.log("✓ createApp importado");
  console.log("✓ validateEnv importado");

  // Testar validação de ambiente
  console.log("Variáveis de ambiente:");
  console.log("- NODE_ENV:", process.env.NODE_ENV);
  console.log("- JWT_SECRET existe:", !!process.env.JWT_SECRET);
  console.log("- DATABASE_URL existe:", !!process.env.DATABASE_URL);

  const env = validateEnv();
  console.log("✓ Variáveis de ambiente validadas:", env.PORT);

  console.log("Todos os imports funcionaram corretamente!");
} catch (error) {
  console.error("Erro ao importar módulos:", error.message);
  console.error("Stack:", error.stack);
}