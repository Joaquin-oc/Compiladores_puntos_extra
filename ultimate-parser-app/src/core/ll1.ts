import type { Grammar, LL1Table, ParseResult, ParseStep, ParseTreeNode, Production, Sym } from './types';
import { END_MARKER, EPSILON } from './types';
import { productionToString } from './grammar';
import { computeFirstSets, computeFollow, firstOfString, isLL1 } from './firstFollow';
import { tokenizeInput } from './grammar';

export function buildLL1Table(grammar: Grammar): LL1Table & { first: Map<Sym, Set<Sym>>; follow: Map<Sym, Set<Sym>> } {
  const first = computeFirstSets(grammar);
  const follow = computeFollow(grammar, first);
  const conflicts = isLL1(grammar, first, follow);
  const table = new Map<string, { prod: Production; action: 'predict' }>();

  for (const p of grammar.productions) {
    if (p.lhs === grammar.augmentedStart) continue;
    const firstAlpha = firstOfString(first, p.rhs);
    for (const a of firstAlpha) {
      if (a === EPSILON) continue;
      const key = `${p.lhs},${a}`;
      if (table.has(key)) {
        conflicts.push(`Conflicto en M[${p.lhs}, ${a}]`);
      } else {
        table.set(key, { prod: p, action: 'predict' });
      }
    }
    if (firstAlpha.has(EPSILON)) {
      const fo = follow.get(p.lhs) ?? new Set();
      for (const b of fo) {
        const key = `${p.lhs},${b}`;
        if (table.has(key)) conflicts.push(`Conflicto en M[${p.lhs}, ${b}] (ε)`);
        else table.set(key, { prod: p, action: 'predict' });
      }
    }
  }
  return { table, conflicts, first, follow };
}

export function parseLL1(
  grammar: Grammar,
  inputTokens: Sym[],
  tableData: LL1Table,
): ParseResult {
  const steps: ParseStep[] = [];
  const tokens = [...inputTokens, END_MARKER];
  const stack: Sym[] = [END_MARKER, grammar.startSymbol];
  let ip = 0;
  let stepNum = 0;
  const derivation: string[] = [];
  let treeRoot: ParseTreeNode | null = null;
  const nodeStack: ParseTreeNode[] = [];

  const pushStep = (action: string, detail: string) => {
    steps.push({
      step: stepNum++,
      stack: [...stack].reverse().join(' '),
      input: tokens.slice(ip).join(' '),
      action,
      detail,
    });
  };

  pushStep('inicio', 'Inicializar pila con $ y símbolo inicial');

  while (stack.length > 0) {
    const X = stack[stack.length - 1];
    const a = tokens[ip];

    if (grammar.terminals.has(X) || X === END_MARKER) {
      if (X === a) {
        if (X === END_MARKER) {
          pushStep('aceptar', 'Entrada consumida completamente');
          return { success: true, steps, message: 'Cadena aceptada (LL(1))', tree: treeRoot ?? undefined, derivation };
        }
        stack.pop();
        if (nodeStack.length) nodeStack.pop();
        ip++;
        pushStep(`coincidir ${a}`, `Terminal ${a} coincide con entrada`);
      } else {
        pushStep('error', `Se esperaba ${X} pero se encontró ${a}`);
        return { success: false, steps, message: `Error: esperado ${X}, encontrado ${a}`, derivation };
      }
    } else {
      const key = `${X},${a}`;
      const entry = tableData.table.get(key);
      if (!entry) {
        pushStep('error', `No hay entrada M[${X}, ${a}]`);
        return { success: false, steps, message: `Error LL(1): sin entrada para [${X}, ${a}]`, derivation };
      }
      const prod = entry.prod;
      stack.pop();
      const node: ParseTreeNode = { symbol: X, children: [], isTerminal: false };
      if (nodeStack.length) nodeStack[nodeStack.length - 1].children.unshift(node);
      else treeRoot = node;

      const rhsSyms = prod.rhs.filter((s) => s !== EPSILON);
      if (rhsSyms.length === 0) {
        node.children.push({ symbol: EPSILON, children: [], isTerminal: true });
      } else {
        for (let i = rhsSyms.length - 1; i >= 0; i--) {
          stack.push(rhsSyms[i]);
          const child: ParseTreeNode = {
            symbol: rhsSyms[i],
            children: [],
            isTerminal: grammar.terminals.has(rhsSyms[i]),
          };
          node.children.unshift(child);
          if (!child.isTerminal) nodeStack.push(child);
        }
      }
      nodeStack.push(node);
      const derivLine = productionToString(prod);
      derivation.push(derivLine);
      pushStep(`predecir`, `Aplicar ${derivLine}`);
    }
  }

  return { success: false, steps, message: 'Error inesperado', derivation };
}

export function runLL1(grammar: Grammar, input: string): ParseResult & { table: LL1Table; first: Map<Sym, Set<Sym>>; follow: Map<Sym, Set<Sym>> } {
  const built = buildLL1Table(grammar);
  const tokens = tokenizeInput(input);
  const result = parseLL1(grammar, tokens, built);
  return { ...result, table: built, first: built.first, follow: built.follow };
}
