import React, { useMemo, useState } from 'react';
import Icon from '../../components/Icon';
import { StudyItem, SupportedLanguage } from '../../types';
import { ColorCorrectionToken, ReadingFontSize, ReadingPrefs, UserComment } from '../../services/localDB';
import { HIGHLIGHT_COLORS, cleanPunctuation, formatTokensToText } from './shared';
import { useSequentialSpeech, SpeechItem } from './useSequentialSpeech';
import CommentDialog from './CommentDialog';

interface Props {
    items: StudyItem[];
    prefs: ReadingPrefs;
    onPrefsChange: (next: ReadingPrefs) => void;
    colorCorrections: Map<string, ColorCorrectionToken[]>;
    isCorrectingColors: boolean;
    onRequestColorCorrection: (sentenceIds: string[]) => void;
    speak: (text: string, language: SupportedLanguage, id?: string) => Promise<void>;
    stopSpeak: () => void;
    playingId: string | null;
    comments: UserComment[];
    onAddComment: (targetType: 'word' | 'sentence', targetKey: string, text: string) => Promise<UserComment>;
    onUpdateComment: (id: string, text: string) => Promise<void>;
    onDeleteComment: (id: string) => Promise<void>;
}

const FONT_SIZE_CLASS: Record<ReadingFontSize, string> = {
    sm: 'text-sm leading-relaxed',
    md: 'text-base leading-relaxed',
    lg: 'text-lg leading-loose',
    xl: 'text-xl leading-loose',
};

const FONT_SIZES: ReadingFontSize[] = ['sm', 'md', 'lg', 'xl'];

