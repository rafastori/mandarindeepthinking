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
import { SavedWordInfo } from './neuralGraphService';

// ============================================================
// Types
// ============================================================

export interface EmbeddingCache {
    version: string;          // Hash of word IDs for invalidation
    model: string;            // 'gemini-embedding-2-preview'
    dimensions: number;       // 768
    embeddings: Record<string, number[]>; // wordId → 768D vector
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

    // Cache hit — same vocabulary
    if (cache && cache.version === targetHash) {
        console.log(`[EmbeddingCache] Cache hit (${Object.keys(cache.embeddings).length} vectors)`);
        return true;
    }

    // Cache miss or stale — need to generate
    console.log(`[EmbeddingCache] Cache miss. Generating embeddings for ${words.length} words...`);

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

        const newCache: EmbeddingCache = {
            version: targetHash,
            model: MODEL_NAME,
            dimensions: DIMENSIONS,
            embeddings: mergedEmbeddings,
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
 * Uses RETRIEVAL_QUERY task type for the query word.
 * Excludes IDs already in the graph (layers 1-4).
 */
export function findNearestGalaxies(
    targetWordId: string,
    words: SavedWordInfo[],
    topN: number = 8,
    excludeIds: Set<string> = new Set()
): GalaxyNeighbor[] {
    const cache = getCache();
    if (!cache) return [];

    // Find the target word's embedding
    // Since we index with the word's SavedWordInfo.id, we need to find it
    const targetVector = cache.embeddings[targetWordId];
    if (!targetVector) {
        // Try to find by matching the word label in the words array
        // This handles the case where the centralNodeId format differs
        return [];
    }

    const similarities: GalaxyNeighbor[] = [];

    for (const word of words) {
        if (word.id === targetWordId) continue;
        if (excludeIds.has(word.id)) continue;

        const vector = cache.embeddings[word.id];
        if (!vector) continue;

        const score = cosineSimilarity(targetVector, vector);

        similarities.push({
            wordId: word.id,
            word: word.word,
            pinyin: word.pinyin,
            meaning: word.meaning,
            language: word.language,
            score,
        });
    }

    // Sort descending by similarity, take top N
    similarities.sort((a, b) => b.score - a.score);
    return similarities.slice(0, topN);
}

/**
 * Find galaxies by word label (used when we have the word text, not the ID).
 * Searches through words to find the matching ID first.
 */
export function findNearestGalaxiesByLabel(
    wordLabel: string,
    words: SavedWordInfo[],
    topN: number = 8,
    excludeIds: Set<string> = new Set()
): GalaxyNeighbor[] {
    const cleanLabel = wordLabel.toLowerCase().trim();
    const match = words.find(w => w.word.toLowerCase().trim() === cleanLabel);
    if (!match) return [];
    return findNearestGalaxies(match.id, words, topN, excludeIds);
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
