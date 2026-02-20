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
- Dashboard com indicadores operacionais e lembretes de recorrência (até 3 dias).
- Atendimento com tickets por colaborador logado.
- Compra recorrente com desconto percentual e data de faturamento.

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

## Estrutura

- `src/app.ts` — rotas, regras de negócio e validações.
- `src/data.ts` — base em memória para usuários, medicamentos, pedidos e tickets.
- `public/*` — interface web.
- `tests/*` — testes de integração da API.
