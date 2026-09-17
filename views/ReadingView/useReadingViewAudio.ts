import { useMemo, useCallback } from 'react';
import { StudyItem, SupportedLanguage } from '../../types';
import { useNativeLessonPlayer } from '../../hooks/useNativeLessonAudio';
import { useLessonAlignment } from '../../hooks/useLessonAlignment';
import { resolveLessonIdForView } from '../../utils/chinesePodAudio';
import { manualAudioLessonCandidates } from '../../utils/dialogueSplit';
import { cuesLookUnshifted, effectiveCueTimes, resolveIntroSkip } from '../../utils/audioAlignment';

export function useReadingViewAudio(opts: {
    filteredData: StudyItem[];
    activeFolderFilters: string[];
    splitAudioCue?: { audioLessonId: string; start: number; end: number } | null;
    stop: () => void;
    speak: (text: string, language: SupportedLanguage, id?: string) => Promise<void>;
}) {
    const selectedStudyFolder = useMemo(() => {
        if (opts.activeFolderFilters.length !== 1) return null;
        const path = opts.activeFolderFilters[0];
        return path && path !== '__uncategorized__' ? path : null;
    }, [opts.activeFolderFilters]);

    const nativeLessonId = useMemo(
        () => resolveLessonIdForView(opts.activeFolderFilters, opts.filteredData.map(item => item.folderPath)),
        [opts.activeFolderFilters, opts.filteredData]
    );
    const audioLessonCandidates = useMemo(() => {
        const ids: string[] = [];
        if (opts.splitAudioCue?.audioLessonId) ids.push(opts.splitAudioCue.audioLessonId);
        if (nativeLessonId) ids.push(nativeLessonId);
        if (selectedStudyFolder) ids.push(...manualAudioLessonCandidates(selectedStudyFolder));
        return [...new Set(ids)];
    }, [opts.splitAudioCue?.audioLessonId, nativeLessonId, selectedStudyFolder]);

    const nativeAudio = useNativeLessonPlayer(audioLessonCandidates, { onBeforePlay: opts.stop });
    const alignedLessonId = nativeAudio.match?.lessonId || audioLessonCandidates[0] || null;
    const lessonAlignment = useLessonAlignment(alignedLessonId, opts.filteredData);
    const cueForId = useCallback((id?: string) => {
        if (!id || !lessonAlignment.alignment) return null;
        const key = id.startsWith('reading-') ? id.slice('reading-'.length) : id;
        return lessonAlignment.alignment.cues.find(cue => cue.itemId === key) || null;
    }, [lessonAlignment.alignment]);
    const introSkip = resolveIntroSkip(lessonAlignment.alignment, nativeAudio.summary?.introSkipSeconds);
    const speakText = useCallback(async (text: string, language: SupportedLanguage, id?: string) => {
        const cue = cueForId(id);
        if (cue && nativeAudio.match) {
            const times = effectiveCueTimes(
                cue,
                introSkip,
                nativeAudio.duration || lessonAlignment.alignment?.duration,
                {
                    legacyUnshifted: cuesLookUnshifted(lessonAlignment.alignment?.cues, introSkip)
                        && lessonAlignment.alignment?.introSkipSeconds == null,
                }
            );
            if (times) {
                opts.stop();
                await nativeAudio.playSegment(times.start, times.end, cue.itemId);
                return;
            }
        }
        nativeAudio.stop();
        await opts.speak(text, language, id);
    }, [cueForId, introSkip, lessonAlignment.alignment, nativeAudio, opts.speak, opts.stop]);
    const stopAllSpeech = useCallback(() => {
        nativeAudio.stop();
        opts.stop();
    }, [nativeAudio, opts.stop]);

    return {
        selectedStudyFolder,
        nativeLessonId,
        nativeAudio,
        alignedLessonId,
        lessonAlignment,
        cueForId,
        introSkip,
        speakText,
        stopAllSpeech,
    };
}
