import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import express, { type NextFunction, type Request, type Response } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import {
  deliveries,
  inventoryLots,
  inventoryMovements,
  medicines,
  orders,
  tickets,
  users,
  type DeliveryStatus,
  type InventoryLot,
  type Order,
  type User
} from './data.js';
import { loadPersistentState, persistState } from './store.js';
import { createCustomer, createDoctor, createEmployee, createFinishedProduct, createHealthPlan, createPackagingFormula, createPatientActivity, createRawMaterial, createStandardFormula, createSupplier, getCustomerById, getDoctorById, getHealthPlanById, initDatabase, listCustomers, listDoctors, listEmployees, listFinishedProducts, listHealthPlans, listPackagingFormulas, listPatientActivities, listRawMaterials, listStandardFormulas, listSuppliers, updateCustomer, updateDoctor, updateHealthPlan } from './database.js';
import { createShipmentWithFallback, quoteWithFallback } from './shipping.js';
import { dialerProvider, emailProvider, executeWithRetries } from './communications.js';
import { getFeatureFlags } from './featureFlags.js';
import { computePatientEligibility, calculateRunOutDate, parsePrescriptionToSuggestions, buildRecurringReminders, reserveStockFefo, buildInventorySummary, addDays, availableQuantityByMedicine, extractTextFromDocument } from './biz-logic.js';
import { authRequired, authorize, getAuthUser, JWT_SECRET as moduleJWT_SECRET } from './middlewares/auth.js';
import { loginRateLimiter } from './middlewares/rateLimit.js';
import { requestIdMiddleware } from './middlewares/requestId.js';
import { isValidDeliveryTransition } from './middlewares/deliveryStateMachine.js';
import { parseXml } from '@rgrove/parse-xml';
import helmet from 'helmet';
import cors from 'cors';
import { requestLogger } from './middlewares/logger.js';

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
    shippingCreateMs: [] as number[]
  }
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
  const candidates = [path.resolve(process.cwd(), 'public'), path.resolve(__dirname, '../public'), path.resolve(__dirname, '../../public')];
  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (!found) throw new Error('Diretório public não encontrado. Gere os assets ou valide o ambiente de execução.');
  return found;
}

const saleSchema = z.object({
  patientName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
  customerId: z.string().optional(),
  items: z.array(
    z.object({
      medicineId: z.string(),
      quantity: z.number().int().positive(),
      tabletsPerDay: z.number().positive().optional(),
      tabletsPerPackage: z.number().int().positive().optional(),
      treatmentDays: z.number().int().positive().optional()
    })
  ).min(1),
  prescriptionCode: z.string().optional(),
  recurring: z.object({ discountPercent: z.number().min(0).max(100), nextBillingDate: z.string().optional() }).optional()
});

const deliveryUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_rota', 'entregue']).optional(),
  forecastDate: z.string().optional(),
  carrier: z.string().optional(),
  trackingCode: z.string().optional(),
  shippingProvider: z.string().optional(),
  syncStatus: z.enum(['ok', 'fallback', 'queued_retry']).optional()
});

const inventoryLotSchema = z.object({
  medicineId: z.string(),
  batchCode: z.string().min(3),
  expiresAt: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive(),
  supplier: z.string().min(2)
});

const loginSchema = z.object({ employeeCode: z.string(), password: z.string() });
const paginationSchema = z.object({ page: z.coerce.number().int().min(1).default(1), pageSize: z.coerce.number().int().min(1).max(100).default(20) });
const prescriptionParseSchema = z.object({
  text: z.string().min(8).max(6000)
});

const prescriptionDocumentSchema = z.object({
  filename: z.string().min(3),
  mimeType: z.string().min(3),
  contentBase64: z.string().min(16)
});


const patientContactSchema = z.object({
  type: z.enum(['call', 'email']),
  subject: z.string().min(2).optional(),
  message: z.string().min(2).optional(),
  metadata: z.record(z.unknown()).optional()
});

const shippingQuoteSchema = z.object({
  destinationZip: z.string().optional(),
  weightKg: z.coerce.number().positive().default(0.3),
  declaredValue: z.coerce.number().nonnegative().default(0)
});

const customerCreateSchema = z.object({
  name: z.string().min(2),
  patientCode: z.string().min(2),
  insuranceCardCode: z.string().min(2),
  healthPlanId: z.string().min(2),
  doctorId: z.string().min(2),
  insurancePlanName: z.string().min(2).optional(),
  insuranceProviderName: z.string().min(2).optional(),
  diseaseCid: z.string().min(2),
  primaryDoctorId: z.string().min(2).optional(),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5)
});

