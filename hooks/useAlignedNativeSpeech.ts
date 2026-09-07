import { useCallback, useMemo } from 'react';
import { StudyItem, SupportedLanguage } from '../types';
import { usePuterSpeech } from './usePuterSpeech';
import { useNativeLessonPlayer } from './useNativeLessonAudio';
import { useLessonAlignment } from './useLessonAlignment';
import { extractLessonIdsFromFolderPath, resolveLessonIdForView } from '../utils/chinesePodAudio';
import {
    cuesLookUnshifted,
    effectiveCueTimes,
    resolveIntroSkip,
} from '../utils/audioAlignment';
import { findAlignedCue } from '../utils/alignedSpeech';

/**
 * Fala uma frase com o MP3 nativo alinhado da Leitura, se existir.
 * Sem correspondência (aula, arquivo ou timestamp), cai no Puter/TTS atual.
 */
export function useAlignedNativeSpeech(
    items: StudyItem[],
    folderFilters: string[] = []
) {
    const tts = usePuterSpeech();
    const lessonId = useMemo(
        () => resolveLessonIdForView(folderFilters, items.map(item => item.folderPath)),
        [folderFilters, items]
    );
    const lessonItems = useMemo(() => {
        if (!lessonId) return items.filter(item => item.type !== 'word');
        return items.filter(item =>
            item.type !== 'word'
            && extractLessonIdsFromFolderPath(item.folderPath).includes(lessonId)
        );
    }, [items, lessonId]);

    const native = useNativeLessonPlayer(lessonId, { onBeforePlay: tts.stop });
    const alignment = useLessonAlignment(lessonId, lessonItems);
    const introSkip = resolveIntroSkip(alignment.alignment, native.summary?.introSkipSeconds);
    const hasNativeAlignment = !!native.match && (alignment.alignment?.cues.length || 0) > 0;

    const speak = useCallback(async (
        text: string,
        language: SupportedLanguage,
        id?: string,
        sentenceItemId?: string
    ) => {
        const cue = findAlignedCue({
            alignment: alignment.alignment,
            items: lessonItems,
            speakId: id,
            sentenceItemId,
            text,
        });
        if (cue && native.match) {
            const times = effectiveCueTimes(
                cue,
                introSkip,
                native.duration || alignment.alignment?.duration,
                {
                    legacyUnshifted: cuesLookUnshifted(alignment.alignment?.cues, introSkip)
                        && alignment.alignment?.introSkipSeconds == null,
                }
            );
            if (times) {
                tts.stop();
                await native.playSegment(times.start, times.end, id || cue.itemId);
                return;
            }
        }
        native.stop();
        return tts.speak(text, language, id);
    }, [alignment.alignment, introSkip, lessonItems, native, tts]);

    const stop = useCallback(() => {
        native.stop();
        tts.stop();
    }, [native, tts]);

    return {
        speak,
        stop,
        playingId: native.playingSegmentId || tts.playingId,
        hasNativeAlignment,
    };
}
