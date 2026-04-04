import { PrismaClient } from '@prisma/client';

export const prisma = new PrismaClient();

export function initDatabase() {
  return prisma;
}

// Customers
export async function listCustomers(search?: string) {
  if (search?.trim()) {
    return prisma.customer.findMany({
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
  return prisma.customer.findMany({ orderBy: { name: 'asc' } });
}

export async function getCustomerById(id: string) {
  return prisma.customer.findUnique({ where: { id } });
}

export async function createCustomer(input: any) {
  return prisma.customer.create({ data: input });
}

export async function updateCustomer(id: string, input: any) {
  return prisma.customer.update({ where: { id }, data: input });
}

// Doctors
export async function listDoctors(search?: string) {
  if (search?.trim()) {
    return prisma.doctor.findMany({
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
  return prisma.doctor.findMany({ orderBy: { name: 'asc' } });
}

export async function getDoctorById(id: string) {
  return prisma.doctor.findUnique({ where: { id } });
}

export async function createDoctor(input: any) {
  return prisma.doctor.create({ data: input });
}

export async function updateDoctor(id: string, input: any) {
  return prisma.doctor.update({ where: { id }, data: input });
}

// HealthPlans
export async function listHealthPlans(search?: string) {
  if (search?.trim()) {
    return prisma.healthPlan.findMany({
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
  return prisma.healthPlan.findMany({ orderBy: { name: 'asc' } });
}

export async function getHealthPlanById(id: string) {
  return prisma.healthPlan.findUnique({ where: { id } });
}

export async function createHealthPlan(input: any) {
  return prisma.healthPlan.create({ data: input });
}

export async function updateHealthPlan(id: string, input: any) {
  return prisma.healthPlan.update({ where: { id }, data: input });
}

// PatientActivities
export async function createPatientActivity(input: any) {
  return prisma.patientActivity.create({ data: input });
}

export async function listPatientActivities(patientId: string, page = 1, pageSize = 20) {
  const total = await prisma.patientActivity.count({ where: { patientId } });
  const items = await prisma.patientActivity.findMany({
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
    return prisma.employee.findMany({
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
  return prisma.employee.findMany({ orderBy: { name: 'asc' } });
}

export async function createEmployee(input: any) {
  return prisma.employee.create({ data: input });
}

// Suppliers
export async function listSuppliers(search?: string) {
  if (search?.trim()) {
    return prisma.supplier.findMany({
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
  return prisma.supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createSupplier(input: any) {
  return prisma.supplier.create({ data: input });
}

// FinishedProducts
export async function listFinishedProducts(search?: string) {
  if (search?.trim()) {
    return prisma.finishedProduct.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { sku: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return prisma.finishedProduct.findMany({ orderBy: { name: 'asc' } });
}

export async function createFinishedProduct(input: any) {
  return prisma.finishedProduct.create({ data: input });
}

// RawMaterials
export async function listRawMaterials(search?: string) {
  if (search?.trim()) {
    return prisma.rawMaterial.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { code: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return prisma.rawMaterial.findMany({ orderBy: { name: 'asc' } });
}

export async function createRawMaterial(input: any) {
  return prisma.rawMaterial.create({ data: input });
}

// StandardFormulas
export async function listStandardFormulas(search?: string) {
  if (search?.trim()) {
    return prisma.standardFormula.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { productId: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return prisma.standardFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createStandardFormula(input: any) {
  return prisma.standardFormula.create({ data: input });
}

// PackagingFormulas
export async function listPackagingFormulas(search?: string) {
  if (search?.trim()) {
    return prisma.packagingFormula.findMany({
      where: {
        OR: [
          { name: { contains: search } },
          { productId: { contains: search } },
        ]
      },
      orderBy: { name: 'asc' }
    });
  }
  return prisma.packagingFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createPackagingFormula(input: any) {
  return prisma.packagingFormula.create({ data: input });
}
