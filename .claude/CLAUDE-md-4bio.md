# CLAUDE.md - 4bio | Sistema Interno de Vendas de Medicamentos

## 🎯 Project Context
- **Name**: 4bio — Plataforma de Vendas Corporativa
- **Stack**: TypeScript + Node.js/Express (backend) + React (frontend) + Prisma ORM + SQLite
- **Type**: Full-stack web application (monorepo)
- **Scope**: Sistema corporativo de vendas com RBAC, inventário, entrega, atendimento
- **Architecture**: Backend API + React SPA + Prisma data layer

## 🚨 Critical Rules

### Code Style (TypeScript + Node.js)
- **TypeScript strict mode** — no `any` types, use proper generics
- **File structure**: `src/app.ts` (routes), `src/database.ts` (Prisma), `src/middlewares/`, `src/services/`, `src/biz-logic.ts`
- **Imports**: Use destructuring `import { foo } from 'bar'` not `import * as foo`
- **API responses**: Consistent format `{ success: boolean, data?, error?, statusCode }`
- **Validation**: Use **Zod** for all payload validation (built-in)
- **Error handling**: Always use try-catch in async/await, return proper HTTP status codes
- **No console.log in production** — use structured logging if logging needed

### Testing & Quality
- **Tests**: Vitest + Supertest for API tests (already configured)
- **Test location**: `tests/` folder alongside source
- **Every test**: Must pass before committing changes
- **Coverage**: Aim for >80% on core business logic (biz-logic.ts)
- **Linting**: ESLint configured — run `npm run lint:fix` before commit
- **Format**: Prettier configured — run `npm run format` before commit

### Database (Prisma + SQLite)
- **Schema location**: `prisma/schema.prisma`
- **Migrations**: Always create migration with descriptive name → `npm run db:migrate --name description`
- **Never modify database manually** — all changes via Prisma schema + migrations
- **Relations**: Define properly (oneToMany, manyToMany) with `@relation` rules
- **Push vs Migrate**: Use `db:push` for dev/prototyping, `db:migrate` for production
- **Studio**: Use `npm run db:studio` for visual inspection (Prisma Studio on localhost)

### API & Backend
- **Endpoints**: RESTful structure under `src/app.ts`
- **Rate limiting**: Already implemented on login (5 attempts/IP/minute) — add to other sensitive endpoints
- **JWT**: Token-based auth (RBAC: admin, gerente, operador, inventario)
- **CORS**: Configured via `CORS_ORIGIN` env var
- **Headers**: Helmet (security headers) + X-Request-ID tracking built-in
- **Validation**: All requests validated with Zod BEFORE processing
- **Business logic**: Put in `src/biz-logic.ts` (testable, pure functions)
- **Services**: Database/external integrations in `src/services/` (inventory.ts, orders.ts, etc.)

### Frontend (React)
- **Location**: `client/` folder (Vite build system)
- **State**: React context or hooks (currently no Redux/Zustand)
- **Components**: Functional components only, hooks for side effects
- **API calls**: Centralized in service layer (not scattered in components)
- **Build**: `npm run client` starts Vite dev server on 5173
- **Bundle**: Run `npm run build` and check size before merging

