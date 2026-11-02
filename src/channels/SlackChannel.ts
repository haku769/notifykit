import { Notification } from '../core/Notification';
import { WebhookChannel, WebhookChannelOptions } from './WebhookChannel';

export type SlackChannelOptions = Omit<WebhookChannelOptions, 'url'> & {
  /** URL de um Incoming Webhook do Slack. */
  webhookUrl: string;
};

/** Envia a notificação para um canal do Slack usando Incoming Webhooks. */
export class SlackChannel extends WebhookChannel {
  constructor(options: SlackChannelOptions) {
    super({ ...options, url: options.webhookUrl, name: options.name ?? 'slack' });
  }

  protected override buildPayload(n: Notification): unknown {
    const icon = n.priority === 'high' ? ':rotating_light: ' : '';
    return { text: n.subject ? `${icon}*${n.subject}*\n${n.body}` : `${icon}${n.body}` };
  }
}
