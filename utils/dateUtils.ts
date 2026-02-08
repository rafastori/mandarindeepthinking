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
