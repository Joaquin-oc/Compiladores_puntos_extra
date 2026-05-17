import type { Grammar, ParseResult, ParseStep, ParseTreeNode, Sym } from './types';
import { EPSILON } from './types';
import { tokenizeInput } from './grammar';
import { buildLL1Table, parseLL1 } from './ll1';

/** Descenso recursivo guiado por la misma tabla LL(1) — equivalente predictivo con trazas nombradas. */
export function runRecursiveDescent(grammar: Grammar, input: string): ParseResult {
  const built = buildLL1Table(grammar);
  const tokens = tokenizeInput(input);
  const base = parseLL1(grammar, tokens, built);

  const renamed: ParseStep[] = base.steps.map((s, i) => ({
    ...s,
    step: i,
    action: s.action.replace('predecir', 'expandir').replace('coincidir', 'match'),
    detail: s.detail.replace('Aplicar', 'expandir() →').replace('Terminal', 'match()'),
  }));

  if (renamed.length > 0) {
    renamed[0] = {
      ...renamed[0],
      detail: `Descenso recursivo sobre ${grammar.startSymbol}() — ${renamed[0].detail}`,
    };
  }

  return {
    ...base,
    steps: renamed,
    message: base.success ? 'Cadena aceptada (Descenso Recursivo)' : base.message.replace('LL(1)', 'Descenso Recursivo'),
  };
}

export function generateRecursiveFunctions(grammar: Grammar): string {
  const byNt = new Map<Sym, string[]>();
  for (const p of grammar.productions) {
    if (p.lhs === grammar.augmentedStart) continue;
    const alts = byNt.get(p.lhs) ?? [];
    const rhs = p.rhs.filter((s) => s !== EPSILON).join(' ') || EPSILON;
    alts.push(rhs);
    byNt.set(p.lhs, alts);
  }
  const lines: string[] = ['// Pseudocódigo — descenso recursivo'];
  for (const [nt, alts] of byNt) {
    lines.push(`void ${nt}() {`);
    lines.push(`  // ${alts.map((a, i) => `alt ${i + 1}: ${a}`).join(' | ')}`);
    lines.push(`  if (/* FIRST sets */) { ... }`);
    lines.push(`  else error("símbolo inesperado");`);
    lines.push(`}\n`);
  }
  return lines.join('\n');
}

export function treeToDerivation(root: ParseTreeNode | undefined): string[] {
  if (!root) return [];
  const steps: string[] = [];
  const walk = (node: ParseTreeNode, prefix: Sym[]) => {
    if (!node.isTerminal && node.children.length) {
      const nonEps = node.children.filter((c) => c.symbol !== EPSILON);
      if (nonEps.length) {
        const next = [...prefix.slice(0, -1), node.symbol, ...nonEps.map((c) => c.symbol)];
        steps.push(next.join(' '));
        for (const c of nonEps) walk(c, next);
      }
    }
  };
  walk(root, [root.symbol]);
  return steps;
}
