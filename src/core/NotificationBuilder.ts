import { Notification, Priority, Recipient } from './Notification';
import { ConfigurationError } from './errors';
import { SimpleTemplateEngine, TemplateEngine } from '../templates/TemplateEngine';

/**
 * PADRÃO BUILDER: monta uma Notification, que tem vários campos opcionais
 * (assunto, prioridade, variáveis de template, metadados), por meio de uma API fluente.
 *
 * Evita construtores com muitos parâmetros, valida os campos obrigatórios em um
 * único lugar (`build`) e devolve um objeto imutável já com o template renderizado.
 */
export class NotificationBuilder {
  private static defaultEngine: TemplateEngine = new SimpleTemplateEngine();

  private recipient?: Recipient;
  private subjectText?: string;
  private bodyText?: string;
  private priorityValue: Priority = 'normal';
  private templateData: Record<string, unknown> = {};
  private meta: Record<string, unknown> = {};
  private engine?: TemplateEngine;

  /** Troca o motor de template usado por padrão em todos os builders. */
  static setDefaultTemplateEngine(engine: TemplateEngine): void {
    NotificationBuilder.defaultEngine = engine;
  }

  to(recipient: Recipient | string): this {
    this.recipient =
      typeof recipient === 'string'
        ? recipient.includes('@')
          ? { email: recipient }
          : { userId: recipient }
        : { ...recipient };
    return this;
  }

  subject(subject: string): this {
    this.subjectText = subject;
    return this;
  }

  body(body: string): this {
    this.bodyText = body;
    return this;
  }

  /** Variáveis usadas para renderizar `{{ ... }}` no assunto e no corpo. */
  data(data: Record<string, unknown>): this {
    this.templateData = { ...this.templateData, ...data };
    return this;
  }

  priority(priority: Priority): this {
    this.priorityValue = priority;
    return this;
  }

  metadata(key: string, value: unknown): this {
    this.meta[key] = value;
    return this;
  }

  /** Usa um motor de template específico só nesta notificação. */
  templateEngine(engine: TemplateEngine): this {
    this.engine = engine;
    return this;
  }

  build(): Notification {
    if (!this.recipient || Object.keys(this.recipient).length === 0) {
      throw new ConfigurationError('A notificação precisa de um destinatário (to).');
    }
    if (!this.bodyText) {
      throw new ConfigurationError('A notificação precisa de um corpo (body).');
    }

    const engine = this.engine ?? NotificationBuilder.defaultEngine;
    const context = { ...this.templateData, to: this.recipient };

    return Object.freeze({
      to: Object.freeze({ ...this.recipient }),
      subject: this.subjectText ? engine.render(this.subjectText, context) : undefined,
      body: engine.render(this.bodyText, context),
      priority: this.priorityValue,
      data: Object.freeze({ ...this.templateData }),
      metadata: Object.freeze({ ...this.meta }),
    });
  }
}

/** Atalho: `notification().to(...).body(...).build()` */
export const notification = (): NotificationBuilder => new NotificationBuilder();
