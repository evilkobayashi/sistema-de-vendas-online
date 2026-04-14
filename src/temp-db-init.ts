import {
  medicines,
  orders,
  deliveries,
  users,
  customers,
  healthPlans,
  doctors,
  inventoryLots,
  inventoryMovements,
  tickets,
  notifications,
  type Role,
  type DeliveryStatus,
  type InventoryMovementType,
} from './data.js';
import { persistState } from './store.js';
import bcrypt from 'bcrypt';

// Sample data for temporary database initialization
const sampleData: {
  medicines: Array<{
    id: string;
    name: string;
    price: number;
    lab: string;
    specialty: string;
    description: string;
    controlled: boolean;
    image: string;
  }>;
  users: Array<{
    id: string;
    name: string;
    role: Role;
    employeeCode: string;
    password: string;
    email?: string;
    phone?: string;
    active: boolean;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    patientName: string;
    email: string;
    phone: string;
    address: string;
    patientId: string;
    items: Array<{
      medicineId: string;
      medicineName: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      tabletsPerDay?: number;
      tabletsPerPackage?: number;
      treatmentDays?: number;
      estimatedRunOutDate: string;
    }>;
    total: number;
    controlledValidated: boolean;
    createdBy: string;
    createdAt: string;
    estimatedTreatmentEndDate?: string;
    recurring?: {
      discountPercent: number;
      nextBillingDate: string;
      needsConfirmation: boolean;
    };
  }>;
  deliveries: Array<{
    orderId: string;
    patientName: string;
    patientId: string;
    status: DeliveryStatus;
    forecastDate: string;
    carrier: string;
    trackingCode: string;
    shippingProvider: string;
    syncStatus: 'ok' | 'fallback' | 'queued_retry';
  }>;
  tickets: Array<{
    id: string;
    subject: string;
    status: 'aberto' | 'em_atendimento' | 'fechado';
    assignedTo: string;
    priority?: 'baixa' | 'media' | 'alta';
    customerName?: string;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
  }>;
  inventoryLots: Array<{
    id: string;
    medicineId: string;
    batchCode: string;
    expiresAt: string;
    quantity: number;
    reserved: number;
    unitCost: number;
    supplier: string;
    createdAt: string;
  }>;
  inventoryMovements: Array<{
    id: string;
    medicineId: string;
    lotId: string;
    type: InventoryMovementType;
    quantity: number;
    reason: string;
    createdBy: string;
    createdAt: string;
  }>;
} = {
  medicines: [
    {
      id: 'med-1',
      name: 'Paracetamol 750mg',
      price: 12.5,
      lab: 'EMS',
      specialty: 'Analgésico',
      description: 'Analgésico e antitérmico eficaz',
      controlled: false,
      image: 'https://picsum.photos/seed/paracetamol/320/220',
    },
    {
      id: 'med-2',
      name: 'Omeprazol 20mg',
      price: 18.9,
      lab: 'Eurofarma',
      specialty: 'Gastroenterologia',
      description: 'Inibidor da bomba de prótons',
      controlled: false,
      image: 'https://picsum.photos/seed/omeprazol/320/220',
    },
    {
      id: 'med-3',
      name: 'Rivotril 2mg',
      price: 32.45,
      lab: 'Roche',
      specialty: 'Neurologia',
      description: 'Benzodiazepínico de ação prolongada',
      controlled: true,
      image: 'https://picsum.photos/seed/rivotril/320/220',
    },
    {
      id: 'med-4',
      name: 'Losartana 50mg',
      price: 22.3,
      lab: 'MSD',
      specialty: 'Cardiologia',
      description: 'Antagonista do receptor da angiotensina II',
      controlled: false,
      image: 'https://picsum.photos/seed/losartana/320/220',
    },
    {
      id: 'med-5',
      name: 'Metformina 850mg',
      price: 15.75,
      lab: 'Bristol',
      specialty: 'Diabetes',
      description: 'Biguanídeo hipoglicemiante',
      controlled: false,
      image: 'https://picsum.photos/seed/metformina/320/220',
    },
  ],
  users: [
    {
      id: 'user-admin',
      name: 'Administrador',
      role: 'admin',
      employeeCode: 'ADM001',
      password: bcrypt.hashSync('admin123', 10),
      active: true,
      createdAt: '2024-01-01T00:00:00.000Z',
    },
    {
      id: 'user-manager',
      name: 'Gerente',
      role: 'gerente',
      employeeCode: 'MGR001',
      password: bcrypt.hashSync('manager123', 10),
      active: true,
      createdAt: '2024-01-15T00:00:00.000Z',
    },
    {
      id: 'user-operator',
      name: 'Operador',
      role: 'operador',
      employeeCode: 'OPR001',
      password: bcrypt.hashSync('operator123', 10),
      active: true,
      createdAt: '2024-02-01T00:00:00.000Z',
    },
  ],
  orders: [
    {
      id: 'ORD-2025-001',
      patientName: 'Maria Silva Oliveira',
      email: 'maria.silva@email.com',
      phone: '(11) 99876-5432',
      address: 'Rua das Flores, 123, São Paulo/SP',
      patientId: 'cust-1',
      items: [
        {
          medicineId: 'med-1',
          medicineName: 'Paracetamol 750mg',
          quantity: 2,
          unitPrice: 12.5,
          subtotal: 25.0,
          tabletsPerDay: 1,
          tabletsPerPackage: 20,
          treatmentDays: 10,
          estimatedRunOutDate: '2025-02-15',
        },
        {
          medicineId: 'med-5',
          medicineName: 'Metformina 850mg',
          quantity: 3,
          unitPrice: 15.75,
          subtotal: 47.25,
          tabletsPerDay: 2,
          tabletsPerPackage: 30,
          treatmentDays: 30,
          estimatedRunOutDate: '2025-02-20',
        },
      ],
      total: 72.25,
      controlledValidated: false,
      createdBy: 'user-admin',
      createdAt: '2025-01-15T10:30:00.000Z',
      estimatedTreatmentEndDate: '2025-02-20',
      recurring: undefined,
    },
    {
      id: 'ORD-2025-002',
      patientName: 'João Antônio Pereira',
      email: 'joao.pereira@email.com',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000, São Paulo/SP',
      patientId: 'cust-2',
      items: [
        {
          medicineId: 'med-4',
          medicineName: 'Losartana 50mg',
          quantity: 2,
          unitPrice: 22.3,
          subtotal: 44.6,
          tabletsPerDay: 1,
          tabletsPerPackage: 30,
          treatmentDays: 60,
          estimatedRunOutDate: '2025-03-15',
        },
      ],
      total: 44.6,
      controlledValidated: false,
      createdBy: 'user-manager',
      createdAt: '2025-01-16T14:20:00.000Z',
      estimatedTreatmentEndDate: '2025-05-15',
      recurring: {
        discountPercent: 5,
        nextBillingDate: '2026-04-15',
        needsConfirmation: true,
      },
    },
    {
      id: 'ORD-2026-004',
      patientName: 'Roberto Carlos Santos',
      email: 'roberto.santos@email.com',
      phone: '(11) 96543-2109',
      address: 'Alameda Santos, 200, São Paulo/SP',
      patientId: 'cust-4',
      items: [
        {
          medicineId: 'med-4',
          medicineName: 'Losartana 50mg',
          quantity: 3,
          unitPrice: 22.3,
          subtotal: 66.9,
          tabletsPerDay: 1,
          tabletsPerPackage: 30,
          treatmentDays: 90,
          estimatedRunOutDate: '2026-07-10',
        },
      ],
      total: 66.9,
      controlledValidated: false,
      createdBy: 'user-operator',
      createdAt: '2026-01-10T08:00:00.000Z',
      estimatedTreatmentEndDate: '2026-07-10',
      recurring: {
        discountPercent: 10,
        nextBillingDate: '2026-04-15',
        needsConfirmation: true,
      },
    },
    {
      id: 'ORD-2026-005',
      patientName: 'Carla Cristina Mendes',
      email: 'carla.mendes@email.com',
      phone: '(11) 95432-1098',
      address: 'Rua Augusta, 800, São Paulo/SP',
      patientId: 'cust-5',
      items: [
        {
          medicineId: 'med-2',
          medicineName: 'Omeprazol 20mg',
          quantity: 2,
          unitPrice: 18.5,
          subtotal: 37.0,
          tabletsPerDay: 1,
          tabletsPerPackage: 28,
          treatmentDays: 56,
          estimatedRunOutDate: '2026-06-05',
        },
      ],
      total: 37.0,
      controlledValidated: false,
      createdBy: 'user-manager',
      createdAt: '2026-02-05T10:30:00.000Z',
      estimatedTreatmentEndDate: '2026-06-05',
      recurring: {
        discountPercent: 5,
        nextBillingDate: '2026-04-13',
        needsConfirmation: true,
      },
    },
    {
      id: 'ORD-2026-006',
      patientName: 'Paulo Henrique Lima',
      email: 'paulo.lima@email.com',
      phone: '(11) 94321-0987',
      address: 'Av. Brigadeiro Faria Lima, 1500, São Paulo/SP',
      patientId: 'cust-6',
      items: [
        {
          medicineId: 'med-3',
          medicineName: 'Atorvastatina 20mg',
          quantity: 1,
          unitPrice: 25.0,
          subtotal: 25.0,
          tabletsPerDay: 1,
          tabletsPerPackage: 30,
          treatmentDays: 30,
          estimatedRunOutDate: '2026-05-18',
        },
      ],
      total: 25.0,
      controlledValidated: false,
      createdBy: 'user-operator',
      createdAt: '2026-03-18T14:00:00.000Z',
      estimatedTreatmentEndDate: '2026-05-18',
      recurring: {
        discountPercent: 0,
        nextBillingDate: '2026-04-16',
        needsConfirmation: true,
      },
    },
  ],
  deliveries: [
    {
      orderId: 'ORD-2025-001',
      patientName: 'Maria Silva Oliveira',
      patientId: 'cust-1',
      status: 'entregue',
      forecastDate: '2025-01-17',
      carrier: 'Correios',
      trackingCode: 'BR00123456789',
      shippingProvider: 'Correios',
      syncStatus: 'ok',
    },
    {
      orderId: 'ORD-2025-002',
      patientName: 'João Antônio Pereira',
      patientId: 'cust-2',
      status: 'em_rota',
      forecastDate: '2025-01-20',
      carrier: 'Jadlog',
      trackingCode: 'JD00987654321',
      shippingProvider: 'Jadlog',
      syncStatus: 'ok',
    },
    {
      orderId: 'ORD-2025-003',
      patientName: 'Ana Beatriz Costa',
      patientId: 'cust-3',
      status: 'falhou',
      forecastDate: '2025-02-12',
      carrier: 'Correios',
      trackingCode: 'BR00998877665',
      shippingProvider: 'Correios',
      syncStatus: 'queued_retry',
    },
  ],
  tickets: [
    {
      id: 'TK-2025-001',
      subject: 'URGENTE: Medicamento controlado sem estoque',
      status: 'aberto',
      assignedTo: 'Operador',
      priority: 'alta',
      customerName: 'Carlos Eduardo Mendes',
      description:
        'Paciente necessita de Rivotril 2mg com urgência. Último fornecimento foi há 45 dias e a receita vence em 5 dias. Solicitar reposição imediata.',
      createdAt: '2025-04-10T09:15:00.000Z',
    },
    {
      id: 'TK-2025-002',
      subject: 'Dúvida sobre interação medicamentosa',
      status: 'em_atendimento',
      assignedTo: 'Gerente',
      priority: 'media',
      customerName: 'Fernanda Ribeiro',
      description:
        'Cliente pergunta se pode tomar Omeprazol junto com Metformina. Medicamento foi prescrito por médicos diferentes.',
      createdAt: '2025-04-09T14:30:00.000Z',
      updatedAt: '2025-04-10T10:00:00.000Z',
    },
    {
      id: 'TK-2025-003',
      subject: 'Renovação de receita médica',
      status: 'aberto',
      assignedTo: 'Operador',
      priority: 'media',
      customerName: 'Roberto Augusto',
      description:
        'Solicitar renovação de receita de Losartana 50mg. Paciente é hipertenso e não pode ficar sem medicação.',
      createdAt: '2025-04-08T11:45:00.000Z',
    },
    {
      id: 'TK-2025-004',
      subject: 'Entrega não recebeu - Correios',
      status: 'em_atendimento',
      assignedTo: 'Operador',
      priority: 'baixa',
      customerName: 'Ana Beatriz Costa',
      description:
        'Paciente informa que o código de rastreio BR00998877665 mostra "falhou" mas não recebeu comunicação da farmácia.',
      createdAt: '2025-04-12T16:20:00.000Z',
      updatedAt: '2025-04-13T09:00:00.000Z',
    },
    {
      id: 'TK-2025-005',
      subject: 'Confirmação de agendamento de entrega',
      status: 'fechado',
      assignedTo: 'Operador',
      priority: 'baixa',
      customerName: 'Maria Silva Oliveira',
      description: 'Confirmado agendamento de entrega para 15/04/2025 no período da manhã.',
      createdAt: '2025-04-05T10:00:00.000Z',
      updatedAt: '2025-04-05T14:30:00.000Z',
    },
    {
      id: 'TK-2025-006',
      subject: 'Problema com preço do medicamento',
      status: 'fechado',
      assignedTo: 'Gerente',
      priority: 'media',
      customerName: 'João Antônio Pereira',
      description:
        'Cliente questionou aumento de preço do OncoRelief. Explicado que houve reajuste de fornecedor. Cliente aceitou.',
      createdAt: '2025-04-03T08:30:00.000Z',
      updatedAt: '2025-04-03T11:45:00.000Z',
    },
    {
      id: 'TK-2025-007',
      subject: 'Solicitação de orçamento manipulado',
      status: 'aberto',
      assignedTo: 'Operador',
      priority: 'media',
      customerName: 'Luciana Ferreira',
      description:
        'Cliente solicita orçamento para produto manipulado à base de probabilistic neural network para tratamento dermatológico.',
      createdAt: '2025-04-13T07:45:00.000Z',
    },
  ],
  inventoryLots: [
    {
      id: 'lot-1',
      medicineId: 'med-1',
      batchCode: 'LOTE-PAR-001',
      expiresAt: '2026-12-31',
      quantity: 100,
      reserved: 4,
      unitCost: 10.0,
      supplier: 'Distribuidora ABC',
      createdAt: '2025-01-10T09:00:00.000Z',
    },
    {
      id: 'lot-2',
      medicineId: 'med-2',
      batchCode: 'LOTE-OME-001',
      expiresAt: '2026-10-15',
      quantity: 80,
      reserved: 0,
      unitCost: 15.0,
      supplier: 'Distribuidora XYZ',
      createdAt: '2025-01-12T10:30:00.000Z',
    },
    {
      id: 'lot-3',
      medicineId: 'med-4',
      batchCode: 'LOTE-LOS-001',
      expiresAt: '2027-05-20',
      quantity: 150,
      reserved: 2,
      unitCost: 18.0,
      supplier: 'Distribuidora Pharma',
      createdAt: '2025-01-08T14:20:00.000Z',
    },
    {
      id: 'lot-4',
      medicineId: 'med-5',
      batchCode: 'LOTE-MET-001',
      expiresAt: '2026-08-30',
      quantity: 200,
      reserved: 6,
      unitCost: 12.0,
      supplier: 'Distribuidora Life',
      createdAt: '2025-01-14T11:15:00.000Z',
    },
  ],
  inventoryMovements: [
    {
      id: 'mov-1',
      medicineId: 'med-1',
      lotId: 'lot-1',
      type: 'entrada',
      quantity: 100,
      reason: 'Entrada de mercadoria',
      createdBy: 'user-admin',
      createdAt: '2025-01-10T09:00:00.000Z',
    },
    {
      id: 'mov-2',
      medicineId: 'med-2',
      lotId: 'lot-2',
      type: 'entrada',
      quantity: 80,
      reason: 'Entrada de mercadoria',
      createdBy: 'user-manager',
      createdAt: '2025-01-12T10:30:00.000Z',
    },
    {
      id: 'mov-3',
      medicineId: 'med-1',
      lotId: 'lot-1',
      type: 'baixa',
      quantity: 4,
      reason: 'Reserva para pedido ORD-2025-001',
      createdBy: 'user-admin',
      createdAt: '2025-01-15T10:35:00.000Z',
    },
  ],
};

