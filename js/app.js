/**
 * app.js
 * Vstupní bod a hlavní orchestrátor uživatelského rozhraní simulace
 * „L’état, c’est moi – anebo ne?“.
 */

import { GameEngine } from './game-engine.js';
import { AudioManager } from './audio.js';
import { DocumentViewer, escapeHtml } from './documents.js';
import { ArchivePanel } from './archive.js';
import { DefenseEditor } from './editor.js';
import { AssessmentReporter } from './reports.js';

const DATA_FILES = {
  chapters: 'data/chapters.json',
  questions: 'data/questions.json',
  final: 'data/final.json',
  documents: 'data/documents.json',
  institutions: 'data/institutions.json',
  scoring: 'data/scoring.json',
  assessment: 'data/assessment.json'
};

const FONT_SIZE_KEY = 'letat_cest_moi_font_size_v1';
const PLAYER_NAME_KEY = 'letat_cest_moi_player_name_v1';

export class AppController {
  /**
   * @param {GameEngine} engine
   */
  constructor(engine) {
this.engine = engine;
this.audio = new AudioManager();
this.documentViewer = new DocumentViewer(engine);

this.archivePanel = new ArchivePanel({
  engine: engine,
  data: engine.data,
  onStateChange: () => this.render()
});

this.defenseEditor = new DefenseEditor(engine);
this.reporter = new AssessmentReporter(engine);

    this.fontSizePx = this._loadFontSize();
    this.playerName = this._loadPlayerName();
    this.advisorNoteRevealed = {};
    this.draftSelections = {};

    this._applyFontSize();
    this._bindEvents();
    this.engine.subscribe(() => this.render());
  }

  _loadFontSize() {
    try {
      const val = Number(window.localStorage.getItem(FONT_SIZE_KEY));
      return val >= 14 && val <= 22 ? val : 17;
    } catch {
      return 17;
    }
  }

  _applyFontSize() {
    document.documentElement.style.setProperty('--fs', `${this.fontSizePx}px`);
    try {
      window.localStorage.setItem(FONT_SIZE_KEY, String(this.fontSizePx));
    } catch {
      // Ignorovat
    }
  }

  _changeFontSize(delta) {
    const next = Math.max(14, Math.min(22, this.fontSizePx + delta));
    if (next !== this.fontSizePx) {
      this.fontSizePx = next;
      this._applyFontSize();
    }
  }

  _loadPlayerName() {
    try {
      return window.localStorage.getItem(PLAYER_NAME_KEY) || '';
    } catch {
      return '';
    }
  }

  _savePlayerName(name) {
    this.playerName = String(name || '').trim();
    try {
      window.localStorage.setItem(PLAYER_NAME_KEY, this.playerName);
    } catch {
      // Ignorovat
    }
  }

  render() {
    const state = this.engine.state;
    const isGame = state.screen === 'game';
    const isAssessment = state.screen === 'assessment';

    if (isAssessment) {
      this.reporter.recordCompletedCampaign(this.playerName);
    }

    // Aktualizace šířky archivu (--archive-w)
    document.documentElement.style.setProperty(
      '--archive-w',
      `${state.archiveWidthPct || 44}%`
    );

    // 1. Hlavička a stavové odznaky
    this._syncHeader();

    // 2. Chronologická navigace kapitol (#chapter-nav)
    this._syncChapterNav();

    // 3. Režim rozvržení pracovního prostoru (.single-view vs .split-view)
    const workspaceEl = document.getElementById('workspace');
    if (workspaceEl) {
      const useSplit = isGame && Boolean(state.archiveOpen);
      workspaceEl.classList.toggle('split-view', useSplit);
      workspaceEl.classList.toggle('single-view', !useSplit);
    }

    // 4. Upozornění režimu pouze pro čtení (#readonly-banner)
    const readonlyEl = document.getElementById('readonly-banner');
    if (readonlyEl) {
      const showReadonly = isGame && this.engine.isReadOnlyView();
      readonlyEl.hidden = !showReadonly;
      readonlyEl.style.display = showReadonly ? 'flex' : 'none';
    }

    // 5. Hlavní obsahová plocha (#main)
    const mainEl = document.getElementById('main');
    let currentStepDef = null;

    if (mainEl) {
      if (state.screen === 'briefing') {
        mainEl.innerHTML = this._renderHomeScreen();
      } else if (state.screen === 'assessment') {
        mainEl.innerHTML = this.reporter.render(this.playerName);
      } else {
        const rendered = this._renderGameMain();
        mainEl.innerHTML = rendered.html;
        currentStepDef = rendered.stepDef;
      }
    }

    // 6. Boční panel archivu (#archive-pane)
    this.archivePanel.sync(currentStepDef);
  }

