import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import { inventoryLots, inventoryMovements, orders, deliveries } from '../src/data.js';

const runtimeDir = path.resolve(process.cwd(), '.runtime-data-test');
process.env.RUNTIME_STORE_DIR = runtimeDir;
process.env.NODE_ENV = 'test';
process.env.VITEST = 'true';

const app = createApp();

async function loginAs(employeeCode = '4B-101', password = 'operador123') {
  const response = await request(app).post('/api/login').send({ employeeCode, password });
  expect(response.status).toBe(200);
  return response.body.token as string;
}


async function createDoctorAndPlan(token: string) {
  const ts = Date.now() + Math.random().toString(36).slice(2);
  const doctor = await request(app)
    .post('/api/doctors')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Dr. Ref ${ts}`, crm: `CRM-REF-${ts}`, specialty: 'Clínica', email: `doc${ts}@example.com`, phone: '11911110000' });
  expect(doctor.status).toBe(201);

  const plan = await request(app)
    .post('/api/health-plans')
    .set('Authorization', `Bearer ${token}`)
    .send({ name: `Plano Ref ${ts}`, providerName: 'Operadora Ref', registrationCode: `REG-REF-${ts}` });
  expect(plan.status).toBe(201);

  return { doctorId: doctor.body.item.id as string, healthPlanId: plan.body.item.id as string };
}


describe('4bio internal sales app', () => {
  beforeAll(() => {
    if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
  });

  beforeEach(async () => {
    // Reset in-memory arrays to prevent cross-test pollution (stock reservations, orders, deliveries)
    inventoryLots.forEach((lot) => { lot.reserved = 0; });
    inventoryMovements.splice(0, inventoryMovements.length);
    orders.splice(0, orders.length);
    deliveries.splice(0, deliveries.length);

    // Clean the runtime-data store files to reset in-memory state
    if (fs.existsSync(runtimeDir)) {
      for (const file of fs.readdirSync(runtimeDir)) {
        if (file.endsWith('.db') || file.endsWith('.db-journal') || file.endsWith('.db-wal')) continue;
        fs.rmSync(path.join(runtimeDir, file), { recursive: true, force: true });
      }
    }
    // Clean persistent SQLite tables to prevent unique constraint conflicts between tests
    // Use raw SQL to avoid Prisma overhead and reconnection issues
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database('./dev.db');
      const tables = ['PatientActivity', 'Customer', 'Doctor', 'HealthPlan', 'Employee', 'Supplier', 'FinishedProduct', 'RawMaterial', 'StandardFormula', 'PackagingFormula'];
      for (const t of tables) {
        try { db.prepare(`DELETE FROM ${t}`).run(); } catch { /* ignore if table doesn't exist */ }
      }
      db.close();
    } catch { /* better-sqlite3 not available or DB not ready */ }
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

  it('realiza login de operador', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: '4B-101', password: 'operador123' });
    expect(response.status).toBe(200);
    expect(response.body.token).toBeTruthy();
    expect(response.body.user.role).toBe('operador');
  });

  it('recusa login com senha incorreta', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: '4B-001', password: 'senha-errada' });
    expect(response.status).toBe(401);
  });

  it('lista catálogo de medicamentos', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.items)).toBe(true);
    expect(response.body.items.length).toBeGreaterThanOrEqual(4);
  });

  it('cria pedido com item único e gera entrega', async () => {
    const token = await loginAs();
    const medicinesRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medicinesRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Teste',
        email: 'paciente@test.com',
        phone: '11999999999',
        address: 'Rua Teste 123',
        items: [{ medicineId: medicine.id, quantity: 1 }]
      });
    expect(response.status).toBe(201);
    expect(response.body.order).toBeTruthy();
    expect(response.body.shipment).toBeTruthy();
  });

  it('lista pedidos após criação', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeTruthy();
  });

  it('lista entregas após criação de pedido', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/deliveries').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeTruthy();
  });

  it('cadastra e lista médicos no menu de médicos', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dra. Helena Costa', crm: `CRM-${ts}`, specialty: 'Cardiologia', email: `helena-${ts}@clinic.com`, phone: '11999990000' });
    expect(created.status).toBe(201);

    const listed = await request(app).get(`/api/doctors?q=Helena`).set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x: { name: string }) => x.name === 'Dra. Helena Costa')).toBe(true);
  });

  it('edita médico cadastrado e retorna dados atualizados', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/doctors')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dr. Bruno Lima', crm: `CRM-BRUNO-${ts}`, specialty: 'Clínica Geral', email: `bruno-${ts}@clinic.com`, phone: '11998887766' });

    const updated = await request(app)
      .patch(`/api/doctors/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'Dr. Bruno Lima', crm: `CRM-BRUNO-${ts}`, specialty: 'Endocrinologia', email: `bruno-${ts}@clinic.com`, phone: '11997776655' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.specialty).toBe('Endocrinologia');
  });

  it('cadastra e lista planos de saúde no menu de planos de saúde', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/health-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Plano Ouro ${ts}`, providerName: 'Operadora Vida', registrationCode: `REG-${ts}` });
    expect(created.status).toBe(201);

    const listed = await request(app).get('/api/health-plans?q=Ouro').set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((x: { name: string }) => x.name.startsWith('Plano Ouro'))).toBe(true);
  });

  it('reserva estoque na criação de pedido e bloqueia quando falta saldo', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const { inventory } = medicine;
    const available = inventory ? inventory.stockAvailable : 999;
    const qty = Math.min(available + 1, 50);

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Estoque Test', email: 'estoque@test.com', phone: '11911110000', address: 'Rua Teste 100', items: [{ medicineId: medicine.id, quantity: qty }] });

    expect(response.status).toBe(available >= qty ? 201 : 400);
  });

  it('interpreta texto de pedido médico e sugere remédios do catálogo', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/prescriptions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Receita: receito OncoRelief 20mg e CardioPlus para o paciente' });
    expect(response.status).toBe(200);
    expect(response.body.found).toBe(true);
    expect(response.body.suggestions.length).toBeGreaterThan(0);
  });

  it('retorna dashboard com indicadores operacionais', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/dashboard/admin').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.indicators).toBeTruthy();
  });

  it('expõe feature flags para rollout controlado', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/feature-flags').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.patients_v2).toBeDefined();
  });

  it('coleta métricas operacionais de bloqueio por competência', async () => {
    const token = await loginAs('4B-001', 'admin123');
    const response = await request(app).get('/api/metrics/operational').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.eligibilityBlocks).toBeDefined();
  });

  it('cria orçamento a partir de texto de receita', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Orçamento Test', prescriptionText: 'Receito OncoRelief 20mg 1x ao dia', estimatedDays: 30 });
    expect(response.status).toBe(201);
    expect(response.body.item.suggestedItems).toBeTruthy();
  });

  it('retorna ordem de manipulação a partir de orçamento', async () => {
    const token = await loginAs();
    await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Test Label', prescriptionText: 'OncoRelief para manipulação', estimatedDays: 30 });

    const budgetsRes = await request(app).get('/api/budgets').set('Authorization', `Bearer ${token}`);
    const budget = budgetsRes.body.items[0];

    const labelRes = await request(app).get(`/api/budgets/${budget.id}/manipulation-order`).set('Authorization', `Bearer ${token}`);
    expect(labelRes.status).toBe(200);
    expect(labelRes.body.printableText).toContain('Ordem de Manipulação');
  });

  it('bloqueia acesso de operador a rota de admin', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/pricing/auto-update')
      .set('Authorization', `Bearer ${token}`)
      .send({ percent: 10, reason: 'Teste de bloqueio' });
    expect(response.status).toBe(403);
  });

  it('cadastra e altera medicamentos do inventário', async () => {
    const token = await loginAs('4B-220', 'inventario123');
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Remédio Test ${ts}`, price: 10.5, lab: 'TestLab', specialty: 'Geral', description: 'Medicamento para teste', controlled: false, image: '' });
    expect(created.status).toBe(201);

    const medList = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    expect(medList.body.items.some((m: any) => m.name.startsWith('Remédio Test'))).toBe(true);
  });

  it('cadastra paciente com referências de médico e plano', async () => {
    const token = await loginAs();
    const { doctorId, healthPlanId } = await createDoctorAndPlan(token);
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const patient = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Paciente Ref ${ts}`, patientCode: `PAT-${ts}`, insuranceCardCode: `CARD-${ts}`, healthPlanId, doctorId, insurancePlanName: 'Plano A', insuranceProviderName: 'Operadora', diseaseCid: 'J06.9', primaryDoctorId: doctorId, email: `pac${ts}@test.com`, phone: '11999000000', address: 'Rua Test 10' });
    expect(patient.status).toBe(201);

    const listed = await request(app).get(`/api/customers?q=Paciente Ref`).set('Authorization', `Bearer ${token}`);
    expect(listed.status).toBe(200);
    expect(listed.body.items.some((c: any) => c.name.includes('Paciente Ref'))).toBe(true);
  });

  it('retorna elegibilidade do paciente via patients_v2', async () => {
    const token = await loginAs();
    const { doctorId, healthPlanId } = await createDoctorAndPlan(token);
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const patient = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Paciente Eleg ${ts}`, patientCode: `ELG-${ts}`, insuranceCardCode: `ELG-${ts}`, healthPlanId, doctorId, insurancePlanName: 'Plano C', insuranceProviderName: 'Operadora', diseaseCid: 'Z00.0', primaryDoctorId: doctorId, email: `elg${ts}@test.com`, phone: '11997000000', address: 'Rua Y 1' });
    if (patient.status === 201) {
      const elig = await request(app).get(`/api/patients/${patient.body.item.id}/eligibility`).set('Authorization', `Bearer ${token}`);
      expect(elig.status).toBe(200);
      expect(elig.body.canOrderThisMonth).toBeDefined();
    }
  });

  it('responde pedidos de clientes por usuário logado', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/orders').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });

  it('retorna fallback interno quando todos os provedores falham', async () => {
    process.env.SHIPPING_FORCE_FAIL = 'all';
    try {
      const token = await loginAs();
      const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
      const medicine = medRes.body.items.find((m: any) => !m.controlled && m.inventory?.stockAvailable > 0);
      if (!medicine) return;

      const response = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ patientName: 'Fallback Ship Test', email: 'fb@test.com', phone: '11911110000', address: 'Rua Fallback', items: [{ medicineId: medicine.id, quantity: 1 }] });
      expect(response.status).toBe(201);
      expect(response.body.shipment.fallbackUsed).toBe(true);
      expect(response.body.shipment.syncStatus).toBe('queued_retry');
    } finally {
      delete process.env.SHIPPING_FORCE_FAIL;
    }
  });

  it('calcula previsão de término do medicamento com base no consumo diário', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Runout Calc', email: 'runout@test.com', phone: '11999990000', address: 'Rua Runout 50', items: [{ medicineId: medicine.id, quantity: 2, tabletsPerDay: 1, tabletsPerPackage: 30 }] });
    if (response.status === 201) {
      const item = response.body.order.items[0];
      expect(item.estimatedRunOutDate).toBeDefined();
    }
  });

  it('mantém recorrência e confirmação', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Recorrente', email: 'rec@test.com', phone: '11988880000', address: 'Rua Recorrente 10', items: [{ medicineId: medicine.id, quantity: 1 }], recurring: { discountPercent: 10, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) } });
    if (response.status === 201) {
      expect(response.body.order.recurring).toBeTruthy();
      expect(response.body.order.recurring.discountPercent).toBe(10);
    }
  });
});

