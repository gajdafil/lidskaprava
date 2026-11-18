/**
 * archive.js
 * Řízení pravého panelu: Pracovní plocha pramenů (záložky + čtečka), Katalog spisu a Instituce a mapy.
 */

import { renderDocumentView, renderComparisonTable } from './documents.js';

export class ArchivePanel {
  /**
   * @param {Object} options
   * @param {Object} options.engine - Instance GameEngine
   * @param {Object} options.data - Všechna herní data (documents, institutions, chapters, ...)
   * @param {Function} options.onStateChange - Callback při změně stavu (překreslení / uložení)
   */
  constructor({ engine, data, onStateChange }) {
    this.engine = engine;
    this.data = data;
    this.onStateChange = onStateChange;

    this.mode = 'reader'; // 'reader' | 'catalog' | 'institutions'
    this.catalogFilter = 'all'; // 'all' | 'primarni_pravo' | 'judikatura_sdeu' | 'vnitrostatni_pravo' | 'procesni_spis' | 'diplomaticke_podklady'
    this.searchQuery = '';
    this.showComparison = false;
    this.activeHighlightForStepId = null;
    this.lastActiveDocId = null;

    // Reference na DOM prvky z index.html
    this.tabsContainer = document.getElementById('archive-tabs');
    this.docToolbar = document.getElementById('doc-toolbar');
    this.docReader = document.getElementById('doc-reader');
    this.catalogContainer = document.getElementById('archive-catalog');
    this.institutionsContainer = document.getElementById('institutions-view');
    this.btnHighlight = document.getElementById('btn-highlight-passage');
    this.btnToggleCompare = document.getElementById('btn-toggle-compare');
    this.modeButtons = document.querySelectorAll('.archive-mode-btn');

    this.bindInternalEvents();
  }

