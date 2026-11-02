import { BaseChannel } from '../core/NotificationChannel';
import { Notification } from '../core/Notification';

export interface ConsoleChannelOptions {
  name?: string;
  /** Função de saída. Padrão: console.log */
  output?: (line: string) => void;
}

/** Canal que imprime a notificação no terminal. Útil em desenvolvimento e demos. */
export class ConsoleChannel extends BaseChannel {
  private readonly output: (line: string) => void;

  constructor(options: ConsoleChannelOptions = {}) {
    super(options.name ?? 'console');
    this.output = options.output ?? ((line) => console.log(line));
  }

  protected async deliver(n: Notification): Promise<void> {
    const to = n.to.email ?? n.to.phone ?? n.to.userId ?? n.to.name ?? JSON.stringify(n.to);
    const header = `[${this.name}] (${n.priority}) para ${to}`;
    this.output(n.subject ? `${header} | ${n.subject}\n${n.body}` : `${header}\n${n.body}`);
  }
}
