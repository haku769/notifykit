/**
 * PADRÃO STRATEGY: algoritmo de renderização de textos.
 * O cliente pode trocar o motor padrão por Handlebars, Mustache, EJS etc.
 */
export interface TemplateEngine {
  render(template: string, data: Record<string, unknown>): string;
}

export interface SimpleTemplateEngineOptions {
  /** Se true, lança erro quando uma variável não existe. Padrão: false (troca por ''). */
  strict?: boolean;
}

/**
 * Motor de template pronto para uso: troca `{{ variavel }}` e `{{ objeto.campo }}`
 * pelos valores de `data`.
 */
export class SimpleTemplateEngine implements TemplateEngine {
  private static readonly PATTERN = /\{\{\s*([\w.]+)\s*\}\}/g;

  constructor(private readonly options: SimpleTemplateEngineOptions = {}) {}

  render(template: string, data: Record<string, unknown>): string {
    return template.replace(SimpleTemplateEngine.PATTERN, (_match, path: string) => {
      const value = path
        .split('.')
        .reduce<unknown>(
          (acc, key) => (acc != null && typeof acc === 'object' ? (acc as any)[key] : undefined),
          data,
        );
      if (value === undefined || value === null) {
        if (this.options.strict) throw new Error(`Variável de template ausente: "${path}"`);
        return '';
      }
      return String(value);
    });
  }
}
