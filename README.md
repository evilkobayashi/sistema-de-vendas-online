# 4Bio | Sistema Interno de Vendas para Farmácia

Sistema web corporativo completo para operação interna de vendas da 4Bio, com foco em performance, fluxo operacional rápido, RBAC e gestão fim a fim (venda, atendimento e entrega).

## Stack Tecnológica

### Backend

- **TypeScript + Node.js + Express** - API REST
- **Prisma ORM** com SQLite - Cadastros mestres
- **JWT** - Autenticação com bcrypt
- **Zod** - Validação de payloads
- **Helmet** - Headers HTTP seguros
- **Vitest** - Testes

### Frontend

- **React 18** + **Vite** - SPA
- **TypeScript** - Tipagem
- **React Router** - Navegação
- **Phosphor Icons** - Ícones
- **CSS Custom Properties** - Theming

## Funcionalidades

### Autenticação & Usuários

- Login por código de colaborador
- 4 perfis de acesso: Admin, Gerente, Operador, Inventário
- Sistema de permissões granulares por perfil
- Múltiplos logins simultâneos
- Sessions rastreadas por IP
- Alteração de senha
- Ativar/desativar usuários

### Dashboard

- KPIs operacionais em tempo real
- Indicadores de estoque crítico
- Lotes próximos ao vencimento
- Lembretes de recorrência
- Métricas de integração

### Catálogo & Estoque

- Catálogo de medicamentos com filtros
- Gestão de lotes com FEFO
- Controle de estoque por unidade
- Validades e临界idade

### Vendas & Pedidos

- Registro de pedidos
- Validação de receitas para controlados
- Leitor de receitas com OCR (Tesseract.js)
- Suporte a PDF e imagens
- Tags coloridas (verde=regular, vermelho=controlado)
- Recorrências com desconto

### Entregas

- Status: pendente, em_rota, entregue, falhou
- Máquina de estados com transições válidas
- Rastreamento de transportadora
- Sync status com provedores

### Atendimento

- Sistema de tickets
- Prioridades: alta, média, baixa
- Status: aberto, em_atendimento, fechado
- Histórico completo de ações
- Contato via email e chat
- Timeline visual de interações

### Cadastros

- Clientes/Patients
- Médicos (com cores por especialidade)
- Planos de Saúde
- Fornecedores
- Usuários (CRUD completo)

### Recursos Extras

- Sistema de notificações com categorias
- Tema claro/escuro
- Sidebar responsiva com toggle
- Logo 4Bio na interface
- Favicon personalizado

## Perfis de Acesso

| Perfil         | Permissões                                               |
| -------------- | -------------------------------------------------------- |
| **Admin**      | Acesso total ao sistema                                  |
| **Gerente**    | Operações, clientes, relatórios (sem gestão de usuários) |
| **Operador**   | Vendas, atendimento, clientes                            |
| **Inventário** | Apenas gestão de estoque                                 |

## Instalação

```bash
# Clonar repositório
git clone https://github.com/evilkobayashi/sistema-de-vendas-online.git
cd sistema-de-vendas-online

# Instalar dependências
npm install

# Criar arquivo .env
cp .env.example .env
# Edite o .env e defina um JWT_SECRET forte

# Inicializar banco de dados
npx prisma db push

# Rodar em desenvolvimento
npm run dev
```

## Configuração

### Variáveis de Ambiente (.env)

```env
JWT_SECRET=sua_chave_secreta_minimo_32_caracteres
DATABASE_URL=file:./dev.db
NODE_ENV=development
PORT=3000
CORS_ORIGINS=http://localhost:5173,http://localhost:3000
```

## Scripts Disponíveis

| Script              | Descrição                             |
| ------------------- | ------------------------------------- |
| `npm run dev`       | Backend + Frontend em desenvolvimento |
| `npm run server`    | Apenas backend                        |
| `npm run client`    | Apenas frontend                       |
| `npm run build`     | Build para produção                   |
| `npm run start`     | Iniciar servidor em produção          |
| `npm run check`     | Verificação TypeScript                |
| `npm run test`      | Executar testes                       |
| `npm run db:push`   | Sincronizar schema com banco          |
| `npm run db:studio` | Abrir Prisma Studio                   |
| `npm run lint`      | Verificar lint                        |
| `npm run lint:fix`  | Corrigir problemas de lint            |
| `npm run format`    | Formatar código                       |

## Usuários de Demonstração

| Código   | Senha           | Perfil        |
| -------- | --------------- | ------------- |
| `4B-001` | `admin123`      | Administrador |
| `4B-014` | `manager123`    | Gerente       |
| `4B-101` | `operator123`   | Operador      |
| `4B-220` | `inventario123` | Inventário    |

## Estrutura do Projeto

```
├── src/
│   ├── app.ts              # Rotas e middleware principal
│   ├── data.ts             # Tipos e dados em memória
│   ├── database.ts         # Prisma - cadastros mestres
│   ├── store.ts            # Persistência em arquivo JSON
│   ├── biz-logic.ts        # Lógica de negócio pura
│   ├── communications.ts    # Integração email/dialer
│   ├── shipping.ts         # Integração fretes
│   ├── middlewares/
│   │   ├── auth.ts         # Autenticação JWT
│   │   ├── rateLimit.ts    # Rate limiting
│   │   └── deliveryStateMachine.ts
│   ├── services/
│   │   ├── inventory.ts
│   │   ├── orders.ts
│   │   └── prescriptions.ts
│   ├── validators/         # Zod schemas
│   └── utils/
│       ├── cache.ts
│       └── security.ts
├── client/
│   ├── src/
│   │   ├── pages/          # Páginas React
│   │   ├── components/     # Componentes reutilizáveis
│   │   ├── contexts/      # React contexts
│   │   └── api.ts         # Cliente API
│   └── public/             # Assets estáticos
├── prisma/
│   └── schema.prisma       # Schema do banco
└── tests/                  # Testes automatizados
```

## API Endpoints

### Autenticação

- `POST /api/login` - Login
- `POST /api/logout` - Logout
- `GET /api/employees` - Listar usuários
- `POST /api/employees` - Criar usuário
- `PUT /api/employees/:id` - Editar usuário
- `PATCH /api/employees/:id/active` - Ativar/desativar
- `PUT /api/employees/:id/password` - Alterar senha
- `GET /api/sessions` - Listar sessões ativas (admin)

### Recursos

- `GET /api/medicines` - Catálogo
- `GET /api/orders` - Pedidos
- `GET /api/deliveries` - Entregas
- `GET /api/customers` - Clientes
- `GET /api/doctors` - Médicos
- `GET /api/health-plans` - Planos de saúde
- `GET /api/tickets` - Tickets
- `GET /api/inventory/lots` - Lotes

### Dashboard

- `GET /api/dashboard/:role?` - Indicadores
- `GET /api/metrics/operational` - Métricas operacionais
- `GET /api/notifications` - Notificações

## Segurança

- Validação rigorosa de entrada (Zod)
- Sanitização contra XSS
- Rate limiting no login (5 tentativas/min)
- JWT com expiração de 24h
- Headers seguros (Helmet)
- Proteção contra enumeração de usuários

## Health Checks

- `GET /health/live` - Status do servidor
- `GET /health/ready` - Verificação completa (DB + filesystem)

## Licença

MIT License
