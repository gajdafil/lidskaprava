/**
 * documents.js
 * Vykreslování právních dokumentů (čtečka pramenů) a modálního přehledu institucí a map.
 */

const VERIFICATION_LABELS = {
  verified: 'Ověřený pramen',
  translation: 'Vlastní překlad z originálu',
  needs_verification: 'Částečně k ověření',
  fictional: 'Fiktivní spis / akt'
};

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

/**
 * Vykreslí dokument pro ArchivePanel.
 * @param {Object|null} doc
 * @param {string|string[]|null} highlightTarget
 * @returns {string}
 */
export function renderDocumentView(doc, highlightTarget = null) {
  if (!doc) {
    return '<p style="color: var(--text-muted);">Vyberte dokument ze seznamu výše.</p>';
  }

  const highlights = (Array.isArray(highlightTarget)
    ? highlightTarget
    : [highlightTarget]
  ).filter((phrase) => typeof phrase === 'string' && phrase.trim());

  const paragraphsHtml = (doc.paragraphs || [])
    .map((paragraph) => {
      let safeHtml = escapeHtml(paragraph);
      for (const phrase of highlights) {
        const safePhrase = escapeHtml(phrase.trim());
        const rx = new RegExp(`(${escapeRegExp(safePhrase)})`, 'gi');
        safeHtml = safeHtml.replace(rx, '<mark class="doc-highlight">$1</mark>');
      }
      return `<p>${safeHtml}</p>`;
    })
    .join('');

  const verificationStatus = doc.verificationStatus
    ? `<span class="verify-badge is-${escapeHtml(doc.verificationStatus)}">${escapeHtml(
        VERIFICATION_LABELS[doc.verificationStatus] || doc.verificationStatus
      )}</span>`
    : '';

  return `
    ${verificationStatus}
    <h3>${escapeHtml(doc.title || 'Právní dokument')}</h3>
    <div class="doc-meta-box">
      ${doc.provisionOrCase ? `<div><strong>Citace / označení:</strong> ${escapeHtml(doc.provisionOrCase)}</div>` : ''}
      ${doc.citation ? `<div><strong>Citace:</strong> ${escapeHtml(doc.citation)}</div>` : ''}
      ${doc.sourceId ? `<div><strong>Zdroj:</strong> ${escapeHtml(doc.sourceId)}${doc.date ? ` (${escapeHtml(doc.date)})` : ''}</div>` : ''}
      ${doc.verificationNote ? `<div><strong>Poznámka k ověření:</strong> ${escapeHtml(doc.verificationNote)}</div>` : ''}
    </div>
    ${doc.summary ? `<p style="font-style: italic; color: var(--text-secondary);">${escapeHtml(doc.summary)}</p>` : ''}
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
 * Vykreslí srovnávací tabulky náležející k odemčeným dokumentům.
 * @param {Object} documentsData
 * @param {string[]} unlockedDocIds
 * @returns {string}
 */
export function renderComparisonTable(documentsData, unlockedDocIds = []) {
  const docs = documentsData?.documents || {};
  const comparisons = documentsData?.comparisons || {};
  const unlocked = new Set(unlockedDocIds);
  const seen = new Set();

  const tables = Object.values(docs)
    .filter((doc) => doc && unlocked.has(doc.id) && doc.comparisonId)
    .filter((doc) => {
      if (seen.has(doc.comparisonId)) return false;
      seen.add(doc.comparisonId);
      return true;
    })
    .map((doc) => {
      const comparison = comparisons[doc.comparisonId];
      if (!comparison || !Array.isArray(comparison.rows)) return '';

      const rowsHtml = comparison.rows
        .map(
          (row) => `
          <tr>
            <td><strong>${escapeHtml(row.aspect)}</strong></td>
            <td>${escapeHtml(row.left)}</td>
            <td>${escapeHtml(row.right)}</td>
          </tr>
        `
        )
        .join('');

      return `
        <section class="comparison-section">
          <h3>${escapeHtml(comparison.title || doc.title || 'Srovnání právních pramenů')}</h3>
          <table class="comparison-table">
            <thead>
              <tr>
                <th>Hledisko</th>
                <th>${escapeHtml(comparison.leftHeading)}</th>
                <th>${escapeHtml(comparison.rightHeading)}</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </section>
      `;
    })
    .filter(Boolean);

  return tables.length
    ? tables.join('')
    : '<p class="small">Pro odemčené dokumenty není k dispozici žádná srovnávací tabulka.</p>';
}

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
   * @param {Object} doc
   * @param {Object|null} currentStepDef
   * @returns {string}
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
}
