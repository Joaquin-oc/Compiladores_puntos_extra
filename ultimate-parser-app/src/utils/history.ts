import type { AnalysisSnapshot, ParserKind } from '../core/types';

const KEY = 'ultimate-parser-history';

export function loadHistory(): AnalysisSnapshot[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as AnalysisSnapshot[]) : [];
  } catch {
    return [];
  }
}

export function saveToHistory(entry: Omit<AnalysisSnapshot, 'id' | 'timestamp'>): void {
  const list = loadHistory();
  const snap: AnalysisSnapshot = {
    ...entry,
    id: crypto.randomUUID(),
    timestamp: Date.now(),
  };
  list.unshift(snap);
  localStorage.setItem(KEY, JSON.stringify(list.slice(0, 50)));
}

export function clearHistory(): void {
  localStorage.removeItem(KEY);
}

export function parserName(p: ParserKind): string {
  const m: Record<ParserKind, string> = {
    'recursive-descent': 'Descenso Recursivo',
    ll1: 'LL(1)',
    lr0: 'LR(0)',
    slr1: 'SLR(1)',
    lalr1: 'LALR(1)',
    lr1: 'LR(1)',
  };
  return m[p];
}
