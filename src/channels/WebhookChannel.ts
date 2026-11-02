import { BaseChannel } from '../core/NotificationChannel';
import { Notification } from '../core/Notification';
import { DeliveryError } from '../core/errors';

export type FetchLike = (
  url: string,
  init: { method: string; headers: Record<string, string>; body: string },
) => Promise<{ ok: boolean; status: number; text(): Promise<string> }>;

export interface WebhookChannelOptions {
  url: string;
  name?: string;
  headers?: Record<string, string>;
  /** Permite injetar outro cliente HTTP (ou um fake em testes). Padrão: fetch global. */
  fetch?: FetchLike;
}

/**
 * Envia a notificação como JSON via HTTP POST para uma URL qualquer.
 * Subclasses podem sobrescrever `buildPayload` para atender APIs específicas
 * (veja SlackChannel).
 */
export class WebhookChannel extends BaseChannel {
  protected readonly url: string;
  private readonly headers: Record<string, string>;
  private readonly fetchFn: FetchLike;

  constructor(options: WebhookChannelOptions) {
    super(options.name ?? 'webhook');
    if (!options.url) throw new Error(`${this.name}: a opção "url" é obrigatória`);
    this.url = options.url;
    this.headers = { 'Content-Type': 'application/json', ...options.headers };
    this.fetchFn = options.fetch ?? (globalThis.fetch as unknown as FetchLike);
  }

  protected buildPayload(n: Notification): unknown {
    return {
      to: n.to,
      subject: n.subject,
      body: n.body,
      priority: n.priority,
      metadata: n.metadata,
    };
  }

  protected async deliver(n: Notification): Promise<void> {
    let response;
    try {
      response = await this.fetchFn(this.url, {
        method: 'POST',
        headers: this.headers,
        body: JSON.stringify(this.buildPayload(n)),
      });
    } catch (cause) {
      throw new DeliveryError(this.name, 'erro de rede', { cause });
    }
    if (!response.ok) {
      // 4xx (exceto 429) = erro do cliente, não adianta tentar de novo
      const retryable = response.status >= 500 || response.status === 429;
      throw new DeliveryError(this.name, `HTTP ${response.status}: ${await response.text()}`, {
        retryable,
      });
    }
  }
}
