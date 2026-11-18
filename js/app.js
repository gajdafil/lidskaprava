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

export class AppController {
  /**
   * @param {HTMLElement} rootEl
   * @param {GameEngine} engine
   */
  constructor(rootEl, engine) {
    this.rootEl = rootEl;
    this.engine = engine;
    this.audio = new AudioManager();
    this.documentViewer = new DocumentViewer(engine);
    this.archivePanel = new ArchivePanel(engine, this.documentViewer);
    this.defenseEditor = new DefenseEditor(engine);
    this.reporter = new AssessmentReporter(engine);

    this.institutionsModalOpen = false;
    this.advisorNoteRevealed = {};
    this.draftSelections = {};

    this._bindDelegatedEvents();
    this.engine.subscribe(() => this.render());
  }

  render() {
    const state = this.engine.state;
    document.documentElement.style.setProperty(
      '--archive-width',
      `${state.archiveWidthPct || 42}%`
    );

    let mainHtml = '';
    if (state.screen === 'briefing') {
      mainHtml = this._renderBriefingScreen();
    } else if (state.screen === 'tutorial') {
      mainHtml = this._renderTutorialScreen();
    } else if (state.screen === 'assessment') {
      mainHtml = this.reporter.render();
    } else {
      mainHtml = this._renderGameWorkspace();
    }

    const modalHtml = this.institutionsModalOpen
      ? this.documentViewer.renderInstitutionsModal()
      : '';

    this.rootEl.innerHTML = `
      ${this._renderTopbar()}
      ${mainHtml}
      ${modalHtml}
    `;

    if (state.screen === 'game' && state.archiveOpen) {
      this.archivePanel.bindScrollPersistence();
    }
  }

  /* ========================================================================
     1. Horní navigační lišta
     ======================================================================== */

