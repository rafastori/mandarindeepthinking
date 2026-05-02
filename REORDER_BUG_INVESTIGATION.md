# Bug Investigation Request: Reading Tab Reorder doesn't persist for legacy items

> **Audience:** This document is meant to be sent to **another LLM** (Claude/GPT/Gemini) for an independent second opinion. I (Claude Sonnet 4.5) tried multiple fixes; the user reports the bug **persists**. Please read carefully and propose root causes I may have missed and/or alternative diagnostic strategies.

---

## TL;DR

In a React + IndexedDB language-learning PWA, users can manually reorder text items on the "Leitura" (Reading) tab via Up/Down buttons. After clicking "Salvar" the items **visually snap back to the original order** — the new order is **not persisted**. This happens **only with old/legacy collections**; recently-imported items reorder correctly.

I attempted **three rounds of fixes** (detailed below). The user just confirmed: **"reordenar continua sem funcionar para coleções antigas"** (reorder still doesn't work for old collections), even after the most aggressive fix. We need fresh eyes.

---

## Project context

- **Stack:** React 19, TypeScript, Vite 6, IndexedDB (raw, no Dexie), Firebase (only for backup blob, not active source of truth), `vite-plugin-pwa` (workbox).
- **Persistence model:** "local-first". `IndexedDB` is the source of truth. `useStudyItems` hook hydrates from IndexedDB on mount, and writes go through `localDB.*` helpers.
- **App:** `mandarin-deep-thinking` — flashcard/reading app for foreign-language learning.
- **Item shape:**
  ```ts
  // types.ts
  export interface StudyItem {
      id: number | string;        // ← THE TROUBLEMAKER
      chinese: string;
      pinyin: string;
      translation: string;
      tokens: string[];
      keywords: Keyword[];
      language?: SupportedLanguage;
      createdAt?: any;            // ISO string in current code, but historically might be Firestore Timestamp / Date / number / undefined
      type?: 'text' | 'word';
      originalSentence?: string;
      folderPath?: string;
  }
  ```
- **The "legacy items":** items imported in early versions of the app (when data lived in Firebase Firestore) ended up in IndexedDB with `id` as **`number`** OR as **string-that-looks-numeric (`"2469"`)**. New items get `id: \`local_${Date.now()}_${rand}\``.

---

## Symptom (user-reported)

Quote: *"Na aba leitura: reordenar continua sem funcionar para coleções antigas. Reordena porém após salvar volta a posição original"*.

Translation: *"On the Reading tab: reorder still doesn't work for old collections. It reorders [visually] but after saving it goes back to the original position."*

So the local optimistic UI works (the swap is visible while in reorder mode), but after `await onReorderItems(updates)` and the React re-render that follows, the items reappear in the **original** order.

---

## Architecture flow (relevant pieces)

```
ReadingView.tsx
    │
    │  user clicks ↑/↓: setLocalReorderData(swap)         ← only local React state
    │  user clicks "Save": await onReorderItems(updates)  ← App.tsx → useStudyItems.reorderItems
    │
App.tsx passes onReorderItems={reorderItems}              (from useStudyItems hook)
    │
useStudyItems.reorderItems(updates)
    │  1. Read all items from localDB
    │  2. For each item whose id matches an update, set new createdAt
    │  3. localDB.bulkPutItems(updatedItems)              ← single readwrite tx
    │  4. Re-read + sort by createdAt DESC
    │  5. setItems(reloaded)                              ← React re-render
    │
App.tsx: libraryData = useMemo(() => [...localItems, ...staticData], [localItems])
    │
ReadingView receives data={libraryData}
    │
filteredData = useMemo(() => data.filter(...), [data, activeFolderFilters])
    │  (does NOT re-sort; assumes incoming order is correct)
```

---

## What was tried (3 rounds of fixes)

### Round 1 — Original code had `as string` type assertion

`hooks/useStudyItems.ts` (old version):
```ts
const updateMap = new Map(updates.map(u => [u.id, u.createdAt]));
const updatedItems = allItems.map(item => {
    const newCreatedAt = updateMap.get(item.id as string);  // ← BUG
    if (newCreatedAt) {
      return { ...item, createdAt: newCreatedAt };
    }
    return item;
});
```

**Diagnosis:** `item.id as string` is a **TypeScript type assertion** with no runtime effect. If `item.id` is the number `2469`, then `Map.get(2469)` is called against a Map whose key was inserted as the string `"2469"` — `SameValueZero` makes them different. Items with numeric IDs were **never updated**, but the function returned successfully with no error.

**Fix (Round 1):** changed to `String(item.id)` and `String(u.id)` everywhere.

### Round 2 — Reorder algorithm depended on (possibly bogus) old timestamps

The caller (`ReadingView.saveReorder`) was passing **computed timestamps** based on `filteredData`'s existing `createdAt` values:

```ts
// OLD saveReorder
const times = filteredData.slice(0, itemCount).map((i, idx) => {
    let time = new Date(i.createdAt || new Date().toISOString()).getTime();
    if (isNaN(time)) time = Date.now() - (idx * 1000);
    return time;
});
times.sort((a, b) => b - a);
for (let i = 1; i < times.length; i++) {
    if (times[i] >= times[i - 1]) times[i] = times[i - 1] - 1;
}
const updates = localReorderData.map((item, i) => ({
    id: item.id.toString(),
    createdAt: new Date(times[i] ?? Date.now() - i*1000).toISOString(),
}));
```

This was fragile if `createdAt` was missing, in Firestore Timestamp format, or identical across items.

**Fix (Round 2):** simplified — caller sends only the new ID order; hook generates fresh timestamps from `Date.now() - i*1000`. Current code:

```ts
// ReadingView.saveReorder  (current)
const updates = localReorderData.map(item => ({ id: item.id }));
await onReorderItems(updates);
```

```ts
// useStudyItems.reorderItems  (current — full body below)
const reorderItems = useCallback(async (updates: { id: string | number; createdAt?: string }[]) => {
    if (!userId || updates.length === 0) return;
    try {
      const now = Date.now();
      const updateMap = new Map<string, string>();
      updates.forEach((u, i) => {
        updateMap.set(String(u.id), new Date(now - i * 1000).toISOString());
      });
      const allItems = await localDB.getAllItems();
      let touched = 0;
      const updatedItems = allItems.map(item => {
        const newCreatedAt = updateMap.get(String(item.id));
        if (newCreatedAt) {
          touched++;
          return { ...item, createdAt: newCreatedAt };
        }
        return item;
      });
      if (touched === 0) {
        console.warn('[reorderItems] Nenhum item bateu com os IDs enviados:', updates.slice(0, 3));
      }
      await localDB.bulkPutItems(updatedItems);
      const reloaded = await localDB.getAllItems();
      reloaded.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setItems(reloaded);
      console.log(`[reorderItems] ${touched}/${updates.length} itens reordenados`);
    } catch (error) {
      console.error('[reorderItems] Erro:', error);
      throw error;
    }
}, [userId]);
```

### Round 3 — Aggressive one-time migration of legacy IDs

User's suggestion: *"não era melhor só rodar um script de atualização para itens antigos legados?"* (wasn't it better to just run an update script for old legacy items?). Agreed.

