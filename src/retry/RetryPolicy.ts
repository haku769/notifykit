import { DeliveryError } from '../core/errors';

/**
 * PADRÃO STRATEGY: decide quantas vezes tentar de novo e quanto esperar entre as tentativas.
 * Usada pelo RetryChannel. O cliente pode criar políticas próprias (ex.: com jitter).
 */
export interface RetryPolicy {
  /** Número máximo de tentativas, incluindo a primeira. */
  readonly maxAttempts: number;
  /** Espera (ms) antes da tentativa `attempt + 1`, sendo `attempt` a que acabou de falhar (1, 2...). */
  delayFor(attempt: number): number;
  /** Se o erro justifica uma nova tentativa. */
  shouldRetry(error: unknown): boolean;
}

/** Comportamento padrão: não repete erros marcados como não-recuperáveis. */
const isRetryable = (error: unknown): boolean =>
  !(error instanceof DeliveryError) || error.retryable;

export class NoRetry implements RetryPolicy {
  readonly maxAttempts = 1;
  delayFor(): number {
    return 0;
  }
  shouldRetry(): boolean {
    return false;
  }
}

export class FixedDelayRetry implements RetryPolicy {
  constructor(
    public readonly maxAttempts = 3,
    private readonly delayMs = 1000,
  ) {}

  delayFor(): number {
    return this.delayMs;
  }

  shouldRetry(error: unknown): boolean {
    return isRetryable(error);
  }
}

export interface ExponentialBackoffOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  factor?: number;
  maxDelayMs?: number;
}

/** Espera initialDelay, initialDelay*factor, initialDelay*factor²... limitado a maxDelayMs. */
export class ExponentialBackoffRetry implements RetryPolicy {
  readonly maxAttempts: number;
  private readonly initialDelayMs: number;
  private readonly factor: number;
  private readonly maxDelayMs: number;

  constructor(options: ExponentialBackoffOptions = {}) {
    this.maxAttempts = options.maxAttempts ?? 3;
    this.initialDelayMs = options.initialDelayMs ?? 500;
    this.factor = options.factor ?? 2;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
  }

  delayFor(attempt: number): number {
    return Math.min(this.initialDelayMs * this.factor ** (attempt - 1), this.maxDelayMs);
  }

  shouldRetry(error: unknown): boolean {
    return isRetryable(error);
  }
}
