export type ContactChannel = 'call' | 'email';

export type ContactRequest = {
  patientId: string;
  channel: ContactChannel;
  destination: string;
  subject?: string;
  message?: string;
  metadata?: Record<string, unknown>;
};

export type ProviderAttemptResult = {
  provider: string;
  externalId?: string;
  status: 'sent' | 'queued';
};

export type DialerProvider = {
  sendCall: (request: ContactRequest) => Promise<ProviderAttemptResult>;
};

export type EmailProvider = {
  sendEmail: (request: ContactRequest) => Promise<ProviderAttemptResult>;
};

export const dialerProvider: DialerProvider = {
  async sendCall(request) {
    const force = process.env.COMM_FORCE_FAIL;
    if (force === 'all' || force === 'call') {
      throw new Error('Dialer indisponível no momento');
    }

    return {
      provider: 'DialerWebhookV1',
      externalId: `CALL-${Date.now()}`,
      status: 'queued'
    };
  }
};

export const emailProvider: EmailProvider = {
  async sendEmail(request) {
    const force = process.env.COMM_FORCE_FAIL;
    if (force === 'all' || force === 'email') {
      throw new Error('Email provider indisponível no momento');
    }

    return {
      provider: 'EmailApiV1',
      externalId: `MAIL-${Date.now()}`,
      status: 'sent'
    };
  }
};

export async function executeWithRetries<T>(
  action: () => Promise<T>,
  options?: { retries?: number; waitMs?: number; onAttemptError?: (attempt: number, error: Error) => Promise<void> | void }
) {
  const retries = options?.retries ?? 2;
  const waitMs = options?.waitMs ?? 100;

  let attempt = 0;
  while (attempt <= retries) {
    attempt += 1;
    try {
      const result = await action();
      return { ok: true as const, attempt, result };
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Falha desconhecida de comunicação');
      await options?.onAttemptError?.(attempt, err);
      if (attempt > retries) {
        return { ok: false as const, attempt, error: err };
      }
      await new Promise((resolve) => setTimeout(resolve, waitMs));
    }
  }

  return { ok: false as const, attempt: retries + 1, error: new Error('Falha inesperada') };
}
