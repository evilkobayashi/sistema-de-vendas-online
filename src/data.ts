export type Role = 'admin' | 'gerente' | 'operador';

export type User = {
  id: string;
  name: string;
  role: Role;
  employeeCode: string;
  password: string;
};

export type Medicine = {
  id: string;
  name: string;
  price: number;
  lab: string;
  specialty: string;
  controlled: boolean;
  image: string;
};

export type OrderItem = {
  medicineId: string;
  quantity: number;
};

export type Order = {
  id: string;
  patientName: string;
  email: string;
  phone: string;
  address: string;
  items: Array<OrderItem & { unitPrice: number; subtotal: number; medicineName: string }>;
  total: number;
  controlledValidated: boolean;
  createdBy: string;
  createdAt: string;
};

export type DeliveryStatus = 'pendente' | 'em_rota' | 'entregue';

export type Delivery = {
  orderId: string;
  patientName: string;
  status: DeliveryStatus;
  forecastDate: string;
  carrier: string;
};

export type Ticket = {
  id: string;
  subject: string;
  assignedTo: string;
  status: 'aberto' | 'em_atendimento' | 'fechado';
};

export const users: User[] = [
  { id: 'u1', name: 'Ana Admin', role: 'admin', employeeCode: '4B-001', password: 'admin123' },
  { id: 'u2', name: 'Gustavo Gerente', role: 'gerente', employeeCode: '4B-014', password: 'gerente123' },
  { id: 'u3', name: 'Olivia Operadora', role: 'operador', employeeCode: '4B-101', password: 'operador123' }
];

export const medicines: Medicine[] = [
  { id: 'm1', name: 'OncoRelief 20mg', price: 320.5, lab: '4bio Labs', specialty: 'Oncologia', controlled: true, image: '💊' },
  { id: 'm2', name: 'CardioPlus 10mg', price: 89.9, lab: 'BioHeart', specialty: 'Cardiologia', controlled: false, image: '❤️' },
  { id: 'm3', name: 'NeuroSafe 5mg', price: 145.0, lab: 'NeuroPharm', specialty: 'Neurologia', controlled: true, image: '🧠' },
  { id: 'm4', name: 'ImunoCare 50mg', price: 210.0, lab: '4bio Labs', specialty: 'Imunologia', controlled: false, image: '🛡️' }
];

export const orders: Order[] = [];

export const deliveries: Delivery[] = [];

export const tickets: Ticket[] = [
  { id: 't1', subject: 'Dúvida sobre receita controlada', assignedTo: 'u3', status: 'aberto' },
  { id: 't2', subject: 'Reagendar entrega #P-2025-001', assignedTo: 'u2', status: 'em_atendimento' }
];
