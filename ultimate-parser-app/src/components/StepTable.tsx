import React, { useState } from 'react';
import type { ParseStep } from '../core/types';

interface Props {
  steps: ParseStep[];
  currentStep: number;
  onStepChange: (n: number) => void;
}

export function StepTable({ steps, currentStep, onStepChange }: Props) {
  const [expanded, setExpanded] = useState<number | null>(null);

  const toggleDetails = (step: number) => {
    setExpanded((s) => (s === step ? null : step));
  };

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
        <h3 className="font-semibold text-slate-200">Simulación paso a paso</h3>
        <div className="flex items-center gap-2">
          <button type="button" className="btn-ghost" disabled={currentStep <= 0} onClick={() => onStepChange(0)}>
            ⏮
          </button>
          <button type="button" className="btn-ghost" disabled={currentStep <= 0} onClick={() => onStepChange(currentStep - 1)}>
            ◀
          </button>
          <span className="font-mono text-sm text-sky-300">
            {currentStep} / {Math.max(0, steps.length - 1)}
          </span>
          <button
            type="button"
            className="btn-ghost"
            disabled={currentStep >= steps.length - 1}
            onClick={() => onStepChange(currentStep + 1)}
          >
            ▶
          </button>
          <button
            type="button"
            className="btn-ghost"
            disabled={currentStep >= steps.length - 1}
            onClick={() => onStepChange(steps.length - 1)}
          >
            ⏭
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-slate-800 text-xs uppercase text-slate-400">
            <tr>
              <th className="px-3 py-2">#</th>
              <th className="px-3 py-2">Pila (estado / símbolo / estado)</th>
              <th className="px-3 py-2">Entrada restante</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <React.Fragment key={s.step}>
                <tr
                  className={`border-t border-slate-800 ${s.step === currentStep ? 'bg-sky-900/40' : ''} hover:bg-slate-800/50 cursor-pointer`}
                  onClick={() => onStepChange(s.step)}
                >
                  <td className="px-3 py-1.5 font-mono text-slate-500">{s.step}</td>
                  <td className="px-3 py-1.5 font-mono text-xs whitespace-pre">{s.stack}</td>
                  <td className="px-3 py-1.5 font-mono text-xs whitespace-pre">{s.input}</td>
                  <td className="px-3 py-1.5">
                    <div className="flex items-start justify-between">
                      <div>
                        <span className={`font-semibold ${s.action === 'error' ? 'text-rose-300' : 'text-sky-300'}`}>{s.action}</span>
                        <p className={`text-xs ${s.action === 'error' ? 'text-rose-200' : 'text-slate-500'}`}>{s.detail?.slice(0, 80)}</p>
                      </div>
                      <div>
                        <button
                          type="button"
                          aria-label={s.action === 'error' ? 'Ver detalles de error' : 'Ver detalle'}
                          className="btn-ghost text-xs"
                          onClick={(ev) => {
                            ev.stopPropagation();
                            toggleDetails(s.step);
                          }}
                        >
                          Detalles
                        </button>
                      </div>
                    </div>
                  </td>
                </tr>
                {expanded === s.step && (
                  <tr className="bg-slate-950/60">
                    <td colSpan={4} className="px-3 py-2 text-xs font-mono text-slate-300">
                      <pre className="whitespace-pre-wrap">{s.detail ?? 'Sin detalles'}</pre>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
