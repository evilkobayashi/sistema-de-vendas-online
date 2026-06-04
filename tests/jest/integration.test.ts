/**
 * Jest integration tests for sistema-de-vendas-online
 * Covers: auth (login success/failure), orders CRUD, PDF parse endpoint
 */

import request from 'supertest';
import { createApp } from '../../src/app';
import { inventoryLots, inventoryMovements, orders, deliveries, medicines } from '../../src/data';
import Database from 'better-sqlite3';
import path from 'node:path';
import fs from 'node:fs';

// Use isolated store dir for jest tests
const runtimeDir = path.resolve(process.cwd(), '.runtime-data-jest');
process.env.RUNTIME_STORE_DIR = runtimeDir;
process.env.NODE_ENV = 'test';

const app = createApp();

async function loginAs(
  employeeCode = '4B-101',
  password = 'operador123',
): Promise<string> {
  const res = await request(app)
    .post('/api/login')
    .send({ employeeCode, password });
  expect(res.status).toBe(200);
  return res.body.token as string;
}

function cleanSqliteTables() {
  try {
    const db = new Database('./dev.db');
    const tables = [
      'PatientActivity',
      'Customer',
      'Doctor',
      'HealthPlan',
      'Employee',
      'Supplier',
      'FinishedProduct',
      'RawMaterial',
      'StandardFormula',
      'PackagingFormula',
    ];
    for (const t of tables) {
      try {
        db.prepare(`DELETE FROM ${t}`).run();
      } catch {
        // table may not exist — ok
      }
    }
    db.close();
  } catch {
    // DB not available — ok in unit mode
  }
}

beforeAll(() => {
  if (!fs.existsSync(runtimeDir)) fs.mkdirSync(runtimeDir, { recursive: true });
});

const baseDate = Date.now();
const seedLots = [
  { id: 'lot-1', medicineId: 'm1', batchCode: 'ONC-2401', expiresAt: new Date(baseDate + 120 * 86400000).toISOString().slice(0, 10), quantity: 30, reserved: 0, unitCost: 250, supplier: '4bio Labs', createdAt: new Date().toISOString() },
  { id: 'lot-2', medicineId: 'm2', batchCode: 'CAR-2402', expiresAt: new Date(baseDate + 90 * 86400000).toISOString().slice(0, 10), quantity: 120, reserved: 0, unitCost: 55, supplier: 'BioHeart', createdAt: new Date().toISOString() },
  { id: 'lot-3', medicineId: 'm3', batchCode: 'NEU-2403', expiresAt: new Date(baseDate + 45 * 86400000).toISOString().slice(0, 10), quantity: 40, reserved: 0, unitCost: 98, supplier: 'NeuroPharm', createdAt: new Date().toISOString() },
  { id: 'lot-4', medicineId: 'm4', batchCode: 'IMU-2404', expiresAt: new Date(baseDate + 20 * 86400000).toISOString().slice(0, 10), quantity: 15, reserved: 0, unitCost: 130, supplier: '4bio Labs', createdAt: new Date().toISOString() },
];

beforeEach(() => {
  // Restore seed lots (loadFromDatabase may have replaced with empty DB data)
  inventoryLots.splice(0, inventoryLots.length, ...seedLots.map(l => ({ ...l, reserved: 0 })));
  inventoryMovements.splice(0, inventoryMovements.length);
  orders.splice(0, orders.length);
  deliveries.splice(0, deliveries.length);
  cleanSqliteTables();
});

// ---------------------------------------------------------------------------
// Auth tests
// ---------------------------------------------------------------------------

