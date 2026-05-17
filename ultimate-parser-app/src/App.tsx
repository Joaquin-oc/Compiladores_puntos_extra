import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookOpen, GitCompare, History, Play, Table2, TreePine } from 'lucide-react';
import type { ParserKind } from './core/types';
import { parseGrammarText } from './core/grammar';
import type { AnalysisOutput } from './core/runner';
import { buildLL1Table } from './core/ll1';
import { compareParsersFromApi, runAnalysisFromApi } from './api/client';
import { SAMPLE_GRAMMARS } from './data/samples';
import { clearHistory, loadHistory, parserName, saveToHistory } from './utils/history';
import { lrAutomatonToMermaid } from './utils/graphviz';
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
  const [showApiDetails, setShowApiDetails] = useState(false);
  const [compareData, setCompareData] = useState<Record<string, { accepted: boolean; error?: string | null; steps_count: number }> | null>(null);
  const [ll1Meta, setLl1Meta] = useState<ReturnType<typeof buildLL1Table> | null>(null);

  const { grammar, errors } = useMemo(() => parseGrammarText(grammarText), [grammarText]);

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


  const renderMermaid = useCallback(async (diagram: string) => {
    try {
      const mermaid = await import('mermaid');
      mermaid.default.initialize({ startOnLoad: false, theme: 'dark' });
      const { svg } = await mermaid.default.render('graph-' + Date.now(), diagram);
      if (svg.includes('Syntax error in text') || svg.includes('mermaid version')) {
        setMermaidSvg('');
      } else {
        setMermaidSvg(svg);
      }
    } catch {
      setMermaidSvg('');
    }
  }, []);

  useEffect(() => {
    if (tab !== 'automaton' || !result?.lrTables) return;
    void renderMermaid(lrAutomatonToMermaid(result.lrTables.states));
  }, [tab, result, renderMermaid]);

  return (
    <div className="flex min-h-full flex-col">
      <header className="border-b border-slate-700/80 bg-slate-900/90 px-6 py-4 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              nombre de app q querramos 
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">   
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
            <label className="mb-1 mt-3 block text-xs font-medium uppercase text-slate-400">Cadena</label>
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
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium">Error de API</p>
                  <p className="mt-1 text-xs">{apiError.split('\n')[0]}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => {
                      void navigator.clipboard?.writeText(apiError).catch(() => {});
                    }}
                  >
                    Copiar
                  </button>
                  <button
                    type="button"
                    className="btn-ghost text-xs"
                    onClick={() => setShowApiDetails((s) => !s)}
                  >
                    {showApiDetails ? 'Ocultar' : 'Detalles'}
                  </button>
                </div>
              </div>
              {showApiDetails && (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap rounded border border-slate-800 bg-slate-900 p-2 text-xs text-red-200">{apiError}</pre>
              )}
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
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold">Tablas de análisis</h3>
                  <p className="text-xs text-slate-500">
                    La tabla muestra cómo el parser decide cada paso. En LL(1) se ve la tabla predictiva M[NT, terminal]. En LR se ven las entradas ACTION y GOTO.
                  </p>
                </div>
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
              <p className="mb-3 text-xs text-slate-400">
                El autómata se genera automáticamente cuando hay tablas LR. Muestra los estados y transiciones del parser.
              </p>
              {mermaidSvg ? (
                <div dangerouslySetInnerHTML={{ __html: mermaidSvg }} />
              ) : (
                <div className="rounded border border-slate-700 bg-slate-950 p-3 text-xs text-slate-400">
                  Autómata no disponible para este estado. Si el parser falló, la tabla puede seguir existiendo, pero el gráfico no se genera.
                </div>
              )}
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
                <div className="overflow-auto max-h-[60vh] rounded border border-slate-700 bg-slate-950 p-3">
                  <TreeView node={result.tree} />
                </div>
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
    </div>
  );
}

function TreeView({ node }: { node: { symbol: string; children: typeof node[]; isTerminal: boolean } }) {
  const isLeaf = !node.children || node.children.length === 0;
  if (isLeaf) {
    return <div className="inline-block rounded px-2 py-0.5 text-xs font-mono text-sky-300 bg-slate-900">{node.symbol}</div>;
  }
  return (
    <div className="ml-2">
      <div className="font-mono font-semibold text-white mb-1">{node.symbol}</div>
      <div className="ml-4 space-y-2">
        {node.children.map((c, i) => (
          <div key={i} className="flex items-start gap-3">
            <div className="w-3 flex-shrink-0 mt-1 h-0.5 bg-slate-600" />
            <div className="flex-1">
              <TreeView node={c} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
