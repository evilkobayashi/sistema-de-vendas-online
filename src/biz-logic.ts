import { deliveries, inventoryLots, inventoryMovements, medicines, type InventoryLot, type Order } from './data.js';
import { cache } from './utils/cache.js';

export function addDays(startIso: string, days: number) {
  const dt = new Date(startIso);
  dt.setDate(dt.getDate() + days);
  return dt.toISOString().slice(0, 10);
}

function getDaysUntil(dateIso: string) {
  return Math.ceil((new Date(dateIso).getTime() - Date.now()) / (24 * 3600 * 1000));
}

function isSameMonthCompetence(a: string, b: string) {
  const da = new Date(a);
  const db = new Date(b);
  return da.getUTCFullYear() === db.getUTCFullYear() && da.getUTCMonth() === db.getUTCMonth();
}

function firstDayNextMonth(dateIso: string) {
  const dt = new Date(dateIso);
  dt.setUTCMonth(dt.getUTCMonth() + 1, 1);
  dt.setUTCHours(0, 0, 0, 0);
  return dt.toISOString().slice(0, 10);
}

function normalizeText(value: string) {
  // Sanitizar entrada para evitar injeção
  if (typeof value !== 'string') {
    return '';
  }

  // Limitar comprimento para evitar ataques de buffer overflow
  const limitedValue = value.substring(0, 1000);

  return limitedValue
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function computePatientEligibility(patientId: string) {
  const lastDeliveredForPatient = deliveries
    .filter((d) => d.patientId === patientId && d.status === 'entregue')
    .map((d) => d.forecastDate)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());

  const lastDeliveryDate = lastDeliveredForPatient[0];

  if (!lastDeliveryDate) {
    return {
      lastDeliveryDate: undefined,
      canOrderThisMonth: true,
      nextEligibleDate: new Date().toISOString().slice(0, 10),
    };
  }

  const today = new Date().toISOString().slice(0, 10);
  const sameMonth = isSameMonthCompetence(lastDeliveryDate, today);

  return {
    lastDeliveryDate,
    canOrderThisMonth: !sameMonth,
    nextEligibleDate: sameMonth ? firstDayNextMonth(lastDeliveryDate) : today,
  };
}

export function calculateRunOutDate(
  quantity: number,
  tabletsPerDay?: number,
  tabletsPerPackage?: number,
  treatmentDays?: number
) {
  if (treatmentDays && treatmentDays > 0) return addDays(new Date().toISOString(), treatmentDays);
  if (!tabletsPerDay || tabletsPerDay <= 0) return undefined;
  const unitsPerPackage = tabletsPerPackage ?? 30;
  const totalTablets = quantity * unitsPerPackage;
  const durationInDays = Math.max(1, Math.ceil(totalTablets / tabletsPerDay));
  return addDays(new Date().toISOString(), durationInDays);
}

export function parsePrescriptionToSuggestions(rawText: string) {
  const text = normalizeText(rawText);
  const suggestions = medicines
    .map((medicine) => {
      const name = normalizeText(medicine.name);
      const lab = normalizeText(medicine.lab);
      const tokens = [...new Set(name.split(' ').filter((t) => t.length >= 4))];
      let score = 0;

      if (text.includes(name)) score += 5;
      if (text.includes(lab)) score += 1;
      for (const token of tokens) {
        if (text.includes(token)) score += 1;
      }

      return {
        medicineId: medicine.id,
        name: medicine.name,
        controlled: medicine.controlled,
        confidence: Math.min(0.99, score / 10),
        reason: score > 0 ? `Termos compatíveis encontrados (${score})` : '',
      };
    })
    .filter((item) => item.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);

  return { suggestions, found: suggestions.length > 0 };
}

export function buildRecurringReminders(allOrders: Order[]) {
  return allOrders
    .filter((o) => {
      if (!o.recurring?.needsConfirmation) return false;
      const diffDays = getDaysUntil(o.recurring.nextBillingDate);
      return diffDays >= 0 && diffDays <= 3;
    })
    .map((o) => ({
      orderId: o.id,
      patientName: o.patientName,
      nextBillingDate: o.recurring?.nextBillingDate,
      estimatedTreatmentEndDate: o.estimatedTreatmentEndDate,
      message: 'Confirmar junto ao cliente a recorrência da compra',
    }));
}

// Mutex para proteger contra condições de corrida na reserva de estoque
const reservationMutexes = new Map<string, boolean>();

function acquireReservationLock(medicineId: string): boolean {
  if (reservationMutexes.has(medicineId)) {
    return false; // Já está sendo acessado por outra requisição
  }
  reservationMutexes.set(medicineId, true);
  return true;
}

function releaseReservationLock(medicineId: string): void {
  reservationMutexes.delete(medicineId);
}

