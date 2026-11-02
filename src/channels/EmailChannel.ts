import { BaseChannel } from '../core/NotificationChannel';
import { Notification } from '../core/Notification';
import { DeliveryError } from '../core/errors';

export interface EmailMessage {
  from: string;
  to: string;
  subject: string;
  text: string;
  priority?: 'high' | 'normal' | 'low';
}

/**
 * Abstração do transporte SMTP. É compatível com o `transporter` do nodemailer,
 * então o cliente pode passar `nodemailer.createTransport(...)` diretamente,
 * e a lib não precisa depender do nodemailer.
 */
export interface EmailTransport {
  sendMail(message: EmailMessage): Promise<{ messageId?: string }>;
}

export interface EmailChannelOptions {
  transport: EmailTransport;
  from: string;
  name?: string;
  /** Assunto usado quando a notificação não tem um. */
  defaultSubject?: string;
}

/** Canal de e-mail. Exige que o destinatário tenha `email`. */
export class EmailChannel extends BaseChannel {
  constructor(private readonly options: EmailChannelOptions) {
    super(options.name ?? 'email');
  }

  protected override validate(n: Notification): string | undefined {
    return n.to.email ? undefined : 'destinatário sem "email"';
  }

  protected async deliver(n: Notification): Promise<{ messageId?: string }> {
    try {
      return await this.options.transport.sendMail({
        from: this.options.from,
        to: n.to.email!,
        subject: n.subject ?? this.options.defaultSubject ?? '(sem assunto)',
        text: n.body,
        priority: n.priority,
      });
    } catch (cause) {
      throw new DeliveryError(this.name, `falha no transporte SMTP: ${(cause as Error).message}`, {
        cause,
      });
    }
  }
}
