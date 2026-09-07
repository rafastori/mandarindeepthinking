import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Headphones, Lightbulb, MessageCircleWarning, Square, Volume2, Sparkles, Loader2 } from 'lucide-react';
import { SupportedLanguage } from '../types';
import PracticeTextDiff from './PracticeTextDiff';
import { PracticeScoreResult } from '../utils/practiceScoring';

export interface AudioPracticeQuestion {
    id: string;
    word: string;
    sentence: string;
    translation: string;
    pinyin?: string;
    language?: SupportedLanguage;
    sentenceItemId: string;
}

interface PracticeAudioCardProps {
    question: AudioPracticeQuestion;
    index: number;
    mode: 'audio-traducao' | 'audio-escrita';
    playingId: string | null;
    speak: (text: string, lang: SupportedLanguage, id: string, sentenceItemId?: string) => void;
    stop: () => void;
    hasNativeAlignment: boolean;
    enableAiHelp: boolean;
    showResult: boolean;
    result: PracticeScoreResult | null;
    scoring: boolean;
    userInput: string;
    onUserInput: (value: string) => void;
    onSubmit: () => void;
    onHint: () => void;
    onExplain: () => void;
    hintText: string | null;
    explainText: string | null;
    aiBusy: 'hint' | 'explain' | null;
    isCjk: boolean;
}

const GRADE_UI = {
    correct: { label: 'Acertou', bar: 'bg-brand-500', chip: 'bg-brand-50 text-brand-700 border-brand-200' },
    almost: { label: 'Quase', bar: 'bg-amber-500', chip: 'bg-amber-50 text-amber-800 border-amber-200' },
    wrong: { label: 'Ainda não', bar: 'bg-red-400', chip: 'bg-red-50 text-red-700 border-red-200' },
} as const;

