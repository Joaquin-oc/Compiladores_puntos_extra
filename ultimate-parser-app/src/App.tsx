import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, Brain, GitCompare, History, Play, Table2, TreePine } from 'lucide-react';
import type { ParserKind } from './core/types';
import { parseGrammarText } from './core/grammar';
import type { AnalysisOutput } from './core/runner';
import { buildLL1Table } from './core/ll1';
import { suggestAmbiguityFixes } from './ai/explanations';
import {
  checkHealth,
  compareParsersFromApi,
  explainErrorFromApi,
  ll1SuggestionsFromApi,
  runAnalysisFromApi,
} from './api/client';
import { SAMPLE_GRAMMARS } from './data/samples';
import { clearHistory, loadHistory, parserName, saveToHistory } from './utils/history';
import { exportTableToPdf } from './utils/exportPdf';
import { lrAutomatonToDot, parseTreeToDot } from './utils/graphviz';
import { VirtualKeyboard } from './components/VirtualKeyboard';
import { StepTable } from './components/StepTable';

const PARSERS: { id: ParserKind; label: string; group: string }[] = [
  { id: 'recursive-descent', label: 'Descenso Recursivo', group: 'Top-Down' },
  { id: 'll1', label: 'LL(1)', group: 'Top-Down' },
  { id: 'lr0', label: 'LR(0)', group: 'Bottom-Up' },
  { id: 'slr1', label: 'SLR(1)', group: 'Bottom-Up' },
  { id: 'lalr1', label: 'LALR(1)', group: 'Bottom-Up' },
  { id: 'lr1', label: 'LR(1)', group: 'Bottom-Up' },
];

type Tab = 'steps' | 'tables' | 'automaton' | 'tree' | 'ai' | 'compare' | 'history';

