import crypto from 'node:crypto';
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
  type Role,
  type User
} from './data.js';
import { loadPersistentState, persistState } from './store.js';
import { createCustomer, createDoctor, createEmployee, createFinishedProduct, createHealthPlan, createPackagingFormula, createPatientActivity, createRawMaterial, createStandardFormula, createSupplier, getCustomerById, getDoctorById, getHealthPlanById, initDatabase, listCustomers, listDoctors, listEmployees, listFinishedProducts, listHealthPlans, listPackagingFormulas, listPatientActivities, listRawMaterials, listStandardFormulas, listSuppliers, updateCustomer, updateDoctor, updateHealthPlan } from './database.js';
import { createShipmentWithFallback, quoteWithFallback } from './shipping.js';
import { dialerProvider, emailProvider, executeWithRetries } from './communications.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

const customerUpdateSchema = customerCreateSchema;

const doctorCreateSchema = z.object({
  name: z.string().min(2),
  crm: z.string().min(4),
  specialty: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8)
});

const doctorUpdateSchema = doctorCreateSchema;

const healthPlanCreateSchema = z.object({
  name: z.string().min(2),
  providerName: z.string().min(2),
  registrationCode: z.string().min(3)
});

const healthPlanUpdateSchema = healthPlanCreateSchema;


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
  image: z.string().url().or(z.string().startsWith('data:image/')).or(z.literal(''))
});

type Session = { user: Omit<User, 'password'>; expiresAt: number };
const sessions = new Map<string, Session>();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

const budgets: Array<{ id: string; patientName: string; doctorName?: string; prescriptionText: string; suggestedItems: Array<{ medicineId: string; medicineName: string; confidence: number; quantitySuggestion: number }>; status: 'draft' | 'approved'; createdAt: string }> = [];
const scaleReadings: Array<{ id: string; quoteId: string; medicineId: string; expectedWeightGrams: number; measuredWeightGrams: number; deviationPercent: number; status: 'ok' | 'alert'; createdAt: string }> = [];
const productionOrders: Array<{ id: string; formulaId: string; batchSize: number; operator: string; status: 'planejada' | 'em_producao' | 'concluida'; createdAt: string }> = [];


type AuthenticatedRequest = Request & { authUser: Omit<User, 'password'> };

function getAuthUser(req: Request) {
  return (req as unknown as AuthenticatedRequest).authUser;
}

function createToken() {
  return crypto.randomBytes(24).toString('hex');
}

function cleanExpiredSessions() {
  const now = Date.now();
  for (const [token, session] of sessions.entries()) {
    if (session.expiresAt <= now) sessions.delete(token);
  }
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  cleanExpiredSessions();
  const authHeader = req.header('authorization');
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
  if (!token) return res.status(401).json({ error: 'Token ausente' });

  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    return res.status(401).json({ error: 'Sessão inválida ou expirada' });
  }

  (req as AuthenticatedRequest).authUser = session.user;
  return next();
}

function authorize(roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const authUser = getAuthUser(req);
    if (!roles.includes(authUser.role)) return res.status(403).json({ error: 'Sem permissão para esta operação' });
    return next();
  };
}

function getDaysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 3600 * 1000));
}

