# 4bio | Sistema Interno de Vendas de Medicamentos

Sistema web corporativo completo para operação interna de vendas da 4bio, com foco em performance, fluxo operacional rápido, RBAC e gestão fim a fim (venda, atendimento e entrega).

## Stack utilizada

- **TypeScript + Node.js + Express** no backend
- **React (cliente)** — `npm run dev` com Vite
- **Validação com Zod** para robustez de payload
- **Vitest + Supertest** para testes de API
- **Prisma ORM** com SQLite para cadastros mestres
- **Helmet** para headers HTTP seguros
- **CORS** com origens configuráveis
- **JWT** para autenticação com RBAC

## Funcionalidades implementadas

### Autenticação & Segurança
- Login por colaborador com perfis `admin`, `gerente`, `operador` e `inventario`.
- Troca de senha do colaborador via `PATCH /api/employees/:code/password`.
- Headers HTTP seguros via Helmet (X-Frame-Options, X-Content-Type-Options, etc.).
- CORS configurável por variável de ambiente.
- Request tracking com `X-Request-ID`.
- Rate limiting no login (5 tentativas IP/minuto).

### Catálogo & Vendas
- Catálogo de medicamentos com filtros por especialidade e laboratório.
- **CREATE / UPDATE / DELETE** de medicamentos.
- Registro de venda com:
  - dados do paciente;
  - múltiplos campos de contato;
  - item de medicamento com quantidade;
  - cálculo de total no backend;
  - validação de receita para controlados.
- Interpretação de texto de receita com sugestão de remédios (parse de PDF/imagens com fallback).

### Módulo de Pedidos
- Histórico de pedidos com paginação.
- Recorrência com desconto percentual e data de faturamento.
- Confirmação de recorrência por responsável.

### Entregas
- Painel com busca por status e texto.
- Ações rápidas (em-rota/entregue) com validação de transição de estado.
- Edição de rastreamento e transportadora.

### Dashboard & Métricas
- Indicadores operacionais em `GET /api/dashboard/:role`.
- Métricas de integração em `GET /api/metrics/operational`.
- Lembretes de recorrência.

### Atendimento
- Tickets por colaborador logado.

### Pacientes
- Timeline de atividades do paciente com paginação.
- Elegibilidade mensal (bloqueio de pedidos duplicados por competência).
- Contato com paciente via dialer ou e-mail com retry automático.
- Feature flags para rollout seguro (`patients_v2`, `eligibility_guard`, `communications`).

### Cadastros Mestres (Prisma)
- **Clientes** — CRUD completo.
- **Médicos** — CRUD completo.
- **Planos de Saúde** — CRUD completo.
- **Funcionários** — Listagem, criação e atualização (apenas admin).
- **Fornecedores** — CRUD completo.
- **Produtos Acabados** — CRUD completo.
- **Matérias-Primas** — CRUD completo.
- **Fórmulas Padrão** — CRUD completo.
- **Fórmulas de Embalagem** — CRUD completo.

### Inventário
- Gestão de lotes com FEFO (First-Expiry-First-Out).
- Entradas de inventário com conversão de unidades.
- Importação de NF-e por XML (parser XML real com fallback regex).
- Movimentações de inventário paginadas.
- Resumo de inventário com itens críticos e próximos de vencimento.

### Orçamentos & Produção
- Criação de orçamento a partir de texto de receita.
- Ordem de manipulação e etiquetas de impressão.
- Leitura de balança com validação de desvio.
- Ordem de produção via fórmula padrão.

### Qualidade & Preços
- Laudos de qualidade por pedido.
- Atualização automática de preços por especialidade/laboratório.
- Impressão de etiquetas de pedido.

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
cp .env.example .env  # Gere um JWT_SECRET e ajuste valores
npm install
npx prisma db push      # Aplica o schema no banco
npm run dev
```

Aplicação disponível em `http://localhost:3000`.

## Usuários de demonstração

- `4B-001` / `admin123`
- `4B-014` / `gerente123`
- `4B-101` / `operador123`
- `4B-220` / `inventario123`

## Scripts

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Backend + frontend em modo desenvolvimento |
| `npm run server` | Apenas backend |
| `npm run client` | Apenas frontend React |
| `npm run check` | Validação estática TypeScript |
| `npm run test` | Testes automatizados |
| `npm run test:coverage` | Testes com relatório de cobertura |
| `npm run lint` | Verificar linting |
| `npm run lint:fix` | Corrigir problemas de linting automaticamente |
| `npm run format` | Formatar código com Prettier |
| `npm run build` | Build para produção |
| `npm run start` | Inicia build compilado |
| `npm run db:push` | Sincroniza schema com banco (sem migrações) |
| `npm run db:migrate` | Cria e aplica migração |
| `npm run db:studio` | Prisma Studio (admin visual do banco) |
| `npm run db:reset` | Reseta o banco de dados |

## Métricas operacionais

Endpoint `GET /api/metrics/operational` (perfis `admin` e `gerente`) expõe:

- falhas de contato por canal;
- bloqueios por competência (elegibilidade mensal);
- latência média de integrações (discador, e-mail e frete).

## Health Checks

- `GET /health/live` — status básico do servidor.
- `GET /health/ready` — verifica banco de dados e sistema de arquivos.

## Estratégia de estabilização e remoção de legado

- Durante estabilização, a tela de pacientes mantém **visão nova (patients_v2)** e **visão legada (customers)** em paralelo.
- Após período de operação assistida, remover caminhos legados `/api/customers` e a visão legada do frontend.
- Consolidar documentação final com apenas os fluxos ativos.

## Estrutura

- `src/app.ts` — rotas, regras de negócio e validações.
- `src/database.ts` — persistência SQLite (Prisma) dos cadastros mestres.
- `src/env.ts` — validação de variáveis de ambiente.
- `src/middlewares/` — auth, rate limit, request ID, delivery state machine.
- `src/services/` — inventory, orders, prescriptions.
- `src/biz-logic.ts` — lógica de negócio pura (testável isoladamente).
- `src/store.ts` — persistência em arquivo JSON para dados voláteis.
- `prisma/schema.prisma` — schema do banco de dados.
- `public/*` — interface web (SPA servida pelo backend).
- `client/*` — frontend React com Vite.
- `tests/*` — testes de integração da API e unitários de biz-logic.
