/**
 * scoring.js
 * Výpočet bodů, kompetenčního profilu (C1–C8), srážek za opakované chyby a výsledné známky.
 */

/**
 * Mapování chybových štítků M1–M11 na primární právní kompetenci.
 */
export const ERROR_TAG_COMPETENCY_MAP = {
  M1: 'C1',  // Záměna SDEU a ESLP / EU a Rady Evropy
  M2: 'C3',  // Rozšíření/zúžení působnosti Listiny (čl. 51 odst. 1)
  M3: 'C1',  // Nadřazení vnitrostátní ústavy nad právo EU
  M4: 'C4',  // Připsání nevysloveného závěru soudu
  M5: 'C5',  // Absolutizace práva nebo svobody bez poměřování
  M6: 'C2',  // Izolované čtení jediné jazykové verze
  M7: 'C2',  // Záměna zbavení majetku a úpravy užívání majetku
  M8: 'C2',  // Přehlédnutí přeshraničního prvku
  M9: 'C5',  // Vynechání testu proporcionality
  M10: 'C2', // Přeskočení výkladu normy před přezkumem platnosti
  M11: 'C3'  // Omezení odpovědnosti státu jen na aktivní kroky či dovoz/vývoz
};

/**
 * Kanonické váhy kompetencí pro úlohu ARG (součet 20 bodů, sjednoceno se scoring.json).
 */
const ARG_COMPETENCY_WEIGHTS = [
  ['C7', 10],
  ['C4', 6],
  ['C3', 4]
];

/**
 * Zaokrouhlí číslo na 2 desetinná místa.
 * @param {number} val
 * @returns {number}
 */
function round2(val) {
  return Math.round((val + Number.EPSILON) * 100) / 100;
}

/**
 * Zaokrouhlí číslo na 1 desetinné místo.
 * @param {number} val
 * @returns {number}
 */
function round1(val) {
  return Math.round((val + Number.EPSILON) * 10) / 10;
}

/**
 * Rozdělí celkový počet získaných bodů úlohy poměrně mezi její kompetence.
 * @param {Array<[string, number]>} compWeights - Dvojice [competencyId, maxCompPoints]
 * @param {number} ratio - Poměr úspěšnosti v intervalu <0, 1>
 * @returns {Object<string, number>}
 */
export function distributeCompetencyPoints(compWeights, ratio) {
  const clampedRatio = Math.max(0, Math.min(1, ratio));
  const result = {};
  for (const [compId, maxPts] of compWeights) {
    result[compId] = round2(maxPts * clampedRatio);
  }
  return result;
}

/**
 * Vyhodnotí jeden pokus v uzavřené úloze typu E nebo R.
 * @param {Object} question - Definice úlohy z questions.json
 * @param {Object|null} existingStepState - Dosavadní stav kroku
 * @param {string} optionId - Zvolená odpověď ('A'..'D')
 * @param {Object} scoringData - Definice ze scoring.json
 * @returns {Object} Aktualizovaný stav kroku
 */
export function evaluateChoiceStep(question, existingStepState, optionId, scoringData) {
  const prev = existingStepState || {
    type: question.type,
    attempts: [],
    completed: false,
    correct: false,
    pointsEarned: 0,
    competencyPoints: {},
    errorTags: [],
    hintsUsed: 0
  };

  if (prev.completed) {
    return prev;
  }

  const chosenOption = question.options.find((o) => o.id === optionId);
  if (!chosenOption) {
    return prev;
  }

  const attempts = [...prev.attempts, optionId];
  const errorTags = [...prev.errorTags];
  if (!chosenOption.correct && chosenOption.tag) {
    errorTags.push(chosenOption.tag);
  }

  const maxAttempts = question.maxAttempts || 3;
  const multipliers = scoringData.attemptMultipliers || [1, 0.55, 0.25];

  if (chosenOption.correct) {
    const attemptIndex = attempts.length - 1;
    const multiplier = multipliers[attemptIndex] ?? 0;
    const compPts = distributeCompetencyPoints(question.competencies, multiplier);
    const pointsEarned = round2(
      Object.values(compPts).reduce((acc, v) => acc + v, 0)
    );

    return {
      ...prev,
      attempts,
      completed: true,
      correct: true,
      pointsEarned,
      competencyPoints: compPts,
      errorTags
    };
  }

  // Nesprávná odpověď
  const exhausted = attempts.length >= maxAttempts;
  return {
    ...prev,
    attempts,
    completed: exhausted,
    correct: false,
    pointsEarned: 0,
    competencyPoints: exhausted ? distributeCompetencyPoints(question.competencies, 0) : {},
    errorTags
  };
}

