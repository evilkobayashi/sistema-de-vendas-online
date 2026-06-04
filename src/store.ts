import fs from 'node:fs';
import path from 'node:path';
import {
  deliveries,
  inventoryLots,
  inventoryMovements,
  medicines,
  orders,
  tickets,
  type Delivery,
  type InventoryLot,
  type InventoryMovement,
  type Medicine,
  type Order,
  type Ticket
} from './data.js';
import {
  createOrder,
  createDelivery,
  createInventoryLot,
  createInventoryMovement,
  updateInventoryLotReserved,
  updateDelivery,
  deleteOrderById,
  deleteDeliveryByOrderId,
  listOrders,
  listDeliveries,
  listInventoryLots,
  listInventoryMovements,
} from './database.js';

type PersistedState = {
  medicines: Medicine[];
  inventoryLots: InventoryLot[];
  inventoryMovements: InventoryMovement[];
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
    inventoryLots,
    inventoryMovements,
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
    if (Array.isArray(parsed.inventoryLots)) replaceArrayInPlace(inventoryLots, parsed.inventoryLots);
    if (Array.isArray(parsed.inventoryMovements)) replaceArrayInPlace(inventoryMovements, parsed.inventoryMovements);
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

// Reset in-memory mutable state to original seed values (used in tests)
export function resetInMemoryState() {
  inventoryLots.forEach((lot) => { lot.reserved = 0; });
  replaceArrayInPlace(inventoryMovements, []);
  replaceArrayInPlace(orders, []);
  replaceArrayInPlace(deliveries, []);
}

// ----------------------------------------------------------------
// DB sync helpers — called after in-memory mutations
// ----------------------------------------------------------------

/** Load all persisted orders + deliveries + inventory from DB into in-memory arrays. */
export async function loadFromDatabase() {
  try {
    const [ordersResult, deliveriesResult, lotsResult, movementsResult] = await Promise.all([
      listOrders(1, 10000),
      listDeliveries({ page: 1, pageSize: 10000 }),
      listInventoryLots(),
      listInventoryMovements(1, 10000),
    ]);
    replaceArrayInPlace(orders, ordersResult.items);
    replaceArrayInPlace(deliveries, deliveriesResult.items);
    replaceArrayInPlace(inventoryLots, lotsResult);
    replaceArrayInPlace(inventoryMovements, movementsResult.items);
  } catch {
    // DB not available yet — fall back to existing in-memory state
  }
}

/** Persist a single new order to the DB. The in-memory array is already updated by the caller. */
export async function persistOrderToDb(order: Order) {
  try {
    await createOrder({
      id: order.id,
      patientName: order.patientName,
      email: order.email,
      phone: order.phone,
      address: order.address,
      patientId: order.patientId,
      total: order.total,
      controlledValidated: order.controlledValidated,
      createdBy: order.createdBy,
      estimatedTreatmentEndDate: order.estimatedTreatmentEndDate,
      recurring: order.recurring
        ? {
            discountPercent: order.recurring.discountPercent,
            nextBillingDate: order.recurring.nextBillingDate,
            needsConfirmation: order.recurring.needsConfirmation,
          }
        : undefined,
      items: order.items.map((item) => ({
        medicineId: item.medicineId,
        medicineName: item.medicineName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        subtotal: item.subtotal,
        tabletsPerDay: item.tabletsPerDay,
        tabletsPerPackage: item.tabletsPerPackage,
        treatmentDays: item.treatmentDays,
        estimatedRunOutDate: item.estimatedRunOutDate,
      })),
    });
  } catch { /* swallow — in-memory is still authoritative during session */ }
}

/** Persist a single new delivery to the DB. */
export async function persistDeliveryToDb(delivery: Delivery) {
  try {
    await createDelivery({
      orderId: delivery.orderId,
      patientName: delivery.patientName,
      patientId: delivery.patientId,
      status: delivery.status,
      forecastDate: delivery.forecastDate,
      carrier: delivery.carrier,
      trackingCode: delivery.trackingCode,
      shippingProvider: delivery.shippingProvider,
      syncStatus: delivery.syncStatus,
    });
  } catch { /* swallow */ }
}

/** Update delivery status in DB. */
export async function updateDeliveryInDb(
  orderId: string,
  data: Partial<{ status: string; forecastDate: string; carrier: string; trackingCode: string; shippingProvider: string; syncStatus: string }>,
) {
  try {
    await updateDelivery(orderId, data);
  } catch { /* swallow */ }
}

/** Remove a delivery from DB (rollback). */
export async function removeDeliveryFromDb(orderId: string) {
  try {
    await deleteDeliveryByOrderId(orderId);
  } catch { /* swallow */ }
}

/** Remove an order from DB (rollback). */
export async function removeOrderFromDb(id: string) {
  try {
    await deleteOrderById(id);
  } catch { /* swallow */ }
}

/** Persist a new inventory lot to the DB. */
export async function persistInventoryLotToDb(lot: InventoryLot) {
  try {
    await createInventoryLot({
      id: lot.id,
      medicineId: lot.medicineId,
      batchCode: lot.batchCode,
      expiresAt: lot.expiresAt,
      quantity: lot.quantity,
      reserved: lot.reserved,
      unitCost: lot.unitCost,
      supplier: lot.supplier,
    });
  } catch { /* swallow */ }
}

/** Sync reserved count update to DB. */
export async function syncLotReservedToDb(lotId: string, reserved: number) {
  try {
    await updateInventoryLotReserved(lotId, reserved);
  } catch { /* swallow */ }
}

/** Persist a new inventory movement to the DB. */
export async function persistInventoryMovementToDb(movement: InventoryMovement) {
  try {
    await createInventoryMovement({
      id: movement.id,
      medicineId: movement.medicineId,
      lotId: movement.lotId,
      type: movement.type,
      quantity: movement.quantity,
      reason: movement.reason,
      relatedOrderId: movement.relatedOrderId,
      createdBy: movement.createdBy,
    });
  } catch { /* swallow */ }
}
