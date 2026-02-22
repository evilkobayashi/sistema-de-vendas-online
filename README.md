# sistema-de-vendas-online

Implementação de pendências de recorrência com:

- Job diário (`npm run job:recurrence`) para pedidos com `nextBillingDate` em D+0..D+3 e `needsConfirmation=true`.
- Persistência de eventos em `recurrence_notifications` (armazenado no `data.json`) para evitar duplicidade.
- Notificação interna por canais (email/Teams/Slack/sistema de tarefas) via `InternalNotifier`.
- Endpoint backend `GET /api/recurrences/pending?collaboratorId=...` para listar pendências por colaborador.
- Frontend em `public/app.js` com destaque de alta prioridade e filtro dedicado.
- Testes cobrindo fuso horário, virada de dia e confirmação no mesmo dia.

## Como rodar

```bash
npm test
npm start
```

Em outro terminal, para executar o job manualmente:

```bash
npm run job:recurrence
```
