export const SAMPLE_GRAMMARS: Record<string, { name: string; grammar: string; input: string }> = {
  expr: {
    name: 'Expresiones aritméticas',
    grammar: `E -> E + T | T
T -> T * F | F
F -> ( E ) | id`,
    input: 'id + id * id',
  },
  parens: {
    name: 'Paréntesis balanceados',
    grammar: `S -> ( S ) | ε`,
    input: '( ( ) )',
  },
  if: {
    name: 'Estructura if-then-else',
    grammar: `S -> if E then S else S | other
E -> id`,
    input: 'if id then other else other',
  },
  simple: {
    name: 'LL(1) simple',
    grammar: `S -> a B
B -> b | ε`,
    input: 'a b',
  },
};
