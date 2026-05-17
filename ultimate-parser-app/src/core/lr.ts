import type { Grammar, LRState, LRTables, ParseResult, ParseStep, Production, Sym } from './types';
import { END_MARKER, EPSILON } from './types';
import { productionToString } from './grammar';
import { computeFollow, computeFirstSets } from './firstFollow';
import { tokenizeInput } from './grammar';

export type LRKind = 'lr0' | 'slr1' | 'lalr1' | 'lr1';

interface LR0Item {
  prodId: number;
  dot: number;
}

interface LR1Item extends LR0Item {
  lookahead: Sym;
}

function itemKeyLR0(item: LR0Item, prods: Production[]): string {
  const p = prods[item.prodId];
  const rhs = [...p.rhs.slice(0, item.dot), '·', ...p.rhs.slice(item.dot)].join(' ');
  return `${p.lhs} -> ${rhs}`;
}

function itemKeyLR1(item: LR1Item, prods: Production[]): string {
  return `${itemKeyLR0(item, prods)}, ${item.lookahead}`;
}

function kernelLR1(items: LR1Item[]): string {
  return items
    .map((i) => `${i.prodId}:${i.dot}`)
    .sort()
    .join('|');
}

function closureLR0(items: LR0Item[], grammar: Grammar): LR0Item[] {
  const result = [...items];
  const prods = grammar.productions;
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...result]) {
      const p = prods[item.prodId];
      if (item.dot >= p.rhs.length) continue;
      const B = p.rhs[item.dot];
      if (!grammar.nonTerminals.has(B)) continue;
      for (const prod of prods) {
        if (prod.lhs !== B) continue;
        const newItem = { prodId: prod.id, dot: 0 };
        if (!result.some((i) => i.prodId === newItem.prodId && i.dot === newItem.dot)) {
          result.push(newItem);
          changed = true;
        }
      }
    }
  }
  return result.sort((a, b) => a.prodId - b.prodId || a.dot - b.dot);
}

function gotoLR0(items: LR0Item[], symbol: Sym, grammar: Grammar): LR0Item[] {
  const moved: LR0Item[] = [];
  const prods = grammar.productions;
  for (const item of items) {
    const p = prods[item.prodId];
    if (item.dot < p.rhs.length && p.rhs[item.dot] === symbol) {
      moved.push({ prodId: item.prodId, dot: item.dot + 1 });
    }
  }
  return moved.length ? closureLR0(moved, grammar) : [];
}

function closureLR1(items: LR1Item[], grammar: Grammar): LR1Item[] {
  const result = [...items];
  const prods = grammar.productions;
  const first = computeFirstSets(grammar);
  let changed = true;
  while (changed) {
    changed = false;
    for (const item of [...result]) {
      const p = prods[item.prodId];
      if (item.dot >= p.rhs.length) continue;
      const B = p.rhs[item.dot];
      if (!grammar.nonTerminals.has(B)) continue;
      const beta = p.rhs.slice(item.dot + 1);
      const lookaheads = firstOfSeq(first, beta, item.lookahead);
      for (const prod of prods) {
        if (prod.lhs !== B) continue;
        for (const la of lookaheads) {
          const newItem: LR1Item = { prodId: prod.id, dot: 0, lookahead: la };
          if (!result.some((i) => i.prodId === newItem.prodId && i.dot === 0 && i.lookahead === la)) {
            result.push(newItem);
            changed = true;
          }
        }
      }
    }
  }
  return result.sort((a, b) => a.prodId - b.prodId || a.dot - b.dot || a.lookahead.localeCompare(b.lookahead));
}

function firstOfSeq(first: Map<Sym, Set<Sym>>, seq: Sym[], extra: Sym): Set<Sym> {
  const r = new Set<Sym>();
  let eps = true;
  for (const s of seq) {
    if (s === EPSILON) continue;
    const F = first.get(s) ?? new Set([s]);
    for (const f of F) if (f !== EPSILON) r.add(f);
    if (!F.has(EPSILON)) { eps = false; break; }
  }
  if (eps) r.add(extra);
  return r;
}

