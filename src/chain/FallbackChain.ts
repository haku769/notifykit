import { NotificationChannel } from '../core/NotificationChannel';
import { DeliveryReceipt, Notification } from '../core/Notification';
import { AllChannelsFailedError, ConfigurationError } from '../core/errors';

/**
 * PADRÃO CHAIN OF RESPONSIBILITY: cada elo tenta entregar a notificação.
 * Se não conseguir, passa a responsabilidade para o próximo elo.
 *
 * Nenhum canal sabe que existe fallback nem qual vem depois: a ordem é montada
 * de fora (ex.: push → SMS → e-mail) e pode mudar sem alterar nenhum canal.
 */
export class ChannelHandler {
  private next?: ChannelHandler;

  constructor(readonly channel: NotificationChannel) {}

  setNext(handler: ChannelHandler): ChannelHandler {
    this.next = handler;
    return handler;
  }

  async handle(
    notification: Notification,
    errors: Error[] = [],
    onFailure?: (channel: string, error: Error) => void,
  ): Promise<DeliveryReceipt> {
    try {
      return await this.channel.send(notification);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      errors.push(err);
      onFailure?.(this.channel.name, err);
      if (!this.next) throw new AllChannelsFailedError(errors);
      return this.next.handle(notification, errors, onFailure);
    }
  }
}

/**
 * Monta a cadeia a partir de uma lista de canais. A própria cadeia também é um
 * NotificationChannel, então pode ser decorada, registrada no Notifier ou usada
 * como elo de outra cadeia.
 */
export class FallbackChain implements NotificationChannel {
  readonly name: string;
  private readonly head: ChannelHandler;

  constructor(
    channels: NotificationChannel[],
    private readonly onFailure?: (channel: string, error: Error) => void,
  ) {
    if (channels.length === 0) throw new ConfigurationError('FallbackChain precisa de ao menos 1 canal.');
    const handlers = channels.map((c) => new ChannelHandler(c));
    handlers.reduce((prev, curr) => prev.setNext(curr));
    this.head = handlers[0];
    this.name = channels.map((c) => c.name).join(' → ');
  }

  static of(...channels: NotificationChannel[]): FallbackChain {
    return new FallbackChain(channels);
  }

  send(notification: Notification): Promise<DeliveryReceipt> {
    return this.head.handle(notification, [], this.onFailure);
  }
}