  _syncHeader() {
    const state = this.engine.state;
    const isStarted =
      state.screen === 'game' ||
      state.screen === 'assessment' ||
      Object.keys(state.steps).length > 0;

    const headerStatus = document.getElementById('header-status');
    const chapterBadge = document.getElementById('chapter-badge');
    const ptsBadge = document.getElementById('pts-badge');
    const btnMute = document.getElementById('btn-mute');
    const btnExit = document.getElementById('btn-exit');

    if (headerStatus) {
      headerStatus.hidden = !isStarted;
      headerStatus.style.display = isStarted ? 'flex' : 'none';
    }

    if (chapterBadge) {
      if (state.screen === 'assessment') {
        chapterBadge.textContent = 'Závěrečný posudek';
      } else {
        const ch = this.engine.getChapter(state.viewingChapterId);
        chapterBadge.textContent = ch ? ch.shortTitle : 'Kapitola 1';
      }
    }

    if (ptsBadge) {
      const results = this.engine.getResults();
      const formattedPts = results.totalEarned.toFixed(1).replace('.', ',');
      ptsBadge.textContent = `Body: ${formattedPts}`;
    }

    if (btnMute) {
      const muted = this.audio.isMuted();
      btnMute.textContent = muted ? 'Zvuk: Vyp' : 'Zvuk: Zap';
      btnMute.setAttribute('aria-pressed', muted ? 'true' : 'false');
    }

    if (btnExit) {
      btnExit.hidden = !isStarted;
      btnExit.style.display = isStarted ? '' : 'none';
    }
  }

