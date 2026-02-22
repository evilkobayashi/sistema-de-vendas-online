import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('4bio API', () => {
  const app = createApp();

  it('serve index.html na raiz', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('4BIO | Sistema Interno de Compras');
  });

  it('autentica usuário válido', async () => {
    const response = await request(app).post('/api/login').send({ employeeCode: '4B-101', password: 'operador123' });
    expect(response.status).toBe(200);
    expect(response.body.user.role).toBe('operador');
  });

  it('bloqueia venda controlada sem receita', async () => {
    const response = await request(app).post('/api/orders').send({
      userId: 'u3',
      patientName: 'Paciente Teste',
      email: 'paciente@example.com',
      phone: '11999999999',
      address: 'Rua A, 10',
      items: [{ medicineId: 'm1', quantity: 1 }]
    });

    expect(response.status).toBe(400);
  });

  it('ativa recorrência e permite confirmação com aviso de 3 dias', async () => {
    const response = await request(app).post('/api/orders').send({
      userId: 'u3',
      patientName: 'Paciente Recorrente',
      email: 'recorrente@example.com',
      phone: '11988887777',
      address: 'Rua C, 30',
      items: [{ medicineId: 'm2', quantity: 2 }],
      recurring: { discountPercent: 10, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
    });

    expect(response.status).toBe(201);

    const dashboardBefore = await request(app).get('/api/dashboard/operador');
    expect(dashboardBefore.body.reminders.length).toBeGreaterThan(0);

    const orderId = response.body.order.id;
    const confirm = await request(app)
      .post(`/api/orders/${orderId}/recurrence-confirmation`)
      .send({ confirmedBy: 'u3' });

    expect(confirm.status).toBe(200);

    const dashboardAfter = await request(app).get('/api/dashboard/operador');
    const stillPending = dashboardAfter.body.reminders.find((x: { orderId: string }) => x.orderId === orderId);
    expect(stillPending).toBeUndefined();
  });
});
