import { orders, tickets, deliveries, customers, medicines } from '../data.js';

type SimulatedAction = {
  id: string;
  type: 'order' | 'ticket' | 'delivery' | 'inventory' | 'customer';
  description: string;
  timestamp: string;
  user: string;
};

type SimulationState = {
  enabled: boolean;
  speed: number;
  actionsPerMinute: number;
  startTime: string;
  actions: SimulatedAction[];
  stats: {
    ordersCreated: number;
    ticketsCreated: number;
    deliveriesUpdated: number;
    customersCreated: number;
  };
};

let simulationState: SimulationState = {
  enabled: false,
  speed: 1,
  actionsPerMinute: 3,
  startTime: '',
  actions: [],
  stats: {
    ordersCreated: 0,
    ticketsCreated: 0,
    deliveriesUpdated: 0,
    customersCreated: 0,
  },
};

let simulationInterval: ReturnType<typeof setInterval> | null = null;

const simulatedCustomerNames = [
  'Maria Silva',
  'João Santos',
  'Ana Costa',
  'Pedro Oliveira',
  'Carla Rodrigues',
  'Lucas Ferreira',
  'Juliana Almeida',
  'Roberto Lima',
  'Fernanda Souza',
  'Marcos Pereira',
  'Amanda Costa',
  'Bruno Oliveira',
  'Camila Santos',
  'Daniel Rodrigues',
  'Eduarda Almeida',
];

const addresses = [
  'Rua das Flores, 123 - São Paulo/SP',
  'Av. Brasil, 456 - Rio de Janeiro/RJ',
  'Rua do Sol, 789 - Belo Horizonte/MG',
  'Av. Paulista, 1000 - São Paulo/SP',
  'Rua Augusta, 200 - São Paulo/SP',
];

const ticketSubjects = [
  'Dúvida sobre dosagem de medicamento',
  'Solicitação de segunda via de receita',
  'Medicamento não chegou no prazo',
  'Troca de endereço de entrega',
  'Informações sobre preço de medicamento',
  'Solicitação de nota fiscal',
  'Problema com plano de saúde',
  'Dúvida sobre interação medicamentosa',
];

function generateRandomCPF(): string {
  const n = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));
  const d = (n: number[]) => {
    let d1 = 0;
    for (let i = 0; i < 9; i++) d1 += n[i] * (10 - i);
    d1 = (d1 * 10) % 11;
    return d1 > 9 ? 0 : d1;
  };
  const n1 = [...n, d(n)];
  const n2 = [...n1, d(n1)];
  return n2.join('').replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function generateRandomPhone(): string {
  const ddd = ['11', '21', '31', '41', '51', '61', '71', '81', '91'];
  const number = Array.from({ length: 9 }, () => Math.floor(Math.random() * 10)).join('');
  return `(${ddd[Math.floor(Math.random() * ddd.length)]}) 9${number.substring(0, 4)}-${number.substring(4)}`;
}

function createSimulatedOrder(): SimulatedAction {
  const customerName = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
  const email = `${customerName.toLowerCase().replace(' ', '.')}@email.com`;
  const phone = generateRandomPhone();
  const address = addresses[Math.floor(Math.random() * addresses.length)];

  const availableMedicines =
    medicines.length > 0
      ? medicines
      : [
          { id: 'm1', name: 'Rivotril 2mg', price: 89.9, controlled: true },
          { id: 'm2', name: 'CardioPlus 10mg', price: 120.0, controlled: false },
          { id: 'm3', name: 'NeuroSafe 5mg', price: 145.0, controlled: true },
        ];

  const med = availableMedicines[Math.floor(Math.random() * availableMedicines.length)];
  const quantity = Math.floor(Math.random() * 3) + 1;

  const orderId = `SIM-${Date.now().toString(36).toUpperCase()}`;

  const newOrder = {
    id: orderId,
    patientName: customerName,
    email,
    phone,
    address,
    items: [
      {
        medicineId: med.id,
        medicineName: med.name,
        quantity,
        unitPrice: med.price,
        subtotal: med.price * quantity,
      },
    ],
    total: med.price * quantity,
    controlledValidated: !med.controlled || Math.random() > 0.3,
    createdBy: 'Simulador',
    createdAt: new Date().toISOString(),
  };

  orders.push(newOrder as any);

  if (simulationState.actions.length > 50) {
    simulationState.actions.pop();
  }

  return {
    id: `sim-order-${Date.now()}`,
    type: 'order',
    description: `Criou pedido ${orderId} para ${customerName} - ${med.name} x${quantity}`,
    timestamp: new Date().toISOString(),
    user: 'Olivia Operadora',
  };
}

