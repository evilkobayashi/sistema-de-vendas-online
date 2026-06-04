export type Role = 'admin' | 'gerente' | 'operador' | 'inventario';

export type Permission =
  | 'users.view'
  | 'users.create'
  | 'users.edit'
  | 'users.delete'
  | 'orders.view'
  | 'orders.create'
  | 'orders.edit'
  | 'orders.delete'
  | 'orders.validate_prescription'
  | 'inventory.view'
  | 'inventory.edit'
  | 'inventory.adjust'
  | 'deliveries.view'
  | 'deliveries.edit'
  | 'customers.view'
  | 'customers.create'
  | 'customers.edit'
  | 'customers.delete'
  | 'doctors.view'
  | 'doctors.create'
  | 'doctors.edit'
  | 'doctors.delete'
  | 'healthplans.view'
  | 'healthplans.create'
  | 'healthplans.edit'
  | 'healthplans.delete'
  | 'tickets.view'
  | 'tickets.edit'
  | 'reports.view'
  | 'settings.view'
  | 'settings.edit';

export type RolePermissions = {
  [key in Role]: Permission[];
};

export const rolePermissions: RolePermissions = {
  admin: [
    'users.view',
    'users.create',
    'users.edit',
    'users.delete',
    'orders.view',
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.validate_prescription',
    'inventory.view',
    'inventory.edit',
    'inventory.adjust',
    'deliveries.view',
    'deliveries.edit',
    'customers.view',
    'customers.create',
    'customers.edit',
    'customers.delete',
    'doctors.view',
    'doctors.create',
    'doctors.edit',
    'doctors.delete',
    'healthplans.view',
    'healthplans.create',
    'healthplans.edit',
    'healthplans.delete',
    'tickets.view',
    'tickets.edit',
    'reports.view',
    'settings.view',
    'settings.edit',
  ],
  gerente: [
    'users.view',
    'orders.view',
    'orders.create',
    'orders.edit',
    'orders.delete',
    'orders.validate_prescription',
    'inventory.view',
    'deliveries.view',
    'deliveries.edit',
    'customers.view',
    'customers.create',
    'customers.edit',
    'doctors.view',
    'doctors.create',
    'doctors.edit',
    'healthplans.view',
    'healthplans.create',
    'healthplans.edit',
    'tickets.view',
    'tickets.edit',
    'reports.view',
    'settings.view',
  ],
  operador: [
    'orders.view',
    'orders.create',
    'orders.validate_prescription',
    'inventory.view',
    'deliveries.view',
    'deliveries.edit',
    'customers.view',
    'customers.create',
    'doctors.view',
    'healthplans.view',
    'tickets.view',
    'tickets.edit',
  ],
  inventario: ['inventory.view', 'inventory.edit', 'inventory.adjust', 'orders.view'],
};

export type Session = {
  token: string;
  userId: string;
  createdAt: string;
  lastActivity: string;
  ipAddress?: string;
};

export const sessions: Session[] = [];

export type User = {
  id: string;
  name: string;
  email?: string;
  phone?: string;
  role: Role;
  employeeCode: string;
  password: string;
  active: boolean;
  createdAt: string;
  updatedAt?: string;
  createdBy?: string;
};

export function hasPermission(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false;
}

export type Medicine = {
  id: string;
  name: string;
  price: number;
  lab: string;
  specialty: string;
  controlled: boolean;
  image: string;
  description: string;
};

export type InventoryLot = {
  id: string;
  medicineId: string;
  batchCode: string;
  expiresAt: string;
  quantity: number;
  reserved: number;
  unitCost: number;
  supplier: string;
  createdAt: string;
};

export type InventoryMovementType = 'entrada' | 'reserva' | 'baixa' | 'ajuste';

export type InventoryMovement = {
  id: string;
  medicineId: string;
  lotId?: string;
  type: InventoryMovementType;
  quantity: number;
  reason: string;
  relatedOrderId?: string;
  createdBy: string;
  createdAt: string;
};

export type OrderItem = {
  medicineId: string;
  quantity: number;
  tabletsPerDay?: number;
  tabletsPerPackage?: number;
  treatmentDays?: number;
};

export type Prescription = {
  contentBase64?: string;
  mimeType?: string;
  prescriptionText: string;
  uploadedAt: string;
};

export type Order = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  address: string;
  patientId?: string;
  items: Array<OrderItem & { unitPrice: number; subtotal: number; medicineName: string; estimatedRunOutDate?: string }>;
  total: number;
  controlledValidated: boolean;
  createdBy: string;
  createdAt: string;
  estimatedTreatmentEndDate?: string;
  prescriptionCode?: string;
  prescription?: Prescription;
  recurring?: {
    discountPercent: number;
    nextBillingDate: string;
    needsConfirmation: boolean;
    lastConfirmationAt?: string;
    confirmedBy?: string;
    status?: 'pending' | 'confirmed' | 'postponed' | 'canceled';
  };
};

