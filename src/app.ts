import express from 'express';
import { authenticate, authorize } from './auth/middleware';

const app = express();
app.use(express.json());
app.use(authenticate);

app.post('/recorrencias/confirmacao', authorize('confirmar_recorrencia'), (req, res) => {
  const authenticatedUserId = req.user!.id;

  res.json({
    status: 'ok',
    operacao: 'confirmacao_recorrencia',
    authenticatedUserId,
  });
});

app.patch('/entregas/:entregaId', authorize('atualizar_entregas'), (req, res) => {
  const authenticatedUserId = req.user!.id;

  res.json({
    status: 'ok',
    operacao: 'atualizacao_entrega',
    entregaId: req.params.entregaId,
    authenticatedUserId,
  });
});

app.get(
  '/operacional/dados-sensiveis',
  authorize('acessar_dados_operacionais_sensiveis'),
  (req, res) => {
    const authenticatedUserId = req.user!.id;

    res.json({
      status: 'ok',
      operacao: 'dados_operacionais_sensiveis',
      authenticatedUserId,
      dados: {
        margem: 0.31,
        volumeDiario: 1284,
      },
    });
  },
);

export default app;
