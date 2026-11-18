/**
 * tests/simulate.mjs
 * Automatizovaná verifikace datových souborů a simulace kompletních průchodů kampaní v Node.js.
 * Spuštění: node tests/simulate.mjs
 */

import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Mock prohlížečového prostředí (window.localStorage) před importem herních modulů
const memoryStorage = new Map();
globalThis.window = {
  localStorage: {
    getItem(key) {
      return memoryStorage.has(key) ? memoryStorage.get(key) : null;
    },
    setItem(key, val) {
      memoryStorage.set(key, String(val));
    },
    removeItem(key) {
      memoryStorage.delete(key);
    },
    clear() {
      memoryStorage.clear();
    }
  }
};

const { GameEngine } = await import('../js/game-engine.js');
const { ERROR_TAG_COMPETENCY_MAP } = await import('../js/scoring.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../data');

async function loadJson(filename) {
  const fullPath = path.join(DATA_DIR, filename);
  const raw = await readFile(fullPath, 'utf-8');
  return JSON.parse(raw);
}

async function loadGameData() {
  const [
    chapters,
    questions,
    final,
    documents,
    institutions,
    scoring,
    assessment
  ] = await Promise.all([
    loadJson('chapters.json'),
    loadJson('questions.json'),
    loadJson('final.json'),
    loadJson('documents.json'),
    loadJson('institutions.json'),
    loadJson('scoring.json'),
    loadJson('assessment.json')
  ]);

  return {
    chapters,
    questions,
    final,
    documents,
    institutions,
    scoring,
    assessment
  };
}

/**
 * Topologicky seřadí argumenty pro oddíl SEC5 podle pravidel orderingRules.
 */
function sortArgumentsByRules(argIds, orderingRules) {
  const result = [...argIds];
  let changed = true;
  let guard = 0;

  while (changed && guard < 50) {
    changed = false;
    guard += 1;
    for (const rule of orderingRules || []) {
      const idxBefore = result.indexOf(rule.before);
      const idxAfter = result.indexOf(rule.after);
      if (idxBefore !== -1 && idxAfter !== -1 && idxBefore > idxAfter) {
        result.splice(idxBefore, 1);
        const newIdxAfter = result.indexOf(rule.after);
        result.splice(newIdxAfter, 0, rule.before);
        changed = true;
      }
    }
  }
  return result;
}

/**
 * Test 1: Kontrola referenční integrity všech sedmi JSON souborů.
 */
function testDataIntegrity(data) {
  const docIds = new Set(Object.keys(data.documents.documents || {}));
  const instIds = new Set((data.institutions.institutions || []).map((i) => i.id));
  const errorTagKeys = new Set(Object.keys(data.scoring.errorTags || {}));

  for (const ch of data.chapters.chapters) {
    for (const dId of ch.initialDocs || []) {
      assert.ok(docIds.has(dId), `Kapitola ${ch.id} odkazuje na neexistující initialDoc: ${dId}`);
    }
    for (const cDoc of ch.conditionalDocs || []) {
      assert.ok(docIds.has(cDoc.docId), `Kapitola ${ch.id} odkazuje na neexistující conditionalDoc: ${cDoc.docId}`);
    }
    for (const iId of ch.initialInstitutions || []) {
      assert.ok(instIds.has(iId), `Kapitola ${ch.id} odkazuje na neexistující initialInstitution: ${iId}`);
    }
    for (const stepId of ch.stepIds) {
      const exists =
        stepId === 'ARG' ||
        stepId === 'POD' ||
        Boolean(data.questions[stepId]);
      assert.ok(exists, `Kapitola ${ch.id} obsahuje neznámý stepId: ${stepId}`);
    }
  }

  for (const [qId, qDef] of Object.entries(data.questions)) {
    if (qDef.highlightDocId) {
      assert.ok(docIds.has(qDef.highlightDocId), `Otázka ${qId} má neplatný highlightDocId: ${qDef.highlightDocId}`);
    }
    for (const dId of qDef.relatedDocs || []) {
      assert.ok(docIds.has(dId), `Otázka ${qId} má neplatný relatedDoc: ${dId}`);
    }
    for (const opt of qDef.options || []) {
      for (const uDoc of opt.unlockDocs || []) {
        assert.ok(docIds.has(uDoc), `Otázka ${qId} (${opt.id}) odemyká neexistující dokument: ${uDoc}`);
      }
      for (const uInst of opt.unlockInstitutions || []) {
        assert.ok(instIds.has(uInst), `Otázka ${qId} (${opt.id}) odemyká neexistující instituci: ${uInst}`);
      }
      if (opt.tag) {
        assert.ok(errorTagKeys.has(opt.tag), `Otázka ${qId} (${opt.id}) používá neznámý chybový štítek: ${opt.tag}`);
        assert.ok(
          Object.prototype.hasOwnProperty.call(ERROR_TAG_COMPETENCY_MAP, opt.tag),
          `Chybový štítek ${opt.tag} nemá mapování v ERROR_TAG_COMPETENCY_MAP`
        );
      }
    }
  }

  console.log('✓ Test 1: Referenční integrita všech 7 datových souborů JSON prošla bez chyb.');
}

