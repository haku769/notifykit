import { DeliveryReceipt, Notification } from '../core/Notification';

/** Eventos emitidos pelo Notifier e o formato do payload de cada um. */
export interface NotificationEventMap {
  /** Entrega concluída com sucesso. */
  sent: { notification: Notification; receipt: DeliveryReceipt };
  /** Um canal falhou (dentro de um fallback, o próximo ainda pode dar certo). */
  attemptFailed: { notification: Notification; channel: string; error: Error };
  /** Envio falhou de vez. */
  failed: { notification: Notification; channel: string; error: Error };
}

export type NotificationEvent = keyof NotificationEventMap;
export type Listener<E extends NotificationEvent> = (payload: NotificationEventMap[E]) => void;

/**
 * PADRÃO OBSERVER: o Notifier (sujeito) avisa os interessados (observadores)
 * sobre o que acontece nos envios, sem conhecê-los.
 *
 * O cliente pluga métricas, auditoria ou alertas com `on(...)`, sem estender classes
 * nem alterar o fluxo de envio. Um erro dentro de um listener não derruba o envio.
 */
export class NotificationEventBus {
  private readonly listeners = new Map<NotificationEvent, Set<Listener<any>>>();

  /** Inscreve um listener. Retorna uma função que cancela a inscrição. */
  on<E extends NotificationEvent>(event: E, listener: Listener<E>): () => void {
    let set = this.listeners.get(event);
    if (!set) this.listeners.set(event, (set = new Set()));
    set.add(listener);
    return () => set.delete(listener);
  }

  emit<E extends NotificationEvent>(event: E, payload: NotificationEventMap[E]): void {
    this.listeners.get(event)?.forEach((listener) => {
      try {
        listener(payload);
      } catch (error) {
        console.error(`[notifykit] erro em listener de "${event}":`, error);
      }
    });
  }
}