function gotoLR1(items: LR1Item[], symbol: Sym, grammar: Grammar): LR1Item[] {
  const moved: LR1Item[] = [];
  const prods = grammar.productions;
  for (const item of items) {
    const p = prods[item.prodId];
    if (item.dot < p.rhs.length && p.rhs[item.dot] === symbol) {
      moved.push({ ...item, dot: item.dot + 1 });
    }
  }
  return moved.length ? closureLR1(moved, grammar) : [];
}

function buildLR0Automaton(grammar: Grammar): { states: LR0Item[][]; edges: Map<string, { sym: Sym; to: number }[]> } {
  const start: LR0Item[] = closureLR0([{ prodId: 0, dot: 0 }], grammar);
  const states: LR0Item[][] = [start];
  const edges = new Map<string, { sym: Sym; to: number }[]>();
  const stateIndex = new Map<string, number>();

  const keyOf = (items: LR0Item[]) => items.map((i) => `${i.prodId}:${i.dot}`).join(';');

  stateIndex.set(keyOf(start), 0);
  const symbols = [...grammar.terminals, ...grammar.nonTerminals].filter((s) => s !== END_MARKER && s !== EPSILON);

  let front = 0;
  while (front < states.length) {
    const I = states[front];
    const outEdges: { sym: Sym; to: number }[] = [];
    for (const sym of symbols) {
      const J = gotoLR0(I, sym, grammar);
      if (!J.length) continue;
      const k = keyOf(J);
      let idx = stateIndex.get(k);
      if (idx === undefined) {
        idx = states.length;
        states.push(J);
        stateIndex.set(k, idx);
      }
      outEdges.push({ sym, to: idx });
    }
    edges.set(String(front), outEdges);
    front++;
  }
  return { states, edges };
}

function buildLR1Automaton(grammar: Grammar): { states: LR1Item[][]; edges: Map<string, { sym: Sym; to: number }[]> } {
  const start: LR1Item[] = closureLR1([{ prodId: 0, dot: 0, lookahead: END_MARKER }], grammar);
  const states: LR1Item[][] = [start];
  const edges = new Map<string, { sym: Sym; to: number }[]>();
  const stateIndex = new Map<string, number>();

  const keyOf = (items: LR1Item[]) =>
    items.map((i) => `${i.prodId}:${i.dot}:${i.lookahead}`).sort().join(';');

  stateIndex.set(keyOf(start), 0);
  const symbols = [...grammar.terminals, ...grammar.nonTerminals].filter((s) => s !== END_MARKER && s !== EPSILON);

  let front = 0;
  while (front < states.length) {
    const I = states[front];
    const outEdges: { sym: Sym; to: number }[] = [];
    for (const sym of symbols) {
      const J = gotoLR1(I, sym, grammar);
      if (!J.length) continue;
      const k = keyOf(J);
      let idx = stateIndex.get(k);
      if (idx === undefined) {
        idx = states.length;
        states.push(J);
        stateIndex.set(k, idx);
      }
      outEdges.push({ sym, to: idx });
    }
    edges.set(String(front), outEdges);
    front++;
  }
  return { states, edges };
}