/**
 * Test 2: Optimální průchod celou kampaní (Cíl: maximální bodový zisk a klasifikace Výtečně).
 */
function testOptimalPlaythrough(data) {
  memoryStorage.clear();
  const engine = new GameEngine(data);
  engine.setScreen('game');

  const chapters = data.chapters.chapters;
  let safetyCounter = 0;

  while (engine.state.screen === 'game' && safetyCounter < 200) {
    safetyCounter += 1;
    const chapter = engine.getChapter(engine.state.currentChapterId);
    const effectiveSteps = engine.getEffectiveStepIds(chapter.id);
    const stepId = effectiveSteps[engine.state.currentStepIndex];
    const stepDef = engine.getStepDefinition(stepId);

    if (stepDef.type === 'E' || stepDef.type === 'R') {
      const correctOpt = stepDef.options.find((o) => o.correct);
      assert.ok(correctOpt, `Chybí správná odpověď u kroku ${stepId}`);
      engine.submitChoiceAnswer(stepId, correctOpt.id);
      assert.equal(engine.state.steps[stepId].correct, true);
    } else if (stepDef.type === 'S') {
      // Vybrat variantu s nejvyšší efektivní úrovní
      let bestOpt = stepDef.options[0];
      let bestLevel = -1;
      for (const opt of stepDef.options) {
        let lvl = opt.level ?? 0;
        if (opt.levelByCondition) {
          for (const [depId, map] of Object.entries(opt.levelByCondition)) {
            const chosen = engine.state.steps[depId]?.selectedOptionId;
            if (chosen && Object.prototype.hasOwnProperty.call(map, chosen)) {
              lvl = map[chosen];
            }
          }
        }
        if (lvl > bestLevel) {
          bestLevel = lvl;
          bestOpt = opt;
        }
      }
      engine.confirmStrategicDecision(stepId, bestOpt.id);
    } else if (stepDef.type === 'N') {
      const bestOpt = [...stepDef.options].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
      engine.confirmRemedialDecision(stepId, bestOpt.id);
    } else if (stepDef.type === 'A') {
      const available = engine.getAvailableFinalArguments();
      const positiveIds = available.filter((a) => a.weight > 0).map((a) => a.id);
      engine.confirmArgumentsSelection(positiveIds);
    } else if (stepDef.type === 'P') {
      const payload = {};
      const s6Choice = engine.state.steps.S6?.selectedOptionId;

      for (const sec of stepDef.sections) {
        if (sec.id === 'SEC5') {
          const selectedArgs = engine.state.steps.ARG?.selectedIds || [];
          payload.SEC5 = sortArgumentsByRules(selectedArgs, sec.orderingRules);
        } else if (sec.id === 'SEC6') {
          const matchingOpt =
            sec.options.find((o) => o.consistentWithS6 === s6Choice) || sec.options[0];
          payload.SEC6 = matchingOpt.id;
        } else {
          const bestSecOpt = [...sec.options].sort((a, b) => (b.points || 0) - (a.points || 0))[0];
          payload[sec.id] = bestSecOpt.id;
        }
      }
      engine.confirmPleadingSubmission(payload);
    }

    engine.advanceStep();
  }

  assert.equal(engine.state.screen, 'assessment', 'Po poslední kapitole musí přejít na obrazovku posudku.');
  assert.equal(engine.state.completedChapters.length, chapters.length, 'Všechny kapitoly musí být dokončeny.');

  const report = engine.getAssessmentReport();
  assert.ok(report.results.totalPercentage >= 95, `Očekávána úspěšnost >= 95 %, získáno ${report.results.totalPercentage} %`);
  assert.equal(report.results.gradeId, 'vyborne', `Očekávána známka vyborne, získáno ${report.results.gradeId}`);
  assert.equal(report.competencyNarratives.length, 8, 'Posudek musí obsahovat všech 8 kompetencí.');

  console.log(
    `✓ Test 2: Optimální průchod kampaní dokončen (${report.results.totalEarned}/${report.results.totalMaxPoints} b., ${report.results.totalPercentage} %, klasifikace: ${report.results.gradeLabel}).`
  );
}

