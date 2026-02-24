export type ShippingQuoteInput = {
  destinationZip?: string;
  weightKg: number;
  declaredValue: number;
};

export type ShippingResult = {
  provider: string;
  price: number;
  etaDays: number;
  trackingCode: string;
  fallbackUsed: boolean;
  syncStatus: 'ok' | 'fallback' | 'queued_retry';
};

function envFailMode() {
  return (process.env.SHIPPING_FORCE_FAIL || '').toLowerCase();
}

function shouldFail(provider: 'primary' | 'secondary') {
  const mode = envFailMode();
  if (mode === 'all') return true;
  if (mode === 'primary' && provider === 'primary') return true;
  if (mode === 'secondary' && provider === 'secondary') return true;
  return false;
}

function quoteBase(weightKg: number, declaredValue: number, factor: number) {
  return Number((9.9 + weightKg * factor + declaredValue * 0.01).toFixed(2));
}

function primaryProvider(input: ShippingQuoteInput, orderId: string): ShippingResult {
  if (shouldFail('primary')) throw new Error('Falha no provedor primário');
  return {
    provider: 'FastShip',
    price: quoteBase(input.weightKg, input.declaredValue, 3.2),
    etaDays: 2,
    trackingCode: `FS-${orderId}-${Date.now().toString().slice(-6)}`,
    fallbackUsed: false,
    syncStatus: 'ok'
  };
}

function secondaryProvider(input: ShippingQuoteInput, orderId: string): ShippingResult {
  if (shouldFail('secondary')) throw new Error('Falha no provedor secundário');
  return {
    provider: 'EcoEntrega',
    price: quoteBase(input.weightKg, input.declaredValue, 2.8),
    etaDays: 3,
    trackingCode: `EE-${orderId}-${Date.now().toString().slice(-6)}`,
    fallbackUsed: true,
    syncStatus: 'fallback'
  };
}

function internalFallback(input: ShippingQuoteInput, orderId: string): ShippingResult {
  return {
    provider: 'Transportadora Interna',
    price: quoteBase(input.weightKg, input.declaredValue, 2.4),
    etaDays: 4,
    trackingCode: `INT-${orderId}-${Date.now().toString().slice(-6)}`,
    fallbackUsed: true,
    syncStatus: 'queued_retry'
  };
}

export function createShipmentWithFallback(input: ShippingQuoteInput & { orderId: string }) {
  try {
    return primaryProvider(input, input.orderId);
  } catch {
    try {
      return secondaryProvider(input, input.orderId);
    } catch {
      return internalFallback(input, input.orderId);
    }
  }
}

export function quoteWithFallback(input: ShippingQuoteInput) {
  return createShipmentWithFallback({ ...input, orderId: 'QUOTE' });
}
