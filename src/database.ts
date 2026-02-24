import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Customer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
};

let db: Database.Database | null = null;

function resolveDbPath() {
  const dir = process.env.RUNTIME_STORE_DIR || path.resolve(process.cwd(), '.runtime-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'app.db');
}

export function initDatabase() {
  if (db) return db;
  db = new Database(resolveDbPath());
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
  `);
  return db;
}

export function listCustomers(search?: string) {
  const conn = initDatabase();
  if (search && search.trim()) {
    const q = `%${search.trim()}%`;
    return conn
      .prepare(
        `SELECT id, name, email, phone, address, created_at as createdAt
         FROM customers
         WHERE name LIKE ? OR email LIKE ? OR phone LIKE ?
         ORDER BY name ASC`
      )
      .all(q, q, q) as Customer[];
  }

  return conn
    .prepare('SELECT id, name, email, phone, address, created_at as createdAt FROM customers ORDER BY name ASC')
    .all() as Customer[];
}

export function getCustomerById(id: string) {
  const conn = initDatabase();
  return conn
    .prepare('SELECT id, name, email, phone, address, created_at as createdAt FROM customers WHERE id = ?')
    .get(id) as Customer | undefined;
}

export function createCustomer(input: Omit<Customer, 'id' | 'createdAt'>) {
  const conn = initDatabase();
  const customer: Customer = {
    id: `c-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`,
    ...input,
    createdAt: new Date().toISOString()
  };

  conn
    .prepare('INSERT INTO customers (id, name, email, phone, address, created_at) VALUES (?, ?, ?, ?, ?, ?)')
    .run(customer.id, customer.name, customer.email, customer.phone, customer.address, customer.createdAt);

  return customer;
}


export function updateCustomer(id: string, input: Omit<Customer, 'id' | 'createdAt'>) {
  const conn = initDatabase();
  const exists = getCustomerById(id);
  if (!exists) return undefined;

  conn
    .prepare('UPDATE customers SET name = ?, email = ?, phone = ?, address = ? WHERE id = ?')
    .run(input.name, input.email, input.phone, input.address, id);

  return getCustomerById(id);
}