Added migration in `useStudyItems.ts:22-48`. Runs every startup (idempotent):

```ts
const runLegacyIdMigrationIfNeeded = async (): Promise<void> => {
    try {
      const all = await localDB.getAllItems();
      // Item is legacy if id is number OR string that's purely digits ("2469")
      const legacyItems = all.filter(it =>
        typeof it.id === 'number' || (typeof it.id === 'string' && /^\d+$/.test(it.id))
      );
      if (legacyItems.length === 0) return;
      console.log(`[migration] convertendo ${legacyItems.length} IDs legados…`);
      const oldKeys: (string | number)[] = legacyItems.map(it => it.id);
      const remapped: StudyItem[] = legacyItems.map(it => ({ ...it, id: `legacy_${it.id}` }));
      await localDB.bulkDeleteItems(oldKeys);
      await localDB.bulkPutItems(remapped);
      await localDB.updateProfile({ legacyIdsMigratedAt: new Date().toISOString() });
      console.log('[migration] concluída — IDs convertidos:', legacyItems.length);
    } catch (e) {
      console.error('[migration] falhou (não bloqueia carregamento):', e);
    }
};
```

This runs **before** `getAllItems` on every load (idempotent — fast no-op if nothing matches).

**Result reported by user after this fix shipped:** still doesn't work.

