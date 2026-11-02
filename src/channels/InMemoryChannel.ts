import { BaseChannel } from '../core/NotificationChannel';
import { Notification } from '../core/Notification';
import { DeliveryError } from '../core/errors';

export interface InMemoryChannelOptions {
  name?: string;
  /** Simula falhas: as N primeiras tentativas lançam erro. */
  failTimes?: number;
  /** Simula um canal fora do ar: toda tentativa falha. */
  alwaysFail?: boolean;
}

/**
 * Canal que guarda as notificações em memória em vez de enviar.
 * Pensado para testes automatizados de quem usa a lib.
 */
export class InMemoryChannel extends BaseChannel {
  readonly sent: Notification[] = [];
  attempts = 0;
  private remainingFailures: number;

  constructor(private readonly options: InMemoryChannelOptions = {}) {
    super(options.name ?? 'memory');
    this.remainingFailures = options.failTimes ?? 0;
  }

  protected async deliver(n: Notification): Promise<{ messageId: string }> {
    this.attempts++;
    if (this.options.alwaysFail || this.remainingFailures > 0) {
      this.remainingFailures--;
      throw new DeliveryError(this.name, `falha simulada (tentativa ${this.attempts})`);
    }
    this.sent.push(n);
    return { messageId: `${this.name}-${this.sent.length}` };
  }

  clear(): void {
    this.sent.length = 0;
    this.attempts = 0;
  }
}
