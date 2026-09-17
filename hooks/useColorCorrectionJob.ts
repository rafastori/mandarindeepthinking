import { useCallback, useEffect, useState } from 'react';
import {
    COLOR_JOB_EVENT,
    ColorJobState,
    getColorJobState,
    startColorCorrectionJob,
} from '../services/colorCorrectionJob';
import { ColorCorrectionInput } from '../services/gemini';
import { SupportedLanguage } from '../types';

export function useColorCorrectionJob() {
    const [job, setJob] = useState<ColorJobState>(() => getColorJobState());

    useEffect(() => {
        setJob(getColorJobState());
        const onJob = (event: Event) => {
            const detail = (event as CustomEvent<ColorJobState>).detail;
            if (detail) setJob(detail);
        };
        window.addEventListener(COLOR_JOB_EVENT, onJob);
        return () => window.removeEventListener(COLOR_JOB_EVENT, onJob);
    }, []);

    const start = useCallback((sentences: ColorCorrectionInput[], lang: SupportedLanguage = 'zh') => {
        return startColorCorrectionJob(sentences, lang);
    }, []);

    return {
        job,
        isRunning: job.status === 'running',
        start,
    };
}
