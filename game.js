(() => {
  "use strict";

  const STORAGE_KEY = "sugar_merchant_jihoon_records_v1";
  const INTRO_SEEN_KEY = "sugar_merchant_jihoon_intro_seen_v1";

  // =========================
  // 효과음 합성기 (Web Audio API - 외부 파일 불필요)
  // =========================
  class SoundFX {
    constructor() {
      this.enabled = true;
      this.ctx = null;
    }

    init() {
      if (!this.ctx) {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
    }

    tone(freq, duration = 0.12, type = "sine", gainVal = 0.12, delay = 0) {
      if (!this.enabled) return;
      this.init();
      if (!this.ctx) return;

      const now = this.ctx.currentTime + delay;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    pickup() {
      this.tone(520, 0.08, "triangle", 0.1);
    }

    drop() {
      this.tone(320, 0.1, "sine", 0.12);
    }

    balanced() {
      this.tone(523.25, 0.12, "triangle", 0.11, 0);
      this.tone(659.25, 0.16, "triangle", 0.12, 0.09);
    }

    invalidRule3() {
      this.tone(210, 0.18, "sawtooth", 0.11, 0);
      this.tone(165, 0.25, "sawtooth", 0.11, 0.14);
    }

    correct() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        this.tone(n, 0.2, "triangle", 0.14, idx * 0.09);
      });
    }

    wrong() {
      this.tone(260, 0.16, "sine", 0.12, 0);
      this.tone(210, 0.22, "sine", 0.12, 0.14);
    }

    timeover() {
      this.tone(330, 0.25, "sawtooth", 0.15, 0);
      this.tone(293.66, 0.25, "sawtooth", 0.15, 0.18);
      this.tone(261.63, 0.45, "sawtooth", 0.16, 0.36);
    }
  }

  const sfx = new SoundFX();

  // 각 난이도(스테이지)별 타임어택 제한 시간 (초)
  const STAGE_LIMITS = {
    basic: 40, // 기초단계: 40초
    standard: 60, // 기본(표준): 1분(60초)
    challenge: 80, // 심화: 1분 20초(80초)
  };

  // =========================
  // 수학 & 수식 포맷 유틸리티
  // =========================
  function gcd(a, b) {
    let x = Math.abs(a);
    let y = Math.abs(b);
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  function gcd4(a, b, c, d) {
    return gcd(gcd(a, b), gcd(c, d));
  }

  function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function formatExpr(sacks, bags) {
    const parts = [];
    if (sacks > 0) {
      parts.push(sacks === 1 ? "x" : `${sacks}x`);
    }
    if (bags > 0) {
      parts.push(`${bags}`);
    }
    if (parts.length === 0) {
      return "0";
    }
    return parts.join(" + ");
  }

  function formatEquation(st) {
    return `${formatExpr(st.a, st.b)} = ${formatExpr(st.c, st.d)}`;
  }

  function summarizeItems(sacks, bags) {
    if (sacks === 0 && bags === 0) return "비어 있음 (0 kg)";
    const arr = [];
    if (sacks > 0) arr.push(`포대 ${sacks}개`);
    if (bags > 0) arr.push(`1kg 봉지 ${bags}개`);
    return arr.join(" · ");
  }

  // =========================
  // 저장소 기록 로드 / 저장
  // =========================
  function defaultRecords() {
    return {
      correctCount: 0,
      totalSubmissions: 0,
      totalSolveTimeSec: 0,
      bestTimeSec: null,
      rule3Violations: 0,
      history: [],
    };
  }

  function loadRecords() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultRecords();
      const parsed = JSON.parse(raw);
      return {
        ...defaultRecords(),
        ...parsed,
        history: Array.isArray(parsed.history) ? parsed.history : [],
      };
    } catch {
      return defaultRecords();
    }
  }

  function saveRecords(records) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
    } catch {
      // 저장 공간 제한 시 무시
    }
  }

  // 각 스테이지 당 총 문제 수 (5문제 챌린지)
  const STAGE_TOTAL_QUESTIONS = 5;

  // =========================
  // 게임 상태
  // =========================
  const state = {
    difficulty: "standard", // 'basic' | 'standard' | 'challenge'
    lastEquationKey: "",

    // 스테이지 5문제 진행 상태 & 점수 관리
    stageQuestionIndex: 1, // 1 ~ 5
    currentScore: 0,       // 현재 누적 점수
    stageCorrectCount: 0,  // 이번 스테이지 5문제 중 정답 맞힌 개수
    stageTotalSolveTimeSec: 0, // 이번 스테이지 5문제 총 소요 시간
    stageTotalSteps: 0,    // 이번 스테이지 5문제 총 조작 단계
    lastRoundResult: null, // 이번 문제 채점/타임오버 상세 결과
    lastCompletedStageEntry: null, // 5문제 완주 시 랭킹 등록용 최종 기록

    problem: {
      initA: 3,
      initB: 2,
      initC: 1,
      initD: 8,
      x: 3,
    },

    // 마지막으로 균형이 확정된 단계 상태
    checkpoint: { a: 3, b: 2, c: 1, d: 8 },
    // 현재 화면에 놓인 실시간 상태
    current: { a: 3, b: 2, c: 1, d: 8 },

    // 마지막 조작 종류 ('remove-bag' | 'remove-sack' | 'add-bag' | 'add-sack' | 'mixed' | null)
    pendingCategory: null,

    steps: [], // { rule: 'r1'|'r2'|'r3'|'r4', ruleLabel, desc, eq }
    isSolved: false,
    isTimeOver: false,
    hasStarted: false, // 맨 처음 '출발하기' 버튼을 누른 후 true가 됨
    isPaused: false,   // 모달 열림 시 일시정지

    // 타임어택 타이머 관련
    totalTimeSec: 60,
    remainingSec: 60,
    startTimeMs: Date.now(),
    elapsedSec: 0,
    timerInterval: null,

    // 영구 학습 기록
    records: loadRecords(),
  };

  // =========================
  // DOM 참조
  // =========================
  const el = {
    currentTimer: document.getElementById("currentTimer"),
    timerPill: document.getElementById("timerPill"),
    timerGaugeFill: document.getElementById("timerGaugeFill"),
    statQuestionProg: document.getElementById("statQuestionProg"),
    statCurrentScore: document.getElementById("statCurrentScore"),
    statCorrectCount: document.getElementById("statCorrectCount"),

    btnOpenMission: document.getElementById("btnOpenMission"),
    btnStartMission: document.getElementById("btnStartMission"),
    btnOpenRanking: document.getElementById("btnOpenRanking"),
    btnOpenRecords: document.getElementById("btnOpenRecords"),
    btnToggleSound: document.getElementById("btnToggleSound"),

    diffTabs: document.querySelectorAll(".diff-tab"),
    btnNewProblem: document.getElementById("btnNewProblem"),
    btnResetCurrent: document.getElementById("btnResetCurrent"),

    initialEquationText: document.getElementById("initialEquationText"),
    currentEquationText: document.getElementById("currentEquationText"),

    balanceStatusBar: document.getElementById("balanceStatusBar"),
    balanceStatusIcon: document.getElementById("balanceStatusIcon"),
    balanceStatusText: document.getElementById("balanceStatusText"),
    pendingDeltaBadge: document.getElementById("pendingDeltaBadge"),
    btnCancelPending: document.getElementById("btnCancelPending"),
    btnConfirmStep: document.getElementById("btnConfirmStep"),

    leftWeightCard: document.getElementById("leftWeightCard"),
    rightWeightCard: document.getElementById("rightWeightCard"),
    leftItemSummary: document.getElementById("leftItemSummary"),
    rightItemSummary: document.getElementById("rightItemSummary"),
    leftWeightExpr: document.getElementById("leftWeightExpr"),
    rightWeightExpr: document.getElementById("rightWeightExpr"),
    leftDeltaText: document.getElementById("leftDeltaText"),
    rightDeltaText: document.getElementById("rightDeltaText"),
    equalitySymbolBox: document.getElementById("equalitySymbolBox"),
    equalitySymbol: document.getElementById("equalitySymbol"),
    balanceStateMini: document.getElementById("balanceStateMini"),

    scaleArena: document.getElementById("scaleArena"),
    beamAssembly: document.getElementById("beamAssembly"),
    leftTray: document.getElementById("leftTray"),
    rightTray: document.getElementById("rightTray"),
    leftTrayItems: document.getElementById("leftTrayItems"),
    rightTrayItems: document.getElementById("rightTrayItems"),
    leftEmptyHint: document.getElementById("leftEmptyHint"),
    rightEmptyHint: document.getElementById("rightEmptyHint"),

    jihoonSpeech: document.getElementById("jihoonSpeech"),
    faceHappy: document.getElementById("faceHappy"),
    faceStrain: document.getElementById("faceStrain"),

    removeDropZone: document.getElementById("removeDropZone"),
    supplyTemplates: document.querySelectorAll(".supply-template"),

    ratioButtons: document.getElementById("ratioButtons"),
    btnDynamicDiv: document.getElementById("btnDynamicDiv"),

    isolatedBadge: document.getElementById("isolatedBadge"),
    answerForm: document.getElementById("answerForm"),
    answerInput: document.getElementById("answerInput"),
    inlineFeedback: document.getElementById("inlineFeedback"),

    stepCountBadge: document.getElementById("stepCountBadge"),
    stepsTimeline: document.getElementById("stepsTimeline"),

    missionModal: document.getElementById("missionModal"),
    gradingModal: document.getElementById("gradingModal"),
    recordsModal: document.getElementById("recordsModal"),
    timeoverModal: document.getElementById("timeoverModal"),
    timeoverSubText: document.getElementById("timeoverSubText"),
    timeoverAnswerHint: document.getElementById("timeoverAnswerHint"),
    timeoverPenaltyBadge: document.getElementById("timeoverPenaltyBadge"),
    btnNextTimeover: document.getElementById("btnNextTimeover"),

    // 🏆 랭킹보드 모달 및 관련 요소
    rankingModal: document.getElementById("rankingModal"),
    rankingTabs: document.querySelectorAll(".ranking-tab"),
    cloudStatusPill: document.getElementById("cloudStatusPill"),
    cloudStatusText: document.getElementById("cloudStatusText"),
    btnRefreshRanking: document.getElementById("btnRefreshRanking"),
    rankingTableBody: document.getElementById("rankingTableBody"),
    btnPlayFromRanking: document.getElementById("btnPlayFromRanking"),

    // 채점 모달 내 요소
    gradeHeroBox: document.getElementById("gradeHeroBox"),
    gradeScoreCard: document.getElementById("gradeScoreCard"),
    myGradeSteps: document.getElementById("myGradeSteps"),
    modelGradeSteps: document.getElementById("modelGradeSteps"),
    btnNextProblemModal: document.getElementById("btnNextProblemModal"),
    btnOpenRankingFromGrading: document.getElementById("btnOpenRankingFromGrading"),

    // 🏆 [신규] 스테이지 5문제 완주 최종 결과 모달
    stageClearModal: document.getElementById("stageClearModal"),
    stageFinalScore: document.getElementById("stageFinalScore"),
    stageScoreFormula: document.getElementById("stageScoreFormula"),
    stageCorrectStats: document.getElementById("stageCorrectStats"),
    stageAccuracyText: document.getElementById("stageAccuracyText"),
    stageTotalTimeText: document.getElementById("stageTotalTimeText"),
    stageAvgTimeText: document.getElementById("stageAvgTimeText"),
    stageTotalStepsText: document.getElementById("stageTotalStepsText"),
    stageDiffBadge: document.getElementById("stageDiffBadge"),
    stageRankingCard: document.getElementById("stageRankingCard"),
    stageRankDiffBadge: document.getElementById("stageRankDiffBadge"),
    stageRankSubmitForm: document.getElementById("stageRankSubmitForm"),
    stageRankNicknameInput: document.getElementById("stageRankNicknameInput"),
    btnSubmitStageScore: document.getElementById("btnSubmitStageScore"),
    stageRankSubmitResult: document.getElementById("stageRankSubmitResult"),
    stageRankSuccessMsg: document.getElementById("stageRankSuccessMsg"),
    btnViewLeaderboardAfterSubmit: document.getElementById("btnViewLeaderboardAfterSubmit"),
    btnOpenLeaderboardFromClear: document.getElementById("btnOpenLeaderboardFromClear"),
    btnRestartStage: document.getElementById("btnRestartStage"),

    modalCorrectCount: document.getElementById("modalCorrectCount"),
    modalAttemptSub: document.getElementById("modalAttemptSub"),
    modalAvgTime: document.getElementById("modalAvgTime"),
    modalBestTimeSub: document.getElementById("modalBestTimeSub"),
    modalAccuracy: document.getElementById("modalAccuracy"),
    modalRule3Sub: document.getElementById("modalRule3Sub"),
    historyTableBody: document.getElementById("historyTableBody"),
    btnResetRecords: document.getElementById("btnResetRecords"),

    rule3Alert: document.getElementById("rule3Alert"),
    rule3AlertDesc: document.getElementById("rule3AlertDesc"),
  };

  let rule3AlertTimer = null;

  // =========================
  // 랜덤 문제 생성기 (ax + b = cx + d)
  // =========================
  function generateProblem(diff = state.difficulty) {
    for (let attempt = 0; attempt < 40; attempt++) {
      let a, b, c, d, x;

      if (diff === "basic") {
        // 기초: ax + b = d (또는 d = ax + b)
        x = randInt(1, 5);
        a = randInt(2, 4);
        b = randInt(1, 5);
        c = 0;
        d = a * x + b;
        if (d > 14) continue;
      } else if (diff === "standard") {
        // 표준: ax + b = cx + d (양쪽 모두 포대와 1kg 봉지 존재!)
        x = randInt(1, 5);
        c = randInt(1, 3);
        const diffCoeff = randInt(1, 3);
        a = c + diffCoeff; // a > c
        b = randInt(1, 4);
        d = (a - c) * x + b;
        if (d > 12 || a > 5) continue;
      } else {
        // 심화: 큰 계수 또는 공약수 비율 활용 가능 문제
        x = randInt(2, 6);
        const useMultiple = Math.random() < 0.45;
        if (useMultiple) {
          const k = randInt(2, 3);
          const baseC = 1;
          const baseA = randInt(2, 3);
          const baseB = randInt(1, 2);
          const baseD = (baseA - baseC) * x + baseB;
          a = baseA * k;
          b = baseB * k;
          c = baseC * k;
          d = baseD * k;
        } else {
          c = randInt(1, 3);
          a = c + randInt(2, 4);
          b = randInt(1, 5);
          d = (a - c) * x + b;
        }
        if (d > 15 || a > 6) continue;
      }

      // 50% 확률로 좌우 대칭 교환 (ax + b = cx + d에서 a < c인 경우도 출제!)
      if (Math.random() < 0.5) {
        [a, c] = [c, a];
        [b, d] = [d, b];
      }

      const key = `${a},${b},${c},${d}`;
      if (key !== state.lastEquationKey) {
        state.lastEquationKey = key;
        return { initA: a, initB: b, initC: c, initD: d, x };
      }
    }

    return { initA: 3, initB: 2, initC: 1, initD: 8, x: 3 };
  }

  // =========================
  // 새 문제 시작 & 초기화
  // =========================
  function startNewProblem() {
    const prob = generateProblem(state.difficulty);
    state.problem = prob;
    resetToProblemStart(false);
  }

  function resetToProblemStart(keepTimer = false) {
    const { initA, initB, initC, initD } = state.problem;
    state.checkpoint = { a: initA, b: initB, c: initC, d: initD };
    state.current = { a: initA, b: initB, c: initC, d: initD };
    state.pendingCategory = null;
    state.steps = [];
    state.isSolved = false;
    state.isTimeOver = false;

    el.answerInput.value = "";
    el.answerInput.disabled = false;
    hideInlineFeedback();

    if (!keepTimer) {
      if (state.hasStarted) {
        startTimer();
      } else {
        // 아직 출발하기 버튼을 누르기 전: 타이머는 멈춘 상태로 준비 시간만 표시
        if (state.timerInterval) clearInterval(state.timerInterval);
        state.totalTimeSec = STAGE_LIMITS[state.difficulty] || 60;
        state.remainingSec = state.totalTimeSec;
        state.elapsedSec = 0;
        updateTimerDisplay();
      }
    }

    renderAll();
  }

  function startTimer() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.totalTimeSec = STAGE_LIMITS[state.difficulty] || 60;
    state.remainingSec = state.totalTimeSec;
    state.startTimeMs = Date.now();
    state.elapsedSec = 0;
    state.isTimeOver = false;
    state.isPaused = false;

    updateTimerDisplay();

    state.timerInterval = setInterval(() => {
      if (!state.hasStarted || state.isSolved || state.isTimeOver || state.isPaused) return;

      const elapsed = (Date.now() - state.startTimeMs) / 1000;
      state.remainingSec = Math.max(0, state.totalTimeSec - elapsed);
      state.elapsedSec = elapsed;

      updateTimerDisplay();

      if (state.remainingSec <= 0) {
        triggerTimeOver();
      }
    }, 100);
  }

  function pauseTimer() {
    if (!state.hasStarted || state.isSolved || state.isTimeOver) return;
    state.isPaused = true;
  }

  function resumeTimer() {
    if (!state.hasStarted || state.isSolved || state.isTimeOver || !state.isPaused) return;
    state.isPaused = false;
    // 남은 시간을 보존하도록 startTimeMs 재설정
    state.startTimeMs = Date.now() - (state.totalTimeSec - state.remainingSec) * 1000;
  }

  function launchMissionGame() {
    closeModal("missionModal");
    if (!state.hasStarted) {
      state.hasStarted = true;
      sfx.pickup();
      startTimer();
      el.jihoonSpeech.textContent = "좋아요! 어깨 균형을 유지하며 포대 무게를 알아내 봐요!";
    } else {
      resumeTimer();
    }
  }

  function updateTimerDisplay() {
    const rem = state.remainingSec;
    el.currentTimer.textContent = `${rem.toFixed(1)}초`;

    // 프로그레스 바 게이지
    const pct = Math.max(0, Math.min(100, (rem / state.totalTimeSec) * 100));
    if (el.timerGaugeFill) {
      el.timerGaugeFill.style.width = `${pct}%`;
    }

    // 10초 이하 긴박 위기 효과
    if (rem <= 10 && rem > 0 && !state.isSolved && !state.isTimeOver && state.hasStarted) {
      el.timerPill.classList.add("urgent");
    } else {
      el.timerPill.classList.remove("urgent");
    }
  }

  function triggerTimeOver() {
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.isTimeOver = true;
    state.remainingSec = 0;
    state.elapsedSec = state.totalTimeSec;
    state.stageTotalSolveTimeSec += state.totalTimeSec;
    updateTimerDisplay();

    sfx.timeover();
    el.answerInput.disabled = true;

    // 시간 내에 못 풀면 현재 점수의 30% 감점!
    const penalty = Math.round(state.currentScore * 0.3);
    const beforeScore = state.currentScore;
    state.currentScore = Math.max(0, beforeScore - penalty);

    if (el.statCurrentScore) {
      el.statCurrentScore.classList.remove("pulse-gain", "pulse-loss");
      void el.statCurrentScore.offsetWidth;
      el.statCurrentScore.classList.add("pulse-loss");
    }
    renderStats();

    // 타임오버 모달 안내 채우기
    const initEq = formatEquation({
      a: state.problem.initA,
      b: state.problem.initB,
      c: state.problem.initC,
      d: state.problem.initD,
    });

    const diffNames = {
      basic: "기초 단계 (40초)",
      standard: "기본 단계 (1분)",
      challenge: "심화 단계 (1분 20초)",
    };

    el.timeoverSubText.textContent = `${diffNames[state.difficulty] || "타임어택"}의 제한 시간(${state.totalTimeSec}초)이 모두 지났습니다!`;
    el.timeoverAnswerHint.innerHTML = `
      <div>출제 방정식: <strong>${initEq}</strong></div>
      <div style="margin-top:6px;color:#991b1b;font-weight:800;font-size:15px;">
        💡 이번 설탕 포대 1개(<span class="math-var">x</span>)의 정답은 <strong>${state.problem.x} kg</strong>이었습니다!
      </div>
    `;

    if (el.timeoverPenaltyBadge) {
      el.timeoverPenaltyBadge.innerHTML = `
        ⚠️ 시간 초과로 <b>현재 점수의 30% 감점(-${penalty}점)</b> 되었습니다!<br />
        <span style="font-size:12.5px;color:#b91c1c;margin-top:2px;display:inline-block;">(이전 ${beforeScore}점 ➔ 현재 ${state.currentScore}점)</span>
      `;
    }

    // 5문제째면 버튼 텍스트 변경
    if (el.btnNextTimeover) {
      if (state.stageQuestionIndex >= STAGE_TOTAL_QUESTIONS) {
        el.btnNextTimeover.textContent = "🏆 스테이지 최종 결과 확인하기 ➔";
      } else {
        el.btnNextTimeover.textContent = `🎲 다음 문제 (${state.stageQuestionIndex + 1}/${STAGE_TOTAL_QUESTIONS}) 도전하기 ➔`;
      }
    }

    openModal("timeoverModal");
  }

  // =========================
  // 균형 계산 & 단계 기록 로직
  // =========================
  function getWeights(st = state.current) {
    const x = state.problem.x;
    const leftKg = st.a * x + st.b;
    const rightKg = st.c * x + st.d;
    return {
      leftKg,
      rightKg,
      diff: rightKg - leftKg, // +면 오른쪽 무거움, -면 왼쪽 무거움
      balanced: leftKg === rightKg,
    };
  }

  function hasPendingChange() {
    const cp = state.checkpoint;
    const cur = state.current;
    return cp.a !== cur.a || cp.b !== cur.b || cp.c !== cur.c || cp.d !== cur.d;
  }

  function describePendingDelta() {
    const da = state.current.a - state.checkpoint.a;
    const db = state.current.b - state.checkpoint.b;
    const dc = state.current.c - state.checkpoint.c;
    const dd = state.current.d - state.checkpoint.d;

    const fmtSideDelta = (ds, dg) => {
      const parts = [];
      if (ds !== 0) parts.push(`포대 ${ds > 0 ? `+${ds}` : ds}개`);
      if (dg !== 0) parts.push(`봉지 ${dg > 0 ? `+${dg}` : dg}kg`);
      return parts.length ? parts.join(", ") : "변화 없음";
    };

    return {
      da,
      db,
      dc,
      dd,
      leftText: fmtSideDelta(da, db),
      rightText: fmtSideDelta(dc, dd),
    };
  }

  // 현재 균형이 맞고 변경점이 있을 때 풀이 단계로 확정 기록
  function commitBalancedStep() {
    if (!hasPendingChange()) return true;
    const { balanced } = getWeights(state.current);
    if (!balanced) return false;

    const { da, db, dc, dd } = describePendingDelta();
    let rule = "r1";
    let ruleLabel = "규칙 1";
    let desc = "";

    // 대칭적 제거 / 추가 판별
    if (da === dc && db === dd) {
      const isRemoval = da <= 0 && db <= 0;
      const isAddition = da >= 0 && db >= 0;

      if (isRemoval) {
        rule = "r1";
        ruleLabel = "규칙 1 · 제거";
        const parts = [];
        if (da < 0) parts.push(`설탕 포대 ${Math.abs(da)}개`);
        if (db < 0) parts.push(`1kg 봉지 ${Math.abs(db)}개`);
        desc = `양쪽에서 ${parts.join("와 ")}씩 제거`;
      } else if (isAddition) {
        rule = "r2";
        ruleLabel = "규칙 2 · 추가";
        const parts = [];
        if (da > 0) parts.push(`설탕 포대 ${da}개`);
        if (db > 0) parts.push(`1kg 봉지 ${db}개`);
        desc = `양쪽에 ${parts.join("와 ")}씩 추가`;
      } else {
        rule = "r1";
        ruleLabel = "규칙 1·2";
        desc = `양쪽에 동일한 무게 변화 적용`;
      }
    } else {
      // 포대와 1kg 봉지의 실제 동일 무게 교환/제거
      const netLeft = da * state.problem.x + db;
      if (netLeft < 0) {
        rule = "r1";
        ruleLabel = "규칙 1 · 제거";
        desc = `양쪽에서 동일한 무게(${Math.abs(netLeft)}kg 상당)의 설탕 제거`;
      } else if (netLeft > 0) {
        rule = "r2";
        ruleLabel = "규칙 2 · 추가";
        desc = `양쪽에 동일한 무게(${netLeft}kg 상당)의 설탕 추가`;
      } else {
        rule = "r1";
        ruleLabel = "등식 유지";
        desc = `양쪽 균형을 유지하며 구성 조정`;
      }
    }

    state.checkpoint = { ...state.current };
    state.pendingCategory = null;

    state.steps.push({
      rule,
      ruleLabel,
      desc,
      eq: formatEquation(state.current),
    });

    return true;
  }

  // [규칙 3] 균형이 깨졌을 때 무효 처리 및 원상 복구!
  function triggerRule3Invalidation(reasonText) {
    sfx.invalidRule3();
    state.records.rule3Violations += 1;
    saveRecords(state.records);
    renderStats();

    const prevUnbalancedEq = formatEquation(state.current);

    // 이전 균형 상태(checkpoint)로 즉시 복원
    state.current = { ...state.checkpoint };
    state.pendingCategory = null;

    state.steps.push({
      rule: "r3",
      ruleLabel: "규칙 3 · 무효",
      desc: `균형 깨짐(${prevUnbalancedEq}) → 조작 무효 처리 후 복구`,
      eq: formatEquation(state.checkpoint),
      isInvalidLog: true,
    });

    // 흔들림 애니메이션
    el.scaleArena.classList.remove("shake-invalid");
    void el.scaleArena.offsetWidth;
    el.scaleArena.classList.add("shake-invalid");

    // 상단 경고 토스트 표시
    el.rule3AlertDesc.textContent =
      reasonText ||
      "양쪽 어깨의 무게가 달라 균형이 깨졌습니다! [규칙 3]에 따라 방금 조작은 무효가 되어 이전 균형 상태로 되돌아갑니다.";
    el.rule3Alert.classList.remove("hidden");

    if (rule3AlertTimer) clearTimeout(rule3AlertTimer);
    rule3AlertTimer = setTimeout(() => {
      el.rule3Alert.classList.add("hidden");
    }, 3400);

    renderAll();
  }

  // 다른 종류의 드래그를 시작할 때 이미 균형이 맞춰져 있으면 자동으로 이전 단계 기록
  function maybeAutoCommitBeforeAction(nextCategory) {
    if (!hasPendingChange()) return;
    const { balanced } = getWeights(state.current);
    if (balanced && state.pendingCategory && state.pendingCategory !== nextCategory) {
      commitBalancedStep();
    }
  }

  // =========================
  // [규칙 4] 동일 비율 덜기 / 추가하기
  // =========================
  function applyRatioOperation(op, factor) {
    if (state.isSolved || state.isTimeOver) return;

    const { balanced } = getWeights(state.current);
    if (!balanced) {
      triggerRule3Invalidation(
        "양쪽 어깨의 균형이 깨진 상태에서는 비율 조작을 할 수 없어요! [규칙 3]에 의해 불균형 조작이 무효 처리되었습니다."
      );
      return;
    }

    // 대기 중인 균형 조작이 있다면 먼저 단계 기록
    if (hasPendingChange()) {
      commitBalancedStep();
    }

    const { a, b, c, d } = state.current;
    if (a === 0 && b === 0 && c === 0 && d === 0) {
      showInlineFeedback("양쪽 바구니가 모두 비어 있어 비율을 조절할 수 없어요.");
      return;
    }

    if (op === "div") {
      if (a % factor !== 0 || b % factor !== 0 || c % factor !== 0 || d % factor !== 0) {
        sfx.wrong();
        el.scaleArena.classList.remove("shake-invalid");
        void el.scaleArena.offsetWidth;
        el.scaleArena.classList.add("shake-invalid");
        showInlineFeedback(
          `현재 상태(${formatEquation(state.current)})는 ${factor}로 똑같이 나누어떨어지지 않아요! 먼저 1kg 봉지나 포대를 덜어 정리해 보세요.`
        );
        return;
      }

      hideInlineFeedback();
      state.current = {
        a: a / factor,
        b: b / factor,
        c: c / factor,
        d: d / factor,
      };
      state.checkpoint = { ...state.current };
      state.pendingCategory = null;

      const remainText = factor === 2 ? "절반(1/2)" : `1/${factor}`;
      state.steps.push({
        rule: "r4",
        ruleLabel: `규칙 4 · ÷${factor}`,
        desc: `양쪽 설탕을 동일한 비율로 덜어 ${remainText}씩 남김`,
        eq: formatEquation(state.current),
      });

      sfx.balanced();
      renderAll();
    } else if (op === "mul") {
      const nextLeftTotal = (a + b) * factor;
      const nextRightTotal = (c + d) * factor;
      if (nextLeftTotal > 24 || nextRightTotal > 24) {
        sfx.wrong();
        showInlineFeedback("설탕이 너무 많아져 지훈이의 바구니가 넘쳐요! 더 이상 배수로 늘릴 수 없습니다.");
        return;
      }

      hideInlineFeedback();
      state.current = {
        a: a * factor,
        b: b * factor,
        c: c * factor,
        d: d * factor,
      };
      state.checkpoint = { ...state.current };
      state.pendingCategory = null;

      state.steps.push({
        rule: "r4",
        ruleLabel: `규칙 4 · ×${factor}`,
        desc: `양쪽에 동일한 비율(${factor}배)로 설탕 추가`,
        eq: formatEquation(state.current),
      });

      sfx.balanced();
      renderAll();
    }
  }

  // =========================
  // 모범(표준) 풀이 과정 자동 생성기 (조건 4 비교용)
  // =========================
  function buildModelSolution(prob) {
    let a = prob.initA;
    let b = prob.initB;
    let c = prob.initC;
    let d = prob.initD;
    const model = [
      {
        tag: "출제 식",
        desc: "양쪽 어깨의 초기 균형 상태",
        eq: formatEquation({ a, b, c, d }),
      },
    ];

    // 1) 양쪽 모두 포대가 있으면 작은 쪽 포대 수만큼 제거 (규칙 1)
    const minSack = Math.min(a, c);
    if (minSack > 0) {
      a -= minSack;
      c -= minSack;
      model.push({
        tag: "[규칙 1] 같은 무게 제거",
        desc: `양쪽에서 설탕 포대 ${minSack}개(${minSack === 1 ? "x" : `${minSack}x`})씩 제거`,
        eq: formatEquation({ a, b, c, d }),
      });
    }

    // 2) 포대가 남아 있는 쪽의 1kg 봉지를 제거 (규칙 1)
    if (a > 0 && b > 0) {
      const rem = b;
      b -= rem;
      d -= rem;
      model.push({
        tag: "[규칙 1] 같은 무게 제거",
        desc: `양쪽에서 1kg 설탕 봉지 ${rem}개(${rem}kg)씩 제거`,
        eq: formatEquation({ a, b, c, d }),
      });
    } else if (c > 0 && d > 0) {
      const rem = d;
      b -= rem;
      d -= rem;
      model.push({
        tag: "[규칙 1] 같은 무게 제거",
        desc: `양쪽에서 1kg 설탕 봉지 ${rem}개(${rem}kg)씩 제거`,
        eq: formatEquation({ a, b, c, d }),
      });
    }

    // 3) 남은 포대 개수로 등분하여 비율 덜어내기 (규칙 4)
    const coeff = a > 0 ? a : c;
    if (coeff > 1) {
      a /= coeff;
      b /= coeff;
      c /= coeff;
      d /= coeff;
      model.push({
        tag: `[규칙 4] 같은 비율 덜기 (÷${coeff})`,
        desc: `양쪽의 설탕을 똑같이 ${coeff}등분하여 1/${coeff}만 남김`,
        eq: formatEquation({ a, b, c, d }),
      });
    }

    return model;
  }

  // =========================
  // 자동 채점 처리 (조건 4 & 조건 5)
  // =========================
  function handleAnswerSubmit(e) {
    e.preventDefault();
    if (state.isSolved || state.isTimeOver) return;

    const { balanced } = getWeights(state.current);
    if (!balanced) {
      triggerRule3Invalidation(
        "양쪽 어깨의 균형이 무너진 상태에서는 정답을 제출할 수 없습니다! [규칙 3]에 따라 불균형 조작을 무효 처리합니다."
      );
      return;
    }

    const rawVal = el.answerInput.value.trim();
    const userX = Number(rawVal);
    if (!rawVal || !Number.isInteger(userX) || userX <= 0) {
      showInlineFeedback("설탕 포대 1개의 무게를 자연수(kg)로 입력해 주세요!");
      return;
    }

    // 대기 중인 균형 단계가 있으면 먼저 기록
    if (hasPendingChange()) {
      commitBalancedStep();
    }

    state.records.totalSubmissions += 1;
    if (state.timerInterval) clearInterval(state.timerInterval);
    state.elapsedSec = Math.max(0.1, state.totalTimeSec - state.remainingSec);
    state.stageTotalSolveTimeSec += state.elapsedSec;

    const validStepCount = state.steps.filter((s) => !s.isInvalidLog).length;
    state.stageTotalSteps += validStepCount;
    state.isSolved = true;
    el.answerInput.disabled = true;

    if (userX !== state.problem.x) {
      // ❌ 오답 처리: 현재 점수의 10% 감점!
      sfx.wrong();
      const penalty = Math.round(state.currentScore * 0.1);
      const beforeScore = state.currentScore;
      state.currentScore = Math.max(0, beforeScore - penalty);

      if (el.statCurrentScore) {
        el.statCurrentScore.classList.remove("pulse-gain", "pulse-loss");
        void el.statCurrentScore.offsetWidth;
        el.statCurrentScore.classList.add("pulse-loss");
      }

      state.records.history.unshift({
        eq: formatEquation({
          a: state.problem.initA,
          b: state.problem.initB,
          c: state.problem.initC,
          d: state.problem.initD,
        }),
        x: state.problem.x,
        timeSec: Number(state.elapsedSec.toFixed(1)),
        steps: validStepCount,
        isolated: false,
        isCorrect: false,
      });
      if (state.records.history.length > 30) state.records.history.length = 30;
      saveRecords(state.records);
      renderAll();

      openGradingModal(validStepCount, false, false, userX, penalty, beforeScore);
      return;
    }

    // 🎉 정답 처리! 기본 100점 + 스피드 점수(남은 시간에 비례, 최대 100점)
    hideInlineFeedback();
    const isolatedOnScale = isXIsolated(state.current);
    state.stageCorrectCount += 1;
    state.records.correctCount += 1;
    state.records.totalSolveTimeSec += state.elapsedSec;
    if (state.records.bestTimeSec === null || state.elapsedSec < state.records.bestTimeSec) {
      state.records.bestTimeSec = state.elapsedSec;
    }

    const baseScore = 100;
    const limit = STAGE_LIMITS[state.difficulty] || 60;
    const speedRatio = Math.max(0, Math.min(1, state.remainingSec / limit));
    const speedBonus = Math.round(speedRatio * 100);
    const totalEarned = baseScore + speedBonus;
    const beforeScore = state.currentScore;
    state.currentScore += totalEarned;

    if (el.statCurrentScore) {
      el.statCurrentScore.classList.remove("pulse-gain", "pulse-loss");
      void el.statCurrentScore.offsetWidth;
      el.statCurrentScore.classList.add("pulse-gain");
    }

    state.records.history.unshift({
      eq: formatEquation({
        a: state.problem.initA,
        b: state.problem.initB,
        c: state.problem.initC,
        d: state.problem.initD,
      }),
      x: state.problem.x,
      timeSec: Number(state.elapsedSec.toFixed(1)),
      steps: validStepCount,
      isolated: isolatedOnScale,
      isCorrect: true,
    });
    if (state.records.history.length > 30) state.records.history.length = 30;
    saveRecords(state.records);

    sfx.correct();
    renderAll();
    openGradingModal(validStepCount, isolatedOnScale, true, userX, totalEarned, beforeScore, speedBonus);
  }

  function isXIsolated(st) {
    return (
      (st.a === 1 && st.b === 0 && st.c === 0) ||
      (st.c === 1 && st.d === 0 && st.a === 0)
    );
  }

  function openGradingModal(validStepCount, isolatedOnScale, isCorrect, userX, scoreDelta, beforeScore, speedBonus = 0) {
    const { initA, initB, initC, initD, x } = state.problem;
    const initTotalKg = initA * x + initB;

    if (isCorrect) {
      const badgeNote = isolatedOnScale
        ? "🌟 저울의 균형을 끝까지 유지해 포대 1개의 무게를 완벽히 분리해 냈어요!"
        : "💡 정답입니다! 오른쪽의 등식의 성질 표준 풀이와도 과정을 비교해 보세요.";

      el.gradeHeroBox.innerHTML = `
        <div class="grade-hero-main">
          <h3>🎉 정답입니다! 설탕 포대 1개(x) = ${x} kg</h3>
          <p>${badgeNote}</p>
          <p style="margin-top:4px;font-size:12.5px;color:#065f46;">
            검산: 처음 왼쪽 어깨 <b>${initTotalKg}kg</b> = 처음 오른쪽 어깨 <b>${initC * x + initD}kg</b> (완벽한 균형!)
          </p>
        </div>
        <div class="grade-metrics">
          <div class="grade-metric-box">
            <span>해결 시간</span>
            <strong>${state.elapsedSec.toFixed(1)}초</strong>
          </div>
          <div class="grade-metric-box">
            <span>남은 시간</span>
            <strong style="color:#059669;">${state.remainingSec.toFixed(1)}초</strong>
          </div>
          <div class="grade-metric-box">
            <span>조작 단계</span>
            <strong>${validStepCount}단계</strong>
          </div>
        </div>
      `;

      if (el.gradeScoreCard) {
        el.gradeScoreCard.className = "grade-score-card gain";
        el.gradeScoreCard.innerHTML = `
          <div class="score-card-main">
            <span class="score-card-title">🎉 +${scoreDelta}점 획득!</span>
            <span class="score-card-breakdown">기본 점수 100점 + 스피드 점수 ${speedBonus}점 (남은 시간 ${state.remainingSec.toFixed(1)}초 반영)</span>
          </div>
          <div class="score-card-total-box">
            <span>현재 누적 점수</span>
            <strong>${state.currentScore}점</strong>
          </div>
        `;
      }
    } else {
      el.gradeHeroBox.innerHTML = `
        <div class="grade-hero-main wrong-hero">
          <h3 style="color:#b91c1c;">❌ 아쉬워요! 오답입니다. (입력: ${userX}kg ➔ 정답: x = ${x}kg)</h3>
          <p style="color:#991b1b;margin-top:4px;font-size:13px;">
            x = ${userX}kg이면 처음 왼쪽은 ${initA * userX + initB}kg, 오른쪽은 ${initC * userX + initD}kg이 되어 균형이 맞지 않아요.
          </p>
        </div>
        <div class="grade-metrics">
          <div class="grade-metric-box">
            <span>소요 시간</span>
            <strong>${state.elapsedSec.toFixed(1)}초</strong>
          </div>
          <div class="grade-metric-box">
            <span>조작 단계</span>
            <strong>${validStepCount}단계</strong>
          </div>
          <div class="grade-metric-box">
            <span>채점 결과</span>
            <strong style="color:#dc2626;">오답 (-10%)</strong>
          </div>
        </div>
      `;

      if (el.gradeScoreCard) {
        el.gradeScoreCard.className = "grade-score-card loss";
        el.gradeScoreCard.innerHTML = `
          <div class="score-card-main">
            <span class="score-card-title">⚠️ -${scoreDelta}점 감점</span>
            <span class="score-card-breakdown">문제를 틀려 현재 점수의 10%가 감점되었습니다. (이전 ${beforeScore}점)</span>
          </div>
          <div class="score-card-total-box">
            <span>현재 누적 점수</span>
            <strong>${state.currentScore}점</strong>
          </div>
        `;
      }
    }

    // 나의 풀이 과정 렌더링
    const initEq = formatEquation({ a: initA, b: initB, c: initC, d: initD });
    const myItems = [
      `<li><span class="step-rule-tag">시작 상태</span> 양쪽 어깨 초기 짐<span class="g-eq">${initEq}</span></li>`,
    ];

    if (state.steps.length === 0) {
      myItems.push(
        `<li><span class="step-rule-tag r2">직접 추론</span> 저울 조작 없이 방정식에서 바로 x = ${userX} 도출<span class="g-eq">x = ${userX}</span></li>`
      );
    } else {
      state.steps.forEach((st) => {
        myItems.push(`
          <li>
            <span class="step-rule-tag ${st.rule === "r2" ? "r2" : st.rule === "r3" ? "r3" : st.rule === "r4" ? "r4" : ""}">${st.ruleLabel}</span>
            ${st.desc}
            <span class="g-eq">${st.eq}</span>
          </li>
        `);
      });
    }
    el.myGradeSteps.innerHTML = myItems.join("");

    // 표준 풀이 과정 렌더링
    const modelSteps = buildModelSolution(state.problem);
    el.modelGradeSteps.innerHTML = modelSteps
      .map(
        (ms) => `
        <li>
          <span class="step-rule-tag r4">${ms.tag}</span>
          ${ms.desc}
          <span class="g-eq">${ms.eq}</span>
        </li>
      `
      )
      .join("");

    // 다음 문제 버튼 텍스트 설정 (5번째 문제면 스테이지 완주로 유도)
    if (el.btnNextProblemModal) {
      if (state.stageQuestionIndex >= STAGE_TOTAL_QUESTIONS) {
        el.btnNextProblemModal.textContent = "🏆 스테이지 최종 결과 확인하기 ➔";
      } else {
        el.btnNextProblemModal.textContent = `🎲 다음 배달 문제 (${state.stageQuestionIndex + 1}/${STAGE_TOTAL_QUESTIONS}) 풀기 ➔`;
      }
    }

    openModal("gradingModal");
  }

  // ==========================================================================
  // [랭킹 시스템] Firestore DB 연동 및 리더보드 렌더링
  // ==========================================================================
  const rankingState = {
    currentDiff: "standard",
    lastSubmittedId: null,
  };

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function updateCloudStatusPill() {
    if (!el.cloudStatusPill || !window.SugarRanking) return;
    const isCloud = window.SugarRanking.isCloudConnected();
    if (isCloud) {
      el.cloudStatusPill.className = "cloud-status-pill online";
      el.cloudStatusText.textContent = "Firestore 실시간 연결됨";
    } else {
      el.cloudStatusPill.className = "cloud-status-pill local";
      el.cloudStatusText.textContent = "로컬/데모 랭킹 모드";
    }
  }

  async function openRankingModal(diff = state.difficulty) {
    rankingState.currentDiff = diff;
    pauseTimer();

    // 탭 선택 상태 동기화
    el.rankingTabs.forEach((tab) => {
      const isAct = tab.dataset.rankDiff === rankingState.currentDiff;
      tab.classList.toggle("active", isAct);
      tab.setAttribute("aria-selected", isAct ? "true" : "false");
    });

    updateCloudStatusPill();
    openModal("rankingModal");
    await renderRankingTable(rankingState.currentDiff);
  }

  async function renderRankingTable(diff) {
    if (!el.rankingTableBody) return;

    el.rankingTableBody.innerHTML = `
      <tr>
        <td colspan="6" style="padding:26px;color:var(--text-muted);font-weight:600;">
          ⏳ 랭킹 기록을 불러오는 중입니다...
        </td>
      </tr>
    `;

    try {
      const list = await window.SugarRanking.getLeaderboard(diff);
      if (!list || list.length === 0) {
        el.rankingTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="padding:32px;color:var(--text-muted);">
              아직 등록된 랭킹 기록이 없습니다. 지금 첫 번째 명예의 전당 주인공이 되어보세요!
            </td>
          </tr>
        `;
        return;
      }

      el.rankingTableBody.innerHTML = list
        .map((entry, idx) => {
          const rank = idx + 1;
          let rankBadge = `<span class="rank-badge">${rank}</span>`;
          let rowClass = `rank-row`;
          if (rank === 1) {
            rankBadge = `<span class="rank-badge">🥇 1</span>`;
            rowClass += " rank-1";
          } else if (rank === 2) {
            rankBadge = `<span class="rank-badge">🥈 2</span>`;
            rowClass += " rank-2";
          } else if (rank === 3) {
            rankBadge = `<span class="rank-badge">🥉 3</span>`;
            rowClass += " rank-3";
          }

          if (rankingState.lastSubmittedId && entry.id === rankingState.lastSubmittedId) {
            rowClass += " my-rank-row";
          }

          const dateStr = entry.createdAt
            ? new Date(entry.createdAt).toLocaleDateString("ko-KR", {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })
            : "-";

          const scoreVal = entry.score ?? 0;
          const correctVal = entry.correctCount ?? 5;
          const timeVal = (entry.totalSolveTimeSec ?? entry.solveTimeSec ?? 0).toFixed(1);

          return `
            <tr class="${rowClass}">
              <td>${rankBadge}</td>
              <td><strong>${escapeHtml(entry.nickname)}</strong></td>
              <td><span class="ranking-score-cell">🪙 ${scoreVal}점</span></td>
              <td><b>${correctVal} / 5</b></td>
              <td><small>${timeVal}초</small></td>
              <td><small style="color:var(--text-muted);">${dateStr}</small></td>
            </tr>
          `;
        })
        .join("");
    } catch (err) {
      el.rankingTableBody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:22px;color:#dc2626;font-weight:700;">
            ⚠️ 랭킹 목록을 불러오는 도중 오류가 발생했습니다. 잠시 후 새로고침해 주세요.
          </td>
        </tr>
      `;
    }
  }

  // =========================
  // 커스텀 포인터 드래그 앤 드롭 (마우스 + 터치 완벽 호환)
  // =========================
  let dragCtx = null;

  function createSugarItemElement(type, origin) {
    const div = document.createElement("div");
    div.className = `sugar-item ${type}`;
    div.dataset.itemType = type; // 'sack' | 'bag'
    div.dataset.origin = origin; // 'left' | 'right' | 'supply'

    if (type === "sack") {
      div.title = "드래그하여 덜어내기 바구니로 제거하세요 (설탕 포대 x kg)";
      div.innerHTML = `
        <span class="sack-knot" aria-hidden="true"></span>
        <span class="item-main-label">포대</span>
        <span class="item-sub-label">x kg</span>
      `;
    } else {
      div.title = "드래그하여 덜어내기 바구니로 제거하세요 (설탕 봉지 1 kg)";
      div.innerHTML = `
        <span class="item-main-label">설탕</span>
        <span class="item-sub-label">1 kg</span>
      `;
    }

    div.addEventListener("pointerdown", onItemPointerDown);
    return div;
  }

  function onItemPointerDown(e) {
    if (state.isSolved || state.isTimeOver) return;
    if (e.button !== undefined && e.button !== 0) return;

    const target = e.currentTarget;
    const itemType = target.dataset.itemType; // 'sack' | 'bag'
    const origin = target.dataset.origin; // 'left' | 'right' | 'supply'

    e.preventDefault();
    sfx.pickup();
    hideInlineFeedback();

    const ghost = target.cloneNode(true);
    ghost.classList.add("dragging-ghost");
    ghost.style.left = `${e.clientX}px`;
    ghost.style.top = `${e.clientY}px`;
    document.body.appendChild(ghost);

    if (origin !== "supply") {
      target.classList.add("drag-origin-dimmed");
    }

    dragCtx = {
      pointerId: e.pointerId,
      itemType,
      origin,
      sourceEl: target,
      ghostEl: ghost,
    };

    window.addEventListener("pointermove", onPointerMove, { passive: false });
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
  }

  function getHoveredDropZone(clientX, clientY) {
    if (!dragCtx) return null;

    if (dragCtx.origin === "left" || dragCtx.origin === "right") {
      // 바구니 위 아이템 -> 제거 바구니에 드롭하여 제거 (규칙 1)
      const rect = el.removeDropZone.getBoundingClientRect();
      if (
        clientX >= rect.left &&
        clientX <= rect.right &&
        clientY >= rect.top &&
        clientY <= rect.bottom
      ) {
        return "remove";
      }
    } else if (dragCtx.origin === "supply") {
      // 보급소 아이템 -> 왼쪽 또는 오른쪽 바구니에 드롭하여 추가 (규칙 2)
      const leftRect = el.leftTray.getBoundingClientRect();
      if (
        clientX >= leftRect.left &&
        clientX <= leftRect.right &&
        clientY >= leftRect.top &&
        clientY <= leftRect.bottom
      ) {
        return "add-left";
      }
      const rightRect = el.rightTray.getBoundingClientRect();
      if (
        clientX >= rightRect.left &&
        clientX <= rightRect.right &&
        clientY >= rightRect.top &&
        clientY <= rightRect.bottom
      ) {
        return "add-right";
      }
    }
    return null;
  }

  function clearDropHighlights() {
    el.removeDropZone.classList.remove("drop-target-hover");
    el.leftTray.classList.remove("drop-target-hover");
    el.rightTray.classList.remove("drop-target-hover");
  }

  function onPointerMove(e) {
    if (!dragCtx || e.pointerId !== dragCtx.pointerId) return;
    e.preventDefault();

    dragCtx.ghostEl.style.left = `${e.clientX}px`;
    dragCtx.ghostEl.style.top = `${e.clientY}px`;

    clearDropHighlights();
    const zone = getHoveredDropZone(e.clientX, e.clientY);
    if (zone === "remove") {
      el.removeDropZone.classList.add("drop-target-hover");
    } else if (zone === "add-left") {
      el.leftTray.classList.add("drop-target-hover");
    } else if (zone === "add-right") {
      el.rightTray.classList.add("drop-target-hover");
    }
  }

  function onPointerUp(e) {
    if (!dragCtx || e.pointerId !== dragCtx.pointerId) return;

    const zone = getHoveredDropZone(e.clientX, e.clientY);
    const { itemType, origin, sourceEl, ghostEl } = dragCtx;

    clearDropHighlights();
    ghostEl.remove();
    sourceEl.classList.remove("drag-origin-dimmed");

    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerup", onPointerUp);
    window.removeEventListener("pointercancel", onPointerUp);
    dragCtx = null;

    if (!zone) return;

    if (zone === "remove") {
      const cat = itemType === "sack" ? "remove-sack" : "remove-bag";
      maybeAutoCommitBeforeAction(cat);

      if (origin === "left") {
        if (itemType === "sack" && state.current.a > 0) state.current.a -= 1;
        if (itemType === "bag" && state.current.b > 0) state.current.b -= 1;
      } else if (origin === "right") {
        if (itemType === "sack" && state.current.c > 0) state.current.c -= 1;
        if (itemType === "bag" && state.current.d > 0) state.current.d -= 1;
      }

      state.pendingCategory = state.pendingCategory && state.pendingCategory !== cat ? "mixed" : cat;
      afterItemChanged();
    } else if (zone === "add-left" || zone === "add-right") {
      const sideCount =
        zone === "add-left"
          ? state.current.a + state.current.b
          : state.current.c + state.current.d;
      if (sideCount >= 24) {
        sfx.wrong();
        showInlineFeedback("한쪽 바구니에는 최대 24개까지만 올릴 수 있어요!");
        return;
      }

      const cat = itemType === "sack" ? "add-sack" : "add-bag";
      maybeAutoCommitBeforeAction(cat);

      if (zone === "add-left") {
        if (itemType === "sack") state.current.a += 1;
        else state.current.b += 1;
      } else {
        if (itemType === "sack") state.current.c += 1;
        else state.current.d += 1;
      }

      state.pendingCategory = state.pendingCategory && state.pendingCategory !== cat ? "mixed" : cat;
      afterItemChanged();
    }
  }

  function afterItemChanged() {
    const { balanced } = getWeights(state.current);
    if (balanced) {
      if (!hasPendingChange()) {
        state.pendingCategory = null;
      }
      sfx.balanced();
    } else {
      sfx.drop();
    }
    renderAll();
  }

  // =========================
  // UI 렌더링
  // =========================
  function renderAll() {
    renderStats();
    renderEquationsAndWeights();
    renderScaleAndTrays();
    renderRatioButtons();
    renderTimeline();
  }

  function renderStats() {
    // 5문제 스테이지 진행도 & 현재 점수 표시
    if (el.statQuestionProg) {
      el.statQuestionProg.textContent = `문제 ${state.stageQuestionIndex} / ${STAGE_TOTAL_QUESTIONS}`;
    }
    if (el.statCurrentScore) {
      el.statCurrentScore.textContent = `${state.currentScore}점`;
    }
    if (el.statCorrectCount) {
      el.statCorrectCount.textContent = `${state.stageCorrectCount} / ${STAGE_TOTAL_QUESTIONS}`;
    }

    const rec = state.records;
    const avgText =
      rec.correctCount > 0
        ? `${(rec.totalSolveTimeSec / rec.correctCount).toFixed(1)}초`
        : "-";
    if (el.statAvgTime) {
      el.statAvgTime.textContent = avgText;
    }

    const accText =
      rec.totalSubmissions > 0
        ? `${((rec.correctCount / rec.totalSubmissions) * 100).toFixed(1)}%`
        : "-";
    if (el.statAccuracy) {
      el.statAccuracy.textContent = accText;
    }

    // 기록장 모달 내부 수치 동기화
    if (el.modalCorrectCount) el.modalCorrectCount.textContent = `${rec.correctCount}개`;
    if (el.modalAttemptSub) el.modalAttemptSub.textContent = `총 채점 시도 ${rec.totalSubmissions}회`;
    if (el.modalAvgTime) el.modalAvgTime.textContent = avgText;
    if (el.modalBestTimeSub) {
      el.modalBestTimeSub.textContent =
        rec.bestTimeSec !== null ? `최단 기록: ${rec.bestTimeSec.toFixed(1)}초` : "최단 기록: -";
    }
    if (el.modalAccuracy) el.modalAccuracy.textContent = accText;
    if (el.modalRule3Sub) el.modalRule3Sub.textContent = `규칙3 무효 발생: ${rec.rule3Violations}회`;

    if (el.historyTableBody) {
      if (rec.history.length === 0) {
        el.historyTableBody.innerHTML = `
          <tr>
            <td colspan="6" style="color:var(--text-muted);padding:18px;">아직 완료한 배달 기록이 없습니다. 첫 문제를 해결해 보세요!</td>
          </tr>
        `;
      } else {
        el.historyTableBody.innerHTML = rec.history
          .map(
            (item, idx) => `
            <tr>
              <td>${rec.history.length - idx}</td>
              <td><strong>${item.eq}</strong></td>
              <td>x = ${item.x}kg</td>
              <td>${item.timeSec.toFixed(1)}초</td>
              <td>${item.steps}단계</td>
              <td>${item.isolated ? "🌟 저울 완주" : item.isCorrect === false ? "❌ 오답" : "✅ 정답"}</td>
            </tr>
          `
          )
          .join("");
      }
    }
  }

  function renderEquationsAndWeights() {
    const initEq = formatEquation({
      a: state.problem.initA,
      b: state.problem.initB,
      c: state.problem.initC,
      d: state.problem.initD,
    });
    const curEq = formatEquation(state.current);

    el.initialEquationText.textContent = initEq;
    el.currentEquationText.textContent = curEq;

    const { leftKg, rightKg, diff, balanced } = getWeights(state.current);
    const pending = hasPendingChange();
    const deltaInfo = describePendingDelta();

    // 양쪽 아이템 구성 및 무게 식 표시
    el.leftItemSummary.textContent = summarizeItems(state.current.a, state.current.b);
    el.rightItemSummary.textContent = summarizeItems(state.current.c, state.current.d);

    const leftExprStr = formatExpr(state.current.a, state.current.b);
    const rightExprStr = formatExpr(state.current.c, state.current.d);

    if (state.isSolved) {
      el.leftWeightExpr.innerHTML = `${leftExprStr} <small>kg (실제 ${leftKg}kg)</small>`;
      el.rightWeightExpr.innerHTML = `${rightExprStr} <small>kg (실제 ${rightKg}kg)</small>`;
    } else {
      el.leftWeightExpr.innerHTML = `${leftExprStr} <small>kg</small>`;
      el.rightWeightExpr.innerHTML = `${rightExprStr} <small>kg</small>`;
    }

    // 이번 단계 조작 변화량 표시
    if (pending) {
      el.leftDeltaText.textContent = `이번 조작: ${deltaInfo.leftText}`;
      el.leftDeltaText.className = "weight-delta changed";
      el.rightDeltaText.textContent = `이번 조작: ${deltaInfo.rightText}`;
      el.rightDeltaText.className = "weight-delta changed";

      el.pendingDeltaBadge.classList.remove("hidden");
      el.pendingDeltaBadge.textContent = `조작 중 (좌: ${deltaInfo.leftText} / 우: ${deltaInfo.rightText})`;
      el.btnCancelPending.classList.remove("hidden");
    } else {
      el.leftDeltaText.textContent =
        state.current.a === 0
          ? `알려진 무게: ${state.current.b}kg`
          : `미지의 포대 ${state.current.a}개 + ${state.current.b}kg`;
      el.leftDeltaText.className = "weight-delta";

      el.rightDeltaText.textContent =
        state.current.c === 0
          ? `알려진 무게: ${state.current.d}kg`
          : `미지의 포대 ${state.current.c}개 + ${state.current.d}kg`;
      el.rightDeltaText.className = "weight-delta";

      el.pendingDeltaBadge.classList.add("hidden");
      el.btnCancelPending.classList.add("hidden");
    }

    // 균형 비교 기호 & 상태 배너 업데이트
    el.leftWeightCard.classList.remove("heavier", "lighter");
    el.rightWeightCard.classList.remove("heavier", "lighter");

    if (balanced) {
      el.equalitySymbolBox.classList.remove("unequal");
      el.equalitySymbol.textContent = "=";
      el.balanceStateMini.textContent = "수평";

      el.balanceStatusBar.classList.remove("unbalanced");
      el.balanceStatusBar.classList.add("balanced");
      el.balanceStatusIcon.textContent = "⚖️";

      if (isXIsolated(state.current)) {
        el.balanceStatusText.textContent =
          "완벽해요! 설탕 포대 1개의 무게가 반대쪽 1kg 봉지 수로 밝혀졌습니다!";
        el.isolatedBadge.textContent = "✨ 포대 1개 무게 발견!";
        el.isolatedBadge.classList.add("ready");
      } else if (pending) {
        el.balanceStatusText.textContent =
          "양쪽 균형이 다시 맞았습니다! 계속 조작하거나 [단계 기록]을 눌러 확정하세요.";
        el.isolatedBadge.textContent = "균형 유지 중";
        el.isolatedBadge.classList.remove("ready");
      } else {
        el.balanceStatusText.textContent = "양쪽 어깨의 균형이 완벽하게 맞습니다!";
        el.isolatedBadge.textContent = "탐구 진행 중";
        el.isolatedBadge.classList.remove("ready");
      }
    } else {
      el.equalitySymbolBox.classList.add("unequal");
      el.balanceStatusBar.classList.remove("balanced");
      el.balanceStatusBar.classList.add("unbalanced");
      el.balanceStatusIcon.textContent = "⚠️";

      if (diff < 0) {
        // 왼쪽이 더 무거움
        el.equalitySymbol.textContent = ">";
        el.balanceStateMini.textContent = "좌측 무거움";
        el.leftWeightCard.classList.add("heavier");
        el.rightWeightCard.classList.add("lighter");
        el.balanceStatusText.textContent =
          "왼쪽 어깨가 더 무거워 기울어졌어요! 반대쪽도 똑같이 맞추지 않으면 무효(규칙3)가 됩니다.";
      } else {
        // 오른쪽이 더 무거움
        el.equalitySymbol.textContent = "<";
        el.balanceStateMini.textContent = "우측 무거움";
        el.rightWeightCard.classList.add("heavier");
        el.leftWeightCard.classList.add("lighter");
        el.balanceStatusText.textContent =
          "오른쪽 어깨가 더 무거워 기울어졌어요! 반대쪽도 똑같이 맞추지 않으면 무효(규칙3)가 됩니다.";
      }
      el.isolatedBadge.textContent = "균형 깨짐!";
      el.isolatedBadge.classList.remove("ready");
    }
  }

  function renderScaleAndTrays() {
    const { diff, balanced } = getWeights(state.current);

    // 기울기 각도 계산 (diff > 0이면 오른쪽이 무거워 시계방향 +각도)
    let angle = 0;
    if (diff !== 0) {
      const sign = diff > 0 ? 1 : -1;
      const mag = Math.min(13, Math.max(4.5, Math.abs(diff) * 2.4));
      angle = sign * mag;
    }
    document.documentElement.style.setProperty("--beam-angle", `${angle.toFixed(2)}deg`);

    // 지훈이 표정 & 말풍선
    if (!balanced) {
      el.faceHappy.classList.add("hidden");
      el.faceStrain.classList.remove("hidden");
      el.jihoonSpeech.textContent =
        diff < 0 ? "으악! 왼쪽 어깨가 무거워요!" : "으악! 오른쪽 어깨가 무거워요!";
    } else {
      el.faceHappy.classList.remove("hidden");
      el.faceStrain.classList.add("hidden");

      if (state.isSolved) {
        el.jihoonSpeech.textContent = `고마워요! 포대 1개는 ${state.problem.x}kg이었군요!`;
      } else if (isXIsolated(state.current)) {
        const bagCnt = state.current.a === 1 ? state.current.d : state.current.b;
        el.jihoonSpeech.textContent = `앗! 포대 1개와 1kg 봉지 ${bagCnt}개가 똑같아요!`;
      } else {
        el.jihoonSpeech.textContent = "균형을 유지하며 포대 1개만 남겨 볼까요?";
      }
    }

    // 왼쪽 바구니 아이템 렌더링
    populateTray(el.leftTray, el.leftTrayItems, el.leftEmptyHint, state.current.a, state.current.b, "left");
    // 오른쪽 바구니 아이템 렌더링
    populateTray(el.rightTray, el.rightTrayItems, el.rightEmptyHint, state.current.c, state.current.d, "right");
  }

  function populateTray(trayEl, containerEl, emptyHintEl, sacks, bags, side) {
    containerEl.innerHTML = "";
    const total = sacks + bags;
    emptyHintEl.classList.toggle("hidden", total > 0);
    trayEl.classList.toggle("compact-items", total > 8);

    for (let i = 0; i < sacks; i++) {
      containerEl.appendChild(createSugarItemElement("sack", side));
    }
    for (let i = 0; i < bags; i++) {
      containerEl.appendChild(createSugarItemElement("bag", side));
    }
  }

  function renderRatioButtons() {
    const { a, b, c, d } = state.current;
    const { balanced } = getWeights(state.current);
    const g = gcd4(a, b, c, d);

    // 6 이상의 공약수가 생기면 동적 등분 버튼 활성화!
    if (balanced && g > 5) {
      el.btnDynamicDiv.classList.remove("hidden");
      el.btnDynamicDiv.dataset.factor = String(g);
      el.btnDynamicDiv.innerHTML = `<span class="op-sym">÷${g}</span><small>(1/${g} 남기기)</small>`;
    } else {
      el.btnDynamicDiv.classList.add("hidden");
    }

    // kx = m 형태일 때 알맞은 등분 버튼 하이라이트
    const singleSideCoeff =
      a > 1 && b === 0 && c === 0
        ? a
        : c > 1 && d === 0 && a === 0
        ? c
        : 0;

    el.ratioButtons.querySelectorAll(".btn-ratio").forEach((btn) => {
      const op = btn.dataset.op;
      const factor = Number(btn.dataset.factor);
      const isRec = balanced && op === "div" && singleSideCoeff > 1 && factor === singleSideCoeff;
      btn.classList.toggle("recommended", isRec);
    });
  }

  function renderTimeline() {
    const validCount = state.steps.filter((s) => !s.isInvalidLog).length;
    el.stepCountBadge.textContent = `${validCount}단계`;

    const initEq = formatEquation({
      a: state.problem.initA,
      b: state.problem.initB,
      c: state.problem.initC,
      d: state.problem.initD,
    });

    const html = [
      `
      <li class="step-item initial">
        <div class="step-top">
          <span class="step-rule-tag">출제 상태</span>
          <span class="step-eq">${initEq}</span>
        </div>
        <div class="step-desc">지훈이가 처음 양쪽 어깨에 꾸린 설탕 짐</div>
      </li>
      `,
    ];

    state.steps.forEach((st) => {
      const tagClass =
        st.rule === "r2"
          ? "r2"
          : st.rule === "r3"
          ? "r3"
          : st.rule === "r4"
          ? "r4"
          : "";
      html.push(`
        <li class="step-item ${st.isInvalidLog ? "invalid-step" : ""}">
          <div class="step-top">
            <span class="step-rule-tag ${tagClass}">${st.ruleLabel}</span>
            <span class="step-eq">${st.eq}</span>
          </div>
          <div class="step-desc">${st.desc}</div>
        </li>
      `);
    });

    el.stepsTimeline.innerHTML = html.join("");
    el.stepsTimeline.scrollTop = el.stepsTimeline.scrollHeight;
  }

  // =========================
  // 인라인 피드백 & 모달 제어
  // =========================
  function showInlineFeedback(msg, type = "error") {
    el.inlineFeedback.textContent = msg;
    el.inlineFeedback.className = `feedback-toast ${type}`;
  }

  function hideInlineFeedback() {
    el.inlineFeedback.classList.add("hidden");
  }

  function openModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.remove("hidden");
  }

  function closeModal(id) {
    const modal = document.getElementById(id);
    if (modal) modal.classList.add("hidden");
  }

  // =========================
  // 이벤트 바인딩 & 초기화
  // =========================
  function bindEvents() {
    // 보급소 템플릿 드래그 이벤트 연결
    el.supplyTemplates.forEach((tpl) => {
      tpl.addEventListener("pointerdown", onItemPointerDown);
    });

    // 단계 확정 버튼 (불균형 시 규칙 3 발동!)
    el.btnConfirmStep.addEventListener("click", () => {
      if (state.isSolved || state.isTimeOver) return;
      const { balanced } = getWeights(state.current);
      if (!balanced) {
        triggerRule3Invalidation(
          "양쪽 어깨의 무게가 맞지 않는 상태로 확정을 시도하여 [규칙 3]에 따라 해당 조작이 무효 처리되었습니다!"
        );
        return;
      }
      if (!hasPendingChange()) {
        sfx.balanced();
        showInlineFeedback(
          "현재 양쪽 균형이 잘 맞고 있어요! 포대나 봉지를 드래그하거나 비율 버튼을 사용해 보세요.",
          "info"
        );
        setTimeout(hideInlineFeedback, 2200);
        return;
      }
      commitBalancedStep();
      sfx.balanced();
      renderAll();
    });

    // 방금 조작 취소 (부드러운 되돌리기)
    el.btnCancelPending.addEventListener("click", () => {
      if (!hasPendingChange() || state.isTimeOver) return;
      state.current = { ...state.checkpoint };
      state.pendingCategory = null;
      sfx.drop();
      renderAll();
    });

    // 규칙 4 비율 버튼 클릭
    el.ratioButtons.addEventListener("click", (e) => {
      if (state.isSolved || state.isTimeOver) return;
      const btn = e.target.closest(".btn-ratio");
      if (!btn) return;
      const op = btn.dataset.op;
      const factor = Number(btn.dataset.factor);
      applyRatioOperation(op, factor);
    });

    // 5문제 스테이지 진행: 다음 문제로 넘어가거나 스테이지 완주 모달 띄우기
    function handleAdvanceNextQuestion() {
      closeModal("gradingModal");
      closeModal("timeoverModal");

      if (state.stageQuestionIndex >= STAGE_TOTAL_QUESTIONS) {
        // 5문제 완주! 최종 결과 발표 & 랭킹 등록 모달 오픈!
        openStageClearModal();
      } else {
        state.stageQuestionIndex += 1;
        startNewProblem();
        sfx.pickup();
      }
    }

    // 🏆 스테이지 5문제 완주 모달 열기
    function openStageClearModal() {
      pauseTimer();
      sfx.correct();

      const diffNames = {
        basic: "기초 단계 (40초)",
        standard: "기본 단계 (1분)",
        challenge: "심화 단계 (1분 20초)",
      };

      if (el.stageFinalScore) {
        el.stageFinalScore.textContent = `${state.currentScore}점`;
      }
      if (el.stageScoreFormula) {
        el.stageScoreFormula.textContent = `기본 100점 + 남은 시간 스피드 보너스 (오답 -10%, 시간초과 -30% 적용)`;
      }
      if (el.stageCorrectStats) {
        el.stageCorrectStats.textContent = `${state.stageCorrectCount} / ${STAGE_TOTAL_QUESTIONS}`;
      }
      if (el.stageAccuracyText) {
        const accPct = Math.round((state.stageCorrectCount / STAGE_TOTAL_QUESTIONS) * 100);
        el.stageAccuracyText.textContent = `정확도 ${accPct}% (${state.stageCorrectCount}문제 성공)`;
      }
      if (el.stageTotalTimeText) {
        el.stageTotalTimeText.textContent = `${state.stageTotalSolveTimeSec.toFixed(1)}초`;
      }
      if (el.stageAvgTimeText) {
        const avgSec = state.stageTotalSolveTimeSec / STAGE_TOTAL_QUESTIONS;
        el.stageAvgTimeText.textContent = `문제당 평균 ${avgSec.toFixed(1)}초`;
      }
      if (el.stageTotalStepsText) {
        el.stageTotalStepsText.textContent = `${state.stageTotalSteps}단계`;
      }
      if (el.stageDiffBadge) {
        el.stageDiffBadge.textContent = diffNames[state.difficulty] || "표준 모드";
      }
      if (el.stageRankDiffBadge) {
        el.stageRankDiffBadge.textContent = diffNames[state.difficulty] || "표준 모드";
      }

      // 랭킹 등록 폼 초기화
      if (el.stageRankSubmitResult) {
        el.stageRankSubmitResult.classList.add("hidden");
      }
      if (el.stageRankSubmitForm) {
        el.stageRankSubmitForm.classList.remove("hidden");
      }
      if (el.btnSubmitStageScore) {
        el.btnSubmitStageScore.disabled = false;
        el.btnSubmitStageScore.textContent = "🏆 내 순위 등록하기";
      }

      try {
        const savedNick = localStorage.getItem("sugar_merchant_nickname") || "";
        if (savedNick && el.stageRankNicknameInput) {
          el.stageRankNicknameInput.value = savedNick;
        }
      } catch (e) {}

      state.lastCompletedStageEntry = {
        difficulty: state.difficulty,
        score: state.currentScore,
        correctCount: state.stageCorrectCount,
        totalQuestions: STAGE_TOTAL_QUESTIONS,
        totalSolveTimeSec: state.stageTotalSolveTimeSec,
        totalSteps: state.stageTotalSteps,
      };

      openModal("stageClearModal");
    }

    // 새 스테이지 시작 (1번 문제부터 점수 0점으로 시작)
    function startStage(diff = state.difficulty) {
      state.difficulty = diff;
      state.stageQuestionIndex = 1;
      state.currentScore = 0;
      state.stageCorrectCount = 0;
      state.stageTotalSolveTimeSec = 0;
      state.stageTotalSteps = 0;
      startNewProblem();
    }

    // 난이도 탭 클릭 시 해당 스테이지 새로 시작
    el.diffTabs.forEach((tab) => {
      tab.addEventListener("click", () => {
        el.diffTabs.forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        startStage(tab.dataset.diff);
      });
    });

    // 새 문제 & 현재 문제 초기화
    el.btnNewProblem.addEventListener("click", () => {
      startNewProblem();
    });

    el.btnResetCurrent.addEventListener("click", () => {
      resetToProblemStart(true);
    });

    // 정답 제출 폼
    el.answerForm.addEventListener("submit", handleAnswerSubmit);

    // 채점 모달 내 '다음 문제' 버튼
    el.btnNextProblemModal.addEventListener("click", () => {
      handleAdvanceNextQuestion();
    });

    // 타임오버 모달 '다음 문제' 버튼
    el.btnNextTimeover.addEventListener("click", () => {
      handleAdvanceNextQuestion();
    });

    // 🏆 스테이지 완주 모달 랭킹 등록
    if (el.stageRankSubmitForm) {
      el.stageRankSubmitForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const nickname = el.stageRankNicknameInput.value.trim();
        if (!nickname || nickname.length < 2) {
          alert("닉네임을 2자 이상 입력해 주세요!");
          el.stageRankNicknameInput.focus();
          return;
        }

        if (!state.lastCompletedStageEntry) return;

        el.btnSubmitStageScore.disabled = true;
        el.btnSubmitStageScore.textContent = "등록 중...";

        try {
          localStorage.setItem("sugar_merchant_nickname", nickname);
        } catch (err) {}

        const res = await window.SugarRanking.submitScore({
          ...state.lastCompletedStageEntry,
          nickname,
        });

        if (res && res.success) {
          rankingState.lastSubmittedId = res.id;
          sfx.correct();

          el.stageRankSubmitForm.classList.add("hidden");
          el.stageRankSubmitResult.className = "rank-submit-result success";
          if (el.stageRankSuccessMsg) {
            el.stageRankSuccessMsg.innerHTML = `🎉 <b>${escapeHtml(nickname)}</b>님의 점수(<b>${state.currentScore}점</b>)가 명예의 전당에 실시간 등록되었습니다!`;
          }
          el.stageRankSubmitResult.classList.remove("hidden");
        } else {
          el.btnSubmitStageScore.disabled = false;
          el.btnSubmitStageScore.textContent = "🏆 내 순위 등록하기";
          alert("등록에 실패했습니다. 다시 시도해 주세요.");
        }
      });
    }

    if (el.btnViewLeaderboardAfterSubmit) {
      el.btnViewLeaderboardAfterSubmit.addEventListener("click", () => {
        openRankingModal(state.difficulty);
      });
    }

    if (el.btnOpenLeaderboardFromClear) {
      el.btnOpenLeaderboardFromClear.addEventListener("click", () => {
        openRankingModal(state.difficulty);
      });
    }

    if (el.btnRestartStage) {
      el.btnRestartStage.addEventListener("click", () => {
        closeModal("stageClearModal");
        startStage(state.difficulty);
      });
    }

    // 🏆 랭킹 모달 열기 버튼
    if (el.btnOpenRanking) {
      el.btnOpenRanking.addEventListener("click", () => {
        openRankingModal(state.difficulty);
      });
    }

    if (el.btnOpenRankingFromGrading) {
      el.btnOpenRankingFromGrading.addEventListener("click", () => {
        openRankingModal(state.difficulty);
      });
    }

    // 🏆 랭킹보드 난이도 탭 전환
    if (el.rankingTabs) {
      el.rankingTabs.forEach((tab) => {
        tab.addEventListener("click", () => {
          const targetDiff = tab.dataset.rankDiff;
          rankingState.currentDiff = targetDiff;
          el.rankingTabs.forEach((t) => {
            const isAct = t === tab;
            t.classList.toggle("active", isAct);
            t.setAttribute("aria-selected", isAct ? "true" : "false");
          });
          renderRankingTable(targetDiff);
        });
      });
    }

    // 🏆 랭킹보드 새로고침
    if (el.btnRefreshRanking) {
      el.btnRefreshRanking.addEventListener("click", () => {
        renderRankingTable(rankingState.currentDiff);
      });
    }

    if (el.btnPlayFromRanking) {
      el.btnPlayFromRanking.addEventListener("click", () => {
        closeModal("rankingModal");
        resumeTimer();
      });
    }

    // 출발하기 버튼 클릭 시 타이머 시작 및 게임 돌입!
    if (el.btnStartMission) {
      el.btnStartMission.addEventListener("click", (e) => {
        e.preventDefault();
        launchMissionGame();
      });
    }

    // 모달 열기 / 닫기
    el.btnOpenMission.addEventListener("click", () => {
      pauseTimer();
      openModal("missionModal");
    });

    el.btnOpenRecords.addEventListener("click", () => {
      pauseTimer();
      renderStats();
      openModal("recordsModal");
    });

    document.querySelectorAll("[data-close-modal]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const modalId = btn.dataset.closeModal;
        closeModal(modalId);
        if (modalId === "missionModal") {
          launchMissionGame();
        } else if (modalId === "recordsModal" || modalId === "rankingModal") {
          resumeTimer();
        }
      });
    });

    const allModals = [
      el.missionModal,
      el.gradingModal,
      el.recordsModal,
      el.timeoverModal,
      el.rankingModal,
      el.stageClearModal,
    ];

    allModals.forEach((backdrop) => {
      if (!backdrop) return;
      backdrop.addEventListener("click", (e) => {
        if (e.target === backdrop) {
          backdrop.classList.add("hidden");
          if (backdrop === el.missionModal) {
            launchMissionGame();
          } else if (backdrop === el.recordsModal || backdrop === el.rankingModal) {
            resumeTimer();
          }
        }
      });
    });

    // 기록 초기화
    el.btnResetRecords.addEventListener("click", () => {
      if (window.confirm("저장된 정답 수, 해결 시간, 정확도 기록을 모두 초기화할까요?")) {
        state.records = defaultRecords();
        saveRecords(state.records);
        renderStats();
      }
    });

    // 효과음 토글
    el.btnToggleSound.addEventListener("click", () => {
      sfx.enabled = !sfx.enabled;
      el.btnToggleSound.textContent = sfx.enabled ? "🔊" : "🔇";
    });

    // ESC 키로 열려 있는 모달 닫기
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const wasMission = el.missionModal && !el.missionModal.classList.contains("hidden");
        const wasPaused = (el.recordsModal && !el.recordsModal.classList.contains("hidden")) ||
                          (el.rankingModal && !el.rankingModal.classList.contains("hidden"));

        allModals.forEach((m) => {
          if (m) m.classList.add("hidden");
        });

        if (wasMission) {
          launchMissionGame();
        } else if (wasPaused) {
          resumeTimer();
        }
      }
    });
  }

  function init() {
    bindEvents();
    startNewProblem();

    // 첫 진입 시 미션 모달 열기 (타이머는 출발하기 누르기 전까지 대기)
    openModal("missionModal");
  }

  init();
})();
