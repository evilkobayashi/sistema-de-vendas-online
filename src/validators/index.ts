// src/validators/index.ts
import { z } from 'zod';

// Esquemas de validação centralizados

// Login
export const loginSchema = z.object({
  employeeCode: z.string(),
  password: z.string(),
});

// Paginação
export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
});

// Pacientes/Clientes
export const customerCreateSchema = z.object({
  name: z.string().min(2),
  patientCode: z.string().min(2),
  insuranceCardCode: z.string().min(2),
  healthPlanId: z.string().min(2),
  doctorId: z.string().min(2),
  insurancePlanName: z.string().min(2).optional(),
  insuranceProviderName: z.string().min(2).optional(),
  diseaseCid: z.string().min(2),
  primaryDoctorId: z.string().min(2).optional(),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
});

export const customerUpdateSchema = customerCreateSchema.partial();

// Médicos
export const doctorCreateSchema = z.object({
  name: z.string().min(2),
  crm: z.string().min(4),
  specialty: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
});

export const doctorUpdateSchema = doctorCreateSchema.partial();

// Planos de saúde
export const healthPlanCreateSchema = z.object({
  name: z.string().min(2),
  providerName: z.string().min(2),
  registrationCode: z.string().min(3),
});

export const healthPlanUpdateSchema = healthPlanCreateSchema.partial();

// Funcionários
export const employeeCreateSchema = z.object({
  name: z.string().min(2),
  role: z.string().min(2),
  employeeCode: z.string().min(3),
  email: z.string().email(),
  phone: z.string().min(8),
});

// Fornecedores
export const supplierCreateSchema = z.object({
  name: z.string().min(2),
  document: z.string().min(5),
  email: z.string().email(),
  phone: z.string().min(8),
  category: z.string().min(2),
});

// Produtos acabados
export const finishedProductCreateSchema = z.object({
  name: z.string().min(2),
  productType: z.enum(['acabado', 'revenda']),
  sku: z.string().min(3),
  unit: z.string().min(1),
  price: z.coerce.number().positive(),
});

// Matérias-primas
export const rawMaterialCreateSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(3),
  unit: z.string().min(1),
  cost: z.coerce.number().positive(),
});

// Fórmulas padrão
export const standardFormulaCreateSchema = z.object({
  name: z.string().min(2),
  version: z.string().min(1),
  productId: z.string().min(2),
  instructions: z.string().min(5),
});

// Fórmulas de embalagem
export const packagingFormulaCreateSchema = z.object({
  name: z.string().min(2),
  productId: z.string().min(2),
  packagingType: z.string().min(2),
  unitsPerPackage: z.coerce.number().int().positive(),
  notes: z.string().min(2),
});

// Lotes de inventário
export const inventoryLotSchema = z.object({
  medicineId: z.string(),
  batchCode: z.string().min(3),
  expiresAt: z.string(),
  quantity: z.coerce.number().int().positive(),
  unitCost: z.coerce.number().positive(),
  supplier: z.string().min(2),
});

// Entrada de inventário
export const inventoryEntrySchema = z.object({
  medicineId: z.string(),
  batchCode: z.string().min(3),
  expiresAt: z.string(),
  supplier: z.string().min(2),
  sourceUnit: z.string().min(1),
  targetUnit: z.string().min(1),
  sourceQuantity: z.coerce.number().positive(),
  conversionFactor: z.coerce.number().positive(),
  unitCost: z.coerce.number().positive(),
});

// XML de NF-e
export const inventoryNfeXmlSchema = z.object({
  xml: z.string().min(20),
  supplier: z.string().min(2),
  defaultExpiresAt: z.string().optional(),
  defaultUnitCost: z.coerce.number().positive().optional(),
  conversionFactor: z.coerce.number().positive().default(1),
});

// Vendas/Pedidos
export const saleSchema = z.object({
  patientName: z.string().min(2),
  email: z.string().email(),
  phone: z.string().min(8),
  address: z.string().min(5),
  customerId: z.string().optional(),
  items: z
    .array(
      z.object({
        medicineId: z.string(),
        quantity: z.number().int().positive(),
        tabletsPerDay: z.number().positive().optional(),
        tabletsPerPackage: z.number().int().positive().optional(),
        treatmentDays: z.number().int().positive().optional(),
      })
    )
    .min(1),
  prescriptionCode: z.string().optional(),
  recurring: z
    .object({
      discountPercent: z.number().min(0).max(100),
      nextBillingDate: z.string().optional(),
    })
    .optional(),
});

