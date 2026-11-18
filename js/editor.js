/**
 * editor.js
 * Editor závěrečné obhajoby před SDEU (Kapitola 6: výběr argumentů ARG a písemné podání POD).
 */

import { escapeHtml } from './documents.js';

const EDITOR_DRAFTS_KEY = 'letat_cest_moi_editor_drafts_v1';

export class DefenseEditor {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    const saved = this._loadDrafts();
    this.selectedArgIds = Array.isArray(saved?.selectedArgIds) ? saved.selectedArgIds : null;
    this.pleadingDraft = saved?.pleadingDraft || null;
  }

  _loadDrafts() {
    try {
      const raw = window.sessionStorage.getItem(EDITOR_DRAFTS_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  _saveDrafts() {
    try {
      window.sessionStorage.setItem(
        EDITOR_DRAFTS_KEY,
        JSON.stringify({
          selectedArgIds: this.selectedArgIds,
          pleadingDraft: this.pleadingDraft
        })
      );
    } catch {
      // Ignorovat
    }
  }

  resetDrafts() {
    this.selectedArgIds = null;
    this.pleadingDraft = null;
    try {
      window.sessionStorage.removeItem(EDITOR_DRAFTS_KEY);
    } catch {
      // Ignorovat
    }
  }

  toggleArgument(argId, checked) {
    if (!Array.isArray(this.selectedArgIds)) {
      this.selectedArgIds = [];
    }
    const set = new Set(this.selectedArgIds);
    if (checked) {
      set.add(argId);
    } else {
      set.delete(argId);
    }
    this.selectedArgIds = [...set];
    this._saveDrafts();
  }

  selectPleadingOption(secId, optionId) {
    this._ensurePleadingDraft();
    this.pleadingDraft[secId] = optionId;
    this._saveDrafts();
  }

  moveSection5Argument(index, direction) {
    this._ensurePleadingDraft();
    const list = this.pleadingDraft.SEC5;
    if (!Array.isArray(list)) return;

    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= list.length) return;

    const swap = list[index];
    list[index] = list[targetIdx];
    list[targetIdx] = swap;
    this._saveDrafts();
  }

  getSelectedArgumentIds() {
    return Array.isArray(this.selectedArgIds) ? [...this.selectedArgIds] : [];
  }

  getPleadingPayload() {
    this._ensurePleadingDraft();
    return {
      ...this.pleadingDraft,
      SEC5: [...(this.pleadingDraft.SEC5 || [])]
    };
  }

  _ensurePleadingDraft() {
    const availableArgs = this.engine.getAvailableFinalArguments();
    const argMap = new Map(availableArgs.map((a) => [a.id, a]));
    const selectedInArg = (this.engine.state.steps.ARG?.selectedIds || []).filter((id) =>
      argMap.has(id)
    );
    const defaultOrder =
      selectedInArg.length > 0
        ? [...selectedInArg]
        : availableArgs.filter((a) => a.weight > 0).map((a) => a.id);

    if (!this.pleadingDraft) {
      this.pleadingDraft = {
        SEC1: null,
        SEC2: null,
        SEC3: null,
        SEC4: null,
        SEC5: defaultOrder,
        SEC6: null
      };
    } else if (!Array.isArray(this.pleadingDraft.SEC5) || this.pleadingDraft.SEC5.length === 0) {
      this.pleadingDraft.SEC5 = defaultOrder;
    } else {
      this.pleadingDraft.SEC5 = this.pleadingDraft.SEC5.filter((id) => argMap.has(id));
    }
  }

  /**
   * Vykreslí krok ARG (výběr právních argumentů vlády).
   * @param {Object} stepDef
   * @param {boolean} isReadOnly
   * @param {string} advanceButtonHtml
   * @returns {string}
   */
  renderArgumentsTask(stepDef, isReadOnly, advanceButtonHtml) {
    const stepState = this.engine.state.steps.ARG;
    const isConfirmed = Boolean(stepState && stepState.confirmed);
    const availableArgs = this.engine.getAvailableFinalArguments();

    if (!Array.isArray(this.selectedArgIds)) {
      this.selectedArgIds = [];
    }
    const activeSelection = isConfirmed
      ? stepState.selectedIds
      : this.selectedArgIds;

    const listHtml = availableArgs
      .map((arg) => {
        const isChecked = activeSelection.includes(arg.id);
        let evalNote = '';
        if (isConfirmed) {
          const sign = arg.weight > 0 ? `+${arg.weight}` : `${arg.weight}`;
          const noteClass =
            arg.weight > 0 ? 'note note-good' : arg.weight < 0 ? 'note note-bad' : 'note';
          evalNote = `
            <div class="${noteClass}" style="margin-top: 0.45rem;">
              <strong>Váha: ${sign} b. (${escapeHtml(arg.category)})</strong> • ${escapeHtml(
            arg.legalBasis
          )}<br />
              ${escapeHtml(arg.explanation)}
            </div>
          `;
        }

        return `
          <label class="radio-opt">
            <input
              type="checkbox"
              data-action="toggle-arg-checkbox"
              data-arg-id="${escapeHtml(arg.id)}"
              ${isChecked ? 'checked' : ''}
              ${isConfirmed || isReadOnly ? 'disabled' : ''}
            />
            <div style="flex: 1;">
              <div><strong>[${escapeHtml(arg.id)}]</strong> ${escapeHtml(arg.text)}</div>
              ${evalNote}
            </div>
          </label>
        `;
      })
      .join('');

    return `
      <section>
        <div class="eyebrow">Příprava obhajoby před Soudním dvorem EU</div>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">
          <p style="margin-bottom: 0;">${escapeHtml(stepDef.instructions)}</p>
        </div>

        <div class="brief-section">
          <h3>Výběr právních argumentů do písemného vyjádření</h3>
          ${listHtml}
        </div>

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn"
                  data-action="confirm-arguments"
                  ${activeSelection.length > 0 ? '' : 'disabled'}
                >
                  Potvrdit výběr argumentů (${activeSelection.length} vybráno)
                </button>
              </div>`
            : ''
        }

        ${
          isConfirmed
            ? `<div class="feedback-stack">
                <div class="note note-good">
                  <strong>Výběr argumentů uzavřen (zisk: ${stepState.pointsEarned} / ${stepDef.maxPoints} b.).</strong>
                </div>
                ${advanceButtonHtml}
              </div>`
            : ''
        }
      </section>
    `;
  }

  /**
   * Vykreslí krok POD (strukturované písemné vyjádření k SDEU).
   * @param {Object} stepDef
   * @param {boolean} isReadOnly
   * @param {string} advanceButtonHtml
   * @returns {string}
   */
  renderPleadingTask(stepDef, isReadOnly, advanceButtonHtml) {
    const stepState = this.engine.state.steps.POD;
    const isConfirmed = Boolean(stepState && stepState.confirmed);
    const availableArgs = this.engine.getAvailableFinalArguments();
    const argMap = new Map(availableArgs.map((a) => [a.id, a]));

    this._ensurePleadingDraft();

    const currentData = isConfirmed ? stepState.sections : this.pleadingDraft;
    const orderedIds = Array.isArray(currentData.SEC5) ? currentData.SEC5 : [];

    const sectionsHtml = stepDef.sections
      .map((sec) => {
        if (sec.id === 'SEC5') {
          const itemsHtml = orderedIds
            .map((argId, idx) => {
              const argObj = argMap.get(argId);
              if (!argObj) return '';
              return `
                <div class="order-item">
                  <div>
                    <strong>${idx + 1}. [${escapeHtml(argObj.id)}]</strong> ${escapeHtml(
                argObj.text
              )}
                  </div>
                  ${
                    !isConfirmed && !isReadOnly
                      ? `<div class="order-controls">
                          <button
                            type="button"
                            class="btn btn-alt btn-sm"
                            data-action="move-sec5-arg"
                            data-index="${idx}"
                            data-dir="-1"
                            ${idx === 0 ? 'disabled' : ''}
                            title="Posunout výše"
                            aria-label="Posunout argument výše"
                          >▲</button>
                          <button
                            type="button"
                            class="btn btn-alt btn-sm"
                            data-action="move-sec5-arg"
                            data-index="${idx}"
                            data-dir="1"
                            ${idx === orderedIds.length - 1 ? 'disabled' : ''}
                            title="Posunout níže"
                            aria-label="Posunout argument níže"
                          >▼</button>
                        </div>`
                      : ''
                  }
                </div>
              `;
            })
            .join('');

          const sec5Result = isConfirmed ? stepState.sectionResults.SEC5 : null;
          return `
            <div class="brief-section">
              <h3>${escapeHtml(sec.title)}</h3>
              <p class="small">
                Seřaďte vybrané argumenty od obecné právní premisy přes metodiku poměřování až po konkrétní aplikaci na skutkový stav:
              </p>
              <div class="order-list">${itemsHtml}</div>
              ${
                sec5Result
                  ? `<div class="feedback-stack">
                      <div class="note ${sec5Result.points >= 7 ? 'note-good' : 'note-bad'}">
                        <strong>Hodnocení logické návaznosti: ${sec5Result.points} / ${
                        sec5Result.maxPoints
                      } b.</strong> (splněno ${sec5Result.satisfiedRules} z ${
                        sec5Result.applicableRules
                      } návazností).
                      </div>
                    </div>`
                  : ''
              }
            </div>
          `;
        }

        const chosenOptId = currentData[sec.id];
        const secResult = isConfirmed ? stepState.sectionResults[sec.id] : null;

        const optsHtml = sec.options
          .map((opt) => {
            const isSelected = chosenOptId === opt.id;
            return `
              <label class="radio-opt">
                <input
                  type="radio"
                  name="pleading_${escapeHtml(sec.id)}"
                  data-action="select-pleading-option"
                  data-sec-id="${escapeHtml(sec.id)}"
                  data-option-id="${escapeHtml(opt.id)}"
                  ${isSelected ? 'checked' : ''}
                  ${isConfirmed || isReadOnly ? 'disabled' : ''}
                />
                <span><strong>${escapeHtml(opt.id)})</strong> ${escapeHtml(opt.text)}</span>
              </label>
            `;
          })
          .join('');

        return `
          <div class="brief-section">
            <h3>${escapeHtml(sec.title)}</h3>
            ${optsHtml}
            ${
              secResult
                ? `<div class="feedback-stack">
                    <div class="note ${secResult.points >= 4 ? 'note-good' : 'note-bad'}">
                      <strong>Hodnocení oddílu: ${secResult.points} / ${
                      secResult.maxPoints
                    } b.</strong> – ${escapeHtml(secResult.feedback)}
                    </div>
                  </div>`
                : ''
            }
          </div>
        `;
      })
      .join('');

    const allSectionsFilled =
      Boolean(currentData.SEC1) &&
      Boolean(currentData.SEC2) &&
      Boolean(currentData.SEC3) &&
      Boolean(currentData.SEC4) &&
      Boolean(currentData.SEC6);

    return `
      <section>
        <div class="eyebrow">Závěrečné procesní podání k SDEU</div>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">
          <p style="margin-bottom: 0;">${escapeHtml(stepDef.instructions)}</p>
        </div>

        ${sectionsHtml}

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-gold"
                  data-action="confirm-pleading"
                  ${allSectionsFilled ? '' : 'disabled'}
                >
                  Odeslat písemné vyjádření Soudnímu dvoru EU
                </button>
              </div>`
            : ''
        }

        ${
          isConfirmed
            ? `<div class="feedback-stack">
                <div class="note note-good">
                  <strong>Písemné podání bylo odesláno (zisk: ${stepState.pointsEarned} / ${stepDef.maxPoints} b.).</strong>
                </div>
                ${this.renderPleadingPreview(stepDef, currentData, argMap)}
                ${advanceButtonHtml}
              </div>`
            : ''
        }
      </section>
    `;
  }

  renderPleadingPreview(stepDef, currentData, argMap) {
    const getOptText = (secId) => {
      const sec = stepDef.sections.find((s) => s.id === secId);
      const opt = sec?.options?.find((o) => o.id === currentData[secId]);
      return opt ? opt.text : '';
    };

    const argTexts = (currentData.SEC5 || [])
      .map((id) => argMap.get(id)?.text)
      .filter(Boolean);

    return `
      <div class="report-header-box" style="margin-top: 0.75rem;">
        <div class="eyebrow">Čistopis procesního podání</div>
        <h3 style="margin-top: 0;">VYJÁDŘENÍ VLÁDY MARENSKÉ REPUBLIKY PŘED SOUDNÍM DVOREM EU</h3>
        <p class="small">Věc C-418/R4, Evropská komise v. Marenská republika</p>
        <h4>1. Skutkový stav</h4>
        <p>${escapeHtml(getOptText('SEC1'))}</p>
        <h4>2. Právní otázka</h4>
        <p>${escapeHtml(getOptText('SEC2'))}</p>
        <h4>3. Relevantní právní úprava</h4>
        <p>${escapeHtml(getOptText('SEC3'))}</p>
        <h4>4. Judikatorní východiska</h4>
        <p>${escapeHtml(getOptText('SEC4'))}</p>
        <h4>5. Aplikace práva na skutkový stav</h4>
        <ol>
          ${argTexts.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}
        </ol>
        <h4>6. Závěrečný návrh (petit)</h4>
        <p style="margin-bottom: 0;">${escapeHtml(getOptText('SEC6'))}</p>
      </div>
    `;
  }
}
