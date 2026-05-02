import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'polyquest_tutorial_seen_v1';

/**
 * Controla o tutorial do PolyQuest:
 *  - `seen`: se o usuário já viu pelo menos uma vez
 *  - `open`: se o overlay está aberto agora
 *  - `openTutorial()`: abre manualmente
 *  - `closeTutorial()`: fecha (e marca como visto)
 *  - `autoOpenIfFirstTime()`: chame onde quiser disparar a primeira aparição
 */
export function useTutorial() {
    const [seen, setSeen] = useState<boolean>(true);
    const [open, setOpen] = useState(false);

    useEffect(() => {
        try {
            setSeen(localStorage.getItem(STORAGE_KEY) === '1');
        } catch {
            setSeen(true);
        }
    }, []);

    const markSeen = useCallback(() => {
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch {}
        setSeen(true);
    }, []);

    const openTutorial = useCallback(() => setOpen(true), []);

    const closeTutorial = useCallback(() => {
        markSeen();
        setOpen(false);
    }, [markSeen]);

    /** Dispara o tutorial automaticamente caso seja a primeira vez. */
    const autoOpenIfFirstTime = useCallback(() => {
        try {
            if (localStorage.getItem(STORAGE_KEY) !== '1') {
                setOpen(true);
            }
        } catch {
            // se localStorage indisponível, não força o tutorial
        }
    }, []);

    /** Reseta o flag (útil em "ver novamente do zero" ou debugging). */
    const resetSeen = useCallback(() => {
        try { localStorage.removeItem(STORAGE_KEY); } catch {}
        setSeen(false);
    }, []);

    return { seen, open, openTutorial, closeTutorial, autoOpenIfFirstTime, resetSeen };
}
