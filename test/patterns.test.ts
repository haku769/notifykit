import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  AllChannelsFailedError,
  ChannelFactory,
  ConfigurationError,
  DeliveryError,
  ExponentialBackoffRetry,
  FallbackChain,
  FixedDelayRetry,
  InMemoryChannel,
  LoggingChannel,
  NotificationEventBus,
  RetryChannel,
  notification,
} from '../src';

const msg = notification().to('a@b.com').body('oi').build();
const noSleep = async () => {};

test('Decorator RetryChannel repete até conseguir', async () => {
  const inner = new InMemoryChannel({ failTimes: 2 });
  const retries: number[] = [];
  const ch = new RetryChannel(inner, new FixedDelayRetry(3, 10), {
    sleep: noSleep,
    onRetry: ({ attempt }) => retries.push(attempt),
  });
  await ch.send(msg);
  assert.equal(inner.attempts, 3);
  assert.deepEqual(retries, [1, 2]);
  assert.equal(ch.name, 'memory');
});

test('Decorator RetryChannel desiste após maxAttempts', async () => {
  const inner = new InMemoryChannel({ alwaysFail: true });
  await assert.rejects(new RetryChannel(inner, new FixedDelayRetry(4, 0), { sleep: noSleep }).send(msg));
  assert.equal(inner.attempts, 4);
});

test('Decorator RetryChannel não repete erro não-recuperável', async () => {
  let calls = 0;
  const inner = {
    name: 'x',
    send: async () => {
      calls++;
      throw new DeliveryError('x', 'inválido', { retryable: false });
    },
  };
  await assert.rejects(new RetryChannel(inner, new FixedDelayRetry(5, 0), { sleep: noSleep }).send(msg));
  assert.equal(calls, 1);
});

test('ExponentialBackoffRetry calcula atrasos crescentes com teto', () => {
  const p = new ExponentialBackoffRetry({ initialDelayMs: 100, factor: 2, maxDelayMs: 500 });
  assert.deepEqual([1, 2, 3, 4].map((a) => p.delayFor(a)), [100, 200, 400, 500]);
});

test('Decorators podem ser empilhados', async () => {
  const logs: string[] = [];
  const logger = { info: (m: string) => logs.push(m), error: (m: string) => logs.push(m) };
  const ch = new LoggingChannel(
    new RetryChannel(new InMemoryChannel({ failTimes: 1 }), new FixedDelayRetry(2, 0), { sleep: noSleep }),
    logger,
  );
  await ch.send(msg);
  assert.equal(logs.length, 2);
  assert.match(logs[1], /enviado/);
});

test('Chain of Responsibility: FallbackChain usa o próximo canal quando um falha', async () => {
  const a = new InMemoryChannel({ name: 'a', alwaysFail: true });
  const b = new InMemoryChannel({ name: 'b' });
  const c = new InMemoryChannel({ name: 'c' });
  const failures: string[] = [];
  const receipt = await new FallbackChain([a, b, c], (name) => failures.push(name)).send(msg);
  assert.equal(receipt.channel, 'b');
  assert.equal(c.attempts, 0);
  assert.deepEqual(failures, ['a']);
});

test('Chain of Responsibility: erro agregado quando todos falham', async () => {
  const chain = FallbackChain.of(
    new InMemoryChannel({ name: 'a', alwaysFail: true }),
    new InMemoryChannel({ name: 'b', alwaysFail: true }),
  );
  await assert.rejects(chain.send(msg), (e: any) => e instanceof AllChannelsFailedError && e.errors.length === 2);
});

test('Observer: listeners recebem eventos e podem cancelar a inscrição', () => {
  const bus = new NotificationEventBus();
  const received: string[] = [];
  const off = bus.on('sent', ({ receipt }) => received.push(receipt.channel));
  bus.emit('sent', { notification: msg, receipt: { channel: 'x', sentAt: new Date() } });
  off();
  bus.emit('sent', { notification: msg, receipt: { channel: 'y', sentAt: new Date() } });
  assert.deepEqual(received, ['x']);
});

test('Factory cria canais nativos e aceita tipos registrados pelo cliente', () => {
  const factory = ChannelFactory.withDefaults();
  assert.ok(factory.create('memory') instanceof InMemoryChannel);
  assert.throws(() => factory.create('pombo-correio'), ConfigurationError);

  factory.register('pombo-correio', () => new InMemoryChannel({ name: 'pombo' }));
  assert.equal(factory.create('pombo-correio').name, 'pombo');
});
