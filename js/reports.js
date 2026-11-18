/**
 * reports.js
 * Závěrečný individualizovaný akademický posudek a historie dokončených mandátů.
 */

import { escapeHtml } from './documents.js';

const HISTORY_STORAGE_KEY = 'letat_cest_moi_history_v1';

export class AssessmentReporter {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
  }

  loadHistory() {
    try {
      const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  recordCompletedCampaign(playerName) {
    const state = this.engine.state;
    if (state.screen !== 'assessment' || !state.completedAt) return;

    const history = this.loadHistory();
    if (history.some((item) => item.completedAt === state.completedAt)) {
      return;
    }

    const results = this.engine.getResults();
    history.unshift({
      completedAt: state.completedAt,
      playerName: playerName || 'Předseda vlády Marenie',
      totalEarned: results.totalEarned,
      totalMaxPoints: results.totalMaxPoints,
      totalPercentage: results.totalPercentage,
      gradeLabel: results.gradeLabel
    });

    try {
      window.localStorage.setItem(
        HISTORY_STORAGE_KEY,
        JSON.stringify(history.slice(0, 15))
      );
    } catch {
      // Ignorovat při omezení úložiště
    }
  }

  /**
   * Vykreslí kompletní akademický posudek do #main.
   * @param {string} playerName
   * @returns {string}
   */
  render(playerName) {
    const report = this.engine.getAssessmentReport();
    const res = report.results;
    const displayPlayer = playerName || 'Předseda vlády Marenské republiky';
    const dateFormatted = new Date(report.meta.generatedAt).toLocaleDateString('cs-CZ');

    const competenciesHtml = report.competencyNarratives
      .map(
        (c) => `
        <article class="comp-card">
          <div class="comp-card-head">
            <strong>${escapeHtml(c.id)} – ${escapeHtml(c.name)}</strong>
            <span class="comp-band">${escapeHtml(c.bandLabel)} (${c.score} b.)</span>
          </div>
          <div class="bar" aria-hidden="true">
            <i style="width: ${Math.min(100, c.score)}%"></i>
          </div>
          <div class="small" style="margin-bottom: 0.4rem;">
            Surový zisk: ${c.earnedPoints} / ${c.maxPoints} b.${
          c.penalty > 0 ? ` • Srážka za opakované chyby: −${c.penalty} b.` : ''
        }
          </div>
          <p style="font-size: 0.9rem; margin-bottom: 0.4rem;">${escapeHtml(c.narrative)}</p>
          <p class="small" style="margin-bottom: 0; color: var(--eu-blue);">
            ${escapeHtml(c.recommendation)}
          </p>
        </article>
      `
      )
      .join('');

    const repeatedTagsHtml =
      res.repeatedTags.length > 0
        ? `
        <section class="report-block">
          <h3 style="margin-top: 0;">Opakované metodické chyby (srážky z kompetencí)</h3>
          <ul style="margin: 0; padding-left: 1.25rem;">
            ${res.repeatedTags
              .map(
                (rt) => `
                <li style="margin-bottom: 0.35rem;">
                  <strong>${escapeHtml(rt.tag)}</strong> (${escapeHtml(
                  rt.description
                )}) – výskyt ${rt.count}×, srážka −${rt.penaltyApplied} b. v kompetenci ${escapeHtml(
                  rt.targetCompetency
                )}.
                </li>
              `
              )
              .join('')}
          </ul>
        </section>
      `
        : '';

    const strategicHtml = report.strategicNarratives
      .map(
        (s) => `
        <div style="margin-bottom: 0.85rem; padding-bottom: 0.7rem; border-bottom: 1px solid var(--border);">
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
        <section class="report-block">
          <h3 style="margin-top: 0;">Vyhodnocení nápravných kroků</h3>
          ${report.remedialNarratives
            .map((r) => `<p style="font-size: 0.92rem; margin-bottom: 0.5rem;">${escapeHtml(r.evaluation)}</p>`)
            .join('')}
        </section>
      `
        : '';

    return `
      <section>
        <div class="report-header-box">
          <div class="eyebrow">Závěrečné akademické vyhodnocení simulace</div>
          <h2 style="margin-bottom: 0.35rem;">${escapeHtml(report.meta.title)}</h2>
          <p class="small" style="margin-bottom: 0;">
            Hodnocení čtyřletého mandátu předsedy vlády (${escapeHtml(report.meta.country)})
          </p>

          <div class="report-meta-grid">
            <div>
              <div class="small">Hodnocený představitel</div>
              <strong>${escapeHtml(displayPlayer)}</strong>
            </div>
            <div>
              <div class="small">Celkový bodový zisk</div>
              <strong>${res.totalEarned} / ${res.totalMaxPoints} b. (${res.totalPercentage} %)</strong>
            </div>
            <div>
              <div class="small">Výsledná klasifikace</div>
              <strong style="color: var(--eu-blue);">${escapeHtml(res.gradeLabel)}</strong>
            </div>
            <div>
              <div class="small">Datum vyhotovení</div>
              <strong>${escapeHtml(dateFormatted)}</strong>
            </div>
          </div>
        </div>

        ${
          report.downgradeNote
            ? `<div class="note" style="margin-bottom: 1rem;">${escapeHtml(
                report.downgradeNote
              )}</div>`
            : ''
        }

        <div class="report-block">
          <h3 style="margin-top: 0;">Souhrnné zhodnocení mandátu</h3>
          <p style="margin-bottom: 0;">${escapeHtml(report.introParagraph)}</p>
        </div>

        <h3>Profil osmi právních kompetencí (0–100 b.)</h3>
        <div class="competency-grid">
          ${competenciesHtml}
        </div>

        ${repeatedTagsHtml}

        <section class="report-block">
          <h3 style="margin-top: 0;">Přehled klíčových vládních rozhodnutí (S1–S6)</h3>
          ${strategicHtml}
        </section>

        ${remedialHtml}

        <section class="report-block">
          <h3 style="margin-top: 0;">Poznámka k metodě práce s prameny a nápovědami</h3>
          <p style="margin-bottom: 0; font-size: 0.92rem;">${escapeHtml(
            report.studyMethodNote
          )}</p>
        </section>

        <div class="action-bar noprint">
          <button type="button" class="btn btn-gold" data-action="print-assessment">
            Vytisknout / Uložit posudek jako PDF
          </button>
          <button type="button" class="btn btn-alt" data-action="export-assessment-md">
            Stáhnout posudek (.md)
          </button>
          <button
            type="button"
            class="btn btn-alt"
            data-action="select-chapter"
            data-chapter-id="K1"
          >
            Prohlédnout odehrané kapitoly
          </button>
          <button type="button" class="btn" data-action="new-game">
            Spustit novou kampaň
          </button>
        </div>
      </section>
    `;
  }

  /**
   * Stáhne protokol akademického posudku ve formátu Markdown (.md).
   * @param {string} playerName
   */
  downloadMarkdownReport(playerName) {
    const report = this.engine.getAssessmentReport();
    const res = report.results;
    const displayPlayer = playerName || 'Předseda vlády Marenské republiky';

    const lines = [
      `# Akademický posudek: ${report.meta.title}`,
      ``,
      `- **Hodnocený představitel:** ${displayPlayer}`,
      `- **Stát:** ${report.meta.country}`,
      `- **Celkový bodový zisk:** ${res.totalEarned} / ${res.totalMaxPoints} bodů (${res.totalPercentage} %)`,
      `- **Výsledná klasifikace:** ${res.gradeLabel}`,
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
          c.penalty > 0 ? ` | Srážka za opakované chyby: −${c.penalty} b.` : ''
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
          `- **${rt.tag}** (${rt.description}): výskyt ${rt.count}×, srážka −${rt.penaltyApplied} b. (${rt.targetCompetency})`
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
