/**
 * editor.js
 * Editor závěrečné obhajoby před SDEU (Kapitola 6: výběr argumentů ARG a písemné podání POD).
 */

import { escapeHtml } from './documents.js';

export class DefenseEditor {
  /**
   * @param {import('./game-engine.js').GameEngine} engine
   */
  constructor(engine) {
    this.engine = engine;
    this.selectedArgIds = null;
    this.pleadingDraft = null;
  }

  resetDrafts() {
    this.selectedArgIds = null;
    this.pleadingDraft = null;
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
  }

  selectPleadingOption(secId, optionId) {
    this._ensurePleadingDraft();
    this.pleadingDraft[secId] = optionId;
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
        let evalBadge = '';
        if (isConfirmed) {
          const sign = arg.weight > 0 ? `+${arg.weight}` : `${arg.weight}`;
          const cls =
            arg.weight > 0 ? 'is-correct' : arg.weight < 0 ? 'is-wrong' : '';
          evalBadge = `
            <div class="option-feedback ${cls}">
              <strong>Váha: ${sign} b. (${escapeHtml(arg.category)})</strong> • ${escapeHtml(
            arg.legalBasis
          )}<br />
              ${escapeHtml(arg.explanation)}
            </div>
          `;
        }

        return `
          <label class="arg-checkbox-row ${isChecked ? 'is-checked' : ''}">
            <input
              type="checkbox"
              data-action="toggle-arg-checkbox"
              data-arg-id="${escapeHtml(arg.id)}"
              ${isChecked ? 'checked' : ''}
              ${isConfirmed || isReadOnly ? 'disabled' : ''}
            />
            <div>
              <div><strong>[${escapeHtml(arg.id)}]</strong> ${escapeHtml(arg.text)}</div>
              ${evalBadge}
            </div>
          </label>
        `;
      })
      .join('');

    return `
      <section class="task-card">
        <span class="task-type-badge">Příprava obhajoby před SDEU</span>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">${escapeHtml(stepDef.instructions)}</div>

        <div class="options-list">${listHtml}</div>

        ${
          !isConfirmed && !isReadOnly
            ? `<div class="action-bar">
                <button
                  type="button"
                  class="btn btn-primary"
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
            ? `<div class="resolution-panel">
                <strong>Výběr argumentů uzavřen (zisk: ${stepState.pointsEarned} / ${stepDef.maxPoints} b.).</strong>
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
                <li class="sortable-arg-item">
                  <div>
                    <strong>${idx + 1}. [${escapeHtml(argObj.id)}]</strong> ${escapeHtml(
                argObj.text
              )}
                  </div>
                  ${
                    !isConfirmed && !isReadOnly
                      ? `<div class="sortable-controls">
                          <button
                            type="button"
                            class="btn btn-sm btn-secondary"
                            data-action="move-sec5-arg"
                            data-index="${idx}"
                            data-dir="-1"
                            ${idx === 0 ? 'disabled' : ''}
                            title="Posunout výše"
                          >▲</button>
                          <button
                            type="button"
                            class="btn btn-sm btn-secondary"
                            data-action="move-sec5-arg"
                            data-index="${idx}"
                            data-dir="1"
                            ${idx === orderedIds.length - 1 ? 'disabled' : ''}
                            title="Posunout níže"
                          >▼</button>
                        </div>`
                      : ''
                  }
                </li>
              `;
            })
            .join('');

          const sec5Result = isConfirmed ? stepState.sectionResults.SEC5 : null;
          return `
            <div class="pleading-section-box">
              <h3>${escapeHtml(sec.title)}</h3>
              <p style="font-size: 0.88rem; color: var(--text-secondary);">
                Seřaďte vybrané argumenty od obecné právní premisy přes metodiku poměřování až po konkrétní aplikaci na skutkový stav:
              </p>
              <ol class="sortable-arg-list">${itemsHtml}</ol>
              ${
                sec5Result
                  ? `<div class="option-feedback ${
                      sec5Result.points >= 7 ? 'is-correct' : 'is-wrong'
                    }">
                      <strong>Hodnocení logické návaznosti: ${sec5Result.points} / ${
                      sec5Result.maxPoints
                    } b.</strong> (splněno ${sec5Result.satisfiedRules} z ${
                      sec5Result.applicableRules
                    } návazností).
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
            const classes = ['option-card'];
            if (isSelected) classes.push('is-selected');
            if (isConfirmed || isReadOnly) classes.push('is-locked');

            return `
              <button
                type="button"
                class="${classes.join(' ')}"
                data-action="select-pleading-option"
                data-sec-id="${escapeHtml(sec.id)}"
                data-option-id="${escapeHtml(opt.id)}"
                ${isConfirmed || isReadOnly ? 'disabled' : ''}
              >
                <div class="option-header">
                  <span class="option-letter">${escapeHtml(opt.id)}</span>
                  <span class="option-text">${escapeHtml(opt.text)}</span>
                </div>
              </button>
            `;
          })
          .join('');

        return `
          <div class="pleading-section-box">
            <h3>${escapeHtml(sec.title)}</h3>
            <div class="options-list">${optsHtml}</div>
            ${
              secResult
                ? `<div class="option-feedback ${
                    secResult.points >= 4 ? 'is-correct' : 'is-wrong'
                  }">
                    <strong>Hodnocení oddílu: ${secResult.points} / ${
                    secResult.maxPoints
                  } b.</strong> – ${escapeHtml(secResult.feedback)}
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
      <section class="task-card">
        <span class="task-type-badge is-strategic">Závěrečné procesní podání k SDEU</span>
        <h3>${escapeHtml(stepDef.title)}</h3>
        <div class="situation-box">${escapeHtml(stepDef.instructions)}</div>

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
            ? `<div class="resolution-panel">
                <strong>Písemné podání bylo odesláno (zisk: ${stepState.pointsEarned} / ${stepDef.maxPoints} b.).</strong>
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
      <div class="pleading-preview">
        <div style="text-align: center; font-weight: bold; margin-bottom: 1rem;">
          VYJÁDŘENÍ VLÁDY MARENSKÉ REPUBLIKY PŘED SOUDNÍM DVOREM EVROPSKÉ UNIE<br />
          <span style="font-size: 0.88rem; font-weight: normal;">Věc C-418/R4, Evropská komise v. Marenská republika</span>
        </div>
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
        <p>${escapeHtml(getOptText('SEC6'))}</p>
      </div>
    `;
  }
}
