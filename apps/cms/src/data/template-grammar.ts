export interface UrlGrammarPart {
  order: number;
  key: string;
  label: string;
  kind: 'domain' | 'static' | 'variable';
}

const VARIABLE_SEGMENT = /^\{([^{}]+)\}$/;

export function parseUrlGrammar(domain: string, pattern: string): UrlGrammarPart[] {
  const pathParts = pattern
    .split('/')
    .filter(Boolean)
    .map((segment, index): UrlGrammarPart => {
      const variableMatch = VARIABLE_SEGMENT.exec(segment);
      const variableKey = variableMatch?.[1];
      return {
        order: index + 1,
        key: variableKey ?? `static-${index + 1}`,
        label: variableKey ?? segment,
        kind: variableKey ? 'variable' : 'static',
      };
    });

  return [{ order: 0, key: 'domain', label: domain, kind: 'domain' }, ...pathParts];
}
