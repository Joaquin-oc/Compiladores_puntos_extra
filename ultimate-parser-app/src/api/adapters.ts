import type { Grammar, LL1Table, LRState, LRTables, ParseResult, ParseStep, ParseTreeNode, Production, Sym } from '../core/types';

type ApiResponse<T> = { success: boolean; data?: T; error?: string };

type BackendStep = {
  step: number;
  action: string;
  description: string;
  stack: string[] | string;
  input_remaining?: string[];
  input?: string[];
};

type BackendParse = {
  accepted: boolean;
  error?: string | null;
  steps: BackendStep[];
  tree?: BackendTree | null;
  metadata?: Record<string, unknown>;
  tokens?: string[];
};

type BackendTree = {
  symbol: string;
  value?: string;
  children?: BackendTree[];
};

type BackendLRAction = { kind: string; value?: number | null };

export function adaptApiResponse<T>(raw: ApiResponse<T>): T {
  if (!raw.success) throw new Error(raw.error ?? 'Error en la API');
  if (raw.data === undefined) throw new Error('Respuesta vacía del servidor');
  return raw.data;
}

function joinStack(stack: string[] | string): string {
  if (!Array.isArray(stack)) return String(stack);
  return stack.join(' ');
}

function joinInput(step: BackendStep): string {
  const rem = step.input_remaining ?? step.input;
  return Array.isArray(rem) ? rem.join(' ') : '';
}

export function adaptSteps(steps: BackendStep[]): ParseStep[] {
  return steps.map((s) => ({
    step: s.step,
    stack: joinStack(s.stack),
    input: joinInput(s),
    action: s.action,
    detail: s.description,
  }));
}

export function adaptTree(node: BackendTree | null | undefined): ParseTreeNode | undefined {
  if (!node) return undefined;
  if (node.children?.length) {
    return {
      symbol: node.symbol,
      children: node.children.map((c) => adaptTree(c)!),
      isTerminal: false,
    };
  }
  return { symbol: node.symbol, children: [], isTerminal: true };
}

export function adaptParseResult(raw: BackendParse): ParseResult {
  const success = raw.accepted;
  return {
    success,
    steps: adaptSteps(raw.steps ?? []),
    message: success
      ? 'Cadena aceptada'
      : (raw.error ?? 'La cadena fue rechazada'),
    tree: adaptTree(raw.tree),
  };
}

function formatLRAction(act: BackendLRAction | string): string {
  if (typeof act === 'string') return act;
  if (act.kind === 'shift' && act.value != null) return `s${act.value}`;
  if (act.kind === 'reduce' && act.value != null) return `r${act.value}`;
  if (act.kind === 'accept') return 'acc';
  return act.kind;
}

export function adaptLRTables(meta: Record<string, unknown>): LRTables | undefined {
  const tables = meta.tables as Record<string, unknown> | undefined;
  const automaton = meta.automaton as { states?: string[]; edges?: { from: number; to: number; symbol: string }[] } | undefined;
  if (!tables) return undefined;

  const action = new Map<string, string>();
  const rawAction = tables.action as Record<string, BackendLRAction | string> | undefined;
  if (rawAction) {
    for (const [k, v] of Object.entries(rawAction)) {
      action.set(k, formatLRAction(v));
    }
  }

  const goto = new Map<string, string>();
  const rawGoto = tables.goto as Record<string, number | string> | undefined;
  if (rawGoto) {
    for (const [k, v] of Object.entries(rawGoto)) {
      goto.set(k, String(v));
    }
  }

  const labels = (tables.state_items as string[] | undefined) ?? automaton?.states ?? [];
  const edges = automaton?.edges ?? [];
  const states: LRState[] = labels.map((label, id) => ({
    id,
    items: label.split('\n').filter(Boolean),
    edges: edges.filter((e) => e.from === id).map((e) => ({ sym: e.symbol as Sym, to: e.to })),
  }));

  return {
    action,
    goto,
    states,
    conflicts: (tables.conflicts as string[]) ?? [],
  };
}

function findProduction(grammar: Grammar, lhs: string, rhs: string[]): Production {
  const found = grammar.productions.find(
    (p) => p.lhs === lhs && p.rhs.length === rhs.length && p.rhs.every((s, i) => s === rhs[i]),
  );
  return found ?? { lhs, rhs, id: -1 };
}

export function adaptLL1FromMeta(
  grammar: Grammar,
  meta: Record<string, unknown>,
): (LL1Table & { first: Map<Sym, Set<Sym>>; follow: Map<Sym, Set<Sym>> }) | null {
  const tableRaw = meta.table as {
    entries?: { nonterminal: string; terminal: string; rhs: string[] }[];
    conflicts?: string[];
  } | undefined;
  if (!tableRaw?.entries) return null;

  const table = new Map<string, { prod: Production; action: 'predict' }>();
  for (const e of tableRaw.entries) {
    const prod = findProduction(grammar, e.nonterminal, e.rhs ?? []);
    table.set(`${e.nonterminal},${e.terminal}`, { prod, action: 'predict' });
  }

  const firstObj = meta.first as Record<string, string[]> | undefined;
  const followObj = meta.follow as Record<string, string[]> | undefined;
  const first = new Map(
    Object.entries(firstObj ?? {}).map(([k, v]) => [k, new Set(v)] as const),
  );
  const follow = new Map(
    Object.entries(followObj ?? {}).map(([k, v]) => [k, new Set(v)] as const),
  );

  return {
    table,
    conflicts: tableRaw.conflicts ?? [],
    first,
    follow,
  };
}

export function setsFromAnalyze(data: {
  first: Record<string, string[]>;
  follow: Record<string, string[]>;
  ll1_conflicts?: string[];
}): { first: Map<Sym, Set<Sym>>; follow: Map<Sym, Set<Sym>>; conflicts: string[] } {
  return {
    first: new Map(Object.entries(data.first).map(([k, v]) => [k, new Set(v)] as const)),
    follow: new Map(Object.entries(data.follow).map(([k, v]) => [k, new Set(v)] as const)),
    conflicts: data.ll1_conflicts ?? [],
  };
}
