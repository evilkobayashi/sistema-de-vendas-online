/**
 * Funções de segurança para proteger contra diferentes tipos de ataques
 */

/**
 * Sanitiza entrada de texto para evitar injeção de código
 */
export function sanitizeInput(input: string | undefined | null): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Limitar comprimento para evitar ataques de buffer overflow
  const limitedInput = input.substring(0, 1000);

  // Remover caracteres potencialmente perigosos
  return limitedInput
    .replace(/[<>]/g, '') // Prevenir XSS
    .replace(/javascript:/gi, '') // Prevenir injeção de JS
    .replace(/vbscript:/gi, '') // Prevenir injeção de VBScript
    .replace(/on\w+=/gi, '') // Prevenir eventos HTML
    .trim();
}

/**
 * Valida e limita o tamanho de uma string
 */
export function validateAndLimit(input: string | undefined | null, maxLength: number = 100, fieldName: string = 'Campo'): string | null {
  if (!input) {
    return null;
  }

  if (typeof input !== 'string') {
    throw new Error(`${fieldName} deve ser uma string`);
  }

  if (input.length > maxLength) {
    throw new Error(`${fieldName} excede o tamanho máximo permitido de ${maxLength} caracteres`);
  }

  return sanitizeInput(input);
}

/**
 * Verifica se um valor parece ser um ID válido (UUID ou número)
 */
export function isValidId(id: string | undefined): boolean {
  if (!id) return false;

  // UUID v4 pattern
  const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  // Ou número simples
  const numericPattern = /^\d+$/;

  return uuidPattern.test(id) || numericPattern.test(id);
}

/**
 * Função para prevenir ataques de enumeração de usuário durante login
 * Executa uma operação de hash mesmo quando o usuário não existe
 */
export async function preventUserEnumeration(username: string, password: string, userExists: boolean, getUserPasswordHash: () => Promise<string>): Promise<boolean> {
  if (userExists) {
    // Se o usuário existe, obtemos a senha armazenada e comparamos
    const storedPasswordHash = await getUserPasswordHash();
    const bcrypt = await import('bcrypt');
    return bcrypt.default.compare(password, storedPasswordHash);
  } else {
    // Se o usuário não existe, fazemos uma comparação fake para manter o tempo de resposta consistente
    const bcrypt = await import('bcrypt');
    await bcrypt.default.compare(password, '$2b$10$invalid'); // Hash inválido para comparação fake
    return false;
  }
}

/**
 * Sanitiza parâmetros de consulta para proteger contra ataques de enumeração ou injeção
 */
export function sanitizeQueryParams(params: Record<string, any>): Record<string, string> {
  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(params)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (typeof value === 'number') {
      sanitized[key] = value.toString();
    }
    // Ignorar outros tipos para evitar injeção
  }

  return sanitized;
}

/**
 * Função para validar e limitar paginação, evitando ataques de paginação excessiva
 */
export function validatePagination(page: number, pageSize: number, maxPageSize: number = 100): { page: number; pageSize: number } {
  // Validação de limites
  const validatedPage = Math.max(1, Math.min(page, 10000)); // Limite máximo de 10000 páginas
  const validatedPageSize = Math.max(1, Math.min(pageSize, maxPageSize)); // Limite máximo configurável

  return { page: validatedPage, pageSize: validatedPageSize };
}

/**
 * Função para criar um mapa seguro com limite de tamanho para prevenir DoS
 */
export class SafeMap<K, V> {
  private map = new Map<K, V>();
  private readonly maxSize: number;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  set(key: K, value: V): this {
    if (this.map.size >= this.maxSize && !this.map.has(key)) {
      // Remover o primeiro elemento se atingir o limite e a chave ainda não existir
      const firstKey = this.map.keys().next().value;
      if (firstKey !== undefined) {
        this.map.delete(firstKey);
      }
    }
    this.map.set(key, value);
    return this;
  }

  get(key: K): V | undefined {
    return this.map.get(key);
  }

  has(key: K): boolean {
    return this.map.has(key);
  }

  delete(key: K): boolean {
    return this.map.delete(key);
  }

  size(): number {
    return this.map.size;
  }

  clear(): void {
    this.map.clear();
  }

  forEach(callbackfn: (value: V, key: K, map: Map<K, V>) => void): void {
    this.map.forEach(callbackfn);
  }

  keys(): IterableIterator<K> {
    return this.map.keys();
  }

  values(): IterableIterator<V> {
    return this.map.values();
  }

  entries(): IterableIterator<[K, V]> {
    return this.map.entries();
  }
}

/**
 * Função para proteger contra ataques de força bruta em endpoints específicos
 */
export class RateLimiter {
  private attempts = new Map<string, { count: number; resetAt: number }>();
  private readonly maxAttempts: number;
  private readonly windowMs: number;

  constructor(maxAttempts: number = 10, windowMs: number = 60000) { // 1 minuto padrão
    this.maxAttempts = maxAttempts;
    this.windowMs = windowMs;
  }

  isAllowed(identifier: string): { allowed: boolean; retryAfter?: number } {
    const now = Date.now();
    const record = this.attempts.get(identifier);

    if (!record) {
      // Primeira tentativa
      this.attempts.set(identifier, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    if (now > record.resetAt) {
      // Janela expirou, reiniciar contagem
      this.attempts.set(identifier, { count: 1, resetAt: now + this.windowMs });
      return { allowed: true };
    }

    // Incrementar tentativas
    record.count += 1;

    if (record.count > this.maxAttempts) {
      // Limite excedido
      const retryAfter = Math.floor((record.resetAt - now) / 1000);
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  }

  reset(identifier: string): void {
    this.attempts.delete(identifier);
  }
}