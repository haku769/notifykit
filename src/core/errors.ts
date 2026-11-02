/** Erro base da biblioteca. */
export class NotifyKitError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = new.target.name;
  }
}

/** Erro lançado quando um canal não consegue entregar uma notificação. */
export class DeliveryError extends NotifyKitError {
  constructor(
    public readonly channel: string,
    message: string,
    options?: { cause?: unknown; retryable?: boolean },
  ) {
    super(`[${channel}] ${message}`, options);
    this.retryable = options?.retryable ?? true;
  }

  /** Indica se faz sentido tentar novamente (ex.: timeout sim, destinatário inválido não). */
  public readonly retryable: boolean;
}

/** Lançado quando um canal não sabe atender o destinatário (ex.: e-mail sem endereço). */
export class UnsupportedRecipientError extends DeliveryError {
  constructor(channel: string, reason: string) {
    super(channel, `destinatário não suportado: ${reason}`, { retryable: false });
  }
}

/** Lançado pela cadeia de fallback quando todos os canais falharam. */
export class AllChannelsFailedError extends NotifyKitError {
  constructor(public readonly errors: readonly Error[]) {
    super(
      `Todos os canais falharam:\n${errors.map((e) => `  - ${e.message}`).join('\n')}`,
    );
  }
}

/** Erros de configuração (canal não registrado, notificação inválida etc.). */
export class ConfigurationError extends NotifyKitError {}