const customerUpdateSchema = customerCreateSchema.partial();

const doctorCreateSchema = z.object({
  name: z.string().min(2),
  crm: z.string().min(4),
  specialty: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8)
});

const doctorUpdateSchema = doctorCreateSchema.partial();

const healthPlanCreateSchema = z.object({
  name: z.string().min(2),
  providerName: z.string().min(2),
  registrationCode: z.string().min(3)
});

const healthPlanUpdateSchema = healthPlanCreateSchema.partial();


const employeeCreateSchema = z.object({
  name: z.string().min(2),
  role: z.string().min(2),
  employeeCode: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(8)
});

const supplierCreateSchema = z.object({
  name: z.string().min(2),
  document: z.string().min(5),
  email: z.string().email(),
  phone: z.string().min(8),
  category: z.string().min(2)
});

const finishedProductCreateSchema = z.object({
  name: z.string().min(2),
  productType: z.enum(['acabado', 'revenda']),
  sku: z.string().min(3),
  unit: z.string().min(1),
  price: z.coerce.number().positive()
});

const rawMaterialCreateSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(3),
  unit: z.string().min(1),
  cost: z.coerce.number().positive()
});

const standardFormulaCreateSchema = z.object({
  name: z.string().min(2),
  version: z.string().min(1),
  productId: z.string().min(2),
  instructions: z.string().min(5)
});

const packagingFormulaCreateSchema = z.object({
  name: z.string().min(2),
  productId: z.string().min(2),
  packagingType: z.string().min(2),
  unitsPerPackage: z.coerce.number().int().positive(),
  notes: z.string().min(2)
});


const inventoryEntrySchema = z.object({
  medicineId: z.string(),
  batchCode: z.string().min(3),
  expiresAt: z.string(),
  supplier: z.string().min(2),
  sourceUnit: z.string().min(1),
  targetUnit: z.string().min(1),
  sourceQuantity: z.coerce.number().positive(),
  conversionFactor: z.coerce.number().positive(),
  unitCost: z.coerce.number().positive()
});

const inventoryNfeXmlSchema = z.object({
  xml: z.string().min(20),
  supplier: z.string().min(2),
  defaultExpiresAt: z.string().optional(),
  defaultUnitCost: z.coerce.number().positive().optional(),
  conversionFactor: z.coerce.number().positive().default(1)
});


const budgetCreateSchema = z.object({
  patientName: z.string().min(2),
  doctorName: z.string().min(2).optional(),
  prescriptionText: z.string().min(8),
  estimatedDays: z.coerce.number().int().positive().default(30)
});

const scaleReadingSchema = z.object({
  quoteId: z.string(),
  medicineId: z.string(),
  expectedWeightGrams: z.coerce.number().positive(),
  measuredWeightGrams: z.coerce.number().positive()
});

const standardProductionSchema = z.object({
  formulaId: z.string(),
  batchSize: z.coerce.number().int().positive(),
  operator: z.string().min(2)
});
const autoPricingSchema = z.object({
  percent: z.coerce.number().min(-50).max(200),
  specialty: z.string().optional(),
  lab: z.string().optional(),
  reason: z.string().min(3).default('Atualização automática de lista de preço')
});

const medicineCreateSchema = z.object({
  name: z.string().min(3),
  price: z.coerce.number().positive(),
  lab: z.string().min(2),
  specialty: z.string().min(2),
  description: z.string().min(5).max(300),
  controlled: z.coerce.boolean().default(false),
  image: z.string().url().or(z.string().startsWith('data:image/')).or(z.literal('')).default('')
});

type Session = { user: Omit<User, 'password'>; expiresAt: number };
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
const JWT_SECRET = moduleJWT_SECRET;

const budgets: Array<{ id: string; patientName: string; doctorName?: string; prescriptionText: string; suggestedItems: Array<{ medicineId: string; medicineName: string; confidence: number; quantitySuggestion: number }>; status: 'draft' | 'approved'; createdAt: string }> = [];
const scaleReadings: Array<{ id: string; quoteId: string; medicineId: string; expectedWeightGrams: number; measuredWeightGrams: number; deviationPercent: number; status: 'ok' | 'alert'; createdAt: string }> = [];
const productionOrders: Array<{ id: string; formulaId: string; batchSize: number; operator: string; status: 'planejada' | 'em_producao' | 'concluida'; createdAt: string }> = [];

function paginate<T>(items: T[], page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: items.slice(start, end),
    page,
    pageSize,
    total: items.length,
    totalPages: Math.max(1, Math.ceil(items.length / pageSize))
  };
}

