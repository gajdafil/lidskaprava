/**
 * reports.js
 * Závěrečný individualizovaný akademický posudek a export výsledků simulace.
 */

import { escapeHtml } from './documents.js';

export class AssessmentReporter {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
  }

  /**
   * Vykreslí kompletní obrazovku závěrečného akademického posudku.
   * @returns {string} HTML řetězec
   */
  render() {
    const report = this.engine.getAssessmentReport();
    const res = report.results;

    const competenciesHtml = report.competencyNarratives
      .map(
        (c) => `
        <article class="competency-card">
          <div class="competency-top">
            <div>
              <strong>${escapeHtml(c.id)} – ${escapeHtml(c.name)}</strong>
              <span style="font-size: 0.82rem; color: var(--text-muted); margin-left: 0.5rem;">
                (${c.earnedPoints} / ${c.maxPoints} surových b.)
              </span>
            </div>
            <div>
              <strong>${c.score} / 100 b.</strong> • Pásmo: <em>${escapeHtml(c.bandLabel)}</em>
              ${
                c.penalty > 0
                  ? `<span class="tag-pill" style="margin-left: 0.4rem;">Srážka za opakované chyby: -${c.penalty} b.</span>`
                  : ''
              }
            </div>
          </div>
          <div class="progress-track">
            <div class="progress-fill is-${escapeHtml(c.bandId)}" style="width: ${Math.min(
          100,
          c.score
        )}%"></div>
          </div>
          <p style="margin: 0.45rem 0; font-size: 0.93rem;">${escapeHtml(c.narrative)}</p>
          <p style="margin: 0; font-size: 0.88rem; color: var(--royal-700);">
            ${escapeHtml(c.recommendation)}
          </p>
        </article>
      `
      )
      .join('');

    const repeatedTagsHtml =
      res.repeatedTags.length > 0
        ? `
        <h3>Opakované metodické chyby (srážky z kompetencí)</h3>
        <ul>
          ${res.repeatedTags
            .map(
              (rt) => `
              <li>
                <strong>${escapeHtml(rt.tag)}</strong> (${escapeHtml(
                rt.description
              )}) – výskyt ${rt.count}×, srážka -${rt.penaltyApplied} b. v kompetenci ${escapeHtml(
                rt.targetCompetency
              )}.
              </li>
            `
            )
            .join('')}
        </ul>
      `
        : '';

    const strategicHtml = report.strategicNarratives
      .map(
        (s) => `
        <div style="margin-bottom: 0.85rem; padding-bottom: 0.75rem; border-bottom: 1px solid var(--border-color);">
          <strong>${escapeHtml(s.title)}</strong> – zvolena varianta <strong>${escapeHtml(
          s.selectedOptionId
        )}</strong> (${s.pointsEarned} b.)
          <p style="margin: 0.35rem 0 0; font-size: 0.92rem;">${escapeHtml(s.evaluation)}</p>
        </div>
      `
      )
      .join('');

    const remedialHtml =
      report.remedialNarratives.length > 0
        ? `
        <h3>Vyhodnocení nápravných kroků</h3>
        ${report.remedialNarratives
          .map((r) => `<p style="font-size: 0.92rem;">${escapeHtml(r.evaluation)}</p>`)
          .join('')}
      `
        : '';

    return `
      <main class="assessment-container">
        <article class="assessment-sheet">
          <div class="editorial-kicker">Závěrečné akademické vyhodnocení simulace</div>
          <h1>${escapeHtml(report.meta.title)}</h1>
          <p style="color: var(--text-secondary);">
            Hodnocení čtyřletého mandátu předsedy vlády (${escapeHtml(report.meta.country)})
          </p>

          <div class="grade-banner">
            <div>
              <div style="font-size: 0.85rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary);">
                Celkový bodový zisk právní úspěšnosti
              </div>
              <div style="font-size: 1.55rem; font-weight: 800; color: var(--navy-900);">
                ${res.totalEarned} / ${res.totalMaxPoints} bodů (${res.totalPercentage} %)
              </div>
            </div>
            <div>
              <div style="font-size: 0.8rem; text-transform: uppercase; font-weight: 700; color: var(--text-secondary); margin-bottom: 0.25rem;">
                Výsledná klasifikace
              </div>
              <div class="grade-badge">${escapeHtml(res.gradeLabel)}</div>
            </div>
          </div>

          ${
            report.downgradeNote
              ? `<div class="readonly-banner">${escapeHtml(report.downgradeNote)}</div>`
              : ''
          }

          <p style="font-size: 1.02rem; line-height: 1.65;">${escapeHtml(report.introParagraph)}</p>

          <hr style="border: none; border-top: 1px solid var(--border-color); margin: 1.5rem 0;" />

          <h2>Profil osmi právních kompetencí</h2>
          ${competenciesHtml}

          ${repeatedTagsHtml}

          <h2>Přehled klíčových vládních rozhodnutí (S1–S6)</h2>
          ${strategicHtml}

          ${remedialHtml}

          <h2>Poznámka k metodě práce s prameny a nápovědami</h2>
          <p style="font-size: 0.92rem;">${escapeHtml(report.studyMethodNote)}</p>

          <div class="action-bar no-print">
            <button type="button" class="btn btn-gold" data-action="print-assessment">
              Vytisknout / Uložit posudek jako PDF
            </button>
            <button type="button" class="btn btn-secondary" data-action="export-assessment-md">
              Stáhnout posudek (.md)
            </button>
            <button
              type="button"
              class="btn btn-secondary"
              data-action="select-chapter"
              data-chapter-id="K1"
            >
              Prohlédnout odehrané kapitoly
            </button>
            <button type="button" class="btn btn-primary" data-action="new-game">
              Spustit novou kampaň
            </button>
          </div>
        </article>
      </main>
    `;
  }

  /**
   * Vygeneruje čistý textový protokol posudku ve formátu Markdown a spustí jeho stažení.
   */
  downloadMarkdownReport() {
    const report = this.engine.getAssessmentReport();
    const res = report.results;

    const lines = [
      `# Akademický posudek: ${report.meta.title}`,
      ``,
      `- **Stát:** ${report.meta.country}`,
      `- **Celkový bodový zisk:** ${res.totalEarned} / ${res.totalMaxPoints} bodů (${res.totalPercentage} %)`,
      `- **Výsledná klasifikace:** ${report.results.gradeLabel}`,
      `- **Datum vyhotovení:** ${new Date(report.meta.generatedAt).toLocaleString('cs-CZ')}`,
      ``,
      `## Celkové zhodnocení`,
      ``,
      report.introParagraph,
      report.downgradeNote ? `\n> ${report.downgradeNote}\n` : '',
      `## Profil osmi právních kompetencí`,
      ``
    ];

    for (const c of report.competencyNarratives) {
      lines.push(
        `### ${c.id} – ${c.name}: ${c.score} / 100 b. (${c.bandLabel})`,
        `- Surový zisk: ${c.earnedPoints} / ${c.maxPoints} b.${
          c.penalty > 0 ? ` | Srážka za opakované chyby: -${c.penalty} b.` : ''
        }`,
        ``,
        c.narrative,
        ``,
        `*Doporučení:* ${c.recommendation}`,
        ``
      );
    }

    if (res.repeatedTags.length > 0) {
      lines.push(`## Opakované metodické chyby`, ``);
      for (const rt of res.repeatedTags) {
        lines.push(
          `- **${rt.tag}** (${rt.description}): výskyt ${rt.count}×, srážka -${rt.penaltyApplied} b. (${rt.targetCompetency})`
        );
      }
      lines.push(``);
    }

    lines.push(`## Klíčová rozhodnutí kabinetu (S1–S6)`, ``);
    for (const s of report.strategicNarratives) {
      lines.push(
        `### ${s.title} (Varianta ${s.selectedOptionId}, ${s.pointsEarned} b.)`,
        ``,
        s.evaluation,
        ``
      );
    }

    if (report.remedialNarratives.length > 0) {
      lines.push(`## Nápravná opatření`, ``);
      for (const r of report.remedialNarratives) {
        lines.push(`- ${r.evaluation}`);
      }
      lines.push(``);
    }

    lines.push(`## Poznámka k metodě práce`, ``, report.studyMethodNote);

    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'akademicky-posudek-marenie.md';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}