  /**
   * Napojí posluchače na ovládací prvky uvnitř archivu (zvýraznění pasáže, srovnávací tabulka, delegované akce).
   */
  bindInternalEvents() {
    if (this.btnHighlight) {
      this.btnHighlight.addEventListener('click', () => {
        if (!this.currentStepDef || !this.currentStepDef.highlightDocId) return;
        const targetDocId = this.currentStepDef.highlightDocId;

        if (this.activeHighlightForStepId === this.currentStepDef.id) {
          // Vypnutí zvýraznění
          this.activeHighlightForStepId = null;
        } else {
          // Zapnutí zvýraznění a otevření příslušného dokumentu
          this.activeHighlightForStepId = this.currentStepDef.id;
          this.engine.recordHighlightUsage(targetDocId);
          this.engine.openDocument(targetDocId);
          this.setMode('reader');
        }
        this.sync(this.currentStepDef);
        if (this.onStateChange) this.onStateChange();
      });
    }

    if (this.btnToggleCompare) {
      this.btnToggleCompare.addEventListener('click', () => {
        this.showComparison = !this.showComparison;
        this.btnToggleCompare.setAttribute('aria-pressed', String(this.showComparison));
        this.btnToggleCompare.classList.toggle('is-active', this.showComparison);
        this.renderReaderView();
      });
    }

    // Delegované klikání uvnitř záložek, čtečky a katalogu
    const pane = document.getElementById('archive-pane');
    if (pane) {
      pane.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-doc]');
        if (closeBtn) {
          e.stopPropagation();
          const docId = closeBtn.getAttribute('data-close-doc');
          this.engine.closeDocumentTab(docId);
          this.sync(this.currentStepDef);
          if (this.onStateChange) this.onStateChange();
          return;
        }

        const tabBtn = e.target.closest('[data-open-doc]');
        if (tabBtn) {
          const docId = tabBtn.getAttribute('data-open-doc');
          this.showComparison = false;
          if (this.btnToggleCompare) {
            this.btnToggleCompare.setAttribute('aria-pressed', 'false');
            this.btnToggleCompare.classList.remove('is-active');
          }
          this.engine.openDocument(docId);
          this.setMode('reader');
          if (this.onStateChange) this.onStateChange();
          return;
        }

        const filterBtn = e.target.closest('[data-catalog-filter]');
        if (filterBtn) {
          this.catalogFilter = filterBtn.getAttribute('data-catalog-filter');
          this.renderCatalogView();
          return;
        }
      });

      pane.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'archive-search-input') {
          this.searchQuery = e.target.value;
          this.renderCatalogView();
        }
      });
    }

    // Ukládání pozice posuvníku ve čtečce
    if (this.docReader) {
      this.docReader.addEventListener('scroll', () => {
        const activeDocId = this.engine.state.activeDocTab;
        if (activeDocId) {
          this.engine.saveDocScrollPosition(activeDocId, this.docReader.scrollTop);
        }
      });
    }
  }

  /**
   * Přepne režim pravého panelu ('reader' | 'catalog' | 'institutions').
   * @param {string} newMode
   */
  setMode(newMode) {
    this.mode = newMode;

    this.modeButtons.forEach((btn) => {
      const isMatch = btn.getAttribute('data-archive-mode') === newMode;
      btn.classList.toggle('is-active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    });

    const isReader = newMode === 'reader';
    const isCatalog = newMode === 'catalog';
    const isInstitutions = newMode === 'institutions';

    if (this.tabsContainer) this.tabsContainer.hidden = !isReader;
    if (this.docToolbar) this.docToolbar.hidden = !isReader;
    if (this.docReader) this.docReader.hidden = !isReader;
    if (this.catalogContainer) this.catalogContainer.hidden = !isCatalog;
    if (this.institutionsContainer) this.institutionsContainer.hidden = !isInstitutions;

    if (isReader) {
      this.renderTabs();
      this.renderReaderView();
    } else if (isCatalog) {
      this.renderCatalogView();
    } else if (isInstitutions) {
      this.renderInstitutionsView();
    }
  }

  /**
   * Resetuje lokální UI stav archivu při zahájení nové kampaně.
   */
  reset() {
    this.mode = 'reader';
    this.catalogFilter = 'all';
    this.searchQuery = '';
    this.showComparison = false;
    this.activeHighlightForStepId = null;
    this.lastActiveDocId = null;

    if (this.btnToggleCompare) {
      this.btnToggleCompare.setAttribute('aria-pressed', 'false');
      this.btnToggleCompare.classList.remove('is-active');
    }
    this.setMode('reader');
  }

  /**
   * Synchronizuje panel archivu s aktuálním stavem hry a aktivním krokem.
   * @param {Object|null} currentStepDef
   */
  sync(currentStepDef = null) {
    this.currentStepDef = currentStepDef;

    // Aktualizace tlačítka „Zvýraznit relevantní pasáž“ v liště čtečky
    if (this.btnHighlight) {
      const hasHighlight = Boolean(currentStepDef && currentStepDef.highlightDocId);
      this.btnHighlight.hidden = !hasHighlight;

      if (hasHighlight) {
        const isOn = this.activeHighlightForStepId === currentStepDef.id;
        this.btnHighlight.setAttribute('aria-pressed', String(isOn));
        this.btnHighlight.classList.toggle('is-active', isOn);
        this.btnHighlight.textContent = isOn
          ? 'Zrušit zvýraznění pasáže'
          : 'Zvýraznit relevantní pasáž';
      }
    }

    this.setMode(this.mode);
  }

  /**
   * Vykreslí lištu otevřených záložek dokumentů.
   */
  renderTabs() {
    if (!this.tabsContainer) return;

    const openTabs = this.engine.state.openDocTabs || [];
    const activeDocId = this.engine.state.activeDocTab;
    const docsMap = this.data.documents.documents || {};

    if (openTabs.length === 0) {
      this.tabsContainer.innerHTML =
        '<div class="archive-tabs-empty">Žádný otevřený dokument. Vyberte spis v Katalogu pramenů.</div>';
      return;
    }

    this.tabsContainer.innerHTML = openTabs
      .map((docId) => {
        const doc = docsMap[docId];
        if (!doc) return '';
        const isActive = docId === activeDocId;
        const shortLabel = doc.code ? `${doc.code}: ${doc.shortTitle || doc.title}` : doc.title;

        return `
          <div class="doc-tab ${isActive ? 'is-active' : ''}" role="tab" aria-selected="${isActive}" data-open-doc="${this.escapeHtml(docId)}">
            <span class="doc-tab-title" title="${this.escapeHtml(doc.title)}">${this.escapeHtml(shortLabel)}</span>
            <button type="button" class="doc-tab-close" data-close-doc="${this.escapeHtml(docId)}" aria-label="Zavřít záložku ${this.escapeHtml(doc.title)}">×</button>
          </div>
        `;
      })
      .join('');
  }

  /**
   * Vykreslí čtečku aktivního dokumentu nebo srovnávací tabulku.
   */
  renderReaderView() {
    if (!this.docReader) return;

    if (this.showComparison) {
      this.docReader.innerHTML = renderComparisonTable(
        this.data.documents,
        this.engine.state.unlockedDocs || []
      );
      return;
    }
console.log('=== DIAGNOSTIKA ČTEČKY ===');

console.log('this.data:', this.data);
console.log('this.data.documents:', this.data.documents);

console.log(
  'Klíče this.data.documents:',
  Object.keys(this.data.documents || {})
);

console.log(
  'this.data.documents.documents:',
  this.data.documents?.documents
);

console.log(
  'Klíče dokumentů:',
  Object.keys(this.data.documents?.documents || {})
);

console.log('activeDocTab:', this.engine.state.activeDocTab);
console.log('openDocTabs:', this.engine.state.openDocTabs);
console.log('unlockedDocs:', this.engine.state.unlockedDocs);

console.log('=== KONEC DIAGNOSTIKY ===');
    const activeDocId = this.engine.state.activeDocTab;
    const docsMap = this.data.documents.documents || {};
    const doc = activeDocId ? docsMap[activeDocId] : null;

    if (!doc) {
      this.docReader.innerHTML = `
        <div class="reader-empty-state">
          <p><strong>Pracovní plocha je prázdná.</strong></p>
          <p>Otevřete některý z odemčených dokumentů v záložce <em>Katalog pramenů</em> nebo v odkazech u zadání úlohy.</p>
        </div>
      `;
      return;
    }

    const highlightTarget =
      this.currentStepDef &&
      this.activeHighlightForStepId === this.currentStepDef.id &&
      this.currentStepDef.highlightDocId === activeDocId
        ? this.currentStepDef.highlightPassage || null
        : null;

    this.docReader.innerHTML = renderDocumentView(doc, highlightTarget);

    // Obnovení pozice posuvníku při přepnutí záložky
    if (this.lastActiveDocId !== activeDocId) {
      this.lastActiveDocId = activeDocId;
      const savedScroll = this.engine.state.docScrollPositions?.[activeDocId] || 0;
      this.docReader.scrollTop = savedScroll;
    }
  }

  /**
   * Vykreslí katalog všech pramenů rozdělený podle kategorií a stavu odemčení.
   */
  renderCatalogView() {
    if (!this.catalogContainer) return;

    const docsMap = this.data.documents.documents || {};
    const unlockedSet = new Set(this.engine.state.unlockedDocs || []);
    const allDocs = Object.values(docsMap);

    const categories = [
      { id: 'all', label: 'Všechny prameny' },
      { id: 'primarni_pravo', label: 'Primární právo EU' },
      { id: 'judikatura_sdeu', label: 'Judikatura SDEU' },
      { id: 'vnitrostatni_pravo', label: 'Vnitrostátní právo Marenska' },
      { id: 'procesni_spis', label: 'Procesní spis' },
      { id: 'diplomaticke_podklady', label: 'Podklady a stanoviska' }
    ];

    const query = this.searchQuery.trim().toLowerCase();

    const filteredDocs = allDocs.filter((doc) => {
      if (this.catalogFilter !== 'all' && doc.category !== this.catalogFilter) {
        return false;
      }
      if (!query) return true;
      if (!unlockedSet.has(doc.id)) return false;
      const haystack = `${doc.code || ''} ${doc.title || ''} ${doc.summary || ''} ${doc.citation || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    const filterButtonsHtml = categories
      .map(
        (cat) => `
        <button type="button"
                class="catalog-filter-pill ${this.catalogFilter === cat.id ? 'is-active' : ''}"
                data-catalog-filter="${cat.id}">
          ${this.escapeHtml(cat.label)}
        </button>
      `
      )
      .join('');

    const cardsHtml = filteredDocs
      .map((doc) => {
        const isUnlocked = unlockedSet.has(doc.id);
        if (!isUnlocked) {
          return `
            <article class="catalog-card is-locked">
              <div class="catalog-card-header">
                <span class="doc-code-badge">${this.escapeHtml(doc.code || doc.id)}</span>
                <span class="doc-status-badge locked">Zatím nezařazeno do spisu</span>
              </div>
              <h4 class="catalog-card-title">${this.escapeHtml(doc.title)}</h4>
              <p class="catalog-card-locked-note">Dokument se zpřístupní v další fázi řízení nebo na základě procesního postupu.</p>
            </article>
          `;
        }

        return `
          <article class="catalog-card is-unlocked">
            <div class="catalog-card-header">
              <span class="doc-code-badge">${this.escapeHtml(doc.code || doc.id)}</span>
              <span class="doc-category-label">${this.escapeHtml(doc.categoryLabel || doc.category || '')}</span>
            </div>
            <h4 class="catalog-card-title">${this.escapeHtml(doc.title)}</h4>
            ${doc.citation ? `<div class="catalog-card-citation">${this.escapeHtml(doc.citation)}</div>` : ''}
            ${doc.summary ? `<p class="catalog-card-summary">${this.escapeHtml(doc.summary)}</p>` : ''}
            <div class="catalog-card-actions">
              <button type="button" class="btn btn-sm btn-secondary" data-open-doc="${this.escapeHtml(doc.id)}">
                Otevřít ve čtečce
              </button>
            </div>
          </article>
        `;
      })
      .join('');

    this.catalogContainer.innerHTML = `
      <div class="catalog-controls">
        <div class="catalog-search-row">
          <label for="archive-search-input" class="sr-only">Hledat v odemčených pramenech</label>
          <input type="search"
                 id="archive-search-input"
                 class="catalog-search-input"
                 placeholder="Hledat podle názvu, spisové značky nebo obsahu..."
                 value="${this.escapeHtml(this.searchQuery)}" />
        </div>
        <div class="catalog-filters" role="group" aria-label="Filtrovat prameny podle druhu">
          ${filterButtonsHtml}
        </div>
      </div>
      <div class="catalog-list">
        ${cardsHtml || '<p class="catalog-empty">Zadanému filtru neodpovídá žádný dokument.</p>'}
      </div>
    `;
  }

  /**
   * Vykreslí přehled institucí (EU vs. Rada Evropy vs. Marensko) a procesní mapu řízení.
   */
  renderInstitutionsView() {
    if (!this.institutionsContainer) return;

    const unlockedInstIds = new Set(this.engine.state.unlockedInstitutions || []);
    const institutions = this.data.institutions.institutions || [];
    const comparisonNote = this.data.institutions.systemicComparison || null;

    const instCardsHtml = institutions
      .map((inst) => {
        const isUnlocked = unlockedInstIds.has(inst.id);
        if (!isUnlocked) {
          return `
            <article class="institution-card is-locked">
              <h4>${this.escapeHtml(inst.name)}</h4>
              <p class="institution-locked-text">Instituce zatím nevstoupila do aktuální fáze případu.</p>
            </article>
          `;
        }

        const powersHtml = Array.isArray(inst.keyPowers)
          ? `<ul class="institution-powers">${inst.keyPowers.map((p) => `<li>${this.escapeHtml(p)}</li>`).join('')}</ul>`
          : '';

        return `
          <article class="institution-card is-unlocked">
            <div class="institution-card-top">
              <span class="institution-system-badge">${this.escapeHtml(inst.system || '')}</span>
              ${inst.seat ? `<span class="institution-seat">${this.escapeHtml(inst.seat)}</span>` : ''}
            </div>
            <h4>${this.escapeHtml(inst.name)}</h4>
            <p class="institution-role">${this.escapeHtml(inst.role || '')}</p>
            ${powersHtml}
            ${
              inst.caseRelevance
                ? `<div class="institution-relevance"><strong>Význam v kauze Marensko:</strong> ${this.escapeHtml(inst.caseRelevance)}</div>`
                : ''
            }
          </article>
        `;
      })
      .join('');

    const comparisonBlockHtml = comparisonNote
      ? `
        <section class="institutions-comparison-box">
          <h4>${this.escapeHtml(comparisonNote.title || 'Rozlišení systémů: Evropská unie vs. Rada Evropy')}</h4>
          <p>${this.escapeHtml(comparisonNote.summary || '')}</p>
        </section>
      `
      : '';

    this.institutionsContainer.innerHTML = `
      <div class="institutions-wrapper">
        ${comparisonBlockHtml}
        <div class="institutions-list">
          ${instCardsHtml}
        </div>
      </div>
    `;
  }

  /**
   * Bezpečné escapování HTML znaků.
   * @param {string} str
   * @returns {string}
   */
  escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }
}
