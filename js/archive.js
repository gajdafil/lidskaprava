/**
 * archive.js
 * Řízení pravého panelu: Pracovní plocha pramenů (záložky + čtečka), Katalog archivu a Instituce a mapy.
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
    this.catalogFilter = 'Všechny kategorie';
    this.searchQuery = '';
    this.showComparison = false;
    this.lastActiveDocId = null;
    this.currentStepDef = null;

    // Reference na DOM prvky z index.html
    this.workspaceView = document.getElementById('view-doc-workspace');
    this.tabsContainer = document.getElementById('doc-tabs-bar');
    this.docToolbar = document.getElementById('doc-toolbar');
    this.docReader = document.getElementById('doc-reader');
    this.catalogView = document.getElementById('view-doc-catalog');
    this.catalogSelect = document.getElementById('archive-cat-select');
    this.catalogList = document.getElementById('archive-doc-list');
    this.institutionsView = document.getElementById('view-institutions');
    this.institutionsList = document.getElementById('institutions-list');
    this.schemaEuCoeBox = document.getElementById('schema-eu-coe-box');
    this.mapMarenieBox = document.getElementById('map-marenie-box');
    this.infringementSection = document.getElementById('viz-infringement-section');
    this.schemaInfringementBox = document.getElementById('schema-infringement-box');
    this.openTabsCountEl = document.getElementById('open-tabs-count');
    this.btnHighlight = document.getElementById('btn-highlight-passage');
    this.btnToggleCompare = document.getElementById('btn-toggle-compare');
    this.modeButtons = document.querySelectorAll('.archive-mode-btn');

    this.bindInternalEvents();
  }

  /**
   * Napojí posluchače na ovládací prvky uvnitř archivu.
   */
  bindInternalEvents() {
    this.modeButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const nextMode = btn.getAttribute('data-archive-mode');
        if (nextMode) {
          this.setMode(nextMode);
        }
      });
    });

    if (this.btnHighlight) {
      this.btnHighlight.addEventListener('click', () => {
        const activeDocId = this.engine.state.activeDocTab;
        const targetDocId = activeDocId || this.currentStepDef?.highlightDocId;
        if (!targetDocId) return;

        if (!this.engine.state.unlockedDocs.includes(targetDocId)) {
          return;
        }

        if (!activeDocId) {
          this.engine.openDocument(targetDocId);
        }
        this.engine.toggleDocumentHighlight(targetDocId);
        this.setMode('reader');
        if (this.onStateChange) this.onStateChange();
      });
    }

    if (this.btnToggleCompare) {
      this.btnToggleCompare.addEventListener('click', () => {
        this.showComparison = !this.showComparison;
        this.btnToggleCompare.setAttribute('aria-pressed', String(this.showComparison));
        this.btnToggleCompare.textContent = this.showComparison
          ? 'Skrýt srovnávací tabulku'
          : 'Porovnat s případem D7';
        this.renderReaderView();
      });
    }

    if (this.catalogSelect) {
      this.catalogSelect.addEventListener('change', (e) => {
        this.catalogFilter = e.target.value || 'Všechny kategorie';
        this.renderCatalogView();
      });
    }

    const pane = document.getElementById('archive-pane');
    if (pane) {
      pane.addEventListener('click', (e) => {
        const closeBtn = e.target.closest('[data-close-doc]');
        if (closeBtn) {
          e.stopPropagation();
          const docId = closeBtn.getAttribute('data-close-doc');
          if (docId === this.engine.state.activeDocTab) {
            this.showComparison = false;
          }
          this.engine.closeDocumentTab(docId);
          this.sync(this.currentStepDef);
          if (this.onStateChange) this.onStateChange();
          return;
        }

        const tabBtn = e.target.closest('[data-open-doc]');
        if (tabBtn) {
          const docId = tabBtn.getAttribute('data-open-doc');
          if (docId !== this.engine.state.activeDocTab) {
            this.showComparison = false;
          }
          this.engine.openDocument(docId);
          this.setMode('reader');
          if (this.onStateChange) this.onStateChange();
        }
      });

      pane.addEventListener('input', (e) => {
        if (e.target && e.target.id === 'archive-search-input') {
          this.searchQuery = e.target.value;
          this.renderCatalogView();
        }
      });
    }

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
      btn.classList.toggle('active', isMatch);
      btn.setAttribute('aria-selected', String(isMatch));
    });

    const isReader = newMode === 'reader';
    const isCatalog = newMode === 'catalog';
    const isInstitutions = newMode === 'institutions';

    if (this.workspaceView) {
      this.workspaceView.hidden = !isReader;
      this.workspaceView.style.display = isReader ? '' : 'none';
    }
    if (this.catalogView) {
      this.catalogView.hidden = !isCatalog;
      this.catalogView.style.display = isCatalog ? '' : 'none';
    }
    if (this.institutionsView) {
      this.institutionsView.hidden = !isInstitutions;
      this.institutionsView.style.display = isInstitutions ? '' : 'none';
    }

    if (isReader) {
      this.renderTabs();
      this.renderReaderView();
    } else if (isCatalog) {
      this.renderCatalogView();
    } else if (isInstitutions) {
      this.renderInstitutionsView();
    }
  }

  setCategoryFilter(category) {
    this.catalogFilter = category || 'Všechny kategorie';
    this.renderCatalogView();
  }

  /**
   * Resetuje lokální UI stav archivu při zahájení nové kampaně.
   */
  reset() {
    this.mode = 'reader';
    this.catalogFilter = 'Všechny kategorie';
    this.searchQuery = '';
    this.showComparison = false;
    this.lastActiveDocId = null;

    if (this.btnToggleCompare) {
      this.btnToggleCompare.setAttribute('aria-pressed', 'false');
      this.btnToggleCompare.textContent = 'Porovnat s případem D7';
    }
    this.setMode('reader');
  }

  /**
   * Synchronizuje panel archivu s aktuálním stavem hry a aktivním krokem.
   * @param {Object|null} currentStepDef
   */
  sync(currentStepDef = null) {
    this.currentStepDef = currentStepDef;

    if (this.openTabsCountEl) {
      this.openTabsCountEl.textContent = String((this.engine.state.openDocTabs || []).length);
    }

    this.setMode(this.mode);
  }

  /**
   * Vyhledá klíčové fráze pro zvýraznění v daném dokumentu.
   * @param {string} docId
   * @returns {string[]}
   */
  _resolveHighlightPhrases(docId) {
    if (
      this.currentStepDef &&
      this.currentStepDef.highlightDocId === docId &&
      Array.isArray(this.currentStepDef.highlightPhrases)
    ) {
      return this.currentStepDef.highlightPhrases;
    }

    const allQuestions = Object.values(this.data.questions || {});
    const matching = allQuestions.filter(
      (q) => q && q.highlightDocId === docId && Array.isArray(q.highlightPhrases)
    );
    if (matching.length > 0) {
      return matching.flatMap((q) => q.highlightPhrases);
    }

    return [
      'výhradně pokud uplatňují právo Unie',
      'spravedlivou rovnováhu',
      'ochrana základních práv je oprávněným zájmem',
      'nepřiměřený a neúnosný zásah',
      'obecných zásad práva'
    ];
  }

  /**
   * Vykreslí lištu otevřených záložek dokumentů.
   */
  renderTabs() {
    if (!this.tabsContainer) return;

    const openTabs = this.engine.state.openDocTabs || [];
    const activeDocId = this.engine.state.activeDocTab;
    const docsMap = this.data.documents.documents || {};

    if (this.openTabsCountEl) {
      this.openTabsCountEl.textContent = String(openTabs.length);
    }

    if (openTabs.length === 0) {
      this.tabsContainer.innerHTML = '';
      return;
    }

    this.tabsContainer.innerHTML = openTabs
      .map((docId) => {
        const doc = docsMap[docId];
        if (!doc) return '';
        const isActive = docId === activeDocId;

        return `
          <div class="doc-tab ${isActive ? 'active' : ''}" role="tab" aria-selected="${isActive}" data-open-doc="${this.escapeHtml(docId)}">
            <span class="doc-tab-title" title="${this.escapeHtml(doc.title)}">${this.escapeHtml(doc.title)}</span>
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

    const activeDocId = this.engine.state.activeDocTab;
    const docsMap = this.data.documents.documents || {};
    const doc = activeDocId ? docsMap[activeDocId] : null;

    if (!doc) {
      if (this.docToolbar) {
        this.docToolbar.hidden = true;
        this.docToolbar.style.display = 'none';
      }
      this.showComparison = false;
      this.docReader.innerHTML = `
        <div class="empty-state">
          <p>Zatím nemáte otevřený žádný dokument.</p>
          <p class="small">Vyberte dokument z <strong>Katalogu archivu</strong> nebo klikněte na odkazovaný pramen v zadání úlohy.</p>
        </div>
      `;
      return;
    }

    if (this.docToolbar) {
      this.docToolbar.hidden = false;
      this.docToolbar.style.display = '';
    }

    const isHighlighted = Boolean(this.engine.state.highlightedDocs?.[activeDocId]);
    if (this.btnHighlight) {
      this.btnHighlight.hidden = false;
      this.btnHighlight.style.display = '';
      this.btnHighlight.setAttribute('aria-pressed', String(isHighlighted));
      this.btnHighlight.textContent = isHighlighted
        ? 'Zrušit zvýraznění pasáží'
        : 'Zvýraznit relevantní pasáže';
    }

    const unlockedDocs = this.engine.state.unlockedDocs || [];
    const hasComparison =
      Boolean(doc.comparisonId && this.data.documents.comparisons?.[doc.comparisonId]) ||
      (activeDocId === 'sb' && unlockedDocs.includes('cmp_sb_k5'));

    if (this.btnToggleCompare) {
      this.btnToggleCompare.hidden = !hasComparison;
      this.btnToggleCompare.style.display = hasComparison ? '' : 'none';
      if (!hasComparison) {
        this.showComparison = false;
      }
      this.btnToggleCompare.setAttribute('aria-pressed', String(this.showComparison));
      this.btnToggleCompare.textContent = this.showComparison
        ? 'Skrýt srovnávací tabulku'
        : 'Porovnat s případem D7';
    }

    if (this.showComparison && hasComparison) {
      this.docReader.innerHTML = renderComparisonTable(
        this.data.documents,
        unlockedDocs
      );
      return;
    }

    const highlightPhrases = isHighlighted ? this._resolveHighlightPhrases(activeDocId) : null;
    this.docReader.innerHTML = renderDocumentView(doc, highlightPhrases);

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
    if (!this.catalogList) return;

    const docsMap = this.data.documents.documents || {};
    const unlockedSet = new Set(this.engine.state.unlockedDocs || []);
    const allDocs = Object.values(docsMap);

    const categories = Array.isArray(this.data.documents.categories) && this.data.documents.categories.length > 0
      ? this.data.documents.categories
      : ['Všechny kategorie', ...new Set(allDocs.map((d) => d.category).filter(Boolean))];

    if (this.catalogSelect) {
      if (!categories.includes(this.catalogFilter)) {
        this.catalogFilter = categories[0];
      }
      this.catalogSelect.innerHTML = categories
        .map(
          (cat) => `
          <option value="${this.escapeHtml(cat)}" ${this.catalogFilter === cat ? 'selected' : ''}>
            ${this.escapeHtml(cat)}
          </option>
        `
        )
        .join('');
    }

    const query = this.searchQuery.trim().toLowerCase();

    const filteredDocs = allDocs.filter((doc) => {
      if (this.catalogFilter !== 'Všechny kategorie' && this.catalogFilter !== 'all') {
        if (doc.category !== this.catalogFilter) return false;
      }
      if (!query) return true;
      if (!unlockedSet.has(doc.id)) return false;
      const haystack = `${doc.title || ''} ${doc.summary || ''} ${doc.provisionOrCase || ''} ${doc.sourceId || ''}`.toLowerCase();
      return haystack.includes(query);
    });

    if (filteredDocs.length === 0) {
      this.catalogList.innerHTML =
        '<p class="small">Zadanému filtru neodpovídá žádný dokument.</p>';
      return;
    }

    this.catalogList.innerHTML = filteredDocs
      .map((doc) => {
        const isUnlocked = unlockedSet.has(doc.id);
        if (!isUnlocked) {
          return `
            <article class="catalog-item locked">
              <div class="catalog-item-meta">${this.escapeHtml(doc.category || '')} • Neodemčeno</div>
              <h4>${this.escapeHtml(doc.title)}</h4>
              <p class="small" style="margin-bottom: 0;">
                Dokument se zpřístupní v další fázi mandátu nebo na základě rozhodnutí vlády.
              </p>
            </article>
          `;
        }

        const metaParts = [doc.category, doc.provisionOrCase || doc.date].filter(Boolean);

        return `
          <article class="catalog-item">
            <div class="catalog-item-meta">${this.escapeHtml(metaParts.join(' • '))}</div>
            <h4>${this.escapeHtml(doc.title)}</h4>
            ${doc.summary ? `<p class="small">${this.escapeHtml(doc.summary)}</p>` : ''}
            <button type="button" class="btn btn-alt btn-sm" data-open-doc="${this.escapeHtml(doc.id)}">
              Otevřít ve čtečce
            </button>
          </article>
        `;
      })
      .join('');
  }

  /**
   * Vykreslí přehled institucí (EU vs. Rada Evropy vs. Marensko) a procesní schémata.
   */
  renderInstitutionsView() {
    const instData = this.data.institutions || {};
    const unlockedInstIds = new Set(this.engine.state.unlockedInstitutions || []);
    const institutions = instData.institutions || [];
    const diagrams = instData.diagrams || {};

    if (this.institutionsList) {
      this.institutionsList.innerHTML = institutions
        .map((inst) => {
          const isUnlocked = unlockedInstIds.has(inst.id);
          if (!isUnlocked) {
            return `
              <article class="inst-card locked">
                <div class="inst-system">${this.escapeHtml(inst.system || 'Neodemčená instituce')}</div>
                <h4>${this.escapeHtml(inst.name)}</h4>
                <p class="small" style="margin-bottom: 0;">
                  Instituce zatím nevstoupila do aktuální fáze rozhodování vlády.
                </p>
              </article>
            `;
          }

          return `
            <article class="inst-card">
              <div class="inst-system">${this.escapeHtml(inst.system || '')}</div>
              <h4>${this.escapeHtml(inst.name)}</h4>
              ${inst.role ? `<p class="small"><strong>Role:</strong> ${this.escapeHtml(inst.role)}</p>` : ''}
              ${inst.powers ? `<p class="small"><strong>Pravomoci:</strong> ${this.escapeHtml(inst.powers)}</p>` : ''}
              ${inst.legalBasis ? `<p class="small"><strong>Právní základ:</strong> ${this.escapeHtml(inst.legalBasis)}</p>` : ''}
              ${inst.relations ? `<p class="small" style="margin-bottom: 0;"><strong>Vztahy:</strong> ${this.escapeHtml(inst.relations)}</p>` : ''}
            </article>
          `;
        })
        .join('');
    }

    if (this.schemaEuCoeBox && diagrams.euCoeSchema) {
      this.schemaEuCoeBox.innerHTML = diagrams.euCoeSchema;
    }

    if (this.mapMarenieBox && diagrams.marenieMap) {
      this.mapMarenieBox.innerHTML = diagrams.marenieMap;
    }

    const unlockedDocs = this.engine.state.unlockedDocs || [];
    const showInfringement =
      unlockedDocs.includes('dk') ||
      unlockedDocs.includes('sfeu_258') ||
      unlockedDocs.includes('fz') ||
      this.engine.state.currentChapterId === 'K6';

    if (this.infringementSection) {
      this.infringementSection.hidden = !showInfringement;
      this.infringementSection.style.display = showInfringement ? '' : 'none';
    }
    if (showInfringement && this.schemaInfringementBox && diagrams.infringementSchema) {
      this.schemaInfringementBox.innerHTML = diagrams.infringementSchema;
    }
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
