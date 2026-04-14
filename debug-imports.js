// Script de depuração para testar imports
try {
  console.log("Tentando importar módulos...");

  // Testar imports básicos
  const express = require('express');
  console.log("✓ Express importado");

  const { createApp } = require('./src/app.js');
  console.log("✓ createApp importado");

  const { validateEnv } = require('./src/env.js');
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