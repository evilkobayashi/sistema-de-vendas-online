import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const testStoreDir = fs.mkdtempSync(path.join(os.tmpdir(), '4bio-store-'));
process.env.RUNTIME_STORE_DIR = testStoreDir;

describe('4bio API', () => {
  const app = createApp();

  async function loginAs(code = '4B-101', password = 'operador123') {
    const response = await request(app).post('/api/login').send({ employeeCode: code, password });
    expect(response.status).toBe(200);
    return response.body.token as string;
  }

  it('serve index.html na raiz', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('4BIO | Sistema Interno de Compras');
  });

  it('protege APIs sem token', async () => {
    const response = await request(app).get('/api/orders');
    expect(response.status).toBe(401);
  });

  it('autentica usuário válido e retorna token', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: '4B-101', password: 'operador123' });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('operador');
    expect(typeof response.body.token).toBe('string');
  });

  it('bloqueia venda controlada sem receita', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Teste',
        email: 'paciente@example.com',
        phone: '11999999999',
        address: 'Rua A, 10',
        items: [{ medicineId: 'm1', quantity: 1 }]
      });

    expect(response.status).toBe(400);
  });

  it('cria pedido e entrega quando dados válidos', async () => {
    const token = await loginAs();
    const response = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Teste 2',
        email: 'paciente2@example.com',
        phone: '11999999998',
        address: 'Rua B, 20',
        items: [{ medicineId: 'm2', quantity: 2 }],
        recurring: { discountPercent: 10, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
      });

    expect(response.status).toBe(201);
    expect(response.body.order.total).toBe(161.82);

    const deliveries = await request(app).get('/api/deliveries').set('Authorization', `Bearer ${token}`);
    expect(deliveries.body.items.length).toBeGreaterThan(0);
  });

  it('gera lembrete de recorrência e permite confirmação pelo colaborador', async () => {
    const token = await loginAs();
    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Recorrente',
        email: 'recorrente@example.com',
        phone: '11999999997',
        address: 'Rua C, 30',
        items: [{ medicineId: 'm2', quantity: 1 }],
        recurring: { discountPercent: 5, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
      });

    expect(create.status).toBe(201);

    const dashboardBefore = await request(app).get('/api/dashboard/operador').set('Authorization', `Bearer ${token}`);
    const reminder = dashboardBefore.body.reminders.find((x: { orderId: string }) => x.orderId === create.body.order.id);
    expect(reminder).toBeTruthy();

    const confirm = await request(app)
      .patch(`/api/orders/${create.body.order.id}/recurring/confirm`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(confirm.status).toBe(200);
    expect(confirm.body.order.recurring.needsConfirmation).toBe(false);

    const dashboardAfter = await request(app).get('/api/dashboard/operador').set('Authorization', `Bearer ${token}`);
    const reminderAfter = dashboardAfter.body.reminders.find((x: { orderId: string }) => x.orderId === create.body.order.id);
    expect(reminderAfter).toBeFalsy();
  });

  it('aplica RBAC em atualização de entrega', async () => {
    const operadorToken = await loginAs('4B-101', 'operador123');
    const gerenteToken = await loginAs('4B-014', 'gerente123');

    const create = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({
        patientName: 'Paciente RBAC',
        email: 'rbac@example.com',
        phone: '11999999995',
        address: 'Rua D, 40',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });

    const orderId = create.body.order.id;

    const blocked = await request(app)
      .patch(`/api/deliveries/${orderId}`)
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({ status: 'em_rota' });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .patch(`/api/deliveries/${orderId}`)
      .set('Authorization', `Bearer ${gerenteToken}`)
      .send({ status: 'em_rota' });
    expect(allowed.status).toBe(200);
  });

  it('permite gerente adicionar medicamento com imagem e bloqueia operador', async () => {
    const operadorToken = await loginAs('4B-101', 'operador123');
    const gerenteToken = await loginAs('4B-014', 'gerente123');

    const blocked = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${operadorToken}`)
      .send({
        name: 'Novo Med Operador',
        price: 99.9,
        lab: 'Lab X',
        specialty: 'Cardiologia',
        controlled: false,
        image: 'https://picsum.photos/seed/newmed/320/220'
      });
    expect(blocked.status).toBe(403);

    const allowed = await request(app)
      .post('/api/medicines')
      .set('Authorization', `Bearer ${gerenteToken}`)
      .send({
        name: 'Novo Med Gerente',
        price: 99.9,
        lab: 'Lab X',
        specialty: 'Cardiologia',
        controlled: false,
        image: 'https://picsum.photos/seed/newmed-ok/320/220'
      });
    expect(allowed.status).toBe(201);
    expect(allowed.body.item.image).toContain('https://picsum.photos');
  });

  it('mantém dados após reinicialização da aplicação (persistência em disco)', async () => {
    const token = await loginAs();

    const created = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({
        patientName: 'Paciente Persistente',
        email: 'persistente@example.com',
        phone: '11999999994',
        address: 'Rua Persistência, 50',
        items: [{ medicineId: 'm2', quantity: 1 }]
      });
    expect(created.status).toBe(201);

    const appRestarted = createApp();
    const relogin = await request(appRestarted).post('/api/login').send({ employeeCode: '4B-101', password: 'operador123' });
    const restartedToken = relogin.body.token;

    const ordersAfterRestart = await request(appRestarted)
      .get('/api/orders?page=1&pageSize=100')
      .set('Authorization', `Bearer ${restartedToken}`);

    const found = ordersAfterRestart.body.items.find((o: { id: string }) => o.id === created.body.order.id);
    expect(found).toBeTruthy();
  });
});
