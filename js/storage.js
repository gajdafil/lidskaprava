/**
 * storage.js
 * Správa lokálního ukládání stavu kampaně v paměti prohlížeče (LocalStorage).
 */

const STORAGE_KEY = 'letat_cest_moi_campaign_v1';
const STORAGE_VERSION = '1.0.0';

/**
 * Vytvoří výchozí čistý stav nové kampaně.
 * @param {Object} chaptersData - Data ze souboru chapters.json
 * @returns {Object} Výchozí stav hry
 */
export function createInitialState(chaptersData) {
  const firstChapter = chaptersData.chapters[0];

  return {
    version: STORAGE_VERSION,
    screen: 'briefing', // 'briefing' | 'tutorial' | 'game' | 'assessment'
    tutorialSeen: false,
    currentChapterId: firstChapter.id,
    viewingChapterId: firstChapter.id,
    completedChapters: [],
    currentStepIndex: 0,
    steps: {},
    unlockedDocs: [...(firstChapter.initialDocs || [])],
    unlockedInstitutions: [...(firstChapter.initialInstitutions || [])],
    openDocTabs: firstChapter.initialDocs && firstChapter.initialDocs.length > 0
      ? [firstChapter.initialDocs[0]]
      : [],
    activeDocTab: firstChapter.initialDocs && firstChapter.initialDocs.length > 0
      ? firstChapter.initialDocs[0]
      : null,
    docScrollPositions: {},
    highlightedDocs: {},
    highlightUsageCount: 0,
    archiveOpen: true,
    archiveWidthPct: 42,
    startedAt: new Date().toISOString(),
    completedAt: null
  };
}

/**
 * Načte uložený stav z LocalStorage, nebo vrátí null, pokud neexistuje či je neplatný.
 * @returns {Object|null}
 */
export function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.version !== STORAGE_VERSION) return null;
    if (!parsed.currentChapterId || typeof parsed.steps !== 'object') return null;

    return parsed;
  } catch (err) {
    console.warn('Nepodařilo se načíst uložený postup z LocalStorage:', err);
    return null;
  }
}

/**
 * Uloží aktuální stav kampaně do LocalStorage.
 * @param {Object} state
 * @returns {boolean} True při úspěšném uložení
 */
export function saveState(state) {
  try {
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.warn('Nepodařilo se uložit postup do LocalStorage:', err);
    return false;
  }
}

/**
 * Odstraní uložený stav kampaně z LocalStorage.
 */
export function clearState() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn('Nepodařilo se vymazat LocalStorage:', err);
  }
}
