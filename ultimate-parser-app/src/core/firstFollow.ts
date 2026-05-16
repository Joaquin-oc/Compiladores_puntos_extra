import type { Grammar, Sym } from './types';
import { EPSILON, END_MARKER } from './types';
import { isEpsilon } from './grammar';

function addFirstOfSequence(first: Map<Sym, Set<Sym>>, seq: Sym[], into: Set<Sym>): void {
  let allEps = true;
  for (const sym of seq) {
    if (sym === EPSILON || isEpsilon(sym)) continue;
    const Fs = first.get(sym) ?? new Set([sym]);
    for (const f of Fs) {
      if (f !== EPSILON) into.add(f);
    }
    if (!Fs.has(EPSILON)) {
      allEps = false;
      break;
    }
  }
  if (allEps) into.add(EPSILON);
}

export function computeFirstSets(grammar: Grammar): Map<Sym, Set<Sym>> {
  const first = new Map<Sym, Set<Sym>>();
  const all = new Set([...grammar.nonTerminals, ...grammar.terminals]);
  for (const s of all) first.set(s, new Set());
  for (const t of grammar.terminals) {
    if (t !== END_MARKER) first.get(t)!.add(t);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of grammar.productions) {
      if (p.lhs === grammar.augmentedStart) continue;
      const F = first.get(p.lhs)!;
      const n = F.size;
      addFirstOfSequence(first, p.rhs, F);
      if (F.size !== n) changed = true;
    }
  }
  return first;
}

export function firstOfString(first: Map<Sym, Set<Sym>>, seq: Sym[]): Set<Sym> {
  const result = new Set<Sym>();
  addFirstOfSequence(first, seq, result);
  return result;
}

export function computeFollow(grammar: Grammar, first: Map<Sym, Set<Sym>>): Map<Sym, Set<Sym>> {
  const follow = new Map<Sym, Set<Sym>>();
  for (const nt of grammar.nonTerminals) follow.set(nt, new Set());
  follow.get(grammar.startSymbol)!.add(END_MARKER);

  let changed = true;
  while (changed) {
    changed = false;
    for (const p of grammar.productions) {
      if (p.lhs === grammar.augmentedStart) continue;
      for (let i = 0; i < p.rhs.length; i++) {
        const B = p.rhs[i];
        if (!grammar.nonTerminals.has(B) || B === EPSILON) continue;
        const beta = p.rhs.slice(i + 1);
        const FB = follow.get(B)!;
        const before = FB.size;
        const firstBeta = firstOfString(first, beta);
        for (const f of firstBeta) {
          if (f !== EPSILON) FB.add(f);
        }
        if (beta.length === 0 || firstBeta.has(EPSILON)) {
          for (const f of follow.get(p.lhs)!) FB.add(f);
        }
        if (FB.size !== before) changed = true;
      }
    }
  }
  return follow;
}

export function isLL1(grammar: Grammar, first: Map<Sym, Set<Sym>>, follow: Map<Sym, Set<Sym>>): string[] {
  const conflicts: string[] = [];
  const byLhs = new Map<Sym, typeof grammar.productions>();
  for (const p of grammar.productions) {
    if (p.lhs === grammar.augmentedStart) continue;
    const list = byLhs.get(p.lhs) ?? [];
    list.push(p);
    byLhs.set(p.lhs, list);
  }

  for (const [lhs, prods] of byLhs) {
    for (let i = 0; i < prods.length; i++) {
      const fi = firstOfString(first, prods[i].rhs);
      for (let j = i + 1; j < prods.length; j++) {
        const fj = firstOfString(first, prods[j].rhs);
        const inter = [...fi].filter((x) => x !== EPSILON && fj.has(x));
        if (inter.length) {
          conflicts.push(
            `Conflicto FIRST/FIRST en ${lhs}: prod. ${prods[i].id} y ${prods[j].id} comparten {${inter.join(', ')}}`,
          );
        }
        if (fi.has(EPSILON)) {
          const fo = follow.get(lhs) ?? new Set();
          const inter2 = [...fj].filter((x) => x !== EPSILON && fo.has(x));
          if (inter2.length) {
            conflicts.push(
              `Conflicto FIRST/FOLLOW en ${lhs} con ε: {${inter2.join(', ')}}`,
            );
          }
        }
      }
    }
  }
  return conflicts;
}
