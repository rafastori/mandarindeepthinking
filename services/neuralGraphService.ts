/**
 * neuralGraphService.ts
 * 
 * Builds graph data structures for the Neural Graph visualization.
 * Transforms StudyItem[] + savedIds[] into nodes and links for react-force-graph-2d.
 * 
 * Skills applied:
 * - typescript-expert: Strict interfaces for all graph data
 * - react-best-practices (js-set-map-lookups): Set<string> for O(1) savedId lookups
 * - react-best-practices (js-combine-iterations): Single pass through data where possible
 */

import { StudyItem, SupportedLanguage } from '../types';

// ============================================================
// Types
// ============================================================

export interface GraphNode {
    id: string;
    label: string;
    type: 'word' | 'sentence' | 'related-word' | 'proximity';
    pinyin?: string;
    meaning?: string;
    language?: SupportedLanguage;
    sentenceText?: string;
    sentenceTranslation?: string;
    sourceItemId?: string;
    /** Number of connections this node has (for sizing) */
    connectionCount?: number;
}

export interface GraphLink {
    source: string;
    target: string;
}

export interface NeuralGraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export interface SavedWordInfo {
    id: string;
    word: string;
    pinyin: string;
    meaning: string;
    language?: SupportedLanguage;
}

// ============================================================
// Helper: Clean punctuation from text for matching
// ============================================================

const cleanPunctuation = (text: string): string =>
    text.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, '').trim().toLowerCase();

// ============================================================
// Build graph data for a specific word
// ============================================================

/**
 * Builds a 3-layer neural graph for a given word:
 * 1. Central node: the selected word
 * 2. Sentence nodes: all StudyItems where the word appears (in tokens or keywords)
 * 3. Related word nodes: other saved words that appear in those same sentences
 */
