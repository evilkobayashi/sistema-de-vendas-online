import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import express, { type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { validators } from './validators/index.js';
import {
  type User,
  type Customer,
  type Doctor,
  type HealthPlan,
  type Delivery,
  type DeliveryStatus,
  type Order,
  type Medicine,
  type Ticket,
  type InventoryLot,
  type InventoryMovement,
  type NotificationType,
  users,
  sessions,
  customers,
  doctors,
  healthPlans,
  orders,
  deliveries,
  medicines,
  tickets,
  inventoryLots,
  inventoryMovements,
  notifications,
} from './data.js';
import { loadPersistentState, persistState } from './store.js';
import {
  createCustomer,
  createDoctor,
  createEmployee,
  createFinishedProduct,
  createHealthPlan,
  createPackagingFormula,
  createPatientActivity,
  createRawMaterial,
  createStandardFormula,
  createSupplier,
  getCustomerById,
  getDoctorById,
  getHealthPlanById,
  initDatabase,
  listCustomers,
  listDoctors,
  listEmployees,
  listFinishedProducts,
  listHealthPlans,
  listPackagingFormulas,
  listPatientActivities,
  listRawMaterials,
  listStandardFormulas,
  listSuppliers,
  updateCustomer,
  updateDoctor,
  updateHealthPlan,
} from './database.js';
import { createShipmentWithFallback, quoteWithFallback } from './shipping.js';
import { dialerProvider, emailProvider, executeWithRetries } from './communications.js';
import { getFeatureFlags } from './featureFlags.js';
import {
  computePatientEligibility,
  calculateRunOutDate,
  parsePrescriptionToSuggestions,
  buildRecurringReminders,
  reserveStockFefo,
  buildInventorySummary,
  addDays,
  availableQuantityByMedicine,
  extractTextFromDocument,
} from './biz-logic.js';
import {
  authRequired,
  authorize,
  requirePermission,
  getAuthUser,
  JWT_SECRET as moduleJWT_SECRET,
} from './middlewares/auth.js';
import { loginRateLimiter } from './middlewares/rateLimit.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { isValidDeliveryTransition } from './middlewares/deliveryStateMachine.js';
import { parseXml } from '@rgrove/parse-xml';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middlewares/logger.js';
import { errorHandler } from './middlewares/errorHandler.js';
import { cache } from './utils/cache.js';
import { auditService } from './services/AuditService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const featureFlags = getFeatureFlags();

const operationalMetrics = {
  contactFailures: { call: 0, email: 0 },
  eligibilityBlocks: 0,
  integrationLatency: {
    dialerMs: [] as number[],
    emailMs: [] as number[],
    shippingQuoteMs: [] as number[],
    shippingCreateMs: [] as number[],
  },
};

function trackLatency(bucket: number[], startMs: number) {
  bucket.push(Date.now() - startMs);
  if (bucket.length > 200) bucket.shift();
}

function avgMs(values: number[]) {
  if (!values.length) return 0;
  return Math.round(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function resolvePublicDir() {
  const cwd = process.cwd() || '.';
  const candidates = [
    path.resolve(cwd, 'client', 'dist'),
    path.resolve(cwd, 'dist'),
    path.resolve(cwd, 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public'),
    path.resolve(__dirname, '../client/dist'),
  ];
  const found = candidates.find((dir) => dir && fs.existsSync(path.join(dir, 'index.html')));
  if (!found) throw new Error('Diretório public não encontrado. Gere os assets ou valide o ambiente de execução.');
  return found;
}

const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const JWT_SECRET = moduleJWT_SECRET;

const budgets: Array<{
  id: string;
  patientName: string;
  doctorName?: string;
  prescriptionText: string;
  suggestedItems: Array<{ medicineId: string; medicineName: string; confidence: number; quantitySuggestion: number }>;
  status: 'draft' | 'approved';
  createdAt: string;
}> = [];
const scaleReadings: Array<{
  id: string;
  quoteId: string;
  medicineId: string;
  expectedWeightGrams: number;
  measuredWeightGrams: number;
  deviationPercent: number;
  status: 'ok' | 'alert';
  createdAt: string;
}> = [];
const productionOrders: Array<{
  id: string;
  formulaId: string;
  batchSize: number;
  operator: string;
  status: 'planejada' | 'em_producao' | 'concluida';
  createdAt: string;
}> = [];

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize)),
  };
}