// Atualização de entrega
export const deliveryUpdateSchema = z.object({
  status: z.enum(['pendente', 'em_rota', 'entregue', 'falhou']).optional(),
  forecastDate: z.string().optional(),
  carrier: z.string().optional(),
  trackingCode: z.string().optional(),
  shippingProvider: z.string().optional(),
  syncStatus: z.enum(['ok', 'fallback', 'queued_retry']).optional(),
});

// Parse de receita
export const prescriptionParseSchema = z.object({
  text: z.string().min(8).max(6000),
});

export const prescriptionDocumentSchema = z.object({
  filename: z.string().min(3),
  mimeType: z.string().min(3),
  contentBase64: z.string().min(16),
  prescriptionText: z.string().optional(),
});

// Contato com paciente
export const patientContactSchema = z.object({
  type: z.enum(['call', 'email']),
  subject: z.string().min(2).optional(),
  message: z.string().min(2).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// Cotação de frete
export const shippingQuoteSchema = z.object({
  destinationZip: z.string().optional(),
  weightKg: z.coerce.number().positive().default(0.3),
  declaredValue: z.coerce.number().nonnegative().default(0),
});

// Orçamento
export const budgetCreateSchema = z.object({
  patientName: z.string().min(2),
  doctorName: z.string().min(2).optional(),
  prescriptionText: z.string().min(8),
  estimatedDays: z.coerce.number().int().positive().default(30),
});

// Leitura de balança
export const scaleReadingSchema = z.object({
  quoteId: z.string(),
  medicineId: z.string(),
  expectedWeightGrams: z.coerce.number().positive(),
  measuredWeightGrams: z.coerce.number().positive(),
});

// Produção
export const standardProductionSchema = z.object({
  formulaId: z.string(),
  batchSize: z.coerce.number().int().positive(),
  operator: z.string().min(2),
});

// Reajuste de preços
export const autoPricingSchema = z.object({
  percent: z.coerce.number().min(-50).max(200),
  specialty: z.string().optional(),
  lab: z.string().optional(),
  reason: z.string().min(3).default('Atualização automática de lista de preço'),
});

// Medicamentos
export const medicineCreateSchema = z.object({
  name: z.string().min(3),
  price: z.coerce.number().positive(),
  lab: z.string().min(2),
  specialty: z.string().min(2),
  description: z.string().min(5).max(300),
  controlled: z.coerce.boolean().default(false),
  image: z.string().url().or(z.string().startsWith('data:image/')).or(z.literal('')).default(''),
});

export const medicineUpdateSchema = medicineCreateSchema.partial();

// Atualização de senha de funcionário
export const employeePasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string().min(6),
});

// Exportação centralizada
export const validators = {
  login: loginSchema,
  pagination: paginationSchema,
  customer: {
    create: customerCreateSchema,
    update: customerUpdateSchema,
  },
  doctor: {
    create: doctorCreateSchema,
    update: doctorUpdateSchema,
  },
  healthPlan: {
    create: healthPlanCreateSchema,
    update: healthPlanUpdateSchema,
  },
  employee: {
    create: employeeCreateSchema,
  },
  supplier: {
    create: supplierCreateSchema,
  },
  finishedProduct: {
    create: finishedProductCreateSchema,
  },
  rawMaterial: {
    create: rawMaterialCreateSchema,
  },
  standardFormula: {
    create: standardFormulaCreateSchema,
  },
  packagingFormula: {
    create: packagingFormulaCreateSchema,
  },
  inventory: {
    lot: inventoryLotSchema,
    entry: inventoryEntrySchema,
    nfeXml: inventoryNfeXmlSchema,
  },
  sale: saleSchema,
  deliveryUpdate: deliveryUpdateSchema,
  prescription: {
    parse: prescriptionParseSchema,
    document: prescriptionDocumentSchema,
  },
  patientContact: patientContactSchema,
  shippingQuote: shippingQuoteSchema,
  budget: budgetCreateSchema,
  scaleReading: scaleReadingSchema,
  production: standardProductionSchema,
  autoPricing: autoPricingSchema,
  medicine: medicineCreateSchema,
  employeePassword: employeePasswordSchema,
};
