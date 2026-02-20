import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

describe('4bio API', () => {
  const app = createApp();

  it('serve index.html na raiz', async () => {
    const response = await request(app).get('/');
    expect(response.status).toBe(200);
    expect(response.text).toContain('4bio | Sistema Interno');
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

  it('cria pedido e entrega quando dados válidos', async () => {
    const response = await request(app).post('/api/orders').send({
      userId: 'u3',
      patientName: 'Paciente Teste 2',
      email: 'paciente2@example.com',
      phone: '11999999998',
      address: 'Rua B, 20',
      items: [{ medicineId: 'm2', quantity: 2 }],
      recurring: { discountPercent: 10, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10) }
    });

    expect(response.status).toBe(201);
    expect(response.body.order.total).toBe(161.82);

    const deliveries = await request(app).get('/api/deliveries');
    expect(deliveries.body.items.length).toBeGreaterThan(0);
  });
});