---

## Current state of relevant files

### `hooks/useStudyItems.ts`

(full reorder logic)

```ts
// hooks/useStudyItems.ts:158-216

/**
 * Reordena itens de forma atômica.
 *
 * Estratégia: o caller manda a NOVA ORDEM completa de IDs.
 * Reescrevemos os createdAt em sequência decrescente partindo de Date.now(),
 * 1 segundo por posição.
 */
const reorderItems = useCallback(async (updates: { id: string | number; createdAt?: string }[]) => {
    if (!userId || updates.length === 0) return;

    try {
      const now = Date.now();
      const updateMap = new Map<string, string>();
      updates.forEach((u, i) => {
        updateMap.set(String(u.id), new Date(now - i * 1000).toISOString());
      });

      const allItems = await localDB.getAllItems();
      let touched = 0;
      const updatedItems = allItems.map(item => {
        const newCreatedAt = updateMap.get(String(item.id));
        if (newCreatedAt) {
          touched++;
          return { ...item, createdAt: newCreatedAt };
        }
        return item;
      });

      if (touched === 0) {
        console.warn('[reorderItems] Nenhum item bateu com os IDs enviados:', updates.slice(0, 3));
      }

      await localDB.bulkPutItems(updatedItems);

      const reloaded = await localDB.getAllItems();
      reloaded.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setItems(reloaded);

      console.log(`[reorderItems] ${touched}/${updates.length} itens reordenados`);
    } catch (error) {
      console.error('[reorderItems] Erro:', error);
      throw error;
    }
}, [userId]);
```

### `services/localDB.ts`

Stores config (lines 10-25):
```ts
const DB_NAME = 'MandarinDeepThinkingDB';
const DB_VERSION = 4;

const ITEMS_STORE = 'items';      // keyPath: 'id'
const PROFILE_STORE = 'profile';  // simple kv
const VOICE_STORE = 'voiceRecordings';
const SESSIONS_STORE = 'sessions';
const COMMENTS_STORE = 'comments';
```

`bulkPutItems` (lines 177-190):
```ts
async bulkPutItems(items: StudyItem[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ITEMS_STORE, 'readwrite');
        const store = tx.objectStore(ITEMS_STORE);
        for (const item of items) {
            store.put(item);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
},
```

`bulkDeleteItems` (lines 193-206):
```ts
async bulkDeleteItems(ids: (string | number)[]): Promise<void> {
    const db = await openDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(ITEMS_STORE, 'readwrite');
        const store = tx.objectStore(ITEMS_STORE);
        for (const id of ids) {
            store.delete(id as IDBValidKey);
        }
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
},
```

DB upgrade (lines 88-118):
```ts
request.onupgradeneeded = (event) => {
    const db = (event.target as IDBOpenDBRequest).result;
    if (!db.objectStoreNames.contains(ITEMS_STORE)) {
        db.createObjectStore(ITEMS_STORE, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(PROFILE_STORE)) {
        db.createObjectStore(PROFILE_STORE);
    }
    if (!db.objectStoreNames.contains(VOICE_STORE)) {
        db.createObjectStore(VOICE_STORE, { keyPath: 'wordId' });
    }
    if (!db.objectStoreNames.contains(SESSIONS_STORE)) {
        const sessionsStore = db.createObjectStore(SESSIONS_STORE, { keyPath: 'id' });
        sessionsStore.createIndex('date', 'date', { unique: false });
    }
    if (!db.objectStoreNames.contains(COMMENTS_STORE)) {
        const commentsStore = db.createObjectStore(COMMENTS_STORE, { keyPath: 'id' });
        commentsStore.createIndex('targetKey', 'targetKey', { unique: false });
        commentsStore.createIndex('targetType', 'targetType', { unique: false });
    }
};
```

