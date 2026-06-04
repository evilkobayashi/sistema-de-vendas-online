import { Prisma, PrismaClient } from '@prisma/client';

let _prisma: PrismaClient | null = null;

function getPrisma() {
  if (!_prisma) {
    _prisma = new PrismaClient();
  }
  return _prisma;
}

export { getPrisma as prisma };

export async function disconnectDatabase() {
  if (_prisma) {
    await _prisma.$disconnect();
    _prisma = null;
  }
}

export function initDatabase() {
  return getPrisma();
}

export type PrismaCreateDoctor = Prisma.DoctorCreateInput;
export type PrismaUpdateDoctor = Prisma.DoctorUpdateInput;
export type PrismaCreateHealthPlan = Prisma.HealthPlanCreateInput;
export type PrismaUpdateHealthPlan = Prisma.HealthPlanUpdateInput;
export type PatientActivityInput = { patientId: string; activityType: string; description: string; metadataJson: string; performedBy: string };
export type EmployeeCreateInput = Prisma.EmployeeCreateInput;
export type SupplierCreateInput = Prisma.SupplierCreateInput;
export type FinishedProductCreateInput = Prisma.FinishedProductCreateInput;
export type RawMaterialCreateInput = Prisma.RawMaterialCreateInput;
export type StandardFormulaCreateInput = Prisma.StandardFormulaCreateInput;
export type PackagingFormulaCreateInput = Prisma.PackagingFormulaCreateInput;

function mapCustomerCreateData(input: {
  name: string; email: string; phone: string; address: string;
  patientCode: string; insuranceCardCode: string; diseaseCid: string;
  healthPlanId: string; doctorId: string;
  insurancePlanName?: string; insuranceProviderName?: string;
  primaryDoctorId?: string;
}): Prisma.CustomerCreateInput {
  return {
    name: input.name,
    email: input.email,
    phone: input.phone,
    address: input.address,
    patientCode: input.patientCode,
    insuranceCardCode: input.insuranceCardCode,
    diseaseCid: input.diseaseCid,
    healthPlanId: input.healthPlanId,
    doctorId: input.doctorId,
    insurancePlanName: input.insurancePlanName ?? '',
    insuranceProviderName: input.insuranceProviderName ?? '',
    primaryDoctorId: input.primaryDoctorId ?? '',
  };
}

function mapCustomerUpdateData(input: Partial<{
  name: string; email: string; phone: string; address: string;
  patientCode: string; insuranceCardCode: string; diseaseCid: string;
  healthPlanId?: string; doctorId?: string;
  insurancePlanName?: string; insuranceProviderName?: string;
  primaryDoctorId?: string;
}>): Prisma.CustomerUpdateInput {
  const data: Prisma.CustomerUpdateInput = {};
  if (input.name) data.name = input.name;
  if (input.email) data.email = input.email;
  if (input.phone) data.phone = input.phone;
  if (input.address) data.address = input.address;
  if (input.patientCode) data.patientCode = input.patientCode;
  if (input.insuranceCardCode) data.insuranceCardCode = input.insuranceCardCode;
  if (input.diseaseCid) data.diseaseCid = input.diseaseCid;
  if (input.insurancePlanName) data.insurancePlanName = input.insurancePlanName;
  if (input.insuranceProviderName) data.insuranceProviderName = input.insuranceProviderName;
  if (input.primaryDoctorId) data.primaryDoctorId = input.primaryDoctorId;
  if (input.healthPlanId) data.healthPlanId = input.healthPlanId;
  if (input.doctorId) data.doctorId = input.doctorId;
  return data;
}

