import React from 'react';
import { DiffMark } from '../utils/textSimilarity';

interface PracticeTextDiffProps {
    expected: DiffMark[];
    actual: DiffMark[];
    unit: 'char' | 'word';
}

const markClass = (kind: DiffMark['kind']) => {
    if (kind === 'equal') return 'text-slate-700';
    if (kind === 'del') return 'bg-emerald-100 text-emerald-800 line-through decoration-emerald-400/80 rounded-sm px-0.5';
    if (kind === 'add') return 'bg-red-100 text-red-700 rounded-sm px-0.5';
    return '';
};

function Line({ marks, unit, label }: { marks: DiffMark[]; unit: 'char' | 'word'; label: string }) {
    const sep = unit === 'char' ? '' : ' ';
    return (
        <p className="text-sm leading-relaxed">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-2">{label}</span>
            {marks.map((m, i) => (
                <span key={`${m.kind}-${i}-${m.text}`} className={markClass(m.kind)}>
                    {m.text}{i < marks.length - 1 ? sep : ''}
                </span>
            ))}
        </p>
    );
}

const PracticeTextDiff: React.FC<PracticeTextDiffProps> = ({ expected, actual, unit }) => (
    <div className="mt-3 space-y-1.5 rounded-xl bg-slate-50 border border-slate-100 p-3">
        <Line marks={actual} unit={unit} label="Você" />
        <Line marks={expected} unit={unit} label="Esperado" />
        <p className="text-[10px] text-slate-400 pt-1">
            Verde = o que faltou na sua resposta · Vermelho = extra ou diferente
        </p>
    </div>
);

export default PracticeTextDiff;
