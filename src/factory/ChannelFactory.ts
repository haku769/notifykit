import { NotificationChannel } from '../core/NotificationChannel';
import { ConfigurationError } from '../core/errors';
import { ConsoleChannel, ConsoleChannelOptions } from '../channels/ConsoleChannel';
import { InMemoryChannel, InMemoryChannelOptions } from '../channels/InMemoryChannel';
import { WebhookChannel, WebhookChannelOptions } from '../channels/WebhookChannel';
import { SlackChannel, SlackChannelOptions } from '../channels/SlackChannel';
import { EmailChannel, EmailChannelOptions } from '../channels/EmailChannel';

export type ChannelCreator<TConfig = any> = (config: TConfig) => NotificationChannel;

/**
 * PADRÃO FACTORY (Factory Method + Registry): cria canais a partir de um
 * identificador de tipo e de um objeto de configuração (ex.: lido de um JSON).
 *
 * O código cliente não precisa saber qual classe instanciar nem como montá-la.
 * Novos tipos são cadastrados com `register()`, sem alterar a fábrica (Open/Closed).
 */
export class ChannelFactory {
  private readonly creators = new Map<string, ChannelCreator<any>>();

  /** Fábrica já com os canais nativos registrados. */
  static withDefaults(): ChannelFactory {
    return new ChannelFactory()
      .register<ConsoleChannelOptions>('console', (c) => new ConsoleChannel(c))
      .register<InMemoryChannelOptions>('memory', (c) => new InMemoryChannel(c))
      .register<WebhookChannelOptions>('webhook', (c) => new WebhookChannel(c))
      .register<SlackChannelOptions>('slack', (c) => new SlackChannel(c))
      .register<EmailChannelOptions>('email', (c) => new EmailChannel(c));
  }

  register<TConfig>(type: string, creator: ChannelCreator<TConfig>): this {
    this.creators.set(type, creator);
    return this;
  }

  has(type: string): boolean {
    return this.creators.has(type);
  }

  get types(): string[] {
    return [...this.creators.keys()];
  }

  create<TConfig>(type: string, config: TConfig = {} as TConfig): NotificationChannel {
    const creator = this.creators.get(type);
    if (!creator) {
      throw new ConfigurationError(
        `Tipo de canal desconhecido: "${type}". Registrados: ${this.types.join(', ') || 'nenhum'}.`,
      );
    }
    return creator(config);
  }
}
