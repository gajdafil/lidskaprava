/**
 * archive.js
 * Boční pracovní panel vládního archivu: vyhledávání, kategorie, záložky a správa posuvníku.
 */

import { escapeHtml } from './documents.js';

export class ArchivePanel {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   * @param {import('./documents.js').DocumentViewer} documentViewer
   */
  constructor(engine, documentViewer) {
    this.engine = engine;
    this.documentViewer = documentViewer;
    this.categoryFilter = 'Všechny kategorie';
    this.searchQuery = '';
    this._scrollSaveTimer = null;
  }

  setCategoryFilter(category) {
    this.categoryFilter = category || 'Všechny kategorie';
  }

  setSearchQuery(query) {
    this.searchQuery = query || '';
  }

  resetFilters() {
    this.categoryFilter = 'Všechny kategorie';
    this.searchQuery = '';
    this.documentViewer.resetViewState();
  }

  /**
   * Vykreslí kompletní obsah pravého panelu archivu.
   * @param {Object|null} currentStepDef
   * @returns {string} HTML řetězec
   */
  render(currentStepDef) {
    const state = this.engine.state;
    const docsData = this.engine.data.documents;
    const unlockedDocs = (state.unlockedDocs || [])
      .map((id) => docsData.documents[id])
      .filter(Boolean);

    const queryLower = this.searchQuery.trim().toLowerCase();
    const filteredDocs = unlockedDocs.filter((doc) => {
      const catMatch =
        this.categoryFilter === 'Všechny kategorie' ||
        doc.category === this.categoryFilter;
      if (!catMatch) return false;
      if (!queryLower) return true;

      const inParagraphs =
        Array.isArray(doc.paragraphs) &&
        doc.paragraphs.some((p) => p.toLowerCase().includes(queryLower));

      return (
        doc.title.toLowerCase().includes(queryLower) ||
        doc.summary.toLowerCase().includes(queryLower) ||
        doc.provisionOrCase.toLowerCase().includes(queryLower) ||
        inParagraphs
      );
    });

    const categories = docsData.categories || ['Všechny kategorie'];
    const categoryOptions = categories
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${
            this.categoryFilter === cat ? 'selected' : ''
          }>${escapeHtml(cat)}</option>`
      )
      .join('');

    const catalogHtml =
      filteredDocs.length > 0
        ? filteredDocs
            .map(
              (doc) => `
              <button
                type="button"
                class="catalog-item ${state.activeDocTab === doc.id ? 'is-active' : ''}"
                data-action="open-doc"
                data-doc-id="${escapeHtml(doc.id)}"
              >
                <span>${escapeHtml(doc.title)}</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); flex-shrink: 0;">
                  ${escapeHtml(doc.category)}
                </span>
              </button>
            `
            )
            .join('')
        : '<div style="font-size: 0.84rem; color: var(--text-muted); padding: 0.4rem;">Žádný odemčený dokument neodpovídá zadanému filtru.</div>';

    const tabsHtml = (state.openDocTabs || [])
      .map((tabId) => {
        const doc = docsData.documents[tabId];
        if (!doc) return '';
        const isActive = state.activeDocTab === tabId;
        return `
          <div
            class="doc-tab ${isActive ? 'is-active' : ''}"
            data-action="open-doc"
            data-doc-id="${escapeHtml(tabId)}"
            title="${escapeHtml(doc.title)}"
          >
            <span class="doc-tab-title">${escapeHtml(doc.title)}</span>
            <button
              type="button"
              class="doc-tab-close"
              data-action="close-doc-tab"
              data-doc-id="${escapeHtml(tabId)}"
              aria-label="Zavřít záložku"
            >×</button>
          </div>
        `;
      })
      .join('');

    const activeDoc = state.activeDocTab
      ? docsData.documents[state.activeDocTab]
      : null;

    return `
      <div class="archive-header">
        <h2>Vládní archiv a sbírka pramenů</h2>
        <button type="button" class="btn btn-topbar" data-action="toggle-archive">
          Skrýt
        </button>
      </div>

      <div class="archive-filters">
        <select id="archive-category-select" aria-label="Filtrovat podle kategorie">
          ${categoryOptions}
        </select>
        <input
          type="search"
          id="archive-search-input"
          placeholder="Hledat v názvu, článku či textu…"
          value="${escapeHtml(this.searchQuery)}"
          aria-label="Hledat v archivu"
        />
      </div>

      <div class="archive-catalog" role="list" aria-label="Katalog odemčených dokumentů">
        ${catalogHtml}
      </div>

      <div class="doc-tabs-bar" role="tablist">
        ${tabsHtml}
      </div>

      <div class="doc-reader-body" id="doc-reader-body">
        ${this.documentViewer.renderDocument(activeDoc, currentStepDef)}
      </div>
    `;
  }

  /**
   * Obnoví uloženou pozici svislého posuvníku aktivního dokumentu a připojí sledování posunu.
   */
  bindScrollPersistence() {
    const readerEl = document.getElementById('doc-reader-body');
    const activeId = this.engine.state.activeDocTab;
    if (!readerEl || !activeId) return;

    const savedTop = this.engine.state.docScrollPositions[activeId] || 0;
    readerEl.scrollTop = savedTop;

    readerEl.addEventListener('scroll', () => {
      if (this._scrollSaveTimer) clearTimeout(this._scrollSaveTimer);
      this._scrollSaveTimer = setTimeout(() => {
        this.engine.saveDocScrollPosition(activeId, readerEl.scrollTop);
      }, 120);
    });
  }
}
