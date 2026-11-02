/**
 * Exemplo 2: o cliente ESTENDE a lib sem alterar o código dela (Open/Closed).
 * Rode com: npm run example:custom
 *
 * Pontos de extensão mostrados:
 *   a) Canal novo herdando de BaseChannel (Template Method)
 *   b) Canal novo implementando NotificationChannel direto (Strategy)
 *   c) Decorator próprio (Decorator)
 *   d) Política de retry própria (Strategy)
 *   e) Registro de um tipo novo na fábrica (Factory)
 *   f) Motor de template próprio (Strategy)
 */
import {
  BaseChannel,
  ChannelDecorator,
  ChannelFactory,
  DeliveryError,
  DeliveryReceipt,
  Notification,
  NotificationBuilder,
  NotificationChannel,
  Notifier,
  RetryChannel,
  RetryPolicy,
  TemplateEngine,
  notification,
} from '../src';

// a) Canal do Telegram: só implementa os passos variáveis do Template Method.
interface TelegramOptions {
  botToken: string;
  name?: string;
}

class TelegramChannel extends BaseChannel {
  constructor(private readonly opts: TelegramOptions) {
    super(opts.name ?? 'telegram');
  }

  protected override validate(n: Notification) {
    return n.to.telegramChatId ? undefined : 'destinatário sem "telegramChatId"';
  }

  protected async deliver(n: Notification) {
    // Em produção: fetch(`https://api.telegram.org/bot${this.opts.botToken}/sendMessage`, ...)
    console.log(`  (Telegram) chat ${n.to.telegramChatId}: ${n.body}`);
    return { messageId: `tg-${Date.now()}` };
  }
}

// b) Canal de SMS implementando a interface direto, sem herdar nada da lib.
class SmsChannel implements NotificationChannel {
  readonly name = 'sms';
  private calls = 0;

  async send(n: Notification): Promise<DeliveryReceipt> {
    this.calls++;
    if (this.calls === 1) throw new DeliveryError(this.name, 'gateway ocupado'); // falha 1x
    console.log(`  (SMS) ${n.to.phone}: ${n.body.slice(0, 160)}`);
    return { channel: this.name, sentAt: new Date() };
  }
}

// c) Decorator próprio: bloqueia notificações não urgentes fora do horário comercial.
class QuietHoursChannel extends ChannelDecorator {
  constructor(inner: NotificationChannel, private readonly now: () => Date = () => new Date()) {
    super(inner);
  }

  override async send(n: Notification): Promise<DeliveryReceipt> {
    const hour = this.now().getHours();
    if (n.priority !== 'high' && (hour < 8 || hour >= 22)) {
      throw new DeliveryError(this.name, 'horário de silêncio', { retryable: false });
    }
    return super.send(n);
  }
}

// d) Política de retry própria: até 5 tentativas, 100ms * tentativa.
class LinearRetry implements RetryPolicy {
  readonly maxAttempts = 5;
  delayFor(attempt: number) {
    return 100 * attempt;
  }
  shouldRetry(error: unknown) {
    return !(error instanceof DeliveryError) || error.retryable;
  }
}

// f) Motor de template próprio: sintaxe ${var} em vez de {{var}}.
class DollarTemplateEngine implements TemplateEngine {
  render(template: string, data: Record<string, unknown>) {
    return template.replace(/\$\{(\w+)\}/g, (_, k) => String(data[k] ?? ''));
  }
}

async function main() {
  // e) Registrando o tipo novo na fábrica e usando via configuração
  const factory = ChannelFactory.withDefaults().register<TelegramOptions>(
    'telegram',
    (cfg) => new TelegramChannel(cfg),
  );

  const notifier = Notifier.fromConfig(
    { channels: [{ type: 'telegram', botToken: 'abc123' }, { type: 'console' }] },
    factory,
  )
    // canais e decorators do cliente misturados aos da lib
    .use(new QuietHoursChannel(new RetryChannel(new SmsChannel(), new LinearRetry(), {
      onRetry: ({ attempt, delayMs }) => console.log(`  ↻ sms: nova tentativa em ${delayMs}ms (falhou a ${attempt}ª)`),
    })));

  notifier.on('sent', ({ receipt }) => console.log(`  ✔ entregue via ${receipt.channel}`));

  const alerta = notification()
    .to({ name: 'Carlos', phone: '+5511999990000', telegramChatId: 42 })
    .body('Alerta: o servidor {{ servidor }} está com CPU em {{ cpu }}%')
    .data({ servidor: 'api-01', cpu: 97 })
    .priority('high')
    .build();

  console.log('\n# Canal Telegram criado pelo cliente (registrado na fábrica)');
  await notifier.send(alerta, { via: 'telegram' });

  console.log('\n# SMS do cliente + RetryChannel da lib + QuietHours do cliente');
  await notifier.send(alerta, { via: 'sms' });

  console.log('\n# Fallback misturando canais do cliente e da lib');
  const semTelegram = notification().to({ name: 'Bia' }).body('Seu relatório está pronto').build();
  await notifier.send(semTelegram, { via: ['telegram', 'console'] });

  console.log('\n# Motor de template próprio');
  const custom = new NotificationBuilder()
    .templateEngine(new DollarTemplateEngine())
    .to('bia@exemplo.com')
    .body('Oi ${nome}, total: R$ ${total}')
    .data({ nome: 'Bia', total: '59,90' })
    .build();
  await notifier.send(custom, { via: 'console' });
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
