import type { ParseStep } from '../core/types';
import { exportTableToPdf } from '../utils/exportPdf';

interface Props {
  steps: ParseStep[];
  currentStep: number;
  onStepChange: (n: number) => void;
}

export function StepTable({ steps, currentStep, onStepChange }: Props) {

  return (
    <div className="panel flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-slate-700 px-4 py-2">
        <h3 className="font-semibold text-slate-200">Simulación paso a paso</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="btn-ghost"
            onClick={() => {
              const headers = ['#', 'Pila (estado / símbolo / estado)', 'Entrada restante', 'Acción'];
              const rows = steps.map((s) => [
                String(s.step),
                String(s.stack),
                String(s.input),
                `${s.action}${s.detail ? ' - ' + s.detail : ''}`,
              ]);
              exportTableToPdf('Simulación paso a paso', headers, rows, 'simulacion-paso-a-paso.pdf');
            }}
          >
            📄 Exportar PDF
          </button>
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
              <th className="px-3 py-2">Pila </th>
              <th className="px-3 py-2">Entrada restante</th>
              <th className="px-3 py-2">Acción</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((s) => (
              <tr
                key={s.step}
                className={`border-t border-slate-800 ${s.step === currentStep ? 'bg-sky-900/40' : ''} hover:bg-slate-800/50 cursor-pointer`}
                onClick={() => onStepChange(s.step)}
              >
                <td className="px-3 py-1.5 font-mono text-slate-500">{s.step}</td>
                <td className="px-3 py-1.5 font-mono text-xs whitespace-pre">{s.stack}</td>
                <td className="px-3 py-1.5 font-mono text-xs whitespace-pre">{s.input}</td>
                <td className="px-3 py-1.5">
                  <div>
                    <span className={`font-semibold ${s.action === 'error' ? 'text-rose-300' : 'text-sky-300'}`}>{s.action}</span>
                    <p className={`text-xs ${s.action === 'error' ? 'text-rose-200' : 'text-slate-500'}`}>{s.detail ?? ''}</p>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
