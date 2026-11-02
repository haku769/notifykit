import { ChannelDecorator } from './ChannelDecorator';
import { NotificationChannel } from '../core/NotificationChannel';
import { DeliveryReceipt, Notification } from '../core/Notification';
import { ExponentialBackoffRetry, RetryPolicy } from '../retry/RetryPolicy';

export type Sleep = (ms: number) => Promise<void>;
const defaultSleep: Sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export interface RetryChannelOptions {
  /** Função chamada antes de cada nova tentativa. */
  onRetry?: (info: { attempt: number; delayMs: number; error: unknown }) => void;
  /** Injetável para testes. */
  sleep?: Sleep;
}

/** Decorator que repete o envio de acordo com uma RetryPolicy. */
export class RetryChannel extends ChannelDecorator {
  private readonly sleep: Sleep;

  constructor(
    inner: NotificationChannel,
    private readonly policy: RetryPolicy = new ExponentialBackoffRetry(),
    private readonly options: RetryChannelOptions = {},
  ) {
    super(inner);
    this.sleep = options.sleep ?? defaultSleep;
  }

  override async send(notification: Notification): Promise<DeliveryReceipt> {
    for (let attempt = 1; ; attempt++) {
      try {
        return await this.inner.send(notification);
      } catch (error) {
        if (attempt >= this.policy.maxAttempts || !this.policy.shouldRetry(error)) throw error;
        const delayMs = this.policy.delayFor(attempt);
        this.options.onRetry?.({ attempt, delayMs, error });
        await this.sleep(delayMs);
      }
    }
  }
}
