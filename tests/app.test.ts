import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const runtimeDir = path.resolve(process.cwd(), '.runtime-data-test');
process.env.RUNTIME_STORE_DIR = runtimeDir;

const app = createApp();

async function loginAs(employeeCode = '4B-101', password = 'operador123') {
  const response = await request(app).post('/api/login').send({ employeeCode, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe('4bio internal sales app', () => {
  beforeAll(() => {
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  });

  beforeEach(() => {
    for (const file of fs.readdirSync(runtimeDir)) fs.rmSync(path.join(runtimeDir, file), { recursive: true, force: true });
  });

  it('retorna index principal', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('Sistema Interno de Compras');
  });

  it('protege rotas sem token', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('login inventário funciona com código normalizado', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: ' 4b-220 ', password: 'inventario123 ' });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('inventario');
  });

  it('permite inventário cadastrar lote e reflete no sumário', async () => {
    const token = await loginAs('4B-220', 'inventario123');
    const lot = await request(app)
      .post('/api/inventory/lots')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicineId: 'm2', batchCode: 'CAR-NEW', expiresAt: '2030-01-01', quantity: 33, unitCost: 50, supplier: 'BioHeart' });

    expect(lot.status).toBe(201);

    const summary = await request(app).get('/api/inventory/summary?page=1&pageSize=50').set('Authorization', `Bearer ${token}`);
    expect(summary.status).toBe(200);
    const cardio = summary.body.items.find((x: { medicineId: string }) => x.medicineId === 'm2');
    expect(cardio.stockTotal).toBeGreaterThanOrEqual(33);
  });



  it('cadastra e lista clientes em banco de dados', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Teste', email: 'cliente@example.com', phone: '11977776666', address: 'Rua Cliente, 10' });

    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/customers?q=Cliente').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x: { email: string }) => x.email === 'cliente@example.com')).toBe(true);
  });

  it('permite criar pedido usando customerId cadastrado', async () => {
    const token = await loginAs();
    const createdCustomer = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Cliente Pedido', email: 'pedido@example.com', phone: '11911112222', address: 'Rua Pedido, 20' });

    const createdOrder = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        customerId: createdCustomer.body.item.id,
        patientName: 'fallback',
        email: 'fallback@example.com',
        phone: '111111111',
        address: 'fallback',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    expect(createdOrder.status).toBe(201);
    expect(createdOrder.body.order.patientName).toBe('Cliente Pedido');
    expect(createdOrder.body.order.email).toBe('pedido@example.com');
  });



  it('aplica fallback de transportadora quando provedor primário falha', async () => {
    process.env.SHIPPING_FORCE_FAIL = 'primary';
    const token = await loginAs();

    const createdOrder = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Frete',
        email: 'frete@example.com',
        phone: '11910000000',
        address: '01001-000',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    expect(createdOrder.status).toBe(201);
    expect(createdOrder.body.shipment.provider).toBe('EcoEntrega');
    expect(createdOrder.body.shipment.fallbackUsed).toBe(true);

    const deliveries = await request(app)
      .get('/api/deliveries?page=1&pageSize=50')
      .set('Authorization', `Bearer ${token}`);
    expect(deliveries.status).toBe(200);
    expect(deliveries.body.items[0].trackingCode).toContain('EE-');

    process.env.SHIPPING_FORCE_FAIL = '';
  });

  it('retorna fallback interno quando todos os provedores falham', async () => {
    process.env.SHIPPING_FORCE_FAIL = 'all';
    const token = await loginAs();

    const quote = await request(app)
      .post('/api/shipping/quote')
      .set('Authorization', `Bearer ${token}`)
      .send({ destinationZip: '01001-000', weightKg: 1.2, declaredValue: 200 });

    expect(quote.status).toBe(200);
    expect(quote.body.item.provider).toBe('Transportadora Interna');
    expect(quote.body.item.syncStatus).toBe('queued_retry');

    process.env.SHIPPING_FORCE_FAIL = '';
  });

  it('reserva estoque na criação de pedido e bloqueia quando falta saldo', async () => {
    const token = await loginAs();

    const ok = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Estoque',
        email: 'estoque@example.com',
        phone: '11999999900',
        address: 'Rua E, 1',
        items: [{ medicineId: 'm4', quantity: 2 }]
      });
    expect(ok.status).toBe(201);

    const blocked = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Sem Saldo',
        email: 'semsaldo@example.com',
        phone: '11999999888',
        address: 'Rua F, 2',
        items: [{ medicineId: 'm4', quantity: 999 }]
      });
    expect(blocked.status).toBe(400);
    expect(blocked.body.error).toContain('Estoque insuficiente');
  });




  it('interpreta texto de pedido médico e sugere remédios do catálogo', async () => {
    const token = await loginAs();

    const parsed = await request(app)
      .post('/api/prescriptions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Paciente deve usar CardioPlus 10mg 1 comprimido ao dia. Se necessário, manter OncoRelief.' });

    expect(parsed.status).toBe(200);
    expect(parsed.body.found).toBe(true);
    expect(parsed.body.suggestions.length).toBeGreaterThan(0);
    expect(parsed.body.suggestions.some((x: { name: string }) => x.name.includes('CardioPlus'))).toBe(true);
  });



  it('interpreta receita enviada por arquivo (pdf base64) e retorna sugestões', async () => {
    const token = await loginAs();
    const fakePdfText = Buffer.from('Receita: CardioPlus 10mg 1 comprimido por dia', 'utf8').toString('base64');

    const parsed = await request(app)
      .post('/api/prescriptions/parse-document')
      .set('Authorization', `Bearer ${token}`)
      .send({
        filename: 'receita.pdf',
        mimeType: 'application/pdf',
        contentBase64: fakePdfText
      });

    expect(parsed.status).toBe(200);
    expect(parsed.body.suggestions.length).toBeGreaterThan(0);
    expect(parsed.body.extractionMethod).toContain('pdf');
  });

  it('calcula previsão de término do medicamento com base no consumo diário', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Fórmula',
        email: 'formula@example.com',
        phone: '11999999666',
        address: 'Rua H',
        items: [{ medicineId: 'm2', quantity: 2, tabletsPerDay: 2, tabletsPerPackage: 30, treatmentDays: 12 }],
        recurring: { discountPercent: 5 }
      });

    expect(response.status).toBe(201);
    expect(response.body.order.items[0].estimatedRunOutDate).toBeTruthy();
    expect(response.body.order.items[0].treatmentDays).toBe(12);
    expect(response.body.order.estimatedTreatmentEndDate).toBeTruthy();
    expect(response.body.order.recurring.nextBillingDate).toBe(response.body.order.estimatedTreatmentEndDate);
  });

  it('mantém recorrência e confirmação', async () => {
    const token = await loginAs();
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Recorrente',
        email: 'rec@example.com',
        phone: '11999999777',
        address: 'Rua G',
        items: [{ medicineId: 'm2', quantity: 1 }],
        recurring: { discountPercent: 5, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
      });
    expect(create.status).toBe(201);

    const confirm = await request(app)
      .patch(`/api/orders/${create.body.order.id}/recurring/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.recurring.needsConfirmation).toBe(false);
  });
});
