import { StudyItem, SupportedLanguage } from '../types';

export interface CardItem {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    context: string;
    language?: SupportedLanguage;
    sourceId: string;
}

export const getSavedItems = (data: StudyItem[], savedIds: string[]): CardItem[] => {
    let rawList: CardItem[] = [];

    data.forEach(item => {
        // CASO 1: Card solto (Firebase)
        if (savedIds.includes(item.id.toString())) {
            rawList.push({
                id: `item-${item.id}`, // Prefixo para evitar colisão
                word: item.chinese,
                pinyin: item.pinyin,
                meaning: item.translation,
                context: item.originalSentence || item.chinese,
                language: item.language,
                sourceId: item.id.toString()
            });
        }

        // CASO 2: Keyword dentro de texto (Antigo)
        if (item.keywords) {
            item.keywords.forEach(k => {
                if (savedIds.includes(k.id)) {
                    rawList.push({
                        id: `kw-${k.id}`, // Prefixo diferente
                        word: k.word,
                        pinyin: k.pinyin,
                        meaning: k.meaning,
                        context: item.chinese,
                        language: item.language,
                        sourceId: k.id
                    });
                }
            });
        }
    });

    // 1. Filtra por ID único primeiro (técnico)
    const uniqueById = rawList.filter((item, index, self) =>
        index === self.findIndex((t) => t.id === item.id)
    );

    // 2. Filtra por PALAVRA (conteúdo) para evitar repetição pedagógica
    // (Se "Hallo" aparecer 2x com IDs diferentes, mantemos só a primeira)
    const uniqueByWord = uniqueById.filter((item, index, self) =>
        index === self.findIndex((t) => t.word.toLowerCase().trim() === item.word.toLowerCase().trim())
    );

    return uniqueByWord;
};