export function buildGraphForWord(
    word: string,
    data: StudyItem[],
    savedIds: string[]
): NeuralGraphData {
    const nodes: GraphNode[] = [];
    const links: GraphLink[] = [];
    const nodeIds = new Set<string>();
    const savedIdsSet = new Set(savedIds);
    const cleanWord = cleanPunctuation(word);

    if (!cleanWord) {
        console.warn('[NeuralGraph] Empty word provided');
        return { nodes: [], links: [] };
    }

    // --- Layer 1: Central word node ---
    const centralNodeId = `word:${cleanWord}`;

    // Find the word info from data (check keywords and word-type items)
    let centralInfo: { pinyin: string; meaning: string; language?: SupportedLanguage } = {
        pinyin: '',
        meaning: '',
    };

    for (const item of data) {
        // Check if it's a standalone word card matching our word
        if (item.type === 'word' && cleanPunctuation(item.chinese) === cleanWord) {
            centralInfo = { pinyin: item.pinyin, meaning: item.translation, language: item.language };
            break;
        }
        // Check keywords
        const kw = item.keywords?.find(k => cleanPunctuation(k.word) === cleanWord);
        if (kw) {
            centralInfo = { pinyin: kw.pinyin, meaning: kw.meaning, language: kw.language };
            break;
        }
    }

    nodes.push({
        id: centralNodeId,
        label: word,
        type: 'word',
        pinyin: centralInfo.pinyin,
        meaning: centralInfo.meaning,
        language: centralInfo.language,
        connectionCount: 0, // Will be updated
    });
    nodeIds.add(centralNodeId);

    // --- Layer 2: Find all sentences containing this word ---
    const sentenceItems: StudyItem[] = [];

    for (const item of data) {
        if (item.type === 'word') continue; // Skip standalone word cards

        // Check if word appears in tokens
        const tokenMatch = item.tokens?.some(t => cleanPunctuation(t) === cleanWord);
        // Check if word appears in keywords
        const keywordMatch = item.keywords?.some(k => cleanPunctuation(k.word) === cleanWord);

        if (tokenMatch || keywordMatch) {
            sentenceItems.push(item);
        }
    }

    // Also check word cards that have this word and an originalSentence
    for (const item of data) {
        if (item.type === 'word' && cleanPunctuation(item.chinese) === cleanWord && item.originalSentence) {
            // Find the parent sentence item by originalSentence text
            const parentItem = data.find(d =>
                d.type !== 'word' && d.chinese === item.originalSentence
            );
            if (parentItem && !sentenceItems.includes(parentItem)) {
                sentenceItems.push(parentItem);
            }
        }
    }

    // Create sentence nodes
    for (const sentence of sentenceItems) {
        const sentenceNodeId = `sentence:${sentence.id}`;
        if (nodeIds.has(sentenceNodeId)) continue;

        const truncatedLabel = sentence.chinese.length > 40
            ? sentence.chinese.substring(0, 40) + '…'
            : sentence.chinese;

        nodes.push({
            id: sentenceNodeId,
            label: truncatedLabel,
            type: 'sentence',
            sentenceText: sentence.chinese,
            sentenceTranslation: sentence.translation,
            language: sentence.language,
            sourceItemId: sentence.id.toString(),
            connectionCount: 0,
        });
        nodeIds.add(sentenceNodeId);

        // Link central word → sentence
        links.push({ source: centralNodeId, target: sentenceNodeId });
    }

    // --- Layer 3: Related saved words in same sentences ---
    for (const sentence of sentenceItems) {
        const sentenceNodeId = `sentence:${sentence.id}`;

        // Check tokens for saved words
        if (sentence.tokens) {
            for (const token of sentence.tokens) {
                const cleanToken = cleanPunctuation(token);
                if (!cleanToken || cleanToken === cleanWord) continue;

                // Check if this token is a saved word
                const isSaved = checkIfSaved(cleanToken, data, savedIdsSet);
                if (!isSaved) continue;

                const relatedNodeId = `word:${cleanToken}`;

                if (!nodeIds.has(relatedNodeId)) {
                    // Find word info
                    const wordInfo = findWordInfo(cleanToken, data);
                    nodes.push({
                        id: relatedNodeId,
                        label: token.replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"'´]/g, '').trim(),
                        type: 'related-word',
                        pinyin: wordInfo?.pinyin || '',
                        meaning: wordInfo?.meaning || '',
                        language: wordInfo?.language,
                        connectionCount: 0,
                    });
                    nodeIds.add(relatedNodeId);
                }

                // Link sentence → related word (avoid duplicate links)
                const linkExists = links.some(
                    l => l.source === sentenceNodeId && l.target === relatedNodeId
                );
                if (!linkExists) {
                    links.push({ source: sentenceNodeId, target: relatedNodeId });
                }
            }
        }

        // Also check keywords for saved words
        if (sentence.keywords) {
            for (const kw of sentence.keywords) {
                const cleanKw = cleanPunctuation(kw.word);
                if (cleanKw === cleanWord) continue;
                if (!savedIdsSet.has(kw.id)) continue;

                const relatedNodeId = `word:${cleanKw}`;

                if (!nodeIds.has(relatedNodeId)) {
                    nodes.push({
                        id: relatedNodeId,
                        label: kw.word,
                        type: 'related-word',
                        pinyin: kw.pinyin,
                        meaning: kw.meaning,
                        language: kw.language,
                        connectionCount: 0,
                    });
                    nodeIds.add(relatedNodeId);
                }

                const linkExists = links.some(
                    l => l.source === sentenceNodeId && l.target === relatedNodeId
                );
                if (!linkExists) {
                    links.push({ source: sentenceNodeId, target: relatedNodeId });
                }
            }
        }
    }

    // --- Layer 4: Proximity nodes (2nd-degree co-occurrence) ---
    const MAX_PROXIMITY = 25;
    const proximityCandidates = new Map<string, { count: number; info: { pinyin: string; meaning: string; language?: SupportedLanguage } | null; closestConnectedId: string }>();

    // For each related word (layer 3), find OTHER sentences it appears in
    const relatedWordNodes = nodes.filter(n => n.type === 'related-word');
    for (const relNode of relatedWordNodes) {
        const relClean = cleanPunctuation(relNode.label);
        for (const item of data) {
            if (item.type === 'word') continue;
            const sentenceNodeId = `sentence:${item.id}`;
            if (nodeIds.has(sentenceNodeId)) continue; // Skip sentences already in graph

            const tokenMatch = item.tokens?.some(t => cleanPunctuation(t) === relClean);
            const keywordMatch = item.keywords?.some(k => cleanPunctuation(k.word) === relClean);
            if (!tokenMatch && !keywordMatch) continue;

            // This sentence contains the related word — extract its OTHER saved words
            const allTokens = [
                ...(item.tokens || []).map(t => ({ clean: cleanPunctuation(t), raw: t })),
                ...(item.keywords || []).filter(k => savedIdsSet.has(k.id)).map(k => ({ clean: cleanPunctuation(k.word), raw: k.word })),
            ];

            for (const { clean: ct, raw: rt } of allTokens) {
                if (!ct || ct === cleanWord || ct === relClean) continue;
                const candidateNodeId = `word:${ct}`;
                if (nodeIds.has(candidateNodeId)) continue; // Already in graph

                // Must be a saved word
                if (!checkIfSaved(ct, data, savedIdsSet)) continue;

                const existing = proximityCandidates.get(ct);
                if (existing) {
                    existing.count++;
                } else {
                    proximityCandidates.set(ct, {
                        count: 1,
                        info: findWordInfo(ct, data),
                        closestConnectedId: relNode.id,
                    });
                }
            }
        }
    }

    // Sort by co-occurrence frequency, take top N
    const sortedProximity = [...proximityCandidates.entries()]
        .sort((a, b) => b[1].count - a[1].count)
        .slice(0, MAX_PROXIMITY);

    for (const [ct, { info, closestConnectedId }] of sortedProximity) {
        const proximityNodeId = `word:${ct}`;
        if (nodeIds.has(proximityNodeId)) continue;

        nodes.push({
            id: proximityNodeId,
            label: info?.pinyin ? ct : ct, // Use the clean token as label
            type: 'proximity',
            pinyin: info?.pinyin || '',
            meaning: info?.meaning || '',
            language: info?.language,
            connectionCount: 0,
        });
        nodeIds.add(proximityNodeId);

        // Ghost link to closest connected node
        links.push({ source: closestConnectedId, target: proximityNodeId });
    }

    // Update connection counts
    const connectionCounter = new Map<string, number>();
    for (const link of links) {
        connectionCounter.set(link.source as string, (connectionCounter.get(link.source as string) || 0) + 1);
        connectionCounter.set(link.target as string, (connectionCounter.get(link.target as string) || 0) + 1);
    }
    for (const node of nodes) {
        node.connectionCount = connectionCounter.get(node.id) || 0;
    }

    const proxCount = sortedProximity.length;
    console.log(`[NeuralGraph] Built graph for "${word}": ${nodes.length} nodes (${proxCount} proximity), ${links.length} links`);
    return { nodes, links };
}