  _syncChapterNav() {
    const navEl = document.getElementById('chapter-nav');
    if (!navEl) return;

    const state = this.engine.state;
    const showNav = state.screen === 'game' || state.screen === 'assessment';
    navEl.hidden = !showNav;
    navEl.style.display = showNav ? 'flex' : 'none';

    if (!showNav) return;

    const chapters = this.engine.data.chapters.chapters || [];
    const pillsHtml = chapters
      .map((ch) => {
        const isDone = state.completedChapters.includes(ch.id);
        const isCurrent = ch.id === state.currentChapterId && !isDone;
        const isViewing =
          state.screen === 'game' && ch.id === state.viewingChapterId;
        const canOpen = isDone || ch.id === state.currentChapterId;

        const classes = ['chap-pill'];
        if (isDone) classes.push('done');
        if (isCurrent) classes.push('current');
        if (isViewing) classes.push('viewing');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-chapter"
            data-chapter-id="${escapeHtml(ch.id)}"
            ${canOpen ? '' : 'disabled'}
            title="${escapeHtml(ch.title)}"
          >
            ${escapeHtml(ch.shortTitle)}${isDone ? ' ✓' : ''}
          </button>
        `;
      })
      .join('');

    const allCompleted = state.completedChapters.length === chapters.length;
    const reportPill = allCompleted
      ? `<button
          type="button"
          class="chap-pill done ${state.screen === 'assessment' ? 'viewing' : ''}"
          data-action="open-assessment"
        >Závěrečný posudek</button>`
      : '';

    navEl.innerHTML = `${pillsHtml}${reportPill}`;
  }

  /* ========================================================================
     1. Úvodní obrazovka (Briefing, volba jména, obnovení a historie)
     ======================================================================== */

  _renderHomeScreen() {
    const briefing = this.engine.data.chapters.briefing;
    const hasProgress =
      Object.keys(this.engine.state.steps).length > 0 ||
      this.engine.state.completedChapters.length > 0;
    const history = this.reporter.loadHistory();

    const currentChapter = this.engine.getChapter(this.engine.state.currentChapterId);
    const currentResults = this.engine.getResults();

    return `
      <section class="home-hero">
        <div class="eyebrow">Úřad vlády Marenské republiky • Orvelin</div>
        <h2>${escapeHtml(briefing.title)}</h2>
        <p class="small" style="font-size: 0.96rem; color: var(--ink-700);">
          ${escapeHtml(briefing.subtitle)}
        </p>
        ${briefing.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
      </section>

      <div class="home-form-row">
        <label for="player-name-input"><strong>Jméno předsedy vlády (do posudku):</strong></label>
        <input
          type="text"
          id="player-name-input"
          class="text-input"
          placeholder="Např. JUDr. Jan Novák"
          value="${escapeHtml(this.playerName)}"
        />
      </div>

      ${
        hasProgress
          ? `<div class="last-session-card">
              <strong>Nalezena rozehraná kampaň</strong>
              <p class="small" style="margin: 0.25rem 0 0.6rem;">
                Aktuální období: <strong>${escapeHtml(
                  currentChapter ? currentChapter.title : ''
                )}</strong> • Průběžný zisk: <strong>${
              currentResults.totalEarned
            } / ${currentResults.totalMaxPoints} b.</strong>
              </p>
              <div class="action-bar" style="margin-top: 0;">
                <button type="button" class="btn" data-action="start-campaign">
                  Pokračovat v rozehrané kampani
                </button>
                <button type="button" class="btn btn-danger btn-sm" data-action="new-game">
                  Smazat postup a začít znovu
                </button>
              </div>
            </div>`
          : `<div class="action-bar">
              <button type="button" class="btn" data-action="start-campaign">
                Ujmout se funkce předsedy vlády (Kapitola 1)
              </button>
              <button type="button" class="btn btn-alt" data-action="open-tutorial-modal">
                Metodický tutoriál
              </button>
            </div>`
      }

      ${
        history.length > 0
          ? `<section style="margin-top: 1.5rem;">
              <h3>Historie dokončených mandátů</h3>
              <table class="history-table">
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Předseda vlády</th>
                    <th>Bodový zisk</th>
                    <th>Klasifikace</th>
                  </tr>
                </thead>
                <tbody>
                  ${history
                    .map(
                      (h) => `
                      <tr>
                        <td>${escapeHtml(
                          new Date(h.completedAt).toLocaleDateString('cs-CZ')
                        )}</td>
                        <td>${escapeHtml(h.playerName)}</td>
                        <td>${h.totalEarned} / ${h.totalMaxPoints} b. (${
                        h.totalPercentage
                      } %)</td>
                        <td><strong>${escapeHtml(h.gradeLabel)}</strong></td>
                      </tr>
                    `
                    )
                    .join('')}
                </tbody>
              </table>
            </section>`
          : ''
      }
    `;
  }

  /* ========================================================================
     2. Herní kapitola a aktivní krok scénáře (#main)
     ======================================================================== */

  _renderGameMain() {
    const state = this.engine.state;
    const chapter = this.engine.getChapter(state.viewingChapterId);
    const effectiveSteps = this.engine.getEffectiveStepIds(chapter.id);
    const isReadOnly = this.engine.isReadOnlyView();

    let viewStepIdx = isReadOnly
      ? this.draftSelections[`readonlyStep_${chapter.id}`] ?? 0
      : state.currentStepIndex;
    if (viewStepIdx >= effectiveSteps.length) viewStepIdx = effectiveSteps.length - 1;
    if (viewStepIdx < 0) viewStepIdx = 0;

    const activeStepId = effectiveSteps[viewStepIdx];
    const stepDef = this.engine.getStepDefinition(activeStepId);

    const stepNavHtml = effectiveSteps
      .map((sId, idx) => {
        const done = this.engine.isStepCompleted(sId);
        const isCurrent = idx === viewStepIdx;
        const canClick = isReadOnly || done || idx === state.currentStepIndex;
        const btnClass = isCurrent ? 'btn btn-sm' : 'btn btn-alt btn-sm';

        return `
          <button
            type="button"
            class="${btnClass}"
            data-action="jump-step"
            data-step-index="${idx}"
            ${canClick ? '' : 'disabled'}
          >
            ${idx + 1}. ${escapeHtml(sId)}${done ? ' ✓' : ''}
          </button>
        `;
      })
      .join('');

    let taskHtml = '';
    if (stepDef) {
      if (stepDef.type === 'E' || stepDef.type === 'R') {
        taskHtml = this._renderChoiceTask(stepDef, isReadOnly);
      } else if (stepDef.type === 'S') {
        taskHtml = this._renderStrategicTask(stepDef, isReadOnly);
      } else if (stepDef.type === 'N') {
        taskHtml = this._renderRemedialTask(stepDef, isReadOnly);
      } else if (stepDef.type === 'A') {
        taskHtml = this.defenseEditor.renderArgumentsTask(
          stepDef,
          isReadOnly,
          this._renderAdvanceButton(isReadOnly)
        );
      } else if (stepDef.type === 'P') {
        taskHtml = this.defenseEditor.renderPleadingTask(
          stepDef,
          isReadOnly,
          this._renderAdvanceButton(isReadOnly)
        );
      }
    }

    const html = `
      <section style="margin-bottom: 1.1rem; padding-bottom: 0.9rem; border-bottom: 1px solid var(--border);">
        <div class="eyebrow">${escapeHtml(chapter.period)} • ${escapeHtml(
      chapter.caseFocus
    )}</div>
        <h2>${escapeHtml(chapter.title)}</h2>
        ${chapter.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
        <p class="small" style="margin-bottom: 0;">
          <strong>Vzdělávací cíl kapitoly:</strong> ${escapeHtml(chapter.goal)}
        </p>
      </section>

      <div class="action-bar" style="margin-top: 0; margin-bottom: 1.1rem;" role="tablist" aria-label="Kroky kapitoly">
        ${stepNavHtml}
      </div>

      ${taskHtml}
    `;

    return { html, stepDef };
  }

  _renderChoiceTask(stepDef, isReadOnly) {
    const stepState = this.engine.state.steps[stepDef.id] || {
      attempts: [],
      completed: false,
      correct: false,
      pointsEarned: 0,
      hintsUsed: 0
    };

    const maxAttempts = stepDef.maxAttempts || 3;
    const isCompleted = Boolean(stepState.completed);
    const eyebrowText =
      stepDef.type === 'R'
        ? `Námitka Evropské komise • Pokusy: ${stepState.attempts.length}/${maxAttempts}`
        : `Vzdělávací právní úloha • Pokusy: ${stepState.attempts.length}/${maxAttempts}`;

    const optionsHtml = stepDef.options
      .map((opt) => {
        const wasTried = stepState.attempts.includes(opt.id);
        const revealCorrect = isCompleted && opt.correct;
        const revealWrong = wasTried && !opt.correct;

        const classes = ['opt'];
        if (revealCorrect) classes.push('good');
        if (revealWrong) classes.push('bad');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="submit-choice"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${wasTried || isCompleted || isReadOnly ? 'disabled' : ''}
          >
            <span class="opt-key">${escapeHtml(opt.id)}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>
        `;
      })
      .join('');

    // Zpětná vazba k vyzkoušeným možnostem
    const feedbackNotes = [];
    for (const triedId of stepState.attempts) {
      const opt = stepDef.options.find((o) => o.id === triedId);
      if (!opt) continue;
      const tagInfo =
        opt.tag && this.engine.data.scoring.errorTags[opt.tag]
          ? `<div class="small" style="margin-top: 0.3rem;"><strong>Chybový štítek ${escapeHtml(
              opt.tag
            )}:</strong> ${escapeHtml(this.engine.data.scoring.errorTags[opt.tag])}</div>`
          : '';
      feedbackNotes.push(`
        <div class="note ${opt.correct ? 'note-good' : 'note-bad'}">
          <strong>Varianta ${escapeHtml(opt.id)}:</strong> ${escapeHtml(opt.feedback)}
          ${tagInfo}
        </div>
      `);
    }

    if (isCompleted && !stepState.correct) {
      const correctOpt = stepDef.options.find((o) => o.correct);
      if (correctOpt) {
        feedbackNotes.push(`
          <div class="note note-good">
            <strong>Správné řešení (${escapeHtml(correctOpt.id)}):</strong> ${escapeHtml(
          correctOpt.feedback
        )}
          </div>
        `);
      }
    }

    const hintsUsed = stepState.hintsUsed || 0;
    const totalHints = stepDef.hints ? stepDef.hints.length : 0;
    const revealedHints = (stepDef.hints || []).slice(0, hintsUsed);

    return `
      <section>
        <div class="eyebrow">${escapeHtml(eyebrowText)}</div>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">
          <p style="margin-bottom: 0;">${escapeHtml(stepDef.situation)}</p>
        </div>

        ${this._renderDocChips(stepDef.relatedDocs)}

        <p><strong>${escapeHtml(stepDef.question)}</strong></p>

        <div class="options-list">${optionsHtml}</div>

        ${
          totalHints > 0
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-alt btn-sm"
                  data-action="request-hint"
                  data-step-id="${escapeHtml(stepDef.id)}"
                  ${hintsUsed >= totalHints || isCompleted || isReadOnly ? 'disabled' : ''}
                >
                  ${
                    hintsUsed >= totalHints
                      ? `Všechny nápovědy poradce zobrazeny (${hintsUsed}/${totalHints})`
                      : `Nápověda právního poradce dr. Kellera (${hintsUsed}/${totalHints})`
                  }
                </button>
              </div>`
            : ''
        }

        ${
          revealedHints.length > 0 || feedbackNotes.length > 0 || isCompleted
            ? `<div class="feedback-stack">
                ${revealedHints
                  .map(
                    (h, idx) =>
                      `<div class="note note-hint"><strong>Nápověda ${idx + 1}:</strong> ${escapeHtml(
                        h
                      )}</div>`
                  )
                  .join('')}
                ${feedbackNotes.join('')}
                ${
                  isCompleted
                    ? `<div class="note">
                        <strong>${
                          stepState.correct
                            ? `Úloha vyřešena (${stepState.pointsEarned} b.).`
                            : 'Pokusy vyčerpány (0 b.).'
                        }</strong>
                        <div class="small" style="margin-top: 0.25rem;">
                          <strong>Právní opora:</strong> ${escapeHtml(stepDef.lawRef || '')}
                        </div>
                      </div>`
                    : ''
                }
              </div>`
            : ''
        }

        ${isCompleted ? this._renderAdvanceButton(isReadOnly) : ''}
      </section>
    `;
  }

  _renderStrategicTask(stepDef, isReadOnly) {
    const stepState = this.engine.state.steps[stepDef.id];
    const isConfirmed = Boolean(stepState && stepState.confirmed);
    const selectedId = isConfirmed
      ? stepState.selectedOptionId
      : this.draftSelections[stepDef.id] || null;

    const optionsHtml = stepDef.options
      .map((opt) => {
        const isSelected = selectedId === opt.id;
        const classes = ['opt'];
        if (isSelected) classes.push('sel');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-draft-option"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${isConfirmed || isReadOnly ? 'disabled' : ''}
          >
            <span class="opt-key">${escapeHtml(opt.id)}</span>
            <span>
              <strong>${escapeHtml(opt.text)}</strong><br />
              <span class="small"><strong>Politický dopad:</strong> ${escapeHtml(
                opt.politicalImpact
              )}</span>
            </span>
          </button>
        `;
      })
      .join('');

