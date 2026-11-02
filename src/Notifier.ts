import { NotificationChannel } from './core/NotificationChannel';
import { DeliveryReceipt, Notification } from './core/Notification';
import { ConfigurationError } from './core/errors';
import { FallbackChain } from './chain/FallbackChain';
import { Listener, NotificationEvent, NotificationEventBus } from './events/NotificationEvents';
import { ChannelFactory } from './factory/ChannelFactory';
import { RetryChannel } from './decorators/RetryChannel';
import { LoggingChannel, Logger } from './decorators/LoggingChannel';
import { ExponentialBackoffOptions, ExponentialBackoffRetry } from './retry/RetryPolicy';

/** Canal a usar: um nome ou uma lista de nomes (lista = fallback, na ordem). */
export type Via = string | string[];

export interface NotifierOptions {
  /** Canal (ou lista de fallback) usado quando `send` não recebe `via`. */
  defaultVia?: Via;
}

export interface SendOptions {
  via?: Via;
}

export type BroadcastResult =
  | { channel: string; success: true; receipt: DeliveryReceipt }
  | { channel: string; success: false; error: Error };

/** Configuração declarativa de um canal, usada por `Notifier.fromConfig`. */
export interface ChannelConfig {
  type: string;
  /** Nome pelo qual o canal será chamado no `via`. Padrão: o próprio `type`. */
  name?: string;
  /** Envolve o canal em um RetryChannel com backoff exponencial. */
  retry?: ExponentialBackoffOptions | boolean;
  /** Envolve o canal em um LoggingChannel. `true` usa o console. */
  logging?: boolean | Logger;
  /** Demais opções são repassadas ao construtor do canal. */
  [option: string]: unknown;
}

export interface NotifierConfig extends NotifierOptions {
  channels: ChannelConfig[];
}

/**
 * PADRÃO FACADE: ponto de entrada único da biblioteca.
 *
 * Esconde a composição de canais, decorators, cadeia de fallback e eventos atrás de
 * uma API pequena: `use`, `send`, `broadcast` e `on`. Quem precisa de controle fino
 * pode usar as peças diretamente; o Notifier é só uma conveniência.
 */
export class Notifier {
  private readonly channels = new Map<string, NotificationChannel>();
  private readonly events = new NotificationEventBus();

  constructor(private readonly options: NotifierOptions = {}) {}

  /** Cria um Notifier a partir de uma configuração (ex.: carregada de um JSON). */
  static fromConfig(
    config: NotifierConfig,
    factory: ChannelFactory = ChannelFactory.withDefaults(),
  ): Notifier {
    const notifier = new Notifier({ defaultVia: config.defaultVia });
    for (const { type, name, retry, logging, ...channelOptions } of config.channels) {
      let channel = factory.create(type, { ...channelOptions, name: name ?? type });
      if (retry) {
        channel = new RetryChannel(
          channel,
          new ExponentialBackoffRetry(typeof retry === 'object' ? retry : {}),
        );
      }
      if (logging) {
        channel = new LoggingChannel(channel, typeof logging === 'object' ? logging : console);
      }
      notifier.use(channel, name ?? type);
    }
    return notifier;
  }

  /** Registra um canal. O nome usado no `via` é `alias` ou `channel.name`. */
  use(channel: NotificationChannel, alias: string = channel.name): this {
    this.channels.set(alias, channel);
    return this;
  }

  channel(name: string): NotificationChannel {
    const channel = this.channels.get(name);
    if (!channel) {
      throw new ConfigurationError(
        `Canal "${name}" não registrado. Disponíveis: ${[...this.channels.keys()].join(', ') || 'nenhum'}.`,
      );
    }
    return channel;
  }

  get channelNames(): string[] {
    return [...this.channels.keys()];
  }

  on<E extends NotificationEvent>(event: E, listener: Listener<E>): () => void {
    return this.events.on(event, listener);
  }

  /**
   * Envia por um canal. Se `via` for uma lista, tenta na ordem até um funcionar (fallback).
   * Lança erro se a entrega falhar de vez.
   */
  async send(notification: Notification, options: SendOptions = {}): Promise<DeliveryReceipt> {
    const via = this.resolveVia(options.via);
    const channel = Array.isArray(via)
      ? new FallbackChain(via.map((n) => this.channel(n)), (name, error) =>
          this.events.emit('attemptFailed', { notification, channel: name, error }),
        )
      : this.channel(via);

    try {
      const receipt = await channel.send(notification);
      this.events.emit('sent', { notification, receipt });
      return receipt;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.events.emit('failed', { notification, channel: channel.name, error: err });
      throw err;
    }
  }

  /** Envia por todos os canais informados em paralelo. Nunca lança erro: devolve o resultado de cada um. */
  async broadcast(notification: Notification, via: string[] = this.channelNames): Promise<BroadcastResult[]> {
    return Promise.all(
      via.map(async (name): Promise<BroadcastResult> => {
        try {
          return { channel: name, success: true, receipt: await this.send(notification, { via: name }) };
        } catch (error) {
          return { channel: name, success: false, error: error as Error };
        }
      }),
    );
  }

  private resolveVia(via?: Via): Via {
    const resolved = via ?? this.options.defaultVia;
    if (resolved && (!Array.isArray(resolved) || resolved.length > 0)) return resolved;
    if (this.channels.size === 1) return this.channelNames[0];
    throw new ConfigurationError(
      'Informe o canal com { via } ou configure "defaultVia" (há mais de um canal registrado).',
    );
  }
}
