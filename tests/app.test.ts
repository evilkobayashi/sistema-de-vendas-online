import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

async function loginAndGetAccess(app: Parameters<typeof request>[0], username: string, password: string) {
  const loginResponse = await request(app).post('/api/login').send({ username, password });
  expect(loginResponse.status).toBe(200);
  return loginResponse.body as { accessToken: string; refreshToken: string };
}

describe('auth and protected routes', () => {
  it('nega acesso sem token em rotas protegidas', async () => {
    const { app } = await createApp();

    const response = await request(app).get('/api/orders');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('ausente');
  });

  it('nega acesso com token expirado', async () => {
    const { app } = await createApp({ accessTokenTtlSeconds: 1 });
    const { accessToken } = await loginAndGetAccess(app, 'alice', 'alice-pass');

    await new Promise((resolve) => setTimeout(resolve, 1200));

    const response = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('expirado');
  });

  it('autoriza e isola dados por usuário autenticado', async () => {
    const { app } = await createApp();

    const alice = await loginAndGetAccess(app, 'alice', 'alice-pass');
    const legacy = await loginAndGetAccess(app, 'legacy-user', 'legacy-pass');

    const aliceOrders = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${alice.accessToken}`);

    const legacyOrders = await request(app)
      .get('/api/orders')
      .set('Authorization', `Bearer ${legacy.accessToken}`);

    expect(aliceOrders.status).toBe(200);
    expect(legacyOrders.status).toBe(200);

    expect(aliceOrders.body).toHaveLength(1);
    expect(aliceOrders.body[0].userId).toBe('u1');
    expect(legacyOrders.body).toHaveLength(1);
    expect(legacyOrders.body[0].userId).toBe('u2');
  });

  it('invalida refresh token após logout', async () => {
    const { app } = await createApp();
    const { refreshToken } = await loginAndGetAccess(app, 'alice', 'alice-pass');

    const logout = await request(app).post('/api/logout').send({ refreshToken });
    expect(logout.status).toBe(204);

    const refreshAttempt = await request(app).post('/api/refresh').send({ refreshToken });
    expect(refreshAttempt.status).toBe(401);
  });
});