export async function initializeTempDatabase() {
  console.log('Initializing temporary database with sample data...');

  // Clear existing data
  medicines.length = 0;
  orders.length = 0;
  deliveries.length = 0;
  users.length = 0;
  customers.length = 0;
  healthPlans.length = 0;
  doctors.length = 0;
  tickets.length = 0;
  inventoryLots.length = 0;
  inventoryMovements.length = 0;

  // Populate all data structures
  sampleData.medicines.forEach((med) => medicines.push(med));
  sampleData.users.forEach((user) => users.push(user));
  sampleData.orders.forEach((order) => orders.push(order));
  sampleData.deliveries.forEach((delivery) => deliveries.push(delivery));
  sampleData.tickets.forEach((ticket) => tickets.push(ticket));
  sampleData.inventoryLots.forEach((lot) => inventoryLots.push(lot));
  sampleData.inventoryMovements.forEach((movement) => inventoryMovements.push(movement));

  // Populate additional data structures with sample data
  const sampleCustomers = [
    {
      id: 'cust-1',
      name: 'Maria Silva Oliveira',
      patientCode: 'PAC-001',
      insuranceCardCode: 'CART-123456',
      healthPlanId: 'hp-1',
      doctorId: 'doc-1',
      diseaseCid: 'E11 - Diabetes tipo 2',
      email: 'maria.silva@email.com',
      phone: '(11) 99876-5432',
      address: 'Rua das Flores, 123, São Paulo/SP',
      createdAt: '2024-01-15T10:00:00.000Z',
    },
    {
      id: 'cust-2',
      name: 'João Antônio Pereira',
      patientCode: 'PAC-002',
      insuranceCardCode: 'CART-789012',
      healthPlanId: 'hp-2',
      doctorId: 'doc-2',
      diseaseCid: 'I10 - Hipertensão essencial',
      email: 'joao.pereira@email.com',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000, São Paulo/SP',
      createdAt: '2024-02-20T14:30:00.000Z',
    },
    {
      id: 'cust-3',
      name: 'Ana Beatriz Costa',
      patientCode: 'PAC-003',
      insuranceCardCode: 'CART-345678',
      healthPlanId: 'hp-1',
      doctorId: 'doc-3',
      diseaseCid: 'G47 - Distúrbios do sono',
      email: 'ana.costa@email.com',
      phone: '(11) 97654-3210',
      address: 'Rua Oscar Freire, 500, São Paulo/SP',
      createdAt: '2024-03-10T09:15:00.000Z',
    },
    {
      id: 'cust-4',
      name: 'Roberto Carlos Santos',
      patientCode: 'PAC-004',
      insuranceCardCode: 'CART-456789',
      healthPlanId: 'hp-3',
      doctorId: 'doc-4',
      diseaseCid: 'I25 - Doença cardíaca isquêmica',
      email: 'roberto.santos@email.com',
      phone: '(11) 96543-2109',
      address: 'Alameda Santos, 200, São Paulo/SP',
      createdAt: '2024-04-05T11:20:00.000Z',
    },
    {
      id: 'cust-5',
      name: 'Carla Cristina Mendes',
      patientCode: 'PAC-005',
      insuranceCardCode: 'CART-567890',
      healthPlanId: 'hp-2',
      doctorId: 'doc-5',
      diseaseCid: 'L40 - Psoríase',
      email: 'carla.mendes@email.com',
      phone: '(11) 95432-1098',
      address: 'Rua Augusta, 800, São Paulo/SP',
      createdAt: '2024-05-12T16:45:00.000Z',
    },
    {
      id: 'cust-6',
      name: 'Paulo Henrique Lima',
      patientCode: 'PAC-006',
      insuranceCardCode: 'CART-678901',
      healthPlanId: 'hp-1',
      doctorId: 'doc-2',
      diseaseCid: 'E78 - Hipercolesterolemia',
      email: 'paulo.lima@email.com',
      phone: '(11) 94321-0987',
      address: 'Av. Brigadeiro Faria Lima, 1500, São Paulo/SP',
      createdAt: '2024-06-18T08:30:00.000Z',
    },
    {
      id: 'cust-7',
      name: 'Fernanda Alves Oliveira',
      patientCode: 'PAC-007',
      insuranceCardCode: 'CART-789012',
      healthPlanId: 'hp-3',
      doctorId: 'doc-6',
      diseaseCid: 'N18 - Doença renal crônica',
      email: 'fernanda.oliveira@email.com',
      phone: '(11) 93210-9876',
      address: 'Rua Haddock Lobo, 300, São Paulo/SP',
      createdAt: '2024-07-22T13:00:00.000Z',
    },
    {
      id: 'cust-8',
      name: 'Lucas Gabriel Ferreira',
      patientCode: 'PAC-008',
      insuranceCardCode: 'CART-890123',
      healthPlanId: 'hp-2',
      doctorId: 'doc-1',
      diseaseCid: 'E11 - Diabetes tipo 1',
      email: 'lucas.ferreira@email.com',
      phone: '(11) 92109-8765',
      address: 'Av. Rebouças, 2500, São Paulo/SP',
      createdAt: '2024-08-30T10:15:00.000Z',
    },
    {
      id: 'cust-9',
      name: 'Marcia Regina Barbosa',
      patientCode: 'PAC-009',
      insuranceCardCode: 'CART-901234',
      healthPlanId: 'hp-1',
      doctorId: 'doc-3',
      diseaseCid: 'F32 - Episódio depressivo',
      email: 'marcia.barbosa@email.com',
      phone: '(11) 91098-7654',
      address: 'Rua Bela Cintra, 600, São Paulo/SP',
      createdAt: '2024-09-14T15:30:00.000Z',
    },
    {
      id: 'cust-10',
      name: 'Diego Felipe Rocha',
      patientCode: 'PAC-010',
      insuranceCardCode: 'CART-012345',
      healthPlanId: 'hp-3',
      doctorId: 'doc-4',
      diseaseCid: 'J45 - Asma',
      email: 'diego.rocha@email.com',
      phone: '(11) 90987-6543',
      address: 'Av. Afonso de Albuquerque, 100, São Paulo/SP',
      createdAt: '2024-10-05T09:45:00.000Z',
    },
  ];

  const sampleHealthPlans = [
    {
      id: 'hp-1',
      name: 'Plano Básico',
      providerName: 'Amil',
      registrationCode: 'REG-001',
    },
    {
      id: 'hp-2',
      name: 'Plano Premium',
      providerName: 'Unimed',
      registrationCode: 'REG-002',
    },
    {
      id: 'hp-3',
      name: 'Plano Empresarial',
      providerName: 'Bradesco Saúde',
      registrationCode: 'REG-003',
    },
  ];

  const sampleDoctors = [
    {
      id: 'doc-1',
      name: 'Dr. Carlos Eduardo Mendes',
      crm: '123456/SP',
      specialty: 'Endocrinologista',
      email: 'carlos.mendes@hospital.com',
      phone: '(11) 3333-4444',
    },
    {
      id: 'doc-2',
      name: 'Dra. Fernanda Ribeiro Almeida',
      crm: '789012/SP',
      specialty: 'Cardiologista',
      email: 'fernanda.almeida@hospital.com',
      phone: '(11) 3333-5555',
    },
    {
      id: 'doc-3',
      name: 'Dr. Roberto Augusto Nunes',
      crm: '345678/SP',
      specialty: 'Neurologista',
      email: 'roberto.nunes@hospital.com',
      phone: '(11) 3333-6666',
    },
    {
      id: 'doc-4',
      name: 'Dr. Marcos Vinícius Silva',
      crm: '456789/SP',
      specialty: 'Cardiologia',
      email: 'marcos.silva@hospital.com',
      phone: '(11) 3333-7777',
    },
    {
      id: 'doc-5',
      name: 'Dra. Patricia Ferreira Costa',
      crm: '567890/SP',
      specialty: 'Dermatologia',
      email: 'patricia.costa@hospital.com',
      phone: '(11) 3333-8888',
    },
    {
      id: 'doc-6',
      name: 'Dr. André Luis Martins',
      crm: '678901/SP',
      specialty: 'Nefrologista',
      email: 'andre.martins@hospital.com',
      phone: '(11) 3333-9999',
    },
    {
      id: 'doc-7',
      name: 'Dra. Juliana Santos Oliveira',
      crm: '789012/SP',
      specialty: 'Psiquiatria',
      email: 'juliana.oliveira@hospital.com',
      phone: '(11) 3333-1010',
    },
    {
      id: 'doc-8',
      name: 'Dr. Rafael Henrique Souza',
      crm: '890123/SP',
      specialty: 'Pneumologia',
      email: 'rafael.souza@hospital.com',
      phone: '(11) 3333-1112',
    },
    {
      id: 'doc-9',
      name: 'Dra. Beatriz Almeida Lima',
      crm: '901234/SP',
      specialty: 'Ginecologia',
      email: 'beatriz.lima@hospital.com',
      phone: '(11) 3333-1213',
    },
    {
      id: 'doc-10',
      name: 'Dr. Thiago Costa Rodrigues',
      crm: '012345/SP',
      specialty: 'Ortopedia',
      email: 'thiago.rodrigues@hospital.com',
      phone: '(11) 3333-1314',
    },
    {
      id: 'doc-11',
      name: 'Dra. Mariana Souza Vieira',
      crm: '123457/SP',
      specialty: 'Oftalmologia',
      email: 'mariana.vieira@hospital.com',
      phone: '(11) 3333-1415',
    },
    {
      id: 'doc-12',
      name: 'Dr. Felipe Martins Ribeiro',
      crm: '234568/SP',
      specialty: 'Urologia',
      email: 'felipe.ribeiro@hospital.com',
      phone: '(11) 3333-1516',
    },
    {
      id: 'doc-13',
      name: 'Dra. Camila Ferreira Alves',
      crm: '345679/SP',
      specialty: 'Pediatria',
      email: 'camila.alves@hospital.com',
      phone: '(11) 3333-1617',
    },
    {
      id: 'doc-14',
      name: 'Dr. Rodrigo Oliveira Santos',
      crm: '456780/SP',
      specialty: 'Gastroenterologia',
      email: 'rodrigo.santos@hospital.com',
      phone: '(11) 3333-1718',
    },
    {
      id: 'doc-15',
      name: 'Dra. Amanda Costa Pereira',
      crm: '567891/SP',
      specialty: 'Obstetricia',
      email: 'amanda.pereira@hospital.com',
      phone: '(11) 3333-1819',
    },
    {
      id: 'doc-16',
      name: 'Dr. Leonardo Silva Nunes',
      crm: '678902/SP',
      specialty: 'Hematologia',
      email: 'leonardo.nunes@hospital.com',
      phone: '(11) 3333-1920',
    },
    {
      id: 'doc-17',
      name: 'Dra. Priscila Mendes Costa',
      crm: '789013/SP',
      specialty: 'Alergologia',
      email: 'priscila.costa@hospital.com',
      phone: '(11) 3333-2021',
    },
    {
      id: 'doc-18',
      name: 'Dr. Eduardo Barbosa Lima',
      crm: '890124/SP',
      specialty: 'Reumatologia',
      email: 'eduardo.lima@hospital.com',
      phone: '(11) 3333-2122',
    },
    {
      id: 'doc-19',
      name: 'Dra. Renata Vieira Ferreira',
      crm: '901235/SP',
      specialty: 'Oncologia',
      email: 'renata.ferreira@hospital.com',
      phone: '(11) 3333-2223',
    },
    {
      id: 'doc-20',
      name: 'Dr. Gabriel Almeida Rocha',
      crm: '012346/SP',
      specialty: 'Otorrinolaringologia',
      email: 'gabriel.rocha@hospital.com',
      phone: '(11) 3333-2324',
    },
  ];

  sampleCustomers.forEach((customer) => customers.push(customer));
  sampleHealthPlans.forEach((plan) => healthPlans.push(plan));
  sampleDoctors.forEach((doctor) => doctors.push(doctor));

  // Persist the state
  persistState();

  console.log('Temporary database initialized with sample data successfully!');
  console.log(`- ${sampleData.medicines.length} medicines`);
  console.log(`- ${sampleCustomers.length} customers`);
  console.log(`- ${sampleData.orders.length} orders`);
  console.log(`- ${sampleData.deliveries.length} deliveries`);
  console.log(`- ${sampleData.users.length} users`);
  console.log(`- ${sampleHealthPlans.length} health plans`);
  console.log(`- ${sampleDoctors.length} doctors`);
  console.log(`- ${sampleData.tickets.length} tickets`);
  console.log(`- ${sampleData.inventoryLots.length} inventory lots`);
  console.log(`- ${sampleData.inventoryMovements.length} inventory movements`);
}
