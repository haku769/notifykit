import { DeliveryReceipt, Notification } from './Notification';
import { UnsupportedRecipientError } from './errors';

/**
 * PADRÃO STRATEGY: contrato comum de todos os meios de envio.
 *
 * O Notifier, os decorators e a cadeia de fallback dependem só desta interface,
 * então qualquer canal (pronto ou criado pelo cliente) é intercambiável.
 * Em caso de falha, `send` deve lançar um erro (de preferência um DeliveryError).
 */
export interface NotificationChannel {
  readonly name: string;
  send(notification: Notification): Promise<DeliveryReceipt>;
}

/**
 * PADRÃO TEMPLATE METHOD: esqueleto do envio, compartilhado por todos os canais.
 *
 * `send()` define o algoritmo fixo (validar → entregar → montar o comprovante)
 * e as subclasses implementam só os passos variáveis: `validate()` (opcional)
 * e `deliver()` (obrigatório). Assim, um canal novo não precisa repetir a validação
 * nem a montagem do comprovante.
 */
export abstract class BaseChannel implements NotificationChannel {
  constructor(public readonly name: string) {}

  async send(notification: Notification): Promise<DeliveryReceipt> {
    const problem = this.validate(notification);
    if (problem) throw new UnsupportedRecipientError(this.name, problem);

    const result = await this.deliver(notification);
    return { channel: this.name, messageId: result?.messageId, sentAt: new Date() };
  }

  /** Gancho opcional: devolve uma mensagem de erro se o canal não puder atender a notificação. */
  protected validate(_notification: Notification): string | undefined {
    return undefined;
  }

  /** Passo obrigatório: a entrega propriamente dita. */
  protected abstract deliver(
    notification: Notification,
  ): Promise<{ messageId?: string } | void>;
}
