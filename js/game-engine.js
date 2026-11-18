/**
 * game-engine.js
 * Hlavní stavový automat vzdělávací simulace „L’état, c’est moi – anebo ne?“.
 */

import {
  createInitialState,
  loadState,
  saveState,
  clearState
} from './storage.js';
import {
  evaluateChoiceStep,
  evaluateStrategicStep,
  evaluateRemedialStep,
  evaluateArgumentsStep,
  evaluatePleadingStep,
  getAvailableArguments,
  computeFinalResults
} from './scoring.js';
import { buildAcademicAssessment } from './assessment.js';

export class GameEngine {
  /**
   * @param {Object} data - Načtené JSON soubory: { chapters, questions, final, documents, institutions, scoring, assessment }
   */
  constructor(data) {
    this.data = data;
    this.listeners = new Set();

    const saved = loadState();
    this.state = saved || createInitialState(data.chapters);
    this._syncUnlocksForChapter(this.state.currentChapterId);
  }

  /**
   * Přihlásí odběratele změn stavu pro reaktivní překreslení UI.
   * @param {Function} listener
   * @returns {Function} Funkce pro odhlášení
   */
  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  _notify() {
    saveState(this.state);
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  /**
   * Vrátí true, pokud existuje uložený postup.
   * @returns {boolean}
   */
  hasSavedProgress() {
    return loadState() !== null;
  }

  /**
   * Spustí zcela novou kampaň a vymaže předchozí postup.
   */
  startNewGame() {
    clearState();
    this.state = createInitialState(this.data.chapters);
    this._syncUnlocksForChapter(this.state.currentChapterId);
    this._notify();
  }

  /**
   * Přepne aktivní obrazovku ('briefing' | 'tutorial' | 'game' | 'assessment').
   * @param {string} screen
   */
  setScreen(screen) {
    if (screen === 'tutorial') {
      this.state.tutorialSeen = true;
    }
    this.state.screen = screen;
    this._notify();
  }

  /**
   * Vyhodnotí podmínku typu { S3: ['A', 'C'] } vůči potvrzeným krokům ve stavu hry.
   * @param {Object} conditionObj
   * @returns {boolean}
   */
  evaluateCondition(conditionObj) {
    if (!conditionObj) return true;
    return Object.entries(conditionObj).every(([stepId, allowedOptions]) => {
      const stepState = this.state.steps[stepId];
      return Boolean(
        stepState &&
        stepState.confirmed &&
        allowedOptions.includes(stepState.selectedOptionId)
      );
    });
  }

  /**
   * Vrátí definici kapitoly podle ID.
   * @param {string} chapterId
   * @returns {Object}
   */
  getChapter(chapterId) {
    return this.data.chapters.chapters.find((c) => c.id === chapterId);
  }

  /**
   * Vrátí seznam ID kroků, které jsou v dané kapitole aktivní (po vyhodnocení podmíněných kroků N3/N4).
   * @param {string} chapterId
   * @returns {Array<string>}
   */
  getEffectiveStepIds(chapterId) {
    const chapter = this.getChapter(chapterId);
    if (!chapter) return [];

    return chapter.stepIds.filter((stepId) => {
      const qDef = this.data.questions[stepId];
      if (qDef && qDef.if) {
        return this.evaluateCondition(qDef.if);
      }
      return true;
    });
  }

  /**
   * Vrátí definici libovolného kroku (E, S, N, R, ARG, POD).
   * @param {string} stepId
   * @returns {Object|null}
   */
  getStepDefinition(stepId) {
    if (stepId === 'ARG') return this.data.final.argumentsTask;
    if (stepId === 'POD') return this.data.final.pleadingTask;
    return this.data.questions[stepId] || null;
  }

  /**
   * Zjistí, zda je právě prohlížená kapitola v režimu pouze pro čtení.
   * @returns {boolean}
   */
  isReadOnlyView() {
    return this.state.viewingChapterId !== this.state.currentChapterId ||
      this.state.completedChapters.includes(this.state.viewingChapterId);
  }

  /**
   * Otevře zvolenou kapitolu (dokončenou v režimu pouze pro čtení nebo aktuální aktivní).
   * @param {string} chapterId
   */
  selectChapter(chapterId) {
    const isUnlocked =
      chapterId === this.state.currentChapterId ||
      this.state.completedChapters.includes(chapterId);
    if (!isUnlocked) return;

    this.state.viewingChapterId = chapterId;
    this.state.screen = 'game';
    this._notify();
  }

  /**
   * Odemkne počáteční i podmíněné dokumenty a instituce pro danou kapitolu.
   * @param {string} chapterId
   */
  _syncUnlocksForChapter(chapterId) {
    const chapter = this.getChapter(chapterId);
    if (!chapter) return;

    const newDocs = [...(chapter.initialDocs || [])];
    for (const condDoc of chapter.conditionalDocs || []) {
      if (this.evaluateCondition(condDoc.if)) {
        newDocs.push(condDoc.docId);
      }
    }

    for (const docId of newDocs) {
      if (!this.state.unlockedDocs.includes(docId)) {
        this.state.unlockedDocs.push(docId);
      }
    }

    for (const instId of chapter.initialInstitutions || []) {
      if (!this.state.unlockedInstitutions.includes(instId)) {
        this.state.unlockedInstitutions.push(instId);
      }
    }
  }

  /**
   * Odemkne konkrétní dokumenty a instituce po potvrzení rozhodnutí a otevře první nový dokument v archivu.
   * @param {Array<string>} docIds
   * @param {Array<string>} instIds
   */
  _unlockRewards(docIds = [], instIds = []) {
    let firstNewlyUnlockedDoc = null;

    for (const docId of docIds) {
      if (!this.state.unlockedDocs.includes(docId)) {
        this.state.unlockedDocs.push(docId);
        if (!firstNewlyUnlockedDoc) firstNewlyUnlockedDoc = docId;
      }
    }

    for (const instId of instIds) {
      if (!this.state.unlockedInstitutions.includes(instId)) {
        this.state.unlockedInstitutions.push(instId);
      }
    }

    if (firstNewlyUnlockedDoc) {
      this.openDocument(firstNewlyUnlockedDoc);
    }
  }

  /**
   * Odešle odpověď ve vzdělávací úloze (E) nebo námitce Komise (R).
   * @param {string} stepId
   * @param {string} optionId
   */
  submitChoiceAnswer(stepId, optionId) {
    if (this.isReadOnlyView()) return;

    const stepDef = this.getStepDefinition(stepId);
    if (!stepDef || (stepDef.type !== 'E' && stepDef.type !== 'R')) return;

    const updated = evaluateChoiceStep(
      stepDef,
      this.state.steps[stepId],
      optionId,
      this.data.scoring
    );
    this.state.steps[stepId] = updated;
    this._notify();
  }

  /**
   * Potvrdí strategické rozhodnutí (S1–S6).
   * @param {string} stepId
   * @param {string} optionId
   */
  confirmStrategicDecision(stepId, optionId) {
    if (this.isReadOnlyView()) return;
    if (this.state.steps[stepId]?.confirmed) return;

    const stepDef = this.getStepDefinition(stepId);
    if (!stepDef || stepDef.type !== 'S') return;

    const option = stepDef.options.find((o) => o.id === optionId);
    if (!option) return;

    const updated = evaluateStrategicStep(
      stepDef,
      optionId,
      this.state.steps,
      this.data.scoring
    );
    this.state.steps[stepId] = updated;
    this._unlockRewards(option.unlockDocs, option.unlockInstitutions);
    this._notify();
  }

  /**
   * Potvrdí nápravné opatření (N3, N4).
   * @param {string} stepId
   * @param {string} optionId
   */
  confirmRemedialDecision(stepId, optionId) {
    if (this.isReadOnlyView()) return;
    if (this.state.steps[stepId]?.confirmed) return;

    const stepDef = this.getStepDefinition(stepId);
    if (!stepDef || stepDef.type !== 'N') return;

    const option = stepDef.options.find((o) => o.id === optionId);
    if (!option) return;

    const updated = evaluateRemedialStep(
      stepDef,
      optionId,
      this.state.steps,
      this.data.questions
    );
    this.state.steps[stepId] = updated;
    this._unlockRewards(option.unlockDocs, []);
    this._notify();
  }

  /**
   * Vrátí dostupné argumenty pro krok ARG.
   * @returns {Array<Object>}
   */
  getAvailableFinalArguments() {
    return getAvailableArguments(this.data.final.argumentsTask, this.state.steps);
  }

  /**
   * Potvrdí výběr právních argumentů v kroku ARG.
   * @param {Array<string>} selectedIds
   */
  confirmArgumentsSelection(selectedIds) {
    if (this.isReadOnlyView()) return;
    if (this.state.steps.ARG?.confirmed) return;

    const updated = evaluateArgumentsStep(
      this.data.final.argumentsTask,
      selectedIds,
      this.state.steps
    );
    this.state.steps.ARG = updated;
    this._notify();
  }

  /**
   * Potvrdí závěrečné písemné podání v kroku POD.
   * @param {Object} sectionsPayload
   */
  confirmPleadingSubmission(sectionsPayload) {
    if (this.isReadOnlyView()) return;
    if (this.state.steps.POD?.confirmed) return;

    const updated = evaluatePleadingStep(
      this.data.final.pleadingTask,
      sectionsPayload,
      this.state.steps
    );
    this.state.steps.POD = updated;
    this._notify();
  }

  /**
   * Zjistí, zda je daný krok již dokončen/uzamčen.
   * @param {string} stepId
   * @returns {boolean}
   */
  isStepCompleted(stepId) {
    const s = this.state.steps[stepId];
    if (!s) return false;
    return Boolean(s.completed || s.confirmed);
  }

  /**
   * Posune hráče na další krok aktuální kapitoly, nebo uzavře kapitolu a přejde na další / posudek.
   */
  advanceStep() {
    if (this.isReadOnlyView()) return;

    const currentChapter = this.getChapter(this.state.currentChapterId);
    const effectiveSteps = this.getEffectiveStepIds(currentChapter.id);
    const currentStepId = effectiveSteps[this.state.currentStepIndex];

    if (!this.isStepCompleted(currentStepId)) {
      return;
    }

    if (this.state.currentStepIndex + 1 < effectiveSteps.length) {
      this.state.currentStepIndex += 1;
      this._notify();
      return;
    }

    // Dokončení celé kapitoly
    if (!this.state.completedChapters.includes(currentChapter.id)) {
      this.state.completedChapters.push(currentChapter.id);
    }

    const chapters = this.data.chapters.chapters;
    const chapterIdx = chapters.findIndex((c) => c.id === currentChapter.id);

    if (chapterIdx + 1 < chapters.length) {
      const nextChapter = chapters[chapterIdx + 1];
      this.state.currentChapterId = nextChapter.id;
      this.state.viewingChapterId = nextChapter.id;
      this.state.currentStepIndex = 0;
      this._syncUnlocksForChapter(nextChapter.id);
      this._notify();
    } else {
      // Kampaň dokončena -> přechod na závěrečný akademický posudek
      this.state.completedAt = new Date().toISOString();
      this.state.screen = 'assessment';
      this._notify();
    }
  }

  /**
   * Zpřístupní další stupeň nápovědy právního poradce dr. Kellera u úloh E a R.
   * @param {string} stepId
   * @returns {number} Aktuální počet odemčených nápověd (1–3)
   */
  requestHint(stepId) {
    const stepDef = this.getStepDefinition(stepId);
    if (!stepDef || !Array.isArray(stepDef.hints)) return 0;

    const existing = this.state.steps[stepId] || {
      type: stepDef.type,
      attempts: [],
      completed: false,
      correct: false,
      pointsEarned: 0,
      competencyPoints: {},
      errorTags: [],
      hintsUsed: 0
    };

    if (existing.hintsUsed < stepDef.hints.length) {
      existing.hintsUsed += 1;
      this.state.steps[stepId] = existing;
      this._notify();
    }
    return existing.hintsUsed;
  }

  /**
   * Zapne či vypne zvýraznění relevantních pasáží v dokumentu archivu (bez bodové penalizace).
   * @param {string} docId
   */
  toggleDocumentHighlight(docId) {
    const nextVal = !this.state.highlightedDocs[docId];
    this.state.highlightedDocs[docId] = nextVal;
    if (nextVal) {
      this.state.highlightUsageCount = (this.state.highlightUsageCount || 0) + 1;
    }
    this._notify();
  }

  /**
   * Otevře dokument v bočním pracovním panelu archivu a přepne na jeho záložku.
   * @param {string} docId
   */
  openDocument(docId) {
    if (!this.state.unlockedDocs.includes(docId)) return;
    if (!this.state.openDocTabs.includes(docId)) {
      this.state.openDocTabs.push(docId);
    }
    this.state.activeDocTab = docId;
    this.state.archiveOpen = true;
    this._notify();
  }

  /**
   * Zavře záložku dokumentu v archivu.
   * @param {string} docId
   */
  closeDocumentTab(docId) {
    this.state.openDocTabs = this.state.openDocTabs.filter((id) => id !== docId);
    if (this.state.activeDocTab === docId) {
      this.state.activeDocTab =
        this.state.openDocTabs.length > 0
          ? this.state.openDocTabs[this.state.openDocTabs.length - 1]
          : null;
    }
    this._notify();
  }

  /**
   * Uloží pozici svislého posuvníku konkrétního dokumentu.
   * @param {string} docId
   * @param {number} scrollTop
   */
  saveDocScrollPosition(docId, scrollTop) {
    this.state.docScrollPositions[docId] = scrollTop;
    saveState(this.state);
  }

  /**
   * Přepne viditelnost bočního panelu archivu.
   * @param {boolean} [forceState]
   */
  toggleArchive(forceState) {
    this.state.archiveOpen =
      typeof forceState === 'boolean' ? forceState : !this.state.archiveOpen;
    this._notify();
  }

  /**
   * Nastaví šířku bočního panelu archivu v procentech (v rozmezí 26–62 %).
   * @param {number} widthPct
   */
  setArchiveWidth(widthPct) {
    this.state.archiveWidthPct = Math.max(26, Math.min(62, Math.round(widthPct)));
    saveState(this.state);
  }

  /**
   * Vrátí průběžné nebo závěrečné bodové výsledky.
   * @returns {Object}
   */
  getResults() {
    return computeFinalResults(this.state, this.data.scoring);
  }

  /**
   * Vygeneruje kompletní závěrečný akademický posudek.
   * @returns {Object}
   */
  getAssessmentReport() {
    return buildAcademicAssessment(this.state, this.data);
  }
}
