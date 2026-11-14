(() => {
  "use strict";

  const STORAGE_KEY = "sugar_water_concentration_records_v1";

  // ==========================================
  // 🔊 Web Audio 기반 사운드 시스템
  // ==========================================
  class ConcentrationSoundFX {
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
      gain.gain.exponentialRampToValueAtTime(gainVal, now + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start(now);
      osc.stop(now + duration + 0.02);
    }

    waterDrop() {
      this.tone(600, 0.06, "sine", 0.1);
      this.tone(850, 0.08, "sine", 0.08, 0.03);
    }

    sugarDrop() {
      this.tone(987.77, 0.05, "triangle", 0.1);
      this.tone(1318.51, 0.07, "triangle", 0.08, 0.03);
    }

    removeClick() {
      this.tone(320, 0.08, "sine", 0.09);
    }

    matchGlow() {
      this.tone(523.25, 0.15, "triangle", 0.1, 0);
      this.tone(659.25, 0.15, "triangle", 0.12, 0.08);
      this.tone(783.99, 0.22, "triangle", 0.14, 0.16);
    }

    correct() {
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((n, idx) => {
        this.tone(n, 0.22, "triangle", 0.14, idx * 0.09);
      });
    }

    wrong() {
      this.tone(280, 0.18, "sawtooth", 0.12, 0);
      this.tone(220, 0.25, "sawtooth", 0.12, 0.12);
    }

    stageClear() {
      const fanfare = [523.25, 659.25, 783.99, 1046.5, 1318.51];
      fanfare.forEach((n, idx) => {
        this.tone(n, 0.25, "triangle", 0.15, idx * 0.1);
      });
    }
  }

  const sfx = new ConcentrationSoundFX();

  // ==========================================
  // 📐 수학 유틸리티 및 문제 생성기
  // ==========================================
  function gcd(a, b) {
    let x = Math.round(Math.abs(a));
    let y = Math.round(Math.abs(b));
    while (y !== 0) {
      const t = x % y;
      x = y;
      y = t;
    }
    return x;
  }

  function pickRandom(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // 농도 퍼센트 계산: 설탕 / (물 + 설탕) * 100
  function calcConcentration(water, sugar) {
    if (water <= 0 && sugar <= 0) return 0;
    const total = water + sugar;
    return (sugar / total) * 100;
  }

  // 비례 배율 정의 (곱셈 및 나눗셈 성질을 학습하기 좋은 깨끗한 배율들)
  const RATIO_PRESETS = [
    { multiplier: 2, label: "2배 (× 2)", type: "mul", factor: 2 },
    { multiplier: 3, label: "3배 (× 3)", type: "mul", factor: 3 },
    { multiplier: 0.5, label: "절반 (÷ 2)", type: "div", factor: 2 },
    { multiplier: 0.33333333, label: "1/3배 (÷ 3)", type: "div", factor: 3 },
    { multiplier: 1.5, label: "1.5배 (× 1.5)", type: "mul", factor: 1.5 },
    { multiplier: 4, label: "4배 (× 4)", type: "mul", factor: 4 },
    { multiplier: 0.25, label: "1/4배 (÷ 4)", type: "div", factor: 4 },
  ];

  // 기본 황금 레시피 프리셋 (물, 설탕)
  const BASE_RECIPES = [
    { water: 200, sugar: 40, name: "표준 달콤 설탕물 (5:1 비율)" },
    { water: 100, sugar: 20, name: "미니 황금 설탕물 (5:1 비율)" },
    { water: 300, sugar: 60, name: "대용량 설탕물 (5:1 비율)" },
    { water: 200, sugar: 50, name: "달달한 시럽물 (4:1 비율)" },
    { water: 160, sugar: 40, name: "깔끔한 레시피 (4:1 비율)" },
    { water: 150, sugar: 30, name: "부드러운 설탕물 (5:1 비율)" },
    { water: 240, sugar: 60, name: "고급 레시피 (4:1 비율)" },
    { water: 180, sugar: 30, name: "은은한 설탕물 (6:1 비율)" },
    { water: 200, sugar: 20, name: "라이트 설탕물 (10:1 비율)" },
    { water: 100, sugar: 10, name: "순한 설탕물 (10:1 비율)" },
  ];

  /**
   * 문제 생성 함수
   * @param {string} difficulty 'basic' | 'standard' | 'challenge'
   * @param {number} questionNumber 스테이지 내 문제 번호
   */
  function generateConcentrationProblem(difficulty = "standard", questionNumber = 1) {
    let availableMultipliers;
    if (difficulty === "basic") {
      // 기초: ×2, ×3, ÷2, ÷3 등 직관적인 배수/약수
      availableMultipliers = [
        { multiplier: 2, label: "2배 (× 2)", type: "mul", factor: 2 },
        { multiplier: 0.5, label: "절반 (÷ 2)", type: "div", factor: 2 },
        { multiplier: 3, label: "3배 (× 3)", type: "mul", factor: 3 },
        { multiplier: 0.33333333, label: "1/3배 (÷ 3)", type: "div", factor: 3 },
      ];
    } else if (difficulty === "standard") {
      // 표준: ×1.5, ×2, ×3, ×4, ÷2, ÷3, ÷4
      availableMultipliers = [
        { multiplier: 2, label: "2배 (× 2)", type: "mul", factor: 2 },
        { multiplier: 0.5, label: "절반 (÷ 2)", type: "div", factor: 2 },
        { multiplier: 1.5, label: "1.5배 (× 1.5)", type: "mul", factor: 1.5 },
        { multiplier: 3, label: "3배 (× 3)", type: "mul", factor: 3 },
        { multiplier: 0.25, label: "1/4배 (÷ 4)", type: "div", factor: 4 },
        { multiplier: 4, label: "4배 (× 4)", type: "mul", factor: 4 },
      ];
    } else {
      // 심화: 모든 배율
      availableMultipliers = RATIO_PRESETS;
    }

    // 오른쪽 비커(기준) 선정
    let base = pickRandom(BASE_RECIPES);
    let ratioPreset = pickRandom(availableMultipliers);

    let targetWater = base.water;
    let targetSugar = base.sugar;

    // 만약 나눗셈(÷2, ÷3, ÷4)인 경우 기준값이 깔끔하게 나누어떨어지도록 보정
    if (ratioPreset.type === "div") {
      const f = ratioPreset.factor;
      if (targetWater % f !== 0 || targetSugar % f !== 0) {
        // 배수로 올려서 나누어떨어지게 설정
        targetWater = Math.round(targetWater / f) * f;
        if (targetWater === 0) targetWater = f * 50;
        targetSugar = Math.round(targetSugar / f) * f;
        if (targetSugar === 0) targetSugar = f * 10;
      }
    }

    // 왼쪽 비커의 목표 정답 계산
    let goalWater, goalSugar;
    if (ratioPreset.type === "mul") {
      goalWater = Math.round(targetWater * ratioPreset.factor);
      goalSugar = Math.round(targetSugar * ratioPreset.factor);
    } else {
      goalWater = Math.round(targetWater / ratioPreset.factor);
      goalSugar = Math.round(targetSugar / ratioPreset.factor);
    }

    // 규칙 3: 왼쪽 비커에는 '물' 또는 '설탕'의 양만 주어진다!
    // 홀수 문제는 물이 주어지고(설탕 맞추기), 짝수 문제는 설탕이 주어짐(물 맞추기)
    const fixedType = (questionNumber % 2 === 1) ? "water" : "sugar";

    let initPlayerWater = 0;
    let initPlayerSugar = 0;

    if (fixedType === "water") {
      // 물이 주어짐 -> 학생은 설탕을 조절해 목표 농도를 맞춤
      initPlayerWater = goalWater;
      initPlayerSugar = 0;
    } else {
      // 설탕이 주어짐 -> 학생은 물을 조절해 목표 농도를 맞춤
      initPlayerWater = 0;
      initPlayerSugar = goalSugar;
    }

    const targetConc = calcConcentration(targetWater, targetSugar);

    return {
      difficulty,
      questionNumber,
      // 오른쪽 비커 (기준 황금 레시피)
      target: {
        water: targetWater,
        sugar: targetSugar,
        total: targetWater + targetSugar,
        concentration: targetConc,
      },
      // 왼쪽 비커 (학생 조작)
      fixedType, // 'water' (물이 고정 제공됨) | 'sugar' (설탕이 고정 제공됨)
      initialLeft: {
        water: initPlayerWater,
        sugar: initPlayerSugar,
      },
      goal: {
        water: goalWater,
        sugar: goalSugar,
        concentration: targetConc,
      },
      ratioRule: ratioPreset,
    };
  }

  // ==========================================
  // 🎮 게임 상태 관리 클래스
  // ==========================================
  class ConcentrationGame {
    constructor() {
      this.difficulty = "standard";
      this.currentQuestion = 1;
      this.totalQuestions = 5;
      this.score = 0;
      this.correctCount = 0;
      this.currentProblem = null;

      // 현재 플레이어 비커 상태
      this.playerWater = 0;
      this.playerSugar = 0;

      // 타이머 관련
      this.timerInterval = null;
      this.timeRemaining = 40.0;
      this.timeLimit = 40.0;
      this.startTime = 0;
      this.isSubmitting = false;

      // 연속 증가/감소 인터벌
      this.holdInterval = null;
      this.holdTimeout = null;

      // DOM 요소 캐시
      this.dom = {};
      this.initDOMElements();
      this.bindEvents();
    }

    initDOMElements() {
      // 상단 모드 스위처
      this.dom.btnModeConcentration = document.getElementById("btnModeConcentration");
      this.dom.btnModeScale = document.getElementById("btnModeScale");
      this.dom.concentrationContainer = document.getElementById("concentrationGameContainer");
      this.dom.scaleToolbar = document.querySelector(".problem-toolbar");
      this.dom.scaleMain = document.querySelector(".main-layout");

      // 헤더 스탯
      this.dom.statQuestionProg = document.getElementById("statQuestionProg");
      this.dom.statCurrentScore = document.getElementById("statCurrentScore");
      this.dom.currentTimer = document.getElementById("currentTimer");
      this.dom.timerGaugeFill = document.getElementById("timerGaugeFill");
      this.dom.statCorrectCount = document.getElementById("statCorrectCount");
      this.dom.btnToggleSound = document.getElementById("btnToggleSound");

      // 문제 및 등식의 성질 배너
      this.dom.concGoalText = document.getElementById("concGoalText");
      this.dom.propertyRuleTitle = document.getElementById("propertyRuleTitle");
      this.dom.propertyRuleDesc = document.getElementById("propertyRuleDesc");
      this.dom.propertyFormulaPill = document.getElementById("propertyFormulaPill");
      this.dom.btnToggleHint = document.getElementById("btnToggleHint");
      this.dom.propertyBannerCard = document.getElementById("propertyBannerCard");

      // 오른쪽 비커 (기준)
      this.dom.targetWaterText = document.getElementById("targetWaterText");
      this.dom.targetSugarText = document.getElementById("targetSugarText");
      this.dom.targetTotalText = document.getElementById("targetTotalText");
      this.dom.targetConcText = document.getElementById("targetConcText");
      this.dom.targetLiquid = document.getElementById("targetLiquid");
      this.dom.targetSediment = document.getElementById("targetSediment");

      // 왼쪽 비커 (플레이어)
      this.dom.playerWaterText = document.getElementById("playerWaterText");
      this.dom.playerSugarText = document.getElementById("playerSugarText");
      this.dom.playerTotalText = document.getElementById("playerTotalText");
      this.dom.playerConcText = document.getElementById("playerConcText");
      this.dom.playerLiquid = document.getElementById("playerLiquid");
      this.dom.playerSediment = document.getElementById("playerSediment");
      this.dom.playerDropZone = document.getElementById("playerDropZone");

      // 중앙 굴절계 / 비교기
      this.dom.refractometerNeedle = document.getElementById("refractometerNeedle");
      this.dom.refractometerStatus = document.getElementById("refractometerStatus");

      // 컨트롤 데크
      this.dom.valCurrentWater = document.getElementById("valCurrentWater");
      this.dom.valCurrentSugar = document.getElementById("valCurrentSugar");
      this.dom.btnMinusWater = document.getElementById("btnMinusWater");
      this.dom.btnPlusWater = document.getElementById("btnPlusWater");
      this.dom.btnMinusSugar = document.getElementById("btnMinusSugar");
      this.dom.btnPlusSugar = document.getElementById("btnPlusSugar");
      this.dom.btnSubmitConcentration = document.getElementById("btnSubmitConcentration");
      this.dom.btnConcNewProblem = document.getElementById("btnConcNewProblem");
      this.dom.btnConcReset = document.getElementById("btnConcReset");

      // 모달류
      this.dom.concModal = document.getElementById("concResultModal");
      this.dom.concModalTitle = document.getElementById("concModalTitle");
      this.dom.concModalBody = document.getElementById("concModalBody");
      this.dom.btnConcModalNext = document.getElementById("btnConcModalNext");
      this.dom.btnConcModalClose = document.getElementById("btnConcModalClose");
    }

    bindEvents() {
      // 1. 모드 전환 버튼
      if (this.dom.btnModeConcentration) {
        this.dom.btnModeConcentration.addEventListener("click", () => this.switchMode("concentration"));
      }
      if (this.dom.btnModeScale) {
        this.dom.btnModeScale.addEventListener("click", () => this.switchMode("scale"));
      }

      // 2. 새 문제 & 리셋
      if (this.dom.btnConcNewProblem) {
        this.dom.btnConcNewProblem.addEventListener("click", () => {
          this.currentQuestion = 1;
          this.score = 0;
          this.correctCount = 0;
          this.loadProblem();
        });
      }
      if (this.dom.btnConcReset) {
        this.dom.btnConcReset.addEventListener("click", () => {
          this.resetToInitialState();
        });
      }

      // 3. 물 조작 버튼
      this.setupStepper(this.dom.btnMinusWater, () => this.adjustWater(-10), () => this.adjustWater(-10));
      this.setupStepper(this.dom.btnPlusWater, () => this.adjustWater(10), () => this.adjustWater(10));

      // 물 퀵 버튼
      document.querySelectorAll("[data-water-delta]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const delta = parseInt(btn.getAttribute("data-water-delta"), 10);
          this.adjustWater(delta);
        });
      });

      // 4. 설탕 조작 버튼
      this.setupStepper(this.dom.btnMinusSugar, () => this.adjustSugar(-5), () => this.adjustSugar(-5));
      this.setupStepper(this.dom.btnPlusSugar, () => this.adjustSugar(5), () => this.adjustSugar(5));

      // 설탕 퀵 버튼
      document.querySelectorAll("[data-sugar-delta]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const delta = parseInt(btn.getAttribute("data-sugar-delta"), 10);
          this.adjustSugar(delta);
        });
      });

      // 5. 등식의 성질 배율 퀵 칩 버튼들
      document.querySelectorAll("[data-ratio-factor]").forEach((chip) => {
        chip.addEventListener("click", () => {
          this.applyRatioShortcut(chip.getAttribute("data-ratio-factor"));
        });
      });

      // 6. 힌트 토글
      if (this.dom.btnToggleHint) {
        this.dom.btnToggleHint.addEventListener("click", () => {
          this.toggleHint();
        });
      }

      // 7. 정답 제출
      if (this.dom.btnSubmitConcentration) {
        this.dom.btnSubmitConcentration.addEventListener("click", () => {
          this.checkSolution();
        });
      }

      // 8. 모달 닫기 / 다음 문제
      if (this.dom.btnConcModalNext) {
        this.dom.btnConcModalNext.addEventListener("click", () => {
          this.closeModal();
          this.nextQuestion();
        });
      }
      if (this.dom.btnConcModalClose) {
        this.dom.btnConcModalClose.addEventListener("click", () => {
          this.closeModal();
        });
      }

      // 사운드 토글
      if (this.dom.btnToggleSound) {
        this.dom.btnToggleSound.addEventListener("click", () => {
          sfx.enabled = !sfx.enabled;
          this.dom.btnToggleSound.textContent = sfx.enabled ? "🔊" : "🔇";
        });
      }

      // 난이도 탭 연동
      document.querySelectorAll(".diff-tab").forEach((tab) => {
        tab.addEventListener("click", (e) => {
          const diff = tab.getAttribute("data-diff");
          if (diff) {
            this.setDifficulty(diff);
          }
        });
      });
    }

    /**
     * 연속 클릭(Long press) 지원 스테퍼
     */
    setupStepper(button, onClick, onRepeat) {
      if (!button) return;

      const startHold = (e) => {
        e.preventDefault();
        onClick();
        this.holdTimeout = setTimeout(() => {
          this.holdInterval = setInterval(() => {
            onRepeat();
          }, 100);
        }, 350);
      };

      const clearHold = () => {
        clearTimeout(this.holdTimeout);
        clearInterval(this.holdInterval);
      };

      button.addEventListener("mousedown", startHold);
      button.addEventListener("mouseup", clearHold);
      button.addEventListener("mouseleave", clearHold);

      button.addEventListener("touchstart", startHold, { passive: false });
      button.addEventListener("touchend", clearHold);
      button.addEventListener("touchcancel", clearHold);
    }

    setDifficulty(diff) {
      this.difficulty = diff;
      const limits = { basic: 30, standard: 40, challenge: 60 };
      this.timeLimit = limits[diff] || 40;
      this.currentQuestion = 1;
      this.score = 0;
      this.correctCount = 0;
      this.loadProblem();
    }

    switchMode(mode) {
      if (mode === "concentration") {
        if (this.dom.btnModeConcentration) this.dom.btnModeConcentration.classList.add("active");
        if (this.dom.btnModeScale) this.dom.btnModeScale.classList.remove("active");
        if (this.dom.concentrationContainer) this.dom.concentrationContainer.classList.remove("hidden");
        if (this.dom.scaleToolbar) this.dom.scaleToolbar.style.display = "none";
        if (this.dom.scaleMain) this.dom.scaleMain.style.display = "none";
        this.loadProblem();
      } else {
        if (this.dom.btnModeConcentration) this.dom.btnModeConcentration.classList.remove("active");
        if (this.dom.btnModeScale) this.dom.btnModeScale.classList.add("active");
        if (this.dom.concentrationContainer) this.dom.concentrationContainer.classList.add("hidden");
        if (this.dom.scaleToolbar) this.dom.scaleToolbar.style.display = "";
        if (this.dom.scaleMain) this.dom.scaleMain.style.display = "";
        this.stopTimer();
      }
    }

    loadProblem() {
      this.currentProblem = generateConcentrationProblem(this.difficulty, this.currentQuestion);
      this.playerWater = this.currentProblem.initialLeft.water;
      this.playerSugar = this.currentProblem.initialLeft.sugar;

      this.isSubmitting = false;
      this.startTimer();
      this.render();
      sfx.sugarDrop();
    }

    resetToInitialState() {
      if (!this.currentProblem) return;
      this.playerWater = this.currentProblem.initialLeft.water;
      this.playerSugar = this.currentProblem.initialLeft.sugar;
      this.render();
      sfx.removeClick();
    }

    adjustWater(delta) {
      const next = Math.max(0, Math.min(800, this.playerWater + delta));
      if (next !== this.playerWater) {
        this.playerWater = next;
        if (delta > 0) {
          sfx.waterDrop();
          this.spawnParticle("💧");
        } else {
          sfx.removeClick();
        }
        this.render();
      }
    }

    adjustSugar(delta) {
      const next = Math.max(0, Math.min(400, this.playerSugar + delta));
      if (next !== this.playerSugar) {
        this.playerSugar = next;
        if (delta > 0) {
          sfx.sugarDrop();
          this.spawnParticle("🍬");
        } else {
          sfx.removeClick();
        }
        this.render();
      }
    }

    /**
     * 등식의 성질 배율 단축키 적용
     */
    applyRatioShortcut(factorStr) {
      if (!this.currentProblem) return;
      const t = this.currentProblem.target;
      let factor = parseFloat(factorStr);

      if (factorStr === "half") factor = 0.5;
      else if (factorStr === "third") factor = 1 / 3;

      if (this.currentProblem.fixedType === "water") {
        // 물이 이미 고정되어 있으므로 설탕을 배율에 맞게 설정
        this.playerSugar = Math.round(t.sugar * factor);
      } else {
        // 설탕이 이미 고정되어 있으므로 물을 배율에 맞게 설정
        this.playerWater = Math.round(t.water * factor);
      }

      sfx.matchGlow();
      this.render();
    }

    toggleHint() {
      if (this.dom.propertyRuleDesc) {
        const isHidden = this.dom.propertyRuleDesc.style.display === "none";
        this.dom.propertyRuleDesc.style.display = isHidden ? "block" : "none";
        if (this.dom.btnToggleHint) {
          this.dom.btnToggleHint.textContent = isHidden ? "💡 힌트 접기" : "💡 등식의 성질 힌트";
        }
      }
    }

    spawnParticle(emoji) {
      if (!this.dom.playerDropZone) return;
      const span = document.createElement("span");
      span.className = "drop-particle";
      span.textContent = emoji;
      span.style.left = `${Math.random() * 40 + 10}px`;
      span.style.fontSize = `${Math.random() * 8 + 14}px`;
      this.dom.playerDropZone.appendChild(span);
      setTimeout(() => span.remove(), 450);
    }

    // ==========================================
    // ⏱️ 타이머 관리
    // ==========================================
    startTimer() {
      this.stopTimer();
      const limits = { basic: 30, standard: 40, challenge: 60 };
      this.timeLimit = limits[this.difficulty] || 40;
      this.timeRemaining = this.timeLimit;
      this.startTime = Date.now();

      this.timerInterval = setInterval(() => {
        this.timeRemaining -= 0.1;
        if (this.timeRemaining <= 0) {
          this.timeRemaining = 0;
          this.stopTimer();
          this.handleTimeover();
        }
        this.renderTimer();
      }, 100);

      this.renderTimer();
    }

    stopTimer() {
      if (this.timerInterval) {
        clearInterval(this.timerInterval);
        this.timerInterval = null;
      }
    }

    renderTimer() {
      if (this.dom.currentTimer) {
        this.dom.currentTimer.textContent = `${this.timeRemaining.toFixed(1)}초`;
      }
      if (this.dom.timerGaugeFill) {
        const pct = Math.max(0, (this.timeRemaining / this.timeLimit) * 100);
        this.dom.timerGaugeFill.style.width = `${pct}%`;
        if (pct < 25) {
          this.dom.timerGaugeFill.style.backgroundColor = "#ef4444";
        } else if (pct < 50) {
          this.dom.timerGaugeFill.style.backgroundColor = "#f59e0b";
        } else {
          this.dom.timerGaugeFill.style.backgroundColor = "#10b981";
        }
      }
    }

    handleTimeover() {
      sfx.wrong();
      // 시간 초과 시 30% 감점
      this.score = Math.max(0, Math.round(this.score * 0.7));
      this.showModal({
        isSuccess: false,
        title: "⏱️ 시간 초과!",
        message: "시간이 초과되었습니다! 등식의 성질을 천천히 복습하고 다시 도전해보세요.",
        isTimeover: true,
      });
      this.render();
    }

    // ==========================================
    // 🎨 UI 렌더링
    // ==========================================
    render() {
      if (!this.currentProblem) return;
      const prob = this.currentProblem;
      const target = prob.target;

      // 1. 헤더 현황판 갱신
      if (this.dom.statQuestionProg) {
        this.dom.statQuestionProg.textContent = `문제 ${this.currentQuestion} / ${this.totalQuestions}`;
      }
      if (this.dom.statCurrentScore) {
        this.dom.statCurrentScore.textContent = `${this.score}점`;
      }
      if (this.dom.statCorrectCount) {
        this.dom.statCorrectCount.textContent = `${this.correctCount} / ${this.totalQuestions}`;
      }

      // 2. 미션 목표 텍스트
      if (this.dom.concGoalText) {
        if (prob.fixedType === "water") {
          this.dom.concGoalText.innerHTML = `왼쪽 비커에 <strong>물 ${prob.initialLeft.water}g</strong>이 채워져 있습니다. 하단 버튼으로 <strong>설탕</strong>을 조절하여 오른쪽 비커와 <strong>동일한 농도</strong>를 완성하세요!`;
        } else {
          this.dom.concGoalText.innerHTML = `왼쪽 비커에 <strong>설탕 ${prob.initialLeft.sugar}g</strong>이 놓여 있습니다. 하단 버튼으로 <strong>물</strong>을 조절하여 오른쪽 비커와 <strong>동일한 농도</strong>를 완성하세요!`;
        }
      }

      // 3. 등식의 성질 배너 안내
      if (this.dom.propertyRuleTitle && this.dom.propertyRuleDesc && this.dom.propertyFormulaPill) {
        const rule = prob.ratioRule;
        this.dom.propertyRuleTitle.textContent = `💡 등식의 성질 (${rule.type === "mul" ? "곱셈의 성질" : "나눗셈의 성질"}) 탐구`;

        let descText = "";
        let formulaText = "";

        if (prob.fixedType === "water") {
          const ratioVal = prob.initialLeft.water / target.water;
          const ratioDisplay = ratioVal >= 1 ? `× ${ratioVal}` : `÷ ${Math.round(1 / ratioVal)}`;
          descText = `오른쪽 비커의 물(${target.water}g)에 비해 왼쪽의 물(${prob.initialLeft.water}g)이 ${ratioDisplay}배입니다. 등식의 성질에 따라 설탕(${target.sugar}g)도 똑같이 ${ratioDisplay}을(를) 해주면 농도가 같아집니다!`;
          formulaText = `물: ${target.water}g ${ratioDisplay} = ${prob.initialLeft.water}g  ➔  설탕: ${target.sugar}g ${ratioDisplay} = ? g`;
        } else {
          const ratioVal = prob.initialLeft.sugar / target.sugar;
          const ratioDisplay = ratioVal >= 1 ? `× ${ratioVal}` : `÷ ${Math.round(1 / ratioVal)}`;
          descText = `오른쪽 비커의 설탕(${target.sugar}g)에 비해 왼쪽의 설탕(${prob.initialLeft.sugar}g)이 ${ratioDisplay}배입니다. 등식의 성질에 따라 물(${target.water}g)도 똑같이 ${ratioDisplay}을(를) 채워주면 농도가 같아집니다!`;
          formulaText = `설탕: ${target.sugar}g ${ratioDisplay} = ${prob.initialLeft.sugar}g  ➔  물: ${target.water}g ${ratioDisplay} = ? g`;
        }

        this.dom.propertyRuleDesc.textContent = descText;
        this.dom.propertyFormulaPill.textContent = formulaText;
      }

      // 4. 오른쪽 비커 (기준치) 렌더링
      if (this.dom.targetWaterText) this.dom.targetWaterText.textContent = `${target.water} g`;
      if (this.dom.targetSugarText) this.dom.targetSugarText.textContent = `${target.sugar} g`;
      if (this.dom.targetTotalText) this.dom.targetTotalText.textContent = `${target.total} g`;
      if (this.dom.targetConcText) this.dom.targetConcText.textContent = `${target.concentration.toFixed(1)} %`;

      this.updateBeakerLiquid(this.dom.targetLiquid, this.dom.targetSediment, target.water, target.sugar);

      // 5. 왼쪽 비커 (플레이어) 렌더링
      const playerTotal = this.playerWater + this.playerSugar;
      const playerConc = calcConcentration(this.playerWater, this.playerSugar);

      if (this.dom.playerWaterText) this.dom.playerWaterText.textContent = `${this.playerWater} g`;
      if (this.dom.playerSugarText) this.dom.playerSugarText.textContent = `${this.playerSugar} g`;
      if (this.dom.playerTotalText) this.dom.playerTotalText.textContent = `${playerTotal} g`;
      if (this.dom.playerConcText) {
        if (playerTotal === 0) {
          this.dom.playerConcText.textContent = "0.0 %";
        } else {
          this.dom.playerConcText.textContent = `${playerConc.toFixed(1)} %`;
        }
      }

      this.updateBeakerLiquid(this.dom.playerLiquid, this.dom.playerSediment, this.playerWater, this.playerSugar);

      // 6. 하단 조작기 수치 갱신
      if (this.dom.valCurrentWater) this.dom.valCurrentWater.textContent = `${this.playerWater} g`;
      if (this.dom.valCurrentSugar) this.dom.valCurrentSugar.textContent = `${this.playerSugar} g`;

      // 7. 중앙 굴절계 / 맛 센서 갱신
      this.updateComparator(playerConc, target.concentration, playerTotal);
    }

    /**
     * 비커 액체 수위 및 농도에 따른 색상 시뮬레이션
     */
    updateBeakerLiquid(liquidEl, sedimentEl, water, sugar) {
      if (!liquidEl) return;
      const total = water + sugar;
      if (total <= 0) {
        liquidEl.style.height = "0%";
        if (sedimentEl) sedimentEl.classList.remove("visible");
        return;
      }

      // 최대 500g 기준 비례 높이 (최소 10%, 최대 88%)
      const heightPercent = Math.min(88, Math.max(10, (total / 500) * 80));
      liquidEl.style.height = `${heightPercent}%`;

      // 농도에 따른 색상 보간
      const conc = calcConcentration(water, sugar);
      let bgGrad;

      if (conc <= 0) {
        bgGrad = "rgba(96, 165, 250, 0.45)"; // 투명 하늘빛 물
      } else if (conc <= 10) {
        bgGrad = "rgba(163, 230, 53, 0.55)"; // 연한 라임빛
      } else if (conc <= 20) {
        bgGrad = "rgba(251, 191, 36, 0.65)"; // 황금빛 설탕물
      } else if (conc <= 30) {
        bgGrad = "rgba(245, 158, 11, 0.75)"; // 진한 호박색
      } else {
        bgGrad = "rgba(217, 119, 6, 0.85)"; // 진한 캐러멜빛
      }

      liquidEl.style.backgroundColor = bgGrad;

      if (sedimentEl) {
        if (sugar > 0) {
          sedimentEl.classList.add("visible");
        } else {
          sedimentEl.classList.remove("visible");
        }
      }
    }

    /**
     * 중앙 농도 굴절계(Refractometer) 업데이트
     */
    updateComparator(playerConc, targetConc, total) {
      if (!this.dom.refractometerNeedle || !this.dom.refractometerStatus) return;

      if (total <= 0) {
        this.dom.refractometerNeedle.style.left = "50%";
        this.dom.refractometerStatus.className = "meter-status-pill";
        this.dom.refractometerStatus.textContent = "비커가 비어있음";
        return;
      }

      const diff = playerConc - targetConc;
      const absDiff = Math.abs(diff);

      // 바늘 위치 (-40% ~ +40%)
      const clampedOffset = Math.max(-42, Math.min(42, diff * 3));
      this.dom.refractometerNeedle.style.left = `calc(50% + ${clampedOffset}%)`;

      if (absDiff < 0.2) {
        this.dom.refractometerStatus.className = "meter-status-pill matched";
        this.dom.refractometerStatus.textContent = "✨ 농도 완벽 일치! (황금 비율)";
      } else if (diff < 0) {
        this.dom.refractometerStatus.className = "meter-status-pill too-dilute";
        this.dom.refractometerStatus.textContent = `💧 너무 싱거워요! (${diff.toFixed(1)}%)`;
      } else {
        this.dom.refractometerStatus.className = "meter-status-pill too-sweet";
        this.dom.refractometerStatus.textContent = `🍯 너무 달아요! (+${diff.toFixed(1)}%)`;
      }
    }

    // ==========================================
    // 🎯 정답 확인 및 채점
    // ==========================================
    checkSolution() {
      if (!this.currentProblem || this.isSubmitting) return;

      const prob = this.currentProblem;
      const goal = prob.goal;
      const playerConc = calcConcentration(this.playerWater, this.playerSugar);
      const targetConc = prob.target.concentration;

      const concDiff = Math.abs(playerConc - targetConc);
      const isCorrect = concDiff < 0.25;

      if (isCorrect) {
        this.isSubmitting = true;
        this.stopTimer();
        sfx.correct();

        // 점수 계산: 기본 100점 + 남은 시간 비례 스피드 점수(최대 100점)
        const speedBonus = Math.round((this.timeRemaining / this.timeLimit) * 100);
        const earnedScore = 100 + speedBonus;
        this.score += earnedScore;
        this.correctCount += 1;

        // 등식의 성질 상세 해설 HTML 작성
        const explanationHtml = this.buildExplanationHtml(prob, true, earnedScore, speedBonus);

        this.showModal({
          isSuccess: true,
          title: "🎉 정답입니다! 황금 비율 완성!",
          html: explanationHtml,
          btnNextText: this.currentQuestion < this.totalQuestions ? "다음 문제 풀기 ➔" : "🏆 스테이지 완주 결과 보기",
        });

      } else {
        sfx.wrong();
        // 오답 시 10% 감점
        const penalty = Math.round(this.score * 0.1);
        this.score = Math.max(0, this.score - penalty);

        const explanationHtml = this.buildExplanationHtml(prob, false, 0, 0);

        this.showModal({
          isSuccess: false,
          title: "❌ 아쉬워요! 농도가 일치하지 않습니다",
          html: explanationHtml,
          btnNextText: "다시 도전하기 🔄",
        });
      }

      this.render();
    }

    /**
     * 등식의 성질(곱셈·나눗셈) 심층 해설 HTML 빌더
     */
    buildExplanationHtml(prob, isSuccess, earnedScore, speedBonus) {
      const target = prob.target;
      const goal = prob.goal;
      const rule = prob.ratioRule;
      const fixedType = prob.fixedType;

      let ruleTitle = rule.type === "mul" ? "등식의 성질 [규칙 4 - 곱셈의 성질]" : "등식의 성질 [규칙 4 - 나눗셈의 성질]";
      let ruleSummary = rule.type === "mul"
        ? `등식의 양변에 <strong>같은 수(× ${rule.factor})</strong>를 곱하여도 등식은 성립하며, 비율(농도)은 변하지 않습니다!`
        : `등식의 양변을 <strong>0이 아닌 같은 수(÷ ${rule.factor})</strong>로 나누어도 등식은 성립하며, 비율(농도)은 변하지 않습니다!`;

      let stepDetail = "";
      if (fixedType === "water") {
        stepDetail = `
          <div class="exp-math-comparison">
            <div class="exp-math-col">
              <span class="exp-math-label">오른쪽 비커 (기준)</span>
              <span class="exp-math-val">물 ${target.water}g</span>
              <span class="exp-math-val sugar-val">설탕 ${target.sugar}g</span>
            </div>
            <div class="exp-math-col">
              <span class="exp-math-arrow">${rule.type === "mul" ? `× ${rule.factor}` : `÷ ${rule.factor}`}</span>
              <span style="font-size:0.75rem; color:#64748b; font-weight:700;">비율 적용</span>
            </div>
            <div class="exp-math-col">
              <span class="exp-math-label">왼쪽 비커 (정답)</span>
              <span class="exp-math-val">물 ${goal.water}g</span>
              <span class="exp-math-val sugar-val" style="color:#d97706;">설탕 ${goal.sugar}g</span>
            </div>
          </div>
          <p style="margin-top:8px; font-size:0.92rem; color:#334155;">
            주어진 물이 ${target.water}g에서 ${goal.water}g으로 <strong>${rule.label}</strong> 되었으므로,
            설탕 역시 똑같이 <strong>${target.sugar}g ${rule.type === "mul" ? `× ${rule.factor}` : `÷ ${rule.factor}`} = ${goal.sugar}g</strong>을 넣어야 동일한 농도(<strong>${target.concentration.toFixed(1)}%</strong>)가 유지됩니다!
          </p>
        `;
      } else {
        stepDetail = `
          <div class="exp-math-comparison">
            <div class="exp-math-col">
              <span class="exp-math-label">오른쪽 비커 (기준)</span>
              <span class="exp-math-val sugar-val">설탕 ${target.sugar}g</span>
              <span class="exp-math-val">물 ${target.water}g</span>
            </div>
            <div class="exp-math-col">
              <span class="exp-math-arrow">${rule.type === "mul" ? `× ${rule.factor}` : `÷ ${rule.factor}`}</span>
              <span style="font-size:0.75rem; color:#64748b; font-weight:700;">비율 적용</span>
            </div>
            <div class="exp-math-col">
              <span class="exp-math-label">왼쪽 비커 (정답)</span>
              <span class="exp-math-val sugar-val" style="color:#d97706;">설탕 ${goal.sugar}g</span>
              <span class="exp-math-val" style="color:#0284c7;">물 ${goal.water}g</span>
            </div>
          </div>
          <p style="margin-top:8px; font-size:0.92rem; color:#334155;">
            주어진 설탕이 ${target.sugar}g에서 ${goal.sugar}g으로 <strong>${rule.label}</strong> 되었으므로,
            물 역시 똑같이 <strong>${target.water}g ${rule.type === "mul" ? `× ${rule.factor}` : `÷ ${rule.factor}`} = ${goal.water}g</strong>을 채워야 동일한 농도(<strong>${target.concentration.toFixed(1)}%</strong>)가 유지됩니다!
          </p>
        `;
      }

      let scoreCard = "";
      if (isSuccess) {
        scoreCard = `
          <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:8px; padding:10px; display:flex; justify-content:space-around; align-items:center; margin-top:8px;">
            <div>기본 점수: <strong>+100점</strong></div>
            <div>⚡ 스피드 보너스: <strong>+${speedBonus}점</strong></div>
            <div style="color:#15803d; font-size:1.05rem;">획득: <strong>+${earnedScore}점</strong></div>
          </div>
        `;
      }

      return `
        <div class="explanation-modal-body">
          ${scoreCard}
          <div class="explanation-highlight-box">
            <div class="exp-rule-title">${ruleTitle}</div>
            <div class="exp-rule-text">${ruleSummary}</div>
            ${stepDetail}
          </div>
        </div>
      `;
    }

    showModal({ isSuccess, title, html, btnNextText }) {
      if (!this.dom.concModal) return;
      this.dom.concModalTitle.textContent = title;
      this.dom.concModalBody.innerHTML = html;
      if (this.dom.btnConcModalNext) {
        this.dom.btnConcModalNext.textContent = btnNextText || "확인";
        this.dom.btnConcModalNext.dataset.success = isSuccess ? "true" : "false";
      }
      this.dom.concModal.classList.remove("hidden");
    }

    closeModal() {
      if (this.dom.concModal) {
        this.dom.concModal.classList.add("hidden");
      }
    }

    nextQuestion() {
      const isSuccess = this.dom.btnConcModalNext && this.dom.btnConcModalNext.dataset.success === "true";

      if (!isSuccess) {
        // 오답인 경우 같은 문제 다시 풀기
        this.isSubmitting = false;
        return;
      }

      if (this.currentQuestion < this.totalQuestions) {
        this.currentQuestion += 1;
        this.loadProblem();
      } else {
        // 스테이지 완료!
        this.finishStage();
      }
    }

    finishStage() {
      sfx.stageClear();
      this.stopTimer();

      // 전역 랭킹 모달(stageClearModal)과 연동 지원
      const clearModal = document.getElementById("stageClearModal");
      if (clearModal) {
        const finalScoreEl = document.getElementById("clearFinalScore");
        const correctCountEl = document.getElementById("clearCorrectCount");
        const commentEl = document.getElementById("clearScoreComment");

        if (finalScoreEl) finalScoreEl.textContent = `${this.score}점`;
        if (correctCountEl) correctCountEl.textContent = `${this.correctCount} / ${this.totalQuestions} 문제 정답`;
        if (commentEl) {
          commentEl.textContent = `축하합니다! 설탕물 농도 연구소 5문제를 모두 완주하셨습니다. 등식의 성질을 완벽히 마스터하셨네요!`;
        }
        clearModal.classList.remove("hidden");
      } else {
        alert(`🎉 축하합니다! 5문제 완료! 최종 점수: ${this.score}점`);
      }
    }
  }

  // 인스턴스 전역 노출
  window.ConcentrationGame = ConcentrationGame;

  document.addEventListener("DOMContentLoaded", () => {
    window.concentrationGameInstance = new ConcentrationGame();
  });
})();