/**
 * Vyhodnotí strategické rozhodnutí (S1–S6).
 * @param {Object} stepDef - Definice kroku S z questions.json
 * @param {string} optionId - Zvolená varianta
 * @param {Object} allStepsState - Dosavadní stav všech kroků (kvůli podmínce S6 dle S5)
 * @param {Object} scoringData - Definice ze scoring.json
 * @returns {Object} Stav kroku S
 */
export function evaluateStrategicStep(stepDef, optionId, allStepsState, scoringData) {
  const option = stepDef.options.find((o) => o.id === optionId);
  if (!option) {
    throw new Error(`Neplatná varianta ${optionId} pro krok ${stepDef.id}`);
  }

  let effectiveLevel = option.level;

  // Podmíněná úroveň (např. S6 závisí na S5)
  if (option.levelByCondition) {
    for (const [depStepId, mapping] of Object.entries(option.levelByCondition)) {
      const depChoice = allStepsState[depStepId]?.selectedOptionId;
      if (depChoice && Object.prototype.hasOwnProperty.call(mapping, depChoice)) {
        effectiveLevel = mapping[depChoice];
      }
    }
  }

  const divisor = scoringData.strategicLevelDivisor || 3;
  const ratio = effectiveLevel / divisor;
  const compPts = distributeCompetencyPoints(stepDef.competencies, ratio);
  const pointsEarned = round2(
    Object.values(compPts).reduce((acc, v) => acc + v, 0)
  );

  return {
    type: 'S',
    selectedOptionId: optionId,
    confirmed: true,
    level: effectiveLevel,
    pointsEarned,
    competencyPoints: compPts
  };
}

/**
 * Vyhodnotí nápravné opatření (N3 nebo N4).
 * Přičítá body ke kompetenci C8 příslušné strategické úlohy nejvýše do jejího původního maxima.
 * @param {Object} stepDef - Definice kroku N z questions.json
 * @param {string} optionId - Zvolená varianta
 * @param {Object} allStepsState - Stav všech kroků
 * @param {Object} questionsData - Všechny otázky z questions.json
 * @returns {Object} Stav kroku N
 */
export function evaluateRemedialStep(stepDef, optionId, allStepsState, questionsData) {
  const option = stepDef.options.find((o) => o.id === optionId);
  if (!option) {
    throw new Error(`Neplatná varianta ${optionId} pro nápravný krok ${stepDef.id}`);
  }

  const linkedStrategicId = stepDef.id === 'N3' ? 'S3' : 'S4';
  const strategicDef = questionsData[linkedStrategicId];
  const strategicState = allStepsState[linkedStrategicId];

  const c8Entry = strategicDef?.competencies?.find(([c]) => c === 'C8');
  const maxC8ForStrategic = c8Entry ? c8Entry[1] : 3;
  const currentC8Earned = strategicState?.competencyPoints?.C8 || 0;

  const rawBonus = option.points || 0;
  const effectiveBonus = Math.max(
    0,
    Math.min(rawBonus, round2(maxC8ForStrategic - currentC8Earned))
  );

  return {
    type: 'N',
    selectedOptionId: optionId,
    confirmed: true,
    pointsEarned: effectiveBonus,
    competencyPoints: {
      C8: effectiveBonus
    }
  };
}

