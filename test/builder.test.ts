import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ConfigurationError, NotificationBuilder, SimpleTemplateEngine, notification } from '../src';

test('Builder monta notificação e renderiza o template', () => {
  const n = notification()
    .to({ name: 'Ana', email: 'ana@x.com' })
    .subject('Oi {{ to.name }}')
    .body('Pedido {{ pedido.id }} enviado')
    .data({ pedido: { id: 42 } })
    .priority('high')
    .metadata('origem', 'teste')
    .build();

  assert.equal(n.subject, 'Oi Ana');
  assert.equal(n.body, 'Pedido 42 enviado');
  assert.equal(n.priority, 'high');
  assert.equal(n.metadata.origem, 'teste');
  assert.ok(Object.isFrozen(n));
});

test('Builder aceita string como destinatário', () => {
  assert.equal(notification().to('a@b.com').body('x').build().to.email, 'a@b.com');
  assert.equal(notification().to('user-1').body('x').build().to.userId, 'user-1');
});

test('Builder valida campos obrigatórios', () => {
  assert.throws(() => notification().body('x').build(), ConfigurationError);
  assert.throws(() => notification().to('a@b.com').build(), ConfigurationError);
});

test('Builder aceita motor de template customizado', () => {
  const upper = { render: (t: string) => t.toUpperCase() };
  const n = new NotificationBuilder().templateEngine(upper).to('a@b.com').body('oi').build();
  assert.equal(n.body, 'OI');
});

test('SimpleTemplateEngine em modo estrito lança erro em variável ausente', () => {
  const engine = new SimpleTemplateEngine({ strict: true });
  assert.throws(() => engine.render('{{ nada }}', {}));
  assert.equal(new SimpleTemplateEngine().render('[{{ nada }}]', {}), '[]');
});