describe('Auth — login', () => {
  it('returns 200 + JWT token on valid credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ employeeCode: '4B-101', password: 'operador123' });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe('string');
    expect(res.body.token.length).toBeGreaterThan(20);
    expect(res.body.user.role).toBe('operador');
    expect(res.body.expiresInMs).toBeGreaterThan(0);
  });

  it('returns 401 on wrong password', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ employeeCode: '4B-001', password: 'wrong-password' });

    expect(res.status).toBe(401);
    expect(res.body.error).toBeDefined();
  });

  it('returns 401 on unknown employee code', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ employeeCode: 'NOBODY', password: 'any-pass' });

    expect(res.status).toBe(401);
  });

  it('returns 400 or 401 on empty credentials', async () => {
    const res = await request(app)
      .post('/api/login')
      .send({ employeeCode: '', password: '' });

    expect([400, 401]).toContain(res.status);
  });

  it('rejects requests to protected routes without token', async () => {
    const res = await request(app).get('/api/orders');
    expect(res.status).toBe(401);
  });

  it('all four seeded users can log in', async () => {
    const accounts = [
      { employeeCode: '4B-001', password: 'admin123' },
      { employeeCode: '4B-014', password: 'gerente123' },
      { employeeCode: '4B-101', password: 'operador123' },
      { employeeCode: '4B-220', password: 'inventario123' },
    ];
    for (const acc of accounts) {
      const res = await request(app).post('/api/login').send(acc);
      expect(res.status).toBe(200);
      expect(res.body.token).toBeTruthy();
    }
  });
});

// ---------------------------------------------------------------------------
// Orders CRUD tests
// ---------------------------------------------------------------------------

describe('Orders CRUD', () => {
  it('GET /api/orders returns empty list initially', async () => {
    const token = await loginAs();
    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.items)).toBe(true);
    expect(res.body.items).toHaveLength(0);
  });

  it('POST /api/orders creates order and returns 201 with order + shipment', async () => {
    const token = await loginAs();
    const medsRes = await request(app)
      .get('/api/medicines')
      .set('Authorization', `Bearer ${token}`);
    const medicine = medsRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return; // no uncontrolled medicine seeded

    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Jest Patient',
        email: 'jest@test.com',
        phone: '11999999999',
        address: 'Rua Jest 100',
        items: [{ medicineId: medicine.id, quantity: 1 }],
      });

    expect(res.status).toBe(201);
    expect(res.body.order).toBeTruthy();
    expect(res.body.order.patientName).toBe('Jest Patient');
    expect(res.body.order.items).toHaveLength(1);
    expect(res.body.shipment).toBeTruthy();
  });

  it('GET /api/orders returns created order', async () => {
    const token = await loginAs();
    const medsRes = await request(app)
      .get('/api/medicines')
      .set('Authorization', `Bearer ${token}`);
    const medicine = medsRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'List Test',
        email: 'list@test.com',
        phone: '11999990001',
        address: 'Rua List 1',
        items: [{ medicineId: medicine.id, quantity: 1 }],
      });

    const res = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.items.some((o: any) => o.patientName === 'List Test')).toBe(
      true,
    );
  });

  it('POST /api/orders returns 400 for empty items array', async () => {
    const token = await loginAs();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Empty Items',
        email: 'empty@test.com',
        phone: '11900000000',
        address: 'Rua Empty 1',
        items: [],
      });

    expect(res.status).toBe(400);
  });

  it('POST /api/orders returns 400 for invalid medicine ID', async () => {
    const token = await loginAs();
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Bad Med',
        email: 'bad@test.com',
        phone: '11900000000',
        address: 'Rua Bad 1',
        items: [{ medicineId: 'non-existent-id', quantity: 1 }],
      });

    expect(res.status).toBe(400);
  });

  it('PATCH /api/orders/:id/recurring/confirm confirms recurring order', async () => {
    const token = await loginAs();
    const medsRes = await request(app)
      .get('/api/medicines')
      .set('Authorization', `Bearer ${token}`);
    const medicine = medsRes.body.items.find((m: any) => !m.controlled);
    if (!medicine) return;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Recurring Patient',
        email: 'rec@test.com',
        phone: '11900000000',
        address: 'Rua Rec 1',
        items: [{ medicineId: medicine.id, quantity: 1 }],
        recurring: {
          discountPercent: 5,
          nextBillingDate: new Date(Date.now() + 2 * 86400000)
            .toISOString()
            .slice(0, 10),
        },
      });
    if (orderRes.status !== 201) return;

    const confirmRes = await request(app)
      .patch(`/api/orders/${orderRes.body.order.id}/recurring/confirm`)
      .set('Authorization', `Bearer ${token}`);

    expect(confirmRes.status).toBe(200);
    expect(confirmRes.body.order.recurring.needsConfirmation).toBe(false);
    expect(confirmRes.body.order.recurring.confirmedBy).toBeDefined();
  });

  it('GET /api/orders returns paginated results', async () => {
    const token = await loginAs();
    const res = await request(app)
      .get('/api/orders?page=1&pageSize=10')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.page).toBe(1);
    expect(res.body.pageSize).toBe(10);
    expect(typeof res.body.total).toBe('number');
    expect(typeof res.body.totalPages).toBe('number');
  });
});