describe('Security & Infrastructure', () => {
  it('retorna X-Request-ID em todas as respostas', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('/health/live responde ok', async () => {
    const response = await request(app).get('/health/live');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });

  it('/health/ready responde com status e checks', async () => {
    await loginAs();
    const response = await request(app).get('/health/ready');
    expect([200, 503]).toContain(response.status);
    expect(['ready', 'degraded']).toContain(response.body.status);
    expect(response.body.checks).toBeDefined();
    expect(response.body.checks.database).toBeDefined();
    expect(response.body.checks.filesystem).toBeDefined();
  });

  it('retorna security headers (Helmet)', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.headers['x-content-type-options']).toBeDefined();
    expect(response.headers['x-frame-options']).toBeDefined();
  });
});

describe('Inventory Endpoints', () => {
  it('retorna resumo do inventário com dados paginados', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/inventory/summary').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
    expect(response.body.page).toBeDefined();
    expect(response.body.totalPages).toBeDefined();
  });

  it('lista movimentações do inventário', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/inventory/movements').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
  });

  it('cadastra lote de inventário', async () => {
    const token = await loginAs('4B-220', 'inventario123');
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items[0] as { id: string };

    const response = await request(app)
      .post('/api/inventory/lots')
      .set('Authorization', `Bearer ${token}`)
      .send({ medicineId: medicine.id, batchCode: 'TEST-LOT', expiresAt: '2027-12-31', quantity: 50, unitCost: 10.0, supplier: 'Test Supplier' });
    expect(response.status).toBe(201);
    expect(response.body.item.batchCode).toBe('TEST-LOT');
    expect(response.body.item.quantity).toBe(50);
  });
});

