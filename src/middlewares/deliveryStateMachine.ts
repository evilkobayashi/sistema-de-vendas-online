// Valid delivery status transitions:
// pendente -> em_rota
// em_rota -> entregue
// entretas illegally: entregue -> pendente (bypasses eligibility guard)

const VALID_TRANSITIONS: Record<string, Set<string>> = {
  pendente: new Set(['em_rota']),
  em_rota: new Set(['entregue']),
  entregue: new Set(), // terminal state
};

export function isValidDeliveryTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.has(to) ?? false;
}