export type DeliveryStatus = 'pendente' | 'em_rota' | 'entregue' | 'falhou';

export type Delivery = {
  orderId: string;
  patientName: string;
  patientId?: string;
  status: DeliveryStatus;
  forecastDate: string;
  carrier: string;
  trackingCode?: string;
  shippingProvider?: string;
  syncStatus?: 'ok' | 'fallback' | 'queued_retry';
};

export type TicketHistoryEntry = {
  type: 'status_change' | 'note' | 'contact';
  from?: string;
  to?: string;
  channel?: string;
  subject?: string;
  message?: string;
  by: string;
  at: string;
  note?: string;
  status?: string;
};

export type Ticket = {
  id: string;
  subject: string;
  assignedTo: string;
  status: 'aberto' | 'em_atendimento' | 'fechado';
  priority?: 'baixa' | 'media' | 'alta';
  customerName?: string;
  customerEmail?: string;
  customerPhone?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
  history?: TicketHistoryEntry[];
};

export const users: User[] = [
  {
    id: 'u1',
    name: 'Ana Admin',
    email: 'ana.admin@4bio.com.br',
    phone: '(11) 99999-0001',
    role: 'admin',
    employeeCode: '4B-001',
    password: '$2b$10$JV7C8UwGx9DuydDrYAy09.M8oVpOU9IItWPY/HqcLUyBiE1ktEqaC',
    active: true,
    createdAt: '2024-01-01T00:00:00.000Z',
  },
  {
    id: 'u2',
    name: 'Gustavo Gerente',
    email: 'gustavo.gerente@4bio.com.br',
    phone: '(11) 99999-0002',
    role: 'gerente',
    employeeCode: '4B-014',
    password: '$2b$10$klpm.5/qv1/hPuwAEhZpd.7vY4J7.w7wGFt0ndOTvGNoNeq5nRPOO',
    active: true,
    createdAt: '2024-01-15T00:00:00.000Z',
  },
  {
    id: 'u3',
    name: 'Olivia Operadora',
    email: 'olivia.operadora@4bio.com.br',
    phone: '(11) 99999-0003',
    role: 'operador',
    employeeCode: '4B-101',
    password: '$2b$10$QkUtQX90.C.x3XsmgHZX5uaDwkyrCnw3ODOOYWaK.cI9vJfhpuWKS',
    active: true,
    createdAt: '2024-02-01T00:00:00.000Z',
  },
  {
    id: 'u4',
    name: 'Igor Inventário',
    email: 'igor.inventario@4bio.com.br',
    phone: '(11) 99999-0004',
    role: 'inventario',
    employeeCode: '4B-220',
    password: '$2b$10$pJHYRREMtZcRZ/IAjEuy9e/vpmuCZD1WnmvDu7IZtO6SNq4zPubXG',
    active: true,
    createdAt: '2024-03-01T00:00:00.000Z',
  },
];

export const medicines: Medicine[] = [
  {
    id: 'm1',
    name: 'OncoRelief 20mg',
    price: 320.5,
    lab: '4bio Labs',
    specialty: 'Oncologia',
    controlled: true,
    image: 'https://picsum.photos/seed/med1/320/220',
    description: 'Uso oncológico com protocolo de acompanhamento especializado.',
  },
  {
    id: 'm2',
    name: 'CardioPlus 10mg',
    price: 89.9,
    lab: 'BioHeart',
    specialty: 'Cardiologia',
    controlled: false,
    image: 'https://picsum.photos/seed/med2/320/220',
    description: 'Suporte cardiológico para uso contínuo conforme prescrição.',
  },
  {
    id: 'm3',
    name: 'NeuroSafe 5mg',
    price: 145.0,
    lab: 'NeuroPharm',
    specialty: 'Neurologia',
    controlled: true,
    image: 'https://picsum.photos/seed/med3/320/220',
    description: 'Medicamento neurológico com controle rígido de dispensação.',
  },
  {
    id: 'm4',
    name: 'ImunoCare 50mg',
    price: 210.0,
    lab: '4bio Labs',
    specialty: 'Imunologia',
    controlled: false,
    image: 'https://picsum.photos/seed/med4/320/220',
    description: 'Tratamento imunológico para protocolos de média complexidade.',
  },
];

const baseDate = Date.now();

export const inventoryLots: InventoryLot[] = [
  {
    id: 'lot-1',
    medicineId: 'm1',
    batchCode: 'ONC-2401',
    expiresAt: new Date(baseDate + 120 * 86400000).toISOString().slice(0, 10),
    quantity: 30,
    reserved: 0,
    unitCost: 250,
    supplier: '4bio Labs',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lot-2',
    medicineId: 'm2',
    batchCode: 'CAR-2402',
    expiresAt: new Date(baseDate + 90 * 86400000).toISOString().slice(0, 10),
    quantity: 120,
    reserved: 0,
    unitCost: 55,
    supplier: 'BioHeart',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lot-3',
    medicineId: 'm3',
    batchCode: 'NEU-2403',
    expiresAt: new Date(baseDate + 45 * 86400000).toISOString().slice(0, 10),
    quantity: 40,
    reserved: 0,
    unitCost: 98,
    supplier: 'NeuroPharm',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'lot-4',
    medicineId: 'm4',
    batchCode: 'IMU-2404',
    expiresAt: new Date(baseDate + 20 * 86400000).toISOString().slice(0, 10),
    quantity: 15,
    reserved: 0,
    unitCost: 130,
    supplier: '4bio Labs',
    createdAt: new Date().toISOString(),
  },
];