### `views/ReadingView/index.tsx`

`handleReorder` (lines 521-535):
```ts
const handleReorder = (currentIndex: number, direction: 'up' | 'down') => {
    if (localReorderData.length < 2) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= localReorderData.length) return;
    setLocalReorderData(prev => {
        const newArr = [...prev];
        const temp = newArr[currentIndex];
        newArr[currentIndex] = newArr[targetIndex];
        newArr[targetIndex] = temp;
        return newArr;
    });
};
```

`saveReorder` (lines 537-559):
```ts
const saveReorder = async () => {
    if (!onReorderItems || localReorderData.length === 0) {
        console.warn('[saveReorder] onReorderItems ausente ou lista vazia');
        setReorderMode(false);
        setLocalReorderData([]);
        return;
    }
    try {
        const updates = localReorderData.map(item => ({ id: item.id }));
        await onReorderItems(updates);
        console.log(`[saveReorder] ${updates.length} itens reordenados`);
    } catch (error) {
        console.error('[saveReorder] Erro:', error);
        alert('Erro ao salvar a sequência. Verifique o console.');
    } finally {
        setReorderMode(false);
        setLocalReorderData([]);
    }
};
```

`filteredData` (lines 301-317):
```ts
const filteredData = useMemo(() => {
    let result = data.filter(item => item.type !== 'word');
    if (activeFolderFilters.length > 0) {
        result = result.filter(item => {
            if (activeFolderFilters.includes('__uncategorized__')) {
                if (!item.folderPath) return true;
            }
            return activeFolderFilters.includes(item.folderPath || '');
        });
    }
    return result;
}, [data, activeFolderFilters]);
```

**Note:** `filteredData` does NOT re-sort. It assumes `data` arrives in correct order from upstream.

### `App.tsx` — relevant snippets

```ts
// App.tsx:74
const { items: localItems, addItem, deleteItem, deleteManyItems, updateItem, reorderItems, ... } = useStudyItems(user?.uid);

// App.tsx:210
const libraryData = useMemo(() => [...localItems, ...staticData], [localItems]);
// Note: staticData is currently `[]` (constants.ts has empty studyData export)

// App.tsx:615 — passed to ReadingView
onReorderItems={reorderItems}
```

---

## Hypotheses I considered and tested/dismissed

1. ✅ **TypeScript `as string` assertion was a no-op at runtime** → fixed in Round 1.
2. ✅ **Bogus old timestamps confusing the algorithm** → fixed in Round 2 (now generates fresh).
3. ✅ **`number` IDs failing strict equality everywhere** → fixed in Round 3 (migration).
4. ✅ **String IDs that look numeric (`"2469"`) escaping the migration** → migration regex now `/^\d+$/` catches them.

---

## Hypotheses I have **not** ruled out (need help)

> Listed in rough order of how much they nag at me. **Please pressure-test each one** and add hypotheses I missed.

### H1. PWA service worker is serving the old bundle

The app uses `vite-plugin-pwa` with `registerType: 'autoUpdate'`, but there's no explicit user-facing prompt. The user might be running a stale `index-*.js` from before the migration code shipped. The migration logs (`console.log('[migration] convertendo …')`) would never appear if the code isn't loaded.

**Diagnosis if true:** user opens DevTools → Application → Service Workers → Unregister, then hard refresh; or just check if `[migration]` log appears.

