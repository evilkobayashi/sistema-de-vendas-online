import { PrismaClient } from '@prisma/client';

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

export type PrismaCreateDoctor = any;
export type PrismaUpdateDoctor = any;
export type PrismaCreateHealthPlan = any;
export type PrismaUpdateHealthPlan = any;
export type PatientActivityInput = {
  patientId: string;
  activityType: string;
  description: string;
  metadataJson: string;
  performedBy: string;
};
export type EmployeeCreateInput = any;
export type SupplierCreateInput = any;
export type FinishedProductCreateInput = any;
export type RawMaterialCreateInput = any;
export type StandardFormulaCreateInput = any;
export type PackagingFormulaCreateInput = any;

function mapCustomerCreateData(input: {
  name: string;
  email: string;
  phone: string;
  address: string;
  patientCode: string;
  insuranceCardCode: string;
  diseaseCid: string;
  healthPlanId: string;
  doctorId: string;
  insurancePlanName?: string;
  insuranceProviderName?: string;
  primaryDoctorId?: string;
}): any {
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

function mapCustomerUpdateData(
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    address: string;
    patientCode: string;
    insuranceCardCode: string;
    diseaseCid: string;
    healthPlanId?: string;
    doctorId?: string;
    insurancePlanName?: string;
    insuranceProviderName?: string;
    primaryDoctorId?: string;
  }>
): any {
  const data: any = {};
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
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().customer.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedSearch } },
          { email: { contains: sanitizedSearch } },
          { phone: { contains: sanitizedSearch } },
          { patientCode: { contains: sanitizedSearch } },
          { insuranceCardCode: { contains: sanitizedSearch } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().customer.findMany({ orderBy: { name: 'asc' } });
}

export async function getCustomerById(id: string) {
  return getPrisma().customer.findUnique({ where: { id } });
}

export async function createCustomer(input: {
  name: string;
  email: string;
  phone: string;
  address: string;
  patientCode: string;
  insuranceCardCode: string;
  diseaseCid: string;
  healthPlanId: string;
  doctorId: string;
  insurancePlanName?: string;
  insuranceProviderName?: string;
  primaryDoctorId?: string;
}) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    email: input.email.replace(/[<>]/g, ''),
    phone: input.phone.replace(/[<>]/g, ''),
    address: input.address.replace(/[<>]/g, ''),
    patientCode: input.patientCode.replace(/[<>]/g, ''),
    insuranceCardCode: input.insuranceCardCode.replace(/[<>]/g, ''),
    diseaseCid: input.diseaseCid.replace(/[<>]/g, ''),
    insurancePlanName: input.insurancePlanName?.replace(/[<>]/g, ''),
    insuranceProviderName: input.insuranceProviderName?.replace(/[<>]/g, ''),
    primaryDoctorId: input.primaryDoctorId?.replace(/[<>]/g, ''),
  };

  const data = mapCustomerCreateData(sanitizedInput);
  return getPrisma().customer.create({ data });
}

export async function updateCustomer(
  id: string,
  input: Partial<{
    name: string;
    email: string;
    phone: string;
    address: string;
    patientCode: string;
    insuranceCardCode: string;
    diseaseCid: string;
    healthPlanId?: string;
    doctorId?: string;
    insurancePlanName?: string;
    insuranceProviderName?: string;
    primaryDoctorId?: string;
  }>
) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name?.replace(/[<>]/g, ''),
    email: input.email?.replace(/[<>]/g, ''),
    phone: input.phone?.replace(/[<>]/g, ''),
    address: input.address?.replace(/[<>]/g, ''),
    patientCode: input.patientCode?.replace(/[<>]/g, ''),
    insuranceCardCode: input.insuranceCardCode?.replace(/[<>]/g, ''),
    diseaseCid: input.diseaseCid?.replace(/[<>]/g, ''),
    insurancePlanName: input.insurancePlanName?.replace(/[<>]/g, ''),
    insuranceProviderName: input.insuranceProviderName?.replace(/[<>]/g, ''),
    primaryDoctorId: input.primaryDoctorId?.replace(/[<>]/g, ''),
  };

  const data = mapCustomerUpdateData(sanitizedInput);
  return getPrisma().customer.update({ where: { id }, data });
}

// Doctors
export async function listDoctors(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().doctor.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedSearch } },
          { crm: { contains: sanitizedSearch } },
          { specialty: { contains: sanitizedSearch } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().doctor.findMany({ orderBy: { name: 'asc' } });
}

export async function getDoctorById(id: string) {
  return getPrisma().doctor.findUnique({ where: { id } });
}

export async function createDoctor(input: PrismaCreateDoctor) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    crm: input.crm.replace(/[<>]/g, ''),
    specialty: input.specialty.replace(/[<>]/g, ''),
    email: input.email.replace(/[<>]/g, ''),
    phone: input.phone.replace(/[<>]/g, ''),
  };

  return getPrisma().doctor.create({ data: sanitizedInput });
}

export async function updateDoctor(id: string, input: PrismaUpdateDoctor) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name?.replace(/[<>]/g, ''),
    crm: input.crm?.replace(/[<>]/g, ''),
    specialty: input.specialty?.replace(/[<>]/g, ''),
    email: input.email?.replace(/[<>]/g, ''),
    phone: input.phone?.replace(/[<>]/g, ''),
  };

  return getPrisma().doctor.update({ where: { id }, data: sanitizedInput });
}

// HealthPlans
export async function listHealthPlans(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().healthPlan.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedSearch } },
          { providerName: { contains: sanitizedSearch } },
          { registrationCode: { contains: sanitizedSearch } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().healthPlan.findMany({ orderBy: { name: 'asc' } });
}

export async function getHealthPlanById(id: string) {
  return getPrisma().healthPlan.findUnique({ where: { id } });
}

