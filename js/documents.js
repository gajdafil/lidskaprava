/**
 * documents.js
 * Vykreslování právních dokumentů (čtečka pramenů) a modálního přehledu institucí a map.
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
    this.showComparisonTable = {};
  }

  toggleComparison(docId) {
    this.showComparisonTable[docId] = !this.showComparisonTable[docId];
  }

  resetViewState() {
    this.showComparisonTable = {};
  }

  /**
   * Určí fráze pro zvýraznění v daném dokumentu podle aktuálního nebo souvisejícího kroku.
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
   * Vykreslí detailní obsah jednoho otevřeného právního pramene.
   * @param {Object} doc - Záznam z documents.json
   * @param {Object|null} currentStepDef - Aktuálně zobrazený krok scénáře
   * @returns {string} HTML řetězec
   */
  renderDocument(doc, currentStepDef) {
    if (!doc) {
      return '<p style="color: var(--text-muted);">Vyberte dokument ze seznamu výše.</p>';
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
            safeHtml = safeHtml.replace(rx, '<mark class="doc-highlight">$1</mark>');
          }
        }
        return `<p>${safeHtml}</p>`;
      })
      .join('');

    const comparisonObj = doc.comparisonId
      ? this.engine.data.documents.comparisons?.[doc.comparisonId]
      : null;
    const compVisible = Boolean(this.showComparisonTable[doc.id]);

    return `
      <div class="doc-toolbar">
        <span class="verify-badge is-${escapeHtml(doc.verificationStatus)}">
          ${escapeHtml(VERIFICATION_LABELS[doc.verificationStatus] || doc.verificationStatus)}
        </span>
        <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
          ${
            comparisonObj
              ? `<button
                  type="button"
                  class="btn btn-sm btn-gold"
                  data-action="toggle-doc-comparison"
                  data-doc-id="${escapeHtml(doc.id)}"
                >
                  ${compVisible ? 'Skrýt srovnávací tabulku' : 'Porovnat s případem D7'}
                </button>`
              : ''
          }
          <button
            type="button"
            class="btn btn-sm ${isHighlighted ? 'btn-primary' : 'btn-secondary'}"
            data-action="toggle-doc-highlight"
            data-doc-id="${escapeHtml(doc.id)}"
          >
            ${isHighlighted ? 'Zrušit zvýraznění pasáží' : 'Zvýraznit klíčové pasáže'}
          </button>
        </div>
      </div>

      <h3>${escapeHtml(doc.title)}</h3>

      <div class="doc-meta-box">
        <div><strong>Citace / označení:</strong> ${escapeHtml(doc.provisionOrCase)}</div>
        <div><strong>Zdroj:</strong> ${escapeHtml(doc.sourceId)} (${escapeHtml(doc.date)})</div>
        <div><strong>Poznámka k ověření:</strong> ${escapeHtml(doc.verificationNote)}</div>
      </div>

      <p style="font-style: italic; color: var(--text-secondary);">${escapeHtml(doc.summary)}</p>

      ${
        comparisonObj && compVisible
          ? `<table class="comparison-table">
              <thead>
                <tr>
                  <th>Hledisko</th>
                  <th>${escapeHtml(comparisonObj.leftHeading)}</th>
                  <th>${escapeHtml(comparisonObj.rightHeading)}</th>
                </tr>
              </thead>
              <tbody>
                ${comparisonObj.rows
                  .map(
                    (r) => `
                    <tr>
                      <td><strong>${escapeHtml(r.aspect)}</strong></td>
                      <td>${escapeHtml(r.left)}</td>
                      <td>${escapeHtml(r.right)}</td>
                    </tr>
                  `
                  )
                  .join('')}
              </tbody>
            </table>`
          : ''
      }

      <div class="doc-paragraphs">${paragraphsHtml}</div>

      ${
        doc.detailedCommentary
          ? `<details class="doc-commentary">
              <summary>Podrobnější právní výklad k tomuto dokumentu</summary>
              <p style="margin: 0.65rem 0 0;">${escapeHtml(doc.detailedCommentary)}</p>
            </details>`
          : ''
      }
    `;
  }

  /**
   * Vykreslí modální okno Institucionální mapy, schémat a odemčených institucí.
   * @returns {string} HTML řetězec
   */
  renderInstitutionsModal() {
    const instData = this.engine.data.institutions;
    const unlockedIds = this.engine.state.unlockedInstitutions || [];
    const unlockedInstitutions = (instData.institutions || []).filter((i) =>
      unlockedIds.includes(i.id)
    );

    const hasInfringement =
      this.engine.state.unlockedDocs.includes('dk') ||
      this.engine.state.unlockedDocs.includes('sfeu_258');

    return `
      <div class="modal-backdrop" data-action="close-institutions-backdrop">
        <div class="modal-window" role="dialog" aria-modal="true" aria-labelledby="inst-modal-title">
          <div class="modal-header">
            <h2 id="inst-modal-title">Institucionální mapa, právní systémy a geografie Marenie</h2>
            <button type="button" class="btn btn-topbar" data-action="close-institutions">
              Zavřít ×
            </button>
          </div>
          <div class="modal-body">
            <h3>1. Dva oddělené evropské systémy ochrany práv</h3>
            <div class="svg-diagram-box">${instData.diagrams.euCoeSchema}</div>

            <h3>2. Orientační mapa Marenské republiky a tranzitního koridoru D7</h3>
            <div class="svg-diagram-box">${instData.diagrams.marenieMap}</div>

            ${
              hasInfringement
                ? `<h3>3. Průběh řízení o nesplnění povinnosti podle čl. 258 SFEU</h3>
                   <div class="svg-diagram-box">${instData.diagrams.infringementSchema}</div>`
                : ''
            }

            <h3>Odemčené instituce v průběhu mandátu (${unlockedInstitutions.length} / ${
      instData.institutions.length
    })</h3>
            <div class="institutions-grid">
              ${unlockedInstitutions
                .map(
                  (inst) => `
                  <article class="institution-card">
                    <div class="institution-system">${escapeHtml(inst.system)}</div>
                    <h4>${escapeHtml(inst.name)}</h4>
                    <p style="font-size: 0.88rem;"><strong>Role:</strong> ${escapeHtml(
                      inst.role
                    )}</p>
                    <p style="font-size: 0.88rem;"><strong>Pravomoci:</strong> ${escapeHtml(
                      inst.powers
                    )}</p>
                    <p style="font-size: 0.84rem; color: var(--text-secondary);"><strong>Právní základ:</strong> ${escapeHtml(
                      inst.legalBasis
                    )}</p>
                    <p style="font-size: 0.84rem; color: var(--text-secondary); margin-bottom: 0;"><strong>Vztahy:</strong> ${escapeHtml(
                      inst.relations
                    )}</p>
                  </article>
                `
                )
                .join('')}
            </div>
          </div>
        </div>
      </div>
    `;
  }
}