function createLotEntry(input: { medicineId: string; batchCode: string; expiresAt: string; quantity: number; unitCost: number; supplier: string; reason: string; createdBy: string; }) {
  const newLot: InventoryLot = {
    id: crypto.randomUUID(),
    medicineId: input.medicineId,
    batchCode: input.batchCode,
    expiresAt: input.expiresAt,
    quantity: input.quantity,
    reserved: 0,
    unitCost: input.unitCost,
    supplier: input.supplier,
    createdAt: new Date().toISOString()
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
    createdAt: new Date().toISOString()
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
            .flatMap((inf: any) => inf.children
              .filter((n: any): n is any => n.type === 'Element' && n.name === 'det'));
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
          unitPrice: unitPrice ? Number(unitPrice) : undefined
        });
      }
    }
  } catch {
    // Fallback to regex if XML parsing fails
    const detRegex = /<det[\s\S]*?<\/det>/g;
    const matches = xml.match(detRegex) || [];
    for (const block of matches) {
      const n = (block.match(/<xProd>([^<]+)<\/xProd>/)?.[1] || '').trim();
      const q = Number((block.match(/<qCom>([^<]+)<\/qCom>/)?.[1] || '0').replace(',', '.'));
      const u = (block.match(/<vUnCom>([^<]+)<\/vUnCom>/)?.[1] || '').replace(',', '.');
      if (n && q > 0) items.push({ name: n, quantity: q, unitPrice: u ? Number(u) : undefined });
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
  app.use(cors({
    origin: (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:3000').split(','),
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
  }));

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
      checks
    });
  });

  app.post('/api/login', loginRateLimiter, async (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido' });

    const employeeCodeNormalized = parsed.data.employeeCode.trim().toUpperCase();
    const passwordNormalized = parsed.data.password.trim();

    const user = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCodeNormalized);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const passwordMatch = await bcrypt.compare(passwordNormalized, user.password);
    if (!passwordMatch) return res.status(401).json({ error: 'Credenciais inválidas' });

    const safeUser = { id: user.id, name: user.name, role: user.role, employeeCode: user.employeeCode };
    const token = jwt.sign(safeUser, JWT_SECRET, { expiresIn: '8h' });

    return res.json({ token, expiresInMs: SESSION_TTL_MS, user: safeUser });
  });

  app.post('/api/logout', authRequired, async (req: Request, res: Response) => {
    const authHeader = req.header('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) sessions.delete(token);
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
        shippingCreateAvgMs: avgMs(operationalMetrics.integrationLatency.shippingCreateMs)
      }
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

  async function logPatientActivity(input: { patientId: string; activityType: string; description: string; metadata?: Record<string, unknown>; performedBy?: string }) {
    await createPatientActivity({
      patientId: input.patientId,
      activityType: input.activityType,
      description: input.description,
      metadataJson: JSON.stringify(input.metadata || {}),
      performedBy: input.performedBy || 'system'
    });
  }

  // NOTE: /api/customers is the legacy patient endpoint. /api/patients (gated by
  // featureFlags.patients_v2) is the v2 replacement. Both are kept in parallel until
  // the legacy endpoint is fully retired per roadmap. Do not remove /api/customers yet.
  app.get('/api/customers', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = await listCustomers(q);
    const pagination = paginationSchema.safeParse(req.query);
    const paginated = pagination.success ? paginate(items, pagination.data.page, pagination.data.pageSize) : { items, total: items.length };
    return res.json({ ...paginated, legacy: true, patientsV2Enabled: featureFlags.patients_v2 });
  });

  app.post('/api/customers', async (req: Request, res: Response) => {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await createCustomer(parsed.data);
    const authUser = getAuthUser(req);
    await logPatientActivity({ patientId: item.id, activityType: 'patient_created', description: 'Cadastro de paciente criado.', metadata: { source: 'customers' }, performedBy: authUser.id });
    return res.status(201).json({ item });
  });

  app.get('/api/customers/:customerId', async (req: Request, res: Response) => {
    const item = await getCustomerById(req.params.customerId);
    if (!item) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/customers/:customerId', async (req: Request, res: Response) => {
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await updateCustomer(req.params.customerId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Cliente não encontrado' });
    const authUser = getAuthUser(req);
    await logPatientActivity({ patientId: item.id, activityType: 'patient_updated', description: 'Cadastro de paciente atualizado.', metadata: { source: 'customers' }, performedBy: authUser.id });
    return res.json({ item });
  });


  app.get('/api/patients', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const q = req.query.q?.toString();
    const items = await listCustomers(q);
    return res.json({ items });
  });

  app.post('/api/patients', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await createCustomer(parsed.data);
    const authUser = getAuthUser(req);
    await logPatientActivity({ patientId: item.id, activityType: 'patient_created', description: 'Cadastro de paciente criado.', metadata: { source: 'patients' }, performedBy: authUser.id });
    return res.status(201).json({ item });
  });

  app.patch('/api/patients/:patientId', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = await validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = await updateCustomer(req.params.patientId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    const authUser = getAuthUser(req);
    await logPatientActivity({ patientId: item.id, activityType: 'patient_updated', description: 'Cadastro de paciente atualizado.', metadata: { source: 'patients' }, performedBy: authUser.id });
    return res.json({ item });
  });


  app.get('/api/patients/:patientId', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const item = await getCustomerById(req.params.patientId);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    return res.json({ item });
  });




  app.get('/api/patients/:patientId/activities', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const patient = await getCustomerById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    return res.json(await listPatientActivities(req.params.patientId, pagination.data.page, pagination.data.pageSize));
  });




  app.get('/api/patients/:patientId/eligibility', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    const patient = await getCustomerById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const eligibility = computePatientEligibility(patient.id);
    return res.json(eligibility);
  });



  app.post('/api/patients/:patientId/contact', async (req: Request, res: Response) => {
    if (!featureFlags.patients_v2) return res.status(503).json({ error: 'Módulo patients_v2 desabilitado por feature flag.' });
    if (!featureFlags.communications) return res.status(503).json({ error: 'Módulo communications desabilitado por feature flag.' });
    const patient = await getCustomerById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const parsed = patientContactSchema.safeParse(req.body);
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
      metadata: parsed.data.metadata
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
      await logPatientActivity({
            patientId: patient.id,
            activityType: `contact_attempt_${parsed.data.type}`,
            description: `Tentativa ${attempt} de contato (${parsed.data.type}) falhou: ${error.message}`,
            metadata: { attempt, type: parsed.data.type, destination },
            performedBy: authUser.id
          });
        }
      }
    );

    if (parsed.data.type === 'call') trackLatency(operationalMetrics.integrationLatency.dialerMs, startedAt);
    else trackLatency(operationalMetrics.integrationLatency.emailMs, startedAt);

    if (!result.ok) {
      await logPatientActivity({
        patientId: patient.id,
        activityType: `contact_failed_${parsed.data.type}`,
        description: `Contato ${parsed.data.type} falhou após ${result.attempt} tentativa(s).`,
        metadata: { attempts: result.attempt, type: parsed.data.type, destination },
        performedBy: authUser.id
      });
      return res.status(502).json({ error: 'Falha ao processar contato com paciente', attempts: result.attempt });
    }

    await logPatientActivity({
      patientId: patient.id,
      activityType: `contact_success_${parsed.data.type}`,
      description: `Contato ${parsed.data.type} enviado com sucesso para ${destination}.`,
      metadata: { attempts: result.attempt, type: parsed.data.type, destination, provider: result.result.provider, externalId: result.result.externalId },
      performedBy: authUser.id
    });

    return res.json({ ok: true, attempts: result.attempt, item: result.result });
  });


  app.get('/api/health-plans', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = await listHealthPlans(q);
    const pagination = paginationSchema.safeParse(req.query);
    return res.json(pagination.success ? paginate(items, pagination.data.page, pagination.data.pageSize) : { items, total: items.length });
  });

  app.post('/api/health-plans', async (req: Request, res: Response) => {
    const parsed = healthPlanCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = await createHealthPlan(parsed.data);
    return res.status(201).json({ item });
  });

  app.patch('/api/health-plans/:healthPlanId', async (req: Request, res: Response) => {
    const parsed = healthPlanUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = await updateHealthPlan(req.params.healthPlanId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Plano de saúde não encontrado' });
    return res.json({ item });
  });

  app.get('/api/doctors', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = await listDoctors(q);
    const pagination = paginationSchema.safeParse(req.query);
    return res.json(pagination.success ? paginate(items, pagination.data.page, pagination.data.pageSize) : { items, total: items.length });
  });

  app.post('/api/doctors', async (req: Request, res: Response) => {
    const parsed = doctorCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = await createDoctor(parsed.data);
    return res.status(201).json({ item });
  });

  app.get('/api/doctors/:doctorId', async (req: Request, res: Response) => {
    const item = await getDoctorById(req.params.doctorId);
    if (!item) return res.status(404).json({ error: 'Médico não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/doctors/:doctorId', async (req: Request, res: Response) => {
    const parsed = doctorUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = await updateDoctor(req.params.doctorId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Médico não encontrado' });
    return res.json({ item });
  });


  app.get('/api/employees', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const employees = await listEmployees(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(employees, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: employees, total: employees.length });
  });

  app.post('/api/employees', async (req: Request, res: Response) => {
    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createEmployee(parsed.data) });
  });

  const employeePasswordSchema = z.object({ currentPassword: z.string(), newPassword: z.string().min(6) });
  const employeeUpdatePrismaSchema = employeeCreateSchema.partial().merge(z.object({ role: z.string().min(2) }).partial());

  app.put('/api/employees/:employeeCode/password', authRequired, async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const targetCode = req.params.employeeCode.toUpperCase();

    // Only allow changing own password, or allow admin
    if (authUser.employeeCode.toUpperCase() !== targetCode && authUser.role !== 'admin') {
      return res.status(403).json({ error: 'Sem permissão para alterar esta senha' });
    }

    const parsed = employeePasswordSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = users.find((u) => u.employeeCode.trim().toUpperCase() === targetCode);
    if (!target) return res.status(404).json({ error: 'Colaborador não encontrado' });

    const match = await bcrypt.compare(parsed.data.currentPassword, target.password);
    if (!match) return res.status(401).json({ error: 'Senha atual incorreta' });

    target.password = await bcrypt.hash(parsed.data.newPassword, 10);
    persistState();
    return res.json({ ok: true, message: 'Senha atualizada com sucesso' });
  });

  app.patch('/api/employees/:employeeId', authRequired, authorize(['admin']), async (req: Request, res: Response) => {
    const parsed = employeeUpdatePrismaSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { Prisma } = await import('@prisma/client');
    const db = (await import('./database.js')).prisma();
    const data: Prisma.EmployeeUpdateInput = {};
    if (parsed.data.name) data.name = parsed.data.name;
    if (parsed.data.role) data.role = parsed.data.role;
    if (parsed.data.email) data.email = parsed.data.email;
    if (parsed.data.phone) data.phone = parsed.data.phone;
    if (parsed.data.employeeCode) data.employeeCode = parsed.data.employeeCode;

    return res.json({ item: await db.employee.update({ where: { id: req.params.employeeId }, data }) });
  });

  app.get('/api/suppliers', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const suppliers = await listSuppliers(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(suppliers, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: suppliers, total: suppliers.length });
  });

  app.post('/api/suppliers', async (req: Request, res: Response) => {
    const parsed = supplierCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createSupplier(parsed.data) });
  });

  app.get('/api/finished-products', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const finishedProducts = await listFinishedProducts(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(finishedProducts, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: finishedProducts, total: finishedProducts.length });
  });

  app.post('/api/finished-products', async (req: Request, res: Response) => {
    const parsed = finishedProductCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createFinishedProduct(parsed.data) });
  });

  app.get('/api/raw-materials', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const rawMaterials = await listRawMaterials(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(rawMaterials, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: rawMaterials, total: rawMaterials.length });
  });

  app.post('/api/raw-materials', async (req: Request, res: Response) => {
    const parsed = rawMaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createRawMaterial(parsed.data) });
  });

  app.get('/api/standard-formulas', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const standardFormulas = await listStandardFormulas(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(standardFormulas, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: standardFormulas, total: standardFormulas.length });
  });

  app.post('/api/standard-formulas', async (req: Request, res: Response) => {
    const parsed = standardFormulaCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createStandardFormula(parsed.data) });
  });

  app.get('/api/packaging-formulas', async (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const packagingFormulas = await listPackagingFormulas(q);
    const pagination = paginationSchema.safeParse(req.query);
    if (pagination.success) {
      return res.json(paginate(packagingFormulas, pagination.data.page, pagination.data.pageSize));
    }
    return res.json({ items: packagingFormulas, total: packagingFormulas.length });
  });

  app.post('/api/packaging-formulas', async (req: Request, res: Response) => {
    const parsed = packagingFormulaCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: await createPackagingFormula(parsed.data) });
  });

  app.post('/api/shipping/quote', async (req: Request, res: Response) => {
    const parsed = shippingQuoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const startedAt = Date.now();
    const result = quoteWithFallback(parsed.data);
    trackLatency(operationalMetrics.integrationLatency.shippingQuoteMs, startedAt);
    return res.json({ item: result });
  });

  app.get('/api/medicines', (req: Request, res: Response) => {
    const summary = buildInventorySummary();
    const inventoryMap = new Map(summary.items.map((x) => [x.medicineId, x]));
    const items = medicines.map((med) => ({ ...med, inventory: inventoryMap.get(med.id) }));

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `W/"meds-${items.length}"`);

    const pagination = paginationSchema.safeParse(req.query);
    const base = { specialties: [...new Set(medicines.map((m) => m.specialty))], labs: [...new Set(medicines.map((m) => m.lab))] };
    return res.json(pagination.success ? { ...paginate(items, pagination.data.page, pagination.data.pageSize), ...base } : { items, total: items.length, ...base });
  });

  app.post('/api/medicines', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = medicineCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newMedicine = {
      id: crypto.randomUUID(),
      name: parsed.data.name,
      price: parsed.data.price,
      lab: parsed.data.lab,
      specialty: parsed.data.specialty,
      description: parsed.data.description,
      controlled: parsed.data.controlled,
      image: parsed.data.image || 'https://picsum.photos/seed/med-default/320/220'
    };

    medicines.unshift(newMedicine);
    persistState();
    return res.status(201).json({ item: newMedicine });
  });

  app.patch('/api/medicines/:medicineId', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const medicine = medicines.find((m) => m.id === req.params.medicineId);
    if (!medicine) return res.status(404).json({ error: 'Medicamento não encontrado' });

    const parsed = medicineCreateSchema.partial().safeParse(req.body);
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
      createdAt: new Date().toISOString()
    });

    return res.json({ item: medicine });
  });

  app.delete('/api/medicines/:medicineId', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const idx = medicines.findIndex((m) => m.id === req.params.medicineId);
    if (idx === -1) return res.status(404).json({ error: 'Medicamento não encontrado' });

    const authUser = getAuthUser(req);
    const [removed] = medicines.splice(idx, 1);
    persistState();

    return res.json({ item: removed });
  });


  app.post('/api/prescriptions/parse', async (req: Request, res: Response) => {
    const parsed = prescriptionParseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = parsePrescriptionToSuggestions(parsed.data.text);
    return res.json(result);
  });

  app.post('/api/prescriptions/parse-document', async (req: Request, res: Response) => {
    const parsed = prescriptionDocumentSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const documentResult = extractTextFromDocument(parsed.data.contentBase64, parsed.data.mimeType);
    const result = parsePrescriptionToSuggestions(documentResult.extractedText);

    return res.json({
      ...result,
      extractionMethod: documentResult.extractionMethod,
      warning: documentResult.warning,
      filename: parsed.data.filename
    });
  });

  app.get('/api/inventory/summary', async (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    const summary = buildInventorySummary();
    return res.json({ ...summary, ...paginate(summary.items, pagination.data.page, pagination.data.pageSize) });
  });

  app.get('/api/inventory/movements', async (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(inventoryMovements, pagination.data.page, pagination.data.pageSize));
  });

  app.post('/api/inventory/lots', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = inventoryLotSchema.safeParse(req.body);
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
      createdBy: authUser.id
    });

    persistState();
    return res.status(201).json({ item: newLot });
  });


  app.post('/api/inventory/entries', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = inventoryEntrySchema.safeParse(req.body);
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
      createdBy: authUser.id
    });

    persistState();
    return res.status(201).json({ item: lot, convertedQuantity });
  });

  app.post('/api/inventory/entries/nfe-xml', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = inventoryNfeXmlSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const authUser = getAuthUser(req);

    const parsedItems = parseNfeItems(parsed.data.xml);
    if (!parsedItems.length) return res.status(400).json({ error: 'Nenhum item identificado no XML NF-e' });

    const createdLots: InventoryLot[] = [];
    const unmatched: string[] = [];

    for (const item of parsedItems) {
      const medicine = medicines.find((m) => m.name.toLowerCase().includes(item.name.toLowerCase()) || item.name.toLowerCase().includes(m.name.toLowerCase()));
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
        createdBy: authUser.id
      });
      createdLots.push(lot);
    }

    persistState();
    return res.status(201).json({ createdLots, unmatched, parsedCount: parsedItems.length });
  });

  app.get('/api/print/labels/:orderId', async (req: Request, res: Response) => {
    const order = orders.find((x) => x.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const labels = order.items.map((item, index) => ({
      labelId: `${order.id}-${index + 1}`,
      patientName: order.patientName,
      medicineName: item.medicineName,
      quantity: item.quantity,
      printedAt: new Date().toISOString()
    }));
    return res.json({ items: labels, printableText: labels.map((x) => `${x.labelId} | ${x.patientName} | ${x.medicineName} | Qtd ${x.quantity}`).join('\n') });
  });

  app.get('/api/quality/reports/:orderId', async (req: Request, res: Response) => {
    const order = orders.find((x) => x.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    const report = {
      reportId: `QC-${order.id}`,
      patientName: order.patientName,
      createdAt: new Date().toISOString(),
      controls: order.items.map((item) => ({ medicineName: item.medicineName, lotCount: inventoryLots.filter((lot) => lot.medicineId === item.medicineId).length, status: 'aprovado' }))
    };
    return res.json({ item: report, printableText: `Laudo ${report.reportId}\nPaciente: ${report.patientName}\n` + report.controls.map((c) => `${c.medicineName}: ${c.status}`).join('\n') });
  });

  app.post('/api/pricing/auto-update', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const parsed = autoPricingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    const authUser = getAuthUser(req);

    const impacted = medicines
      .filter((m) => (parsed.data.specialty ? m.specialty === parsed.data.specialty : true) && (parsed.data.lab ? m.lab === parsed.data.lab : true))
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
        createdAt: new Date().toISOString()
      });
    }

    persistState();
    return res.json({ updated: impacted.length, items: impacted });
  });


  app.post('/api/budgets', async (req: Request, res: Response) => {
    const parsed = budgetCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const smart = parsePrescriptionToSuggestions(parsed.data.prescriptionText);
    const suggestedItems = smart.suggestions.map((item) => ({
      medicineId: item.medicineId,
      medicineName: item.name,
      confidence: item.confidence,
      quantitySuggestion: parsed.data.estimatedDays >= 30 ? 2 : 1
    }));

    const budget = {
      id: 'ORC-' + crypto.randomUUID().slice(0, 13).toUpperCase(),
      patientName: parsed.data.patientName,
      doctorName: parsed.data.doctorName,
      prescriptionText: parsed.data.prescriptionText,
      suggestedItems,
      status: 'draft' as const,
      createdAt: new Date().toISOString()
    };

    budgets.unshift(budget);
    return res.status(201).json({ item: budget });
  });

  app.get('/api/budgets', (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
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
      ...budget.suggestedItems.map((x) => `- ${x.medicineName} (qtd sugerida ${x.quantitySuggestion})`)
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
      createdAt: new Date().toISOString()
    }));

    return res.json({ items: labels, printableText: labels.map((x) => `${x.labelId} | ${x.patientName} | ${x.medicineName}`).join('\n') });
  });

  app.post('/api/scale/readings', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = scaleReadingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const deviationPercent = Number((((parsed.data.measuredWeightGrams - parsed.data.expectedWeightGrams) / parsed.data.expectedWeightGrams) * 100).toFixed(2));
    const status: 'ok' | 'alert' = Math.abs(deviationPercent) <= 2 ? 'ok' : 'alert';

    const reading = {
      id: 'BAL-' + crypto.randomUUID().slice(0, 8),
      quoteId: parsed.data.quoteId,
      medicineId: parsed.data.medicineId,
      expectedWeightGrams: parsed.data.expectedWeightGrams,
      measuredWeightGrams: parsed.data.measuredWeightGrams,
      deviationPercent,
      status,
      createdAt: new Date().toISOString()
    };

    scaleReadings.unshift(reading);
    return res.status(201).json({ item: reading });
  });

  app.post('/api/production/standard-formula', authorize(['admin', 'gerente', 'inventario']), async (req: Request, res: Response) => {
    const parsed = standardProductionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const formula = (await listStandardFormulas()).find((x: any) => x.id === parsed.data.formulaId);
    if (!formula) return res.status(404).json({ error: 'Fórmula padrão não encontrada' });

    const order = {
      id: 'PROD-' + crypto.randomUUID().slice(0, 8),
      formulaId: formula.id,
      batchSize: parsed.data.batchSize,
      operator: parsed.data.operator,
      status: 'planejada' as const,
      createdAt: new Date().toISOString()
    };

    productionOrders.unshift(order);
    return res.status(201).json({ item: order, formula });
  });

  app.post('/api/orders', async (req: Request, res: Response) => {
    const parsed = saleSchema.safeParse(req.body);
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
          eligibility
        });
      }
    }

    const meds = items.map((item) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      if (!med) return null;
      const estimatedRunOutDate = calculateRunOutDate(item.quantity, item.tabletsPerDay, item.tabletsPerPackage, item.treatmentDays);
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
        estimatedRunOutDate
      };
    });

    if (meds.some((m) => !m)) return res.status(400).json({ error: 'Um ou mais medicamentos são inválidos' });
    const validMeds = meds.filter(Boolean) as NonNullable<(typeof meds)[number]>[];

    const hasControlled = validMeds.some((m) => m.controlled);
    if (hasControlled && !prescriptionCode) return res.status(400).json({ error: 'Receita obrigatória para medicamentos controlados.' });

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
    } catch (error) {
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
      items: validMeds.map(({ controlled, ...rest }) => rest),
      total,
      controlledValidated: hasControlled,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
      estimatedTreatmentEndDate,
      recurring: recurring && nextBillingDate ? { discountPercent: recurring.discountPercent, nextBillingDate, needsConfirmation: true } : undefined
    };

    orders.unshift(order);

    if (customerId) {
      await logPatientActivity({ patientId: customerId, activityType: 'order_created', description: `Pedido ${order.id} criado.`, metadata: { orderId: order.id, total: order.total }, performedBy: authUser.id });
    }

    try {
      const shippingStartedAt = Date.now();
      const shipment = createShipmentWithFallback({
        orderId: order.id,
        destinationZip: order.address,
        weightKg: Math.max(0.3, validMeds.reduce((acc, item) => acc + item.quantity * 0.2, 0)),
        declaredValue: total
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
        syncStatus: shipment.syncStatus
      });

      persistState();
      return res.status(201).json({ order, shipment });
    } catch (error) {
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
              createdAt: new Date().toISOString()
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
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(orders, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/orders/:orderId/recurring/confirm', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!order.recurring) return res.status(400).json({ error: 'Pedido não possui recorrência ativa' });

    order.recurring.needsConfirmation = false;
    order.recurring.lastConfirmationAt = new Date().toISOString();
    order.recurring.confirmedBy = authUser.id;
    persistState();
    return res.json({ order });
  });

  app.get('/api/deliveries', async (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    const status = req.query.status?.toString() as DeliveryStatus | undefined;
    const q = req.query.q?.toString().toLowerCase();
    let filtered = deliveries;
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (q) filtered = filtered.filter((d) => d.orderId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q));

    return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/deliveries/:orderId', authorize(['admin', 'gerente']), async (req: Request, res: Response) => {
    const parsed = deliveryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = deliveries.find((d) => d.orderId === req.params.orderId);
    if (!target) return res.status(404).json({ error: 'Entrega não encontrada' });

    // Validate state machine transition
    if (parsed.data.status && parsed.data.status !== target.status) {
      if (!isValidDeliveryTransition(target.status, parsed.data.status)) {
        return res.status(400).json({
          error: `Transição inválida: de "${target.status}" para "${parsed.data.status}". Transições válidas: ${target.status === 'pendente' ? '"em_rota"' : target.status === 'em_rota' ? '"entregue"' : 'nenhuma (entrega já finalizada)'}`
        });
      }
    }

    Object.assign(target, parsed.data);
    if (parsed.data.status === 'entregue' && !parsed.data.forecastDate) {
      target.forecastDate = new Date().toISOString().slice(0, 10);
    }

    const order = orders.find((o) => o.id === target.orderId);
    const linkedPatient = order ? (await listCustomers()).find((c: any) => c.name === order.patientName && c.email === order.email) : undefined;
    if (linkedPatient) {
      const authUser = getAuthUser(req);
      await logPatientActivity({ patientId: linkedPatient.id, activityType: 'delivery_updated', description: `Entrega ${target.orderId} atualizada para status ${target.status}.`, metadata: { orderId: target.orderId, status: target.status }, performedBy: authUser.id });
    }

    persistState();
    return res.json({ item: target });
  });

  app.get('/api/tickets/:userId', async (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    if (authUser.role === 'operador' && authUser.id !== req.params.userId) return res.status(403).json({ error: 'Sem permissão para visualizar tickets de outro usuário' });

    const items = tickets.filter((t) => t.assignedTo === req.params.userId);
    return res.json({ items });
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
        lotesProximosVencimento: summary.nearExpiry
      },
      reminders
    });
  });

  app.use(express.static(publicDir));
  app.get('*', (_: Request, res: Response) => res.sendFile(path.join(publicDir, 'index.html')));

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const requestId = res.getHeader('X-Request-Id');
    const message = err instanceof Error ? err.message : 'Erro interno';
    if (process.env.NODE_ENV !== 'test' && res.statusCode >= 500) {
      console.error(`[ERR] ${req.method} ${req.originalUrl} [${requestId}] ${message}`);
      if (err instanceof Error && err.stack) console.error(err.stack);
    }
    return res.status(500).json({
      error: message,
      requestId: requestId ? String(requestId) : undefined
    });
  });

  return app;
}
