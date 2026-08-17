import React, { useEffect, useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { Keyword, StudyItem } from '../../types';
import { analyzeSentenceWords, buildMicroQuiz, MicroQuizQuestion } from './newWordsUtils';

interface Props {
    item: StudyItem;
    savedWordsMap: Map<string, Keyword>;
    meaningPool: string[];
    completed: boolean;
    onCompleted: (sentenceId: string) => void;
    onResult?: (isCorrect: boolean, word: string) => void;
}

type Phase = 'idle' | 'quiz' | 'correct' | 'wrong';

const SentenceMicroQuiz: React.FC<Props> = ({
    item,
    savedWordsMap,
    meaningPool,
    completed,
    onCompleted,
    onResult,
}) => {
    const [phase, setPhase] = useState<Phase>(completed ? 'correct' : 'idle');
    const [question, setQuestion] = useState<MicroQuizQuestion | null>(null);
    const [picked, setPicked] = useState<string | null>(null);

    const analysis = useMemo(
        () => analyzeSentenceWords(item, savedWordsMap),
        [item, savedWordsMap]
    );

    const canQuiz = useMemo(() => {
        return buildMicroQuiz(analysis, meaningPool) !== null;
    }, [analysis, meaningPool]);

    useEffect(() => {
        if (completed) setPhase('correct');
    }, [completed]);

    const startQuiz = () => {
        const q = buildMicroQuiz(analysis, meaningPool);
        if (!q) return;
        setQuestion(q);
        setPicked(null);
        setPhase('quiz');
    };

    const answer = (option: string) => {
        if (!question || phase !== 'quiz') return;
        setPicked(option);
        if (option === question.correctMeaning) {
            setPhase('correct');
            onResult?.(true, question.word);
            onCompleted(item.id.toString());
        } else {
            setPhase('wrong');
            onResult?.(false, question.word);
        }
    };

    const retry = () => {
        const q = buildMicroQuiz(analysis, meaningPool, question?.word);
        if (!q) return;
        setQuestion(q);
        setPicked(null);
        setPhase('quiz');
    };

    if (!canQuiz && phase === 'idle') return null;

    if (phase === 'idle') {
        return (
            <button
                type="button"
                onClick={(e) => { e.stopPropagation(); startQuiz(); }}
                className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100 transition-colors"
                title="Micro-desafio: 1 toque, 1 palavra"
            >
                <Icon name="sparkles" size={12} />
                Desafio rápido
            </button>
        );
    }

    if (phase === 'correct' && !question) {
        return (
            <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border border-emerald-200 bg-emerald-50 text-emerald-700">
                <Icon name="check" size={12} />
                Frase dominada
            </div>
        );
    }

    return (
        <div
            className="mt-2 rounded-xl border border-slate-100 bg-slate-50/80 p-3 animate-in fade-in"
            onClick={(e) => e.stopPropagation()}
        >
            {question && (
                <>
                    <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                            <p className="text-[11px] uppercase tracking-wide text-slate-400 font-bold">
                                {question.isNewWord ? 'Palavra nova' : 'Reforço'}
                            </p>
                            <p className="text-lg font-bold text-slate-800 leading-tight">
                                {question.word}
                                {question.pinyin ? (
                                    <span className="ml-2 text-sm font-medium text-slate-500">{question.pinyin}</span>
                                ) : null}
                            </p>
                            <p className="text-xs text-slate-500 mt-0.5">Qual o sentido?</p>
                        </div>
                        {phase === 'correct' && (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-bold">
                                <Icon name="check-circle" size={14} />
                                Acertou
                            </span>
                        )}
                    </div>

                    <div className="flex flex-col gap-1.5">
                        {question.options.map((option) => {
                            const isCorrect = option === question.correctMeaning;
                            const isPicked = picked === option;
                            let style = 'bg-white border-slate-200 text-slate-700 hover:border-brand-300 hover:bg-brand-50';
                            if (phase === 'correct' || phase === 'wrong') {
                                if (isCorrect) style = 'bg-emerald-50 border-emerald-300 text-emerald-800';
                                else if (isPicked) style = 'bg-rose-50 border-rose-300 text-rose-700';
                                else style = 'bg-white border-slate-100 text-slate-400';
                            }
                            return (
                                <button
                                    key={option}
                                    type="button"
                                    disabled={phase !== 'quiz'}
                                    onClick={() => answer(option)}
                                    className={`w-full text-left px-3 py-2 rounded-lg border text-sm font-medium transition-all ${style}`}
                                >
                                    {option}
                                </button>
                            );
                        })}
                    </div>

                    {phase === 'wrong' && (
                        <button
                            type="button"
                            onClick={retry}
                            className="mt-2 text-xs font-semibold text-brand-600 hover:underline"
                        >
                            Tentar de novo
                        </button>
                    )}

                    {phase === 'correct' && (
                        <p className="mt-2 text-xs text-emerald-700 font-medium flex items-center gap-1">
                            <Icon name="zap" size={12} />
                            +10 pts na sua pontuação
                        </p>
                    )}
                </>
            )}
        </div>
    );
};

export default SentenceMicroQuiz;