const PracticeAudioCard: React.FC<PracticeAudioCardProps> = ({
    question, index, mode, playingId, speak, stop, hasNativeAlignment,
    enableAiHelp, showResult, result, scoring, userInput, onUserInput, onSubmit,
    onHint, onExplain, hintText, explainText, aiBusy, isCjk,
}) => {
    const audioId = `practice-audio-${index}`;
    const playedForIndex = useRef<number | null>(null);
    const [showFormula, setShowFormula] = useState(false);

    const lang = (question.language || 'zh') as SupportedLanguage;
    const isTranslation = mode === 'audio-traducao';
    const placeholder = isTranslation
        ? 'Escreva a tradução em português (L1)…'
        : 'Escreva o que ouviu na língua de estudo (L2)…';

    useEffect(() => {
        if (playedForIndex.current === index) return;
        playedForIndex.current = index;
        speak(question.sentence, lang, audioId, question.sentenceItemId);
        // speak identity changes often; autoplay once per card index
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [index, question.sentenceItemId]);

    const replay = () => {
        if (playingId === audioId) stop();
        else speak(question.sentence, lang, audioId, question.sentenceItemId);
    };

    const gradeUi = result ? GRADE_UI[result.grade] : null;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 p-4 mb-3 flex-1 flex flex-col">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
                    {isTranslation ? 'Ouça → tradução (L1)' : 'Ouça → escrita (L2)'}
                </p>
                {hasNativeAlignment && (
                    <span className="text-[9px] font-extrabold uppercase tracking-wide bg-brand-100 text-brand-700 px-1.5 py-0.5 rounded">
                        Áudio nativo se alinhado
                    </span>
                )}
            </div>

            <div className="flex flex-col items-center py-3 gap-2">
                <motion.button
                    type="button"
                    whileTap={{ scale: 0.96 }}
                    onClick={replay}
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-white ${
                        playingId === audioId ? 'bg-brand-700 animate-pulse' : 'bg-brand-600'
                    }`}
                    style={{ boxShadow: '0 8px 22px rgba(5, 150, 105, 0.28)' }}
                    aria-label={playingId === audioId ? 'Parar áudio' : 'Ouvir de novo'}
                >
                    {playingId === audioId ? <Square size={22} /> : <Volume2 size={26} />}
                </motion.button>
                <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                    <Headphones size={12} />
                    {playingId === audioId ? 'Tocando…' : 'Ouvir de novo'}
                </span>
            </div>

            <p className="text-[11px] text-center text-slate-400 mb-3 leading-snug">
                {isTranslation
                    ? 'Não mostre a frase na língua de estudo até enviar. Escreva o sentido em português.'
                    : 'Ditado: transcreva na língua de estudo (ex.: hanzi). Não é a tradução em português.'}
            </p>

            <textarea
                value={userInput}
                onChange={e => onUserInput(e.target.value)}
                onKeyDown={e => {
                    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') onSubmit();
                }}
                disabled={showResult || scoring}
                rows={3}
                placeholder={placeholder}
                className={`w-full rounded-xl border-2 border-slate-200 p-3 text-sm resize-none focus:outline-none focus:border-brand-400 disabled:bg-slate-50 ${
                    isTranslation || !isCjk ? 'font-sans' : 'font-chinese text-lg'
                }`}
            />

            {!showResult && (
                <motion.button
                    type="button"
                    whileTap={!scoring && userInput.trim() ? { scale: 0.97 } : {}}
                    onClick={onSubmit}
                    disabled={scoring || !userInput.trim()}
                    className={`mt-3 w-full py-3 rounded-xl font-bold text-sm ${
                        scoring || !userInput.trim()
                            ? 'bg-slate-100 text-slate-400'
                            : 'bg-brand-600 text-white hover:bg-brand-700'
                    }`}
                >
                    {scoring ? (
                        <span className="inline-flex items-center gap-2 justify-center">
                            <Loader2 size={15} className="animate-spin" /> Corrigindo…
                        </span>
                    ) : 'Enviar resposta'}
                </motion.button>
            )}

            {enableAiHelp && !showResult && (
                <button
                    type="button"
                    onClick={onHint}
                    disabled={aiBusy === 'hint'}
                    className="mt-2 self-center text-xs font-bold text-brand-700 hover:text-brand-800 inline-flex items-center gap-1"
                >
                    {aiBusy === 'hint' ? <Loader2 size={12} className="animate-spin" /> : <Lightbulb size={12} />}
                    Dica (pré) sem spoiler completo
                </button>
            )}

            {hintText && (
                <div className="mt-2 text-xs text-slate-600 bg-amber-50 border border-amber-100 rounded-xl p-2.5 leading-relaxed">
                    <span className="font-extrabold text-amber-800 inline-flex items-center gap-1 mb-1">
                        <Sparkles size={11} /> Dica
                    </span>
                    <p>{hintText}</p>
                </div>
            )}

            {showResult && result && gradeUi && (
                <div className="mt-3">
                    <div className={`inline-flex items-center gap-2 text-xs font-extrabold border rounded-full px-2.5 py-1 ${gradeUi.chip}`}>
                        {gradeUi.label} · {result.percent}%
                    </div>
                    <div className="mt-2 h-2 bg-slate-100 rounded-full overflow-hidden">
                        <div className={`h-full ${gradeUi.bar}`} style={{ width: `${result.percent}%` }} />
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowFormula(v => !v)}
                        className="mt-1.5 text-[10px] font-bold text-slate-400 hover:text-slate-600"
                    >
                        {showFormula ? 'Ocultar fórmula' : 'Como a nota foi calculada'}
                    </button>
                    {showFormula && (
                        <p className="text-[10px] text-slate-500 mt-1 leading-relaxed">
                            Similaridade {result.similarity.toFixed(2)} (0–1).
                            Local {Math.round(result.local * 100)}% × {result.localWeight.toFixed(2)}
                            {result.semantic != null
                                ? ` + embeddings ${Math.round(result.semantic * 100)}% × ${result.semanticWeight.toFixed(2)}`
                                : ' (sem embeddings — só comparação local)'}
                            . Acerto ≥ 80%, quase ≥ 55%.
                            {isTranslation
                                ? ' Na tradução o embedding (sentido) pesa mais que o wording.'
                                : ' Na escrita, pontuação/espaços/largura são normalizados antes da nota.'}
                        </p>
                    )}

                    <PracticeTextDiff expected={result.expectedDiff} actual={result.actualDiff} unit={result.unit} />

                    {isTranslation && (
                        <p className={`mt-2 text-sm text-slate-700 ${isCjk ? 'font-chinese' : ''}`}>
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mr-2">Frase</span>
                            {question.sentence}
                        </p>
                    )}
                    {!isTranslation && question.translation && (
                        <p className="mt-2 text-sm text-slate-500 italic">{question.translation}</p>
                    )}

                    {enableAiHelp && (
                        <button
                            type="button"
                            onClick={onExplain}
                            disabled={aiBusy === 'explain'}
                            className="mt-3 w-full py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 inline-flex items-center justify-center gap-1.5"
                        >
                            {aiBusy === 'explain'
                                ? <Loader2 size={13} className="animate-spin" />
                                : <MessageCircleWarning size={13} />}
                            Explicar o erro (IA)
                        </button>
                    )}
                    {explainText && (
                        <div className="mt-2 text-xs text-slate-600 bg-slate-50 border border-slate-100 rounded-xl p-2.5 leading-relaxed">
                            {explainText}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default PracticeAudioCard;
