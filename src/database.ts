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