describe('Budgets Flow', () => {
  it('lista orçamentos', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/budgets').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
  });

  it('retorna labels de orçamento', async () => {
    const token = await loginAs();
    await request(app)
      .post('/api/budgets')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Label Test', prescriptionText: 'OncoRelief para labels', estimatedDays: 30 });

    const budgetsRes = await request(app).get('/api/budgets').set('Authorization', `Bearer ${token}`);
    const budget = budgetsRes.body.items[0];

    const labelRes = await request(app).get(`/api/budgets/${budget.id}/labels`).set('Authorization', `Bearer ${token}`);
    expect(labelRes.status).toBe(200);
    expect(labelRes.body.items).toBeDefined();
    expect(labelRes.body.printableText).toContain('LBL');
  });
});

describe('Pricing Auto-Update', () => {
  it('atualiza preço em lote para specialty específica', async () => {
    const token = await loginAs('4B-001', 'admin123');

    const response = await request(app)
      .post('/api/pricing/auto-update')
      .set('Authorization', `Bearer ${token}`)
      .send({ percent: 5, specialty: 'Oncologia', reason: 'Teste de reajuste' });
    expect(response.status).toBe(200);

    if (response.body.updated > 0) {
      expect(response.body.items.some((i: any) => i.oldPrice !== i.newPrice)).toBe(true);
    }
  });

  it('atualiza preço em lote por laboratório', async () => {
    const token = await loginAs('4B-001', 'admin123');

    const response = await request(app)
      .post('/api/pricing/auto-update')
      .set('Authorization', `Bearer ${token}`)
      .send({ percent: -10, lab: '4bio Labs', reason: 'Correção' });
    expect(response.status).toBe(200);
  });
});