/**
 * Vrátí seznam argumentů dostupných v kroku ARG podle dosavadního průběhu hry.
 * @param {Object} argumentsTask - Definice z final.json
 * @param {Object} allStepsState - Stav všech kroků
 * @returns {Array<Object>}
 */
export function getAvailableArguments(argumentsTask, allStepsState) {
  return argumentsTask.arguments.filter((arg) => {
    if (!arg.if) return true;
    return Object.entries(arg.if).every(([stepId, allowedIds]) => {
      const chosen = allStepsState[stepId]?.selectedOptionId;
      return Boolean(chosen && allowedIds.includes(chosen));
    });
  });
}

/**
 * Vyhodnotí krok ARG (výběr právních argumentů v Kapitole 6).
 * @param {Object} argumentsTask - Definice z final.json
 * @param {Array<string>} selectedIds - ID argumentů vybraných uživatelem
 * @param {Object} allStepsState - Stav všech kroků
 * @returns {Object} Stav kroku ARG
 */
export function evaluateArgumentsStep(argumentsTask, selectedIds, allStepsState) {
  const available = getAvailableArguments(argumentsTask, allStepsState);
  const availableMap = new Map(available.map((a) => [a.id, a]));
  const uniqueSelected = [...new Set(selectedIds)].filter((id) => availableMap.has(id));

  let rawWeight = 0;
  const errorTags = [];

  for (const id of uniqueSelected) {
    const arg = availableMap.get(id);
    rawWeight += arg.weight;
    if (arg.id === 'W1') errorTags.push('M4');
    if (arg.id === 'W2') errorTags.push('M3');
  }

  const maxAvailableWeight = available.reduce(
    (sum, arg) => (arg.weight > 0 ? sum + arg.weight : sum),
    0
  );

  const clampedRaw = Math.max(0, rawWeight);
  const ratio = maxAvailableWeight > 0 ? clampedRaw / maxAvailableWeight : 0;

  const compPts = distributeCompetencyPoints(ARG_COMPETENCY_WEIGHTS, ratio);
  const pointsEarned = round2(
    Object.values(compPts).reduce((acc, v) => acc + v, 0)
  );

  return {
    type: 'A',
    selectedIds: uniqueSelected,
    confirmed: true,
    rawWeight,
    maxAvailableWeight,
    pointsEarned,
    competencyPoints: compPts,
    errorTags
  };
}

/**
 * Vyhodnotí krok POD (sestavení strukturovaného písemného podání před SDEU).
 * @param {Object} pleadingTask - Definice z final.json
 * @param {Object} userSections - { SEC1: '1a', SEC2: '2a', SEC3: '3a', SEC4: '4a', SEC5: ['A1',...], SEC6: '6a' }
 * @param {Object} allStepsState - Stav všech kroků (pro ověření konzistence SEC6 se S6)
 * @returns {Object} Stav kroku POD
 */
