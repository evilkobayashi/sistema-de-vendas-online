import crypto from 'node:crypto';
import { inventoryLots, inventoryMovements, medicines, type InventoryLot, type InventoryMovement } from '../data.js';
import type { User } from '../data.js';

function addDays(startIso: string, days: number) {
  const dt = new Date(startIso);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function availableQuantityByMedicine(medicineId: string) {
  return inventoryLots
    .filter((lot) => lot.medicineId === medicineId)
    .reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
}

export function buildInventorySummary() {
  const now = Date.now();
  const items = medicines.map((medicine) => {
    const lots = inventoryLots.filter((lot) => lot.medicineId === medicine.id);
    const stockTotal = lots.reduce((acc, lot) => acc + lot.quantity, 0);
    const stockAvailable = lots.reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
    const expiresIn30Days = lots.filter((lot) => {
      const diff = Math.ceil((new Date(lot.expiresAt).getTime() - now) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length;
    return { medicineId: medicine.id, medicineName: medicine.name, stockTotal, stockAvailable, lotCount: lots.length, expiresIn30Days };
  });
  return { items, critical: items.filter((item) => item.stockAvailable <= 10).length, nearExpiry: items.reduce((acc, item) => acc + item.expiresIn30Days, 0) };
}

export function reserveStockFefo(medicineId: string, quantity: number, orderId: string, userId: string) {
  const lots = inventoryLots
    .filter((lot) => lot.medicineId === medicineId && lot.quantity - lot.reserved > 0)
    .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

  let missing = quantity;
  const changes: Array<{ lot: InventoryLot; delta: number }> = [];

  for (const lot of lots) {
    if (missing <= 0) break;
    const free = lot.quantity - lot.reserved;
    const used = Math.min(free, missing);
    if (used > 0) { changes.push({ lot, delta: used }); missing -= used; }
  }

  if (missing > 0) throw new Error(`Estoque insuficiente para ${medicineId}. Faltam ${missing} unidade(s).`);

  for (const change of changes) {
    change.lot.reserved += change.delta;
    inventoryMovements.unshift({
      id: crypto.randomUUID(),
      medicineId, lotId: change.lot.id, type: 'reserva', quantity: change.delta,
      reason: 'Reserva automática por criação de pedido', relatedOrderId: orderId, createdBy: userId, createdAt: new Date().toISOString()
    });
  }
}

export function createLotEntry(input: { medicineId: string; batchCode: string; expiresAt: string; quantity: number; unitCost: number; supplier: string; reason: string; createdBy: string }) {
  const newLot: InventoryLot = {
    id: crypto.randomUUID(), medicineId: input.medicineId, batchCode: input.batchCode,
    expiresAt: input.expiresAt, quantity: input.quantity, reserved: 0, unitCost: input.unitCost,
    supplier: input.supplier, createdAt: new Date().toISOString()
  };
  inventoryLots.unshift(newLot);
  inventoryMovements.unshift({
    id: crypto.randomUUID(), medicineId: newLot.medicineId, lotId: newLot.id, type: 'entrada',
    quantity: newLot.quantity, reason: input.reason, createdBy: input.createdBy, createdAt: new Date().toISOString()
  });
  return newLot;
}
