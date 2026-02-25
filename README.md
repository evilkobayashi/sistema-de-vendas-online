# 4bio | Sistema Interno de Vendas de Medicamentos

Sistema web corporativo completo para operação interna de vendas da 4bio, com foco em performance, fluxo operacional rápido, RBAC e gestão fim a fim (venda, atendimento e entrega).

## Stack utilizada (otimizada para web)

- **TypeScript + Node.js + Express** no backend (API rápida e simples para operações internas).
- **Frontend SPA em HTML/CSS/JavaScript** servido pelo próprio backend (baixa complexidade operacional).
- **Validação com Zod** para robustez de payload.
- **Vitest + Supertest** para testes de API.

## Funcionalidades implementadas

- Login por colaborador com perfis `admin`, `gerente` e `operador`.
- Catálogo de medicamentos com filtros por especialidade e laboratório.
- Registro de venda com:
  - dados do paciente;
  - múltiplos campos de contato;
  - item de medicamento com quantidade;
  - cálculo de total no backend;
  - validação de receita para controlados.
- Módulo de pedidos com histórico.
- Painel de entregas com busca por status e texto, ações rápidas (Em rota/Entregue) e edição de status.
- Dashboard com indicadores operacionais, métricas de integração e lembretes de recorrência.
- Atendimento com tickets por colaborador logado.
- Compra recorrente com desconto percentual e data de faturamento.
- Timeline de atividades do paciente.

## Feature flags (rollout seguro)

As novas funcionalidades podem ser ativadas/desativadas por ambiente:

- `FEATURE_PATIENTS_V2` (default: `true`)
- `FEATURE_ELIGIBILITY_GUARD` (default: `true`)
- `FEATURE_COMMUNICATIONS` (default: `true`)

Endpoint para observabilidade de rollout: `GET /api/feature-flags`.

## Migração legada (idempotente)

Para migrar dados antigos de pacientes para referências normalizadas de **médico** e **plano de saúde**:

```bash
npm run migrate:legacy
```

O script é idempotente: pode ser executado mais de uma vez sem duplicar vínculos já migrados.

## Como executar

```bash
npm install
npm run dev
```

Aplicação disponível em `http://localhost:3000`.

## Usuários de demonstração

- `4B-001` / `admin123`
- `4B-014` / `gerente123`
- `4B-101` / `operador123`

## Scripts

- `npm run dev` — inicia servidor em modo desenvolvimento.
- `npm run check` — validação estática TypeScript.
- `npm run test` — testes automatizados.
- `npm run build` — build para produção.
- `npm run start` — inicia build compilado.
- `npm run migrate:legacy` — executa migração de dados legados.

## Métricas operacionais

Endpoint `GET /api/metrics/operational` (perfis `admin` e `gerente`) expõe:

- falhas de contato por canal;
- bloqueios por competência (elegibilidade mensal);
- latência média de integrações (discador, e-mail e frete).

## Estratégia de estabilização e remoção de legado

- Durante estabilização, a tela de pacientes mantém **visão nova (patients_v2)** e **visão legada (customers)** em paralelo.
- Após período de operação assistida, remover caminhos legados `/api/customers` e a visão legada do frontend.
- Consolidar documentação final com apenas os fluxos ativos.

## Estrutura

- `src/app.ts` — rotas, regras de negócio e validações.
- `src/database.ts` — persistência SQLite dos cadastros mestres.
- `src/migrate-legacy-data.ts` — migração idempotente de legado.
- `src/featureFlags.ts` — leitura centralizada de flags.
- `src/data.ts` — base em memória para usuários, medicamentos, pedidos e tickets.
- `public/*` — interface web.
- `tests/*` — testes de integração da API.
