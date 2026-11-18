/**
 * assessment.js
 * Sestavení individualizovaného akademického posudku po dokončení 6. kapitoly.
 */

import { computeFinalResults } from './scoring.js';

/**
 * Vygeneruje kompletní datovou strukturu závěrečného akademického posudku.
 * @param {Object} state - Celý stav hry
 * @param {Object} data - Načtená herní data { scoring, assessment, chapters, questions, final }
 * @returns {Object} Strukturovaný akademický posudek připravený pro zobrazení i tisk/PDF
 */
export function buildAcademicAssessment(state, data) {
  const results = computeFinalResults(state, data.scoring);
  const assessmentCfg = data.assessment;

  // 1. Úvodní celkové zhodnocení
  const introParagraph = assessmentCfg.overallIntro[results.gradeId] || '';
  const downgradeNote = results.downgraded ? assessmentCfg.overallIntro.downgradeNote : null;

  // 2. Slovní hodnocení všech osmi kompetencí
  const competencyNarratives = Object.values(results.competencies).map((comp) => {
    const cfg = assessmentCfg.competencyFeedback[comp.id];
    const template = cfg ? cfg[comp.bandId] || '' : '';
    const formattedText = template.replace('{score}', String(comp.score));

    return {
      ...comp,
      narrative: formattedText,
      recommendation: cfg ? cfg.recommendation : ''
    };
  });

  // 3. Zhodnocení strategických rozhodnutí S1–S6
  const strategicIds = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6'];
  const s5Choice = state.steps.S5?.selectedOptionId;
  const hasCorridorProtocol = s5Choice === 'B' || s5Choice === 'D';

  const strategicNarratives = [];
  for (const sId of strategicIds) {
    const stepState = state.steps[sId];
    if (!stepState || !stepState.selectedOptionId) continue;

    const qDef = data.questions[sId];
    const chosenOpt = qDef?.options?.find((o) => o.id === stepState.selectedOptionId);

    let evalText = '';
    if (sId === 'S6') {
      const branchKey = hasCorridorProtocol ? 'S6_with_docs' : 'S6_without_docs';
      evalText = assessmentCfg.strategicEvaluations[branchKey]?.[stepState.selectedOptionId] || '';
    } else {
      evalText = assessmentCfg.strategicEvaluations[sId]?.[stepState.selectedOptionId] || '';
    }

    strategicNarratives.push({
      id: sId,
      title: qDef ? qDef.title : sId,
      selectedOptionId: stepState.selectedOptionId,
      selectedOptionText: chosenOpt ? chosenOpt.text : '',
      level: stepState.level,
      pointsEarned: stepState.pointsEarned,
      evaluation: evalText
    });
  }

  // 4. Zhodnocení nápravných kroků N3 a N4 (pokud k nim došlo)
  const remedialNarratives = [];
  if (state.steps.N3 && state.steps.N3.selectedOptionId) {
    const repaired = state.steps.N3.selectedOptionId === 'B';
    remedialNarratives.push({
      id: 'N3',
      title: data.questions.N3?.title || 'Nápravný krok N3',
      repaired,
      evaluation: repaired
        ? assessmentCfg.remedialEvaluations.N3_repaired
        : assessmentCfg.remedialEvaluations.N3_unrepaired
    });
  }

  if (state.steps.N4 && state.steps.N4.selectedOptionId) {
    const repaired = state.steps.N4.selectedOptionId === 'B';
    remedialNarratives.push({
      id: 'N4',
      title: data.questions.N4?.title || 'Nápravný krok N4',
      repaired,
      evaluation: repaired
        ? assessmentCfg.remedialEvaluations.N4_repaired
        : assessmentCfg.remedialEvaluations.N4_unrepaired
    });
  }

  // 5. Analytická poznámka ke způsobu práce s prameny a nápovědami
  const hintsUsed = results.totalHintsUsed ?? 0;
  const highlightUsed = results.highlightUsageCount ?? state.highlightUsageCount ?? 0;

  let studyMethodNote = '';
  if (hintsUsed === 0 && highlightUsed === 0) {
    studyMethodNote =
      'Během celé kampaně jsi nevyužil žádnou nápovědu právního poradce ani funkci zvýraznění pasáží v právních pramenech; všechna rozhodnutí jsi činil samostatně.';
  } else {
    studyMethodNote = `Během simulace jsi celkem ${hintsUsed}× využil nápovědu právního poradce dr. Kellera a ${highlightUsed}× funkci zvýraznění relevantních pasáží v archivu. Tyto podpůrné nástroje nijak nesnížily tvůj bodový zisk.`;
  }

  return {
    meta: {
      title: data.chapters.meta.title,
      country: data.chapters.meta.officialCountryName,
      generatedAt: new Date().toISOString()
    },
    results,
    introParagraph,
    downgradeNote,
    competencyNarratives,
    strategicNarratives,
    remedialNarratives,
    studyMethodNote
  };
}
