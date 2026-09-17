import React from 'react';
import { StudyItem, Keyword } from '../../types';
import { ColorCorrectionToken } from '../../services/localDB';
import { HIGHLIGHT_COLORS, cleanPunctuation } from './shared';

export type TokenRenderOpts = {
    loadingWord: string | null;
    savedWordsMap: Map<string, Keyword>;
    wordColorMap: Map<string, number>;
    commentedWords: Set<string>;
    focusNewWords: boolean;
    isColorHighlightEnabled: boolean;
    onTokenClick: (token: string, sentence: StudyItem) => void;
    onComment: (target: { type: 'word' | 'sentence'; key: string; preview: string }) => void;
};

export type TranslationRenderOpts = {
    isColorHighlightEnabled: boolean;
    colorCorrections: Map<string, ColorCorrectionToken[]>;
    savedWordsMap: Map<string, Keyword>;
    wordColorMap: Map<string, number>;
};

export function renderStudyTokens(
    sentence: StudyItem,
    opts: TokenRenderOpts
) {
    return sentence.tokens.map((token, i) => {
        const cleanToken = cleanPunctuation(token);
        const cleanLower = cleanToken.toLowerCase();
        const isContent = cleanLower.length > 0;
        const isSaved = isContent && !!opts.savedWordsMap.get(cleanLower);
        const isNew = isContent && !isSaved;
        const isLoading = opts.loadingWord === cleanToken;
        const colorIdx = opts.wordColorMap.get(cleanLower);
        const color = colorIdx !== undefined ? HIGHLIGHT_COLORS[colorIdx] : null;
        const hasComment = cleanLower.length > 0 && opts.commentedWords.has(cleanLower);
        const useMultiColor = isSaved && opts.isColorHighlightEnabled && color && !opts.focusNewWords;

        let className = 'inline-block px-1 mx-0.5 rounded transition-all border-b-2 mb-1 relative cursor-pointer';
        if (isLoading) className += ' opacity-70 cursor-wait';

        if (opts.focusNewWords && isContent) {
            if (isNew) {
                className += ' bg-amber-50 text-slate-800 border-amber-400 border-dashed font-semibold shadow-[0_0_0_1px_rgba(251,191,36,0.25)]';
            } else if (isSaved) {
                className += useMultiColor
                    ? ' font-medium opacity-70'
                    : ' text-slate-400 border-transparent font-medium opacity-60 hover:opacity-100 hover:text-brand-700 hover:bg-brand-50';
            } else {
                className += ' border-transparent text-slate-500';
            }
        } else if (isSaved && !useMultiColor) {
            className += ' bg-brand-100 text-brand-800 border-brand-500 font-bold';
        } else if (!isSaved && isContent) {
            className += ' hover:bg-brand-50 border-slate-300 border-dotted hover:border-brand-300 text-slate-700';
        } else if (isSaved) {
            className += ' font-bold';
        } else {
            className += ' border-transparent';
        }

        const style = useMultiColor
            ? { color: color!.text, backgroundColor: color!.bg, borderBottomColor: color!.text }
            : undefined;

        return (
            <span
                key={i}
                onClick={(e) => { e.stopPropagation(); opts.onTokenClick(token, sentence); }}
                onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (cleanLower.length > 0) {
                        opts.onComment({ type: 'word', key: cleanLower, preview: cleanToken });
                    }
                }}
                className={className}
                style={style}
                title={isNew ? 'Palavra nova — toque para salvar' : isSaved ? 'Já salva' : undefined}
            >
                {isLoading && (
                    <span className="absolute inset-0 flex items-center justify-center">
                        <div className="w-3 h-3 border-2 border-brand-600 border-t-transparent rounded-full animate-spin"></div>
                    </span>
                )}
                <span className={isLoading ? 'opacity-0' : ''}>{token}</span>
                {hasComment && <sup className="text-amber-500 text-[9px] ml-0.5">●</sup>}
            </span>
        );
    });
}

export function renderColoredTranslation(
    item: StudyItem,
    opts: TranslationRenderOpts
) {
    if (!opts.isColorHighlightEnabled) return item.translation;
    const aiCorrection = opts.colorCorrections.get(item.id.toString());
    if (aiCorrection && aiCorrection.length > 0) {
        return aiCorrection.map((token, wi) => {
            const color = token.colorIndex !== null && token.colorIndex !== undefined
                ? HIGHLIGHT_COLORS[token.colorIndex % HIGHLIGHT_COLORS.length]
                : null;
            return (
                <span key={wi}>
                    {wi > 0 ? ' ' : ''}
                    <span style={color ? { color: color.text, fontWeight: 600 } : undefined}>
                        {token.word}
                    </span>
                </span>
            );
        });
    }

    const sentenceSavedWords: { meaning: string; colorIdx: number }[] = [];
    item.tokens.forEach(token => {
        const clean = cleanPunctuation(token).toLowerCase();
        const kw = opts.savedWordsMap.get(clean);
        const colorIdx = opts.wordColorMap.get(clean);
        if (kw && colorIdx !== undefined && kw.meaning) {
            sentenceSavedWords.push({ meaning: kw.meaning, colorIdx });
        }
    });

    if (sentenceSavedWords.length === 0) return item.translation;

    return (item.translation || '').split(/\s+/).map((word, wi) => {
        let matchColor: { text: string; bg: string } | null = null;
        const cleanWord = word.replace(/[.,!?;:()\\[\\]{}"']/g, '').toLowerCase();
        if (cleanWord.length > 1) {
            for (const sw of sentenceSavedWords) {
                const meanings = sw.meaning.toLowerCase().split(/[,;/]/).map(m => m.trim());
                if (meanings.some(m => m.includes(cleanWord) || cleanWord.includes(m))) {
                    matchColor = HIGHLIGHT_COLORS[sw.colorIdx];
                    break;
                }
            }
        }
        return (
            <span key={wi}>
                {wi > 0 ? ' ' : ''}
                <span style={matchColor ? { color: matchColor.text, fontWeight: 600 } : undefined}>
                    {word}
                </span>
            </span>
        );
    });
}
