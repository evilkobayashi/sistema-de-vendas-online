import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { z } from 'zod';
import { deliveries, medicines, orders, tickets, users, type DeliveryStatus, type Order, type Role } from './data.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function resolvePublicDir() {
  const candidates = [
    path.resolve(process.cwd(), 'public'),
    path.resolve(__dirname, '../public'),
    path.resolve(__dirname, '../../public')
  ];

  const found = candidates.find((dir) => fs.existsSync(path.join(dir, 'index.html')));
  if (!found) {
    throw new Error('Diretório public não encontrado. Gere os assets ou valide o ambiente de execução.');
  }

  return found;
}

const saleSchema = z.object({
  userId: z.string().min(1),
  patientName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
  items: z.array(z.object({ medicineId: z.string(), quantity: z.number().int().positive() })).min(1),
  prescriptionCode: z.string().optional(),
  recurring: z.object({ discountPercent: z.number().min(0).max(100), nextBillingDate: z.string() }).optional()
});

const deliveryUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_rota', 'entregue']).optional(),
  forecastDate: z.string().optional(),
  carrier: z.string().optional()
});

const recurringConfirmSchema = z.object({
  userId: z.string().min(1)
});

function getDaysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 3600 * 1000));
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
      message: 'Confirmar junto ao cliente a recorrência da compra'
    }));
}

export function createApp() {
  const app = express();
  app.use(express.json());
  const publicDir = resolvePublicDir();

  app.use(express.static(publicDir));

  app.post('/api/login', (req, res) => {
    const schema = z.object({ employeeCode: z.string(), password: z.string() });
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Payload inválido' });

    const user = users.find(
      (u) => u.employeeCode === parsed.data.employeeCode && u.password === parsed.data.password
    );

    if (!user) return res.status(401).json({ error: 'Credenciais inválidas' });

    return res.json({ user: { id: user.id, name: user.name, role: user.role, employeeCode: user.employeeCode } });
  });

  app.get('/api/medicines', (req, res) => {
    const specialty = req.query.specialty?.toString();
    const lab = req.query.lab?.toString();

    let filtered = medicines;
    if (specialty) filtered = filtered.filter((m) => m.specialty === specialty);
    if (lab) filtered = filtered.filter((m) => m.lab === lab);

    res.setHeader('Cache-Control', 'public, max-age=60');
    res.setHeader('ETag', `W/"meds-${filtered.length}"`);

    return res.json({ items: filtered, specialties: [...new Set(medicines.map((m) => m.specialty))], labs: [...new Set(medicines.map((m) => m.lab))] });
  });

  app.post('/api/orders', (req, res) => {
    const parsed = saleSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const { items, prescriptionCode, recurring } = parsed.data;
    const meds = items.map((item) => {
      const med = medicines.find((m) => m.id === item.medicineId);
      if (!med) throw new Error(`Medicamento não encontrado: ${item.medicineId}`);
      return {
        medicineId: med.id,
        medicineName: med.name,
        quantity: item.quantity,
        unitPrice: med.price,
        subtotal: med.price * item.quantity,
        controlled: med.controlled
      };
    });

    const hasControlled = meds.some((m) => m.controlled);
    if (hasControlled && !prescriptionCode) {
      return res.status(400).json({ error: 'Receita obrigatória para medicamentos controlados.' });
    }

    const totalBruto = meds.reduce((acc, item) => acc + item.subtotal, 0);
    const discount = recurring ? totalBruto * (recurring.discountPercent / 100) : 0;
    const total = Number((totalBruto - discount).toFixed(2));

    const orderId = `P-${new Date().getFullYear()}-${String(orders.length + 1).padStart(3, '0')}`;
    const order: Order = {
      id: orderId,
      patientName: parsed.data.patientName,
      email: parsed.data.email,
      phone: parsed.data.phone,
      address: parsed.data.address,
      items: meds.map(({ controlled, ...rest }) => rest),
      total,
      controlledValidated: hasControlled,
      createdBy: parsed.data.userId,
      createdAt: new Date().toISOString(),
      recurring: recurring
        ? {
            ...recurring,
            needsConfirmation: true
          }
        : undefined
    };

    orders.unshift(order);
    deliveries.unshift({
      orderId: order.id,
      patientName: order.patientName,
      status: 'pendente',
      forecastDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
      carrier: 'Transportadora Interna'
    });

    return res.status(201).json({ order });
  });

  app.get('/api/orders', (_, res) => res.json({ items: orders }));

  app.patch('/api/orders/:orderId/recurring/confirm', (req, res) => {
    const parsed = recurringConfirmSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const order = orders.find((o) => o.id === req.params.orderId);
    if (!order) return res.status(404).json({ error: 'Pedido não encontrado' });
    if (!order.recurring) return res.status(400).json({ error: 'Pedido não possui recorrência ativa' });

    order.recurring.needsConfirmation = false;
    order.recurring.lastConfirmationAt = new Date().toISOString();
    order.recurring.confirmedBy = parsed.data.userId;

    return res.json({ order });
  });

  app.get('/api/deliveries', (req, res) => {
    const status = req.query.status?.toString() as DeliveryStatus | undefined;
    const q = req.query.q?.toString().toLowerCase();
    let filtered = deliveries;
    if (status) filtered = filtered.filter((d) => d.status === status);
    if (q) filtered = filtered.filter((d) => d.orderId.toLowerCase().includes(q) || d.patientName.toLowerCase().includes(q));
    return res.json({ items: filtered });
  });

  app.patch('/api/deliveries/:orderId', (req, res) => {
    const parsed = deliveryUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

    const target = deliveries.find((d) => d.orderId === req.params.orderId);
    if (!target) return res.status(404).json({ error: 'Entrega não encontrada' });

    Object.assign(target, parsed.data);
    return res.json({ item: target });
  });

  app.get('/api/tickets/:userId', (req, res) => {
    const items = tickets.filter((t) => t.assignedTo === req.params.userId);
    return res.json({ items });
  });

  app.get('/api/dashboard/:role', (req, res) => {
    const role = req.params.role as Role;
    const totalSales = orders.reduce((acc, order) => acc + order.total, 0);
    const reminders = buildRecurringReminders(orders);

    return res.json({
      role,
      indicators: {
        pedidos: orders.length,
        entregasPendentes: deliveries.filter((d) => d.status !== 'entregue').length,
        ticketsAbertos: tickets.filter((t) => t.status !== 'fechado').length,
        totalSales
      },
      reminders
    });
  });

  app.get('*', (_, res) => {
    res.sendFile(path.join(publicDir, 'index.html'));
  });

  return app;
}
