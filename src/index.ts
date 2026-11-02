// Núcleo
export * from './core/Notification';
export * from './core/NotificationChannel';
export * from './core/NotificationBuilder';
export * from './core/errors';

// Canais prontos
export * from './channels/ConsoleChannel';
export * from './channels/InMemoryChannel';
export * from './channels/WebhookChannel';
export * from './channels/SlackChannel';
export * from './channels/EmailChannel';

// Templates
export * from './templates/TemplateEngine';

// Retry
export * from './retry/RetryPolicy';

// Decorators
export * from './decorators/ChannelDecorator';
export * from './decorators/RetryChannel';
export * from './decorators/LoggingChannel';

// Fallback
export * from './chain/FallbackChain';

// Eventos
export * from './events/NotificationEvents';

// Fábrica
export * from './factory/ChannelFactory';

// Fachada
export * from './Notifier';