export function reserveStockFefo(medicineId: string, quantity: number, orderId: string, userId: string) {
  // Proteger contra condições de corrida usando mutex
  if (!acquireReservationLock(medicineId)) {
    throw new Error('Operação de reserva já em andamento para este medicamento. Tente novamente.');
  }

  try {
    const lots = inventoryLots
      .filter((lot) => lot.medicineId === medicineId && lot.quantity - lot.reserved > 0)
      .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt));

    let missing = quantity;
    const changes: Array<{ lot: InventoryLot; delta: number }> = [];

    for (const lot of lots) {
      if (missing <= 0) break;
      const free = lot.quantity - lot.reserved;
      const used = Math.min(free, missing);
      if (used > 0) {
        changes.push({ lot, delta: used });
        missing -= used;
      }
    }

    if (missing > 0) {
      throw new Error(`Estoque insuficiente para ${medicineId}. Faltam ${missing} unidade(s).`);
    }

    for (const change of changes) {
      change.lot.reserved += change.delta;
      inventoryMovements.unshift({
        id: crypto.randomUUID(),
        medicineId,
        lotId: change.lot.id,
        type: 'reserva' as const,
        quantity: change.delta,
        reason: 'Reserva automática por criação de pedido',
        relatedOrderId: orderId,
        createdBy: userId,
        createdAt: new Date().toISOString(),
      });
    }

    return { lotsUpdated: changes.length, totalReserved: quantity };
  } finally {
    // Liberar o mutex sempre
    releaseReservationLock(medicineId);
  }
}

export function buildInventorySummary() {
  const cacheKey = 'inventory-summary';
  const cached = cache.get(cacheKey);

  if (cached) {
    return cached;
  }

  const now = Date.now();
  const items = medicines.map((medicine) => {
    const lots = inventoryLots.filter((lot) => lot.medicineId === medicine.id);
    const stockTotal = lots.reduce((acc, lot) => acc + lot.quantity, 0);
    const stockAvailable = lots.reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
    const expiresIn30Days = lots.filter((lot) => {
      const diff = Math.ceil((new Date(lot.expiresAt).getTime() - now) / 86400000);
      return diff >= 0 && diff <= 30;
    }).length;
    return {
      medicineId: medicine.id,
      medicineName: medicine.name,
      stockTotal,
      stockAvailable,
      lotCount: lots.length,
      expiresIn30Days,
    };
  });

  const result = {
    items,
    critical: items.filter((item) => item.stockAvailable <= 10).length,
    nearExpiry: items.reduce((acc, item) => acc + item.expiresIn30Days, 0),
  };

  // Armazenar no cache por 2 minutos (120 segundos)
  cache.set(cacheKey, result, 120000);

  return result;
}

export function availableQuantityByMedicine(medicineId: string) {
  return inventoryLots
    .filter((lot) => lot.medicineId === medicineId)
    .reduce((acc, lot) => acc + Math.max(0, lot.quantity - lot.reserved), 0);
}

// NOTE: This function performs basic text extraction from documents.
// For PDFs, it only extracts embedded text streams (searchable PDFs).
// For images, it only extracts text from metadata (OCR requires external service).
// TODO: Integrate PDF.js (pdf-parse) and Tesseract OCR for real extraction.
export function extractTextFromDocument(contentBase64: string, mimeType: string) {
  // Sanitizar o conteúdo base64 para evitar injeção
  if (!contentBase64 || typeof contentBase64 !== 'string' || !/^[A-Za-z0-9+/]*={0,2}$/.test(contentBase64)) {
    throw new Error('Formato Base64 inválido');
  }

  // Limitar tamanho máximo para evitar ataques de buffer overflow
  if (contentBase64.length > 10 * 1024 * 1024) {
    // 10MB
    throw new Error('Documento muito grande para processamento');
  }

  // Validação adicional de MIME type para evitar processamento de tipos maliciosos
  const validMimeTypes = [
    'application/pdf',
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'text/plain',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ];

  // Sanitizar o mimeType para evitar injeção de código
  const sanitizedMimeType = mimeType.replace(/[^a-zA-Z0-9./\-+]/g, '');

  // Verificar se o tipo de mídia é seguro para processamento
  const isAllowedMimeType = validMimeTypes.some((validType) =>
    sanitizedMimeType.toLowerCase().includes(validType.toLowerCase())
  );

  if (!isAllowedMimeType) {
    throw new Error('Tipo de documento não suportado para processamento');
  }

  const raw = Buffer.from(contentBase64, 'base64');
  const utf = raw.toString('utf8');
  const isUtfReadable = utf.replace(/[\x00-\x07\x0E-\x1F\x7F]/g, '').length / utf.length > 0.8;
  const decoded = isUtfReadable ? utf : raw.toString('latin1');

  // Sanitizar o texto extraído para evitar XSS
  const extracted = decoded
    .replace(/[^\w\sÀ-ÿ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .substring(0, 10000); // Limitar comprimento para evitar ataques

  const isPdf = sanitizedMimeType.includes('pdf');

  if (isPdf) {
    const hasMeaningfulText = extracted.split(' ').filter((w) => w.length > 3).length > 3;
    return {
      extractedText: extracted,
      extractionMethod: 'pdf-text-scan',
      warning: hasMeaningfulText
        ? undefined
        : 'PDF não contém texto pesquisável. Use um PDF gerado por OCR ou informe o texto manualmente. Consulte https://github.com/mozilla/pdf.js para extração de texto real.',
    };
  }
  if (sanitizedMimeType.startsWith('image/')) {
    return {
      extractedText: extracted,
      extractionMethod: 'image-metadata-scan',
      warning:
        'Extração de texto de imagens requer OCR (Tesseract). O texto atual vem apenas de metadados incorporados. Se vazio, informe o texto da receita manualmente.',
    };
  }
  return { extractedText: extracted, extractionMethod: 'generic-binary-scan' };
}