function createLotEntry(input: {
  medicineId: string;
  batchCode: string;
  expiresAt: string;
  quantity: number;
  unitCost: number;
  supplier: string;
  reason: string;
  createdBy: string;
}) {
  const newLot: InventoryLot = {
    id: crypto.randomUUID(),
    medicineId: input.medicineId,
    batchCode: input.batchCode,
    expiresAt: input.expiresAt,
    quantity: input.quantity,
    reserved: 0,
    unitCost: input.unitCost,
    supplier: input.supplier,
    createdAt: new Date().toISOString(),
  };

  inventoryLots.unshift(newLot);
  inventoryMovements.unshift({
    id: `mov-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
    medicineId: newLot.medicineId,
    lotId: newLot.id,
    type: 'entrada',
    quantity: newLot.quantity,
    reason: input.reason,
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
  });

  return newLot;
}

function parseNfeItems(xml: string) {
  const items: Array<{ name: string; quantity: number; unitPrice?: number }> = [];

  try {
    const doc = parseXml(xml);
    const detElements = doc.children
      .filter((n: any): n is any => n.type === 'Element')
      .flatMap((ele: any) => {
        if (ele.name === 'NFe' || ele.name === 'nfeProc') {
          return ele.children
            .filter((n: any): n is any => n.type === 'Element' && n.name === 'infNFe')
            .flatMap((inf: any) => inf.children.filter((n: any): n is any => n.type === 'Element' && n.name === 'det'));
        }
        return ele.children?.filter((n: any): n is any => n.type === 'Element' && n.name === 'det') ?? [];
      });

    for (const det of detElements) {
      const prod = det.children?.find((n: any) => n.type === 'Element' && n.name === 'prod');
      if (!prod) continue;

      const name = prod.children?.find((n: any) => n.type === 'Element' && n.name === 'xProd')?.text?.trim();
      const qty = prod.children?.find((n: any) => n.type === 'Element' && n.name === 'qCom')?.text;
      const unitPrice = prod.children?.find((n: any) => n.type === 'Element' && n.name === 'vUnCom')?.text;

      if (name) {
        items.push({
          name,
          quantity: Number(qty ?? '0'),
          unitPrice: unitPrice ? Number(unitPrice) : undefined,
        });
      }
    }
  } catch {
    // Fallback to regex if XML parsing fails
    const detRegex = /<det[\s\S]*?<\/det>/g;
    const matches = xml.match(detRegex) || [];
    for (const block of matches) {
      const nameMatch = block.match(/<xProd>([^<]+)<\/xProd>/);
      const quantityMatch = block.match(/<qCom>([^<]+)<\/qCom>/);
      const unitPriceMatch = block.match(/<vUnCom>([^<]+)<\/vUnCom>/);

      if (nameMatch && quantityMatch) {
        const n = nameMatch[1]?.trim() || '';
        const q = Number(quantityMatch[1]?.replace(',', '.') || '0');
        const u = unitPriceMatch ? Number(unitPriceMatch[1]?.replace(',', '.') || '0') : undefined;

        // Sanitização adicional para evitar XSS
        const sanitizedName = n.replace(/[<>'"&]/g, (match) => {
          const escapeMap: Record<string, string> = {
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '&': '&amp;',
          };
          return escapeMap[match] || match;
        });

        if (sanitizedName && q > 0) {
          items.push({ name: sanitizedName, quantity: q, unitPrice: u ? Number(u) : undefined });
        }
      }
    }
  }

  return items;
}

export function createApp() {
  const app = express();

  // Security & observability middleware (early in the stack)
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(requestIdMiddleware);
  app.use(requestLogger);
  app.use(
    cors({
      origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
      methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      credentials: true,
    })
  );

  app.use(express.json({ limit: '2mb' }));
  const publicDir = resolvePublicDir();
  loadPersistentState();
  initDatabase();

  app.get('/health/live', (_: Request, res: Response) => res.json({ status: 'ok' }));

  app.get('/health/ready', async (_: Request, res: Response) => {
    const checks: Record<string, 'ok' | 'fail'> = {
      database: 'ok',
      filesystem: 'ok',
    };

    // Check database connectivity
    try {
      const { prisma } = await import('./database.js');
      await prisma().$queryRaw`SELECT 1`;
    } catch {
      checks.database = 'fail';
    }

    // Check persistence directory
    try {
      const pathModule = await import('node:path');
      const storeDir = process.env.RUNTIME_STORE_DIR || pathModule.default.resolve(process.cwd(), '.runtime-data');
      if (!fs.existsSync(storeDir)) {
        fs.mkdirSync(storeDir, { recursive: true });
      }
      // Verify we can write to the store
      const testFile = pathModule.default.join(storeDir, '.healthcheck');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
    } catch {
      checks.filesystem = 'fail';
    }

    const allOk = Object.values(checks).every((v) => v === 'ok');
    res.status(allOk ? 200 : 503).json({
      status: allOk ? 'ready' : 'degraded',
      checks,
    });
  });

  app.post('/api/login', loginRateLimiter, async (req: Request, res: Response) => {
    const parsed = validators.login.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido' });

    const employeeCodeNormalized = parsed.data.employeeCode.trim().toUpperCase();
    const passwordNormalized = parsed.data.password.trim();

    const user = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCodeNormalized);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    if (!user.active) return res.status(401).json({ error: 'Usuário desativado. Contacte o administrador.' });

    const passwordMatch = await bcrypt.compare(passwordNormalized, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Credenciais inválidas' });

    const safeUser = {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      employeeCode: user.employeeCode,
    };
    const token = jwt.sign(safeUser, JWT_SECRET!, { expiresIn: '24h' });

    sessions.push({
      token,
      userId: user.id,
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      ipAddress: req.ip,
    });

    return res.json({ token, expiresInMs: 24 * 60 * 60 * 1000, user: safeUser });
  });

  app.post('/api/logout', authRequired, async (req: Request, res: Response) => {
    const authHeader = req.header('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) {
      const idx = sessions.findIndex((s) => s.token === token);
      if (idx !== -1) sessions.splice(idx, 1);
    }
    return res.json({ ok: true });
  });

  app.use('/api', authRequired);

  app.get('/api/feature-flags', (_req: Request, res: Response) => {
    return res.json(featureFlags);
  });

  app.get('/api/metrics/operational', authorize(['admin', 'gerente']), (_req: Request, res: Response) => {
    return res.json({
      contactFailures: operationalMetrics.contactFailures,
      eligibilityBlocks: operationalMetrics.eligibilityBlocks,
      integrationLatency: {
        dialerAvgMs: avgMs(operationalMetrics.integrationLatency.dialerMs),
        emailAvgMs: avgMs(operationalMetrics.integrationLatency.emailMs),
        shippingQuoteAvgMs: avgMs(operationalMetrics.integrationLatency.shippingQuoteMs),
        shippingCreateAvgMs: avgMs(operationalMetrics.integrationLatency.shippingCreateMs),
      },
    });
  });

  async function validatePatientReferences(input: { doctorId?: string; healthPlanId?: string }) {
    if (input.doctorId) {
      const doctor = await getDoctorById(input.doctorId);
      if (!doctor) return { error: 'Médico informado não existe.' };
    }
    if (input.healthPlanId) {
      const healthPlan = await getHealthPlanById(input.healthPlanId);
      if (!healthPlan) return { error: 'Plano de saúde informado não existe.' };
    }
    return { ok: true };
  }

  async function logPatientActivity(
    req: Request,
    input: {
      patientId: string;
      activityType: string;
      description: string;
      metadata?: Record<string, unknown>;
      performedBy?: string;
    }
  ) {
    await createPatientActivity({
      patientId: input.patientId,
      activityType: input.activityType,
      description: input.description,
      metadataJson: JSON.stringify(input.metadata || {}),
      performedBy: input.performedBy || 'system',
    });

    // Registrar evento de auditoria
    const user = users.find((u) => u.id === input.performedBy) || { id: 'system', name: 'System' };
    auditService.logAction(req, user.id, user.name, input.activityType, 'patient', input.patientId, {
      description: input.description,
      metadata: input.metadata,
    });
  }

  // NOTE: /api/customers is the legacy patient endpoint. /api/patients (gated by
  // featureFlags.patients_v2) is the v2 replacement. Both are kept in parallel until
  // the legacy endpoint is fully retired per roadmap. Do not remove /api/customers yet.
  app.get('/api/customers', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    let items = customers;
    if (q.trim()) {
      const lowerQ = q.toLowerCase();
      items = customers.filter(
        (c) =>
          c.name.toLowerCase().includes(lowerQ) ||
          c.email.toLowerCase().includes(lowerQ) ||
          c.phone.includes(q) ||
          c.patientCode?.toLowerCase().includes(lowerQ) ||
          c.insuranceCardCode?.toLowerCase().includes(lowerQ)
      );
    }

    const pagination = validators.pagination.safeParse(req.query);
    const paginated = pagination.success
      ? paginate(items, pagination.data.page, pagination.data.pageSize)
      : { items, total: items.length };
    return res.json({ ...paginated, legacy: true, patientsV2Enabled: featureFlags.patients_v2 });
  });

  app.post('/api/customers', async (req: Request, res: Response) => {
    const parsed = validators.customer.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newCustomer = {
      id: crypto.randomUUID(),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    customers.unshift(newCustomer);
    persistState();

    const authUser = getAuthUser(req);
    await logPatientActivity(req, {
      patientId: newCustomer.id,
      activityType: 'patient_created',
      description: 'Cadastro de paciente criado.',
      metadata: { source: 'customers' },
      performedBy: authUser.id,
    });
    return res.status(201).json({ item: newCustomer });
  });

  app.get('/api/customers/:customerId', async (req: Request, res: Response) => {
    const item = customers.find((c) => c.id === req.params.customerId);
    if (!item) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/customers/:customerId', async (req: Request, res: Response) => {
    const parsed = validators.customer.update.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const idx = customers.findIndex((c) => c.id === req.params.customerId);
    if (idx === -1) return res.status(404).json({ error: 'Cliente não encontrado' });

    Object.assign(customers[idx], parsed.data);
    return res.json({ item: customers[idx] });
  });

  app.get('/api/patients', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2)
      return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const items = await listCustomers(q);
    return res.json({ items });
  });

  app.post('/api/patients', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2)
      return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const parsed = validators.customer.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await createCustomer(parsed.data);
    const authUser = getAuthUser(req);
    await logPatientActivity(req, {
      patientId: item.id,
      activityType: 'patient_created',
      description: 'Cadastro de paciente criado.',
      metadata: { source: 'patients' },
      performedBy: authUser.id,
    });
    return res.status(201).json({ item });
  });

  app.patch('/api/patients/:patientId', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2)
      return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const parsed = validators.customer.update.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await updateCustomer(req.params.patientId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    const authUser = getAuthUser(req);
    await logPatientActivity(req, {
      patientId: item.id,
      activityType: 'patient_updated',
      description: 'Cadastro de paciente atualizado.',
      metadata: { source: 'patients' },
      performedBy: authUser.id,
    });
    return res.json({ item });
  });

  app.get('/api/patients/:patientId', async (req: Request, res: Response) => {
    const item = customers.find((c) => c.id === req.params.patientId);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    return res.json({ item });
  });

  app.get('/api/patients/:patientId/activities', async (req: Request, res: Response) => {
    const patient = customers.find((c) => c.id === req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    // Return mock activities for demo
    const activities = [
      {
        id: 'act-1',
        activityType: 'patient_created',
        description: 'Cadastro de paciente criado',
        createdAt: patient.createdAt || new Date().toISOString(),
        performedBy: 'Sistema',
      },
      {
        id: 'act-2',
        activityType: 'order_created',
        description: 'Pedido realizado',
        createdAt: new Date().toISOString(),
        performedBy: 'Operador',
      },
    ];

    return res.json({ items: activities, total: activities.length });
  });

  app.get('/api/patients/:patientId/eligibility', async (req: Request, res: Response) => {
    const patient = customers.find((c) => c.id === req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const eligibility = computePatientEligibility(patient.id);
    return res.json(eligibility);
  });

  app.post('/api/patients/:patientId/contact', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2)
      return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    if (!featureFlags.communications)
      return res.status(503).json({ error: 'Módulo communications desabilitado por feature flag.' });
    const patient = await getCustomerById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const parsed = validators.patientContact.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const authUser = getAuthUser(req);
    const destination = parsed.data.type === 'email' ? patient.email : patient.phone;
    if (!destination) return res.status(400).json({ error: 'Paciente sem destino válido para contato' });

    const requestPayload = {
      patientId: patient.id,
      channel: parsed.data.type,
      destination,
      subject: parsed.data.subject,
      message: parsed.data.message,
      metadata: parsed.data.metadata,
    } as const;

    const startedAt = Date.now();
    const result = await executeWithRetries(
      async () => {
        if (parsed.data.type === 'call') return dialerProvider.sendCall(requestPayload);
        return emailProvider.sendEmail(requestPayload);
      },
      {
        retries: 2,
        waitMs: 50,
        onAttemptError: async (attempt, error) => {
          operationalMetrics.contactFailures[parsed.data.type] += 1;
          await logPatientActivity(req, {
            patientId: patient.id,
            activityType: `contact_attempt_${parsed.data.type}`,
            description: `Tentativa ${attempt} de contato (${parsed.data.type}) falhou: ${error.message}`,
            metadata: { attempt, type: parsed.data.type, destination },
            performedBy: authUser.id,
          });
        },
      }
    );

    if (parsed.data.type === 'call') trackLatency(operationalMetrics.integrationLatency.dialerMs, startedAt);
    else trackLatency(operationalMetrics.integrationLatency.emailMs, startedAt);

    if (!result.ok) {
      await logPatientActivity(req, {
        patientId: patient.id,
        activityType: `contact_failed_${parsed.data.type}`,
        description: `Contato ${parsed.data.type} falhou após ${result.attempt} tentativa(s).`,
        metadata: { attempts: result.attempt, type: parsed.data.type, destination },
        performedBy: authUser.id,
      });
      return res.status(502).json({ error: 'Falha ao processar contato com paciente', attempts: result.attempt });
    }

    await logPatientActivity(req, {
      patientId: patient.id,
      activityType: `contact_success_${parsed.data.type}`,
      description: `Contato ${parsed.data.type} enviado com sucesso para ${destination}.`,
      metadata: {
        attempts: result.attempt,
        type: parsed.data.type,
        destination,
        provider: result.result.provider,
        externalId: result.result.externalId,
      },
      performedBy: authUser.id,
    });

    return res.json({ ok: true, attempts: result.attempt, item: result.result });
  });

  app.get('/api/health-plans', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    let items = healthPlans;
    if (q.trim()) {
      const lowerQ = q.toLowerCase();
      items = healthPlans.filter(
        (hp) =>
          hp.name.toLowerCase().includes(lowerQ) ||
          hp.providerName.toLowerCase().includes(lowerQ) ||
          hp.registrationCode.toLowerCase().includes(lowerQ)
      );
    }

    const pagination = validators.pagination.safeParse(req.query);
    return res.json(
      pagination.success
        ? paginate(items, pagination.data.page, pagination.data.pageSize)
        : { items, total: items.length }
    );
  });

  app.post('/api/health-plans', async (req: Request, res: Response) => {
    const parsed = validators.healthPlan.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newPlan = {
      id: crypto.randomUUID(),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    healthPlans.unshift(newPlan);
    persistState();

    return res.status(201).json({ item: newPlan });
  });

  app.patch('/api/health-plans/:healthPlanId', async (req: Request, res: Response) => {
    const parsed = validators.healthPlan.update.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const idx = healthPlans.findIndex((hp) => hp.id === req.params.healthPlanId);
    if (idx === -1) return res.status(404).json({ error: 'Plano de saúde não encontrado' });

    Object.assign(healthPlans[idx], parsed.data);
    persistState();

    return res.json({ item: healthPlans[idx] });
  });

  app.get('/api/doctors', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    let items = doctors;
    if (q.trim()) {
      const lowerQ = q.toLowerCase();
      items = doctors.filter(
        (d) =>
          d.name.toLowerCase().includes(lowerQ) ||
          d.crm.toLowerCase().includes(lowerQ) ||
          d.specialty.toLowerCase().includes(lowerQ)
      );
    }

    const pagination = validators.pagination.safeParse(req.query);
    return res.json(
      pagination.success
        ? paginate(items, pagination.data.page, pagination.data.pageSize)
        : { items, total: items.length }
    );
  });

  app.post('/api/doctors', async (req: Request, res: Response) => {
    const parsed = validators.doctor.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newDoctor = {
      id: crypto.randomUUID(),
      ...parsed.data,
      createdAt: new Date().toISOString(),
    };

    doctors.unshift(newDoctor);
    persistState();

    return res.status(201).json({ item: newDoctor });
  });

  app.get('/api/doctors/:doctorId', async (req: Request, res: Response) => {
    const item = doctors.find((d) => d.id === req.params.doctorId);
    if (!item) return res.status(404).json({ error: 'Médico não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/doctors/:doctorId', async (req: Request, res: Response) => {
    const parsed = validators.doctor.update.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const idx = doctors.findIndex((d) => d.id === req.params.doctorId);
    if (idx === -1) return res.status(404).json({ error: 'Médico não encontrado' });

    Object.assign(doctors[idx], parsed.data);
    persistState();

    return res.json({ item: doctors[idx] });
  });

  app.get('/api/employees', authRequired, requirePermission('users.view'), async (req: Request, res: Response) => {
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    let filtered = users.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      phone: u.phone,
      role: u.role,
      employeeCode: u.employeeCode,
      active: u.active,
      createdAt: u.createdAt,
      updatedAt: u.updatedAt,
    }));

    if (q) {
      const qLower = q.toLowerCase();
      filtered = filtered.filter(
        (u) =>
          u.name.toLowerCase().includes(qLower) ||
          u.employeeCode.toLowerCase().includes(qLower) ||
          (u.email && u.email.toLowerCase().includes(qLower))
      );
    }

    if (req.query.active !== undefined) {
      filtered = filtered.filter((u) => u.active === (req.query.active === 'true'));
    }

    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: filtered, total: filtered.length });
  });

  app.get('/api/employees/:id', authRequired, requirePermission('users.view'), async (req: Request, res: Response) => {
    const user = users.find((u) => u.id === req.params.id);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      employeeCode: user.employeeCode,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });

  app.post('/api/employees', authRequired, requirePermission('users.create'), async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const { name, email, phone, role, employeeCode, password } = req.body;

    if (!name || !employeeCode || !password || !role) {
      return res.status(400).json({ error: 'Nome, código, senha e função são obrigatórios' });
    }

    const existing = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCode.trim().toUpperCase());
    if (existing) {
      return res.status(400).json({ error: 'Código de funcionário já existe' });
    }

    if (email) {
      const existingEmail = users.find((u) => u.email === email);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser: User = {
      id: `u${Date.now()}`,
      name,
      email,
      phone,
      role,
      employeeCode: employeeCode.trim().toUpperCase(),
      password: hashedPassword,
      active: true,
      createdAt: new Date().toISOString(),
      createdBy: authUser.id,
    };

    users.push(newUser);
    persistState();

    return res.status(201).json({
      id: newUser.id,
      name: newUser.name,
      email: newUser.email,
      phone: newUser.phone,
      role: newUser.role,
      employeeCode: newUser.employeeCode,
      active: newUser.active,
      createdAt: newUser.createdAt,
    });
  });

  app.put('/api/employees/:id', authRequired, requirePermission('users.edit'), async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const userId = req.params.id;

    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    const { name, email, phone, role } = req.body;

    if (name) user.name = name;
    if (phone !== undefined) user.phone = phone;
    if (email !== undefined) {
      const existingEmail = users.find((u) => u.email === email && u.id !== userId);
      if (existingEmail) {
        return res.status(400).json({ error: 'Email já cadastrado' });
      }
      user.email = email;
    }
    if (role && authUser.role === 'admin') {
      user.role = role;
    }

    user.updatedAt = new Date().toISOString();
    persistState();

    return res.json({
      id: user.id,
      name: user.name,
      email: user.email,
      phone: user.phone,
      role: user.role,
      employeeCode: user.employeeCode,
      active: user.active,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  });

  app.patch(
    '/api/employees/:id/active',
    authRequired,
    requirePermission('users.edit'),
    async (req: Request, res: Response) => {
      const { active } = req.body;
      const userId = req.params.id;

      const user = users.find((u) => u.id === userId);
      if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

      if (user.id === getAuthUser(req).id) {
        return res.status(400).json({ error: 'Você não pode ativar/desativar seu próprio usuário' });
      }

      user.active = active;
      user.updatedAt = new Date().toISOString();
      persistState();

      return res.json({ ok: true, active: user.active });
    }
  );

  app.put('/api/employees/:id/password', authRequired, async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const userId = req.params.id;
    const { currentPassword, newPassword } = req.body;

    const user = users.find((u) => u.id === userId);
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' });

    if (authUser.id !== userId && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para alterar esta senha' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ error: 'Nova senha deve ter pelo menos 6 caracteres' });
    }

    if (authUser.id === userId || authUser.role === 'admin') {
      if (authUser.id === userId) {
        if (!currentPassword) {
          return res.status(400).json({ error: 'Senha atual é obrigatória' });
        }
        const match = await bcrypt.compare(currentPassword, user.password);
        if (!match) return res.status(401).json({ error: 'Senha atual incorreta' });
      }

      user.password = await bcrypt.hash(newPassword, 10);
      user.updatedAt = new Date().toISOString();
      persistState();

      return res.json({ ok: true, message: 'Senha atualizada com sucesso' });
    }

    return res.status(403).json({ error: 'Sem permissão' });
  });

  app.delete(
    '/api/employees/:id',
    authRequired,
    requirePermission('users.delete'),
    async (req: Request, res: Response) => {
      const authUser = getAuthUser(req);
      const userId = req.params.id;

      if (userId === authUser.id) {
        return res.status(400).json({ error: 'Você não pode excluir seu próprio usuário' });
      }

      const idx = users.findIndex((u) => u.id === userId);
      if (idx === -1) return res.status(404).json({ error: 'Usuário não encontrado' });

      users[idx].active = false;
      users[idx].updatedAt = new Date().toISOString();
      persistState();

      return res.json({ ok: true, message: 'Usuário desativado com sucesso' });
    }
  );

  app.get('/api/employees/:id/sessions', authRequired, async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const userId = req.params.id;

    if (authUser.id !== userId && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para ver sessões de outros usuários' });
    }

    const userSessions = sessions.filter((s) => s.userId === userId);

    return res.json({
      items: userSessions.map((s) => ({
        token: s.token.substring(0, 20) + '...',
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        ipAddress: s.ipAddress,
      })),
      total: userSessions.length,
    });
  });

  app.get('/api/roles', authRequired, requirePermission('users.view'), (_req: Request, res: Response) => {
    return res.json([
      { id: 'admin', name: 'Administrador', description: 'Acesso total ao sistema' },
      { id: 'gerente', name: 'Gerente', description: 'Gestão de operações e relatórios' },
      { id: 'operador', name: 'Operador', description: 'Atendimento e vendas' },
      { id: 'inventario', name: 'Inventário', description: 'Gestão de estoque' },
    ]);
  });

  app.get('/api/sessions', authRequired, authorize(['admin']), (_req: Request, res: Response) => {
    const activeSessions = sessions.map((s) => {
      const user = users.find((u) => u.id === s.userId);
      return {
        token: s.token.substring(0, 20) + '...',
        userId: s.userId,
        userName: user?.name || 'Desconhecido',
        userRole: user?.role || 'Desconhecido',
        createdAt: s.createdAt,
        lastActivity: s.lastActivity,
        ipAddress: s.ipAddress,
      };
    });

    return res.json({ items: activeSessions, total: activeSessions.length });
  });

  app.get('/api/suppliers', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const suppliers = await listSuppliers(q);
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(suppliers, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: suppliers, total: suppliers.length });
  });

  app.post('/api/suppliers', async (req: Request, res: Response) => {
    const parsed = validators.supplier.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createSupplier(parsed.data) });
  });

  app.get('/api/finished-products', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const finishedProducts = await listFinishedProducts(q);
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(finishedProducts, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: finishedProducts, total: finishedProducts.length });
  });

  app.post('/api/finished-products', async (req: Request, res: Response) => {
    const parsed = validators.finishedProduct.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createFinishedProduct(parsed.data) });
  });

  app.get('/api/raw-materials', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const rawMaterials = await listRawMaterials(q);
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(rawMaterials, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: rawMaterials, total: rawMaterials.length });
  });

  app.post('/api/raw-materials', async (req: Request, res: Response) => {
    const parsed = validators.rawMaterial.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createRawMaterial(parsed.data) });
  });

  app.get('/api/standard-formulas', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const standardFormulas = await listStandardFormulas(q);
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(standardFormulas, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: standardFormulas, total: standardFormulas.length });
  });

  app.post('/api/standard-formulas', async (req: Request, res: Response) => {
    const parsed = validators.standardFormula.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createStandardFormula(parsed.data) });
  });

  app.get('/api/packaging-formulas', async (req: Request, res: Response) => {
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '') || '';

    // Limitar tamanho da query para evitar abuso
    if (q.length > 100) {
      return res.status(400).json({ error: 'Consulta muito longa' });
    }

    const packagingFormulas = await listPackagingFormulas(q);
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(packagingFormulas, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: packagingFormulas, total: packagingFormulas.length });
  });

  app.post('/api/packaging-formulas', async (req: Request, res: Response) => {
    const parsed = validators.packagingFormula.create.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createPackagingFormula(parsed.data) });
  });

  app.post('/api/shipping/quote', async (req: Request, res: Response) => {
    const parsed = validators.shippingQuote.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const startedAt = Date.now();
    const result = quoteWithFallback(parsed.data);
    trackLatency(operationalMetrics.integrationLatency.shippingQuoteMs, startedAt);
    return res.json({ item: result });
  });

  app.get('/api/medicines', (req: Request, res: Response) => {
    // Usar cache para a lista de medicamentos com proteção contra abuso
    const cacheKey = `medicines-list-${req.query.page || 1}-${req.query.pageSize || 20}`;
    let cachedData = cache.get(cacheKey);

    if (!cachedData) {
      const summary = buildInventorySummary();
      const inventoryMap = new Map(summary.items.map((x: any) => [x.medicineId, x]));
      const items = medicines.map((med) => ({ ...med, inventory: inventoryMap.get(med.id) }));

      cachedData = {
        items,
        base: {
          specialties: [...new Set(medicines.map((m) => m.specialty))],
          labs: [...new Set(medicines.map((m) => m.lab))],
        },
        total: items.length,
      };

      // Armazenar no cache por 2 minutos (menos tempo para dados que podem mudar rapidamente)
      cache.set(cacheKey, cachedData, 120000);
    }

    const pagination = validators.pagination.safeParse(req.query);
    const { items, base, total } = cachedData;

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `W/"meds-${items.length}"`);

    return res.json(
      pagination.success
        ? { ...paginate(items, pagination.data.page, pagination.data.pageSize), ...base }
        : { items, total, ...base }
    );
  });

  app.post('/api/medicines', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = validators.medicine.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newMedicine = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      price: parsed.data.price,
      lab: parsed.data.lab,
      specialty: parsed.data.specialty,
      description: parsed.data.description,
      controlled: parsed.data.controlled,
      image: parsed.data.image || 'https://picsum.photos/seed/med-default/320/220',
    };

    medicines.unshift(newMedicine);
    persistState();
    return res.status(201).json({ item: newMedicine });
  });

  app.patch(
    '/api/medicines/:medicineId',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const medicine = medicines.find((m) => m.id === req.params.medicineId);
      if (!medicine) return res.status(404).json({ error: 'Medicamento não encontrado' });

      const parsed = validators.medicine
        .extend({
          name: z.string().min(3).optional(),
          price: z.coerce.number().positive().optional(),
          lab: z.string().min(2).optional(),
          specialty: z.string().min(2).optional(),
          description: z.string().min(5).max(300).optional(),
          controlled: z.coerce.boolean().optional(),
          image: z.string().url().or(z.string().startsWith('data:image/')).or(z.literal('')).optional(),
        })
        .safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const authUser = getAuthUser(req);
      Object.assign(medicine, parsed.data);
      persistState();

      inventoryMovements.unshift({
        id: crypto.randomUUID(),
        medicineId: medicine.id,
        lotId: '',
        type: 'ajuste',
        quantity: 0,
        reason: 'Medicamento atualizado',
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
      });

      return res.json({ item: medicine });
    }
  );

  app.delete('/api/medicines/:medicineId', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const idx = medicines.findIndex((m) => m.id === req.params.medicineId);
    if (idx === -1) return res.status(404).json({ error: 'Medicamento não encontrado' });

    const [removed] = medicines.splice(idx, 1);
    persistState();

    return res.json({ item: removed });
  });

  app.post('/api/prescriptions/parse', async (req: Request, res: Response) => {
    const parsed = validators.prescription.parse.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = parsePrescriptionToSuggestions(parsed.data.text);
    return res.json(result);
  });

  app.post('/api/prescriptions/parse-document', async (req: Request, res: Response) => {
    const parsed = validators.prescription.document.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const documentResult = extractTextFromDocument(parsed.data.contentBase64, parsed.data.mimeType);
    const result = parsePrescriptionToSuggestions(documentResult.extractedText);

    return res.json({
      ...result,
      extractionMethod: documentResult.extractionMethod,
      warning: documentResult.warning,
      filename: parsed.data.filename,
    });
  });

  app.get('/api/inventory/summary', async (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    const summary = buildInventorySummary();
    return res.json({ ...summary, ...paginate(summary.items, pagination.data.page, pagination.data.pageSize) });
  });

  app.get('/api/inventory/movements', async (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(inventoryMovements, pagination.data.page, pagination.data.pageSize));
  });

  app.post(
    '/api/inventory/lots',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const parsed = validators.inventory.lot.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const authUser = getAuthUser(req);

      const medicine = medicines.find((item) => item.id === parsed.data.medicineId);
      if (!medicine) return res.status(404).json({ error: 'Medicamento não encontrado para o lote' });

      const newLot = createLotEntry({
        medicineId: parsed.data.medicineId,
        batchCode: parsed.data.batchCode,
        expiresAt: parsed.data.expiresAt,
        quantity: parsed.data.quantity,
        unitCost: parsed.data.unitCost,
        supplier: parsed.data.supplier,
        reason: `Entrada de lote ${parsed.data.batchCode}`,
        createdBy: authUser.id,
      });

      persistState();
      return res.status(201).json({ item: newLot });
    }
  );

  app.post(
    '/api/inventory/entries',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const parsed = validators.inventory.entry.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const authUser = getAuthUser(req);

      const medicine = medicines.find((item) => item.id === parsed.data.medicineId);
      if (!medicine) return res.status(404).json({ error: 'Medicamento não encontrado para entrada' });

      const convertedQuantity = Math.max(1, Math.round(parsed.data.sourceQuantity * parsed.data.conversionFactor));
      const lot = createLotEntry({
        medicineId: medicine.id,
        batchCode: parsed.data.batchCode,
        expiresAt: parsed.data.expiresAt,
        quantity: convertedQuantity,
        unitCost: parsed.data.unitCost,
        supplier: parsed.data.supplier,
        reason: `Entrada convertida (${parsed.data.sourceQuantity} ${parsed.data.sourceUnit} => ${convertedQuantity} ${parsed.data.targetUnit})`,
        createdBy: authUser.id,
      });

      persistState();
      return res.status(201).json({ item: lot, convertedQuantity });
    }
  );

  app.post(
    '/api/inventory/entries/nfe-xml',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const parsed = validators.inventory.nfeXml.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
      const authUser = getAuthUser(req);

      const parsedItems = parseNfeItems(parsed.data.xml);
      if (!parsedItems.length) return res.status(400).json({ error: 'Nenhum item identificado no XML NF-e' });

      const createdLots: InventoryLot[] = [];
      const unmatched: string[] = [];

      for (const item of parsedItems) {
        const medicine = medicines.find(
          (m) =>
            m.name.toLowerCase().includes(item.name.toLowerCase()) ||
            item.name.toLowerCase().includes(m.name.toLowerCase())
        );
        if (!medicine) {
          unmatched.push(item.name);
          continue;
        }

        const quantity = Math.max(1, Math.round(item.quantity * parsed.data.conversionFactor));
        const lot = createLotEntry({
          medicineId: medicine.id,
          batchCode: `NFE-${Date.now().toString().slice(-6)}-${medicine.id}`,
          expiresAt: parsed.data.defaultExpiresAt || addDays(new Date().toISOString(), 365),
          quantity,
          unitCost: parsed.data.defaultUnitCost || item.unitPrice || 1,
          supplier: parsed.data.supplier,
          reason: `Entrada por XML NF-e (${item.name})`,
          createdBy: authUser.id,
        });
        createdLots.push(lot);
      }

      persistState();
      return res.status(201).json({ createdLots, unmatched, parsedCount: parsedItems.length });
    }
  );

  app.get('/api/print/labels/:orderId', async (req: Request, res: Response) => {
    const order = orders.find((x) => x.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const labels = order.items.map((item, index) => ({
      labelId: `${order.id}-${index + 1}`,
      patientName: order.patientName,
      medicineName: item.medicineName,
      quantity: item.quantity,
      printedAt: new Date().toISOString(),
    }));
    return res.json({
      items: labels,
      printableText: labels
        .map((x) => `${x.labelId} | ${x.patientName} | ${x.medicineName} | Qtd ${x.quantity}`)
        .join('\n'),
    });
  });

  app.get('/api/quality/reports/:orderId', async (req: Request, res: Response) => {
    const order = orders.find((x) => x.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const report = {
      reportId: `QC-${order.id}`,
      patientName: order.patientName,
      createdAt: new Date().toISOString(),
      controls: order.items.map((item) => ({
        medicineName: item.medicineName,
        lotCount: inventoryLots.filter((lot) => lot.medicineId === item.medicineId).length,
        status: 'aprovado',
      })),
    };
    return res.json({
      item: report,
      printableText:
        `Laudo ${report.reportId}\nPaciente: ${report.patientName}\n` +
        report.controls.map((c) => `${c.medicineName}: ${c.status}`).join('\n'),
    });
  });

  app.post('/api/pricing/auto-update', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const parsed = validators.autoPricing.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const authUser = getAuthUser(req);

    const impacted = medicines
      .filter(
        (m) =>
          (parsed.data.specialty ? m.specialty === parsed.data.specialty : true) &&
          (parsed.data.lab ? m.lab === parsed.data.lab : true)
      )
      .map((m) => {
        const oldPrice = m.price;
        m.price = Number((m.price * (1 + parsed.data.percent / 100)).toFixed(2));
        return { medicineId: m.id, name: m.name, oldPrice, newPrice: m.price };
      });

    for (const item of impacted) {
      inventoryMovements.unshift({
        id: crypto.randomUUID(),
        medicineId: item.medicineId,
        lotId: '',
        type: 'ajuste',
        quantity: 0,
        reason: `${parsed.data.reason} (${parsed.data.percent}%)`,
        createdBy: authUser.id,
        createdAt: new Date().toISOString(),
      });
    }

    persistState();
    return res.json({ updated: impacted.length, items: impacted });
  });

  app.post('/api/budgets', async (req: Request, res: Response) => {
    const parsed = validators.budget.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const smart = parsePrescriptionToSuggestions(parsed.data.prescriptionText);
    const suggestedItems = smart.suggestions.map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.name,
      confidence: item.confidence,
      quantitySuggestion: parsed.data.estimatedDays >= 30 ? 2 : 1,
    }));

    const budget = {
      id: 'ORC-' + crypto.randomUUID().slice(0, 13).toUpperCase(),
      patientName: parsed.data.patientName,
      doctorName: parsed.data.doctorName,
      prescriptionText: parsed.data.prescriptionText,
      suggestedItems,
      status: 'draft' as const,
      createdAt: new Date().toISOString(),
    };

    budgets.unshift(budget);
    return res.status(201).json({ item: budget });
  });

  app.get('/api/budgets', (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(budgets, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: budgets, total: budgets.length });
  });

  app.get('/api/budgets/:budgetId/manipulation-order', async (req: Request, res: Response) => {
    const budget = budgets.find((x) => x.id === req.params.budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const printableText = [
      `Ordem de Manipulação: ${budget.id}`,
      `Paciente: ${budget.patientName}`,
      `Médico: ${budget.doctorName || 'N/I'}`,
      'Itens sugeridos:',
      ...budget.suggestedItems.map((x) => `- ${x.medicineName} (qtd sugerida ${x.quantitySuggestion})`),
    ].join('\n');

    return res.json({ item: budget, printableText });
  });

  app.get('/api/budgets/:budgetId/labels', async (req: Request, res: Response) => {
    const budget = budgets.find((x) => x.id === req.params.budgetId);
    if (!budget) return res.status(404).json({ error: 'Orçamento não encontrado' });

    const labels = budget.suggestedItems.map((item, index) => ({
      labelId: `${budget.id}-LBL-${index + 1}`,
      patientName: budget.patientName,
      medicineName: item.medicineName,
      createdAt: new Date().toISOString(),
    }));

    return res.json({
      items: labels,
      printableText: labels.map((x) => `${x.labelId} | ${x.patientName} | ${x.medicineName}`).join('\n'),
    });
  });

  app.post(
    '/api/scale/readings',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const parsed = validators.scaleReading.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const deviationPercent = Number(
        (
          ((parsed.data.measuredWeightGrams - parsed.data.expectedWeightGrams) / parsed.data.expectedWeightGrams) *
          100
        ).toFixed(2)
      );
      const status: 'ok' | 'alert' = Math.abs(deviationPercent) <= 2 ? 'ok' : 'alert';

      const reading = {
        id: 'BAL-' + crypto.randomUUID().slice(0, 8),
        quoteId: parsed.data.quoteId,
        medicineId: parsed.data.medicineId,
        expectedWeightGrams: parsed.data.expectedWeightGrams,
        measuredWeightGrams: parsed.data.measuredWeightGrams,
        deviationPercent,
        status,
        createdAt: new Date().toISOString(),
      };

      scaleReadings.unshift(reading);
      return res.status(201).json({ item: reading });
    }
  );

  app.post(
    '/api/production/standard-formula',
    authorize(['admin', 'gerente', 'inventario']),
    async (req: Request, res: Response) => {
      const parsed = validators.production.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const formula = (await listStandardFormulas()).find((x: any) => x.id === parsed.data.formulaId);
      if (!formula) return res.status(404).json({ error: 'Fórmula padrão não encontrada' });

      const order = {
        id: 'PROD-' + crypto.randomUUID().slice(0, 8),
        formulaId: formula.id,
        batchSize: parsed.data.batchSize,
        operator: parsed.data.operator,
        status: 'planejada' as const,
        createdAt: new Date().toISOString(),
      };

      productionOrders.unshift(order);
      return res.status(201).json({ item: order, formula });
    }
  );

  app.post('/api/orders', async (req: Request, res: Response) => {
    const parsed = validators.sale.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const authUser = getAuthUser(req);
    const { items, prescriptionCode, recurring, customerId } = parsed.data;
    const customer = customerId ? await getCustomerById(customerId) : undefined;

    if (customer) {
      const doctorExists = await getDoctorById(customer.doctorId);
      const healthPlanExists = await getHealthPlanById(customer.healthPlanId);
      if (!doctorExists || !healthPlanExists) {
        return res.status(400).json({ error: 'Paciente com referência inválida de médico/plano de saúde.' });
      }

      const eligibility = computePatientEligibility(customer.id);
      if (featureFlags.eligibility_guard && !eligibility.canOrderThisMonth) {
        operationalMetrics.eligibilityBlocks += 1;
        return res.status(400).json({
          error: `Paciente já possui entrega realizada na competência atual. Próxima data elegível: ${eligibility.nextEligibleDate}`,
          eligibility,
        });
      }
    }

    const meds = items.map((item) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      if (!med) return null;
      const estimatedRunOutDate = calculateRunOutDate(
        item.quantity,
        item.tabletsPerDay,
        item.tabletsPerPackage,
        item.treatmentDays
      );
      return {
        medicineId: med.id,
        medicineName: med.name,
        quantity: item.quantity,
        unitPrice: med.price,
        subtotal: med.price * item.quantity,
        controlled: med.controlled,
        tabletsPerDay: item.tabletsPerDay,
        tabletsPerPackage: item.tabletsPerPackage,
        treatmentDays: item.treatmentDays,
        estimatedRunOutDate,
      };
    });

    if (meds.some((m) => !m)) return res.status(400).json({ error: 'Um ou mais medicamentos são inválidos' });
    const validMeds = meds.filter(Boolean) as NonNullable<(typeof meds)[number]>[];

    const hasControlled = validMeds.some((m) => m.controlled);
    if (hasControlled && !prescriptionCode)
      return res.status(400).json({ error: 'Receita obrigatória para medicamentos controlados.' });

    for (const item of validMeds) {
      if (availableQuantityByMedicine(item.medicineId) < item.quantity) {
        return res.status(400).json({ error: `Estoque insuficiente para ${item.medicineName}` });
      }
    }

    const totalBruto = validMeds.reduce((acc, item) => acc + item.subtotal, 0);
    const discount = recurring ? totalBruto * (recurring.discountPercent / 100) : 0;
    const total = Number((totalBruto - discount).toFixed(2));

    const orderId = 'P-' + new Date().getFullYear() + '-' + crypto.randomBytes(3).toString('hex').toUpperCase();
    try {
      for (const item of validMeds) {
        reserveStockFefo(item.medicineId, item.quantity, orderId, authUser.id);
      }
    } catch (error: unknown) {
      return res.status(400).json({ error: error instanceof Error ? error.message : 'Falha ao reservar estoque' });
    }

    const treatmentDates = validMeds.map((m) => m.estimatedRunOutDate).filter(Boolean) as string[];
    const estimatedTreatmentEndDate = treatmentDates.length ? treatmentDates.sort()[0] : undefined;
    const nextBillingDate = recurring?.nextBillingDate || estimatedTreatmentEndDate;

    const order: Order = {
      id: orderId,
      patientName: customer?.name || parsed.data.patientName,
      email: customer?.email || parsed.data.email,
      phone: customer?.phone || parsed.data.phone,
      address: customer?.address || parsed.data.address,
      patientId: customer?.id,
      items: validMeds.map(({ controlled: _controlled, ...rest }) => rest),
      total,
      controlledValidated: hasControlled,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
      estimatedTreatmentEndDate,
      recurring:
        recurring && nextBillingDate
          ? { discountPercent: recurring.discountPercent, nextBillingDate, needsConfirmation: true }
          : undefined,
    };

    orders.unshift(order);

    if (customerId) {
      await logPatientActivity(req, {
        patientId: customerId,
        activityType: 'order_created',
        description: `Pedido ${order.id} criado.`,
        metadata: { orderId: order.id, total: order.total },
        performedBy: authUser.id,
      });
    }

    try {
      const shippingStartedAt = Date.now();
      const shipment = createShipmentWithFallback({
        orderId: order.id,
        destinationZip: order.address,
        weightKg: Math.max(
          0.3,
          validMeds.reduce((acc, item) => acc + item.quantity * 0.2, 0)
        ),
        declaredValue: total,
      });

      trackLatency(operationalMetrics.integrationLatency.shippingCreateMs, shippingStartedAt);

      deliveries.unshift({
        orderId: order.id,
        patientName: order.patientName,
        patientId: customer?.id,
        status: 'pendente',
        forecastDate: addDays(new Date().toISOString(), shipment.etaDays),
        carrier: shipment.provider,
        trackingCode: shipment.trackingCode,
        shippingProvider: shipment.provider,
        syncStatus: shipment.syncStatus,
      });

      persistState();
      return res.status(201).json({ order, shipment });
    } catch {
      // Rollback: release reserved stock if post-order operations fail
      for (const item of validMeds) {
        for (const lot of inventoryLots) {
          if (lot.medicineId === item.medicineId && lot.reserved > 0) {
            const toRelease = Math.min(lot.reserved, item.quantity);
            lot.reserved -= toRelease;
            inventoryMovements.unshift({
              id: crypto.randomUUID(),
              medicineId: item.medicineId,
              lotId: lot.id,
              type: 'ajuste',
              quantity: toRelease,
              reason: `Rollback de reserva - falha na criação do pedido ${orderId}`,
              createdBy: authUser.id,
              createdAt: new Date().toISOString(),
            });
          }
        }
      }
      // Remove the partially created order and delivery
      const orderIdx = orders.findIndex((o) => o.id === orderId);
      if (orderIdx !== -1) orders.splice(orderIdx, 1);
      const deliveryIdx = deliveries.findIndex((d) => d.orderId === orderId);
      if (deliveryIdx !== -1) deliveries.splice(deliveryIdx, 1);
      persistState();
      return res.status(500).json({ error: 'Falha ao finalizar pedido. Estoque liberado automaticamente.' });
    }
  });

  app.get('/api/orders', async (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    const recurringOnly = req.query.recurring === 'true';
    const status = req.query.status?.toString();

    let filtered = orders;
    if (recurringOnly) {
      filtered = filtered.filter((o) => o.recurring);
    }
    if (status) {
      filtered = filtered.filter((o) => o.recurring?.needsConfirmation === (status === 'pendente'));
    }

    return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/orders/:orderId', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    const { items, total, estimatedTreatmentEndDate, recurring, address } = req.body;

    if (items !== undefined) order.items = items;
    if (total !== undefined) order.total = total;
    if (estimatedTreatmentEndDate !== undefined) order.estimatedTreatmentEndDate = estimatedTreatmentEndDate;
    if (recurring !== undefined) order.recurring = recurring;
    if (address !== undefined) order.address = address;

    persistState();
    return res.json({ order });
  });

  app.post(
    '/api/orders/:orderId/prescription',
    authorize(['admin', 'gerente']),
    async (req: Request, res: Response) => {
      const order = orders.find((o) => o.id === req.params.orderId);
      if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

      const parsed = validators.prescription.document.safeParse(req.body);
      if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

      const { contentBase64, mimeType, prescriptionText } = parsed.data;

      let extractedText = prescriptionText || '';
      if (contentBase64 && mimeType) {
        const result = extractTextFromDocument(contentBase64, mimeType);
        extractedText = result.extractedText;
      }

      order.prescription = {
        contentBase64,
        mimeType,
        prescriptionText: extractedText,
        uploadedAt: new Date().toISOString(),
      };

      persistState();
      return res.json({ order });
    }
  );

  app.get('/api/orders/:orderId/prescription', async (req: Request, res: Response) => {
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });

    return res.json({ prescription: order.prescription || null });
  });

  app.patch('/api/orders/:orderId/recurring/confirm', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!order.recurring) return res.status(400).json({ error: 'Pedido não possui recorrência ativa' });

    order.recurring.needsConfirmation = false;
    order.recurring.lastConfirmationAt = new Date().toISOString();
    order.recurring.confirmedBy = authUser.id;

    if (req.body.nextBillingDate) {
      order.recurring.nextBillingDate = req.body.nextBillingDate;
    }

    persistState();
    return res.json({ order });
  });

  app.patch('/api/orders/:orderId/recurrence', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!order.recurring) return res.status(400).json({ error: 'Pedido não possui recorrência ativa' });

    const { action, nextBillingDate, days } = req.body;

    if (action === 'confirm') {
      order.recurring.needsConfirmation = false;
      order.recurring.lastConfirmationAt = new Date().toISOString();
      order.recurring.confirmedBy = authUser.id;
      order.recurring.status = 'confirmed';
      if (nextBillingDate) {
        order.recurring.nextBillingDate = nextBillingDate;
      } else {
        const nextDate = new Date();
        nextDate.setMonth(nextDate.getMonth() + 1);
        order.recurring.nextBillingDate = nextDate.toISOString().split('T')[0];
      }
    } else if (action === 'postpone') {
      const postponeDays = days || 7;
      const currentDate = new Date(order.recurring.nextBillingDate);
      currentDate.setDate(currentDate.getDate() + postponeDays);
      order.recurring.nextBillingDate = currentDate.toISOString().split('T')[0];
      order.recurring.status = 'postponed';
    } else if (action === 'cancel') {
      order.recurring.needsConfirmation = true;
      order.recurring.status = 'canceled';
    } else if (action === 'reactivate') {
      order.recurring.needsConfirmation = true;
      order.recurring.status = undefined;
    }

    persistState();
    return res.json({ order });
  });

  app.get('/api/deliveries', async (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    const status = req.query.status?.toString() as DeliveryStatus | undefined;
    // Sanitizar a query para evitar injeção
    const q = req.query.q?.toString()?.replace(/[<>]/g, '').toLowerCase() || '';
    let filtered = deliveries;
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (q)
      filtered = filtered.filter((d) => d.orderId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q));

    return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/deliveries/:orderId', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const parsed = validators.deliveryUpdate.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = deliveries.find((d) => d.orderId === req.params.orderId);
    if (!target) return res.status(404).json({ error: 'Entrega não encontrada' });

    // Validate state machine transition
    if (parsed.data.status && parsed.data.status !== target.status) {
      if (!isValidDeliveryTransition(target.status, parsed.data.status)) {
        const validTransitions: Record<string, string> = {
          pendente: '"em_rota" ou "falhou"',
          em_rota: '"entregue" ou "falhou"',
          falhou: '"em_rota" (tentar novamente)',
          entregue: 'nenhuma (entrega finalizada)',
        };
        return res.status(400).json({
          error: `Transição inválida: de "${target.status}" para "${parsed.data.status}". Transições válidas: ${validTransitions[target.status] || 'nenhuma'}`,
        });
      }
    }

    Object.assign(target, parsed.data);
    if (parsed.data.status === 'entregue' && !parsed.data.forecastDate) {
      target.forecastDate = new Date().toISOString().slice(0, 10);
    }

    const order = orders.find((o) => o.id === target.orderId);
    const linkedPatient = order
      ? (await listCustomers()).find((c: any) => c.name === order.patientName && c.email === order.email)
      : undefined;
    if (linkedPatient) {
      const authUser = getAuthUser(req);
      await logPatientActivity(req, {
        patientId: linkedPatient.id,
        activityType: 'delivery_updated',
        description: `Entrega ${target.orderId} atualizada para status ${target.status}.`,
        metadata: { orderId: target.orderId, status: target.status },
        performedBy: authUser.id,
      });
    }

    persistState();
    return res.json({ item: target });
  });

  app.get('/api/tickets', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    let items = tickets;

    if (authUser.role === 'operador') {
      items = tickets.filter((t) => t.assignedTo === authUser.name);
    }

    const pagination = validators.pagination.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(items, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items, total: items.length });
  });

  app.get('/api/tickets/:userId', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    if (authUser.role === 'operador' && authUser.id !== req.params.userId)
      return res.status(403).json({ error: 'Sem permissão para visualizar tickets de outro usuário' });

    const items = tickets.filter((t) => t.assignedTo === req.params.userId);
    return res.json({ items });
  });

  app.patch('/api/tickets/:ticketId', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const ticket = tickets.find((t) => t.id === req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const { status, action, notes } = req.body;

    if (action) {
      if (action === 'attend') {
        ticket.status = 'em_atendimento';
        ticket.assignedTo = authUser.name;
        ticket.updatedAt = new Date().toISOString();
        if (!ticket.history) ticket.history = [];
        ticket.history.push({
          type: 'status_change',
          from: 'aberto',
          to: 'em_atendimento',
          by: authUser.name,
          at: new Date().toISOString(),
          note: 'Ticket iniciado pelo operador',
        });
      } else if (action === 'resolve') {
        ticket.status = 'fechado';
        ticket.updatedAt = new Date().toISOString();
        if (!ticket.history) ticket.history = [];
        ticket.history.push({
          type: 'status_change',
          from: 'em_atendimento',
          to: 'fechado',
          by: authUser.name,
          at: new Date().toISOString(),
          note: notes || 'Ticket resolvido',
        });
      } else if (action === 'reopen') {
        ticket.status = 'aberto';
        ticket.updatedAt = new Date().toISOString();
        if (!ticket.history) ticket.history = [];
        ticket.history.push({
          type: 'status_change',
          from: 'fechado',
          to: 'aberto',
          by: authUser.name,
          at: new Date().toISOString(),
          note: notes || 'Ticket reaberto',
        });
      } else if (action === 'add_note') {
        if (!ticket.history) ticket.history = [];
        ticket.history.push({
          type: 'note',
          by: authUser.name,
          at: new Date().toISOString(),
          note: notes || '',
        });
      }
    }

    if (status) {
      ticket.status = status;
      ticket.updatedAt = new Date().toISOString();
    }

    persistState();
    return res.json({ item: ticket });
  });

  app.post('/api/tickets/:ticketId/contact', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const ticket = tickets.find((t) => t.id === req.params.ticketId);
    if (!ticket) return res.status(404).json({ error: 'Ticket não encontrado' });

    const { type, message, subject } = req.body;
    if (!type || !message) return res.status(400).json({ error: 'Tipo e mensagem são obrigatórios' });

    if (!ticket.history) ticket.history = [];
    ticket.history.push({
      type: 'contact',
      channel: type,
      subject: subject || ticket.subject,
      message,
      by: authUser.name,
      at: new Date().toISOString(),
      status: 'sent',
    });

    persistState();
    return res.json({
      item: ticket,
      result: {
        success: true,
        channel: type,
        message: `Contato enviado com sucesso via ${type === 'chat' ? 'chat' : 'e-mail'}`,
        timestamp: new Date().toISOString(),
      },
    });
  });

  app.get('/api/dashboard/:role?', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const totalSales = orders.reduce((acc, order) => acc + order.total, 0);
    const reminders = buildRecurringReminders(orders);
    const summary = buildInventorySummary();

    return res.json({
      role: authUser.role,
      indicators: {
        pedidos: orders.length,
        entregasPendentes: deliveries.filter((d) => d.status !== 'entregue').length,
        ticketsAbertos: tickets.filter((t) => t.status !== 'fechado').length,
        totalSales,
        estoqueCritico: summary.critical,
        lotesProximosVencimento: summary.nearExpiry,
      },
      reminders,
    });
  });

  // Notifications endpoints
  app.get('/api/notifications', (req: Request, res: Response) => {
    const pagination = validators.pagination.safeParse(req.query);
    const page = pagination.success ? pagination.data.page : 1;
    const pageSize = pagination.success ? pagination.data.pageSize : 50;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginated = notifications.slice(start, end);
    return res.json({ items: paginated, total: notifications.length });
  });

  app.post('/api/notifications', (req: Request, res: Response) => {
    const { type, title, message, link, category } = req.body;
    const newNotification = {
      id: `notif-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type: type || 'info',
      title,
      message,
      read: false,
      createdAt: new Date().toISOString(),
      link,
      category,
    };
    notifications.unshift(newNotification);
    persistState();
    return res.status(201).json({ item: newNotification });
  });

  app.patch('/api/notifications/:id/read', (req: Request, res: Response) => {
    const notification = notifications.find((n) => n.id === req.params.id);
    if (!notification) return res.status(404).json({ error: 'Notificação não encontrada' });
    notification.read = true;
    persistState();
    return res.json({ item: notification });
  });

  app.patch('/api/notifications/read-all', (req: Request, res: Response) => {
    notifications.forEach((n) => (n.read = true));
    persistState();
    return res.json({ success: true });
  });

  app.delete('/api/notifications/:id', (req: Request, res: Response) => {
    const idx = notifications.findIndex((n) => n.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'Notificação não encontrada' });
    notifications.splice(idx, 1);
    persistState();
    return res.json({ success: true });
  });

  app.delete('/api/notifications', (req: Request, res: Response) => {
    notifications.length = 0;
    persistState();
    return res.json({ success: true });
  });

  app.use(express.static(publicDir));
  app.get('*', (_: Request, res: Response) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use(errorHandler);

  return app;
}