// Customers
export async function listCustomers(search?: string) {
  if (search?.trim()) {
    return getPrisma().customer.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { email: { contains: search } },
          { phone: { contains: search } },
          { patientCode: { contains: search } },
          { insuranceCardCode: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().customer.findMany({ orderBy: { name: 'asc' } });
}

export async function getCustomerById(id: string) {
  return getPrisma().customer.findUnique({ where: { id } });
}

export async function createCustomer(input: {
  name: string; email: string; phone: string; address: string;
  patientCode: string; insuranceCardCode: string; diseaseCid: string;
  healthPlanId: string; doctorId: string;
  insurancePlanName?: string; insuranceProviderName?: string;
  primaryDoctorId?: string;
}) {
  const data = mapCustomerCreateData(input);
  return getPrisma().customer.create({ data });
}

export async function updateCustomer(id: string, input: Partial<{
  name: string; email: string; phone: string; address: string;
  patientCode: string; insuranceCardCode: string; diseaseCid: string;
  healthPlanId?: string; doctorId?: string;
  insurancePlanName?: string; insuranceProviderName?: string;
  primaryDoctorId?: string;
}>) {
  const data = mapCustomerUpdateData(input);
  return getPrisma().customer.update({ where: { id }, data });
}

// Doctors
export async function listDoctors(search?: string) {
  if (search?.trim()) {
    return getPrisma().doctor.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { crm: { contains: search } },
          { specialty: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().doctor.findMany({ orderBy: { name: 'asc' } });
}

export async function getDoctorById(id: string) {
  return getPrisma().doctor.findUnique({ where: { id } });
}

export async function createDoctor(input: PrismaCreateDoctor) {
  return getPrisma().doctor.create({ data: input });
}

export async function updateDoctor(id: string, input: PrismaUpdateDoctor) {
  return getPrisma().doctor.update({ where: { id }, data: input });
}

// HealthPlans
export async function listHealthPlans(search?: string) {
  if (search?.trim()) {
    return getPrisma().healthPlan.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { providerName: { contains: search } },
          { registrationCode: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().healthPlan.findMany({ orderBy: { name: 'asc' } });
}

export async function getHealthPlanById(id: string) {
  return getPrisma().healthPlan.findUnique({ where: { id } });
}

export async function createHealthPlan(input: PrismaCreateHealthPlan) {
  return getPrisma().healthPlan.create({ data: input });
}

export async function updateHealthPlan(id: string, input: PrismaUpdateHealthPlan) {
  return getPrisma().healthPlan.update({ where: { id }, data: input });
}

// PatientActivities
export async function createPatientActivity(input: PatientActivityInput) {
  return getPrisma().patientActivity.create({
    data: {
      activityType: input.activityType,
      description: input.description,
      metadataJson: input.metadataJson,
      performedBy: input.performedBy,
      customer: { connect: { id: input.patientId } }
    }
  });
}

export async function listPatientActivities(patientId: string, page = 1, pageSize = 20) {
  const total = await getPrisma().patientActivity.count({ where: { patientId } });
  const items = await getPrisma().patientActivity.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize))
  };
}

// Employees
export async function listEmployees(search?: string) {
  if (search?.trim()) {
    return getPrisma().employee.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { employeeCode: { contains: search } },
          { role: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().employee.findMany({ orderBy: { name: 'asc' } });
}

export async function createEmployee(input: EmployeeCreateInput) {
  return getPrisma().employee.create({ data: input });
}

// Suppliers
export async function listSuppliers(search?: string) {
  if (search?.trim()) {
    return getPrisma().supplier.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { document: { contains: search } },
          { category: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createSupplier(input: SupplierCreateInput) {
  return getPrisma().supplier.create({ data: input });
}

// FinishedProducts
export async function listFinishedProducts(search?: string) {
  if (search?.trim()) {
    return getPrisma().finishedProduct.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().finishedProduct.findMany({ orderBy: { name: 'asc' } });
}

export async function createFinishedProduct(input: FinishedProductCreateInput) {
  return getPrisma().finishedProduct.create({ data: input });
}

// RawMaterials
export async function listRawMaterials(search?: string) {
  if (search?.trim()) {
    return getPrisma().rawMaterial.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().rawMaterial.findMany({ orderBy: { name: 'asc' } });
}

export async function createRawMaterial(input: RawMaterialCreateInput) {
  return getPrisma().rawMaterial.create({ data: input });
}

// StandardFormulas
export async function listStandardFormulas(search?: string) {
  if (search?.trim()) {
    return getPrisma().standardFormula.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { productId: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().standardFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createStandardFormula(input: StandardFormulaCreateInput) {
  return getPrisma().standardFormula.create({ data: input });
}

// PackagingFormulas
export async function listPackagingFormulas(search?: string) {
  if (search?.trim()) {
    return getPrisma().packagingFormula.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { productId: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return getPrisma().packagingFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createPackagingFormula(input: PackagingFormulaCreateInput) {
  return getPrisma().packagingFormula.create({ data: input });
}

// ----------------------------------------------------------------
// Orders
// ----------------------------------------------------------------

export type OrderCreateInput = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  address: string;
  patientId?: string;
  total: number;
  controlledValidated: boolean;
  createdBy: string;
  estimatedTreatmentEndDate?: string;
  recurring?: {
    discountPercent: number;
    nextBillingDate: string;
    needsConfirmation: boolean;
  };
  items: Array<{
    medicineId: string;
    medicineName: string;
    quantity: number;
    unitPrice: number;
    subtotal: number;
    tabletsPerDay?: number;
    tabletsPerPackage?: number;
    treatmentDays?: number;
    estimatedRunOutDate?: string;
  }>;
};

function dbOrderToOrder(o: any): import('./data.js').Order {
  return {
    id: o.id,
    patientName: o.patientName,
    email: o.email,
    phone: o.phone,
    address: o.address,
    patientId: o.patientId ?? undefined,
    total: o.total,
    controlledValidated: o.controlledValidated,
    createdBy: o.createdBy,
    createdAt: o.createdAt instanceof Date ? o.createdAt.toISOString() : o.createdAt,
    estimatedTreatmentEndDate: o.estimatedTreatmentEndDate
      ? (o.estimatedTreatmentEndDate instanceof Date ? o.estimatedTreatmentEndDate.toISOString().slice(0, 10) : o.estimatedTreatmentEndDate)
      : undefined,
    recurring: o.recurringNextBillingDate
      ? {
          discountPercent: o.recurringDiscountPercent ?? 0,
          nextBillingDate: o.recurringNextBillingDate instanceof Date
            ? o.recurringNextBillingDate.toISOString().slice(0, 10)
            : o.recurringNextBillingDate,
          needsConfirmation: o.recurringNeedsConfirmed,
          lastConfirmationAt: o.recurringLastConfirmationAt
            ? (o.recurringLastConfirmationAt instanceof Date ? o.recurringLastConfirmationAt.toISOString() : o.recurringLastConfirmationAt)
            : undefined,
          confirmedBy: o.recurringConfirmedBy ?? undefined,
        }
      : undefined,
    items: (o.items ?? []).map((item: any) => ({
      medicineId: item.medicineId,
      medicineName: item.medicineName,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      subtotal: item.subtotal,
      tabletsPerDay: item.tabletsPerDay ?? undefined,
      tabletsPerPackage: item.tabletsPerPackage ?? undefined,
      treatmentDays: item.treatmentDays ?? undefined,
      estimatedRunOutDate: item.estimatedRunOutDate
        ? (item.estimatedRunOutDate instanceof Date ? item.estimatedRunOutDate.toISOString().slice(0, 10) : item.estimatedRunOutDate)
        : undefined,
    })),
  };
}

export async function createOrder(input: OrderCreateInput): Promise<import('./data.js').Order> {
  const created = await getPrisma().order.create({
    data: {
      id: input.id,
      patientName: input.patientName,
      email: input.email,
      phone: input.phone,
      address: input.address,
      patientId: input.patientId,
      total: input.total,
      controlledValidated: input.controlledValidated,
      createdBy: input.createdBy,
      estimatedTreatmentEndDate: input.estimatedTreatmentEndDate
        ? new Date(input.estimatedTreatmentEndDate)
        : undefined,
      recurringDiscountPercent: input.recurring?.discountPercent,
      recurringNextBillingDate: input.recurring?.nextBillingDate
        ? new Date(input.recurring.nextBillingDate)
        : undefined,
      recurringNeedsConfirmed: input.recurring?.needsConfirmation ?? false,
      items: {
        create: input.items.map((item) => ({
          medicineId: item.medicineId,
          medicineName: item.medicineName,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          subtotal: item.subtotal,
          tabletsPerDay: item.tabletsPerDay,
          tabletsPerPackage: item.tabletsPerPackage,
          treatmentDays: item.treatmentDays,
          estimatedRunOutDate: item.estimatedRunOutDate
            ? new Date(item.estimatedRunOutDate)
            : undefined,
        })),
      },
    },
    include: { items: true },
  });
  return dbOrderToOrder(created);
}

export async function listOrders(page = 1, pageSize = 20): Promise<{ items: import('./data.js').Order[]; total: number }> {
  const [total, rows] = await Promise.all([
    getPrisma().order.count(),
    getPrisma().order.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { items: true },
    }),
  ]);
  return { items: rows.map(dbOrderToOrder), total };
}

export async function getOrderById(id: string): Promise<import('./data.js').Order | null> {
  const row = await getPrisma().order.findUnique({ where: { id }, include: { items: true } });
  return row ? dbOrderToOrder(row) : null;
}

export async function confirmOrderRecurring(
  id: string,
  confirmedBy: string,
): Promise<import('./data.js').Order | null> {
  const row = await getPrisma().order.update({
    where: { id },
    data: {
      recurringNeedsConfirmed: false,
      recurringLastConfirmationAt: new Date(),
      recurringConfirmedBy: confirmedBy,
    },
    include: { items: true },
  });
  return row ? dbOrderToOrder(row) : null;
}

// ----------------------------------------------------------------
// Deliveries
// ----------------------------------------------------------------

function dbDeliveryToDelivery(d: any): import('./data.js').Delivery {
  return {
    orderId: d.orderId,
    patientName: d.patientName,
    patientId: d.patientId ?? undefined,
    status: d.status as import('./data.js').DeliveryStatus,
    forecastDate: d.forecastDate instanceof Date ? d.forecastDate.toISOString().slice(0, 10) : d.forecastDate,
    carrier: d.carrier,
    trackingCode: d.trackingCode ?? undefined,
    shippingProvider: d.shippingProvider ?? undefined,
    syncStatus: (d.syncStatus as 'ok' | 'fallback' | 'queued_retry') ?? undefined,
  };
}

export type DeliveryCreateInput = {
  orderId: string;
  patientName: string;
  patientId?: string;
  status: string;
  forecastDate: string;
  carrier: string;
  trackingCode?: string;
  shippingProvider?: string;
  syncStatus?: string;
};

export async function createDelivery(input: DeliveryCreateInput): Promise<import('./data.js').Delivery> {
  const created = await getPrisma().delivery.create({
    data: {
      orderId: input.orderId,
      patientName: input.patientName,
      patientId: input.patientId,
      status: input.status,
      forecastDate: new Date(input.forecastDate),
      carrier: input.carrier,
      trackingCode: input.trackingCode,
      shippingProvider: input.shippingProvider,
      syncStatus: input.syncStatus,
    },
  });
  return dbDeliveryToDelivery(created);
}

export async function listDeliveries(filters?: {
  status?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}): Promise<{ items: import('./data.js').Delivery[]; total: number }> {
  const page = filters?.page ?? 1;
  const pageSize = filters?.pageSize ?? 20;
  const where: Prisma.DeliveryWhereInput = {};
  if (filters?.status) where.status = filters.status;
  if (filters?.q) {
    where.OR = [
      { orderId: { contains: filters.q } },
      { patientName: { contains: filters.q } },
    ];
  }
  const [total, rows] = await Promise.all([
    getPrisma().delivery.count({ where }),
    getPrisma().delivery.findMany({
      where,
      orderBy: { forecastDate: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: rows.map(dbDeliveryToDelivery), total };
}

export async function getDeliveryByOrderId(orderId: string): Promise<import('./data.js').Delivery | null> {
  const row = await getPrisma().delivery.findUnique({ where: { orderId } });
  return row ? dbDeliveryToDelivery(row) : null;
}

export async function updateDelivery(
  orderId: string,
  data: Partial<{ status: string; forecastDate: string; carrier: string; trackingCode: string; shippingProvider: string; syncStatus: string }>,
): Promise<import('./data.js').Delivery | null> {
  const updateData: Prisma.DeliveryUpdateInput = {};
  if (data.status !== undefined) updateData.status = data.status;
  if (data.forecastDate !== undefined) updateData.forecastDate = new Date(data.forecastDate);
  if (data.carrier !== undefined) updateData.carrier = data.carrier;
  if (data.trackingCode !== undefined) updateData.trackingCode = data.trackingCode;
  if (data.shippingProvider !== undefined) updateData.shippingProvider = data.shippingProvider;
  if (data.syncStatus !== undefined) updateData.syncStatus = data.syncStatus;
  const row = await getPrisma().delivery.update({ where: { orderId }, data: updateData });
  return row ? dbDeliveryToDelivery(row) : null;
}

export async function deleteDeliveryByOrderId(orderId: string): Promise<void> {
  try {
    await getPrisma().delivery.delete({ where: { orderId } });
  } catch { /* not found — ok */ }
}

export async function deleteOrderById(id: string): Promise<void> {
  try {
    await getPrisma().order.delete({ where: { id } });
  } catch { /* not found — ok */ }
}

// ----------------------------------------------------------------
// InventoryLots & InventoryMovements
// ----------------------------------------------------------------

function dbLotToLot(l: any): import('./data.js').InventoryLot {
  return {
    id: l.id,
    medicineId: l.medicineId,
    batchCode: l.batchCode,
    expiresAt: l.expiresAt instanceof Date ? l.expiresAt.toISOString().slice(0, 10) : l.expiresAt,
    quantity: l.quantity,
    reserved: l.reserved,
    unitCost: l.unitCost,
    supplier: l.supplier,
    createdAt: l.createdAt instanceof Date ? l.createdAt.toISOString() : l.createdAt,
  };
}

function dbMovementToMovement(m: any): import('./data.js').InventoryMovement {
  return {
    id: m.id,
    medicineId: m.medicineId,
    lotId: m.lotId ?? undefined,
    type: m.type as import('./data.js').InventoryMovementType,
    quantity: m.quantity,
    reason: m.reason,
    relatedOrderId: m.relatedOrderId ?? undefined,
    createdBy: m.createdBy,
    createdAt: m.createdAt instanceof Date ? m.createdAt.toISOString() : m.createdAt,
  };
}

export async function listInventoryLots(medicineId?: string): Promise<import('./data.js').InventoryLot[]> {
  const rows = await getPrisma().inventoryLot.findMany({
    where: medicineId ? { medicineId } : undefined,
    orderBy: { expiresAt: 'asc' },
  });
  return rows.map(dbLotToLot);
}

export async function getInventoryLotById(id: string): Promise<import('./data.js').InventoryLot | null> {
  const row = await getPrisma().inventoryLot.findUnique({ where: { id } });
  return row ? dbLotToLot(row) : null;
}

export async function createInventoryLot(input: {
  id: string;
  medicineId: string;
  batchCode: string;
  expiresAt: string;
  quantity: number;
  reserved?: number;
  unitCost: number;
  supplier: string;
}): Promise<import('./data.js').InventoryLot> {
  const row = await getPrisma().inventoryLot.create({
    data: {
      id: input.id,
      medicineId: input.medicineId,
      batchCode: input.batchCode,
      expiresAt: new Date(input.expiresAt),
      quantity: input.quantity,
      reserved: input.reserved ?? 0,
      unitCost: input.unitCost,
      supplier: input.supplier,
    },
  });
  return dbLotToLot(row);
}

export async function updateInventoryLotReserved(id: string, reserved: number): Promise<void> {
  await getPrisma().inventoryLot.update({ where: { id }, data: { reserved } });
}

export async function createInventoryMovement(input: {
  id: string;
  medicineId: string;
  lotId?: string;
  type: string;
  quantity: number;
  reason: string;
  relatedOrderId?: string;
  createdBy: string;
}): Promise<import('./data.js').InventoryMovement> {
  const row = await getPrisma().inventoryMovement.create({
    data: {
      id: input.id,
      medicineId: input.medicineId,
      lotId: input.lotId,
      type: input.type,
      quantity: input.quantity,
      reason: input.reason,
      relatedOrderId: input.relatedOrderId,
      createdBy: input.createdBy,
    },
  });
  return dbMovementToMovement(row);
}

export async function listInventoryMovements(page = 1, pageSize = 20): Promise<{ items: import('./data.js').InventoryMovement[]; total: number }> {
  const [total, rows] = await Promise.all([
    getPrisma().inventoryMovement.count(),
    getPrisma().inventoryMovement.findMany({
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { items: rows.map(dbMovementToMovement), total };
}
