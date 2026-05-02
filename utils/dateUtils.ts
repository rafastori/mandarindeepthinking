/**
 * Centralized date utilities to ensure consistent timezone handling.
 * 
 * IMPORTANT: We avoid using new Date() for parsing YYYY-MM-DD because:
 * - new Date("YYYY-MM-DD") is parsed as UTC midnight
 * - getLocalISODate() extracts LOCAL date components
 * - In timezones west of UTC (like Brazil UTC-3), this causes a day shift!
 */

export const getLocalISODate = (date: Date = new Date()): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

export const normalizeDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return '';

    // 1. Already in correct YYYY-MM-DD format (with or without leading zeros)
    // Match: 2024-02-07, 2024-2-7, etc.
    if (/^\d{4}-\d{1,2}-\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('-');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 2. Check for DD/MM/YYYY (common manual entry in Firebase for Brazilian users)
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const day = parts[0].padStart(2, '0');
        const month = parts[1].padStart(2, '0');
        const year = parts[2];
        return `${year}-${month}-${day}`;
    }

    // 3. Check for YYYY/MM/DD
    if (/^\d{4}\/\d{1,2}\/\d{1,2}$/.test(dateStr)) {
        const parts = dateStr.split('/');
        const year = parts[0];
        const month = parts[1].padStart(2, '0');
        const day = parts[2].padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    // 4. Last resort: try Date parsing (SAFE FALLBACK)
    // Use UTC methods to avoid timezone shift if the string is parsed as UTC
    const date = new Date(dateStr);
    if (!isNaN(date.getTime())) {
        const year = date.getUTCFullYear();
        const month = String(date.getUTCMonth() + 1).padStart(2, '0');
        const day = String(date.getUTCDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return dateStr; // Return original if parsing fails
};

/**
 * Calculates the difference in days between two YYYY-MM-DD dates.
 * Returns absolute difference.
 */
export const getDaysDifference = (date1: string, date2: string): number => {
    if (!date1 || !date2) return 0;

    // Parse manually to avoid timezone issues
    // We treat them as UTC dates at midnight to get pure day difference
    const d1 = new Date(date1 + 'T00:00:00Z');
    const d2 = new Date(date2 + 'T00:00:00Z');

    const diffTime = Math.abs(d2.getTime() - d1.getTime());
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Conversão segura de createdAt -> número (epoch ms).
 *
 * Lida com TODOS os formatos que aparecem na biblioteca:
 *  - undefined / null              -> 0
 *  - number (epoch ms ou s)        -> retorna em ms
 *  - string ISO ('2024-01-...')    -> Date.parse (com fallback 0 se inválida)
 *  - Date instance                 -> getTime()
 *  - Firestore Timestamp { seconds, nanoseconds } ou { _seconds, _nanoseconds }
 *
 * **Por que isso importa:** Array.prototype.sort() no V8 (Chrome) tem
 * comportamento indefinido se o comparator retorna NaN — frequentemente
 * degenera para "ordem do storage" (no caso do IndexedDB, ordem do keyPath
 * = `id`). Isso causou o bug do snap-back na reordenação de itens legados
 * que tinham createdAt em formato Firestore Timestamp object.
 */
export function getTimestamp(val: any): number {
    if (!val) return 0;
    if (typeof val === 'number') {
        // Heurística: timestamps em segundos costumam ser < 10 bilhões
        return val < 1e10 ? val * 1000 : val;
    }
    if (typeof val === 'string') {
        const t = Date.parse(val);
        return isNaN(t) ? 0 : t;
    }
    if (val instanceof Date) {
        const t = val.getTime();
        return isNaN(t) ? 0 : t;
    }
    if (typeof val === 'object') {
        // Firestore Timestamp (cliente)
        if (typeof val.seconds === 'number') {
            return val.seconds * 1000 + Math.floor((val.nanoseconds || 0) / 1e6);
        }
        // Firestore Timestamp serializado
        if (typeof val._seconds === 'number') {
            return val._seconds * 1000 + Math.floor((val._nanoseconds || 0) / 1e6);
        }
        // Tem método toDate()?
        if (typeof val.toDate === 'function') {
            try {
                const t = val.toDate().getTime();
                return isNaN(t) ? 0 : t;
            } catch { /* segue */ }
        }
    }
    const fallback = new Date(val).getTime();
    return isNaN(fallback) ? 0 : fallback;
}

/**
 * Normaliza qualquer formato de createdAt para uma ISO string.
 * Usado para "limpar" itens legados na migração — corrige o bug na fonte.
 */
export function normalizeCreatedAt(val: any): string {
    const ms = getTimestamp(val);
    if (ms === 0) return new Date().toISOString();
    return new Date(ms).toISOString();
}

/** Comparator descendente (mais novo primeiro) seguro contra NaN. */
export function compareCreatedAtDesc<T extends { createdAt?: any }>(a: T, b: T): number {
    return getTimestamp(b.createdAt) - getTimestamp(a.createdAt);
}
