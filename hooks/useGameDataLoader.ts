import { useMemo } from 'react';
import { StudyItem, GameCard } from '../types';

export interface GameTermPair {
    term: string;
    definition: string;
    originalRefId: string; // the studyItem.id to link back logic/gamification
}

interface UseGameDataLoaderOptions {
    items: StudyItem[];
    activeFolderIds: string[]; // empty means all or none depending on strategy
    requireBothSides?: boolean; // if true, item must have both term and definition
}

/**
 * useGameDataLoader - Adapter hook that transforms raw StudyItems from the
 * user's library into a standardized array of GameTermPair objects that any mini-game
 * can use (like Domino, Memory, etc).
 */
export const useGameDataLoader = ({
    items,
    activeFolderIds,
    requireBothSides = true
}: UseGameDataLoaderOptions) => {

    const { gamePairs, gameCards } = useMemo(() => {
        if (!items || items.length === 0) return { gamePairs: [], gameCards: [] };

        // 1. Identifica palavras permitidas (que aparecem nos textos das pastas selecionadas)
        const allowedWords = new Set<string>();
        const clean = (text: string) => text.toLowerCase().replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, "").trim();

        if (activeFolderIds.length > 0) {
            items.forEach(item => {
                if (item.type !== 'word') {
                    // Verifica se o TEXTO está na pasta
                    const inFolder = activeFolderIds.some(filterPath => {
                        if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                        return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                    });

                    if (inFolder) {
                        item.tokens?.forEach(t => allowedWords.add(clean(t)));
                        item.keywords?.forEach(k => allowedWords.add(clean(k.word)));
                    }
                }
            });
        }

        // 2. Filtra dados (União: Está na pasta OU é uma palavra que aparece na pasta)
        const filteredItems = activeFolderIds.length === 0 ? items.filter(i => {
            if (i.type === 'word') return true;
            if (i.type === 'text') return false;
            if (!i.type && (i.tokens?.length || 0) <= 4 && (i.chinese?.length || 0) <= 8) return true;
            return false;
        }) : items.filter(item => {
            // Verifica pasta explícita
            const explicitMatch = activeFolderIds.some(filterPath => {
                if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
            });

            if (explicitMatch) {
                // Se deu match explícito na pasta, mas é um texto gigante, ignoramos pro minigame
                if (item.type === 'text') return false;
                if (!item.type && (item.tokens?.length || 0) > 4) return false;
                return true;
            }

            // Verifica associação dinâmica (apenas para cards de palavra)
            if ((item.type === 'word' || (!item.type && (item.tokens?.length || 0) <= 4)) && allowedWords.has(clean(item.chinese))) {
                return true;
            }

            return false;
        });

        // 3. Map and Validate
        const pairs: GameTermPair[] = [];
        const cards: GameCard[] = [];

        // Cópia para sortear distratores
        const allTranslations = filteredItems.map(i => i.translation?.trim()).filter(Boolean) as string[];

        for (const item of filteredItems) {
            const term = item.chinese?.trim();
            const definition = item.translation?.trim();

            if (requireBothSides && (!term || !definition)) {
                continue; // Skip invalid items for two-sided games
            }

            const safeTerm = term || '';
            const safeDef = definition || '';
            const id = String(item.id);

            // Popula GamePairs (Dominó, Memory)
            pairs.push({
                term: safeTerm,
                definition: safeDef,
                originalRefId: id
            });

            // Popula GameCards (LingoArena)
            // Sorteia 3 distratores aleatórios que não sejam a resposta correta
            const distractors = [...allTranslations]
                .filter(t => t !== safeDef)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);

            // Se não houver vocabulário suficiente na pasta para 3 distratores, põe fallbacks
            while (distractors.length < 3) {
                distractors.push(`Alternativa ${distractors.length + 1}`);
            }

            cards.push({
                word: safeTerm,
                pinyin: item.pinyin || '',
                meaning: safeDef,
                example: '', // Pode ser preenchido futuramente se item tiver context/example
                distractors: distractors,
                originalRefId: id
            });
        }

        return { gamePairs: pairs, gameCards: cards };
    }, [items, activeFolderIds, requireBothSides]);

    return {
        gamePairs,
        gameCards,
        totalValid: gamePairs.length
    };
};
