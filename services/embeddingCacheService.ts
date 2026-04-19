/**
 * embeddingCacheService.ts
 *
 * Manages semantic embeddings for the Neural Map "Cosmos Semântico" feature.
 * Uses Gemini's `gemini-embedding-2-preview` model (768 dimensions) to create
 * vector representations of the user's vocabulary, enabling cosine-similarity
 * based "galaxy neighbor" discovery.
 *
 * Skills applied:
 * - @typescript-expert: Strict interfaces for cache, embeddings, neighbors
 * - @react-best-practices: Minimal re-computation, stable cache invalidation
 * - @debugging-expert: Graceful fallback when API fails
 */

import { generateWordEmbeddings } from './gemini';
import { SavedWordInfo, cleanPunctuation } from './neuralGraphService';

// ============================================================
// Types
// ============================================================

interface PrecomputedNeighbor {
    wordId: string;
    score: number;
}

export interface EmbeddingCache {
    version: string;          // Hash of word IDs for invalidation
    model: string;            // 'gemini-embedding-2-preview'
    dimensions: number;       // 768
    embeddings: Record<string, number[]>; // wordId → 768D vector
    neighbors?: Record<string, PrecomputedNeighbor[]>; // wordId → top-N nearest (optional for back-compat)
    createdAt: number;        // timestamp
}

export interface GalaxyNeighbor {
    wordId: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: string;
    score: number; // cosine similarity 0.0 - 1.0
}

// ============================================================
// Constants
// ============================================================

const CACHE_KEY = 'neural_embeddings_v2';
const MODEL_NAME = 'gemini-embedding-2-preview';
const DIMENSIONS = 768;
const PRECOMPUTED_TOP_N = 20; // headroom so excludeLabels can still yield 8 results after filtering

// ============================================================
// Helpers
// ============================================================

/** Simple hash of word IDs for cache invalidation */
function hashWordIds(words: SavedWordInfo[]): string {
    const sorted = words.map(w => w.id).sort().join('|');
    let hash = 0;
    for (let i = 0; i < sorted.length; i++) {
        const char = sorted.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32-bit int
    }
    return `v2-${hash.toString(36)}-${words.length}`;
}

/** Build embedding text for a word: "word (pinyin) - meaning" */
function buildEmbeddingText(word: SavedWordInfo): string {
    const parts = [word.word];
    if (word.pinyin) parts.push(`(${word.pinyin})`);
    if (word.meaning) parts.push(`- ${word.meaning}`);
    return parts.join(' ');
}

/** Cosine similarity between two vectors */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    const denominator = Math.sqrt(normA) * Math.sqrt(normB);
    return denominator === 0 ? 0 : dotProduct / denominator;
}

/**
 * Pre-compute top-N nearest neighbors for every word in the vocabulary.
 * Runs locally (no API) — O(n²) cosine ops with pre-computed norms.
 * For n=1000 @ 768 dims ~1-2s on modern JS; negligible for typical vocabs.
 */
function precomputeNeighbors(
    embeddings: Record<string, number[]>,
    topN: number
): Record<string, PrecomputedNeighbor[]> {
    const ids = Object.keys(embeddings);
    const result: Record<string, PrecomputedNeighbor[]> = {};
    const norms: Record<string, number> = {};

    for (const id of ids) {
        const v = embeddings[id];
        let sum = 0;
        for (let i = 0; i < v.length; i++) sum += v[i] * v[i];
        norms[id] = Math.sqrt(sum);
    }

    for (let i = 0; i < ids.length; i++) {
        const idA = ids[i];
        const a = embeddings[idA];
        const normA = norms[idA];
        if (normA === 0) { result[idA] = []; continue; }

        const sims: PrecomputedNeighbor[] = [];
        for (let j = 0; j < ids.length; j++) {
            if (i === j) continue;
            const idB = ids[j];
            const normB = norms[idB];
            if (normB === 0) continue;
            const b = embeddings[idB];
            let dot = 0;
            for (let k = 0; k < a.length; k++) dot += a[k] * b[k];
            sims.push({ wordId: idB, score: dot / (normA * normB) });
        }
        sims.sort((x, y) => y.score - x.score);
        result[idA] = sims.slice(0, topN);
    }

    return result;
}

// ============================================================
// Cache Operations
// ============================================================

/** Read cache from localStorage */
function getCache(): EmbeddingCache | null {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        return JSON.parse(raw) as EmbeddingCache;
    } catch {
        return null;
    }
}

/** Write cache to localStorage */
function setCache(cache: EmbeddingCache): void {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify(cache));
    } catch (e) {
        console.warn('[EmbeddingCache] Failed to write cache:', e);
    }
}

// ============================================================
// Public API
// ============================================================

/**
 * Ensures embeddings are ready for all saved words.
 * If cache is stale or missing, calls Gemini embedding API in batch.
 * Returns true if embeddings are available, false if failed.
 */
