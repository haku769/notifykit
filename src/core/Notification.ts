/**
 * Destinatário de uma notificação. Cada canal usa o campo que precisa
 * (o e-mail usa `email`, o SMS usaria `phone` etc.). Campos extras são permitidos
 * para que canais criados pelo cliente possam ter seus próprios identificadores.
 */
export interface Recipient {
  name?: string;
  email?: string;
  phone?: string;
  userId?: string;
  [key: string]: unknown;
}

export type Priority = 'low' | 'normal' | 'high';

/**
 * Mensagem imutável, já renderizada, pronta para ser entregue por qualquer canal.
 * Instâncias devem ser criadas pelo {@link NotificationBuilder}.
 */
export interface Notification {
  readonly to: Readonly<Recipient>;
  readonly subject?: string;
  readonly body: string;
  readonly priority: Priority;
  readonly data: Readonly<Record<string, unknown>>;
  readonly metadata: Readonly<Record<string, unknown>>;
}

/** Comprovante devolvido por um canal quando a entrega dá certo. */
export interface DeliveryReceipt {
  channel: string;
  messageId?: string;
  sentAt: Date;
}
