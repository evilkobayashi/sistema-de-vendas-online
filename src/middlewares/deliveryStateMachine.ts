// Valid delivery status transitions:
// pendente -> em_rota
// pendente -> falhou
// em_rota -> entregue
// em_rota -> falhou
// falhou -> em_rota (retry)
// entregue: terminal state

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  pendente: new Set(['em_rota', 'falhou']),
  em_rota: new Set(['entregue', 'falhou']),
  falhou: new Set(['em_rota']),
  entregue: new Set(), // terminal state
};

export function isValidDeliveryTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
