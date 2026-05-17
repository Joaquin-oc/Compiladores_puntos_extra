export type Sym = string;

export interface Production {
  lhs: Sym;
  rhs: Sym[];
  id: number;
}

export interface Grammar {
  productions: Production[];
  startSymbol: Sym;
  augmentedStart: Sym;
  nonTerminals: Set<Sym>;
  terminals: Set<Sym>;
}

export const EPSILON = 'ε';
export const END_MARKER = '$';

export interface ParseStep {
  step: number;
  stack: string;
  input: string;
  action: string;
  detail: string;
}

export interface ParseResult {
  success: boolean;
  steps: ParseStep[];
  message: string;
  tree?: ParseTreeNode;
  derivation?: string[];
}

export interface ParseTreeNode {
  symbol: Sym;
  children: ParseTreeNode[];
  isTerminal: boolean;
}

export type ParserKind =
  | 'recursive-descent'
  | 'll1'
  | 'lr0'
  | 'slr1'
  | 'lalr1'
  | 'lr1';

export interface LL1Table {
  table: Map<string, { prod: Production; action: 'predict' }>;
  conflicts: string[];
}

export interface LRTables {
  action: Map<string, string>;
  goto: Map<string, string>;
  states: LRState[];
  conflicts: string[];
}

export interface LRState {
  id: number;
  items: string[];
  edges: { sym: Sym; to: number }[];
}

export interface AnalysisSnapshot {
  id: string;
  timestamp: number;
  parser: ParserKind;
  grammar: string;
  input: string;
  success: boolean;
}
