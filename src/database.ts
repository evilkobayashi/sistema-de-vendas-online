import fs from 'node:fs';
import path from 'node:path';
import Database from 'better-sqlite3';

export type Customer = {
  id: string;
  name: string;
  patientCode: string;
  insuranceCardCode: string;
  healthPlanId: string;
  doctorId: string;
  insurancePlanName?: string;
  insuranceProviderName?: string;
  diseaseCid: string;
  primaryDoctorId?: string;
  email: string;
  phone: string;
  address: string;
  createdAt: string;
};

export type Doctor = {
  id: string;
  name: string;
  crm: string;
  specialty: string;
  email: string;
  phone: string;
  createdAt: string;
};

export type HealthPlan = {
  id: string;
  name: string;
  providerName: string;
  registrationCode: string;
  createdAt: string;
};

export type Employee = {
  id: string;
  name: string;
  role: string;
  employeeCode: string;
  email: string;
  phone: string;
  createdAt: string;
};

export type Supplier = {
  id: string;
  name: string;
  document: string;
  email: string;
  phone: string;
  category: string;
  createdAt: string;
};

export type FinishedProduct = {
  id: string;
  name: string;
  productType: 'acabado' | 'revenda';
  sku: string;
  unit: string;
  price: number;
  createdAt: string;
};

export type RawMaterial = {
  id: string;
  name: string;
  code: string;
  unit: string;
  cost: number;
  createdAt: string;
};

export type StandardFormula = {
  id: string;
  name: string;
  version: string;
  productId: string;
  instructions: string;
  createdAt: string;
};

export type PackagingFormula = {
  id: string;
  name: string;
  productId: string;
  packagingType: string;
  unitsPerPackage: number;
  notes: string;
  createdAt: string;
};

let db: Database.Database | null = null;