function mergeToLALR(lr1States: LR1Item[][]): { states: LR1Item[][]; map: number[] } {
  const kernels = lr1States.map((st) => kernelLR1(st));
  const kernelToLalr = new Map<string, number>();
  const lalrStates: LR1Item[][] = [];
  const map: number[] = [];

  for (let i = 0; i < lr1States.length; i++) {
    const k = kernels[i];
    let idx = kernelToLalr.get(k);
    if (idx === undefined) {
      idx = lalrStates.length;
      kernelToLalr.set(k, idx);
      const merged = new Map<string, LR1Item>();
      for (const st of lr1States.filter((_, j) => kernels[j] === k)) {
        for (const item of st) {
          const key = `${item.prodId}:${item.dot}`;
          const existing = merged.get(key);
          if (existing) {
            if (existing.lookahead !== item.lookahead) {
              existing.lookahead = [existing.lookahead, item.lookahead].sort().join('/');
            }
          } else merged.set(key, { ...item });
        }
      }
      lalrStates.push([...merged.values()].sort((a, b) => a.prodId - b.prodId || a.dot - b.dot));
    }
    map[i] = idx;
  }
  return { states: lalrStates, map };
}

export function buildLRTables(grammar: Grammar, kind: LRKind): LRTables {
  const conflicts: string[] = [];
  const action = new Map<string, string>();
  const goto = new Map<string, string>();
  const first = computeFirstSets(grammar);
  const follow = computeFollow(grammar, first);
  const prods = grammar.productions;

  let states: LR0Item[][] | LR1Item[][];
  let edges: Map<string, { sym: Sym; to: number }[]>;
  if (kind === 'lr0' || kind === 'slr1') {
    const auto = buildLR0Automaton(grammar);
    states = auto.states;
    edges = auto.edges;
  } else if (kind === 'lr1') {
    const auto = buildLR1Automaton(grammar);
    states = auto.states;
    edges = auto.edges;
  } else {
    const auto1 = buildLR1Automaton(grammar);
    const lalr = mergeToLALR(auto1.states);
    states = lalr.states;
    edges = new Map();
    for (const [from, eds] of auto1.edges) {
      const lFrom = lalr.map[Number(from)] ?? 0;
      const existing = edges.get(String(lFrom)) ?? [];
      for (const e of eds) {
        const lTo = lalr.map[e.to];
        if (!existing.some((x) => x.sym === e.sym && x.to === lTo)) {
          existing.push({ sym: e.sym, to: lTo });
        }
      }
      edges.set(String(lFrom), existing);
    }
  }

  const displayStates: LRState[] = states.map((st, id) => ({
    id,
    items: (st as LR0Item[]).map((item) => {
      if (kind === 'lr1' || kind === 'lalr1') {
        return itemKeyLR1(item as LR1Item, prods);
      }
      return itemKeyLR0(item as LR0Item, prods);
    }),
    edges: edges.get(String(id)) ?? [],
  }));

  for (let i = 0; i < states.length; i++) {
    const items = states[i];
    const out = edges.get(String(i)) ?? [];

    for (const { sym, to } of out) {
      if (grammar.nonTerminals.has(sym)) {
        const key = `${i},${sym}`;
        if (goto.has(key)) conflicts.push(`Conflicto GOTO en estado ${i}, ${sym}`);
        goto.set(key, String(to));
      } else {
        const key = `${i},${sym}`;
        const act = `s${to}`;
        if (action.has(key) && action.get(key) !== act) {
          conflicts.push(`Conflicto shift en estado ${i}, ${sym}`);
        }
        action.set(key, act);
      }
    }

    for (const item of items) {
      const p = prods[(item as LR0Item).prodId];
      const dot = (item as LR0Item).dot;
      if (dot < p.rhs.length) continue;

      if (p.lhs === grammar.augmentedStart) {
        const key = `${i},${END_MARKER}`;
        if (action.has(key) && action.get(key) !== 'acc') conflicts.push(`Conflicto accept en ${i}`);
        action.set(key, 'acc');
        continue;
      }

      const prodLabel = `r${p.id}`;

      if (kind === 'lr0') {
        for (const t of grammar.terminals) {
          if (t === END_MARKER) continue;
          const key = `${i},${t}`;
          if (action.has(key)) conflicts.push(`Reduce/Shift LR(0) en ${i}, ${t}`);
          action.set(key, prodLabel);
        }
      } else if (kind === 'slr1') {
        const fo = follow.get(p.lhs) ?? new Set();
        for (const la of fo) {
          const key = `${i},${la}`;
          if (action.has(key) && !action.get(key)!.startsWith('r')) {
            if (!action.get(key)!.startsWith('s')) conflicts.push(`Conflicto SLR en ${i}, ${la}`);
          }
          if (action.has(key) && action.get(key)!.startsWith('s')) {
            conflicts.push(`Reduce/Shift SLR en ${i}, ${la}`);
          }
          action.set(key, prodLabel);
        }
      } else {
        const laStr = (item as LR1Item).lookahead;
        const las = laStr.includes('/') ? laStr.split('/') : [laStr];
        for (const la of las) {
          const key = `${i},${la}`;
          const existing = action.get(key);
          if (existing && existing !== prodLabel && existing !== 'acc') {
            conflicts.push(`Conflicto ${kind.toUpperCase()} reduce en ${i}, ${la}`);
          }
          if (existing?.startsWith('s')) conflicts.push(`Reduce/Shift ${kind} en ${i}, ${la}`);
          action.set(key, prodLabel);
        }
      }
    }
  }

  return { action, goto, states: displayStates, conflicts };
}