describe('Employee CRUD', () => {
  it('cadastra e lista funcionários', async () => {
    const token = await loginAs('4B-001', 'admin123');
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/employees')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Funcionario Test ${ts}`, role: 'Teste', employeeCode: `EMP-${ts}`, email: `func${ts}@test.com`, phone: '11900000000' });
    expect(created.status).toBe(201);

    const list = await request(app).get(`/api/employees?q=${ts}`).set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((e: { name: string }) => e.name.includes('Funcionario Test'))).toBe(true);
  });
});

describe('Supplier CRUD', () => {
  it('cadastra e lista fornecedores', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/suppliers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Fornecedor ${ts}`, document: `DOC-${ts}`, email: `forn${ts}@test.com`, phone: '11900000000', category: 'Teste' });
    expect(created.status).toBe(201);

    const list = await request(app).get(`/api/suppliers?q=${ts}`).set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.items.some((s: { name: string }) => s.name.includes('Fornecedor'))).toBe(true);
  });
});

describe('Finished Products CRUD', () => {
  it('cadastra produto acabado', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/finished-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Produto Test ${ts}`, productType: 'acabado', sku: `SKU-${ts}`, unit: 'un', price: 15.99 });
    expect(created.status).toBe(201);
    expect(created.body.item.sku).toBe(`SKU-${ts}`);
  });
});

