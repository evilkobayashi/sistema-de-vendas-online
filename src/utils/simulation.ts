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
];

const simulatedMedicines = [
  { name: 'Rivotril 2mg', controlled: true },
  { name: 'OncoRelief 20mg', controlled: true },
  { name: 'CardioPlus 10mg', controlled: false },
  { name: 'NeuroSafe 5mg', controlled: true },
  { name: 'ImunoCare 50mg', controlled: false },
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

const deliveryStatuses: Array<'pendente' | 'em_rota' | 'entregue'> = ['pendente', 'em_rota', 'entregue'];

function generateRandomAction(): SimulatedAction {
  const actionTypes = ['order', 'ticket', 'delivery', 'customer'] as const;
  const weights = [40, 30, 20, 10];

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;
  let selectedType: (typeof actionTypes)[number] = 'order';

  for (let i = 0; i < weights.length; i++) {
    random -= weights[i];
    if (random <= 0) {
      selectedType = actionTypes[i];
      break;
    }
  }

  const users = ['Olivia Operadora', 'Maria Atendimento', 'João Operador'];
  const user = users[Math.floor(Math.random() * users.length)];

  switch (selectedType) {
    case 'order': {
      const customer = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
      const med = simulatedMedicines[Math.floor(Math.random() * simulatedMedicines.length)];
      return {
        id: `sim-order-${Date.now()}`,
        type: 'order',
        description: `Criou pedido para ${customer} - ${med.name}${med.controlled ? ' (controlado)' : ''}`,
        timestamp: new Date().toISOString(),
        user,
      };
    }
    case 'ticket': {
      const customer = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
      const subject = ticketSubjects[Math.floor(Math.random() * ticketSubjects.length)];
      return {
        id: `sim-ticket-${Date.now()}`,
        type: 'ticket',
        description: `${customer}: ${subject}`,
        timestamp: new Date().toISOString(),
        user,
      };
    }
    case 'delivery': {
      const customer = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
      const status = deliveryStatuses[Math.floor(Math.random() * deliveryStatuses.length)];
      return {
        id: `sim-delivery-${Date.now()}`,
        type: 'delivery',
        description: `Atualizou entrega para ${customer} - Status: ${status}`,
        timestamp: new Date().toISOString(),
        user,
      };
    }
    case 'customer': {
      const customer = simulatedCustomerNames[Math.floor(Math.random() * simulatedCustomerNames.length)];
      return {
        id: `sim-customer-${Date.now()}`,
        type: 'customer',
        description: `Cadastrou novo cliente: ${customer}`,
        timestamp: new Date().toISOString(),
        user,
      };
    }
  }
}

function performSimulatedAction(action: SimulatedAction): void {
  switch (action.type) {
    case 'order':
      simulationState.stats.ordersCreated++;
      break;
    case 'ticket':
      simulationState.stats.ticketsCreated++;
      break;
    case 'delivery':
      simulationState.stats.deliveriesUpdated++;
      break;
    case 'customer':
      simulationState.stats.customersCreated++;
      break;
  }
}

export function startSimulation() {
  if (simulationInterval) return;

  simulationState.enabled = true;
  simulationState.startTime = new Date().toISOString();

  const intervalMs = (60 * 1000) / simulationState.actionsPerMinute / simulationState.speed;

  simulationInterval = setInterval(() => {
    const action = generateRandomAction();
    simulationState.actions.unshift(action);
    simulationState.actions = simulationState.actions.slice(0, 100);
    performSimulatedAction(action);
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