export function evaluatePleadingStep(pleadingTask, userSections, allStepsState) {
  const compTotals = {
    C7: 0,
    C2: 0,
    C3: 0,
    C4: 0,
    C8: 0
  };
  const errorTags = [];
  const sectionResults = {};

  for (const sec of pleadingTask.sections) {
    if (sec.id === 'SEC5') {
      // Hodnocení logického pořadí vybraných argumentů
      const orderedIds = Array.isArray(userSections.SEC5) ? userSections.SEC5 : [];
      const rules = sec.orderingRules || [];
      const evaluatedRules = [];
      let applicableCount = 0;
      let satisfiedCount = 0;

      for (const rule of rules) {
        const idxBefore = orderedIds.indexOf(rule.before);
        const idxAfter = orderedIds.indexOf(rule.after);
        if (idxBefore !== -1 && idxAfter !== -1) {
          applicableCount += 1;
          const satisfied = idxBefore < idxAfter;
          if (satisfied) satisfiedCount += 1;
          evaluatedRules.push({
            ...rule,
            applicable: true,
            satisfied
          });
        } else {
          evaluatedRules.push({
            ...rule,
            applicable: false,
            satisfied: null
          });
        }
      }

      const secPoints =
        applicableCount > 0
          ? round2((satisfiedCount / applicableCount) * sec.maxPoints)
          : 0;

      compTotals.C7 = round2(compTotals.C7 + secPoints);
      sectionResults.SEC5 = {
        orderedIds,
        points: secPoints,
        maxPoints: sec.maxPoints,
        applicableRules: applicableCount,
        satisfiedRules: satisfiedCount,
        rules: evaluatedRules
      };
      continue;
    }

    if (sec.id === 'SEC6') {
      const chosenId = userSections.SEC6;
      const opt = sec.options.find((o) => o.id === chosenId);
      const s6Choice = allStepsState.S6?.selectedOptionId || null;

      let secPoints = 0;
      let feedback = '';
      let isConsistent = false;

      if (opt) {
        isConsistent = Boolean(opt.consistentWithS6 && opt.consistentWithS6 === s6Choice);
        secPoints = isConsistent ? opt.pointsWhenConsistent : opt.pointsWhenInconsistent;
        feedback = isConsistent ? opt.feedbackConsistent : opt.feedbackInconsistent;
      }

      const ratio = sec.maxPoints > 0 ? secPoints / sec.maxPoints : 0;
      const secCompPts = distributeCompetencyPoints(sec.competencies, ratio);
      for (const [cId, val] of Object.entries(secCompPts)) {
        compTotals[cId] = round2((compTotals[cId] || 0) + val);
      }

      sectionResults.SEC6 = {
        selectedOptionId: chosenId,
        points: secPoints,
        maxPoints: sec.maxPoints,
        isConsistentWithS6: isConsistent,
        feedback
      };
      continue;
    }

    // Oddíly SEC1–SEC4
    const chosenId = userSections[sec.id];
    const opt = sec.options.find((o) => o.id === chosenId);
    const secPoints = opt ? opt.points : 0;
    const compId = sec.competency;

    compTotals[compId] = round2((compTotals[compId] || 0) + secPoints);

    if (sec.id === 'SEC4' && (chosenId === '4c' || chosenId === '4d')) {
      errorTags.push('M4');
    }

    sectionResults[sec.id] = {
      selectedOptionId: chosenId,
      points: secPoints,
      maxPoints: sec.maxPoints,
      feedback: opt ? opt.feedback : ''
    };
  }

  const pointsEarned = round2(
    Object.values(compTotals).reduce((acc, v) => acc + v, 0)
  );

  return {
    type: 'P',
    sections: { ...userSections },
    confirmed: true,
    sectionResults,
    pointsEarned,
    competencyPoints: compTotals,
    errorTags
  };
}

/**
 * Vypočítá souhrnné výsledky celé kampaně, kompetenční profil, penalizace a celkovou klasifikaci.
 * @param {Object} state - Celý stav hry
 * @param {Object} scoringData - Data ze scoring.json
 * @returns {Object} Kompletní výsledková struktura
 */