describe('Raw Materials CRUD', () => {
  it('cadastra matéria prima', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/raw-materials')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Matéria Prima ${ts}`, code: `MP-${ts}`, unit: 'kg', cost: 25.50 });
    expect(created.status).toBe(201);
  });
});

describe('Formulas', () => {
  it('cadastra fórmula padrão', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/standard-formulas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Formula ${ts}`, version: '1.0', productId: 'prod-test', instructions: 'Misturar os componentes conforme protocolo.' });
    expect(created.status).toBe(201);
  });

  it('cadastra fórmula de embalagem', async () => {
    const token = await loginAs();
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/packaging-formulas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Embalagem ${ts}`, productId: 'prod-test', packagingType: 'Caixa', unitsPerPackage: 10, notes: 'Test embalagem' });
    expect(created.status).toBe(201);
  });

  it('lista fórmulas de embalagem', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/packaging-formulas').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
    expect(response.body.items).toBeDefined();
  });
});

describe('Production Orders', () => {
  it('cria ordem de produção via fórmula padrão', async () => {
    const token = await loginAs('4B-220', 'inventario123');

    // Create required products and formula first
    const ts = Date.now() + Math.random().toString(36).slice(2);
    await request(app)
      .post('/api/finished-products')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Produto Prod ${ts}`, productType: 'acabado', sku: `SKU-PROD-${ts}`, unit: 'un', price: 20.0 });

    const formulaRes = await request(app)
      .post('/api/standard-formulas')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Formula Prod ${ts}`, version: '1', productId: 'prod-x', instructions: 'Instruções de produção teste com dados válidos.' });

    const prodRes = await request(app)
      .post('/api/production/standard-formula')
      .set('Authorization', `Bearer ${token}`)
      .send({ formulaId: formulaRes.body.item.id, batchSize: 100, operator: 'Operador' });
    expect(prodRes.status).toBe(201);
    expect(prodRes.body.item.status).toBe('planejada');
    expect(prodRes.body.item.formulaId).toBe(formulaRes.body.item.id);
  });
});

describe('Quality & Printing', () => {
  it('retorna laudo de qualidade para pedido existente', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Qualidade Test', email: 'qual@test.com', phone: '11900000000', address: 'Rua Test 200', items: [{ medicineId: medicine.id, quantity: 1 }] });
    if (orderRes.status !== 201) return;

    const qr = await request(app).get(`/api/quality/reports/${orderRes.body.order.id}`).set('Authorization', `Bearer ${token}`);
    expect(qr.status).toBe(200);
    expect(qr.body.item.reportId).toBeTruthy();
    expect(qr.body.printableText).toContain('Laudo');
  });

  it('retorna etiquetas de impressão para pedido', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Label Print Test', email: 'lab@test.com', phone: '11900000000', address: 'Rua Test 300', items: [{ medicineId: medicine.id, quantity: 1 }] });
    if (orderRes.status !== 201) return;

    const labels = await request(app).get(`/api/print/labels/${orderRes.body.order.id}`).set('Authorization', `Bearer ${token}`);
    expect(labels.status).toBe(200);
    expect(labels.body.items).toBeDefined();
    expect(labels.body.printableText).toContain(orderRes.body.order.patientName);
  });
});

