// Script para testar a inicialização ponto a ponto
import 'dotenv/config';

console.log('Variáveis de ambiente:');
console.log('- NODE_ENV:', process.env.NODE_ENV);
console.log('- PORT:', process.env.PORT);
console.log('- DATABASE_URL:', process.env.DATABASE_URL);
console.log('- JWT_SECRET length:', process.env.JWT_SECRET ? process.env.JWT_SECRET.length : 'NOT SET');

// Testar se podemos acessar o sistema de arquivos
import fs from 'fs';
import path from 'path';

console.log('\nTeste de acesso ao sistema de arquivos: OK');

// Testar imports básicos
import express from 'express';
console.log('Import de express: OK');

import { z } from 'zod';
console.log('Import de zod: OK');

// Validar somente o essencial
const basicEnv = {
  PORT: parseInt(process.env.PORT) || 3000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET,
};

if (!basicEnv.DATABASE_URL || !basicEnv.JWT_SECRET) {
  console.error('Faltam variáveis de ambiente essenciais!');
  process.exit(1);
}

console.log('Variáveis básicas OK');

// Tentar criar um app mínimo
const app = express();
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Tentar iniciar o servidor
const port = basicEnv.PORT;
console.log(`\nTentando iniciar servidor na porta ${port}...`);

const server = app.listen(port, () => {
  console.log(`✅ Servidor básico iniciado em http://localhost:${port}`);
  console.log('Endpoint disponível: http://localhost:' + port + '/health');

  // Auto-shutdown após 5 segundos para teste
  setTimeout(() => {
    console.log('Encerrando servidor de teste...');
    server.close(() => {
      console.log('Servidor encerrado com sucesso');
      process.exit(0);
    });
  }, 5000);
});

server.on('error', (err) => {
  console.error('Erro no servidor:', err);
  process.exit(1);
});