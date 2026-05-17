import type { Grammar, LL1Table, LRTables, ParseResult, ParserKind } from './types';
import { runLL1 } from './ll1';
import { runRecursiveDescent } from './recursiveDescent';
import { runLR, type LRKind } from './lr';

export type AnalysisOutput = ParseResult & {
  ll1Table?: LL1Table;
  first?: Map<string, Set<string>>;
  follow?: Map<string, Set<string>>;
  lrTables?: LRTables;
  conflicts: string[];
};

export function runAnalysis(grammar: Grammar, input: string, parser: ParserKind): AnalysisOutput {
  switch (parser) {
    case 'recursive-descent': {
      const r = runRecursiveDescent(grammar, input);
      const ll = runLL1(grammar, input);
      return { ...r, conflicts: ll.table.conflicts, first: ll.first, follow: ll.follow, ll1Table: ll.table };
    }
    case 'll1': {
      const ll = runLL1(grammar, input);
      return { ...ll, conflicts: ll.table.conflicts, ll1Table: ll.table };
    }
    case 'lr0':
    case 'slr1':
    case 'lalr1':
    case 'lr1': {
      const lr = runLR(grammar, input, parser as LRKind);
      return { ...lr, conflicts: lr.tables.conflicts, lrTables: lr.tables };
    }
    default:
      return { success: false, steps: [], message: 'Parser desconocido', conflicts: [] };
  }
}
