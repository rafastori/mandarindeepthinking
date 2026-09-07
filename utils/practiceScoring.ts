import { generateWordEmbeddings } from '../services/gemini';
import {
    blendPracticeScore,
    cosineSimilarity,
    diffPracticeTexts,
    gradeFromSimilarity,
    hasCjk,
    localTranslationScore,
    localWritingScore,
    type DiffMark,
    type PracticeGrade,
} from './textSimilarity';

export interface PracticeScoreResult {
    similarity: number;
    percent: number;
    grade: PracticeGrade;
    local: number;
    semantic: number | null;
    localWeight: number;
    semanticWeight: number;
    expected: string;
    actual: string;
    unit: 'char' | 'word';
    expectedDiff: DiffMark[];
    actualDiff: DiffMark[];
}

async function embedCosine(expected: string, actual: string): Promise<number | null> {
    const texts = [expected.trim(), actual.trim()];
    if (!texts[0] || !texts[1]) return null;
    const tryTask = async (taskType: 'SEMANTIC_SIMILARITY' | 'RETRIEVAL_DOCUMENT') => {
        const vectors = await generateWordEmbeddings(texts, taskType);
        if (!vectors?.[0]?.length || !vectors?.[1]?.length) return null;
        const raw = cosineSimilarity(vectors[0], vectors[1]);
        // cosseno de embeddings costuma ser ≥ 0; clamp para a escala 0–1 da UI
        return Math.min(1, Math.max(0, raw));
    };
    try {
        const semantic = await tryTask('SEMANTIC_SIMILARITY');
        if (semantic != null) return semantic;
    } catch {
        // fallback abaixo
    }
    try {
        return await tryTask('RETRIEVAL_DOCUMENT');
    } catch {
        return null;
    }
}

export async function scorePracticeAnswer(opts: {
    mode: 'audio-traducao' | 'audio-escrita';
    expected: string;
    actual: string;
}): Promise<PracticeScoreResult> {
    const expected = (opts.expected || '').trim();
    const actual = (opts.actual || '').trim();
    const local = opts.mode === 'audio-escrita'
        ? localWritingScore(expected, actual)
        : localTranslationScore(expected, actual);

    const semantic = await embedCosine(expected, actual);
    const blended = blendPracticeScore({ mode: opts.mode, local, semantic });
    const unit: 'char' | 'word' = opts.mode === 'audio-escrita' && hasCjk(expected) ? 'char' : 'word';
    const diff = diffPracticeTexts(expected, actual, unit);

    return {
        similarity: blended.similarity,
        percent: Math.round(blended.similarity * 100),
        grade: gradeFromSimilarity(blended.similarity),
        local: blended.local,
        semantic: blended.semantic,
        localWeight: blended.localWeight,
        semanticWeight: blended.semanticWeight,
        expected,
        actual,
        unit,
        expectedDiff: diff.expected,
        actualDiff: diff.actual,
    };
}