### Git & Commits
- **Commit messages**: Conventional commits — `feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `chore:`
- **Branch names**: `feature/card-name`, `bugfix/issue-name`, never `main` directly
- **PRs**: Reference issue, describe changes, ensure tests pass
- **Review**: Always review diffs, especially database changes

### Feature Flags (Rollout Safety)
- **Implemented flags**: `FEATURE_PATIENTS_V2`, `FEATURE_ELIGIBILITY_GUARD`, `FEATURE_COMMUNICATIONS`
- **Pattern**: Wrap new features with `if (featureFlagEnabled(...))` checks
- **Toggle via**: Environment variables or runtime API `GET /api/feature-flags`
- **Removal**: After stabilization period, remove flag + legacy code paths

### Security
- **Secrets**: Never commit `.env` — use `.env.example` template
- **Validation**: Validate ALL user inputs (Zod built-in)
- **SQL injection**: Prisma prevents (use parameterized queries only)
- **XSS**: React escapes by default, but sanitize user HTML if needed
- **RBAC**: Middleware checks role before endpoint — implement `requireRole('admin')` pattern
- **Rate limiting**: Apply to auth endpoints + sensitive operations

## 📂 Project Structure

```
4bio/
├── src/
│   ├── app.ts              # All routes, middleware setup, validation
│   ├── database.ts         # Prisma client singleton
│   ├── env.ts              # Environment variable validation (Zod)
│   ├── biz-logic.ts        # Pure business logic (testable)
│   ├── middlewares/        # Auth, rate limit, request ID, state machine
│   │   ├── auth.ts
│   │   ├── rateLimitLogin.ts
│   │   └── deliveryStateMachine.ts
│   ├── services/           # Integrations + business operations
│   │   ├── inventory.ts
│   │   ├── orders.ts
│   │   └── prescriptions.ts
│   └── store.ts            # JSON file store (volatile data)
│
├── prisma/
│   └── schema.prisma       # Database schema (SQLite)
│
├── client/                 # React frontend (Vite)
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/       # API calls
│   │   └── App.tsx
│   └── vite.config.ts
│
├── tests/                  # API + unit tests
│   ├── api.test.ts
│   └── biz-logic.test.ts
│
├── public/                 # Static files served by backend
│
├── package.json            # Scripts: dev, server, client, test, lint, db:*
├── tsconfig.json           # TypeScript strict mode
├── vitest.config.ts        # Test runner config
├── .eslintrc.mjs           # Linting rules
├── .prettierrc              # Code formatting
├── Dockerfile              # Multi-stage build for production
├── .dockerignore            # Exclude build artifacts from image
└── .env.example            # Template (JWT_SECRET, DATABASE_URL, etc.)
```

## ⚙️ Critical Commands

```bash
# Development
npm run dev              # Backend + frontend (concurrent)
npm run server          # Backend only (localhost:3000)
npm run client          # Frontend only (localhost:5173)

# Database
npm run db:push         # Push schema to SQLite (dev/proto)
npm run db:migrate      # Create + apply migration (prod)
npm run db:studio       # Prisma Studio UI (localhost:5555)
npm run db:reset        # ⚠️ DESTRUCTIVE: reset + seed (dev only)
npm run migrate:legacy  # Run legacy patient migration (idempotent)

# Testing & Quality
npm run test            # Run all tests (Vitest)
npm run test:coverage   # Coverage report
npm run check           # TypeScript validation
npm run lint            # ESLint check
npm run lint:fix        # Auto-fix linting issues
npm run format          # Prettier format

# Build & Deploy
npm run build           # Full production build
npm run start           # Run production build
npm run docker:build    # Docker multi-stage build
```

## 🧠 Memory & Patterns

### Common Patterns in This Codebase

**1. API Endpoint with Zod validation + Prisma:**
```typescript
// src/app.ts
app.post('/api/medicines', async (req, res) => {
  // 1. Validate payload
  const schema = z.object({ name: z.string(), lab: z.string() });
  const body = schema.parse(req.body);  // Throws if invalid (caught by error handler)
  
  // 2. Business logic
  const medicine = await prisma.medicine.create({ data: body });
  
  // 3. Return standardized response
  res.json({ success: true, data: medicine });
});
```

**2. Middleware pattern (RBAC):**
```typescript
const requireRole = (allowedRoles: string[]) => async (req, res, next) => {
  const role = req.user?.role;
  if (!allowedRoles.includes(role)) return res.status(403).json({ error: 'Forbidden' });
  next();
};

app.get('/api/admin/metrics', requireRole(['admin']), async (req, res) => {
  // Admin-only endpoint
});
```

**3. Feature flag pattern:**
```typescript
const featureEnabled = (flagName: string) => process.env[`FEATURE_${flagName}`] === 'true';