export async function ensureEmbeddingsReady(
    words: SavedWordInfo[]
): Promise<boolean> {
    if (words.length === 0) return false;

    const targetHash = hashWordIds(words);
    const cache = getCache();

    // Cache hit — same vocabulary AND neighbors already pre-computed
    if (cache && cache.version === targetHash && cache.neighbors) {
        console.log(`[EmbeddingCache] Cache hit (${Object.keys(cache.embeddings).length} vectors, ${Object.keys(cache.neighbors).length} neighbor indexes)`);
        return true;
    }

    // Cache miss, stale, or missing neighbors — need to (re)generate
    console.log(`[EmbeddingCache] Cache miss or incomplete. Generating embeddings for ${words.length} words...`);

    try {
        // Reuse existing embeddings for words that haven't changed
        const existingEmbeddings = cache?.embeddings || {};
        const newWords = words.filter(w => !existingEmbeddings[w.id]);
        const unchangedEmbeddings: Record<string, number[]> = {};

        // Keep embeddings for words that still exist
        for (const w of words) {
            if (existingEmbeddings[w.id]) {
                unchangedEmbeddings[w.id] = existingEmbeddings[w.id];
            }
        }

        let newEmbeddings: Record<string, number[]> = {};

        if (newWords.length > 0) {
            const texts = newWords.map(buildEmbeddingText);
            const vectors = await generateWordEmbeddings(texts, 'RETRIEVAL_DOCUMENT');

            if (!vectors || vectors.length !== newWords.length) {
                console.error('[EmbeddingCache] API returned wrong number of vectors');
                // Still usable if we have some cached embeddings
                if (Object.keys(unchangedEmbeddings).length > 0) return true;
                return false;
            }

            for (let i = 0; i < newWords.length; i++) {
                newEmbeddings[newWords[i].id] = vectors[i];
            }
        }

        const mergedEmbeddings = { ...unchangedEmbeddings, ...newEmbeddings };

        // Pre-compute pairwise neighbors once — local cosine, zero API cost
        const t0 = performance.now();
        const neighbors = precomputeNeighbors(mergedEmbeddings, PRECOMPUTED_TOP_N);
        console.log(`[EmbeddingCache] Pre-computed top-${PRECOMPUTED_TOP_N} neighbors for ${Object.keys(neighbors).length} words in ${Math.round(performance.now() - t0)}ms`);

        const newCache: EmbeddingCache = {
            version: targetHash,
            model: MODEL_NAME,
            dimensions: DIMENSIONS,
            embeddings: mergedEmbeddings,
            neighbors,
            createdAt: Date.now(),
        };

        setCache(newCache);
        console.log(`[EmbeddingCache] Cached ${Object.keys(mergedEmbeddings).length} vectors (${newWords.length} new, ${Object.keys(unchangedEmbeddings).length} reused)`);
        return true;
    } catch (error) {
        console.error('[EmbeddingCache] Failed to generate embeddings:', error);
        return false;
    }
}

/**
 * Find the N nearest semantic neighbors for a given word.
 * Uses pre-computed neighbor table when available (fast path — O(topN)).
 * Falls back to on-the-fly cosine computation for back-compat with older caches.
 * Excludes words whose cleaned label is in `excludeLabels`.
 */
export function findNearestGalaxies(
    targetWordId: string,
    words: SavedWordInfo[],
    topN: number = 8,
    excludeLabels: Set<string> = new Set()
): GalaxyNeighbor[] {
    const cache = getCache();
    if (!cache) return [];

    const wordMap = new Map(words.map(w => [w.id, w]));

    // Fast path: pre-computed neighbors
    if (cache.neighbors && cache.neighbors[targetWordId]) {
        const result: GalaxyNeighbor[] = [];
        for (const { wordId, score } of cache.neighbors[targetWordId]) {
            const w = wordMap.get(wordId);
            if (!w) continue; // word was deleted from vocabulary
            if (excludeLabels.has(cleanPunctuation(w.word))) continue;
            result.push({
                wordId: w.id,
                word: w.word,
                pinyin: w.pinyin,
                meaning: w.meaning,
                language: w.language,
                score,
            });
            if (result.length >= topN) break;
        }
        return result;
    }

    // Fallback path: on-the-fly cosine (older cache without neighbors table)
    const targetVector = cache.embeddings[targetWordId];
    if (!targetVector) return [];

    const similarities: GalaxyNeighbor[] = [];
    for (const word of words) {
        if (word.id === targetWordId) continue;
        if (excludeLabels.has(cleanPunctuation(word.word))) continue;

        const vector = cache.embeddings[word.id];
        if (!vector) continue;

        similarities.push({
            wordId: word.id,
            word: word.word,
            pinyin: word.pinyin,
            meaning: word.meaning,
            language: word.language,
            score: cosineSimilarity(targetVector, vector),
        });
    }

    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, topN);
}

/**
 * Find galaxies by word label (used when we have the word text, not the ID).
 * Uses cleanPunctuation on both sides so matching survives ASCII punctuation
 * and case differences across languages.
 */
export function findNearestGalaxiesByLabel(
    wordLabel: string,
    words: SavedWordInfo[],
    topN: number = 8,
    excludeLabels: Set<string> = new Set()
): GalaxyNeighbor[] {
    const cleanQuery = cleanPunctuation(wordLabel);
    const match = words.find(w => cleanPunctuation(w.word) === cleanQuery);
    if (!match) {
        console.warn(`[EmbeddingCache] No saved word matches "${wordLabel}" — galaxies unavailable (word not in saved vocabulary).`);
        return [];
    }
    return findNearestGalaxies(match.id, words, topN, excludeLabels);
}

/**
 * Check if embeddings cache exists and is current.
 */
export function hasValidCache(words: SavedWordInfo[]): boolean {
    if (words.length === 0) return false;
    const cache = getCache();
    if (!cache) return false;
    return cache.version === hashWordIds(words);
}