const SimpleReadingMode: React.FC<Props> = ({
    items,
    prefs,
    onPrefsChange,
    colorCorrections,
    isCorrectingColors,
    onRequestColorCorrection,
    speak,
    stopSpeak,
    playingId,
    comments,
    onAddComment,
    onUpdateComment,
    onDeleteComment,
}) => {
    // Estado: palavra clicada (pair-highlight)
    const [activeToken, setActiveToken] = useState<{ sentenceId: string; tokenIndex: number } | null>(null);
    // Estado: comentário aberto
    const [commentTarget, setCommentTarget] = useState<{ type: 'word' | 'sentence'; key: string; preview: string } | null>(null);

    const speechItems: SpeechItem[] = useMemo(() => items.map(item => ({
        id: item.id.toString(),
        text: formatTokensToText(item.tokens),
        language: (item.language || 'zh') as SupportedLanguage,
    })), [items]);

    const sequence = useSequentialSpeech(speak, stopSpeak);

    const updatePref = <K extends keyof ReadingPrefs>(key: K, value: ReadingPrefs[K]) => {
        onPrefsChange({ ...prefs, [key]: value });
    };

    const cycleFontSize = () => {
        const idx = FONT_SIZES.indexOf(prefs.fontSize);
        const next = FONT_SIZES[(idx + 1) % FONT_SIZES.length];
        updatePref('fontSize', next);
    };
    const decreaseFontSize = () => {
        const idx = FONT_SIZES.indexOf(prefs.fontSize);
        if (idx > 0) updatePref('fontSize', FONT_SIZES[idx - 1]);
    };

    // Set de sentenceIds sem correção de cores (para o aviso/botão)
    const sentencesWithoutCorrection = useMemo(() => {
        return items.filter(it => !colorCorrections.has(it.id.toString())).map(it => it.id.toString());
    }, [items, colorCorrections]);

    // Comentários indexados por chave
    const commentsByKey = useMemo(() => {
        const map = new Map<string, UserComment[]>();
        comments.forEach(c => {
            const k = `${c.targetType}:${c.targetKey}`;
            const arr = map.get(k) || [];
            arr.push(c);
            map.set(k, arr);
        });
        return map;
    }, [comments]);

    const hasComment = (type: 'word' | 'sentence', key: string) =>
        commentsByKey.has(`${type}:${key}`);

    // Cor de uma palavra na tradução, dado token clicado
    const getActivePairColor = (): { srcColor: string | null; targetWord: string | null; targetColor: string | null } => {
        if (!activeToken) return { srcColor: null, targetWord: null, targetColor: null };
        const tokens = colorCorrections.get(activeToken.sentenceId);
        if (!tokens) return { srcColor: null, targetWord: null, targetColor: null };
        // O índice do token na correção pode não bater 1:1 com tokens originais.
        // Estratégia: a correção da IA já vem com o mesmo número de slots da tradução,
        // então buscamos pela palavra cujo colorIndex == colorIndex do token clicado.
        // Não temos colorIndex do token clicado pelo lado da origem ainda — nesse caso, retornamos null.
        // Usamos fallback: emparelha pela posição do token de origem com o índice da correção, se possível.
        const slot = tokens[activeToken.tokenIndex];
        if (!slot || slot.colorIndex === null || slot.colorIndex === undefined) {
            return { srcColor: null, targetWord: null, targetColor: null };
        }
        const color = HIGHLIGHT_COLORS[slot.colorIndex % HIGHLIGHT_COLORS.length];
        return { srcColor: color.text, targetWord: slot.word, targetColor: color.text };
    };

    const activePair = getActivePairColor();

    return (
        <div className="px-4 pt-3 pb-32 relative">
            {/* Toolbar do modo simples */}
            <div className="sticky top-0 z-30 -mx-4 px-4 pt-2 pb-3 bg-slate-50/95 backdrop-blur border-b border-slate-200 flex flex-wrap gap-2 items-center">
                <button
                    onClick={() => updatePref('showTranslation', !prefs.showTranslation)}
                    className={`px-3 py-1.5 rounded-full text-xs font-medium border transition-colors flex items-center gap-1.5 ${prefs.showTranslation
                        ? 'bg-brand-600 text-white border-brand-600'
                        : 'bg-white text-slate-600 border-slate-300'
                    }`}
                    title={prefs.showTranslation ? 'Ocultar tradução' : 'Mostrar tradução'}
                >
                    <Icon name={prefs.showTranslation ? 'eye' : 'eye-off'} size={14} />
                    Tradução
                </button>

                <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-full px-1.5 py-0.5">
                    <button onClick={decreaseFontSize} className="px-2 text-slate-600 font-bold" title="Diminuir tamanho">A-</button>
                    <button onClick={cycleFontSize} className="px-2 text-slate-700 font-bold" title="Tamanho">{prefs.fontSize.toUpperCase()}</button>
                    <button onClick={() => {
                        const idx = FONT_SIZES.indexOf(prefs.fontSize);
                        if (idx < FONT_SIZES.length - 1) updatePref('fontSize', FONT_SIZES[idx + 1]);
                    }} className="px-2 text-slate-600 font-bold" title="Aumentar tamanho">A+</button>
                </div>

                <button
                    onClick={() => sequence.status === 'idle' ? sequence.start(speechItems) : sequence.stop()}
                    className="px-3 py-1.5 rounded-full text-xs font-medium border bg-emerald-50 text-emerald-700 border-emerald-300 flex items-center gap-1.5"
                    title="Ouvir todo o texto"
                >
                    <Icon name={sequence.status === 'idle' ? 'play' : 'square'} size={14} />
                    {sequence.status === 'idle' ? 'Ouvir tudo' : 'Parar'}
                </button>

                {sentencesWithoutCorrection.length > 0 && (
                    <button
                        onClick={() => onRequestColorCorrection(sentencesWithoutCorrection)}
                        disabled={isCorrectingColors}
                        className="px-3 py-1.5 rounded-full text-xs font-medium border bg-amber-50 text-amber-700 border-amber-300 flex items-center gap-1.5 disabled:opacity-50"
                        title="Pedir correção de cores via IA para frases sem correção"
                    >
                        <Icon name="rotate-ccw" size={14} />
                        {isCorrectingColors ? 'Corrigindo…' : `Corrigir cores (${sentencesWithoutCorrection.length})`}
                    </button>
                )}
            </div>

            {/* Texto corrido — visual de livro */}
            <article className={`mt-4 max-w-2xl mx-auto text-slate-800 ${FONT_SIZE_CLASS[prefs.fontSize]}`}
                style={{ fontFamily: 'Georgia, "Times New Roman", serif' }}
            >
                {items.map((item, idx) => {
                    const sentenceId = item.id.toString();
                    const correction = colorCorrections.get(sentenceId);
                    const isPlaying = playingId === sentenceId || sequence.currentId === sentenceId;
                    const sentenceCommented = hasComment('sentence', sentenceId);

                    return (
                        <p
                            key={sentenceId}
                            className={`mb-5 transition-colors ${isPlaying ? 'bg-emerald-50/60 -mx-2 px-2 rounded' : ''}`}
                        >
                            {/* Botão de áudio individual da frase */}
                            <button
                                onClick={() => speak(formatTokensToText(item.tokens), (item.language || 'zh') as SupportedLanguage, sentenceId)}
                                className="mr-2 inline-flex items-center justify-center w-6 h-6 rounded-full bg-slate-100 hover:bg-emerald-100 text-slate-500 hover:text-emerald-700 align-middle"
                                title="Ouvir esta frase"
                            >
                                <Icon name={playingId === sentenceId ? 'square' : 'volume-2'} size={12} />
                            </button>

                            {/* Tokens da frase original — clicáveis */}
                            {item.tokens.map((token, ti) => {
                                const cleaned = cleanPunctuation(token);
                                const isActive = activeToken?.sentenceId === sentenceId && activeToken?.tokenIndex === ti;
                                const slot = correction?.[ti];
                                const tokenColor = slot && slot.colorIndex !== null && slot.colorIndex !== undefined
                                    ? HIGHLIGHT_COLORS[slot.colorIndex % HIGHLIGHT_COLORS.length]
                                    : null;
                                const wordHasComment = hasComment('word', cleaned.toLowerCase());

                                const baseStyle: React.CSSProperties = {};
                                if (isActive && tokenColor) {
                                    baseStyle.backgroundColor = tokenColor.bg;
                                    baseStyle.color = tokenColor.text;
                                    baseStyle.fontWeight = 600;
                                }

                                return (
                                    <span
                                        key={ti}
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setActiveToken({ sentenceId, tokenIndex: ti });
                                        }}
                                        onContextMenu={(e) => {
                                            e.preventDefault();
                                            setCommentTarget({ type: 'word', key: cleaned.toLowerCase(), preview: cleaned });
                                        }}
                                        onDoubleClick={(e) => {
                                            e.stopPropagation();
                                            setCommentTarget({ type: 'word', key: cleaned.toLowerCase(), preview: cleaned });
                                        }}
                                        className="cursor-pointer rounded px-0.5 transition-colors hover:bg-slate-100"
                                        style={baseStyle}
                                        title={cleaned ? `Clique: emparelhar · Duplo-clique: comentário` : undefined}
                                    >
                                        {token}
                                        {wordHasComment && <sup className="ml-0.5 text-[10px] text-amber-500">●</sup>}
                                    </span>
                                );
                            })}

                            {/* Botão de comentário da frase */}
                            <button
                                onClick={() => setCommentTarget({
                                    type: 'sentence',
                                    key: sentenceId,
                                    preview: formatTokensToText(item.tokens).slice(0, 60),
                                })}
                                className="ml-2 inline-flex items-center justify-center w-6 h-6 rounded-full text-slate-400 hover:text-amber-600 align-middle"
                                title="Comentar esta frase"
                            >
                                <Icon name="message-circle" size={12} />
                                {sentenceCommented && <span className="absolute -mt-3 -ml-1 w-1.5 h-1.5 rounded-full bg-amber-500" />}
                            </button>

                            {/* Tradução opcional */}
                            {prefs.showTranslation && item.translation && (
                                <span className="block mt-1 text-slate-500 italic text-[0.92em]" style={{ fontFamily: 'system-ui, sans-serif' }}>
                                    {correction && correction.length > 0 ? (
                                        correction.map((tok, wi) => {
                                            const c = tok.colorIndex !== null && tok.colorIndex !== undefined
                                                ? HIGHLIGHT_COLORS[tok.colorIndex % HIGHLIGHT_COLORS.length]
                                                : null;
                                            const isPair = activePair.targetWord && tok.word === activePair.targetWord && activeToken?.sentenceId === sentenceId;
                                            return (
                                                <span key={wi}>
                                                    {wi > 0 ? ' ' : ''}
                                                    <span style={{
                                                        color: c?.text,
                                                        fontWeight: c ? 600 : undefined,
                                                        backgroundColor: isPair ? c?.bg : undefined,
                                                        borderRadius: isPair ? 3 : undefined,
                                                        padding: isPair ? '0 2px' : undefined,
                                                    }}>
                                                        {tok.word}
                                                    </span>
                                                </span>
                                            );
                                        })
                                    ) : item.translation}
                                </span>
                            )}
                        </p>
                    );
                })}
            </article>

            {/* Mini-player fixo no rodapé */}
            {sequence.status !== 'idle' && (
                <div className="fixed bottom-16 left-0 right-0 z-40 px-3 pb-2 pointer-events-none">
                    <div className="max-w-md mx-auto bg-white border border-slate-200 rounded-2xl shadow-2xl p-3 flex items-center gap-3 pointer-events-auto">
                        <button onClick={sequence.prev} className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200" title="Anterior">
                            <Icon name="skip-back" size={16} />
                        </button>
                        <button
                            onClick={sequence.status === 'playing' ? sequence.pause : sequence.resume}
                            className="w-11 h-11 rounded-full bg-emerald-600 text-white flex items-center justify-center hover:bg-emerald-700"
                            title={sequence.status === 'playing' ? 'Pausar' : 'Retomar'}
                        >
                            <Icon name={sequence.status === 'playing' ? 'pause' : 'play'} size={18} />
                        </button>
                        <button onClick={sequence.next} className="w-9 h-9 rounded-full bg-slate-100 text-slate-700 flex items-center justify-center hover:bg-slate-200" title="Próxima">
                            <Icon name="skip-forward" size={16} />
                        </button>
                        <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 truncate">
                                Frase {sequence.currentIndex + 1} de {speechItems.length}
                            </p>
                            <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                <div
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{ width: `${speechItems.length > 0 ? ((sequence.currentIndex + 1) / speechItems.length) * 100 : 0}%` }}
                                />
                            </div>
                        </div>
                        <button onClick={sequence.stop} className="w-9 h-9 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200" title="Encerrar">
                            <Icon name="x" size={16} />
                        </button>
                    </div>
                </div>
            )}

            {/* Modal de comentário */}
            {commentTarget && (
                <CommentDialog
                    target={commentTarget}
                    existing={comments.filter(c => c.targetType === commentTarget.type && c.targetKey === commentTarget.key)}
                    onClose={() => setCommentTarget(null)}
                    onAdd={(text) => onAddComment(commentTarget.type, commentTarget.key, text)}
                    onUpdate={onUpdateComment}
                    onDelete={onDeleteComment}
                />
            )}
        </div>
    );
};

export default SimpleReadingMode;
