import React, { useState, useMemo, useEffect, useCallback } from 'react';
import Icon from '../components/Icon';
import EmptyState from '../components/EmptyState';
import { StudyItem, SupportedLanguage, LabSessionKind } from '../types';
import { useAlignedNativeSpeech } from '../hooks/useAlignedNativeSpeech';
import { collectPhrasePairs } from '../utils/combinePhrases';
import LabModePicker from '../components/LabModePicker';
import CombinePhrasesGame from '../components/CombinePhrasesGame';
import PlayableRoundSummary from '../components/PlayableRoundSummary';
import { practiceComboXp } from '../utils/playableXp';
import { labTokenSequenceMatch } from '../utils/textSimilarity';
import { Zap } from 'lucide-react';

interface LabViewProps {
    data: StudyItem[];
    onResult: (correct: boolean, word: string, type?: 'general' | 'pronunciation', points?: number) => void;
    activeFolderFilters?: string[];
}

const LabView: React.FC<LabViewProps> = ({ data, onResult, activeFolderFilters = [] }) => {
    const { speak, stop, playingId, hasNativeAlignment } = useAlignedNativeSpeech(data, activeFolderFilters);
    const [labKind, setLabKind] = useState<LabSessionKind>('ordenar');
    const [sessionStarted, setSessionStarted] = useState(false);
    const [sessionKey, setSessionKey] = useState(0);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [selectedTokens, setSelectedTokens] = useState<{ id: number, text: string }[]>([]);
    const [shuffledTokens, setShuffledTokens] = useState<{ id: number, text: string }[]>([]);
    const [status, setStatus] = useState<'playing' | 'correct' | 'wrong'>('playing');
    const [labCorrect, setLabCorrect] = useState(0);
    const [labWrong, setLabWrong] = useState(0);
    const [labXP, setLabXP] = useState(0);
    const [labStreak, setLabStreak] = useState(0);
    const [labFinished, setLabFinished] = useState(false);
    const [missHint, setMissHint] = useState(false);

    // Filtra apenas frases longas (com mais de 1 token) para o jogo fazer sentido
    const sentences = useMemo(() => {
        // Filtra dados por pasta se houver filtros ativos
        let filteredData = data;
        if (activeFolderFilters.length > 0) {
            filteredData = data.filter(item => {
                if (activeFolderFilters.includes('__uncategorized__')) {
                    if (!item.folderPath) return true;
                }
                return activeFolderFilters.some(filterPath => {
                    if (item.folderPath === filterPath) return true;
                    if (item.folderPath?.startsWith(filterPath + '/')) return true;
                    return false;
                });
            });
        }

        return filteredData.filter(item => item.tokens && item.tokens.length > 1)
            .sort(() => 0.5 - Math.random());
    }, [data, activeFolderFilters]);

    const phrasePairs = useMemo(
        () => collectPhrasePairs(data, activeFolderFilters),
        [data, activeFolderFilters]
    );

    const currentSentence = sentences[currentIdx];
    const audioId = currentSentence ? `lab-${currentSentence.id}` : '';
    const isListening = !!audioId && playingId === audioId;

    const handleListen = useCallback(() => {
        if (!currentSentence) return;
        if (playingId === audioId) {
            stop();
            return;
        }
        speak(
            currentSentence.chinese,
            (currentSentence.language || 'zh') as SupportedLanguage,
            audioId,
            currentSentence.id.toString()
        );
    }, [audioId, currentSentence, playingId, speak, stop]);

    const initGame = () => {
        if (!currentSentence) return;

        const tokens = currentSentence.tokens.map((t, i) => ({ id: i, text: t }));
        setShuffledTokens([...tokens].sort(() => 0.5 - Math.random()));
        setSelectedTokens([]);
        setStatus('playing');
        setMissHint(false);
        stop();
    };

    useEffect(() => {
        if (!sessionStarted || labKind !== 'ordenar') return;
        initGame();
    }, [currentSentence, sessionStarted, labKind]);

    const handleExitToPicker = () => {
        stop();
        setSessionStarted(false);
        setCurrentIdx(0);
        setStatus('playing');
        setMissHint(false);
        setSelectedTokens([]);
        setShuffledTokens([]);
        setLabCorrect(0);
        setLabWrong(0);
        setLabXP(0);
        setLabStreak(0);
        setLabFinished(false);
    };

    const handleStart = () => {
        if (labKind === 'ordenar' && sentences.length === 0) return;
        if (labKind === 'combinar' && phrasePairs.length === 0) return;
        stop();
        setCurrentIdx(0);
        setStatus('playing');
        setMissHint(false);
        setLabCorrect(0);
        setLabWrong(0);
        setLabXP(0);
        setLabStreak(0);
        setLabFinished(false);
        setSessionKey(k => k + 1);
        setSessionStarted(true);
    };

    const handleSelect = (tokenObj: { id: number, text: string }) => {
        if (status !== 'playing') return;
        setSelectedTokens([...selectedTokens, tokenObj]);
        setShuffledTokens(shuffledTokens.filter(t => t.id !== tokenObj.id));
    };

    const handleUndo = (tokenObj: { id: number, text: string }) => {
        if (status !== 'playing') return;
        setSelectedTokens(selectedTokens.filter(t => t.id !== tokenObj.id));
        setShuffledTokens([...shuffledTokens, tokenObj]);
    };

    const checkAnswer = () => {
        if (!currentSentence || status !== 'playing') return;
        const ok = labTokenSequenceMatch(
            selectedTokens.map(t => t.text),
            currentSentence.tokens
        );

        if (ok) {
            setMissHint(false);
            setStatus('correct');

            speak(
                currentSentence.chinese,
                (currentSentence.language || 'zh') as SupportedLanguage,
                audioId,
                currentSentence.id.toString()
            );

            const nextStreak = labStreak + 1;
            const xp = practiceComboXp(nextStreak);
            onResult(true, currentSentence.chinese, 'general', xp);
            setLabStreak(nextStreak);
            setLabCorrect(n => n + 1);
            setLabXP(x => x + xp);
            setTimeout(() => {
                if (currentIdx < sentences.length - 1) {
                    setCurrentIdx(prev => prev + 1);
                } else {
                    setLabFinished(true);
                }
            }, 2000);
            return;
        }

        // Errou a ordem: sem XP, sem travar, sem gravar erro global.
        // Acentos não entram na comparação (labTokenSequenceMatch).
        setLabStreak(0);
        setMissHint(true);
        window.setTimeout(() => setMissHint(false), 1600);
    };

    const skipSentence = () => {
        if (status === 'correct') return;
        stop();
        setLabStreak(0);
        setMissHint(false);
        setLabWrong(n => n + 1);
        if (currentIdx < sentences.length - 1) {
            setCurrentIdx(prev => prev + 1);
        } else {
            setLabFinished(true);
        }
    };

    if (!sessionStarted) {
        return (
            <LabModePicker
                selected={labKind}
                onSelect={setLabKind}
                onStart={handleStart}
                ordenarReady={sentences.length > 0}
                combinableReady={phrasePairs.length > 0}
                ordenarCount={sentences.length}
                combinableCount={phrasePairs.length}
            />
        );
    }

    if (labKind === 'combinar') {
        return (
            <CombinePhrasesGame
                key={sessionKey}
                pairs={phrasePairs}
                onResult={onResult}
                onExit={handleExitToPicker}
                speak={speak}
                stop={stop}
                playingId={playingId}
            />
        );
    }

    if (sentences.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <EmptyState msg="Laboratório de Frases" icon="flask-conical" />
                <p className="text-slate-400 text-sm mt-2">Adicione textos com frases completas para desbloquear este laboratório.</p>
                <button type="button" onClick={handleExitToPicker} className="mt-4 text-sm font-bold text-brand-600">
                    Voltar aos modos
                </button>
            </div>
        );
    }

    if (labFinished) {
        return (
            <div className="h-full flex flex-col max-w-md mx-auto">
                <div className="p-4">
                    <button type="button" onClick={handleExitToPicker} className="text-[11px] font-bold text-slate-400 hover:text-brand-600">
                        ← Modos
                    </button>
                </div>
                <PlayableRoundSummary
                    title="Frases ordenadas"
                    subtitle="Acertos valem XP. Erros de ordem não travam o jogo (só ficam sem pontos). Pular conta no resumo da rodada, sem erro global."
                    correct={labCorrect}
                    total={sentences.length}
                    wrong={labWrong}
                    xp={labXP}
                    onDone={handleExitToPicker}
                />
            </div>
        );
    }

    const isGerman = currentSentence.language === 'de';

    return (
        <div className="p-6 h-full flex flex-col pb-24 max-w-md mx-auto">
            <div className="flex items-center justify-between mb-2 flex-shrink-0">
                <button
                    type="button"
                    onClick={handleExitToPicker}
                    className="text-[11px] font-bold text-slate-400 hover:text-brand-600"
                >
                    ← Modos
                </button>
                <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                    Frase {currentIdx + 1} de {sentences.length}
                </span>
                <span className="flex items-center gap-0.5 text-[11px] font-extrabold text-brand-700">
                    <Zap size={11} className="fill-current" />
                    {labXP}
                </span>
            </div>
            <div className="flex-1 flex flex-col justify-center">

                {/* Área da Resposta */}
                <div className={`min-h-[120px] bg-slate-100 rounded-2xl p-4 mb-2 flex flex-wrap gap-2 content-start border-2 transition-colors ${
                    status === 'correct' ? 'border-green-400 bg-green-50' :
                    missHint ? 'border-amber-300 bg-amber-50' : 'border-slate-200'
                }`}>
                    {selectedTokens.map((token) => (
                        <button
                            key={token.id}
                            onClick={() => handleUndo(token)}
                            className={`bg-white px-3 py-2 rounded-lg shadow-sm font-medium ${isGerman ? 'font-sans' : 'font-chinese'} animate-pop hover:bg-red-50 hover:text-red-500`}
                        >
                            {token.text}
                        </button>
                    ))}
                    {selectedTokens.length === 0 && (
                        <span className="text-slate-400 text-sm w-full text-center mt-8 self-center">Toque nas palavras abaixo...</span>
                    )}
                </div>
                {missHint && status === 'playing' && (
                    <p className="text-center text-xs font-bold text-amber-700 mb-4">
                        Quase! Sem pontos desta vez — ajuste a ordem e tente de novo. Acentos não importam.
                    </p>
                )}
                {!(missHint && status === 'playing') && (
                    <div className="mb-4" />
                )}

                {/* Tradução — a frase em chinês continua oculta */}
                <p className="text-center text-slate-500 italic mb-4 text-sm px-4">
                    "{currentSentence.translation}"
                </p>

                <button
                    type="button"
                    onClick={handleListen}
                    className={`mx-auto mb-8 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${isListening
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : hasNativeAlignment
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                            : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={hasNativeAlignment ? 'Ouvir o trecho nativo da aula' : 'Ouvir a frase (TTS)'}
                >
                    <Icon name={isListening ? 'square' : 'volume-2'} size={14} />
                    {isListening ? 'Parar' : 'Ouvir'}
                </button>

                {/* Área das Peças */}
                <div className="flex flex-wrap gap-2 justify-center content-center min-h-[100px]">
                    {shuffledTokens.map((token) => (
                        <button
                            key={token.id}
                            onClick={() => handleSelect(token)}
                            className={`bg-white border border-slate-200 text-slate-700 px-4 py-3 rounded-xl shadow-sm hover:border-brand-300 hover:shadow-md transition-all active:scale-95 ${isGerman ? 'font-sans' : 'font-chinese'} text-lg`}
                        >
                            {token.text}
                        </button>
                    ))}
                </div>
            </div>

            {/* Controles */}
            <div className="flex flex-col gap-2 mt-auto pt-6">
                <div className="flex gap-3">
                    <button
                        onClick={initGame}
                        className="p-4 text-slate-400 hover:text-slate-600 rounded-xl bg-slate-50 active:bg-slate-200 transition-colors"
                        title="Embaralhar de novo"
                    >
                        <Icon name="rotate-ccw" size={24} />
                    </button>

                    <button
                        onClick={checkAnswer}
                        disabled={shuffledTokens.length > 0 || status === 'correct'}
                        className="flex-1 bg-brand-600 text-white font-bold rounded-xl shadow-lg hover:bg-brand-700 disabled:opacity-50 disabled:shadow-none transition-all py-4"
                    >
                        {status === 'correct' ? 'Muito Bem!' : 'Verificar'}
                    </button>
                </div>
                {status === 'playing' && (
                    <button
                        type="button"
                        onClick={skipSentence}
                        className="text-[11px] font-bold text-slate-400 hover:text-slate-600 py-1"
                    >
                        Pular sem XP
                    </button>
                )}
            </div>
        </div>
    );
};

export default LabView;