export const inventoryMovements: InventoryMovement[] = [];
export const orders: Order[] = [];
export const deliveries: Delivery[] = [];

export type Customer = {
  id: string;
  name: string;
  patientCode: string;
  insuranceCardCode: string;
  healthPlanId: string;
  doctorId: string;
  diseaseCid: string;
  email: string;
  phone: string;
  address: string;
  createdAt?: string;
};

export type HealthPlan = {
  id: string;
  name: string;
  providerName: string;
  registrationCode: string;
};

export type Doctor = {
  id: string;
  name: string;
  crm: string;
  specialty: string;
  email: string;
  phone: string;
  createdAt?: string;
};

export const customers: Customer[] = [];
export const healthPlans: HealthPlan[] = [];
export const doctors: Doctor[] = [];

export const tickets: Ticket[] = [
  {
    id: 't1',
    subject: 'Dúvida sobre dosagem de Rivotril 2mg',
    status: 'aberto',
    priority: 'alta',
    assignedTo: 'u3',
    customerName: 'Maria Silva',
    customerEmail: 'maria.silva@email.com',
    customerPhone: '(11) 98765-4321',
    description:
      'Paciente está com dúvida sobre a dosagem correta do Rivotril. O médico prescreveu 1mg pela manhã e 1mg à noite, mas ela está tomando 2mg de uma vez.',
    createdAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    history: [],
  },
  {
    id: 't2',
    subject: 'Medicamento não chegou no prazo',
    status: 'em_atendimento',
    priority: 'media',
    assignedTo: 'u2',
    customerName: 'João Santos',
    customerEmail: 'joao.santos@email.com',
    customerPhone: '(11) 91234-5678',
    description:
      'Pedido P-2026-ABC01 deveria ter chegado ontem, mas ainda não foi entregue. Cliente está sem medicação há 2 dias.',
    createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
    history: [
      {
        type: 'status_change',
        from: 'aberto',
        to: 'em_atendimento',
        by: 'Gustavo Gerente',
        at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
        note: 'Ticket assumido pelo gerente para acompanhamento',
      },
      {
        type: 'contact',
        channel: 'email',
        subject: 'Re: Medicamento não chegou no prazo',
        message:
          'Prezado João, informamos que verificamos o status da sua entrega. O prazo é de 3-5 dias úteis. Por favor, aguarde mais 24h.',
        by: 'Gustavo Gerente',
        at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
      },
    ],
  },
  {
    id: 't3',
    subject: 'Solicitação de nota fiscal',
    status: 'fechado',
    priority: 'baixa',
    assignedTo: 'u3',
    customerName: 'Ana Costa',
    customerEmail: 'ana.costa@email.com',
    customerPhone: '(11) 99876-5432',
    description: 'Cliente solicitou 2ª via da nota fiscal do pedido P-2026-ABC05.',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    history: [
      {
        type: 'status_change',
        from: 'aberto',
        to: 'em_atendimento',
        by: 'Olivia Operadora',
        at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'Iniciando atendimento',
      },
      {
        type: 'contact',
        channel: 'email',
        subject: 'Re: Solicitação de nota fiscal',
        message: 'Prezada Ana, segue em anexo a 2ª via da nota fiscal solicitada.',
        by: 'Olivia Operadora',
        at: new Date(Date.now() - 5.5 * 24 * 60 * 60 * 1000).toISOString(),
        status: 'sent',
      },
      {
        type: 'status_change',
        from: 'em_atendimento',
        to: 'fechado',
        by: 'Olivia Operadora',
        at: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
        note: 'Solicitação atendida - nota fiscal enviada por e-mail',
      },
    ],
  },
  {
    id: 't4',
    subject: 'Troca de endereço de entrega',
    status: 'aberto',
    priority: 'media',
    assignedTo: 'u3',
    customerName: 'Carlos Mendes',
    customerEmail: 'carlos.mendes@email.com',
    customerPhone: '(11) 95555-1234',
    description: 'Cliente mudou de endereço e precisa atualizar o local de entrega do próximo pedido recorrente.',
    createdAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    history: [],
  },
];

export type NotificationType = {
  id: string;
  type: 'info' | 'warning' | 'success' | 'error';
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  link?: string;
  category?: 'order' | 'delivery' | 'inventory' | 'ticket' | 'system';
};

export const notifications: NotificationType[] = [];
