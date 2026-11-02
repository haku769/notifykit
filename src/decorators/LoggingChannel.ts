import { ChannelDecorator } from './ChannelDecorator';
import { NotificationChannel } from '../core/NotificationChannel';
import { DeliveryReceipt, Notification } from '../core/Notification';

export interface Logger {
  info(message: string): void;
  error(message: string): void;
}

/** Decorator que registra no log o início, o sucesso e a falha de cada envio, com a duração. */
export class LoggingChannel extends ChannelDecorator {
  constructor(
    inner: NotificationChannel,
    private readonly logger: Logger = console,
  ) {
    super(inner);
  }

  override async send(notification: Notification): Promise<DeliveryReceipt> {
    const start = Date.now();
    this.logger.info(`[notifykit] ${this.name}: enviando...`);
    try {
      const receipt = await this.inner.send(notification);
      this.logger.info(`[notifykit] ${this.name}: enviado em ${Date.now() - start}ms`);
      return receipt;
    } catch (error) {
      this.logger.error(
        `[notifykit] ${this.name}: falhou em ${Date.now() - start}ms: ${(error as Error).message}`,
      );
      throw error;
    }
  }
}
