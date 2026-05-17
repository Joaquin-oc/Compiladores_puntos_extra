import type { Grammar, ParseResult, ParserKind } from '../core/types';

export function explainParseError(
  result: ParseResult,
  parser: ParserKind,
  _grammar: Grammar,
): string {
  if (result.success) {
    return `✓ La cadena fue aceptada por el analizador **${parserLabel(parser)}**. Se ejecutaron ${result.steps.length} pasos.`;
  }

  const last = result.steps[result.steps.length - 1];
  const lines: string[] = [
    `## Diagnóstico inteligente`,
    ``,
    `El analizador **${parserLabel(parser)}** rechazó la entrada.`,
    ``,
    `**Mensaje:** ${result.message}`,
  ];

  if (last) {
    lines.push(``, `**Último paso:**`, `- Pila: \`${last.stack}\``, `- Entrada restante: \`${last.input}\``, `- Acción: \`${last.action}\``);
  }

  if (parser === 'll1' || parser === 'recursive-descent') {
    lines.push(
      ``,
      `### Posibles causas (LL/Descenso)`,
      `- El símbolo en la cima de la pila no coincide con el siguiente token de entrada.`,
      `- La tabla predictiva no tiene entrada para el par [no-terminal, lookahead] actual — la gramática puede no ser LL(1).`,
      `- Revise conflictos en FIRST/FOLLOW o elimine ambigüedades.`,
    );
  } else {
    lines.push(
      ``,
      `### Posibles causas (LR)`,
      `- Conflicto shift/reduce o reduce/reduce en la tabla ACTION.`,
      `- La cadena no pertenece al lenguaje generado por la gramática.`,
      `- Para LR(0), considere SLR(1) o LALR(1) si hay demasiados conflictos.`,
    );
  }

  return lines.join('\n');
}

export function suggestLL1Transformations(grammarText: string, conflicts: string[]): string[] {
  const tips: string[] = [];
  if (conflicts.length === 0) {
    tips.push('La gramática parece compatible con LL(1). No se requieren transformaciones urgentes.');
    return tips;
  }
  tips.push('**Eliminación de ambigüedad por precedencia:** Si hay expresiones aritméticas, reescriba usando niveles: E → E + T | T, T → T * F | F, F → id.');
  tips.push('**Eliminación de recursión izquierda:** Reemplace A → Aα | β por A → βA\', A\' → αA\' | ε.');
  tips.push('**Factorización izquierda:** Si A → αβ₁ | αβ₂, use A → αA\', A\' → β₁ | β₂.');
  if (grammarText.includes('|') && grammarText.split('|').length > 3) {
    tips.push('Detectamos muchas alternativas; considere introducir no-terminales intermedios.');
  }
  tips.push(`Conflictos detectados: ${conflicts.length}. Revise cada par de producciones que comparten FIRST.`);
  return tips;
}

export function suggestAmbiguityFixes(conflicts: string[]): string {
  if (!conflicts.length) return 'No se detectaron conflictos evidentes en las tablas construidas.';
  return [
    '### Recomendaciones para gramáticas ambiguas',
    ...conflicts.slice(0, 5).map((c) => `- ${c}`),
    conflicts.length > 5 ? `- … y ${conflicts.length - 5} conflictos más` : '',
    '',
    '**Sugerencia:** Use una gramática no ambigua o aplique precedencia/associatividad en el analizador LR.',
  ]
    .filter(Boolean)
    .join('\n');
}

function parserLabel(p: ParserKind): string {
  const labels: Record<ParserKind, string> = {
    'recursive-descent': 'Descenso Recursivo',
    ll1: 'LL(1)',
    lr0: 'LR(0)',
    slr1: 'SLR(1)',
    lalr1: 'LALR(1)',
    lr1: 'LR(1)',
  };
  return labels[p];
}