export function parseLR(grammar: Grammar, input: string, kind: LRKind, tables: LRTables): ParseResult {
  const tokens = tokenizeInput(input);
  const inputSyms = [...tokens, END_MARKER];
  const steps: ParseStep[] = [];
  const stack: (number | Sym)[] = [0];
  const derivation: string[] = [];
  let ip = 0;
  let stepNum = 0;

  const stackToString = (items: (number | Sym)[]) => {
    const text = items.map(String);
    return text.join(' ');
  };

  const push = (action: string, detail: string) => {
    steps.push({
      step: stepNum++,
      stack: stackToString(stack),
      input: inputSyms.slice(ip).join(' '),
      action,
      detail,
    });
  };

  push('inicio', `Pila: estado 0 | Entrada: ${inputSyms.join(' ')}`);

  while (true) {
    const state = stack[stack.length - 1] as number;
    const a = inputSyms[ip];
    const key = `${state},${a}`;
    const act = tables.action.get(key);

    if (!act) {
      push('error', `Sin acción para estado ${state} con lookahead ${a}`);
      return { success: false, steps, message: `Error ${kind}: sin acción en [${state}, ${a}]`, derivation };
    }

    if (act.startsWith('s')) {
      const next = parseInt(act.slice(1), 10);
      stack.push(a);
      stack.push(next);
      ip++;
      push(act, `Shift: apilar ${a} e ir al estado ${next}`);
    } else if (act.startsWith('r')) {
      const pid = parseInt(act.slice(1), 10);
      const prod = grammar.productions[pid];
      const popCount = prod.rhs.filter((s) => s !== EPSILON).length * 2;
      for (let k = 0; k < popCount; k++) stack.pop();
      const top = stack[stack.length - 1] as number;
      const gotoKey = `${top},${prod.lhs}`;
      const g = tables.goto.get(gotoKey);
      if (!g) {
        push('error', `GOTO[${top}, ${prod.lhs}] indefinido`);
        return { success: false, steps, message: `Error: GOTO indefinido`, derivation };
      }
      stack.push(prod.lhs);
      stack.push(parseInt(g, 10));
      derivation.push(productionToString(prod));
      push(act, `Reduce: ${productionToString(prod)} → GOTO ${g}`);
    } else if (act === 'acc') {
      push('acc', 'Aceptar');
      return { success: true, steps, message: `Cadena aceptada (${kind.toUpperCase()})`, derivation };
    }
  }
}

export function runLR(grammar: Grammar, input: string, kind: LRKind): ParseResult & { tables: LRTables } {
  const tables = buildLRTables(grammar, kind);
  const result = parseLR(grammar, input, kind, tables);
  return { ...result, tables };
}