function addDays(startIso: string, days: number) {
  const dt = new Date(startIso);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function calculateRunOutDate(quantity: number, tabletsPerDay?: number, tabletsPerPackage?: number, treatmentDays?: number) {
  if (treatmentDays && treatmentDays > 0) return addDays(new Date().toISOString(), treatmentDays);
  if (!tabletsPerDay || tabletsPerDay <= 0) return undefined;
  const unitsPerPackage = tabletsPerPackage ?? 30;
  const totalTablets = quantity * unitsPerPackage;
  const durationInDays = Math.max(1, Math.ceil(totalTablets / tabletsPerDay));
  return addDays(new Date().toISOString(), durationInDays);
}

function normalizeText(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}


function parsePrescriptionToSuggestions(rawText: string) {
  const text = normalizeText(rawText);
  const suggestions = medicines
    .map((medicine) => {
      const name = normalizeText(medicine.name);
      const lab = normalizeText(medicine.lab);
      const tokens = [...new Set(name.split(' ').filter((t) => t.length >= 4))];
      let score = 0;

      if (text.includes(name)) score += 5;
      if (text.includes(lab)) score += 1;
      for (const token of tokens) {
        if (text.includes(token)) score += 1;
      }

      return {
        medicineId: medicine.id,
        name: medicine.name,
        controlled: medicine.controlled,
        confidence: Math.min(0.99, score / 10),
        reason: score > 0 ? `Termos compatíveis encontrados (${score})` : ''
      };
    })
    .filter((item) => item.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  return {
    suggestions,
    found: suggestions.length > 0
  };
}

function extractTextFromDocument(contentBase64: string, mimeType: string) {
  const raw = Buffer.from(contentBase64, 'base64');
  const utf = raw.toString('utf8');
  const latin = raw.toString('latin1');

  const decoded = `${utf}\n${latin}`;
  const extracted = decoded
    .replace(/[^\w\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const isPdf = mimeType.includes('pdf');
  const isImage = mimeType.startsWith('image/');

  if (isPdf) {
    return {
      extractedText: extracted,
      extractionMethod: 'pdf-text-scan',
      warning: extracted.length < 20 ? 'PDF sem texto legível. Use PDF pesquisável ou informe texto manualmente.' : undefined
    };
  }

  if (isImage) {
    return {
      extractedText: extracted,
      extractionMethod: 'image-metadata-scan',
      warning: 'Leitura de imagem depende de texto incorporado/metadados. Se não houver sugestão, cole o texto da receita.'
    };
  }

  return {
    extractedText: extracted,
    extractionMethod: 'generic-binary-scan'
  };
}


function buildRecurringReminders(items: Order[]) {
  return items
    .filter((o) => {
      if (!o.recurring?.needsConfirmation) return false;
      const diffDays = getDaysUntil(o.recurring.nextBillingDate);
      return diffDays >= 0 && diffDays <= 3;
    })
    .map((o) => ({
      orderId: o.id,
      patientName: o.patientName,
      nextBillingDate: o.recurring?.nextBillingDate,
      estimatedTreatmentEndDate: o.estimatedTreatmentEndDate,
      message: 'Confirmar junto ao cliente a recorrência da compra'
    }));
}

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

function availableQuantityByMedicine(medicineId: string) {
  return inventoryLots
    .filter((lot) => lot.medicineId === medicineId)
    .reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
}

function reserveStockFefo(medicineId: string, quantity: number, orderId: string, userId: string) {
  const lots = inventoryLots
    .filter((lot) => lot.medicineId === medicineId && lot.quantity - lot.reserved > 0)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  let missing = quantity;
  const changes: Array<{ lot: InventoryLot; delta: number }> = [];

  for (const lot of lots) {
    if (missing <= 0) break;
    const free = lot.quantity - lot.reserved;
    const used = Math.min(free, missing);
    if (used > 0) {
      changes.push({ lot, delta: used });
      missing -= used;
    }
  }

  if (missing > 0) {
    throw new Error(`Estoque insuficiente para ${medicineId}. Faltam ${missing} unidade(s).`);
  }

  for (const change of changes) {
    change.lot.reserved += change.delta;
    inventoryMovements.unshift({
      id: `mov-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
      medicineId,
      lotId: change.lot.id,
      type: 'reserva',
      quantity: change.delta,
      reason: 'Reserva automática por criação de pedido',
      relatedOrderId: orderId,
      createdBy: userId,
      createdAt: new Date().toISOString()
    });
  }
}


function createLotEntry(input: { medicineId: string; batchCode: string; expiresAt: string; quantity: number; unitCost: number; supplier: string; reason: string; createdBy: string; }) {
  const newLot: InventoryLot = {
    id: `lot-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
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
  const detRegex = /<det[\s\S]*?<\/det>/g;
  const matches = xml.match(detRegex) || [];

  for (const block of matches) {
    const name = (block.match(/<xProd>([^<]+)<\/xProd>/)?.[1] || '').trim();
    const quantity = Number((block.match(/<qCom>([^<]+)<\/qCom>/)?.[1] || '0').replace(',', '.'));
    const unitPriceRaw = (block.match(/<vUnCom>([^<]+)<\/vUnCom>/)?.[1] || '').replace(',', '.');
    const unitPrice = unitPriceRaw ? Number(unitPriceRaw) : undefined;
    if (name && Number.isFinite(quantity) && quantity > 0) items.push({ name, quantity, unitPrice });
  }

  if (!items.length) {
    const fallbackName = (xml.match(/<xProd>([^<]+)<\/xProd>/)?.[1] || '').trim();
    const fallbackQty = Number((xml.match(/<qCom>([^<]+)<\/qCom>/)?.[1] || '0').replace(',', '.'));
    const unitPriceRaw = (xml.match(/<vUnCom>([^<]+)<\/vUnCom>/)?.[1] || '').replace(',', '.');
    const unitPrice = unitPriceRaw ? Number(unitPriceRaw) : undefined;
    if (fallbackName && fallbackQty > 0) items.push({ name: fallbackName, quantity: fallbackQty, unitPrice });
  }

  return items;
}

function buildInventorySummary() {
  const now = Date.now();
  const items = medicines.map((medicine) => {
    const lots = inventoryLots.filter((lot) => lot.medicineId === medicine.id);
    const stockTotal = lots.reduce((acc, lot) => acc + lot.quantity, 0);
    const stockAvailable = lots.reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
    const expiresIn30Days = lots.filter((lot) => {
      const diff = Math.ceil((new Date(lot.expiresAt).getTime() - now) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length;
    return { medicineId: medicine.id, medicineName: medicine.name, stockTotal, stockAvailable, lotCount: lots.length, expiresIn30Days };
  });

  return {
    items,
    critical: items.filter((item) => item.stockAvailable <= 10).length,
    nearExpiry: items.reduce((acc, item) => acc + item.expiresIn30Days, 0)
  };
}

export function createApp() {
  const app = express();
  app.use(express.json({ limit: '2mb' }));
  const publicDir = resolvePublicDir();
  loadPersistentState();
  initDatabase();

  app.get('/health/live', (_: Request, res: Response) => res.json({ status: 'ok' }));
  app.get('/health/ready', (_: Request, res: Response) => res.json({ status: 'ready', sessions: sessions.size }));

  app.post('/api/login', (req: Request, res: Response) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido' });

    const employeeCodeNormalized = parsed.data.employeeCode.trim().toUpperCase();
    const passwordNormalized = parsed.data.password.trim();

    const user = users.find((u) => u.employeeCode.trim().toUpperCase() === employeeCodeNormalized && u.password === passwordNormalized);
    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    const token = createToken();
    const safeUser = { id: user.id, name: user.name, role: user.role, employeeCode: user.employeeCode };
    sessions.set(token, { user: safeUser, expiresAt: Date.now() + SESSION_TTL_MS });

    return res.json({ token, expiresInMs: SESSION_TTL_MS, user: safeUser });
  });

  app.post('/api/logout', authRequired, (req: Request, res: Response) => {
    const authHeader = req.header('authorization');
    const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    if (token) sessions.delete(token);
    return res.json({ ok: true });
  });

  app.use('/api', authRequired);


  function validatePatientReferences(input: { doctorId: string; healthPlanId: string }) {
    const doctor = getDoctorById(input.doctorId);
    if (!doctor) return { error: 'Médico informado não existe.' };
    const healthPlan = getHealthPlanById(input.healthPlanId);
    if (!healthPlan) return { error: 'Plano de saúde informado não existe.' };
    return { doctor, healthPlan };
  }

  function logPatientActivity(input: { patientId: string; activityType: string; description: string; metadata?: Record<string, unknown>; performedBy?: string }) {
    createPatientActivity({
      patientId: input.patientId,
      activityType: input.activityType,
      description: input.description,
      metadataJson: JSON.stringify(input.metadata || {}),
      performedBy: input.performedBy || 'system'
    });
  }

  app.get('/api/customers', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = listCustomers(q);
    return res.json({ items });
  });

  app.post('/api/customers', (req: Request, res: Response) => {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = createCustomer(parsed.data);
    const authUser = getAuthUser(req);
    logPatientActivity({ patientId: item.id, activityType: 'patient_created', description: 'Cadastro de paciente criado.', metadata: { source: 'customers' }, performedBy: authUser.id });
    return res.status(201).json({ item });
  });

  app.get('/api/customers/:customerId', (req: Request, res: Response) => {
    const item = getCustomerById(req.params.customerId);
    if (!item) return res.status(404).json({ error: 'Cliente não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/customers/:customerId', (req: Request, res: Response) => {
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = updateCustomer(req.params.customerId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Cliente não encontrado' });
    const authUser = getAuthUser(req);
    logPatientActivity({ patientId: item.id, activityType: 'patient_updated', description: 'Cadastro de paciente atualizado.', metadata: { source: 'customers' }, performedBy: authUser.id });
    return res.json({ item });
  });


  app.get('/api/patients', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = listCustomers(q);
    return res.json({ items });
  });

  app.post('/api/patients', (req: Request, res: Response) => {
    const parsed = customerCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = createCustomer(parsed.data);
    const authUser = getAuthUser(req);
    logPatientActivity({ patientId: item.id, activityType: 'patient_created', description: 'Cadastro de paciente criado.', metadata: { source: 'patients' }, performedBy: authUser.id });
    return res.status(201).json({ item });
  });

  app.patch('/api/patients/:patientId', (req: Request, res: Response) => {
    const parsed = customerUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const refs = validatePatientReferences(parsed.data);
    if ('error' in refs) return res.status(400).json({ error: refs.error });

    const item = updateCustomer(req.params.patientId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    const authUser = getAuthUser(req);
    logPatientActivity({ patientId: item.id, activityType: 'patient_updated', description: 'Cadastro de paciente atualizado.', metadata: { source: 'patients' }, performedBy: authUser.id });
    return res.json({ item });
  });


  app.get('/api/patients/:patientId', (req: Request, res: Response) => {
    const item = getCustomerById(req.params.patientId);
    if (!item) return res.status(404).json({ error: 'Paciente não encontrado' });
    return res.json({ item });
  });




  app.get('/api/patients/:patientId/activities', (req: Request, res: Response) => {
    const patient = getCustomerById(req.params.patientId);
    if (!patient) return res.status(404).json({ error: 'Paciente não encontrado' });

    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    return res.json(listPatientActivities(req.params.patientId, pagination.data.page, pagination.data.pageSize));
  });




  app.post('/api/patients/:patientId/contact', async (req: Request, res: Response) => {
    const patient = getCustomerById(req.params.patientId);
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

    const result = await executeWithRetries(
      async () => {
        if (parsed.data.type === 'call') return dialerProvider.sendCall(requestPayload);
        return emailProvider.sendEmail(requestPayload);
      },
      {
        retries: 2,
        waitMs: 50,
        onAttemptError: async (attempt, error) => {
          logPatientActivity({
            patientId: patient.id,
            activityType: `contact_attempt_${parsed.data.type}`,
            description: `Tentativa ${attempt} de contato (${parsed.data.type}) falhou: ${error.message}`,
            metadata: { attempt, type: parsed.data.type, destination },
            performedBy: authUser.id
          });
        }
      }
    );

    if (!result.ok) {
      logPatientActivity({
        patientId: patient.id,
        activityType: `contact_failed_${parsed.data.type}`,
        description: `Contato ${parsed.data.type} falhou após ${result.attempt} tentativa(s).`,
        metadata: { attempts: result.attempt, type: parsed.data.type, destination },
        performedBy: authUser.id
      });
      return res.status(502).json({ error: 'Falha ao processar contato com paciente', attempts: result.attempt });
    }

    logPatientActivity({
      patientId: patient.id,
      activityType: `contact_success_${parsed.data.type}`,
      description: `Contato ${parsed.data.type} enviado com sucesso para ${destination}.`,
      metadata: { attempts: result.attempt, type: parsed.data.type, destination, provider: result.result.provider, externalId: result.result.externalId },
      performedBy: authUser.id
    });

    return res.json({ ok: true, attempts: result.attempt, item: result.result });
  });


  app.get('/api/health-plans', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = listHealthPlans(q);
    return res.json({ items });
  });

  app.post('/api/health-plans', (req: Request, res: Response) => {
    const parsed = healthPlanCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = createHealthPlan(parsed.data);
    return res.status(201).json({ item });
  });

  app.patch('/api/health-plans/:healthPlanId', (req: Request, res: Response) => {
    const parsed = healthPlanUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = updateHealthPlan(req.params.healthPlanId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Plano de saúde não encontrado' });
    return res.json({ item });
  });

  app.get('/api/doctors', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    const items = listDoctors(q);
    return res.json({ items });
  });

  app.post('/api/doctors', (req: Request, res: Response) => {
    const parsed = doctorCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = createDoctor(parsed.data);
    return res.status(201).json({ item });
  });

  app.get('/api/doctors/:doctorId', (req: Request, res: Response) => {
    const item = getDoctorById(req.params.doctorId);
    if (!item) return res.status(404).json({ error: 'Médico não encontrado' });
    return res.json({ item });
  });

  app.patch('/api/doctors/:doctorId', (req: Request, res: Response) => {
    const parsed = doctorUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const item = updateDoctor(req.params.doctorId, parsed.data);
    if (!item) return res.status(404).json({ error: 'Médico não encontrado' });
    return res.json({ item });
  });


  app.get('/api/employees', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listEmployees(q) });
  });

  app.post('/api/employees', (req: Request, res: Response) => {
    const parsed = employeeCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createEmployee(parsed.data) });
  });

  app.get('/api/suppliers', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listSuppliers(q) });
  });

  app.post('/api/suppliers', (req: Request, res: Response) => {
    const parsed = supplierCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createSupplier(parsed.data) });
  });

  app.get('/api/finished-products', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listFinishedProducts(q) });
  });

  app.post('/api/finished-products', (req: Request, res: Response) => {
    const parsed = finishedProductCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createFinishedProduct(parsed.data) });
  });

  app.get('/api/raw-materials', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listRawMaterials(q) });
  });

  app.post('/api/raw-materials', (req: Request, res: Response) => {
    const parsed = rawMaterialCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createRawMaterial(parsed.data) });
  });

  app.get('/api/standard-formulas', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listStandardFormulas(q) });
  });

  app.post('/api/standard-formulas', (req: Request, res: Response) => {
    const parsed = standardFormulaCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createStandardFormula(parsed.data) });
  });

  app.get('/api/packaging-formulas', (req: Request, res: Response) => {
    const q = req.query.q?.toString();
    return res.json({ items: listPackagingFormulas(q) });
  });

  app.post('/api/packaging-formulas', (req: Request, res: Response) => {
    const parsed = packagingFormulaCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
    return res.status(201).json({ item: createPackagingFormula(parsed.data) });
  });

  app.post('/api/shipping/quote', (req: Request, res: Response) => {
    const parsed = shippingQuoteSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = quoteWithFallback(parsed.data);
    return res.json({ item: result });
  });

  app.get('/api/medicines', (_req: Request, res: Response) => {
    const summary = buildInventorySummary();
    const inventoryMap = new Map(summary.items.map((x) => [x.medicineId, x]));
    const items = medicines.map((med) => ({ ...med, inventory: inventoryMap.get(med.id) }));

    res.setHeader('Cache-Control', 'private, max-age=60');
    res.setHeader('ETag', `W/"meds-${items.length}"`);

    return res.json({ items, specialties: [...new Set(medicines.map((m) => m.specialty))], labs: [...new Set(medicines.map((m) => m.lab))] });
  });

  app.post('/api/medicines', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
    const parsed = medicineCreateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const newMedicine = {
      id: `m${medicines.length + 1}`,
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


  app.post('/api/prescriptions/parse', (req: Request, res: Response) => {
    const parsed = prescriptionParseSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const result = parsePrescriptionToSuggestions(parsed.data.text);
    return res.json(result);
  });

  app.post('/api/prescriptions/parse-document', (req: Request, res: Response) => {
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

  app.get('/api/inventory/summary', (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    const summary = buildInventorySummary();
    return res.json({ ...summary, ...paginate(summary.items, pagination.data.page, pagination.data.pageSize) });
  });

  app.get('/api/inventory/movements', (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(inventoryMovements, pagination.data.page, pagination.data.pageSize));
  });

  app.post('/api/inventory/lots', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
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


  app.post('/api/inventory/entries', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
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

  app.post('/api/inventory/entries/nfe-xml', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
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

  app.get('/api/print/labels/:orderId', (req: Request, res: Response) => {
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

  app.get('/api/quality/reports/:orderId', (req: Request, res: Response) => {
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

  app.post('/api/pricing/auto-update', authorize(['admin', 'gerente']), (req: Request, res: Response) => {
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
        id: `mov-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
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


  app.post('/api/budgets', (req: Request, res: Response) => {
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
      id: `ORC-${new Date().getFullYear()}-${String(budgets.length + 1).padStart(4, '0')}`,
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

  app.get('/api/budgets', (_req: Request, res: Response) => {
    return res.json({ items: budgets });
  });

  app.get('/api/budgets/:budgetId/manipulation-order', (req: Request, res: Response) => {
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

  app.get('/api/budgets/:budgetId/labels', (req: Request, res: Response) => {
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

  app.post('/api/scale/readings', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
    const parsed = scaleReadingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const deviationPercent = Number((((parsed.data.measuredWeightGrams - parsed.data.expectedWeightGrams) / parsed.data.expectedWeightGrams) * 100).toFixed(2));
    const status: 'ok' | 'alert' = Math.abs(deviationPercent) <= 2 ? 'ok' : 'alert';

    const reading = {
      id: `BAL-${Date.now()}`,
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

  app.post('/api/production/standard-formula', authorize(['admin', 'gerente', 'inventario']), (req: Request, res: Response) => {
    const parsed = standardProductionSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const formula = listStandardFormulas().find((x) => x.id === parsed.data.formulaId);
    if (!formula) return res.status(404).json({ error: 'Fórmula padrão não encontrada' });

    const order = {
      id: `PROD-${Date.now()}`,
      formulaId: formula.id,
      batchSize: parsed.data.batchSize,
      operator: parsed.data.operator,
      status: 'planejada' as const,
      createdAt: new Date().toISOString()
    };

    productionOrders.unshift(order);
    return res.status(201).json({ item: order, formula });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const authUser = getAuthUser(req);
    const { items, prescriptionCode, recurring, customerId } = parsed.data;
    const customer = customerId ? getCustomerById(customerId) : undefined;

    if (customer) {
      const doctorExists = getDoctorById(customer.doctorId);
      const healthPlanExists = getHealthPlanById(customer.healthPlanId);
      if (!doctorExists || !healthPlanExists) {
        return res.status(400).json({ error: 'Paciente com referência inválida de médico/plano de saúde.' });
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

    const orderId = `P-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`;
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
      logPatientActivity({ patientId: customerId, activityType: 'order_created', description: `Pedido ${order.id} criado.`, metadata: { orderId: order.id, total: order.total }, performedBy: authUser.id });
    }

    const shipment = createShipmentWithFallback({
      orderId: order.id,
      destinationZip: order.address,
      weightKg: Math.max(0.3, validMeds.reduce((acc, item) => acc + item.quantity * 0.2, 0)),
      declaredValue: total
    });

    deliveries.unshift({
      orderId: order.id,
      patientName: order.patientName,
      status: 'pendente',
      forecastDate: addDays(new Date().toISOString(), shipment.etaDays),
      carrier: shipment.provider,
      trackingCode: shipment.trackingCode,
      shippingProvider: shipment.provider,
      syncStatus: shipment.syncStatus
    });

    persistState();
    return res.status(201).json({ order, shipment });
  });

  app.get('/api/orders', (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });
    return res.json(paginate(orders, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/orders/:orderId/recurring/confirm', (req: Request, res: Response) => {
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

  app.get('/api/deliveries', (req: Request, res: Response) => {
    const pagination = paginationSchema.safeParse(req.query);
    if (!pagination.success) return res.status(400).json({ error: pagination.error.flatten() });

    const status = req.query.status?.toString() as DeliveryStatus | undefined;
    const q = req.query.q?.toString().toLowerCase();
    let filtered = deliveries;
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (q) filtered = filtered.filter((d) => d.orderId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q));

    return res.json(paginate(filtered, pagination.data.page, pagination.data.pageSize));
  });

  app.patch('/api/deliveries/:orderId', authorize(['admin', 'gerente']), (req: Request, res: Response) => {
    const parsed = deliveryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = deliveries.find((d) => d.orderId === req.params.orderId);
    if (!target) return res.status(404).json({ error: 'Entrega não encontrada' });

    Object.assign(target, parsed.data);

    const order = orders.find((o) => o.id === target.orderId);
    const linkedPatient = order ? listCustomers().find((c) => c.name === order.patientName && c.email === order.email) : undefined;
    if (linkedPatient) {
      const authUser = getAuthUser(req);
      logPatientActivity({ patientId: linkedPatient.id, activityType: 'delivery_updated', description: `Entrega ${target.orderId} atualizada para status ${target.status}.`, metadata: { orderId: target.orderId, status: target.status }, performedBy: authUser.id });
    }

    persistState();
    return res.json({ item: target });
  });

  app.get('/api/tickets/:userId', (req: Request, res: Response) => {
    const authUser = getAuthUser(req);
    if (authUser.role === 'operador' && authUser.id !== req.params.userId) return res.status(403).json({ error: 'Sem permissão para visualizar tickets de outro usuário' });

    const items = tickets.filter((t) => t.assignedTo === req.params.userId);
    return res.json({ items });
  });

  app.get('/api/dashboard/:role?', (req: Request, res: Response) => {
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

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const message = err instanceof Error ? err.message : 'Erro interno';
    return res.status(500).json({ error: message });
  });

  return app;
}