/**
 * Test 3: Suboptimální průchod s aktivací nápravných kroků N3/N4, nápovědami, chybovými štítky a obnovou z LocalStorage.
 */
function testRemedialAndPersistencePlaythrough(data) {
  memoryStorage.clear();
  const engine = new GameEngine(data);
  engine.setScreen('game');

  let remedialTriggeredCount = 0;
  let safetyCounter = 0;

  while (engine.state.screen === 'game' && safetyCounter < 200) {
    safetyCounter += 1;
    const chapter = engine.getChapter(engine.state.currentChapterId);
    const effectiveSteps = engine.getEffectiveStepIds(chapter.id);
    const stepId = effectiveSteps[engine.state.currentStepIndex];
    const stepDef = engine.getStepDefinition(stepId);

    if (stepDef.type === 'E' || stepDef.type === 'R') {
      // Vyžádat nápovědu a na 1. pokus zvolit nesprávnou odpověď pro ověření penalizací a pokusů
      if (Array.isArray(stepDef.hints) && stepDef.hints.length > 0) {
        engine.requestHint(stepId);
      }
      const wrongOpt = stepDef.options.find((o) => !o.correct);
      const correctOpt = stepDef.options.find((o) => o.correct);
      if (wrongOpt) {
        engine.submitChoiceAnswer(stepId, wrongOpt.id);
      }
      engine.submitChoiceAnswer(stepId, correctOpt.id);
    } else if (stepDef.type === 'S') {
      // U S3 a S4 zvolit variantu aktivující nápravný krok N3 / N4
      const remedialId = stepId === 'S3' ? 'N3' : stepId === 'S4' ? 'N4' : null;
      const remedialCond = remedialId ? data.questions[remedialId]?.if?.[stepId] : null;
      let chosenOpt = stepDef.options[0];
      if (Array.isArray(remedialCond) && remedialCond.length > 0) {
        chosenOpt = stepDef.options.find((o) => remedialCond.includes(o.id)) || chosenOpt;
      }
      engine.confirmStrategicDecision(stepId, chosenOpt.id);
    } else if (stepDef.type === 'N') {
      remedialTriggeredCount += 1;
      const repairOpt = stepDef.options.find((o) => (o.points || 0) > 0) || stepDef.options[0];
      engine.confirmRemedialDecision(stepId, repairOpt.id);
    } else if (stepDef.type === 'A') {
      const available = engine.getAvailableFinalArguments();
      const ids = available.filter((a) => a.weight > 0).map((a) => a.id);
      engine.confirmArgumentsSelection(ids);
    } else if (stepDef.type === 'P') {
      const payload = {};
      for (const sec of stepDef.sections) {
        if (sec.id === 'SEC5') {
          payload.SEC5 = [...(engine.state.steps.ARG?.selectedIds || [])];
        } else {
          payload[sec.id] = sec.options[0].id;
        }
      }
      engine.confirmPleadingSubmission(payload);
    }

    engine.advanceStep();
  }

  assert.ok(remedialTriggeredCount >= 1, 'Suboptimální strategie v S3/S4 musí aktivovat alespoň jeden nápravný krok N3/N4.');

  // Ověření obnovení uloženého stavu v nové instanci GameEngine
  const restoredEngine = new GameEngine(data);
  assert.equal(restoredEngine.state.screen, 'assessment');
  assert.equal(
    restoredEngine.getResults().totalEarned,
    engine.getResults().totalEarned,
    'Obnovený stav z LocalStorage musí mít shodný bodový zisk.'
  );

  const report = restoredEngine.getAssessmentReport();
  assert.ok(report.results.totalHintsUsed > 0, 'Statistika musí zaznamenat využité nápovědy.');

  console.log(
    `✓ Test 3: Nápravné větve (aktivováno ${remedialTriggeredCount}× N3/N4), chybové štítky i obnova z LocalStorage prošly (${report.results.totalEarned}/${report.results.totalMaxPoints} b., známka: ${report.results.gradeLabel}).`
  );
}

async function run() {
  console.log('Spouštím automatizovanou verifikaci simulace „L’état, c’est moi – anebo ne?“...\n');
  const data = await loadGameData();
  testDataIntegrity(data);
  testOptimalPlaythrough(data);
  testRemedialAndPersistencePlaythrough(data);
  console.log('\nVšechny automatizované testy proběhly úspěšně.');
}

run().catch((err) => {
  console.error('\n✗ Selhání automatizovaného testu:', err);
  process.exit(1);
});
