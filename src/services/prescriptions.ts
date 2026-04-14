import { medicines } from '../data.js';

function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
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
      for (const token of tokens) { if (text.includes(token)) score += 1; }
      return {
        medicineId: medicine.id, name: medicine.name, controlled: medicine.controlled,
        confidence: Math.min(0.99, score / 10),
        reason: score > 0 ? `Termos compatíveis encontrados (${score})` : ''
      };
    })
    .filter((item) => item.confidence > 0)
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 5);
  return { suggestions, found: suggestions.length > 0 };
}

export function extractTextFromDocument(contentBase64: string, mimeType: string) {
  const raw = Buffer.from(contentBase64, 'base64');
  const utf = raw.toString('utf8');
  const latin = raw.toString('latin1');
  const decoded = `${utf}\n${latin}`;
  const extracted = decoded.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
  const isPdf = mimeType.includes('pdf');
  const isImage = mimeType.startsWith('image/');

  if (isPdf) {
    return { extractedText: extracted, extractionMethod: 'pdf-text-scan', warning: extracted.length < 20 ? 'PDF sem texto legível. Use PDF pesquisável ou informe texto manualmente.' : undefined };
  }
  if (isImage) {
    return { extractedText: extracted, extractionMethod: 'image-metadata-scan', warning: 'Leitura de imagem depende de texto incorporado/metadados. Se não houver sugestão, cole o texto da receita.' };
  }
  return { extractedText: extracted, extractionMethod: 'generic-binary-scan' };
}
