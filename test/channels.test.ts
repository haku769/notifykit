import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ConsoleChannel,
  DeliveryError,
  EmailChannel,
  FetchLike,
  InMemoryChannel,
  SlackChannel,
  UnsupportedRecipientError,
  WebhookChannel,
  notification,
} from '../src';

const msg = notification().to({ email: 'a@b.com' }).subject('S').body('B').build();

test('ConsoleChannel escreve na saída configurada', async () => {
  const lines: string[] = [];
  const receipt = await new ConsoleChannel({ output: (l) => lines.push(l) }).send(msg);
  assert.equal(receipt.channel, 'console');
  assert.match(lines[0], /a@b\.com \| S\nB/);
});

test('InMemoryChannel guarda o que foi enviado e simula falhas', async () => {
  const ch = new InMemoryChannel({ failTimes: 1 });
  await assert.rejects(ch.send(msg), DeliveryError);
  const receipt = await ch.send(msg);
  assert.equal(ch.sent.length, 1);
  assert.equal(receipt.messageId, 'memory-1');
});

test('EmailChannel usa o transporte e valida o destinatário', async () => {
  const sent: any[] = [];
  const ch = new EmailChannel({
    from: 'app@x.com',
    transport: { sendMail: async (m) => (sent.push(m), { messageId: 'id-1' }) },
  });
  const receipt = await ch.send(msg);
  assert.equal(receipt.messageId, 'id-1');
  assert.deepEqual(
    { from: sent[0].from, to: sent[0].to, subject: sent[0].subject, text: sent[0].text },
    { from: 'app@x.com', to: 'a@b.com', subject: 'S', text: 'B' },
  );

  const semEmail = notification().to({ phone: '123' }).body('x').build();
  await assert.rejects(ch.send(semEmail), UnsupportedRecipientError);
});

function fakeFetch(status = 200) {
  const calls: { url: string; body: any }[] = [];
  const fetch: FetchLike = async (url, init) => {
    calls.push({ url, body: JSON.parse(init.body) });
    return { ok: status < 400, status, text: async () => 'resp' };
  };
  return { fetch, calls };
}

test('WebhookChannel faz POST com JSON', async () => {
  const { fetch, calls } = fakeFetch();
  await new WebhookChannel({ url: 'http://hook', fetch }).send(msg);
  assert.equal(calls[0].url, 'http://hook');
  assert.equal(calls[0].body.body, 'B');
});

test('WebhookChannel marca 4xx como não-recuperável e 5xx como recuperável', async () => {
  const e400 = await new WebhookChannel({ url: 'u', fetch: fakeFetch(400).fetch }).send(msg).catch((e) => e);
  const e503 = await new WebhookChannel({ url: 'u', fetch: fakeFetch(503).fetch }).send(msg).catch((e) => e);
  assert.equal(e400.retryable, false);
  assert.equal(e503.retryable, true);
});

test('SlackChannel formata o payload do Slack', async () => {
  const { fetch, calls } = fakeFetch();
  await new SlackChannel({ webhookUrl: 'http://slack', fetch }).send(msg);
  assert.deepEqual(calls[0].body, { text: '*S*\nB' });
});
