import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationError, InMemoryChannel, Notifier, RetryChannel, LoggingChannel, notification } from '../src';

const msg = notification().to('a@b.com').body('oi').build();

test('Facade: envia pelo único canal registrado sem precisar de via', async () => {
  const mem = new InMemoryChannel();
  await new Notifier().use(mem).send(msg);
  assert.equal(mem.sent.length, 1);
});

test('Facade: exige via quando há vários canais e nenhum padrão', async () => {
  const n = new Notifier().use(new InMemoryChannel({ name: 'a' })).use(new InMemoryChannel({ name: 'b' }));
  await assert.rejects(n.send(msg), ConfigurationError);
  await assert.rejects(n.send(msg, { via: 'zzz' }), ConfigurationError);
});

test('Facade: via em lista vira fallback e emite eventos', async () => {
  const events: string[] = [];
  const n = new Notifier()
    .use(new InMemoryChannel({ name: 'push', alwaysFail: true }))
    .use(new InMemoryChannel({ name: 'email' }));
  n.on('attemptFailed', ({ channel }) => events.push(`fail:${channel}`));
  n.on('sent', ({ receipt }) => events.push(`sent:${receipt.channel}`));

  await n.send(msg, { via: ['push', 'email'] });
  assert.deepEqual(events, ['fail:push', 'sent:email']);
});

test('Facade: emite failed e relança o erro', async () => {
  const failed: string[] = [];
  const n = new Notifier().use(new InMemoryChannel({ alwaysFail: true }));
  n.on('failed', ({ channel }) => failed.push(channel));
  await assert.rejects(n.send(msg));
  assert.deepEqual(failed, ['memory']);
});

test('Facade: broadcast devolve o resultado de cada canal', async () => {
  const n = new Notifier()
    .use(new InMemoryChannel({ name: 'a' }))
    .use(new InMemoryChannel({ name: 'b', alwaysFail: true }));
  const results = await n.broadcast(msg);
  assert.deepEqual(results.map((r) => [r.channel, r.success]), [['a', true], ['b', false]]);
});

test('fromConfig usa a fábrica e aplica decorators', async () => {
  const n = Notifier.fromConfig({
    defaultVia: 'principal',
    channels: [
      { type: 'memory', name: 'principal', retry: { maxAttempts: 2, initialDelayMs: 1 }, logging: { info() {}, error() {} } },
      { type: 'console' },
    ],
  });
  assert.deepEqual(n.channelNames, ['principal', 'console']);
  assert.ok(n.channel('principal') instanceof LoggingChannel);
  assert.equal((await n.send(msg)).channel, 'principal');
  assert.ok(!(n.channel('console') instanceof RetryChannel));
});