function createSimulatedTicket(): SimulatedAction {
  const customerName = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
  const subject = ticketSubjects[Math.floor(Math.random() * ticketSubjects.length)];

  const ticketId = `TKT-${Date.now().toString(36).toUpperCase()}`;
  const priorities = ['baixa', 'media', 'alta'] as const;
  const priority = priorities[Math.floor(Math.random() * priorities.length)];

  const newTicket = {
    id: ticketId,
    subject,
    status: 'aberto' as const,
    priority,
    assignedTo: 'u3',
    customerName,
    customerEmail: `${customerName.toLowerCase().replace(' ', '.')}@email.com`,
    customerPhone: generateRandomPhone(),
    description: `${customerName} entrou em contato sobre: ${subject}`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    history: [],
  };

  tickets.push(newTicket as any);

  if (simulationState.actions.length > 50) {
    simulationState.actions.pop();
  }

  return {
    id: `sim-ticket-${Date.now()}`,
    type: 'ticket',
    description: `${customerName}: ${subject}`,
    timestamp: new Date().toISOString(),
    user: 'Maria Atendimento',
  };
}

function createSimulatedDelivery(): SimulatedAction {
  const customerName = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
  const statuses = ['pendente', 'em_rota', 'entregue'] as const;
  const status = statuses[Math.floor(Math.random() * statuses.length)];

  const deliveryId = `ENT-${Date.now().toString(36).toUpperCase()}`;

  const newDelivery = {
    id: deliveryId,
    orderId: `SIM-${Math.random().toString(36).substring(2, 8)}`,
    patientName: customerName,
    address: addresses[Math.floor(Math.random() * addresses.length)],
    status: status as any,
    trackingCode: `TRK${Date.now().toString().slice(-10)}`,
    carrier: ['Correios', 'Jadlog', 'Total Express'][Math.floor(Math.random() * 3)],
    estimatedDelivery: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  deliveries.push(newDelivery as any);

  if (simulationState.actions.length > 50) {
    simulationState.actions.pop();
  }

  return {
    id: `sim-delivery-${Date.now()}`,
    type: 'delivery',
    description: `Nova entrega ${deliveryId} para ${customerName}`,
    timestamp: new Date().toISOString(),
    user: 'João Operador',
  };
}

function createSimulatedCustomer(): SimulatedAction {
  const customerName = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];

  const customerId = `CUST-${Date.now().toString(36).toUpperCase()}`;

  const newCustomer = {
    id: customerId,
    name: customerName,
    cpf: generateRandomCPF(),
    email: `${customerName.toLowerCase().replace(' ', '.')}@email.com`,
    phone: generateRandomPhone(),
    address: addresses[Math.floor(Math.random() * addresses.length)],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  customers.push(newCustomer as any);

  if (simulationState.actions.length > 50) {
    simulationState.actions.pop();
  }

  return {
    id: `sim-customer-${Date.now()}`,
    type: 'customer',
    description: `Novo cliente: ${customerName} (CPF: ${newCustomer.cpf})`,
    timestamp: new Date().toISOString(),
    user: 'Olivia Operadora',
  };
}

function performSimulatedAction(): void {
  const actionTypes = ['order', 'ticket', 'delivery', 'customer'] as const;
  const weights = [40, 30, 20, 10];
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let selectedType: 'order' | 'ticket' | 'delivery' | 'customer' = 'order';

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      selectedType = actionTypes[i];
      break;
    }
  }

  let action: SimulatedAction | null = null;

  switch (selectedType) {
    case 'order':
      action = createSimulatedOrder();
      simulationState.stats.ordersCreated++;
      break;
    case 'ticket':
      action = createSimulatedTicket();
      simulationState.stats.ticketsCreated++;
      break;
    case 'delivery':
      action = createSimulatedDelivery();
      simulationState.stats.deliveriesUpdated++;
      break;
    case 'customer':
      action = createSimulatedCustomer();
      simulationState.stats.customersCreated++;
      break;
  }

  if (action) {
    simulationState.actions.unshift(action);
  }
}

export function startSimulation() {
  if (simulationInterval) return;

  simulationState.enabled = true;
  simulationState.startTime = new Date().toISOString();

  const intervalMs = (60 * 1000) / simulationState.actionsPerMinute / simulationState.speed;

  simulationInterval = setInterval(() => {
    performSimulatedAction();
  }, intervalMs);
}

export function stopSimulation() {
  if (simulationInterval) {
    clearInterval(simulationInterval);
    simulationInterval = null;
  }
  simulationState.enabled = false;
}

export function getSimulationState(): SimulationState {
  return { ...simulationState };
}

export function updateSimulationSpeed(speed: number) {
  simulationState.speed = speed;
  if (simulationState.enabled) {
    stopSimulation();
    startSimulation();
  }
}

export function updateSimulationRate(actionsPerMinute: number) {
  simulationState.actionsPerMinute = actionsPerMinute;
  if (simulationState.enabled) {
    stopSimulation();
    startSimulation();
  }
}

export function clearSimulationHistory() {
  simulationState.actions = [];
  simulationState.stats = {
    ordersCreated: 0,
    ticketsCreated: 0,
    deliveriesUpdated: 0,
    customersCreated: 0,
  };
}

export function resetSimulationData() {
  const toRemove = [
    { array: orders, prefix: 'SIM-' },
    { array: tickets, prefix: 'TKT-' },
    { array: deliveries, prefix: 'ENT-' },
    { array: customers, prefix: 'CUST-' },
  ];

  for (const item of toRemove) {
    const idx = item.array.findIndex((e: any) => e.id?.startsWith(item.prefix));
    if (idx !== -1) {
      item.array.splice(idx, 1);
    }
  }
}
