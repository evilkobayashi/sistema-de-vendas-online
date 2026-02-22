import fs from 'node:fs';
import path from 'node:path';
import { deliveries, medicines, orders, tickets, type Delivery, type Medicine, type Order, type Ticket } from './data.js';

type PersistedState = {
  medicines: Medicine[];
  orders: Order[];
  deliveries: Delivery[];
  tickets: Ticket[];
  updatedAt: string;
};

function getStorePaths() {
  const storeDir = process.env.RUNTIME_STORE_DIR || path.resolve(process.cwd(), '.runtime-data');
  return {
    storeDir,
    storeFile: path.join(storeDir, 'store.json'),
    tmpFile: path.join(storeDir, 'store.json.tmp')
  };
}

function ensureStoreDir() {
  const { storeDir } = getStorePaths();
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
}

function replaceArrayInPlace<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

function snapshotState(): PersistedState {
  return {
    medicines,
    orders,
    deliveries,
    tickets,
    updatedAt: new Date().toISOString()
  };
}

export function loadPersistentState() {
  ensureStoreDir();
  const { storeFile } = getStorePaths();

  if (!fs.existsSync(storeFile)) {
    persistState();
    return;
  }

  try {
    const raw = fs.readFileSync(storeFile, 'utf8');
    const parsed = JSON.parse(raw) as PersistedState;

    if (Array.isArray(parsed.medicines)) replaceArrayInPlace(medicines, parsed.medicines);
    if (Array.isArray(parsed.orders)) replaceArrayInPlace(orders, parsed.orders);
    if (Array.isArray(parsed.deliveries)) replaceArrayInPlace(deliveries, parsed.deliveries);
    if (Array.isArray(parsed.tickets)) replaceArrayInPlace(tickets, parsed.tickets);
  } catch {
    const backup = `${storeFile}.corrupted-${Date.now()}`;
    try {
      fs.copyFileSync(storeFile, backup);
    } catch {
      // noop
    }
    persistState();
  }
}

export function persistState() {
  ensureStoreDir();
  const { storeFile, tmpFile } = getStorePaths();
  const payload = JSON.stringify(snapshotState(), null, 2);
  fs.writeFileSync(tmpFile, payload, 'utf8');
  fs.renameSync(tmpFile, storeFile);
}
