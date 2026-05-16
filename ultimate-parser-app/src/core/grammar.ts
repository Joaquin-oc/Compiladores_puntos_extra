import type { Grammar, Production, Sym } from './types';
import { END_MARKER, EPSILON } from './types';

const EPS_ALIASES = new Set(['ε', 'epsilon', 'eps', 'λ']);

export function isEpsilon(sym: Sym): boolean {
  return EPS_ALIASES.has(sym.trim());
}

export function tokenizeInput(input: string): Sym[] {
  const trimmed = input.trim();
  if (!trimmed) return [];
  return trimmed.split(/\s+/).map((t) => t.trim()).filter(Boolean);
}

export function parseGrammarText(text: string): { grammar: Grammar; errors: string[] } {
  const errors: string[] = [];
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && !l.startsWith('//'));

  if (lines.length === 0) {
    return { grammar: emptyGrammar(), errors: ['La gramática está vacía.'] };
  }

  const rawProductions: { lhs: Sym; rhs: Sym[] }[] = [];
  let startSymbol: Sym | null = null;

  for (const line of lines) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_'-]*)\s*(?:->|→|::=)\s*(.+)$/);
    if (!match) {
      errors.push(`Línea inválida: "${line}"`);
      continue;
    }
    const lhs = match[1];
    if (!startSymbol) startSymbol = lhs;

    const alts = splitAlternatives(match[2]);
    for (const alt of alts) {
      const symbols = alt
        .trim()
        .split(/\s+/)
        .filter((s) => s.length > 0)
        .map((s) => (isEpsilon(s) ? EPSILON : s));
      rawProductions.push({ lhs, rhs: symbols.length ? symbols : [EPSILON] });
    }
  }

  if (!startSymbol || rawProductions.length === 0) {
    return { grammar: emptyGrammar(), errors: errors.length ? errors : ['No se encontraron producciones.'] };
  }

  const nonTerminals = new Set(rawProductions.map((p) => p.lhs));
  const allSymbols = new Set<Sym>();
  for (const p of rawProductions) {
    allSymbols.add(p.lhs);
    p.rhs.forEach((s) => allSymbols.add(s));
  }

  const terminals = new Set<Sym>();
  for (const s of allSymbols) {
    if (!nonTerminals.has(s) && s !== EPSILON) terminals.add(s);
  }
  terminals.add(END_MARKER);

  const augmentedStart = `${startSymbol}'`;
  const productions: Production[] = [
    { lhs: augmentedStart, rhs: [startSymbol], id: 0 },
    ...rawProductions.map((p, i) => ({ ...p, id: i + 1 })),
  ];

  return {
    grammar: {
      productions,
      startSymbol,
      augmentedStart,
      nonTerminals: new Set([augmentedStart, ...nonTerminals]),
      terminals,
    },
    errors,
  };
}

function splitAlternatives(body: string): string[] {
  const parts: string[] = [];
  let current = '';
  let depth = 0;
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if ((ch === '|' || ch === '¦') && depth === 0) {
      parts.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) parts.push(current.trim());
  return parts;
}

function emptyGrammar(): Grammar {
  return {
    productions: [],
    startSymbol: 'S',
    augmentedStart: "S'",
    nonTerminals: new Set(),
    terminals: new Set(),
  };
}

export function grammarToText(grammar: Grammar): string {
  const byLhs = new Map<Sym, Sym[][]>();
  for (const p of grammar.productions) {
    if (p.lhs === grammar.augmentedStart) continue;
    const list = byLhs.get(p.lhs) ?? [];
    list.push(p.rhs);
    byLhs.set(p.lhs, list);
  }
  const lines: string[] = [];
  for (const [lhs, alts] of byLhs) {
    const altStr = alts
      .map((rhs) => rhs.map((s) => (s === EPSILON ? EPSILON : s)).join(' '))
      .join(' | ');
    lines.push(`${lhs} -> ${altStr}`);
  }
  return lines.join('\n');
}

export function productionToString(p: Production): string {
  const rhs = p.rhs.map((s) => (s === EPSILON ? EPSILON : s)).join(' ');
  return `${p.lhs} -> ${rhs || EPSILON}`;
}
