import { StudyItem } from '../types';
import { LessonAlignment, SentenceAlignment, normalizeAlignText } from './audioAlignment';

/** IDs de UI que não são o id da frase na Leitura. */
const NON_ITEM_ID = /^(practice-word-|practice-sentence-|swipe-)/;

export function cueItemIdFromSpeakId(speakId?: string): string | null {
    if (!speakId) return null;
    if (NON_ITEM_ID.test(speakId)) return null;
    if (speakId.startsWith('reading-')) return speakId.slice('reading-'.length);
    return speakId;
}

export function findAlignedCue(options: {
    alignment?: LessonAlignment | null;
    items: StudyItem[];
    speakId?: string;
    sentenceItemId?: string;
    text?: string;
}): SentenceAlignment | null {
    const cues = options.alignment?.cues || [];
    if (!cues.length) return null;

    const byId = (id?: string | null) =>
        id ? cues.find(cue => cue.itemId === id) || null : null;

    const fromSentence = byId(options.sentenceItemId);
    if (fromSentence) return fromSentence;

    const fromSpeak = byId(cueItemIdFromSpeakId(options.speakId));
    if (fromSpeak) return fromSpeak;

    const needle = normalizeAlignText(options.text || '');
    if (needle.length < 2) return null;

    for (const item of options.items) {
        if (item.type === 'word') continue;
        const hay = normalizeAlignText(item.chinese || '');
        if (hay && hay === needle) {
            const cue = byId(item.id.toString());
            if (cue) return cue;
        }
    }
    return null;
}