export async function createHealthPlan(input: PrismaCreateHealthPlan) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    providerName: input.providerName.replace(/[<>]/g, ''),
    registrationCode: input.registrationCode.replace(/[<>]/g, ''),
  };

  return getPrisma().healthPlan.create({ data: sanitizedInput });
}

export async function updateHealthPlan(id: string, input: PrismaUpdateHealthPlan) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name?.replace(/[<>]/g, ''),
    providerName: input.providerName?.replace(/[<>]/g, ''),
    registrationCode: input.registrationCode?.replace(/[<>]/g, ''),
  };

  return getPrisma().healthPlan.update({ where: { id }, data: sanitizedInput });
}

// PatientActivities
export async function createPatientActivity(input: PatientActivityInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    activityType: input.activityType.replace(/[<>]/g, ''),
    description: input.description.replace(/[<>]/g, ''),
    metadataJson: input.metadataJson.replace(/[<>]/g, ''), // Embora seja JSON, sanitizar para evitar injeção
    performedBy: input.performedBy.replace(/[<>]/g, ''),
  };

  return getPrisma().patientActivity.create({
    data: {
      activityType: sanitizedInput.activityType,
      description: sanitizedInput.description,
      metadataJson: sanitizedInput.metadataJson,
      performedBy: sanitizedInput.performedBy,
      customer: { connect: { id: sanitizedInput.patientId } },
    },
  });
}

export async function listPatientActivities(patientId: string, page = 1, pageSize = 20) {
  const total = await getPrisma().patientActivity.count({ where: { patientId } });
  const items = await getPrisma().patientActivity.findMany({
    where: { patientId },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return {
    items,
    page,
    pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / pageSize)),
  };
}

// Employees
export async function listEmployees(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().employee.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedSearch } },
          { employeeCode: { contains: sanitizedSearch } },
          { role: { contains: sanitizedSearch } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().employee.findMany({ orderBy: { name: 'asc' } });
}

export async function createEmployee(input: EmployeeCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    role: input.role.replace(/[<>]/g, ''),
    employeeCode: input.employeeCode.replace(/[<>]/g, ''),
    email: input.email.replace(/[<>]/g, ''),
    phone: input.phone.replace(/[<>]/g, ''),
  };

  return getPrisma().employee.create({ data: sanitizedInput });
}

// Suppliers
export async function listSuppliers(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().supplier.findMany({
      where: {
        OR: [
          { name: { contains: sanitizedSearch } },
          { document: { contains: sanitizedSearch } },
          { category: { contains: sanitizedSearch } },
        ],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().supplier.findMany({ orderBy: { name: 'asc' } });
}

export async function createSupplier(input: SupplierCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    document: input.document.replace(/[<>]/g, ''),
    email: input.email.replace(/[<>]/g, ''),
    phone: input.phone.replace(/[<>]/g, ''),
    category: input.category.replace(/[<>]/g, ''),
  };

  return getPrisma().supplier.create({ data: sanitizedInput });
}

// FinishedProducts
export async function listFinishedProducts(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().finishedProduct.findMany({
      where: {
        OR: [{ name: { contains: sanitizedSearch } }, { sku: { contains: sanitizedSearch } }],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().finishedProduct.findMany({ orderBy: { name: 'asc' } });
}

export async function createFinishedProduct(input: FinishedProductCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    productType: input.productType.replace(/[<>]/g, ''),
    sku: input.sku.replace(/[<>]/g, ''),
    unit: input.unit.replace(/[<>]/g, ''),
  };

  return getPrisma().finishedProduct.create({ data: sanitizedInput });
}

// RawMaterials
export async function listRawMaterials(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().rawMaterial.findMany({
      where: {
        OR: [{ name: { contains: sanitizedSearch } }, { code: { contains: sanitizedSearch } }],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().rawMaterial.findMany({ orderBy: { name: 'asc' } });
}

export async function createRawMaterial(input: RawMaterialCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    code: input.code.replace(/[<>]/g, ''),
    unit: input.unit.replace(/[<>]/g, ''),
  };

  return getPrisma().rawMaterial.create({ data: sanitizedInput });
}

// StandardFormulas
export async function listStandardFormulas(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().standardFormula.findMany({
      where: {
        OR: [{ name: { contains: sanitizedSearch } }, { productId: { contains: sanitizedSearch } }],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().standardFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createStandardFormula(input: StandardFormulaCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    version: input.version.replace(/[<>]/g, ''),
    productId: input.productId.replace(/[<>]/g, ''),
    instructions: input.instructions.replace(/[<>]/g, ''),
  };

  return getPrisma().standardFormula.create({ data: sanitizedInput });
}

// PackagingFormulas
export async function listPackagingFormulas(search?: string) {
  // Sanitizar a busca para evitar injeção
  if (search?.trim()) {
    const sanitizedSearch = search.replace(/[<>]/g, '');
    return getPrisma().packagingFormula.findMany({
      where: {
        OR: [{ name: { contains: sanitizedSearch } }, { productId: { contains: sanitizedSearch } }],
      },
      orderBy: { name: 'asc' },
    });
  }
  return getPrisma().packagingFormula.findMany({ orderBy: { name: 'asc' } });
}

export async function createPackagingFormula(input: PackagingFormulaCreateInput) {
  // Sanitizar os dados de entrada para evitar injeção
  const sanitizedInput = {
    ...input,
    name: input.name.replace(/[<>]/g, ''),
    productId: input.productId.replace(/[<>]/g, ''),
    packagingType: input.packagingType.replace(/[<>]/g, ''),
    notes: input.notes.replace(/[<>]/g, ''),
  };

  return getPrisma().packagingFormula.create({ data: sanitizedInput });
}
