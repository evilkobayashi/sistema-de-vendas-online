import request from 'supertest';
import { describe, expect, it } from 'vitest';
import app from '../src/app';

function authHeaders(userId: string, role: 'admin' | 'gerente' | 'operador') {
  return {
    'x-user-id': userId,
    'x-user-role': role,
  };
}

describe('Matriz de permissões por perfil', () => {
  it('admin acessa todos os endpoints protegidos', async () => {
    const headers = authHeaders('admin-1', 'admin');

    await request(app).post('/recorrencias/confirmacao').set(headers).expect(200);
    await request(app).patch('/entregas/123').set(headers).expect(200);
    await request(app).get('/operacional/dados-sensiveis').set(headers).expect(200);
  });

  it('gerente não acessa dados operacionais sensíveis e recebe 403 consistente', async () => {
    const headers = authHeaders('gerente-1', 'gerente');

    await request(app).post('/recorrencias/confirmacao').set(headers).expect(200);
    await request(app).patch('/entregas/123').set(headers).expect(200);

    const response = await request(app)
      .get('/operacional/dados-sensiveis')
      .set(headers)
      .expect(403);

    expect(response.body).toEqual({
      error: 'FORBIDDEN',
      message: 'Permissão insuficiente.',
    });
  });

  it('operador só confirma recorrência e recebe 403 nas demais operações', async () => {
    const headers = authHeaders('operador-1', 'operador');

    await request(app).post('/recorrencias/confirmacao').set(headers).expect(200);

    const entregaForbidden = await request(app).patch('/entregas/123').set(headers).expect(403);
    expect(entregaForbidden.body).toEqual({
      error: 'FORBIDDEN',
      message: 'Permissão insuficiente.',
    });

    const dadosForbidden = await request(app)
      .get('/operacional/dados-sensiveis')
      .set(headers)
      .expect(403);
    expect(dadosForbidden.body).toEqual({
      error: 'FORBIDDEN',
      message: 'Permissão insuficiente.',
    });
  });
});

describe('Identidade autenticada prevalece sobre userId enviado na request', () => {
  it('ignora userId enviado no body e usa o userId autenticado no token/middleware', async () => {
    const response = await request(app)
      .post('/recorrencias/confirmacao')
      .set(authHeaders('token-user-1', 'admin'))
      .send({ userId: 'forjado' })
      .expect(200);

    expect(response.body.authenticatedUserId).toBe('token-user-1');
  });

  it('ignora userId enviado em query string e usa user autenticado', async () => {
    const response = await request(app)
      .get('/operacional/dados-sensiveis?userId=forjado')
      .set(authHeaders('token-user-2', 'admin'))
      .expect(200);

    expect(response.body.authenticatedUserId).toBe('token-user-2');
  });
});
