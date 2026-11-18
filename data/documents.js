/**
 * documents.js
 * Čtečka právních pramenů v panelu archivu a vykreslování institucionálních map a diagramů.
 */

export function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function escapeRegExp(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const VERIFICATION_LABELS = {
  verified: 'Ověřený pramen',
  translation: 'Vlastní překlad z originálu',
  needs_verification: 'Částečně k ověření',
  fictional: 'Fiktivní spis / akt'
};

export class DocumentViewer {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.showComparison = {};
  }

  toggleComparison(docId) {
    this.showComparison[docId] = !this.showComparison[docId];
  }

  isComparisonVisible(docId) {
    return Boolean(this.showComparison[docId]);
  }

  resetViewState() {
    this.showComparison = {};
  }

  /**
   * Vyhledá klíčové fráze určené ke zvýraznění pro zadaný dokument.
   * @param {string} docId
   * @param {Object|null} currentStepDef
   * @returns {Array<string>}
   */
  resolveHighlightPhrases(docId, currentStepDef) {
    if (
      currentStepDef &&
      currentStepDef.highlightDocId === docId &&
      Array.isArray(currentStepDef.highlightPhrases)
    ) {
      return currentStepDef.highlightPhrases;
    }

    const allQuestions = Object.values(this.engine.data.questions || {});
    const matching = allQuestions.filter(
      (q) => q.highlightDocId === docId && Array.isArray(q.highlightPhrases)
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
   * Vykreslí prázdný stav čtečky dokumentů.
   * @returns {string}
   */
  renderEmptyState() {
    return `
      <div class="empty-state">
        <p>Zatím nemáte otevřený žádný dokument.</p>
        <p class="small">Vyberte dokument z <strong>Katalogu archivu</strong> nebo klikněte na odkazovaný pramen v zadání úlohy.</p>
      </div>
    `;
  }

  /**
   * Vykreslí obsah otevřeného dokumentu do prvku #doc-reader.
   * @param {Object} doc
   * @param {Object|null} currentStepDef
   * @returns {string}
   */
  renderDocument(doc, currentStepDef) {
    if (!doc) {
      return this.renderEmptyState();
    }

    const isHighlighted = Boolean(this.engine.state.highlightedDocs[doc.id]);
    const phrases = this.resolveHighlightPhrases(doc.id, currentStepDef);

    const paragraphsHtml = (doc.paragraphs || [])
      .map((p) => {
        let safeHtml = escapeHtml(p);
        if (isHighlighted && phrases.length > 0) {
          for (const phrase of phrases) {
            const safePhrase = escapeHtml(phrase);
            if (!safePhrase) continue;
            const rx = new RegExp(`(${escapeRegExp(safePhrase)})`, 'gi');
            safeHtml = safeHtml.replace(rx, '<mark>$1</mark>');
          }
        }
        return `<p>${safeHtml}</p>`;
      })
      .join('');

    const comparisonObj = doc.comparisonId
      ? this.engine.data.documents.comparisons?.[doc.comparisonId]
      : null;
    const compVisible = this.isComparisonVisible(doc.id);

    const isWarningBadge =
      doc.verificationStatus === 'needs_verification' ||
      doc.verificationStatus === 'fictional';

    return `
      <div class="doc-meta-card">
        <div style="margin-bottom: 0.35rem;">
          <span class="doc-tag-pill ${isWarningBadge ? 'doc-tag-warn' : ''}">
            ${escapeHtml(VERIFICATION_LABELS[doc.verificationStatus] || doc.verificationStatus)}
          </span>
          <span class="doc-tag-pill">${escapeHtml(doc.category)}</span>
        </div>
        <h3>${escapeHtml(doc.title)}</h3>
        <div><strong>Citace / označení:</strong> ${escapeHtml(doc.provisionOrCase)}</div>
        <div><strong>Zdroj:</strong> ${escapeHtml(doc.sourceId)} (${escapeHtml(doc.date)})</div>
        <div class="small" style="margin-top: 0.25rem;">${escapeHtml(doc.verificationNote)}</div>
      </div>

      <p class="doc-quote">${escapeHtml(doc.summary)}</p>

      ${
        comparisonObj && compVisible
          ? `<section class="compare-box" aria-label="Srovnání s případem D7">
              <h4>Srovnání: ${escapeHtml(comparisonObj.leftHeading)} vs. ${escapeHtml( comparisonObj.rightHeading )}</h4>${(comparisonObj.rows || [])
                .map(
                  (r) => `
                  <div style="margin-bottom: 0.55rem;">
                    <div class="small" style="font-weight: 700; color: var(--navy-800); margin-bottom: 0.2rem;">
                      ${escapeHtml(r.aspect)}
                    </div>
                    <div class="compare-grid">
                      <div class="compare-col">
                        <strong>${escapeHtml(comparisonObj.leftHeading)}:</strong><br />
                        ${escapeHtml(r.left)}
                      </div>
                      <div class="compare-col">
                        <strong>${escapeHtml(comparisonObj.rightHeading)}:</strong><br />
                        ${escapeHtml(r.right)}
                      </div>
                    </div>
                  </div>
                `
                )
                .join('')}
            </section>`
          : ''
      }

      <div class="doc-body-text">${paragraphsHtml}</div>

      ${
        doc.detailedCommentary
          ? `<details class="doc-details">
              <summary>Podrobnější právní výklad k tomuto dokumentu</summary>
              <div class="doc-details-content">
                <p style="margin: 0;">${escapeHtml(doc.detailedCommentary)}</p>
              </div>
            </details>`
          : ''
      }
    `;
  }

  /**
   * Aktualizuje obsah třetího pohledu archivu (#view-institutions) v DOMu.
   */
  updateInstitutionsView() {
    const instData = this.engine.data.institutions;
    if (!instData) return;

    const listEl = document.getElementById('institutions-list');
    const euCoeBox = document.getElementById('schema-eu-coe-box');
    const mapBox = document.getElementById('map-marenie-box');
    const infSection = document.getElementById('viz-infringement-section');
    const infBox = document.getElementById('schema-infringement-box');

    const unlockedIds = this.engine.state.unlockedInstitutions || [];
    const unlockedInstitutions = (instData.institutions || []).filter((i) =>
      unlockedIds.includes(i.id)
    );

    if (listEl) {
      if (unlockedInstitutions.length === 0) {
        listEl.innerHTML =
          '<p class="small">Zatím nebyly odemčeny žádné instituce.</p>';
      } else {
        listEl.innerHTML = unlockedInstitutions
          .map(
            (inst) => `
            <article class="inst-card">
              <div class="eyebrow">${escapeHtml(inst.system)}</div>
              <h4>${escapeHtml(inst.name)}</h4>
              <p><strong>Role:</strong> ${escapeHtml(inst.role)}</p>
              <p><strong>Pravomoci:</strong> ${escapeHtml(inst.powers)}</p>
              <p class="small"><strong>Právní základ:</strong> ${escapeHtml(inst.legalBasis)}</p>
              <p class="small" style="margin-bottom: 0;"><strong>Vztahy:</strong> ${escapeHtml(
                inst.relations
              )}</p>
            </article>
          `
          )
          .join('');
      }
    }

    if (euCoeBox && !euCoeBox.dataset.rendered) {
      euCoeBox.innerHTML = instData.diagrams.euCoeSchema || '';
      euCoeBox.dataset.rendered = 'true';
    }

    if (mapBox && !mapBox.dataset.rendered) {
      mapBox.innerHTML = instData.diagrams.marenieMap || '';
      mapBox.dataset.rendered = 'true';
    }

    const hasInfringement =
      this.engine.state.unlockedDocs.includes('dk') ||
      this.engine.state.unlockedDocs.includes('sfeu_258');

    if (infSection) {
      infSection.hidden = !hasInfringement;
      infSection.style.display = hasInfringement ? 'block' : 'none';
    }

    if (infBox && hasInfringement && !infBox.dataset.rendered) {
      infBox.innerHTML = instData.diagrams.infringementSchema || '';
      infBox.dataset.rendered = 'true';
    }
  }
}