    const advisorVisible = Boolean(this.advisorNoteRevealed[stepDef.id]);
    const confirmedOption = isConfirmed
      ? stepDef.options.find((o) => o.id === stepState.selectedOptionId)
      : null;

    return `
      <section>
        <div class="eyebrow">Strategické rozhodnutí kabinetu</div>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">
          <p style="margin-bottom: 0;">${escapeHtml(stepDef.situation)}</p>
        </div>

        ${this._renderDocChips(stepDef.relatedDocs)}

        <p><strong>${escapeHtml(stepDef.question)}</strong></p>

        <div class="options-list">${optionsHtml}</div>

        ${
          stepDef.advisorNote
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-alt btn-sm"
                  data-action="toggle-advisor-note"
                  data-step-id="${escapeHtml(stepDef.id)}"
                >
                  ${
                    advisorVisible
                      ? 'Skrýt stanovisko právního poradce'
                      : 'Konzultovat s právním poradcem dr. Kellerem'
                  }
                </button>
              </div>`
            : ''
        }

        ${
          advisorVisible
            ? `<div class="feedback-stack">
                <div class="note note-hint">
                  <strong>Právní poradce dr. Adrian Keller:</strong> ${escapeHtml(
                    stepDef.advisorNote
                  )}
                </div>
              </div>`
            : ''
        }

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-gold"
                  data-action="confirm-strategic"
                  data-step-id="${escapeHtml(stepDef.id)}"
                  ${selectedId ? '' : 'disabled'}
                >
                  Potvrdit a uzamknout rozhodnutí vlády
                </button>
              </div>`
            : ''
        }

        ${
          isConfirmed && confirmedOption
            ? `<div class="feedback-stack">
                <div class="note note-good">
                  <strong>Rozhodnutí kabinetu přijato (zisk: ${stepState.pointsEarned} b.):</strong>
                  <p style="margin: 0.35rem 0;">${escapeHtml(
                    confirmedOption.legalEvaluation
                  )}</p>
                  <p class="small" style="margin-bottom: 0;">${escapeHtml(
                    confirmedOption.consequenceSummary
                  )}</p>
                </div>
              </div>
              ${this._renderAdvanceButton(isReadOnly)}`
            : ''
        }
      </section>
    `;
  }

  _renderRemedialTask(stepDef, isReadOnly) {
    const stepState = this.engine.state.steps[stepDef.id];
    const isConfirmed = Boolean(stepState && stepState.confirmed);
    const selectedId = isConfirmed
      ? stepState.selectedOptionId
      : this.draftSelections[stepDef.id] || null;

    const optionsHtml = stepDef.options
      .map((opt) => {
        const isSelected = selectedId === opt.id;
        const classes = ['opt'];
        if (isSelected) classes.push('sel');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-draft-option"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${isConfirmed || isReadOnly ? 'disabled' : ''}
          >
            <span class="opt-key">${escapeHtml(opt.id)}</span>
            <span>${escapeHtml(opt.text)}</span>
          </button>
        `;
      })
      .join('');

    const confirmedOption = isConfirmed
      ? stepDef.options.find((o) => o.id === stepState.selectedOptionId)
      : null;

    return `
      <section>
        <div class="eyebrow">Následný vývoj a možnost nápravy</div>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">
          <p style="margin-bottom: 0;">${escapeHtml(stepDef.situation)}</p>
        </div>

        ${this._renderDocChips(stepDef.relatedDocs)}

        <p><strong>${escapeHtml(stepDef.question)}</strong></p>

        <div class="options-list">${optionsHtml}</div>

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn"
                  data-action="confirm-remedial"
                  data-step-id="${escapeHtml(stepDef.id)}"
                  ${selectedId ? '' : 'disabled'}
                >
                  Potvrdit postup vlády
                </button>
              </div>`
            : ''
        }

        ${
          isConfirmed && confirmedOption
            ? `<div class="feedback-stack">
                <div class="note ${confirmedOption.points > 0 ? 'note-good' : 'note-bad'}">
                  <strong>Postup zaznamenán (nápravný zápočet: +${stepState.pointsEarned} b.):</strong>
                  <p style="margin: 0.35rem 0;">${escapeHtml(confirmedOption.feedback)}</p>
                  <div class="small"><strong>Právní opora:</strong> ${escapeHtml(
                    stepDef.lawRef || ''
                  )}</div>
                </div>
              </div>
              ${this._renderAdvanceButton(isReadOnly)}`
            : ''
        }
      </section>
    `;
  }

  _renderDocChips(docIds = []) {
    const unlocked = (docIds || []).filter((id) =>
      this.engine.state.unlockedDocs.includes(id)
    );
    if (unlocked.length === 0) return '';

    const chips = unlocked
      .map((id) => {
        const doc = this.engine.data.documents.documents[id];
        if (!doc) return '';
        return `
          <button
            type="button"
            class="doc-chip"
            data-action="open-doc"
            data-doc-id="${escapeHtml(id)}"
          >
            Otevřít v archivu: ${escapeHtml(doc.title)}
          </button>
        `;
      })
      .join('');

    return `<div class="doc-ref-strip">${chips}</div>`;
  }

  _renderAdvanceButton(isReadOnly) {
    if (isReadOnly) return '';
    const state = this.engine.state;
    const effectiveSteps = this.engine.getEffectiveStepIds(state.currentChapterId);
    const isLastStepOfChapter = state.currentStepIndex + 1 >= effectiveSteps.length;
    const chapters = this.engine.data.chapters.chapters;
    const isLastChapter =
      state.currentChapterId === chapters[chapters.length - 1].id;

    let label = 'Pokračovat na další krok →';
    if (isLastStepOfChapter && !isLastChapter) {
      label = 'Uzavřít kapitolu a přejít do dalšího období →';
    } else if (isLastStepOfChapter && isLastChapter) {
      label = 'Ukončit funkční období a zobrazit závěrečný posudek →';
    }

    return `
      <div class="action-bar">
        <button type="button" class="btn" data-action="advance-step">
          ${label}
        </button>
      </div>
    `;
  }

  /* ========================================================================
     3. Modální dialog (#modal-backdrop) z index.html
     ======================================================================== */

  openModal({ title, bodyHtml, actionsHtml }) {
    const backdrop = document.getElementById('modal-backdrop');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const actionsEl = document.getElementById('modal-actions');

    if (!backdrop || !titleEl || !bodyEl || !actionsEl) return;

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    actionsEl.innerHTML = actionsHtml;
    backdrop.hidden = false;
    backdrop.style.display = 'flex';
  }

  closeModal() {
    const backdrop = document.getElementById('modal-backdrop');
    if (!backdrop) return;
    backdrop.hidden = true;
    backdrop.style.display = 'none';
  }

  openTutorialModal() {
    const tut = this.engine.data.chapters.tutorial;
    const bodyHtml = `
      <p>${escapeHtml(tut.intro)}</p>
      ${tut.sections
        .map(
          (sec) => `
          <div style="margin-bottom: 0.85rem;">
            <h4 style="margin: 0 0 0.25rem;">${escapeHtml(sec.heading)}</h4>
            <p style="margin: 0; font-size: 0.92rem;">${escapeHtml(sec.text)}</p>
          </div>
        `
        )
        .join('')}
    `;

    this.openModal({
      title: tut.title,
      bodyHtml,
      actionsHtml: `<button type="button" class="btn" data-action="close-modal">Rozumím</button>`
    });
  }

  openExitConfirmModal() {
    this.openModal({
      title: 'Ukončit rozehranou kampaň?',
      bodyHtml: `
        <p>Opravdu chcete ukončit současnou kampaň a vrátit se na úvodní obrazovku?</p>
        <p class="small">Veškerý dosavadní postup uložený v paměti prohlížeče bude nenávratně vymazán.</p>
      `,
      actionsHtml: `
        <button type="button" class="btn btn-alt" data-action="close-modal">Zrušit</button>
        <button type="button" class="btn btn-danger" data-action="confirm-reset-game">Ano, ukončit a smazat postup</button>
      `
    });
  }

  /* ========================================================================
     4. Propojení všech ovládacích prvků v index.html a delegovaných událostí
     ======================================================================== */

  _bindEvents() {
    // Tlačítka v pevné hlavičce (#btn-archive, #btn-tutorial, #btn-fz-dec, #btn-fz-inc, #btn-mute, #btn-exit)
    document.getElementById('btn-archive')?.addEventListener('click', () => {
      this.audio.playClick();
      this.engine.toggleArchive();
    });

    document.getElementById('btn-close-archive')?.addEventListener('click', () => {
      this.audio.playClick();
      this.engine.toggleArchive(false);
    });

    document.getElementById('btn-tutorial')?.addEventListener('click', () => {
      this.audio.playClick();
      this.openTutorialModal();
    });

    document.getElementById('btn-fz-dec')?.addEventListener('click', () => {
      this.audio.playClick();
      this._changeFontSize(-1);
    });

    document.getElementById('btn-fz-inc')?.addEventListener('click', () => {
      this.audio.playClick();
      this._changeFontSize(1);
    });

    document.getElementById('btn-mute')?.addEventListener('click', () => {
      this.audio.toggleMute();
      this.render();
    });

    document.getElementById('btn-exit')?.addEventListener('click', () => {
      this.audio.playClick();
      this.openExitConfirmModal();
    });

    document.getElementById('btn-return-active')?.addEventListener('click', () => {
      this.audio.playClick();
      this.engine.selectChapter(this.engine.state.currentChapterId);
    });

    // Přepínání tří režimů archivu (.mode-tab[data-mode])
    document.querySelectorAll('#archive-pane .mode-tab').forEach((tabBtn) => {
      tabBtn.addEventListener('click', () => {
        this.audio.playClick();
        this.archivePanel.setMode(tabBtn.dataset.mode);
        this.render();
      });
    });

    // Nástrojová lišta čtečky (#btn-toggle-highlight, #btn-toggle-compare)
    document.getElementById('btn-toggle-highlight')?.addEventListener('click', () => {
      const activeId = this.engine.state.activeDocTab;
      if (!activeId) return;
      this.audio.playClick();
      this.engine.toggleDocumentHighlight(activeId);
    });

    document.getElementById('btn-toggle-compare')?.addEventListener('click', () => {
      const activeId = this.engine.state.activeDocTab;
      if (!activeId) return;
      this.audio.playClick();
      this.documentViewer.toggleComparison(activeId);
      this.render();
    });

    // Filtr kategorií v katalogu archivu (#archive-cat-select)
    document.getElementById('archive-cat-select')?.addEventListener('change', (e) => {
      this.archivePanel.setCategoryFilter(e.target.value);
      this.render();
    });

    // Zavření modálního dialogu kliknutím mimo okno nebo klávesou Escape
    document.getElementById('modal-backdrop')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-backdrop') {
        this.closeModal();
      }
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        this.closeModal();
      }
    });

    // Tažení i klávesové ovládání svislého oddělovače (#split-resizer)
    const resizer = document.getElementById('split-resizer');
    if (resizer) {
      resizer.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        resizer.classList.add('dragging');
        let latestPct = this.engine.state.archiveWidthPct || 44;

        const onPointerMove = (moveEvent) => {
          const viewportWidth = window.innerWidth;
          if (viewportWidth <= 820) return;
          const rightWidth = viewportWidth - moveEvent.clientX;
          latestPct = Math.max(26, Math.min(68, Math.round((rightWidth / viewportWidth) * 100)));
          document.documentElement.style.setProperty('--archive-w', `${latestPct}%`);
        };

        const onPointerUp = () => {
          resizer.classList.remove('dragging');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          this.engine.setArchiveWidth(latestPct);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
      });

      resizer.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const delta = e.key === 'ArrowLeft' ? 3 : -3;
          const next = Math.max(26, Math.min(68, (this.engine.state.archiveWidthPct || 44) + delta));
          this.engine.setArchiveWidth(next);
          document.documentElement.style.setProperty('--archive-w', `${next}%`);
        }
      });
    }

    // Delegované kliknutí na dynamicky vykreslené prvky ([data-action])
    document.body.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'close-modal':
          this.audio.playClick();
          this.closeModal();
          break;

        case 'confirm-reset-game':
          this.audio.playClick();
          this.closeModal();
          this.draftSelections = {};
          this.advisorNoteRevealed = {};
          this.archivePanel.reset();
          this.defenseEditor.resetDrafts();
          this.engine.startNewGame();
          break;

        case 'new-game':
          this.audio.playClick();
          this.openExitConfirmModal();
          break;

        case 'open-tutorial-modal':
          this.audio.playClick();
          this.openTutorialModal();
          break;

        case 'start-campaign':
          this.audio.playClick();
          this.engine.setScreen('game');
          break;

        case 'open-assessment':
          this.audio.playClick();
          this.engine.setScreen('assessment');
          break;

        case 'select-chapter': {
          const chapterId = target.dataset.chapterId;
          if (chapterId) {
            this.audio.playClick();
            this.engine.selectChapter(chapterId);
          }
          break;
        }

        case 'jump-step': {
          const idx = Number(target.dataset.stepIndex);
          if (Number.isNaN(idx)) break;
          this.audio.playClick();
          if (this.engine.isReadOnlyView()) {
            this.draftSelections[`readonlyStep_${this.engine.state.viewingChapterId}`] = idx;
            this.render();
          } else {
            this.engine.state.currentStepIndex = idx;
            this.render();
          }
          break;
        }

        case 'submit-choice': {
          const { stepId, optionId } = target.dataset;
          if (stepId && optionId) {
            this.engine.submitChoiceAnswer(stepId, optionId);
            const updated = this.engine.state.steps[stepId];
            if (updated?.correct) {
              this.audio.playSuccess();
            } else {
              this.audio.playError();
            }
          }
          break;
        }

        case 'request-hint': {
          const { stepId } = target.dataset;
          if (stepId) {
            this.audio.playClick();
            this.engine.requestHint(stepId);
          }
          break;
        }

        case 'select-draft-option': {
          const { stepId, optionId } = target.dataset;
          if (stepId && optionId) {
            this.audio.playClick();
            this.draftSelections[stepId] = optionId;
            this.render();
          }
          break;
        }

        case 'toggle-advisor-note': {
          const { stepId } = target.dataset;
          if (stepId) {
            this.audio.playClick();
            this.advisorNoteRevealed[stepId] = !this.advisorNoteRevealed[stepId];
            this.render();
          }
          break;
        }

        case 'confirm-strategic': {
          const { stepId } = target.dataset;
          const chosen = this.draftSelections[stepId];
          if (stepId && chosen) {
            this.audio.playSeal();
            this.archivePanel.setMode('workspace');
            this.engine.confirmStrategicDecision(stepId, chosen);
          }
          break;
        }

        case 'confirm-remedial': {
          const { stepId } = target.dataset;
          const chosen = this.draftSelections[stepId];
          if (stepId && chosen) {
            this.audio.playSeal();
            this.archivePanel.setMode('workspace');
            this.engine.confirmRemedialDecision(stepId, chosen);
          }
          break;
        }

        case 'confirm-arguments': {
          const selected = this.defenseEditor.getSelectedArgumentIds();
          if (selected.length > 0) {
            this.audio.playSeal();
            this.engine.confirmArgumentsSelection(selected);
          }
          break;
        }

        case 'move-sec5-arg': {
          const index = Number(target.dataset.index);
          const dir = Number(target.dataset.dir);
          this.audio.playClick();
          this.defenseEditor.moveSection5Argument(index, dir);
          this.render();
          break;
        }

        case 'confirm-pleading':
          this.audio.playSeal();
          this.engine.confirmPleadingSubmission(this.defenseEditor.getPleadingPayload());
          break;

        case 'advance-step':
          this.audio.playClick();
          this.engine.advanceStep();
          break;

        case 'open-doc': {
          const { docId } = target.dataset;
          if (docId) {
            this.audio.playDocumentOpen();
            this.archivePanel.setMode('workspace');
            this.engine.openDocument(docId);
          }
          break;
        }

        case 'close-doc-tab': {
          e.stopPropagation();
          const { docId } = target.dataset;
          if (docId) {
            this.audio.playClick();
            this.engine.closeDocumentTab(docId);
          }
          break;
        }

        case 'print-assessment':
          this.audio.playClick();
          window.print();
          break;

        case 'export-assessment-md':
          this.audio.playClick();
          this.reporter.downloadMarkdownReport(this.playerName);
          break;

        default:
          break;
      }
    });

    // Změna zaškrtávacích polí a přepínačů v Kapitole 6 (ARG a POD)
    document.body.addEventListener('change', (e) => {
      const target = e.target;
      if (!target.dataset) return;

      if (target.dataset.action === 'toggle-arg-checkbox') {
        this.audio.playClick();
        this.defenseEditor.toggleArgument(target.dataset.argId, target.checked);
        this.render();
      } else if (target.dataset.action === 'select-pleading-option') {
        this.audio.playClick();
        this.defenseEditor.selectPleadingOption(
          target.dataset.secId,
          target.dataset.optionId
        );
        this.render();
      }
    });

    // Ukládání jména hráče na úvodní obrazovce (#player-name-input)
    document.body.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'player-name-input') {
        this._savePlayerName(e.target.value);
      }
    });
  }
}

async function loadAllData() {
  const entries = Object.entries(DATA_FILES);
  const responses = await Promise.all(
    entries.map(async ([key, url]) => {
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(`Nepodařilo se načíst datový soubor ${url} (HTTP ${res.status}).`);
      }
      const json = await res.json();
      return [key, json];
    })
  );

  return Object.fromEntries(responses);
}

async function bootstrap() {
  const mainEl = document.getElementById('main');
  if (!mainEl) return;

  try {
    const data = await loadAllData();
    const engine = new GameEngine(data);
    const app = new AppController(engine);
    app.render();
  } catch (error) {
    console.error('Chyba při spuštění simulace:', error);
    mainEl.innerHTML = `
      <div class="note note-bad" role="alert">
        <h2>Chyba při inicializaci aplikace</h2>
        <p>${escapeHtml(error.message || String(error))}</p>
        <p class="small" style="margin-bottom: 0;">
          Ujistěte se, že aplikaci spouštíte přes lokální nebo webový HTTP server (nikoli přímo přes protokol <code>file://</code>, který blokuje načítání modulů a souborů JSON).
        </p>
      </div>
    `;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', bootstrap);
}
