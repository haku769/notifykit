/**
 * Exemplo 1: uso padrão (out-of-the-box), só com recursos prontos da lib.
 * Rode com: npm run example:basic
 *
 * Num projeto real, o import seria: from 'notifykit'
 */
import {
  ConsoleChannel,
  EmailChannel,
  EmailTransport,
  InMemoryChannel,
  Notifier,
  notification,
} from '../src';

async function main() {
  // ---------------------------------------------------------------
  // 1) Montando a mensagem com o Builder (template {{ }} já incluso)
  // ---------------------------------------------------------------
  const boasVindas = notification()
    .to({ name: 'Ana', email: 'ana@exemplo.com' })
    .subject('Bem-vinda, {{ to.name }}!')
    .body('Olá {{ to.name }}, seu plano {{ plano }} já está ativo.')
    .data({ plano: 'Premium' })
    .priority('high')
    .build();

  // ---------------------------------------------------------------
  // 2) Notifier com canais prontos
  // ---------------------------------------------------------------
  // Transporte fake para a demo. Em produção: nodemailer.createTransport({...})
  const fakeSmtp: EmailTransport = {
    async sendMail(msg) {
      console.log(`  (SMTP) De ${msg.from} para ${msg.to}: "${msg.subject}"`);
      return { messageId: 'smtp-123' };
    },
  };

  const notifier = new Notifier({ defaultVia: 'console' })
    .use(new ConsoleChannel())
    .use(new EmailChannel({ transport: fakeSmtp, from: 'no-reply@app.com' }))
    .use(new InMemoryChannel({ name: 'push', alwaysFail: true })); // simula push fora do ar

  // Observer: o cliente reage aos eventos sem mexer no fluxo
  notifier.on('sent', ({ receipt }) => console.log(`  ✔ entregue via ${receipt.channel}`));
  notifier.on('attemptFailed', ({ channel, error }) =>
    console.log(`  ✖ ${channel} falhou (${error.message}), tentando o próximo...`),
  );

  console.log('\n# Envio pelo canal padrão');
  await notifier.send(boasVindas);

  console.log('\n# Envio por um canal específico');
  await notifier.send(boasVindas, { via: 'email' });

  console.log('\n# Fallback: push → email');
  await notifier.send(boasVindas, { via: ['push', 'email'] });

  console.log('\n# Broadcast para vários canais');
  const resultados = await notifier.broadcast(boasVindas, ['console', 'push']);
  resultados.forEach((r) => console.log(`  ${r.channel}: ${r.success ? 'ok' : 'falhou'}`));

  // ---------------------------------------------------------------
  // 3) Configuração declarativa (ex.: vinda de um arquivo JSON)
  // ---------------------------------------------------------------
  console.log('\n# Notifier.fromConfig com retry e logging');
  const configurado = Notifier.fromConfig({
    defaultVia: ['instavel', 'log'],
    channels: [
      { type: 'memory', name: 'instavel', failTimes: 2, retry: { maxAttempts: 3, initialDelayMs: 50 }, logging: true },
      { type: 'console', name: 'log' },
    ],
  });
  await configurado.send(boasVindas);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
