import { NotificationChannel } from '../core/NotificationChannel';
import { DeliveryReceipt, Notification } from '../core/Notification';

/**
 * PADRÃO DECORATOR: classe base para adicionar comportamento a um canal
 * sem alterá-lo e sem herança.
 *
 * O decorator implementa a mesma interface do canal que envolve, então pode ser
 * usado no lugar dele e empilhado com outros:
 *   new LoggingChannel(new RetryChannel(new EmailChannel(...)))
 * Funciona igualmente com canais criados pelo cliente.
 */
export abstract class ChannelDecorator implements NotificationChannel {
  constructor(protected readonly inner: NotificationChannel) {}

  get name(): string {
    return this.inner.name;
  }

  send(notification: Notification): Promise<DeliveryReceipt> {
    return this.inner.send(notification);
  }
}