**Counter-evidence:** the user tested batch-delete fix (which shipped in same commit as migration) and confirmed it changed behavior. So at least *some* new code is loaded.

### H2. `bulkPutItems` silently failing on a per-item basis

`store.put(item)` returns an `IDBRequest` but I never attach `onerror` to each individual request — only to the transaction (`tx.onerror`). If a single `put` fails (e.g., schema constraint), it might be swallowed. With `keyPath: 'id'`, putting an item without an `id` field, or with `id` of a non-IDB-valid type, throws `DataError` per-request without aborting the tx.

**Diagnosis:** wrap each `store.put(item)` in `request.onerror = (e) => console.error(e, item)`.

### H3. The migration is creating ID collisions or dropping items

`legacy_<id>` prefix could collide with an item that's already named that way (unlikely, but…). Or the `bulkDeleteItems(oldKeys)` happens after `bulkPutItems(remapped)` — wait no, delete is before put. Let me double-check the migration code. ✓ Order is: getAllItems → filter → bulkDeleteItems(oldKeys) → bulkPutItems(remapped). If `remapped` is in a separate transaction from `bulkDeleteItems`, an interleaving issue could in theory occur, but each `bulk*` opens its own `readwrite` tx.

**Diagnosis:** after page load, dump `await localDB.getAllItems()` to console and check IDs.

### H4. The legacy items are coming from somewhere OTHER than IndexedDB

The reading view receives `data={libraryData}` which is `[...localItems, ...staticData]`. `staticData` is currently `[]` per `constants.ts`. **But:** there's a `MemorizaTudo-Repo/` folder with `import.meta.glob`'d `.txt`/`.json` files, served via the **Repository modal** (`services/repositoryService.ts`). When the user imports content from there, items are added via `addItem(...)` → become `local_*` items. So those are clean.

But the Reading view also has a "Repository" button. If the user is browsing items that haven't been imported (i.e., are still virtual), reorder might apply to virtual items that don't exist in IndexedDB. But that's not the use case described — they clicked Reorder on items in their library.

**Counter-evidence:** my code logs `[reorderItems] X/Y itens reordenados` when it runs. If `touched === 0`, it warns. If the user had legacy items without matching IDs, this warning would fire. We don't have logs from the user yet to confirm or rule out.

### H5. React closure / stale `data` in ReadingView

`saveReorder` captures `localReorderData` (state). `localReorderData` was initialized from `filteredData` when entering reorder mode. If `data` (which `filteredData` derives from) changed between entering reorder mode and clicking save, the IDs in `localReorderData` might be stale or removed from current `data`.

**Counter-evidence:** the IDs themselves don't change between renders (we changed the migration to be idempotent — it runs once and then is no-op). So this only matters in the **first** session after the migration commit ships. Could explain "first time after deploy" behavior.

### H6. Schema upgrade from v3→v4 left items orphaned

When I added the `comments` store (`COMMENTS_STORE`), I bumped `DB_VERSION` from 3 to 4. The `onupgradeneeded` handler only **adds** new stores; it doesn't touch existing items. But maybe IndexedDB's behavior with existing connections during upgrade caused inconsistency? Specifically, if a tab was open during the version bump, the upgrade might have been deferred / blocked.

**Diagnosis:** ask user to fully close all tabs of the PWA, then reopen. Or check `navigator.storage.estimate()` to see if quota issues.

### H7. `bulkPutItems` with mixed-type keys

If ITEMS_STORE has both `id: number` items (legacy, pre-migration) and `id: string` items (new), and the migration deletes the number-keyed ones and inserts string-keyed ones — but **what if** the `bulkPutItems(updatedItems)` in `reorderItems` is being called with items whose `id` is `number` (because migration didn't run / didn't catch them)?

`store.put(item)` with `keyPath: 'id'` reads the id from the object. If `item.id === 2469`, it puts under numeric key 2469. Then `getAllItems` reads everything back. If we sort by createdAt and the legacy items had identical or missing createdAt, sort might be unstable.

