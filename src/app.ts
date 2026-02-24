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
  carrier: z.string().optional()
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

    const newLot: InventoryLot = {
      id: `lot-${Date.now()}`,
      medicineId: parsed.data.medicineId,
      batchCode: parsed.data.batchCode,
      expiresAt: parsed.data.expiresAt,
      quantity: parsed.data.quantity,
      reserved: 0,
      unitCost: parsed.data.unitCost,
      supplier: parsed.data.supplier,
      createdAt: new Date().toISOString()
    };

    inventoryLots.unshift(newLot);
    inventoryMovements.unshift({
      id: `mov-${Date.now()}`,
      medicineId: newLot.medicineId,
      lotId: newLot.id,
      type: 'entrada',
      quantity: newLot.quantity,
      reason: `Entrada de lote ${newLot.batchCode}`,
      createdBy: authUser.id,
      createdAt: new Date().toISOString()
    });

    persistState();
    return res.status(201).json({ item: newLot });
  });

  app.post('/api/orders', (req: Request, res: Response) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const authUser = getAuthUser(req);
    const { items, prescriptionCode, recurring } = parsed.data;

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
      patientName: parsed.data.patientName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      items: validMeds.map(({ controlled, ...rest }) => rest),
      total,
      controlledValidated: hasControlled,
      createdBy: authUser.id,
      createdAt: new Date().toISOString(),
      estimatedTreatmentEndDate,
      recurring: recurring && nextBillingDate ? { discountPercent: recurring.discountPercent, nextBillingDate, needsConfirmation: true } : undefined
    };

    orders.unshift(order);
    deliveries.unshift({
      orderId: order.id,
      patientName: order.patientName,
      status: 'pendente',
      forecastDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      carrier: 'Transportadora Interna'
    });

    persistState();
    return res.status(201).json({ order });
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