if (featureEnabled('PATIENTS_V2')) {
  // New patient logic
} else {
  // Legacy customer logic
}
```

**4. Database operations in services (not routes):**
```typescript
// src/services/orders.ts — pure business logic
export async function createOrder(customerId: string, items: OrderItem[]) {
  const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
  return prisma.order.create({
    data: { customerId, total, items: { createMany: { data: items } } }
  });
}
```

### Known Issues & Workarounds

- **PDF parsing**: Uses text fallback if image parsing fails (see `prescriptions.ts`)
- **Legacy customer data**: `FEATURE_PATIENTS_V2` flag controls parallel display
- **Inventory FEFO**: Manual ordering logic in `inventory.ts` (no DB constraint)
- **Recurrence date**: Client calculates next due date (backend validates)

### Debugging Tips

- **Prisma Studio**: `npm run db:studio` → opens UI to inspect/edit data
- **Request logging**: Check `X-Request-ID` header in console
- **Test single file**: `npm run test -- tests/biz-logic.test.ts`
- **Coverage gaps**: `npm run test:coverage | grep -i "<80%"`

## 🚀 Deployment

### Docker Build
```dockerfile
# Multi-stage: builder → runtime
# Excludes: node_modules, .git, dist, .env (via .dockerignore)
docker build -t 4bio:latest .
docker run -p 3000:3000 4bio:latest
```

### Environment Checklist (Production)
- [ ] `JWT_SECRET` set to strong random value
- [ ] `DATABASE_URL` points to production SQLite path
- [ ] `CORS_ORIGIN` set to frontend domain
- [ ] All feature flags reviewed (default: true, can disable)
- [ ] Rate limits tuned (currently 5 login attempts/IP/min)
- [ ] HTTPS enforced (backend behind reverse proxy)
- [ ] Backups scheduled for SQLite file

### Health Checks
```bash
curl http://localhost:3000/health/live   # Server alive?
curl http://localhost:3000/health/ready  # DB + FS ok?
```

## 💡 Dev Workflow

1. **Start session**: `npm run dev` (both servers)
2. **Make changes**: Edit code (auto-reload via Vite + nodemon)
3. **Test locally**: `npm run test` (pass before push)
4. **Database change**: Run `npm run db:push` (dev) or `db:migrate --name description` (feature branch)
5. **Code quality**: `npm run lint:fix && npm run format`
6. **Commit**: Conventional message, push to feature branch
7. **PR**: Ensure tests pass, request review, delete branch after merge

## 🔒 Before Pushing

- [ ] All tests pass: `npm run test`
- [ ] No linting errors: `npm run lint`
- [ ] TypeScript valid: `npm run check`
- [ ] Code formatted: `npm run format`
- [ ] Database migrations reviewed
- [ ] No `.env` secrets in code
- [ ] Commit message is clear + conventional
- [ ] PR description references issue/feature

## 🌐 GStack Integration

### Browse & Web Access
- **Never use** `mcp__claude-in-chrome__*` tools directly
- **Always use** `/browse` skill from gstack for all web browsing
- Gstack provides unified interface for browser automation, web testing, and deployment workflows

### Available GStack Skills
- `/office-hours` — Architecture reviews & decision support
- `/plan-ceo-review` — Executive-level planning
- `/plan-eng-review` — Engineering planning & reviews
- `/plan-design-review` — Design planning & critiques
- `/design-consultation` — Design guidance
- `/design-shotgun` — Rapid design ideation
- `/design-html` — HTML/CSS design implementation
- `/review` — Code review workflows
- `/ship` — Deployment preparation
- `/land-and-deploy` — Production deployment
- `/canary` — Canary deployment strategy
- `/benchmark` — Performance benchmarking
- `/browse` — **Web browsing (use for all browser tasks)**
- `/connect-chrome` — Chrome connection setup
- `/qa` — Full QA testing workflows
- `/qa-only` — QA verification only
- `/design-review` — Design critique & feedback
- `/setup-browser-cookies` — Browser authentication
- `/setup-deploy` — Deployment configuration
- `/setup-gbrain` — GBrain knowledge setup
- `/retro` — Retrospective analysis
- `/investigate` — Deep investigation & debugging
- `/document-release` — Release documentation
- `/codex` — Code generation & analysis
- `/cso` — Customer success operations
- `/autoplan` — Automated planning
- `/plan-devex-review` — Developer experience reviews
- `/devex-review` — DevEx feedback
- `/careful` — Careful mode (extra validation)
- `/freeze` — Feature freeze lockdown
- `/guard` — Safety guards & constraints
- `/unfreeze` — Release freeze
- `/gstack-upgrade` — Upgrade GStack components
- `/learn` — Learning & knowledge transfer

## 📋 See Also

- **Business logic**: `src/biz-logic.ts` — pure functions, zero side effects, highly testable
- **Inventory logic**: `src/services/inventory.ts` — FEFO, unit conversion, NF-e parsing
- **API docs**: Auto-generated from routes (consider adding Swagger if needed)
- **Migration guide**: `docs/DEPLOYMENT.md` (if exists) or ask in PR

## 🎯 Token Optimization Notes

- **CLAUDE.md size**: ~650 tokens (good baseline)
- **Skip**: Full API docs, archived migration history
- **Reference**: Business logic in `src/biz-logic.ts` (pure, testable)
- **Link to**: `README.md` in repo for feature details
- **Use `/context`** during session to monitor what's loaded
- **Batch related changes** (e.g., auth logic + tests together)

---

**Last updated**: April 2026 | **Stack**: TS+Express+React+Prisma | **Focus**: Full-stack e-commerce pharmacy platform