But wait — my reorder writes a fresh `createdAt` for each item in the new order, with 1s gaps. So sort should be deterministic. Unless `bulkPutItems` is silently failing for these items (see H2).

### H8. Two competing `useStudyItems` instances

The code calls `useStudyItems(user?.uid)` in **multiple places**: once in `App.tsx:74` (the main one), once inside `PolyQuestView/index.tsx`, once inside `views/PolyQuestView/components/PolyQuestLobby.tsx`, and possibly in `views/PolyQuestView/components/QuestPhase.tsx` and `BossPhase.tsx`. Each instance has its own `items` state, but they share the same IndexedDB.

If one instance writes (reorder) and another instance reads (re-renders), they might be inconsistent. But the user is on the Reading tab, so only the App.tsx instance should be visible. The other instances would re-fetch on their next mount.

**Counter-evidence:** still, if PolyQuestView's hook instance is mounted in the background somehow… unlikely but worth checking.

### H9. Race with `useCloudSync` auto-restore

`hooks/useCloudSync.ts` has `migrateFromFirebase` that on first run reads data from Firebase Firestore and **overwrites** the local IndexedDB via `localDB.importAll({ items, profile, comments })`. `importAll` calls `clearItems()` first.

If this migration runs **after** the user reorders (somehow re-triggered), it would wipe the new createdAt and restore the cloud blob's old data.

**Counter-evidence:** `migrateFromFirebase` is gated by `localStorage[\`localFirstMigrated_${userId}\`]` flag and only runs once. But if that localStorage gets cleared (e.g., by browser cleanup, by another script), it could re-trigger.

### H10. The "old collections" the user means are imported from a JSON file with a static `createdAt` that's "newer" than `now - i*1000`

If the user imported an old backup with `createdAt` set to **a future date** (or just newer than now), and we sort by createdAt DESC, those items would always sort to the top regardless of our `now - i*1000` writes.

**Diagnosis:** check if `(item.createdAt > new Date().toISOString())` for any items.

---

## Things to verify / instrument

If you suggest more code, these are things I'd like to add to confirm:

1. Log the **first 3 items** of `localReorderData` (id + type) when `saveReorder` is called.
2. Log the **first 3 items** of `allItems` (id + type + createdAt) inside `reorderItems`, before and after the map.
3. Log `touched` count vs `updates.length` after the map.
4. Log the **first 3 items** of `reloaded` (id + createdAt) after `bulkPutItems`.
5. Log the **first 3 items** of `localItems` (App.tsx) after `setItems` propagates.

If `touched === updates.length` and `reloaded` is sorted as expected but `localItems` shows old order, the bug is in React. If `touched < updates.length`, the IDs aren't matching — needs a deeper look at what shape the IDs have.

---

## Repo & file paths (absolute, for easy navigation)

- **Hook:** `hooks/useStudyItems.ts`
- **IndexedDB wrapper:** `services/localDB.ts`
- **Reading view:** `views/ReadingView/index.tsx` (1300+ lines; reorder logic is at 521-559)
- **Top-level wiring:** `App.tsx` (look for `reorderItems`, `libraryData`)
- **Type:** `types.ts`
- **Constants (staticData):** `constants.ts` (currently empty array)
- **Cloud sync (potential interference):** `hooks/useCloudSync.ts`

---

## What I'm asking you (the second-opinion LLM)

1. **Pressure-test every hypothesis above.** Tell me which are most likely, which are bullshit, and which I missed.
2. **Suggest a deterministic diagnostic procedure** — exact console commands I can ask the user to run in DevTools (e.g., `localStorage.getItem('localFirstMigrated_<uid>')`, `await indexedDB.databases()`, dumping the items store) to narrow down the failure mode.
3. **Identify any subtle bug in `reorderItems` / `bulkPutItems` / `runLegacyIdMigrationIfNeeded`** that I missed. Walk through it carefully — IndexedDB has weird semantics around transactions, key types, and version upgrades.
4. **Propose the cleanest fix** assuming you've confirmed the root cause. Bonus: a fallback "nuke and rebuild" strategy for IndexedDB if the data is just unrecoverable.
5. **Specifically ask the user:** what should they share to confirm the diagnosis? (E.g., DevTools screenshots, `console.log` output, exported IndexedDB data.)

