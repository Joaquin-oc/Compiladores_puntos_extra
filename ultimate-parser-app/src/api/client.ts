import type { Grammar, ParserKind } from '../core/types';
import type { AnalysisOutput } from '../core/runner';
import { apiUrl } from './config';
import {
  adaptApiResponse,
  adaptLL1FromMeta,
  adaptLRTables,
  adaptParseResult,
} from './adapters';

const PARSER_PATH: Record<ParserKind, string> = {
  'recursive-descent': 'recursive-descent',
  ll1: 'll1',
  lr0: 'lr0',
  slr1: 'slr1',
  lalr1: 'lalr1',
  lr1: 'lr1',
};

const PARSER_API_NAME: Record<ParserKind, string> = {
  'recursive-descent': 'recursive_descent',
  ll1: 'll1',
  lr0: 'lr0',
  slr1: 'slr1',
  lalr1: 'lalr1',
  lr1: 'lr1',
};

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(apiUrl(path), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export async function checkHealth(): Promise<boolean> {
  try {
    const res = await fetch(apiUrl('/api/health'));
    if (!res.ok) return false;
    const data = (await res.json()) as { status?: string };
    return data.status === 'ok';
  } catch {
    return false;
  }
}

export async function analyzeGrammar(grammarText: string, startSymbol?: string) {
  const raw = await postJson<{ success: boolean; data?: Record<string, unknown>; error?: string }>(
    '/api/grammar/analyze',
    { grammar_text: grammarText, start_symbol: startSymbol ?? null },
  );
  return adaptApiResponse(raw);
}

export async function runAnalysisFromApi(
  grammarText: string,
  inputText: string,
  parser: ParserKind,
  grammar: Grammar,
): Promise<AnalysisOutput> {
  const segment = PARSER_PATH[parser];
  const raw = await postJson<{ success: boolean; data?: Record<string, unknown>; error?: string }>(
    `/api/parsers/${segment}/parse`,
    { grammar_text: grammarText, input_string: inputText, tokenize_mode: 'auto' },
  );
  const data = adaptApiResponse(raw) as {
    accepted: boolean;
    error?: string | null;
    steps: Parameters<typeof adaptParseResult>[0]['steps'];
    tree?: Parameters<typeof adaptParseResult>[0]['tree'];
    metadata?: Record<string, unknown>;
  };

  const base = adaptParseResult(data);
  const meta = data.metadata ?? {};
  const lrTables = adaptLRTables(meta);
  const ll1 = adaptLL1FromMeta(grammar, meta);

  const out: AnalysisOutput = {
    ...base,
    conflicts: lrTables?.conflicts ?? ll1?.conflicts ?? [],
  };

  if (ll1) {
    out.ll1Table = ll1;
    out.first = ll1.first;
    out.follow = ll1.follow;
  }
  if (lrTables) out.lrTables = lrTables;

  return out;
}

export async function compareParsersFromApi(
  grammarText: string,
  inputText: string,
  parsers: ParserKind[],
): Promise<Record<string, { accepted: boolean; error?: string | null; steps_count: number }>> {
  const raw = await postJson<{ success: boolean; data?: { results: Record<string, unknown> }; error?: string }>(
    '/api/parsers/compare',
    {
      grammar_text: grammarText,
      input_string: inputText,
      parsers: parsers.map((p) => PARSER_API_NAME[p]),
      tokenize_mode: 'auto',
    },
  );
  const data = adaptApiResponse(raw) as { results: Record<string, { accepted: boolean; error?: string | null; steps_count: number }> };
  return data.results;
}

export async function explainErrorFromApi(
  parser: ParserKind,
  error: string,
  grammarText: string,
  step?: Record<string, unknown>,
): Promise<string> {
  const raw = await postJson<{ success: boolean; data?: { explanation: string }; error?: string }>(
    '/api/ai/explain-error',
    {
      parser: PARSER_API_NAME[parser],
      error,
      grammar_text: grammarText,
      step: step ?? null,
    },
  );
  const data = adaptApiResponse(raw) as { explanation: string };
  return data.explanation;
}

export async function ll1SuggestionsFromApi(grammarText: string): Promise<string[]> {
  const raw = await postJson<{ success: boolean; data?: { suggestions?: string[] }; error?: string }>(
    '/api/ai/ll1-suggestions',
    { grammar_text: grammarText },
  );
  const data = adaptApiResponse(raw) as { suggestions?: string[] };
  return data.suggestions ?? [];
}