function resolveDbPath() {
  const dir = process.env.RUNTIME_STORE_DIR || path.resolve(process.cwd(), '.runtime-data');
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, 'app.db');
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 6)}`;
}

export function initDatabase() {
  if (db) return db;
  db = new Database(resolveDbPath());
  db.pragma('journal_mode = WAL');
  db.exec(`
    CREATE TABLE IF NOT EXISTS customers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      patient_code TEXT NOT NULL DEFAULT '',
      insurance_card_code TEXT NOT NULL DEFAULT '',
      health_plan_id TEXT NOT NULL DEFAULT '',
      doctor_id TEXT NOT NULL DEFAULT '',
      insurance_plan_name TEXT NOT NULL DEFAULT '',
      insurance_provider_name TEXT NOT NULL DEFAULT '',
      disease_cid TEXT NOT NULL DEFAULT '',
      primary_doctor_id TEXT NOT NULL DEFAULT '',
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      address TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(name);
    CREATE INDEX IF NOT EXISTS idx_customers_email ON customers(email);
    CREATE INDEX IF NOT EXISTS idx_customers_patient_code ON customers(patient_code);
    CREATE INDEX IF NOT EXISTS idx_customers_insurance_card_code ON customers(insurance_card_code);

    CREATE TABLE IF NOT EXISTS doctors (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      crm TEXT NOT NULL UNIQUE,
      specialty TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_doctors_name ON doctors(name);
    CREATE INDEX IF NOT EXISTS idx_doctors_crm ON doctors(crm);

    CREATE TABLE IF NOT EXISTS health_plans (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      provider_name TEXT NOT NULL,
      registration_code TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_health_plans_name ON health_plans(name);

    CREATE TABLE IF NOT EXISTS employees (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      role TEXT NOT NULL,
      employee_code TEXT NOT NULL UNIQUE,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_employees_name ON employees(name);
    CREATE INDEX IF NOT EXISTS idx_employees_code ON employees(employee_code);

    CREATE TABLE IF NOT EXISTS suppliers (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      document TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      category TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_suppliers_name ON suppliers(name);

    CREATE TABLE IF NOT EXISTS finished_products (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_type TEXT NOT NULL,
      sku TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      price REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_finished_products_name ON finished_products(name);

    CREATE TABLE IF NOT EXISTS raw_materials (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      unit TEXT NOT NULL,
      cost REAL NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_raw_materials_name ON raw_materials(name);

    CREATE TABLE IF NOT EXISTS standard_formulas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      version TEXT NOT NULL,
      product_id TEXT NOT NULL,
      instructions TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_standard_formulas_name ON standard_formulas(name);

    CREATE TABLE IF NOT EXISTS packaging_formulas (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      product_id TEXT NOT NULL,
      packaging_type TEXT NOT NULL,
      units_per_package INTEGER NOT NULL,
      notes TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_packaging_formulas_name ON packaging_formulas(name);
  `);

  ensureCustomerColumn('patient_code', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('insurance_card_code', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('health_plan_id', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('doctor_id', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('insurance_plan_name', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('insurance_provider_name', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('disease_cid', "TEXT NOT NULL DEFAULT ''");
  ensureCustomerColumn('primary_doctor_id', "TEXT NOT NULL DEFAULT ''");
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_patient_code ON customers(patient_code);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_insurance_card_code ON customers(insurance_card_code);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_health_plan_id ON customers(health_plan_id);');
  db.exec('CREATE INDEX IF NOT EXISTS idx_customers_doctor_id ON customers(doctor_id);');

  return db;
}


function ensureCustomerColumn(columnName: string, columnSpec: string) {
  const conn = initDatabase();
  const columns = conn.prepare('PRAGMA table_info(customers)').all() as Array<{ name: string }>;
  if (!columns.some((c) => c.name === columnName)) {
    conn.exec(`ALTER TABLE customers ADD COLUMN ${columnName} ${columnSpec}`);
  }
}

export function listCustomers(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,patient_code as patientCode,insurance_card_code as insuranceCardCode,health_plan_id as healthPlanId,doctor_id as doctorId,insurance_plan_name as insurancePlanName,insurance_provider_name as insuranceProviderName,disease_cid as diseaseCid,primary_doctor_id as primaryDoctorId,email,phone,address,created_at as createdAt FROM customers WHERE name LIKE ? OR email LIKE ? OR phone LIKE ? OR patient_code LIKE ? OR insurance_card_code LIKE ? ORDER BY name ASC`).all(q, q, q, q, q) as Customer[];
  }
  return conn.prepare('SELECT id,name,patient_code as patientCode,insurance_card_code as insuranceCardCode,health_plan_id as healthPlanId,doctor_id as doctorId,insurance_plan_name as insurancePlanName,insurance_provider_name as insuranceProviderName,disease_cid as diseaseCid,primary_doctor_id as primaryDoctorId,email,phone,address,created_at as createdAt FROM customers ORDER BY name ASC').all() as Customer[];
}

export function getCustomerById(id: string) {
  return initDatabase().prepare('SELECT id,name,patient_code as patientCode,insurance_card_code as insuranceCardCode,health_plan_id as healthPlanId,doctor_id as doctorId,insurance_plan_name as insurancePlanName,insurance_provider_name as insuranceProviderName,disease_cid as diseaseCid,primary_doctor_id as primaryDoctorId,email,phone,address,created_at as createdAt FROM customers WHERE id = ?').get(id) as Customer | undefined;
}

export function createCustomer(input: Omit<Customer, 'id' | 'createdAt'>) {
  const item: Customer = { id: makeId('c'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO customers (id,name,patient_code,insurance_card_code,health_plan_id,doctor_id,insurance_plan_name,insurance_provider_name,disease_cid,primary_doctor_id,email,phone,address,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(item.id, item.name, item.patientCode, item.insuranceCardCode, item.healthPlanId, item.doctorId, item.insurancePlanName || '', item.insuranceProviderName || '', item.diseaseCid, item.primaryDoctorId || '', item.email, item.phone, item.address, item.createdAt);
  return item;
}

export function updateCustomer(id: string, input: Omit<Customer, 'id' | 'createdAt'>) {
  const exists = getCustomerById(id);
  if (!exists) return undefined;
  initDatabase().prepare('UPDATE customers SET name=?,patient_code=?,insurance_card_code=?,health_plan_id=?,doctor_id=?,insurance_plan_name=?,insurance_provider_name=?,disease_cid=?,primary_doctor_id=?,email=?,phone=?,address=? WHERE id=?').run(input.name, input.patientCode, input.insuranceCardCode, input.healthPlanId, input.doctorId, input.insurancePlanName || '', input.insuranceProviderName || '', input.diseaseCid, input.primaryDoctorId || '', input.email, input.phone, input.address, id);
  return getCustomerById(id);
}

export function listDoctors(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,crm,specialty,email,phone,created_at as createdAt FROM doctors WHERE name LIKE ? OR crm LIKE ? OR specialty LIKE ? ORDER BY name ASC`).all(q, q, q) as Doctor[];
  }
  return conn.prepare('SELECT id,name,crm,specialty,email,phone,created_at as createdAt FROM doctors ORDER BY name ASC').all() as Doctor[];
}

export function getDoctorById(id: string) {
  return initDatabase().prepare('SELECT id,name,crm,specialty,email,phone,created_at as createdAt FROM doctors WHERE id = ?').get(id) as Doctor | undefined;
}

export function createDoctor(input: Omit<Doctor, 'id' | 'createdAt'>) {
  const item: Doctor = { id: makeId('d'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO doctors (id,name,crm,specialty,email,phone,created_at) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.crm, item.specialty, item.email, item.phone, item.createdAt);
  return item;
}

export function updateDoctor(id: string, input: Omit<Doctor, 'id' | 'createdAt'>) {
  const exists = getDoctorById(id);
  if (!exists) return undefined;
  initDatabase().prepare('UPDATE doctors SET name=?,crm=?,specialty=?,email=?,phone=? WHERE id=?').run(input.name, input.crm, input.specialty, input.email, input.phone, id);
  return getDoctorById(id);
}


export function listHealthPlans(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,provider_name as providerName,registration_code as registrationCode,created_at as createdAt FROM health_plans WHERE name LIKE ? OR provider_name LIKE ? OR registration_code LIKE ? ORDER BY name ASC`).all(q, q, q) as HealthPlan[];
  }
  return conn.prepare('SELECT id,name,provider_name as providerName,registration_code as registrationCode,created_at as createdAt FROM health_plans ORDER BY name ASC').all() as HealthPlan[];
}

export function getHealthPlanById(id: string) {
  return initDatabase().prepare('SELECT id,name,provider_name as providerName,registration_code as registrationCode,created_at as createdAt FROM health_plans WHERE id = ?').get(id) as HealthPlan | undefined;
}

export function createHealthPlan(input: Omit<HealthPlan, 'id' | 'createdAt'>) {
  const item: HealthPlan = { id: makeId('hp'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO health_plans (id,name,provider_name,registration_code,created_at) VALUES (?,?,?,?,?)').run(item.id, item.name, item.providerName, item.registrationCode, item.createdAt);
  return item;
}

export function updateHealthPlan(id: string, input: Omit<HealthPlan, 'id' | 'createdAt'>) {
  const exists = getHealthPlanById(id);
  if (!exists) return undefined;
  initDatabase().prepare('UPDATE health_plans SET name=?,provider_name=?,registration_code=? WHERE id=?').run(input.name, input.providerName, input.registrationCode, id);
  return getHealthPlanById(id);
}

export function listEmployees(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,role,employee_code as employeeCode,email,phone,created_at as createdAt FROM employees WHERE name LIKE ? OR employee_code LIKE ? OR role LIKE ? ORDER BY name ASC`).all(q, q, q) as Employee[];
  }
  return conn.prepare('SELECT id,name,role,employee_code as employeeCode,email,phone,created_at as createdAt FROM employees ORDER BY name ASC').all() as Employee[];
}

export function createEmployee(input: Omit<Employee, 'id' | 'createdAt'>) {
  const item: Employee = { id: makeId('e'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO employees (id,name,role,employee_code,email,phone,created_at) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.role, item.employeeCode, item.email, item.phone, item.createdAt);
  return item;
}

export function listSuppliers(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,document,email,phone,category,created_at as createdAt FROM suppliers WHERE name LIKE ? OR document LIKE ? OR category LIKE ? ORDER BY name ASC`).all(q, q, q) as Supplier[];
  }
  return conn.prepare('SELECT id,name,document,email,phone,category,created_at as createdAt FROM suppliers ORDER BY name ASC').all() as Supplier[];
}

export function createSupplier(input: Omit<Supplier, 'id' | 'createdAt'>) {
  const item: Supplier = { id: makeId('s'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO suppliers (id,name,document,email,phone,category,created_at) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.document, item.email, item.phone, item.category, item.createdAt);
  return item;
}

export function listFinishedProducts(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,product_type as productType,sku,unit,price,created_at as createdAt FROM finished_products WHERE name LIKE ? OR sku LIKE ? ORDER BY name ASC`).all(q, q) as FinishedProduct[];
  }
  return conn.prepare('SELECT id,name,product_type as productType,sku,unit,price,created_at as createdAt FROM finished_products ORDER BY name ASC').all() as FinishedProduct[];
}

export function createFinishedProduct(input: Omit<FinishedProduct, 'id' | 'createdAt'>) {
  const item: FinishedProduct = { id: makeId('fp'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO finished_products (id,name,product_type,sku,unit,price,created_at) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.productType, item.sku, item.unit, item.price, item.createdAt);
  return item;
}

export function listRawMaterials(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,code,unit,cost,created_at as createdAt FROM raw_materials WHERE name LIKE ? OR code LIKE ? ORDER BY name ASC`).all(q, q) as RawMaterial[];
  }
  return conn.prepare('SELECT id,name,code,unit,cost,created_at as createdAt FROM raw_materials ORDER BY name ASC').all() as RawMaterial[];
}

export function createRawMaterial(input: Omit<RawMaterial, 'id' | 'createdAt'>) {
  const item: RawMaterial = { id: makeId('rm'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO raw_materials (id,name,code,unit,cost,created_at) VALUES (?,?,?,?,?,?)').run(item.id, item.name, item.code, item.unit, item.cost, item.createdAt);
  return item;
}

export function listStandardFormulas(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,version,product_id as productId,instructions,created_at as createdAt FROM standard_formulas WHERE name LIKE ? OR product_id LIKE ? ORDER BY name ASC`).all(q, q) as StandardFormula[];
  }
  return conn.prepare('SELECT id,name,version,product_id as productId,instructions,created_at as createdAt FROM standard_formulas ORDER BY name ASC').all() as StandardFormula[];
}

export function createStandardFormula(input: Omit<StandardFormula, 'id' | 'createdAt'>) {
  const item: StandardFormula = { id: makeId('sf'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO standard_formulas (id,name,version,product_id,instructions,created_at) VALUES (?,?,?,?,?,?)').run(item.id, item.name, item.version, item.productId, item.instructions, item.createdAt);
  return item;
}

export function listPackagingFormulas(search?: string) {
  const conn = initDatabase();
  if (search?.trim()) {
    const q = `%${search.trim()}%`;
    return conn.prepare(`SELECT id,name,product_id as productId,packaging_type as packagingType,units_per_package as unitsPerPackage,notes,created_at as createdAt FROM packaging_formulas WHERE name LIKE ? OR product_id LIKE ? ORDER BY name ASC`).all(q, q) as PackagingFormula[];
  }
  return conn.prepare('SELECT id,name,product_id as productId,packaging_type as packagingType,units_per_package as unitsPerPackage,notes,created_at as createdAt FROM packaging_formulas ORDER BY name ASC').all() as PackagingFormula[];
}

export function createPackagingFormula(input: Omit<PackagingFormula, 'id' | 'createdAt'>) {
  const item: PackagingFormula = { id: makeId('pf'), ...input, createdAt: new Date().toISOString() };
  initDatabase().prepare('INSERT INTO packaging_formulas (id,name,product_id,packaging_type,units_per_package,notes,created_at) VALUES (?,?,?,?,?,?,?)').run(item.id, item.name, item.productId, item.packagingType, item.unitsPerPackage, item.notes, item.createdAt);
  return item;
}