Please be **direct** and **pessimistic** — don't trust my hypotheses. Find the bug.

---

## Appendix: full `useStudyItems.ts` (current state, 350+ lines) — abridged to the relevant parts

```ts
import { useState, useEffect, useCallback } from 'react';
import { localDB } from '../services/localDB';
import { StudyItem } from '../types';

export const useStudyItems = (userId: string | null | undefined) => {
  const [items, setItems] = useState<StudyItem[]>([]);
  const [loading, setLoading] = useState(true);

  const runLegacyIdMigrationIfNeeded = async (): Promise<void> => {
    try {
      const all = await localDB.getAllItems();
      const legacyItems = all.filter(it =>
        typeof it.id === 'number' || (typeof it.id === 'string' && /^\d+$/.test(it.id))
      );
      if (legacyItems.length === 0) return;
      console.log(`[migration] convertendo ${legacyItems.length} IDs legados…`);
      const oldKeys: (string | number)[] = legacyItems.map(it => it.id);
      const remapped: StudyItem[] = legacyItems.map(it => ({ ...it, id: `legacy_${it.id}` }));
      await localDB.bulkDeleteItems(oldKeys);
      await localDB.bulkPutItems(remapped);
      await localDB.updateProfile({ legacyIdsMigratedAt: new Date().toISOString() });
      console.log('[migration] concluída — IDs convertidos:', legacyItems.length);
    } catch (e) {
      console.error('[migration] falhou:', e);
    }
  };

  useEffect(() => {
    if (!userId) { setItems([]); setLoading(false); return; }
    let cancelled = false;
    const loadItems = async () => {
      try {
        await runLegacyIdMigrationIfNeeded();
        const localItems = await localDB.getAllItems();
        if (!cancelled) {
          localItems.sort((a, b) => {
            const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
            const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
            return dateB - dateA;
          });
          setItems(localItems);
          setLoading(false);
        }
      } catch (error) {
        console.error('Erro ao carregar itens:', error);
        if (!cancelled) { setItems([]); setLoading(false); }
      }
    };
    loadItems();
    return () => { cancelled = true; };
  }, [userId]);

  // … addItem, deleteItem, deleteManyItems, updateItem …

  const reorderItems = useCallback(async (updates: { id: string | number; createdAt?: string }[]) => {
    if (!userId || updates.length === 0) return;
    try {
      const now = Date.now();
      const updateMap = new Map<string, string>();
      updates.forEach((u, i) => {
        updateMap.set(String(u.id), new Date(now - i * 1000).toISOString());
      });
      const allItems = await localDB.getAllItems();
      let touched = 0;
      const updatedItems = allItems.map(item => {
        const newCreatedAt = updateMap.get(String(item.id));
        if (newCreatedAt) {
          touched++;
          return { ...item, createdAt: newCreatedAt };
        }
        return item;
      });
      if (touched === 0) {
        console.warn('[reorderItems] Nenhum item bateu:', updates.slice(0, 3));
      }
      await localDB.bulkPutItems(updatedItems);
      const reloaded = await localDB.getAllItems();
      reloaded.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const dateB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return dateB - dateA;
      });
      setItems(reloaded);
      console.log(`[reorderItems] ${touched}/${updates.length} itens reordenados`);
    } catch (error) {
      console.error('[reorderItems] Erro:', error);
      throw error;
    }
  }, [userId]);

  // … rest of hook …
  return { items, loading, addItem, deleteItem, deleteManyItems, updateItem, reorderItems, /* … */ };
};
```

---

**End of investigation document. Please be ruthless. Find the bug.**
