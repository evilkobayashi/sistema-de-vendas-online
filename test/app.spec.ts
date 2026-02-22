import request from 'supertest';
import { createApp } from '../src/app';

describe('app observability and contracts', () => {
  it('returns stable error payload contract', async () => {
    const app = createApp({ db: async () => true, queue: async () => true });

    const response = await request(app).get('/boom').expect(400);

    expect(response.body).toEqual({
      code: 'INVALID_ORDER',
      message: 'Pedido inválido',
      details: { field: 'id' }
    });
    expect(response.headers['x-request-id']).toBeDefined();
  });

  it('smoke tests health endpoints and readiness degradation', async () => {
    const healthy = createApp({ db: async () => true, queue: async () => true });
    await request(healthy).get('/health/live').expect(200, { status: 'live' });
    await request(healthy)
      .get('/health/ready')
      .expect(200, { status: 'ready', dependencies: { db: true, queue: true } });

    const degraded = createApp({ db: async () => true, queue: async () => false });
    await request(degraded)
      .get('/health/ready')
      .expect(503, { status: 'degraded', dependencies: { db: true, queue: false } });
  });
});
