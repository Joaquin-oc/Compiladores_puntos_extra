import { useState } from 'react';

type Node = { symbol: string; children?: Node[]; isTerminal?: boolean };

export default function TreeView({ node }: { node: Node }) {
    const [open, setOpen] = useState(true);

    const isLeaf = !node.children || node.children.length === 0;

    if (isLeaf) {
        return (
            <div className="inline-block rounded px-2 py-0.5 text-xs font-mono text-sky-300 bg-slate-900">
                {node.symbol}
            </div>
        );
    }

    return (
        <div className="ml-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((s) => !s)}
                    className="text-xs btn-ghost"
                >
                    {open ? '▾' : '▸'}
                </button>
                <div className="font-mono font-semibold text-white mb-1">{node.symbol}</div>
            </div>
            {open && (
                <div className="ml-4 space-y-2">
                    {node.children!.map((c, i) => (
                        <div key={i} className="flex items-start gap-3">
                            <div className="w-3 flex-shrink-0 mt-1 h-0.5 bg-slate-600" />
                            <div className="flex-1">
                                <TreeView node={c} />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}