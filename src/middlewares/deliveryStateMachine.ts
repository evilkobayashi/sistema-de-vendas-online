// Valid delivery status transitions:
// pendente  -> em_rota
// em_rota   -> entregue
// entregue  -> (terminal — no further transitions allowed)
//
// All reverse or arbitrary jumps are explicitly rejected with descriptive messages
// to prevent data integrity issues (e.g., re-opening a delivered order would bypass
// the monthly eligibility guard and corrupt stock reservations).

export type DeliveryStatusValue = 'pendente' | 'em_rota' | 'entregue';

interface TransitionRule {
  allowed: Set<DeliveryStatusValue>;
  description: string;
}

const TRANSITION_RULES: Record<DeliveryStatusValue, TransitionRule> = {
  pendente: {
    allowed: new Set<DeliveryStatusValue>(['em_rota']),
    description: 'Aguardando despacho — pode avançar para "em_rota"'
  },
  em_rota: {
    allowed: new Set<DeliveryStatusValue>(['entregue']),
    description: 'Em trânsito — pode avançar para "entregue"'
  },
  entregue: {
    allowed: new Set<DeliveryStatusValue>(),
    description: 'Estado terminal — entrega já concluída, nenhuma transição é permitida'
  }
};

const TRANSITION_ERROR_MESSAGES: Partial<Record<DeliveryStatusValue, Partial<Record<DeliveryStatusValue, string>>>> = {
  entregue: {
    pendente: 'Transição inválida: "entregue" → "pendente". Uma entrega concluída não pode ser reaberta — isso violaria o controle de competência mensal do paciente.',
    em_rota: 'Transição inválida: "entregue" → "em_rota". Uma entrega já concluída não pode retornar ao estado de trânsito.'
  },
  em_rota: {
    pendente: 'Transição inválida: "em_rota" → "pendente". O pedido já foi despachado e não pode ser revertido para pendente.'
  }
};

export function isValidDeliveryTransition(from: DeliveryStatusValue, to: DeliveryStatusValue): boolean {
  return TRANSITION_RULES[from]?.allowed.has(to) ?? false;
}

export function getDeliveryTransitionError(from: DeliveryStatusValue, to: DeliveryStatusValue): string {
  const specific = TRANSITION_ERROR_MESSAGES[from]?.[to];
  if (specific) return specific;

  const rule = TRANSITION_RULES[from];
  if (!rule) return `Status de origem desconhecido: "${from}".`;

  const validTargets = [...rule.allowed];
  if (validTargets.length === 0) {
    return `Transição inválida: "${from}" → "${to}". ${rule.description}.`;
  }
  return `Transição inválida: "${from}" → "${to}". ${rule.description}. Transições permitidas: ${validTargets.map(s => `"${s}"`).join(', ')}.`;
}