  _renderTopbar() {
    const state = this.engine.state;
    const chapters = this.engine.data.chapters.chapters;
    const results = this.engine.getResults();

    const chapterPills = chapters
      .map((ch) => {
        const isCompleted = state.completedChapters.includes(ch.id);
        const isCurrentActive = ch.id === state.currentChapterId;
        const isViewing =
          state.screen === 'game' && ch.id === state.viewingChapterId;
        const isUnlocked = isCompleted || isCurrentActive;

        const classes = ['chapter-pill'];
        if (isViewing) classes.push('is-active');
        if (isCompleted) classes.push('is-completed');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-chapter"
            data-chapter-id="${escapeHtml(ch.id)}"
            ${isUnlocked ? '' : 'disabled'}
            title="${escapeHtml(ch.title)}"
          >
            ${escapeHtml(ch.shortTitle)}${isCompleted ? ' ✓' : ''}
          </button>
        `;
      })
      .join('');

    const isGameScreen = state.screen === 'game';
    const isCompletedCampaign = state.completedChapters.length === chapters.length;

    return `
      <header class="topbar no-print">
        <div class="topbar-brand">
          <div class="brand-emblem" aria-hidden="true">§</div>
          <div>
            <div class="brand-title">${escapeHtml(this.engine.data.chapters.meta.title)}</div>
            <span class="brand-subtitle">Vláda Marenské republiky • Ochrana základních práv v EU</span>
          </div>
        </div>

        <nav class="chapter-nav" aria-label="Kapitoly kampaně">
          ${chapterPills}
          ${
            isCompletedCampaign
              ? `<button type="button" class="chapter-pill ${
                  state.screen === 'assessment' ? 'is-active' : 'is-completed'
                }" data-action="open-assessment">Posudek</button>`
              : ''
          }
        </nav>

        <div class="topbar-actions">
          <span class="score-pill" title="Průběžný bodový zisk právní úspěšnosti">
            Skóre: ${results.totalEarned} / ${results.totalMaxPoints} b.
          </span>
          <button
            type="button"
            class="btn btn-topbar"
            data-action="toggle-audio"
            title="Zapnout nebo ztlumit zvukovou odezvu"
          >
            ${this.audio.isMuted() ? '🔇 Zvuk vyp.' : '🔊 Zvuk zap.'}
          </button>
          <button type="button" class="btn btn-topbar" data-action="open-tutorial">
            Tutoriál
          </button>
          <button type="button" class="btn btn-topbar" data-action="open-institutions">
            Instituce &amp; Mapy (${state.unlockedInstitutions.length})
          </button>
          ${
            isGameScreen
              ? `<button type="button" class="btn btn-topbar ${
                  state.archiveOpen ? 'is-active' : ''
                }" data-action="toggle-archive">
                  Archiv (${state.unlockedDocs.length})
                </button>`
              : ''
          }
          <button type="button" class="btn btn-topbar" data-action="new-game">
            Nová hra
          </button>
        </div>
      </header>
    `;
  }

  /* ========================================================================
     2. Úvodní briefing a Technický tutoriál
     ======================================================================== */

  _renderBriefingScreen() {
    const briefing = this.engine.data.chapters.briefing;
    const hasProgress =
      Object.keys(this.engine.state.steps).length > 0 ||
      this.engine.state.completedChapters.length > 0;

    return `
      <main class="standalone-container">
        <article class="editorial-card">
          <div class="editorial-kicker">Úřad vlády Marenské republiky • Orvelin</div>
          <h1>${escapeHtml(briefing.title)}</h1>
          <p class="editorial-subtitle">${escapeHtml(briefing.subtitle)}</p>
          <div class="editorial-body">
            ${briefing.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
          </div>
          <div class="action-bar">
            <button type="button" class="btn btn-primary" data-action="start-campaign">
              ${hasProgress ? 'Pokračovat v rozehrané kampani' : 'Ujmout se funkce (Kapitola 1)'}
            </button>
            <button type="button" class="btn btn-gold" data-action="open-tutorial">
              Přečíst technický tutoriál
            </button>
          </div>
        </article>
      </main>
    `;
  }

  _renderTutorialScreen() {
    const tut = this.engine.data.chapters.tutorial;

    return `
      <main class="standalone-container">
        <article class="editorial-card">
          <div class="editorial-kicker">Metodický průvodce simulací</div>
          <h1>${escapeHtml(tut.title)}</h1>
          <p class="editorial-subtitle">${escapeHtml(tut.intro)}</p>
          <div class="tutorial-grid">
            ${tut.sections
              .map(
                (sec) => `
                <section class="tutorial-item">
                  <h3>${escapeHtml(sec.heading)}</h3>
                  <p>${escapeHtml(sec.text)}</p>
                </section>
              `
              )
              .join('')}
          </div>
          <div class="action-bar">
            <button type="button" class="btn btn-primary" data-action="start-campaign">
              Přejít do pracovního rozhraní vlády
            </button>
          </div>
        </article>
      </main>
    `;
  }

  /* ========================================================================
     3. Hlavní herní pracovní plocha (Levý panel scénáře + Pravý archiv)
     ======================================================================== */

  _renderGameWorkspace() {
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

    const stepperHtml = effectiveSteps
      .map((sId, idx) => {
        const done = this.engine.isStepCompleted(sId);
        const isCurrent = idx === viewStepIdx;
        const canClick = isReadOnly || done || idx === state.currentStepIndex;

        const classes = ['step-chip'];
        if (isCurrent) classes.push('is-current');
        if (done) classes.push('is-done');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="jump-step"
            data-step-index="${idx}"
            ${canClick ? '' : 'disabled'}
          >
            ${idx + 1}. ${escapeHtml(sId)}${done ? ' ✓' : ''}
          </button>
        `;
      })
      .join('');

    return `
      <div class="workspace">
        <main class="stage-pane">
          ${
            isReadOnly
              ? `<div class="readonly-banner">
                  <span>
                    <strong>Režim pouze pro čtení:</strong> Prohlížíte již uzavřenou kapitolu. Původní odpovědi ani body již nelze měnit.
                  </span>
                  <button type="button" class="btn btn-sm btn-secondary" data-action="return-active-chapter">
                    Zpět na aktuální kapitolu
                  </button>
                </div>`
              : ''
          }

          <section class="chapter-header-card">
            <div class="chapter-meta-row">
              <span>${escapeHtml(chapter.period)}</span>
              <span>•</span>
              <span>Zaměření: ${escapeHtml(chapter.caseFocus)}</span>
            </div>
            <h2>${escapeHtml(chapter.title)}</h2>
            ${chapter.intro.map((p) => `<p>${escapeHtml(p)}</p>`).join('')}
            <div class="chapter-goal-box">
              <strong>Vzdělávací cíl kapitoly:</strong> ${escapeHtml(chapter.goal)}
            </div>
          </section>

          <div class="step-stepper" role="tablist" aria-label="Kroky kapitoly">
            ${stepperHtml}
          </div>

          ${this._renderStepCard(stepDef, isReadOnly)}
        </main>

        <div
          id="pane-resizer"
          class="pane-resizer ${state.archiveOpen ? '' : 'is-hidden'}"
          role="separator"
          aria-orientation="vertical"
          aria-label="Změnit šířku panelu archivu"
          title="Tažením změníte šířku bočního archivu"
        ></div>

        <aside class="archive-pane ${state.archiveOpen ? '' : 'is-hidden'}" aria-label="Vládní archiv">
          ${this.archivePanel.render(stepDef)}
        </aside>
      </div>
    `;
  }

  _renderStepCard(stepDef, isReadOnly) {
    if (!stepDef) return '';
    if (stepDef.type === 'E' || stepDef.type === 'R') {
      return this._renderChoiceTask(stepDef, isReadOnly);
    }
    if (stepDef.type === 'S') {
      return this._renderStrategicTask(stepDef, isReadOnly);
    }
    if (stepDef.type === 'N') {
      return this._renderRemedialTask(stepDef, isReadOnly);
    }
    if (stepDef.type === 'A') {
      return this.defenseEditor.renderArgumentsTask(
        stepDef,
        isReadOnly,
        this._renderAdvanceButton(isReadOnly)
      );
    }
    if (stepDef.type === 'P') {
      return this.defenseEditor.renderPleadingTask(
        stepDef,
        isReadOnly,
        this._renderAdvanceButton(isReadOnly)
      );
    }
    return '';
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
    const badgeLabel =
      stepDef.type === 'R'
        ? `Námitka Evropské komise • Pokusy: ${stepState.attempts.length}/${maxAttempts}`
        : `Vzdělávací právní úloha • Pokusy: ${stepState.attempts.length}/${maxAttempts}`;

    const optionsHtml = stepDef.options
      .map((opt) => {
        const wasTried = stepState.attempts.includes(opt.id);
        const revealCorrect = isCompleted && opt.correct;
        const revealWrong = wasTried && !opt.correct;

        const classes = ['option-card'];
        if (revealCorrect) classes.push('is-correct');
        if (revealWrong) classes.push('is-wrong');
        if (wasTried || isCompleted || isReadOnly) classes.push('is-disabled');

        let feedbackHtml = '';
        if (revealCorrect || revealWrong) {
          const tagDesc =
            opt.tag && this.engine.data.scoring.errorTags[opt.tag]
              ? `<div class="tag-pill">Chybový štítek ${escapeHtml(opt.tag)}: ${escapeHtml(
                  this.engine.data.scoring.errorTags[opt.tag]
                )}</div>`
              : '';
          feedbackHtml = `
            <div class="option-feedback ${opt.correct ? 'is-correct' : 'is-wrong'}">
              ${escapeHtml(opt.feedback)}
              ${tagDesc}
            </div>
          `;
        }

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="submit-choice"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${wasTried || isCompleted || isReadOnly ? 'disabled' : ''}
          >
            <div class="option-header">
              <span class="option-letter">${escapeHtml(opt.id)}</span>
              <span class="option-text">${escapeHtml(opt.text)}</span>
            </div>
            ${feedbackHtml}
          </button>
        `;
      })
      .join('');

    const hintsUsed = stepState.hintsUsed || 0;
    const totalHints = stepDef.hints ? stepDef.hints.length : 0;
    const revealedHints = (stepDef.hints || []).slice(0, hintsUsed);

    return `
      <section class="task-card">
        <span class="task-type-badge">${escapeHtml(badgeLabel)}</span>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">${escapeHtml(stepDef.situation)}</div>
        <div class="task-question">${escapeHtml(stepDef.question)}</div>

        <div class="options-list">${optionsHtml}</div>

        ${
          totalHints > 0
            ? `<div class="advisor-box">
                <div class="advisor-header">
                  <span class="advisor-title">Právní poradce dr. Adrian Keller (nápovědy bez bodové ztráty)</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-secondary"
                    data-action="request-hint"
                    data-step-id="${escapeHtml(stepDef.id)}"
                    ${hintsUsed >= totalHints || isCompleted || isReadOnly ? 'disabled' : ''}
                  >
                    ${
                      hintsUsed >= totalHints
                        ? `Všechny nápovědy zobrazeny (${hintsUsed}/${totalHints})`
                        : `Vyžádat nápovědu (${hintsUsed}/${totalHints})`
                    }
                  </button>
                </div>
                ${
                  revealedHints.length > 0
                    ? `<ol class="hints-list">
                        ${revealedHints.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}
                      </ol>`
                    : ''
                }
              </div>`
            : ''
        }

        ${
          isCompleted
            ? `<div class="resolution-panel">
                <div>
                  <strong>${
                    stepState.correct
                      ? `Úloha vyřešena (${stepState.pointsEarned} b.)`
                      : 'Vyčerpány všechny pokusy (0 b.) – výše je vyznačena správná odpověď.'
                  }</strong>
                </div>
                <p style="margin: 0.45rem 0 0; font-size: 0.9rem;">
                  <strong>Právní opora:</strong> ${escapeHtml(stepDef.lawRef || '')}
                </p>
                ${this._renderRelatedDocsBar(stepDef.relatedDocs)}
                ${this._renderAdvanceButton(isReadOnly)}
              </div>`
            : ''
        }
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
        const classes = ['option-card'];
        if (isSelected) classes.push('is-selected');
        if (isConfirmed || isReadOnly) classes.push('is-locked');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-draft-option"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${isConfirmed || isReadOnly ? 'disabled' : ''}
          >
            <div class="option-header">
              <span class="option-letter">${escapeHtml(opt.id)}</span>
              <span class="option-text">${escapeHtml(opt.text)}</span>
            </div>
            <div class="option-meta">
              <strong>Politický dopad:</strong> ${escapeHtml(opt.politicalImpact)}
            </div>
            ${
              isConfirmed && isSelected
                ? `<div class="option-feedback is-correct">
                    <strong>Právní vyhodnocení:</strong> ${escapeHtml(opt.legalEvaluation)}
                  </div>`
                : ''
            }
          </button>
        `;
      })
      .join('');

    const advisorVisible = Boolean(this.advisorNoteRevealed[stepDef.id]);

    return `
      <section class="task-card">
        <span class="task-type-badge is-strategic">Strategické rozhodnutí kabinetu</span>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">${escapeHtml(stepDef.situation)}</div>
        <div class="task-question">${escapeHtml(stepDef.question)}</div>

        <div class="options-list">${optionsHtml}</div>

        ${
          stepDef.advisorNote
            ? `<div class="advisor-box">
                <div class="advisor-header">
                  <span class="advisor-title">Konzultace s právním poradcem dr. Adrianem Kellerem</span>
                  <button
                    type="button"
                    class="btn btn-sm btn-secondary"
                    data-action="toggle-advisor-note"
                    data-step-id="${escapeHtml(stepDef.id)}"
                  >
                    ${advisorVisible ? 'Skrýt odborné vodítko' : 'Vyžádat odborné vodítko'}
                  </button>
                </div>
                ${
                  advisorVisible
                    ? `<p style="margin: 0.65rem 0 0; font-size: 0.9rem;">${escapeHtml(
                        stepDef.advisorNote
                      )}</p>`
                    : ''
                }
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
          isConfirmed
            ? `<div class="resolution-panel">
                <strong>Rozhodnutí vlády bylo přijato (zisk: ${stepState.pointsEarned} b.).</strong>
                <p style="margin: 0.45rem 0 0; font-size: 0.92rem;">
                  ${escapeHtml(
                    stepDef.options.find((o) => o.id === stepState.selectedOptionId)
                      ?.consequenceSummary || ''
                  )}
                </p>
                ${this._renderRelatedDocsBar(stepDef.relatedDocs)}
                ${this._renderAdvanceButton(isReadOnly)}
              </div>`
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
        const classes = ['option-card'];
        if (isSelected) classes.push('is-selected');
        if (isConfirmed || isReadOnly) classes.push('is-locked');

        return `
          <button
            type="button"
            class="${classes.join(' ')}"
            data-action="select-draft-option"
            data-step-id="${escapeHtml(stepDef.id)}"
            data-option-id="${escapeHtml(opt.id)}"
            ${isConfirmed || isReadOnly ? 'disabled' : ''}
          >
            <div class="option-header">
              <span class="option-letter">${escapeHtml(opt.id)}</span>
              <span class="option-text">${escapeHtml(opt.text)}</span>
            </div>
            ${
              isConfirmed && isSelected
                ? `<div class="option-feedback ${opt.points > 0 ? 'is-correct' : 'is-wrong'}">
                    ${escapeHtml(opt.feedback)}
                  </div>`
                : ''
            }
          </button>
        `;
      })
      .join('');

    return `
      <section class="task-card">
        <span class="task-type-badge is-remedial">Následný vývoj a možnost nápravy</span>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">${escapeHtml(stepDef.situation)}</div>
        <div class="task-question">${escapeHtml(stepDef.question)}</div>

        <div class="options-list">${optionsHtml}</div>

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-primary"
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
          isConfirmed
            ? `<div class="resolution-panel">
                <strong>Postup zaznamenán (nápravný zápočet: +${stepState.pointsEarned} b.).</strong>
                <p style="margin: 0.45rem 0 0; font-size: 0.9rem;">
                  <strong>Právní opora:</strong> ${escapeHtml(stepDef.lawRef || '')}
                </p>
                ${this._renderRelatedDocsBar(stepDef.relatedDocs)}
                ${this._renderAdvanceButton(isReadOnly)}
              </div>`
            : ''
        }
      </section>
    `;
  }

  _renderRelatedDocsBar(docIds = []) {
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
            class="doc-link-chip"
            data-action="open-doc"
            data-doc-id="${escapeHtml(id)}"
          >
            📄 ${escapeHtml(doc.title)}
          </button>
        `;
      })
      .join('');

    return `
      <div class="related-docs-bar">
        <span style="font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);">Otevřít v archivu:</span>
        ${chips}
      </div>
    `;
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
        <button type="button" class="btn btn-primary" data-action="advance-step">
          ${label}
        </button>
      </div>
    `;
  }

  /* ========================================================================
     4. Delegované zpracování uživatelských událostí
     ======================================================================== */

  _bindDelegatedEvents() {
    this.rootEl.addEventListener('click', (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'toggle-audio':
          this.audio.toggleMute();
          this.render();
          break;

        case 'start-campaign':
          this.audio.playClick();
          this.engine.setScreen('game');
          break;

        case 'open-tutorial':
          this.audio.playClick();
          this.engine.setScreen('tutorial');
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

        case 'return-active-chapter':
          this.audio.playClick();
          this.engine.selectChapter(this.engine.state.currentChapterId);
          break;

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
            this.engine.confirmStrategicDecision(stepId, chosen);
          }
          break;
        }

        case 'confirm-remedial': {
          const { stepId } = target.dataset;
          const chosen = this.draftSelections[stepId];
          if (stepId && chosen) {
            this.audio.playSeal();
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

        case 'select-pleading-option': {
          const { secId, optionId } = target.dataset;
          if (secId && optionId) {
            this.audio.playClick();
            this.defenseEditor.selectPleadingOption(secId, optionId);
            this.render();
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

        case 'confirm-pleading': {
          this.audio.playSeal();
          this.engine.confirmPleadingSubmission(this.defenseEditor.getPleadingPayload());
          break;
        }

        case 'advance-step':
          this.audio.playClick();
          this.engine.advanceStep();
          break;

        case 'toggle-archive':
          this.audio.playClick();
          this.engine.toggleArchive();
          break;

        case 'open-doc': {
          const { docId } = target.dataset;
          if (docId) {
            this.audio.playDocumentOpen();
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

        case 'toggle-doc-highlight': {
          const { docId } = target.dataset;
          if (docId) {
            this.audio.playClick();
            this.engine.toggleDocumentHighlight(docId);
          }
          break;
        }

        case 'toggle-doc-comparison': {
          const { docId } = target.dataset;
          if (docId) {
            this.audio.playClick();
            this.documentViewer.toggleComparison(docId);
            this.render();
          }
          break;
        }

        case 'open-institutions':
          this.audio.playClick();
          this.institutionsModalOpen = true;
          this.render();
          break;

        case 'close-institutions':
          this.audio.playClick();
          this.institutionsModalOpen = false;
          this.render();
          break;

        case 'close-institutions-backdrop':
          if (e.target === target) {
            this.institutionsModalOpen = false;
            this.render();
          }
          break;

        case 'print-assessment':
          this.audio.playClick();
          window.print();
          break;

        case 'export-assessment-md':
          this.audio.playClick();
          this.reporter.downloadMarkdownReport();
          break;

        case 'new-game': {
          const confirmed = window.confirm(
            'Opravdu chcete zahájit novou kampaň? Veškerý dosavadní postup uložený v prohlížeči bude vymazán.'
          );
          if (confirmed) {
            this.audio.playClick();
            this.draftSelections = {};
            this.advisorNoteRevealed = {};
            this.archivePanel.resetFilters();
            this.defenseEditor.resetDrafts();
            this.engine.startNewGame();
          }
          break;
        }

        default:
          break;
      }
    });

    this.rootEl.addEventListener('change', (e) => {
      const target = e.target;
      if (target.dataset && target.dataset.action === 'toggle-arg-checkbox') {
        this.audio.playClick();
        this.defenseEditor.toggleArgument(target.dataset.argId, target.checked);
        this.render();
        return;
      }

      if (target.id === 'archive-category-select') {
        this.archivePanel.setCategoryFilter(target.value);
        this.render();
      }
    });

    this.rootEl.addEventListener('input', (e) => {
      if (e.target && e.target.id === 'archive-search-input') {
        this.archivePanel.setSearchQuery(e.target.value);
        this.render();
        const restoredInput = document.getElementById('archive-search-input');
        if (restoredInput) {
          restoredInput.focus();
          const len = restoredInput.value.length;
          restoredInput.setSelectionRange(len, len);
        }
      }
    });

    this.rootEl.addEventListener('pointerdown', (e) => {
      if (e.target && e.target.id === 'pane-resizer') {
        e.preventDefault();
        const resizer = e.target;
        resizer.classList.add('is-dragging');
        let latestPct = this.engine.state.archiveWidthPct || 42;

        const onPointerMove = (moveEvent) => {
          const viewportWidth = window.innerWidth;
          if (viewportWidth <= 960) return;
          const rightWidth = viewportWidth - moveEvent.clientX;
          latestPct = Math.max(26, Math.min(62, Math.round((rightWidth / viewportWidth) * 100)));
          document.documentElement.style.setProperty('--archive-width', `${latestPct}%`);
        };

        const onPointerUp = () => {
          resizer.classList.remove('is-dragging');
          window.removeEventListener('pointermove', onPointerMove);
          window.removeEventListener('pointerup', onPointerUp);
          this.engine.setArchiveWidth(latestPct);
        };

        window.addEventListener('pointermove', onPointerMove);
        window.addEventListener('pointerup', onPointerUp);
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
  const rootEl = document.getElementById('app');
  if (!rootEl) return;

  try {
    const data = await loadAllData();
    const engine = new GameEngine(data);
    const app = new AppController(rootEl, engine);
    app.render();
  } catch (error) {
    console.error('Chyba při spuštění simulace:', error);
    rootEl.innerHTML = `
      <div class="loading-screen" role="alert">
        <div class="loading-crest">!</div>
        <h2>Chyba při inicializaci aplikace</h2>
        <p>${escapeHtml(error.message || String(error))}</p>
        <p style="font-size: 0.88rem; color: #60718d;">
          Ujistěte se, že aplikaci spouštíte přes lokální nebo webový HTTP server (nikoli přímo přes protokol <code>file://</code>, který blokuje načítání modulů a souborů JSON).
        </p>
      </div>
    `;
  }
}

if (typeof document !== 'undefined') {
  document.addEventListener('DOMContentLoaded', bootstrap);
}
