import fs from 'fs';
import path from 'path';
import { newDb } from 'pg-mem';
import { DatabaseClient } from '../src/db/database';

export const createTestDb = (): DatabaseClient => {
  const db = newDb({ autoCreateForeignKeyIndices: true });

  const migration = fs.readFileSync(path.join(process.cwd(), 'migrations/001_init.sql'), 'utf-8');
  db.public.none(migration);

  const pg = db.adapters.createPg();
  const pool = new pg.Pool();

  return {
    query: async <T>(text: string, values: unknown[] = []) => {
      const result = await pool.query(text, values);
      return { rows: result.rows as T[] };
    }
  };
};

export const seedTestDb = async (db: DatabaseClient): Promise<void> => {
  await db.query(
    `INSERT INTO users (id, patient_name, email) VALUES
      ('11111111-1111-1111-1111-111111111111', 'Maria Souza', 'maria@example.com'),
      ('22222222-2222-2222-2222-222222222222', 'Carlos Lima', 'carlos@example.com')`
  );

  await db.query(
    `INSERT INTO medicines (id, name, sku) VALUES
      ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Dipirona', 'MED-001'),
      ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Amoxicilina', 'MED-002')`
  );

  await db.query(
    `INSERT INTO orders (id, user_id, status, total_amount) VALUES
      ('33333333-3333-3333-3333-333333333333', '11111111-1111-1111-1111-111111111111', 'paid', 89.90)`
  );

  await db.query(
    `INSERT INTO recurring_confirmations (id, user_id, order_id, next_billing_date, active) VALUES
      ('44444444-4444-4444-4444-444444444444', '11111111-1111-1111-1111-111111111111', '33333333-3333-3333-3333-333333333333', NOW() - INTERVAL '1 day', true),
      ('55555555-5555-5555-5555-555555555555', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333', NOW() + INTERVAL '7 day', true)`
  );

  await db.query(
    `INSERT INTO deliveries (id, order_id, patient_name, status) VALUES
      ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 'Maria Souza', 'pending')`
  );
};
