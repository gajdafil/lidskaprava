/**
 * archive.js
 * Správa bočního panelu archivu (#archive-pane) se třemi režimy:
 * Otevřené dokumenty, Katalog archivu a Instituce a mapy.
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
    this.activeMode = 'workspace'; // 'workspace' | 'catalog' | 'institutions'
    this.categoryFilter = 'Všechny kategorie';
    this._scrollSaveTimer = null;
    this._scrollBound = false;
  }

  setMode(mode) {
    if (mode === 'workspace' || mode === 'catalog' || mode === 'institutions') {
      this.activeMode = mode;
    }
  }

  setCategoryFilter(category) {
    this.categoryFilter = category || 'Všechny kategorie';
  }

  reset() {
    this.activeMode = 'workspace';
    this.categoryFilter = 'Všechny kategorie';
    this.documentViewer.resetViewState();
  }

  /**
   * Synchronizuje celý pravý panel archivu s aktuálním stavem hry.
   * @param {Object|null} currentStepDef
   */
  sync(currentStepDef) {
    const state = this.engine.state;
    const isGame = state.screen === 'game';
    const isOpen = isGame && Boolean(state.archiveOpen);

    const archivePane = document.getElementById('archive-pane');
    const resizer = document.getElementById('split-resizer');
    const btnArchive = document.getElementById('btn-archive');
    const archiveCountEl = document.getElementById('archive-count');
    const openTabsCountEl = document.getElementById('open-tabs-count');

    if (archiveCountEl) {
      archiveCountEl.textContent = String((state.unlockedDocs || []).length);
    }
    if (openTabsCountEl) {
      openTabsCountEl.textContent = String((state.openDocTabs || []).length);
    }

    if (btnArchive) {
      btnArchive.hidden = !isGame;
      btnArchive.style.display = isGame ? '' : 'none';
      btnArchive.classList.toggle('active', isOpen);
    }

    if (archivePane) {
      archivePane.hidden = !isOpen;
      archivePane.style.display = isOpen ? 'flex' : 'none';
    }

    if (resizer) {
      resizer.hidden = !isOpen;
      resizer.style.display = isOpen ? 'block' : 'none';
    }

    if (!isOpen) return;

    this._syncModeTabs();
    this._renderDocTabsBar();
    this._renderActiveDocument(currentStepDef);
    this._renderCatalog();
    this.documentViewer.updateInstitutionsView();
    this._ensureScrollListener();
  }

  _syncModeTabs() {
    const tabs = document.querySelectorAll('#archive-pane .mode-tab');
    tabs.forEach((btn) => {
      const isMatch = btn.dataset.mode === this.activeMode;
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', isMatch ? 'true' : 'false');
    });

    const views = {
      workspace: document.getElementById('view-doc-workspace'),
      catalog: document.getElementById('view-doc-catalog'),
      institutions: document.getElementById('view-institutions')
    };

    for (const [modeKey, el] of Object.entries(views)) {
      if (!el) continue;
      const visible = modeKey === this.activeMode;
      el.hidden = !visible;
      el.style.display = visible ? 'flex' : 'none';
    }
  }

  _renderDocTabsBar() {
    const tabsBar = document.getElementById('doc-tabs-bar');
    if (!tabsBar) return;

    const state = this.engine.state;
    const docsMap = this.engine.data.documents.documents || {};

    tabsBar.innerHTML = (state.openDocTabs || [])
      .map((tabId) => {
        const doc = docsMap[tabId];
        if (!doc) return '';
        const isActive = state.activeDocTab === tabId;

        return `
          <div
            class="doc-tab ${isActive ? 'active' : ''}"
            role="tab"
            aria-selected="${isActive ? 'true' : 'false'}"
            data-action="open-doc"
            data-doc-id="${escapeHtml(tabId)}"
            title="${escapeHtml(doc.title)}"
          >
            <span class="doc-tab-label">${escapeHtml(doc.title)}</span>
            <button
              type="button"
              class="doc-tab-close"
              data-action="close-doc-tab"
              data-doc-id="${escapeHtml(tabId)}"
              aria-label="Zavřít záložku ${escapeHtml(doc.title)}"
            >×</button>
          </div>
        `;
      })
      .join('');
  }

  _renderActiveDocument(currentStepDef) {
    const readerEl = document.getElementById('doc-reader');
    const toolbarEl = document.getElementById('doc-toolbar');
    const highlightBtn = document.getElementById('btn-toggle-highlight');
    const compareBtn = document.getElementById('btn-toggle-compare');

    if (!readerEl) return;

    const state = this.engine.state;
    const docsMap = this.engine.data.documents.documents || {};
    const activeDoc = state.activeDocTab ? docsMap[state.activeDocTab] : null;

    if (!activeDoc) {
      if (toolbarEl) {
        toolbarEl.hidden = true;
        toolbarEl.style.display = 'none';
      }
      readerEl.innerHTML = this.documentViewer.renderEmptyState();
      return;
    }

    if (toolbarEl) {
      toolbarEl.hidden = false;
      toolbarEl.style.display = 'flex';
    }

    const isHighlighted = Boolean(state.highlightedDocs[activeDoc.id]);
    if (highlightBtn) {
      highlightBtn.setAttribute('aria-pressed', isHighlighted ? 'true' : 'false');
      highlightBtn.textContent = isHighlighted
        ? 'Zrušit zvýraznění pasáží'
        : 'Zvýraznit relevantní pasáže';
    }

    if (compareBtn) {
      const hasComparison = Boolean(activeDoc.comparisonId);
      compareBtn.hidden = !hasComparison;
      compareBtn.style.display = hasComparison ? '' : 'none';
      if (hasComparison) {
        const compVisible = this.documentViewer.isComparisonVisible(activeDoc.id);
        compareBtn.textContent = compVisible
          ? 'Skrýt srovnání s případem D7'
          : 'Porovnat s případem D7';
      }
    }

    readerEl.innerHTML = this.documentViewer.renderDocument(activeDoc, currentStepDef);

    const savedTop = state.docScrollPositions[activeDoc.id] || 0;
    readerEl.scrollTop = savedTop;
  }

  _renderCatalog() {
    const catSelect = document.getElementById('archive-cat-select');
    const listEl = document.getElementById('archive-doc-list');
    if (!catSelect || !listEl) return;

    const docsData = this.engine.data.documents;
    const categories = docsData.categories || ['Všechny kategorie'];

    catSelect.innerHTML = categories
      .map(
        (cat) =>
          `<option value="${escapeHtml(cat)}" ${
            this.categoryFilter === cat ? 'selected' : ''
          }>${escapeHtml(cat)}</option>`
      )
      .join('');

    const unlockedDocs = (this.engine.state.unlockedDocs || [])
      .map((id) => docsData.documents[id])
      .filter(Boolean);

    const filtered = unlockedDocs.filter(
      (doc) =>
        this.categoryFilter === 'Všechny kategorie' ||
        doc.category === this.categoryFilter
    );

    if (filtered.length === 0) {
      listEl.innerHTML =
        '<div class="empty-state"><p>V této kategorii zatím nemáte odemčený žádný dokument.</p></div>';
      return;
    }

    listEl.innerHTML = filtered
      .map(
        (doc) => `
        <button
          type="button"
          class="catalog-item"
          data-action="open-doc"
          data-doc-id="${escapeHtml(doc.id)}"
        >
          <span class="catalog-item-title">${escapeHtml(doc.title)}</span>
          <span class="small">${escapeHtml(doc.provisionOrCase)} • ${escapeHtml(doc.category)}</span>
        </button>
      `
      )
      .join('');
  }

  _ensureScrollListener() {
    if (this._scrollBound) return;
    const readerEl = document.getElementById('doc-reader');
    if (!readerEl) return;

    this._scrollBound = true;
    readerEl.addEventListener('scroll', () => {
      const activeId = this.engine.state.activeDocTab;
      if (!activeId) return;
      if (this._scrollSaveTimer) clearTimeout(this._scrollSaveTimer);
      this._scrollSaveTimer = setTimeout(() => {
        this.engine.saveDocScrollPosition(activeId, readerEl.scrollTop);
      }, 120);
    });
  }
}