// ============================================================
// Get saved words visible in the current context (for the selection overlay)
// ============================================================

/**
 * Returns saved words from data, filtered by folder context.
 * Only shows words from items that match the active folder filters,
 * so the overlay reflects what the user currently sees.
 */
export function getAllSavedWords(
    data: StudyItem[],
    savedIds: string[],
    activeFolderFilters?: string[]
): SavedWordInfo[] {
    const savedIdsSet = new Set(savedIds);
    const words: SavedWordInfo[] = [];
    const seenWords = new Set<string>();

    // Filter data by folders if filters are active
    let filteredData = data;

    if (activeFolderFilters && activeFolderFilters.length > 0) {
        // 1. Identifica palavras permitidas (que aparecem nos textos das pastas selecionadas)
        const allowedWords = new Set<string>();

        data.forEach(item => {
            if (item.type !== 'word') {
                const inFolder = activeFolderFilters.some(filterPath => {
                    if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                    return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
                });

                if (inFolder) {
                    item.tokens?.forEach(t => allowedWords.add(cleanPunctuation(t)));
                    item.keywords?.forEach(k => allowedWords.add(cleanPunctuation(k.word)));
                }
            }
        });

        // 2. Filtra dados (União: Está na pasta OU é uma palavra que aparece na pasta)
        filteredData = data.filter(item => {
            const explicitMatch = activeFolderFilters.some(filterPath => {
                if (filterPath === '__uncategorized__' && !item.folderPath) return true;
                return item.folderPath === filterPath || item.folderPath?.startsWith(filterPath + '/');
            });

            if (explicitMatch) return true;

            // Verifica associação dinâmica (apenas para cards de palavra)
            if (item.type === 'word' && allowedWords.has(cleanPunctuation(item.chinese))) {
                return true;
            }

            return false;
        });
    }

    for (const item of filteredData) {
        // Case 1: Standalone word cards
        if (savedIdsSet.has(item.id.toString())) {
            const clean = cleanPunctuation(item.chinese);
            if (clean && !seenWords.has(clean)) {
                seenWords.add(clean);
                words.push({
                    id: item.id.toString(),
                    word: item.chinese,
                    pinyin: item.pinyin,
                    meaning: item.translation,
                    language: item.language,
                });
            }
        }

        // Case 2: Keywords inside text items
        if (item.keywords) {
            for (const kw of item.keywords) {
                if (savedIdsSet.has(kw.id)) {
                    const clean = cleanPunctuation(kw.word);
                    if (clean && !seenWords.has(clean)) {
                        seenWords.add(clean);
                        words.push({
                            id: kw.id,
                            word: kw.word,
                            pinyin: kw.pinyin,
                            meaning: kw.meaning,
                            language: kw.language,
                        });
                    }
                }
            }
        }
    }

    // Sort alphabetically
    words.sort((a, b) => a.word.localeCompare(b.word));

    console.log(`[NeuralGraph] Found ${words.length} saved words (filtered: ${activeFolderFilters?.length ? 'yes' : 'no'})`);
    return words;
}

// ============================================================
// Internal helpers
// ============================================================

/** Checks if a cleaned token corresponds to any saved word */
function checkIfSaved(cleanToken: string, data: StudyItem[], savedIdsSet: Set<string>): boolean {
    for (const item of data) {
        // Check standalone word cards
        if (savedIdsSet.has(item.id.toString()) && cleanPunctuation(item.chinese) === cleanToken) {
            return true;
        }
        // Check keywords
        if (item.keywords) {
            for (const kw of item.keywords) {
                if (savedIdsSet.has(kw.id) && cleanPunctuation(kw.word) === cleanToken) {
                    return true;
                }
            }
        }
    }
    return false;
}

/** Finds word info (pinyin, meaning) for a cleaned token */
function findWordInfo(
    cleanToken: string,
    data: StudyItem[]
): { pinyin: string; meaning: string; language?: SupportedLanguage } | null {
    for (const item of data) {
        if (item.type === 'word' && cleanPunctuation(item.chinese) === cleanToken) {
            return { pinyin: item.pinyin, meaning: item.translation, language: item.language };
        }
        if (item.keywords) {
            const kw = item.keywords.find(k => cleanPunctuation(k.word) === cleanToken);
            if (kw) {
                return { pinyin: kw.pinyin, meaning: kw.meaning, language: kw.language };
            }
        }
    }
    return null;
}
