import type { LRState } from '../core/types';

export function lrAutomatonToDot(states: LRState[]): string {
  const lines = ['digraph LRAutomaton {', '  rankdir=LR;', '  node [shape=box, fontname=Helvetica];'];
  for (const st of states) {
    const label = `I${st.id}\\\\n${st.items.map((i) => i.replace('·', '•')).join('\\\\n')}`;
    lines.push(`  s${st.id} [label="${label}"];`);
    for (const e of st.edges) {
      lines.push(`  s${st.id} -> s${e.to} [label="${e.sym}"];`);
    }
  }
  lines.push('}');
  return lines.join('\n');
}

export function lrAutomatonToMermaid(states: LRState[]): string {
  const escapeLabel = (text: string) =>
    text
      .replace(/"/g, '&quot;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/\n/g, '<br/>');

  const lines = ['graph LR', '  classDef state fill:#0f172a,stroke:#334155,stroke-width:1px,color:#cbd5e1;'];

  for (const st of states) {
    const label = escapeLabel(`I${st.id}\n${st.items.map((i) => i.replace('·', '•')).join('\n')}`);
    lines.push(`  s${st.id}["${label}"]`);
  }

  for (const st of states) {
    for (const e of st.edges) {
      const sym = escapeLabel(e.sym);
      lines.push(`  s${st.id} --|${sym}|--> s${e.to}`);
    }
  }

  return lines.join('\n');
}

export function treeToDot(node: { symbol: string; children: { symbol: string; children: unknown[]; isTerminal: boolean }[]; isTerminal: boolean }, id = 'n0'): { dot: string; nextId: number } {
  let counter = parseInt(id.slice(1), 10) + 1;
  const edges: string[] = [];
  const nodes: string[] = [`  ${id} [label="${node.symbol}"];`];
  for (const child of node.children) {
    const cid = `n${counter++}`;
    nodes.push(`  ${cid} [label="${child.symbol}"];`);
    edges.push(`  ${id} -> ${cid};`);
    if (child.children?.length) {
      const sub = treeToDot(child as typeof node, cid);
      nodes.push(...sub.dot.split('\n').filter((l) => l.trim() && !l.startsWith('digraph')));
      counter = sub.nextId;
    }
  }
  return { dot: [...nodes, ...edges].join('\n'), nextId: counter };
}

export function parseTreeToDot(root: { symbol: string; children: { symbol: string; children: unknown[]; isTerminal: boolean }[]; isTerminal: boolean } | undefined): string {
  if (!root) return 'digraph G { empty [label="sin árbol"]; }';
  const body = treeToDot(root);
  return `digraph ParseTree {\n  node [shape=circle];\n${body.dot}\n}`;
}
