interface Props {
  onInsert: (text: string) => void;
}

const KEYS = [
  ['ε', '→', '|', '$'],
  ['(', ')', "'", 'α', 'β'],
  ['+', '*', 'id', 'num', 'if'],
  ['then', 'else', 'other'],
];

export function VirtualKeyboard({ onInsert }: Props) {
  return (
    <div className="panel p-3">
      <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
        Teclado formal
      </p>
      <div className="flex flex-col gap-1.5">
        {KEYS.map((row, i) => (
          <div key={i} className="flex flex-wrap gap-1">
            {row.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => {
                  // map special visual tokens to actual text inserted
                  if (k === '→') return onInsert(' -> ');
                  if (k === 'ε') return onInsert(' ε ');
                  return onInsert(` ${k} `);
                }}
                title={k}
                aria-label={`Insertar ${k}`}
                className="min-w-[2rem] rounded-md border border-slate-600 bg-slate-800 px-2 py-1 font-mono text-sm text-sky-200 hover:border-sky-500 hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                {k}
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
