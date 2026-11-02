// EXTENSÃO: canal que NÃO existe na lib, criado pelo desenvolvedor da loja.
import { BaseChannel, Notification } from 'notifykit';

export class DiscordChannel extends BaseChannel {
  constructor(private readonly webhookUrl: string) {
    super('discord');
  }

  protected async deliver(n: Notification) {
    // Em produção: await fetch(this.webhookUrl, { method: 'POST', body: JSON.stringify({ content: n.body }) })
    console.log(`  💬 [Discord] ${n.subject ?? ''} — ${n.body}`);
  }
}