export function computeFinalResults(state, scoringData) {
  const rawCompetencyEarned = {};
  for (const compId of Object.keys(scoringData.competencies)) {
    rawCompetencyEarned[compId] = 0;
  }

  const allErrorTags = [];
  let totalPointsEarned = 0;

  for (const stepState of Object.values(state.steps)) {
    if (!stepState) continue;

    if (typeof stepState.pointsEarned === 'number') {
      totalPointsEarned = round2(totalPointsEarned + stepState.pointsEarned);
    }

    if (stepState.competencyPoints) {
      for (const [compId, pts] of Object.entries(stepState.competencyPoints)) {
        if (Object.prototype.hasOwnProperty.call(rawCompetencyEarned, compId)) {
          rawCompetencyEarned[compId] = round2(rawCompetencyEarned[compId] + pts);
        }
      }
    }

    if (Array.isArray(stepState.errorTags)) {
      allErrorTags.push(...stepState.errorTags);
    }
  }

  // Spočítat četnost chybových štítků a penalizace za opakování
  const tagCounts = {};
  for (const tag of allErrorTags) {
    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
  }

  const competencyPenalties = {};
  for (const compId of Object.keys(scoringData.competencies)) {
    competencyPenalties[compId] = 0;
  }

  const repeatedTags = [];
  const penaltyPerRepeat = scoringData.repeatedTagPenalty || 2;
  const maxPenaltyPerComp = scoringData.maxTagPenaltyPerCompetency || 4;

  for (const [tag, count] of Object.entries(tagCounts)) {
    if (count >= 2) {
      const repeats = count - 1;
      const targetComp = ERROR_TAG_COMPETENCY_MAP[tag] || 'C1';
      const rawPenalty = repeats * penaltyPerRepeat;
      const appliedPenalty = Math.min(
        rawPenalty,
        Math.max(0, maxPenaltyPerComp - competencyPenalties[targetComp])
      );
      competencyPenalties[targetComp] += appliedPenalty;

      repeatedTags.push({
        tag,
        description: scoringData.errorTags[tag] || tag,
        count,
        repeats,
        targetCompetency: targetComp,
        penaltyApplied: appliedPenalty
      });
    }
  }

  // Normalizace každé kompetence na škálu 0–100 a přiřazení pásma
  const competencyResults = {};
  for (const [compId, compMeta] of Object.entries(scoringData.competencies)) {
    const earned = Math.min(compMeta.maxPoints, rawCompetencyEarned[compId]);
    const normalizedBeforePenalty =
      compMeta.maxPoints > 0 ? (earned / compMeta.maxPoints) * 100 : 0;
    const penalty = competencyPenalties[compId] || 0;
    const finalScore = Math.max(0, round1(normalizedBeforePenalty - penalty));

    const band =
      scoringData.competencyBands.find(
        (b) => finalScore >= b.min && finalScore <= b.max
      ) || scoringData.competencyBands[0];

    competencyResults[compId] = {
      id: compId,
      name: compMeta.name,
      description: compMeta.description,
      earnedPoints: earned,
      maxPoints: compMeta.maxPoints,
      rawNormalized: round1(normalizedBeforePenalty),
      penalty,
      score: finalScore,
      bandId: band.id,
      bandLabel: band.label
    };
  }

  const totalMaxPoints = scoringData.totalMaxPoints || 205;
  const clampedTotalEarned = Math.min(totalMaxPoints, totalPointsEarned);
  const totalPercentage = round1((clampedTotalEarned / totalMaxPoints) * 100);

  // Určení celkové známky a aplikace zvláštního pravidla vyrovnaného profilu
  let matchedGrade =
    scoringData.grades.find((g) => totalPercentage >= g.minPct) ||
    scoringData.grades[scoringData.grades.length - 1];
  let downgraded = false;

  if (matchedGrade.specialRule) {
    const scores = Object.values(competencyResults).map((c) => c.score);
    const countAbove75 = scores.filter((s) => s >= 75).length;
    const minScore = Math.min(...scores);

    const meetsRule =
      countAbove75 >= matchedGrade.specialRule.minCompetenciesAbove75 &&
      minScore >= matchedGrade.specialRule.minAnyCompetency;

    if (!meetsRule) {
      const fallback = scoringData.grades.find(
        (g) => g.id === matchedGrade.specialRule.fallbackGradeId
      );
      if (fallback) {
        matchedGrade = fallback;
        downgraded = true;
      }
    }
  }

  // Statistika využití nápověd
  let totalHintsUsed = 0;
  for (const stepState of Object.values(state.steps)) {
    if (stepState && typeof stepState.hintsUsed === 'number') {
      totalHintsUsed += stepState.hintsUsed;
    }
  }

  return {
    totalEarned: clampedTotalEarned,
    totalMaxPoints,
    totalPercentage,
    gradeId: matchedGrade.id,
    gradeLabel: matchedGrade.label,
    downgraded,
    competencies: competencyResults,
    tagCounts,
    repeatedTags,
    totalHintsUsed,
    highlightUsageCount: state.highlightUsageCount || 0
  };
}