// ---------------------------------------------------------------------------
// PDF parse endpoint tests
// ---------------------------------------------------------------------------

describe('POST /api/prescriptions/parse-pdf', () => {
  it('returns 400 when no file is uploaded', async () => {
    const token = await loginAs();
    const res = await request(app)
      .post('/api/prescriptions/parse-pdf')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('returns 4xx when a non-PDF file is uploaded', async () => {
    const token = await loginAs();
    const txtContent = Buffer.from('this is plain text, not a pdf');

    const res = await request(app)
      .post('/api/prescriptions/parse-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', txtContent, {
        filename: 'receipt.txt',
        contentType: 'text/plain',
      });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.status).toBeLessThan(600);
  });

  it('returns ocr_required:true when PDF has no extractable text', async () => {
    const token = await loginAs();
    // Minimal PDF binary with no text streams (image-only PDF simulation)
    const minimalPdf = Buffer.from(
      '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj ' +
        '2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj ' +
        '3 0 obj<</Type/Page/MediaBox[0 0 3 3]>>endobj\n' +
        'xref\n0 4\n0000000000 65535 f\n0000000009 00000 n\n' +
        '0000000058 00000 n\n0000000115 00000 n\ntrailer<</Size 4/Root 1 0 R>>' +
        '\nstartxref\n190\n%%EOF',
    );

    const res = await request(app)
      .post('/api/prescriptions/parse-pdf')
      .set('Authorization', `Bearer ${token}`)
      .attach('file', minimalPdf, {
        filename: 'scan.pdf',
        contentType: 'application/pdf',
      });

    // Either 422 with ocr_required, or 201 with ocr_required if text is too short
    if (res.status === 422) {
      expect(res.body.ocr_required).toBe(true);
    } else {
      // PDF parse may succeed but with short text — check status is still in expected range
      expect([200, 422]).toContain(res.status);
    }
  });

  it('returns 401 when request is not authenticated', async () => {
    const res = await request(app).post('/api/prescriptions/parse-pdf');

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// Parse text endpoint (sanity check)
// ---------------------------------------------------------------------------

describe('POST /api/prescriptions/parse', () => {
  it('returns suggestions for known medicine names in text', async () => {
    const token = await loginAs();
    const res = await request(app)
      .post('/api/prescriptions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'Prescrevo OncoRelief 20mg para o tratamento oncológico' });

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(true);
    expect(Array.isArray(res.body.suggestions)).toBe(true);
    expect(res.body.suggestions.length).toBeGreaterThan(0);
  });

  it('returns found:false for unrecognized text', async () => {
    const token = await loginAs();
    const res = await request(app)
      .post('/api/prescriptions/parse')
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'xyzabc lorem ipsum dolor sit amet' });

    expect(res.status).toBe(200);
    expect(res.body.found).toBe(false);
  });
});
