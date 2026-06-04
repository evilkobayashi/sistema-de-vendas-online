import fs from 'node:fs';
import path from 'node:path';
import {
  deliveries,
  inventoryLots,
  inventoryMovements,
  medicines,
  orders,
  tickets,
  users,
  type Delivery,
  type InventoryLot,
  type InventoryMovement,
  type Medicine,
  type Order,
  type Ticket,
  type User,
} from './data.js';

type PersistedState = {
  medicines: Medicine[];
  inventoryLots: InventoryLot[];
  inventoryMovements: InventoryMovement[];
  orders: Order[];
  deliveries: Delivery[];
  tickets: Ticket[];
  users: User[];
  updatedAt: string;
};

function getStorePaths() {
  const cwd = process.cwd() || '.';
  const storeDir = process.env.RUNTIME_STORE_DIR || path.resolve(cwd, '.runtime-data');
  return {
    storeDir,
    storeFile: path.join(storeDir, 'store.json'),
    tmpFile: path.join(storeDir, 'store.json.tmp'),
  };
}

function ensureStoreDir() {
  const { storeDir } = getStorePaths();
  if (storeDir && !fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
}

function replaceArrayInPlace<T>(target: T[], source: T[]) {
  target.splice(0, target.length, ...source);
}

function snapshotState(): PersistedState {
  return {
    medicines,
    inventoryLots,
    inventoryMovements,
    orders,
    deliveries,
    tickets,
    users,
    updatedAt: new Date().toISOString(),
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
    if (Array.isArray(parsed.inventoryLots)) replaceArrayInPlace(inventoryLots, parsed.inventoryLots);
    if (Array.isArray(parsed.inventoryMovements)) replaceArrayInPlace(inventoryMovements, parsed.inventoryMovements);
    if (Array.isArray(parsed.orders)) replaceArrayInPlace(orders, parsed.orders);
    if (Array.isArray(parsed.deliveries)) replaceArrayInPlace(deliveries, parsed.deliveries);
    if (Array.isArray(parsed.tickets)) replaceArrayInPlace(tickets, parsed.tickets);
    if (Array.isArray(parsed.users)) replaceArrayInPlace(users, parsed.users);
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

export function resetInMemoryState() {
  inventoryLots.forEach((lot) => {
    lot.reserved = 0;
  });
  replaceArrayInPlace(inventoryMovements, []);
  replaceArrayInPlace(orders, []);
  replaceArrayInPlace(deliveries, []);
}
