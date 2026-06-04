// src/utils/cache.ts
export interface CacheOptions {
  ttl?: number;          // Tempo de vida em milissegundos (padrão: 5 minutos)
  maxSize?: number;      // Número máximo de itens no cache (padrão: 1000)
  onEviction?: (key: string, value: any) => void; // Callback chamado quando um item é removido
}

export class SimpleCache<T = any> {
  private cache: Map<string, { value: T; expiresAt: number }> = new Map();
  private options: Required<CacheOptions>;

  constructor(options: CacheOptions = {}) {
    this.options = {
      ttl: options.ttl ?? 300000, // TTL padrão de 5 minutos
      maxSize: options.maxSize ?? 1000, // Limite de 1000 itens por padrão
      onEviction: options.onEviction ?? (() => {})
    };
  }

  set(key: string, value: T, customTtl?: number): void {
    // Verificar limite de tamanho
    if (this.cache.size >= this.options.maxSize && !this.cache.has(key)) {
      // Remover o item mais antigo (FIFO)
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        const item = this.cache.get(firstKey);
        if (item) {
          this.options.onEviction(firstKey, item.value);
        }
        this.cache.delete(firstKey);
      }
    }

    const ttl = customTtl ?? this.options.ttl;
    const expiresAt = Date.now() + ttl;
    this.cache.set(key, { value, expiresAt });
  }

  get(key: string): T | null {
    const item = this.cache.get(key);

    if (!item) {
      return null;
    }

    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return null;
    }

    return item.value;
  }

  has(key: string): boolean {
    const item = this.cache.get(key);

    if (!item) {
      return false;
    }

    if (Date.now() > item.expiresAt) {
      this.delete(key);
      return false;
    }

    return true;
  }

  delete(key: string): boolean {
    const item = this.cache.get(key);
    if (item) {
      this.options.onEviction(key, item.value);
    }
    return this.cache.delete(key);
  }

  clear(): void {
    // Chamar onEviction para cada item antes de limpar
    for (const [key, item] of this.cache.entries()) {
      this.options.onEviction(key, item.value);
    }
    this.cache.clear();
  }

  size(): number {
    return this.cache.size;
  }

  // Método para obter estatísticas do cache
  stats(): { size: number; maxSize: number; percentageUsed: number } {
    return {
      size: this.cache.size,
      maxSize: this.options.maxSize,
      percentageUsed: (this.cache.size / this.options.maxSize) * 100
    };
  }

  // Método para limpar itens expirados manualmente
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiresAt) {
        this.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Instância global de cache com configurações padrão
export const cache = new SimpleCache();