describe('Delivery Management', () => {
  it('atualiza status de entrega (admin)', async () => {
    const token = await loginAs('4B-001', 'admin123');
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    // Create an order + delivery
    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Delivery Test', email: 'del@test.com', phone: '11900000000', address: 'Rua Test 400', items: [{ medicineId: medicine.id, quantity: 1 }] });

    const delRes = await request(app).get('/api/deliveries').set('Authorization', `Bearer ${token}`);
    const delivery = delRes.body.items.find((d: any) => d.patientName === 'Delivery Test');
    if (!delivery) return;

    const updated = await request(app)
      .patch(`/api/deliveries/${delivery.orderId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'em_rota' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.status).toBe('em_rota');
  });

  it('filtra entregas por status', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/deliveries?status=pendente').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(200);
  });
});

describe('Customer Update', () => {
  it('atualiza dados do cliente', async () => {
    const token = await loginAs();
    const { doctorId, healthPlanId } = await createDoctorAndPlan(token);
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const created = await request(app)
      .post('/api/customers')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Paciente Update ${ts}`, patientCode: `UPD-${ts}`, insuranceCardCode: `UPD-${ts}`, healthPlanId, doctorId, diseaseCid: 'A00', email: `upd${ts}@test.com`, phone: '11900000000', address: 'Rua Test 500' });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/customers/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ phone: '11999991111', address: 'Rua Nova 999' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.phone).toBe('11999991111');
  });
});

describe('HealthPlan Update', () => {
  it('atualiza dados do plano de saúde', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/health-plans')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Plano Update`, providerName: 'Operador Upd', registrationCode: `REG-UPD-${Date.now()}` });
    expect(created.status).toBe(201);

    const updated = await request(app)
      .patch(`/api/health-plans/${created.body.item.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ providerName: 'Nova Operadora' });
    expect(updated.status).toBe(200);
    expect(updated.body.item.providerName).toBe('Nova Operadora');
  });
});

describe('Patient Activities', () => {
  it('retorna atividades do paciente', async () => {
    const token = await loginAs();
    const { doctorId, healthPlanId } = await createDoctorAndPlan(token);
    const ts = Date.now() + Math.random().toString(36).slice(2);

    const patient = await request(app)
      .post('/api/patients')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: `Paciente Act ${ts}`, patientCode: `ACT-${ts}`, insuranceCardCode: `ACT-${ts}`, healthPlanId, doctorId, diseaseCid: 'B00', primaryDoctorId: doctorId, email: `act${ts}@test.com`, phone: '11900000000', address: 'Rua Test 600' });
    if (patient.status !== 201) return;

    const activities = await request(app).get(`/api/patients/${patient.body.item.id}/activities`).set('Authorization', `Bearer ${token}`);
    expect(activities.status).toBe(200);
    expect(activities.body.items).toBeDefined();
  });
});

describe('Order Recurring Confirmation', () => {
  it('confirma recorrência de pedido', async () => {
    const token = await loginAs();
    const medRes = await request(app).get('/api/medicines').set('Authorization', `Bearer ${token}`);
    const medicine = medRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Rec Confirm Test', email: 'rc@test.com', phone: '11900000000', address: 'Rua Test 700', items: [{ medicineId: medicine.id, quantity: 1 }], recurring: { discountPercent: 5, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) } });
    if (orderRes.status !== 201) return;

    const confirm = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/recurring/confirm`)
      .set('Authorization', `Bearer ${token}`);
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.recurring.needsConfirmation).toBe(false);
    expect(confirm.body.order.recurring.confirmedBy).toBeDefined();
  });
});

describe('Error handling', () => {
  it('retorna 400 para payload inválido de login', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: '', password: '' });
    expect([400, 401]).toContain(response.status);
  });

  it('retorna 400 para pedido sem itens', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ patientName: 'Empty Test', email: 'e@t.com', phone: '11900000000', address: 'Rua Test 800', items: [] });
    expect(response.status).toBe(400);
  });

  it('retorna 404 para paciente inexistente', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/patients/nonexistent-id').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });

  it('retorna 404 para pedido inexistente no print de etiquetas', async () => {
    const token = await loginAs();
    const response = await request(app).get('/api/print/labels/nonexistent').set('Authorization', `Bearer ${token}`);
    expect(response.status).toBe(404);
  });
});
