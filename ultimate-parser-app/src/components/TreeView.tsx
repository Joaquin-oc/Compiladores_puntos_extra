import { useState } from 'react';

type Node = { symbol: string; children?: Node[]; isTerminal?: boolean };

export default function TreeView({ node }: { node: Node }) {
    const [open, setOpen] = useState(true);
    const isLeaf = !node.children || node.children.length === 0;

    const nodeLabel = (
        <div className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-mono ${isLeaf ? 'bg-slate-900 text-sky-300' : 'bg-slate-950 text-slate-100 ring-1 ring-slate-700'}`}>
            {node.symbol}
        </div>
    );

    if (isLeaf) {
        return nodeLabel;
    }

    return (
        <div className="mt-2">
            <div className="flex items-center gap-2">
                <button
                    type="button"
                    aria-expanded={open}
                    onClick={() => setOpen((s) => !s)}
                    className="text-xs btn-ghost py-0.5 px-2"
                >
                    {open ? '▾' : '▸'}
                </button>
                {nodeLabel}
            </div>
            {open && (
                <div className="ml-5 mt-2 space-y-2 border-l border-slate-700/70 pl-4">
                    {node.children!.map((c, i) => (
                        <div key={i}>
                            <TreeView node={c} />
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}