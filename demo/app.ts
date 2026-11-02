import {
  Notifier,
  ConsoleChannel,
  EmailChannel,
  InMemoryChannel,
  RetryChannel,
  ExponentialBackoffRetry,
  notification,
} from 'notifykit';
import { DiscordChannel } from './canais/DiscordChannel';

// ── 1. Configuração (feita uma vez, na inicialização da aplicação) ──────────
const smtpFake = {
  // Em produção: nodemailer.createTransport({ host: 'smtp.gmail.com', ... })
  async sendMail(m: { to: string; subject: string }) {
    console.log(`  📧 [E-mail] para ${m.to}: "${m.subject}"`);
    return { messageId: 'abc' };
  },
};

const notifier = new Notifier({ defaultVia: 'email' })
  .use(new EmailChannel({ transport: smtpFake, from: 'loja@minhaloja.com' }))
  .use(new InMemoryChannel({ name: 'push', alwaysFail: true }))   // simulando push fora do ar
  .use(new RetryChannel(                                            // canal do cliente + retry da lib
    new DiscordChannel('https://discord.com/api/webhooks/...'),
    new ExponentialBackoffRetry({ maxAttempts: 3 }),
  ))
  .use(new ConsoleChannel(), 'log');

notifier.on('sent', ({ receipt }) => console.log(`  ✅ entregue via ${receipt.channel}`));
notifier.on('attemptFailed', ({ channel }) => console.log(`  ⚠️  ${channel} falhou, tentando o próximo...`));

// ── 2. Uso no dia a dia, dentro das regras de negócio da loja ──────────────
async function cadastrarCliente(nome: string, email: string) {
  // ...salva no banco...
  await notifier.send(
    notification()
      .to({ name: nome, email })
      .subject('Bem-vindo(a) à Minha Loja, {{ to.name }}!')
      .body('Use o cupom {{ cupom }} na primeira compra.')
      .data({ cupom: 'BEMVINDO10' })
      .build(),
  );
}

async function confirmarPedido(email: string, pedido: { id: number; total: number }) {
  // Tenta push no celular; se falhar, manda e-mail
  await notifier.send(
    notification()
      .to({ email })
      .subject('Pedido #{{ pedido.id }} confirmado')
      .body('Total: R$ {{ pedido.total }}')
      .data({ pedido })
      .build(),
    { via: ['push', 'email'] },
  );
}

async function alertarEquipe(erro: string) {
  // Avisa em todos os canais internos ao mesmo tempo
  await notifier.broadcast(
    notification().to('equipe-ti').subject('🚨 Erro em produção').body(erro).priority('high').build(),
    ['discord', 'log'],
  );
}

// ── 3. Simulando a aplicação rodando ────────────────────────────────────────
(async () => {
  console.log('\n▶ Cliente se cadastrou');
  await cadastrarCliente('Ana', 'ana@email.com');

  console.log('\n▶ Pedido confirmado');
  await confirmarPedido('ana@email.com', { id: 1042, total: 259.9 });

  console.log('\n▶ Erro no pagamento');
  await alertarEquipe('Gateway de pagamento retornou timeout');
})();