export default function App() {
  const [grammarText, setGrammarText] = useState(SAMPLE_GRAMMARS.simple.grammar);
  const [inputText, setInputText] = useState(SAMPLE_GRAMMARS.simple.input);
  const [parser, setParser] = useState<ParserKind>('ll1');
  const [tab, setTab] = useState<Tab>('steps');
  const [currentStep, setCurrentStep] = useState(0);
  const [compareParser, setCompareParser] = useState<ParserKind>('lr0');
  const [history, setHistory] = useState(loadHistory);
  const [mermaidSvg, setMermaidSvg] = useState('');
  const [result, setResult] = useState<AnalysisOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [backendOk, setBackendOk] = useState<boolean | null>(null);
  const [compareData, setCompareData] = useState<Record<string, { accepted: boolean; error?: string | null; steps_count: number }> | null>(null);
  const [aiText, setAiText] = useState('');
  const [ll1Meta, setLl1Meta] = useState<ReturnType<typeof buildLL1Table> | null>(null);

  const { grammar, errors } = useMemo(() => parseGrammarText(grammarText), [grammarText]);

  useEffect(() => {
    checkHealth().then(setBackendOk);
  }, []);

  const runParse = useCallback(async () => {
    if (errors.length || !grammar.productions.length) return;
    setLoading(true);
    setApiError(null);
    setCompareData(null);
    try {
      const output = await runAnalysisFromApi(grammarText, inputText, parser, grammar);
      setResult(output);
      setCurrentStep(0);
      if (output.ll1Table && output.first && output.follow) {
        setLl1Meta({
          ...output.ll1Table,
          first: output.first,
          follow: output.follow,
        });
      } else {
        setLl1Meta(buildLL1Table(grammar));
      }
      saveToHistory({
        parser,
        grammar: grammarText,
        input: inputText,
        success: output.success,
      });
      setHistory(loadHistory());
    } catch (e) {
      setApiError(e instanceof Error ? e.message : String(e));
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [errors, grammar, grammarText, inputText, parser]);

  useEffect(() => {
    if (tab !== 'compare' || !result || errors.length) return;
    compareParsersFromApi(grammarText, inputText, [parser, compareParser])
      .then(setCompareData)
      .catch(() => setCompareData(null));
  }, [tab, result, grammarText, inputText, parser, compareParser, errors]);

  useEffect(() => {
    if (tab !== 'ai' || !result) {
      if (tab !== 'ai') return;
      setAiText('Ejecute un análisis para obtener explicaciones inteligentes.');
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const last = result.steps[result.steps.length - 1];
        const [explanation, tips] = await Promise.all([
          explainErrorFromApi(
            parser,
            result.message,
            grammarText,
            last
              ? {
                  step: last.step,
                  action: last.action,
                  stack: last.stack.split(/\s+/).filter(Boolean),
                  input_remaining: last.input.split(/\s+/).filter(Boolean),
                  description: last.detail,
                }
              : undefined,
          ),
          ll1SuggestionsFromApi(grammarText),
        ]);
        if (cancelled) return;
        const amb = suggestAmbiguityFixes(result.conflicts);
        setAiText(
          `${explanation}\n\n${tips.map((t) => `- ${t}`).join('\n')}\n\n${amb}`,
        );
      } catch {
        if (!cancelled) setAiText('No se pudo cargar la explicación desde el servidor.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tab, result, parser, grammarText]);

  const renderMermaid = async (dot: string) => {
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({ startOnLoad: false, theme: 'dark' });
      const { svg } = await mermaid.default.render('graph-' + Date.now(), dot.replace(/digraph/g, 'graph').replace(/->/g, '-->'));
      setMermaidSvg(svg);
    } catch {
      setMermaidSvg('<p class="text-slate-400 p-4">Vista simplificada — copie el DOT para Graphviz externo.</p>');
    }
  };

  const actionTableRows = useMemo(() => {
    if (!result?.lrTables) return [];
    const rows: string[][] = [];
    const states = new Set<number>();
    const terms = new Set<string>();
    result.lrTables.action.forEach((_, k) => {
      const [s, t] = k.split(',');
      states.add(Number(s));
      terms.add(t);
    });
    const stArr = [...states].sort((a, b) => a - b);
    const tArr = [...terms].sort();
    for (const s of stArr) {
      rows.push([String(s), ...tArr.map((t) => result.lrTables!.action.get(`${s},${t}`) ?? '')]);
    }
    return rows;
  }, [result]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-700/80 bg-slate-900/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              The Ultimate Parser App
            </h1>
            <p className="text-sm text-slate-400">CS3402 Compiladores 2026-1 — Bonificación Examen 1</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs ${
                backendOk === null
                  ? 'border-slate-600 text-slate-400'
                  : backendOk
                    ? 'border-emerald-600/50 bg-emerald-950/50 text-emerald-300'
                    : 'border-red-600/50 bg-red-950/50 text-red-300'
              }`}
            >
              {backendOk === null ? 'API…' : backendOk ? 'Backend conectado' : 'Backend sin conexión'}
            </span>
            <span className="rounded-full border border-sky-600/50 bg-sky-950/50 px-3 py-1 text-xs text-sky-300">
              Desarrollado con asistencia de IA
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-4 lg:flex-row">
        <aside className="flex w-full flex-col gap-3 lg:w-80">
          <section className="panel p-4">
            <label className="mb-1 block text-xs font-medium uppercase text-slate-400">Gramática</label>
            <textarea
              className="h-40 w-full resize-y rounded-lg border border-slate-600 bg-slate-950 p-2 font-mono text-sm text-slate-100 focus:border-sky-500 focus:outline-none"
              value={grammarText}
              onChange={(e) => setGrammarText(e.target.value)}
              spellCheck={false}
            />
            <label className="mb-1 mt-3 block text-xs font-medium uppercase text-slate-400">Cadena de entrada</label>
            <input
              className="w-full rounded-lg border border-slate-600 bg-slate-950 p-2 font-mono text-sm focus:border-sky-500 focus:outline-none"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
            />
            <VirtualKeyboard
              onInsert={(t) => setGrammarText((g) => g + t)}
            />
            <div className="mt-2 flex flex-wrap gap-1">
              {Object.entries(SAMPLE_GRAMMARS).map(([key, s]) => (
                <button
                  key={key}
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => {
                    setGrammarText(s.grammar);
                    setInputText(s.input);
                  }}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </section>

          <section className="panel p-3">
            <p className="mb-2 text-xs font-medium uppercase text-slate-400">Analizador</p>
            {['Top-Down', 'Bottom-Up'].map((group) => (
              <div key={group} className="mb-2">
                <p className="text-xs text-slate-500">{group}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {PARSERS.filter((p) => p.group === group).map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setParser(p.id)}
                      className={`rounded-md px-2 py-1 text-xs ${parser === p.id ? 'bg-sky-600 text-white' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            <button
              type="button"
              className="btn-primary mt-3 w-full flex items-center justify-center gap-2 disabled:opacity-50"
              onClick={() => void runParse()}
              disabled={loading || errors.length > 0}
            >
              <Play size={16} /> {loading ? 'Analizando…' : 'Analizar'}
            </button>
          </section>

          {apiError && (
            <div className="rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-300">
              <p className="font-medium">Error de API</p>
              <p className="mt-1 text-xs">{apiError}</p>
              <p className="mt-2 text-xs opacity-80">Asegúrate de que el backend esté en http://127.0.0.1:8000</p>
            </div>
          )}

          {errors.length > 0 && (
            <div className="rounded-lg border border-red-500/50 bg-red-950/30 p-3 text-sm text-red-300">
              {errors.map((e) => (
                <p key={e}>{e}</p>
              ))}
            </div>
          )}

          {result && (
            <div
              className={`rounded-lg border p-3 text-sm ${result.success ? 'border-emerald-500/50 bg-emerald-950/30 text-emerald-300' : 'border-amber-500/50 bg-amber-950/30 text-amber-200'}`}
            >
              {result.message}
              {result.conflicts.length > 0 && (
                <p className="mt-1 text-xs opacity-80">{result.conflicts.length} conflicto(s) en tablas</p>
              )}
            </div>
          )}
        </aside>

        <div className="flex min-w-0 flex-1 flex-col gap-3">
          <nav className="flex flex-wrap gap-1 border-b border-slate-700 pb-1">
            {(
              [
                ['steps', 'Pasos', Table2],
                ['tables', 'Tablas', BookOpen],
                ['automaton', 'Autómata', GitCompare],
                ['tree', 'Árbol', TreePine],
                ['ai', 'IA', Brain],
                ['compare', 'Comparar', GitCompare],
                ['history', 'Historial', History],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                className={`flex items-center gap-1 rounded-t-lg px-3 py-2 text-sm ${tab === id ? 'tab-active bg-slate-800/80' : 'text-slate-400 hover:text-slate-200'}`}
              >
                <Icon size={14} /> {label}
              </button>
            ))}
          </nav>

          {tab === 'steps' && result && (
            <StepTable steps={result.steps} currentStep={currentStep} onStepChange={setCurrentStep} />
          )}

          {tab === 'tables' && (
            <div className="panel overflow-auto p-4">
              <div className="mb-3 flex justify-between">
                <h3 className="font-semibold">Tablas de análisis</h3>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() =>
                    exportTableToPdf(
                      `Tabla ${parserName(parser)}`,
                      ['Estado', ...(actionTableRows[0]?.slice(1) ?? [])],
                      actionTableRows,
                    )
                  }
                >
                  Exportar PDF
                </button>
              </div>
              {parser === 'll1' || parser === 'recursive-descent' ? (
                <div className="overflow-x-auto">
                  <h4 className="mb-2 text-sm text-slate-400">Tabla LL(1)</h4>
                  <table className="text-sm">
                    <thead>
                      <tr className="text-slate-400">
                        <th className="px-2 py-1">NT</th>
                        <th className="px-2 py-1">Terminal</th>
                        <th className="px-2 py-1">Producción</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ll1Meta &&
                        [...ll1Meta.table.entries()].map(([k, v]) => (
                          <tr key={k} className="border-t border-slate-800">
                            <td className="px-2 py-1 font-mono">{k.split(',')[0]}</td>
                            <td className="px-2 py-1 font-mono">{k.split(',')[1]}</td>
                            <td className="px-2 py-1 font-mono text-sky-300">
                              {v.prod.lhs} → {v.prod.rhs.join(' ')}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                  <h4 className="mb-2 mt-4 text-sm text-slate-400">FIRST / FOLLOW</h4>
                  <pre className="text-xs text-slate-300">
                    {ll1Meta &&
                      [...grammar.nonTerminals]
                        .filter((n) => n !== grammar.augmentedStart)
                        .map(
                          (nt) =>
                            `FIRST(${nt})={${[...(ll1Meta.first.get(nt) ?? [])].join(',')}}  FOLLOW(${nt})={${[...(ll1Meta.follow.get(nt) ?? [])].join(',')}}`,
                        )
                        .join('\n')}
                  </pre>
                </div>
              ) : result?.lrTables ? (
                <div>
                  <h4 className="mb-2 text-sm text-slate-400">ACTION (muestra)</h4>
                  <div className="max-h-96 overflow-auto font-mono text-xs">
                    {[...result.lrTables.action.entries()].slice(0, 120).map(([k, v]) => (
                      <div key={k} className="border-b border-slate-800 py-0.5">
                        [{k}] = {v}
                      </div>
                    ))}
                  </div>
                  <h4 className="mb-2 mt-4 text-sm text-slate-400">GOTO</h4>
                  <div className="font-mono text-xs">
                    {[...result.lrTables.goto.entries()].map(([k, v]) => (
                      <div key={k} className="border-b border-slate-800 py-0.5">
                        [{k}] = {v}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-slate-400">Ejecute Analizar para construir tablas.</p>
              )}
            </div>
          )}

          {tab === 'automaton' && result?.lrTables && (
            <div className="panel p-4">
              <div className="mb-2 flex gap-2">
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => renderMermaid(lrAutomatonToDot(result.lrTables!.states))}
                >
                  Visualizar (Mermaid)
                </button>
                <button
                  type="button"
                  className="btn-ghost text-xs"
                  onClick={() => navigator.clipboard.writeText(lrAutomatonToDot(result.lrTables!.states))}
                >
                  Copiar DOT (Graphviz)
                </button>
              </div>
              <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              <div className="mt-4 grid max-h-64 gap-2 overflow-auto sm:grid-cols-2">
                {result.lrTables.states.map((st) => (
                  <div key={st.id} className="rounded border border-slate-700 bg-slate-950 p-2 text-xs">
                    <strong className="text-sky-400">I{st.id}</strong>
                    <ul className="mt-1 font-mono text-slate-400">
                      {st.items.map((it) => (
                        <li key={it}>{it}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {tab === 'tree' && (
            <div className="panel p-4">
              {result?.tree ? (
                <>
                  <TreeView node={result.tree} />
                  <button
                    type="button"
                    className="btn-ghost mt-2 text-xs"
                    onClick={() => navigator.clipboard.writeText(parseTreeToDot(result.tree))}
                  >
                    Exportar árbol DOT
                  </button>
                </>
              ) : (
                <p className="text-slate-400">
                  Árbol de derivación / AST disponible con LL(1) y Descenso Recursivo.
                  {result?.derivation?.length ? (
                    <ul className="mt-2 font-mono text-sm">
                      {result.derivation.map((d, i) => (
                        <li key={i}>{d}</li>
                      ))}
                    </ul>
                  ) : null}
                </p>
              )}
            </div>
          )}

          {tab === 'ai' && (
            <div className="panel markdown-ai max-h-[32rem] overflow-auto p-4 whitespace-pre-wrap text-sm">
              {aiText || 'Ejecute un análisis para obtener explicaciones inteligentes.'}
            </div>
          )}

          {tab === 'compare' && (
            <div className="panel grid gap-4 p-4 md:grid-cols-2">
              <div>
                <label className="text-xs text-slate-400">Comparar con</label>
                <select
                  className="mb-2 w-full rounded border border-slate-600 bg-slate-900 p-2"
                  value={compareParser}
                  onChange={(e) => setCompareParser(e.target.value as ParserKind)}
                >
                  {PARSERS.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.label}
                    </option>
                  ))}
                </select>
                <p className="text-sm font-medium text-sky-300">{parserName(parser)}</p>
                <p className={result?.success ? 'text-emerald-400' : 'text-amber-400'}>{result?.message}</p>
                <p className="text-xs text-slate-500">{result?.steps.length} pasos</p>
              </div>
              <div>
                <p className="text-sm font-medium text-sky-300">{parserName(compareParser)}</p>
                {(() => {
                  const key = compareParser === 'recursive-descent' ? 'recursive_descent' : compareParser;
                  const row = compareData?.[key];
                  return (
                    <>
                      <p className={row?.accepted ? 'text-emerald-400' : 'text-amber-400'}>
                        {row ? (row.accepted ? 'Aceptada' : row.error ?? 'Rechazada') : 'Ejecute Analizar primero'}
                      </p>
                      <p className="text-xs text-slate-500">{row?.steps_count ?? 0} pasos</p>
                    </>
                  );
                })()}
              </div>
            </div>
          )}

          {tab === 'history' && (
            <div className="panel p-4">
              <div className="mb-2 flex justify-between">
                <h3 className="font-semibold">Historial</h3>
                <button type="button" className="btn-ghost text-xs" onClick={() => { clearHistory(); setHistory([]); }}>
                  Limpiar
                </button>
              </div>
              <ul className="space-y-2 text-sm">
                {history.map((h) => (
                  <li
                    key={h.id}
                    className="cursor-pointer rounded border border-slate-700 p-2 hover:bg-slate-800"
                    onClick={() => {
                      setGrammarText(h.grammar);
                      setInputText(h.input);
                      setParser(h.parser);
                    }}
                  >
                    <span className={h.success ? 'text-emerald-400' : 'text-amber-400'}>
                      {h.success ? '✓' : '✗'}
                    </span>{' '}
                    {parserName(h.parser)} — {new Date(h.timestamp).toLocaleString()}
                  </li>
                ))}
                {history.length === 0 && <p className="text-slate-500">Sin análisis previos.</p>}
              </ul>
            </div>
          )}
        </div>
      </main>

      <footer className="border-t border-slate-800 py-3 text-center text-xs text-slate-500">
        The Ultimate Parser App · PWA · Graphviz DOT · Exportación PDF · IA pedagógica integrada
      </footer>
    </div>
  );
}

function TreeView({ node }: { node: { symbol: string; children: typeof node[]; isTerminal: boolean } }) {
  if (!node.children.length) {
    return <span className="font-mono text-sky-300">{node.symbol}</span>;
  }
  return (
    <ul className="ml-4 list-none border-l border-slate-600 pl-3">
      <li className="font-mono font-semibold text-white">{node.symbol}</li>
      {node.children.map((c, i) => (
        <li key={i} className="mt-1">
          <TreeView node={c} />
        </li>
      ))}
    </ul>
  );
}
