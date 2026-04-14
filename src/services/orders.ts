import { deliveries as deliveriesList, orders, type Order } from '../data.js';
function addDays(startIso: string, days: number) {
  const dt = new Date(startIso);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

export function calculateRunOutDate(
  quantity: number,
  tabletsPerDay?: number,
  tabletsPerPackage?: number,
  treatmentDays?: number
) {
  if (treatmentDays && treatmentDays > 0) return addDays(new Date().toISOString(), treatmentDays);
  if (!tabletsPerDay || tabletsPerDay <= 0) return undefined;
  const unitsPerPackage = tabletsPerPackage ?? 30;
  const totalTablets = quantity * unitsPerPackage;
  const durationInDays = Math.max(1, Math.ceil(totalTablets / tabletsPerDay));
  return addDays(new Date().toISOString(), durationInDays);
}

export function buildRecurringReminders(items: Order[]) {
  return items
    .filter((o) => {
      if (!o.recurring?.needsConfirmation) return false;
      const diffDays = getDaysUntil(o.recurring.nextBillingDate);
      return diffDays >= 0 && diffDays <= 3;
    })
    .map((o) => ({
      orderId: o.id,
      patientName: o.patientName,
      nextBillingDate: o.recurring?.nextBillingDate,
      estimatedTreatmentEndDate: o.estimatedTreatmentEndDate,
      message: 'Confirmar junto ao cliente a recorrência da compra',
    }));
}

function getDaysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 3600 * 1000));
}

export function getOrdersPaginated(page: number, pageSize: number) {
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: orders.slice(start, end),
    page,
    pageSize,
    total: orders.length,
    totalPages: Math.max(1, Math.ceil(orders.length / pageSize)),
  };
}

export function getDeliveriesPaginated(page: number, pageSize: number, status?: string, q?: string) {
  let filtered = deliveriesList;
  if (status) filtered = filtered.filter((d) => d.status === status);
  if (q) {
    const lower = q.toLowerCase();
    filtered = filtered.filter(
      (d) => d.orderId.toLowerCase().includes(lower) || d.patientName.toLowerCase().includes(lower)
    );
  }
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  return {
    items: filtered.slice(start, end),
    page,
    pageSize,
    total: filtered.length,
    totalPages: Math.max(1, Math.ceil(filtered.length / pageSize)),
  };
}
