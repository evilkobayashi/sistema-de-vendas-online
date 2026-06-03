# Sistema Interno de Vendas de Medicamentos

Sistema web corporativo para operação interna de vendas de medicamentos e produtos manipulados da 4BIO. O projeto reúne backend em Node.js/Express, frontend em React/Vite, autenticação por perfis, cadastros mestres, catálogo, pedidos, entregas, atendimento, inventário, orçamentos, produção e um mini-jogo interno chamado **Hoffmarias Ellit**.

## Sumário

- [Stack utilizada](#stack-utilizada)
- [Funcionalidades principais](#funcionalidades-principais)
- [Pré-requisitos](#pré-requisitos)
- [Configuração do ambiente](#configuração-do-ambiente)
- [Como executar em desenvolvimento](#como-executar-em-desenvolvimento)
- [Como abrir o jogo na web](#como-abrir-o-jogo-na-web)
- [Usuários de demonstração](#usuários-de-demonstração)
- [Scripts disponíveis](#scripts-disponíveis)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Feature flags](#feature-flags)
- [Endpoints úteis](#endpoints-úteis)
- [Testes e qualidade](#testes-e-qualidade)

## Stack utilizada

### Backend

- **Node.js + Express** para API HTTP e servidor da aplicação.
- **TypeScript** para tipagem estática.
- **Prisma ORM** com **SQLite** para persistência dos cadastros mestres.
- **Zod** para validação de variáveis de ambiente e payloads.
- **JWT** para autenticação.
- **RBAC** para controle de acesso por perfil.
- **Helmet**, **CORS**, rate limit e request ID para segurança e rastreabilidade.
- **Socket.IO** para suporte a WebSocket autenticado.
- **Vitest + Supertest** para testes automatizados.

### Frontend

- **React + TypeScript** com **Vite**.
- **React Router** para navegação entre páginas.
- **Axios** para comunicação com a API.
- **React Hot Toast** para feedback visual.
- CSS global em `client/src/App.css` e `client/src/index.css`.

## Funcionalidades principais

### Autenticação e segurança

- Login por colaborador com token JWT.
- Perfis de acesso: `admin`, `gerente`, `operador` e `inventario`.
- Troca de senha de colaborador.
- Rate limit no login.
- Headers HTTP seguros com Helmet.
- CORS configurável por ambiente.
- Request tracking com `X-Request-ID`.
- Health checks de disponibilidade e prontidão.

### Dashboard e métricas

- Indicadores operacionais por perfil.
- Métricas de integração e comunicação.
- Lembretes de recorrência.
- Endpoint de feature flags para observabilidade do rollout.

### Catálogo, vendas e pedidos

- Catálogo de medicamentos com filtros por especialidade e laboratório.
- Criação, edição e remoção de medicamentos.
- Registro de venda com dados do paciente, contato, item, quantidade e total calculado no backend.
- Validação de receita para medicamentos controlados.
- Histórico de pedidos com paginação.
- Recorrência com desconto e data de faturamento.
- Confirmação de recorrência por responsável.

### Entregas e atendimento

- Painel de entregas com busca por status e texto.
- Transições de entrega validadas por máquina de estados.
- Edição de rastreamento e transportadora.
- Tickets de atendimento por colaborador logado.

### Pacientes e comunicações

- Timeline de atividades do paciente com paginação.
- Elegibilidade mensal para evitar pedidos duplicados por competência.
- Contato com paciente via discador ou e-mail com retry automático.
- Feature flags para rollout seguro dos fluxos novos.

### Cadastros mestres

- Clientes.
- Médicos.
- Planos de saúde.
- Funcionários.
- Fornecedores.
- Produtos acabados.
- Matérias-primas.
- Fórmulas padrão.
- Fórmulas de embalagem.

### Inventário, orçamentos e produção

- Gestão de lotes com FEFO (*First-Expiry-First-Out*).
- Entradas de inventário com conversão de unidades.
- Importação de NF-e por XML.
- Movimentações de inventário paginadas.
- Resumo com itens críticos e próximos de vencimento.
- Orçamentos a partir de texto de receita.
- Ordem de manipulação, etiquetas e leitura de balança.
- Ordem de produção por fórmula padrão.
- Laudos de qualidade por pedido.

### Mini-jogo Hoffmarias Ellit

O frontend também inclui o mini-jogo **Hoffmarias Ellit**, uma simulação de confeitaria acessível pelo menu principal. Nele é possível comprar ingredientes e utensílios, preparar bolos, atender pedidos, vender produtos, contratar funcionários, disputar competições e ganhar troféus.

## Pré-requisitos

- Node.js compatível com o projeto.
- npm.
- SQLite, usado via Prisma e arquivo local configurado em `DATABASE_URL`.

> Dica: use versões recentes de Node.js LTS para evitar incompatibilidades com TypeScript, Vite e Prisma.

## Configuração do ambiente

1. Clone o repositório e acesse a pasta do projeto.
2. Copie o arquivo de exemplo de variáveis de ambiente:

```bash
cp .env.example .env
```

3. Configure um segredo JWT forte no `.env`:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

4. Preencha a variável `JWT_SECRET` com o valor gerado.

Exemplo de configuração local:

```env
DATABASE_URL="file:./dev.db"
JWT_SECRET="cole-aqui-um-segredo-forte"
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
FEATURE_PATIENTS_V2=true
FEATURE_ELIGIBILITY_GUARD=true
FEATURE_COMMUNICATIONS=true
NODE_ENV=development
```

## Como executar em desenvolvimento

Instale as dependências do backend e do frontend:

```bash
npm install
cd client && npm install && cd ..
```

Sincronize o schema Prisma com o banco local:

```bash
npm run db:push
```

Inicie backend e frontend juntos:

```bash
npm run dev
```

URLs padrão em desenvolvimento:

- Frontend React/Vite: `http://localhost:5173`
- Backend/API: `http://localhost:3000`
- Proxy de API no Vite: chamadas para `/api` são encaminhadas para `http://localhost:3000`

Também é possível iniciar cada parte separadamente:

```bash
npm run server
npm run client
```

## Como abrir o jogo na web

O **Hoffmarias Ellit** roda no navegador, dentro do frontend React. Depois de iniciar o projeto com `npm run dev`, siga este fluxo:

1. Abra `http://localhost:5173` no navegador.
2. Faça login com um usuário de demonstração, como `4B-001` / `admin123`.
3. Clique no menu **Hoffmarias Ellit** ou acesse diretamente `http://localhost:5173/jogo-bolos`.

A rota do jogo é protegida por login. Se você abrir `/jogo-bolos` sem autenticação, o app redireciona para a tela de login.

## Usuários de demonstração

| Perfil | Código | Senha |
|--------|--------|-------|
| Admin | `4B-001` | `admin123` |
| Gerente | `4B-014` | `gerente123` |
| Operador | `4B-101` | `operador123` |
| Inventário | `4B-220` | `inventario123` |

## Scripts disponíveis

### Raiz do projeto

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia backend e frontend em paralelo. |
| `npm run server` | Inicia apenas o backend Express. |
| `npm run client` | Inicia apenas o frontend React/Vite. |
| `npm run build` | Compila o backend TypeScript para `dist`. |
| `npm run start` | Inicia o backend compilado. |
| `npm run check` | Executa validação TypeScript sem emitir arquivos. |
| `npm run test` | Executa testes automatizados com Vitest. |
| `npm run test:coverage` | Executa testes com relatório de cobertura. |
| `npm run lint` | Executa ESLint no backend e testes. |
| `npm run lint:fix` | Aplica correções automáticas do ESLint. |
| `npm run format` | Formata arquivos TypeScript com Prettier. |
| `npm run db:push` | Sincroniza o schema Prisma com o banco sem criar migração. |
| `npm run db:migrate` | Cria e aplica uma migração Prisma. |
| `npm run db:studio` | Abre o Prisma Studio. |
| `npm run db:reset` | Reseta o banco de dados local. |

### Frontend (`client/`)

| Script | Descrição |
|--------|-----------|
| `npm run dev` | Inicia o Vite em modo desenvolvimento. |
| `npm run build` | Compila TypeScript e gera build de produção do frontend. |
| `npm run lint` | Executa ESLint no frontend. |
| `npm run preview` | Serve localmente o build do frontend. |

## Estrutura do projeto

```text
.
├── client/                 # Frontend React com Vite
│   └── src/
│       ├── components/     # Componentes compartilhados, como Layout
│       ├── pages/          # Páginas da aplicação
│       ├── api.ts          # Cliente Axios e interceptors
│       ├── App.tsx         # Rotas do frontend
│       └── App.css         # Estilos globais da aplicação
├── prisma/
│   └── schema.prisma       # Schema Prisma do banco SQLite
├── src/                    # Backend Express/TypeScript
│   ├── middlewares/        # Auth, rate limit, request ID e máquina de estados
│   ├── services/           # Serviços de inventário, pedidos e prescrições
│   ├── app.ts              # Rotas, validações e regras HTTP
│   ├── server.ts           # Bootstrap HTTP + Socket.IO
│   ├── database.ts         # Acesso a dados via Prisma
│   ├── env.ts              # Validação de variáveis de ambiente
│   └── biz-logic.ts        # Regras puras testáveis
├── tests/                  # Testes de integração e unidade
├── .env.example            # Exemplo de configuração local
├── package.json            # Scripts e dependências do backend
└── README.md               # Documentação principal
```

## Feature flags

As funcionalidades em rollout podem ser ativadas ou desativadas por ambiente:

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `FEATURE_PATIENTS_V2` | `true` | Ativa os fluxos novos de pacientes. |
| `FEATURE_ELIGIBILITY_GUARD` | `true` | Ativa bloqueio de elegibilidade mensal. |
| `FEATURE_COMMUNICATIONS` | `true` | Ativa comunicações por discador/e-mail. |

Endpoint de consulta:

```http
GET /api/feature-flags
```

## Endpoints úteis

| Endpoint | Descrição |
|----------|-----------|
| `GET /health/live` | Health check simples de vida do servidor. |
| `GET /health/ready` | Verifica banco de dados e escrita em disco. |
| `POST /api/login` | Autenticação de colaborador. |
| `GET /api/dashboard/:role?` | Indicadores do dashboard. |
| `GET /api/metrics/operational` | Métricas operacionais para `admin` e `gerente`. |
| `GET /api/feature-flags` | Estado das feature flags. |

## Testes e qualidade

Comandos recomendados antes de abrir uma alteração:

```bash
npm run check
npm run test
npm run lint
cd client && npm run build
```

Para mudanças apenas no frontend, execute pelo menos:

```bash
cd client && npm run build
```

## Observações de produção

- Defina `NODE_ENV=production`.
- Use um `JWT_SECRET` exclusivo e forte.
- Restrinja `CORS_ORIGINS` às origens autorizadas.
- Gere e versiona migrações com `npm run db:migrate` em vez de depender apenas de `db:push`.
- Proteja o arquivo do banco SQLite ou substitua por banco gerenciado se o volume de dados crescer.
- Monitore os health checks e métricas operacionais.
