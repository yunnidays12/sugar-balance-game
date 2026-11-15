(() => {
  "use strict";

  // ==========================================================================
  // [설탕 장수 지훈이] Firebase Firestore 랭킹 데이터베이스 설정
  // ==========================================================================
  // Firebase 콘솔(https://console.firebase.google.com/)에서 무료 프로젝트를 만든 뒤,
  // '웹 앱 추가'에서 발급받은 아래 config 객체를 그대로 붙여넣으시면
  // 전 세계 모든 사용자와 실시간으로 공유되는 온라인 랭킹이 즉시 활성화됩니다!
  // ==========================================================================
  const firebaseConfig = {
    apiKey: "AIzaSyCt8X41ov0qvhVUzPSZpi2E6u_E6xkblDU",
    authDomain: "math-playing-sugar-seller.firebaseapp.com",
    projectId: "math-playing-sugar-seller",
    storageBucket: "math-playing-sugar-seller.firebasestorage.app",
    messagingSenderId: "1002438296404",
    appId: "1:1002438296404:web:12efd010ba1b0be26afec1",
    measurementId: "G-S5426W0FKD",
  };

  const MOCK_STORAGE_KEY = "sugar_merchant_mock_leaderboard_v3";

  // 기본 샘플 명예의 전당 랭커 데이터 (설탕 배달 vs 설탕물 만들기 분리)
  const DEFAULT_MOCK_DATA = {
    // ⚖️ 설탕 배달 (어깨 저울 모드)
    scale: {
      basic: [
        { id: "s_b1", nickname: "빛의지훈", score: 960, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 24.5, totalSteps: 10, gameMode: "scale", createdAt: Date.now() - 86400000 * 2 },
        { id: "s_b2", nickname: "등식의달인", score: 890, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 36.2, totalSteps: 11, gameMode: "scale", createdAt: Date.now() - 86400000 },
        { id: "s_b3", nickname: "번개어깨", score: 810, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 42.1, totalSteps: 13, gameMode: "scale", createdAt: Date.now() - 3600000 * 5 },
        { id: "s_b4", nickname: "수학꿈나무", score: 720, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 58.0, totalSteps: 15, gameMode: "scale", createdAt: Date.now() - 3600000 * 2 },
        { id: "s_b5", nickname: "달콤설탕", score: 610, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 65.4, totalSteps: 16, gameMode: "scale", createdAt: Date.now() - 3600000 },
      ],
      standard: [
        { id: "s_s1", nickname: "황금저울수호자", score: 940, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 42.8, totalSteps: 14, gameMode: "scale", createdAt: Date.now() - 86400000 * 3 },
        { id: "s_s2", nickname: "방정식마스터", score: 865, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 58.4, totalSteps: 15, gameMode: "scale", createdAt: Date.now() - 86400000 },
        { id: "s_s3", nickname: "설탕특공대", score: 780, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 69.2, totalSteps: 18, gameMode: "scale", createdAt: Date.now() - 3600000 * 6 },
        { id: "s_s4", nickname: "균형천재", score: 690, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 85.0, totalSteps: 20, gameMode: "scale", createdAt: Date.now() - 3600000 * 3 },
        { id: "s_s5", nickname: "포대계산기", score: 580, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 92.5, totalSteps: 22, gameMode: "scale", createdAt: Date.now() - 1800000 },
      ],
      challenge: [
        { id: "s_c1", nickname: "수학올림피아드", score: 920, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 78.5, totalSteps: 18, gameMode: "scale", createdAt: Date.now() - 86400000 * 4 },
        { id: "s_c2", nickname: "알고리즘신", score: 840, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 96.0, totalSteps: 21, gameMode: "scale", createdAt: Date.now() - 86400000 * 2 },
        { id: "s_c3", nickname: "지게마스터", score: 750, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 112.4, totalSteps: 24, gameMode: "scale", createdAt: Date.now() - 3600000 * 8 },
        { id: "s_c4", nickname: "설탕장인", score: 640, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 135.0, totalSteps: 27, gameMode: "scale", createdAt: Date.now() - 3600000 * 4 },
        { id: "s_c5", nickname: "방정식탐험가", score: 510, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 150.2, totalSteps: 29, gameMode: "scale", createdAt: Date.now() - 1200000 },
      ],
    },
    // 🧪 설탕물 만들기 (특제 설탕물 연구소 모드)
    concentration: {
      basic: [
        { id: "c_b1", nickname: "달콤시럽마스터", score: 975, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 21.3, totalSteps: 6, gameMode: "concentration", createdAt: Date.now() - 86400000 * 2 },
        { id: "c_b2", nickname: "농도박사", score: 910, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 32.0, totalSteps: 8, gameMode: "concentration", createdAt: Date.now() - 86400000 },
        { id: "c_b3", nickname: "황금비율장인", score: 835, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 41.5, totalSteps: 9, gameMode: "concentration", createdAt: Date.now() - 3600000 * 4 },
        { id: "c_b4", nickname: "설탕요정", score: 750, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 50.2, totalSteps: 11, gameMode: "concentration", createdAt: Date.now() - 3600000 * 2 },
        { id: "c_b5", nickname: "물조절달인", score: 640, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 62.1, totalSteps: 14, gameMode: "concentration", createdAt: Date.now() - 3600000 },
      ],
      standard: [
        { id: "c_s1", nickname: "굴절계의신", score: 955, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 35.8, totalSteps: 8, gameMode: "concentration", createdAt: Date.now() - 86400000 * 3 },
        { id: "c_s2", nickname: "비율의지배자", score: 885, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 48.2, totalSteps: 10, gameMode: "concentration", createdAt: Date.now() - 86400000 },
        { id: "c_s3", nickname: "특제연구원", score: 810, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 63.4, totalSteps: 12, gameMode: "concentration", createdAt: Date.now() - 3600000 * 5 },
        { id: "c_s4", nickname: "달콤비커", score: 720, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 75.0, totalSteps: 15, gameMode: "concentration", createdAt: Date.now() - 3600000 * 2 },
        { id: "c_s5", nickname: "스포이트장인", score: 590, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 88.6, totalSteps: 18, gameMode: "concentration", createdAt: Date.now() - 1800000 },
      ],
      challenge: [
        { id: "c_c1", nickname: "퍼펙트농도", score: 930, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 68.4, totalSteps: 12, gameMode: "concentration", createdAt: Date.now() - 86400000 * 4 },
        { id: "c_c2", nickname: "등식의마법사", score: 855, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 85.0, totalSteps: 15, gameMode: "concentration", createdAt: Date.now() - 86400000 * 2 },
        { id: "c_c3", nickname: "황금레시피수호자", score: 760, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 104.2, totalSteps: 18, gameMode: "concentration", createdAt: Date.now() - 3600000 * 7 },
        { id: "c_c4", nickname: "비율계산기", score: 660, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 122.5, totalSteps: 22, gameMode: "concentration", createdAt: Date.now() - 3600000 * 3 },
        { id: "c_c5", nickname: "설탕물탐험가", score: 530, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 142.0, totalSteps: 25, gameMode: "concentration", createdAt: Date.now() - 1200000 },
      ],
    },
  };

  let firestoreDb = null;
  let isCloudReady = false;

  // Firebase 초기화 시도
  try {
    const isConfigProvided =
      firebaseConfig &&
      firebaseConfig.apiKey &&
      firebaseConfig.apiKey !== "YOUR_API_KEY" &&
      firebaseConfig.projectId &&
      firebaseConfig.projectId !== "YOUR_PROJECT_ID";

    if (isConfigProvided && typeof window.firebase !== "undefined") {
      if (!window.firebase.apps.length) {
        window.firebase.initializeApp(firebaseConfig);
      }
      firestoreDb = window.firebase.firestore();
      isCloudReady = true;
      console.log("🔥 [Firebase] Firestore 실시간 랭킹 DB에 성공적으로 연결되었습니다!");
    } else {
      console.info("💡 [Firebase] API 키 설정 전입니다. 로컬/데모 랭킹 시스템으로 정상 작동합니다.");
    }
  } catch (err) {
    console.warn("⚠️ [Firebase] 초기화 중 알림 (로컬 모드로 전환):", err.message);
    isCloudReady = false;
  }

  // 로컬 목 데이터 읽기/저장
  function loadLocalMockLeaderboard() {
    try {
      const raw = localStorage.getItem(MOCK_STORAGE_KEY);
      if (!raw) {
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(DEFAULT_MOCK_DATA));
        return JSON.parse(JSON.stringify(DEFAULT_MOCK_DATA));
      }
      const parsed = JSON.parse(raw);
      // 기존 v2 단일 데이터 구조 호환성 처리
      if (!parsed.scale && !parsed.concentration) {
        const migrated = {
          scale: parsed,
          concentration: DEFAULT_MOCK_DATA.concentration,
        };
        localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    } catch {
      return JSON.parse(JSON.stringify(DEFAULT_MOCK_DATA));
    }
  }

  function saveLocalMockLeaderboard(data) {
    try {
      localStorage.setItem(MOCK_STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error(e);
    }
  }

  // ==========================================================================
  // 공개 API 모듈: window.SugarRanking
  // ==========================================================================
  window.SugarRanking = {
    // 클라우드 DB 연결 여부 반환
    isCloudConnected() {
      return isCloudReady && firestoreDb !== null;
    },

    // 랭킹 목록 가져오기 (게임 모드 및 난이도별 TOP 20)
    async getLeaderboard(difficulty = "standard", gameMode = "scale") {
      const targetMode = gameMode === "concentration" ? "concentration" : "scale";

      if (this.isCloudConnected()) {
        try {
          const snapshot = await firestoreDb
            .collection("leaderboard")
            .where("difficulty", "==", difficulty)
            .limit(100)
            .get();

          const list = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            const docMode = data.gameMode || "scale";
            if (docMode === targetMode) {
              list.push({
                id: doc.id,
                nickname: data.nickname || "익명",
                score: Math.max(0, Math.round(Number(data.score) || 0)),
                correctCount: Number(data.correctCount ?? 5),
                totalQuestions: Number(data.totalQuestions ?? 5),
                totalSolveTimeSec: Number(data.totalSolveTimeSec ?? data.solveTimeSec ?? 0),
                totalSteps: Number(data.totalSteps ?? data.stepCount ?? 0),
                gameMode: docMode,
                createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now(),
              });
            }
          });

          // 1순위: 최종 점수 높은 순, 2순위: 총 소요 시간 빠른 순, 3순위: 조작 단계 적은 순
          list.sort((a, b) => {
            if (b.score !== a.score) {
              return b.score - a.score;
            }
            if (a.totalSolveTimeSec !== b.totalSolveTimeSec) {
              return a.totalSolveTimeSec - b.totalSolveTimeSec;
            }
            return a.totalSteps - b.totalSteps;
          });

          if (list.length > 0) {
            return list.slice(0, 20);
          }
        } catch (err) {
          console.warn("Firestore 조회 실패 (로컬 데이터로 대체):", err);
        }
      }

      // 로컬/데모 데이터 반환
      const mock = loadLocalMockLeaderboard();
      const modeData = mock[targetMode] || DEFAULT_MOCK_DATA[targetMode] || {};
      const list = modeData[difficulty] || [];
      return [...list].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.totalSolveTimeSec !== b.totalSolveTimeSec) {
          return a.totalSolveTimeSec - b.totalSolveTimeSec;
        }
        return a.totalSteps - b.totalSteps;
      });
    },

    // 랭킹 점수 등록
    async submitScore(entry) {
      const targetMode = entry.gameMode === "concentration" ? "concentration" : "scale";
      const sanitized = {
        nickname: String(entry.nickname || "설탕장수").trim().slice(0, 12),
        difficulty: entry.difficulty || "standard",
        gameMode: targetMode,
        score: Math.max(0, Math.round(Number(entry.score) || 0)),
        correctCount: Math.min(5, Math.max(0, Number(entry.correctCount) || 0)),
        totalQuestions: 5,
        totalSolveTimeSec: Number(Number(entry.totalSolveTimeSec || entry.solveTimeSec || 0).toFixed(1)),
        totalSteps: Number(entry.totalSteps || entry.stepCount || 1),
        createdAt: Date.now(),
      };

      if (this.isCloudConnected()) {
        try {
          const docRef = await firestoreDb.collection("leaderboard").add({
            ...sanitized,
            serverTimestamp: window.firebase.firestore.FieldValue.serverTimestamp(),
          });
          return { success: true, isCloud: true, id: docRef.id };
        } catch (err) {
          console.warn("Firestore 저장 실패, 로컬에 저장합니다:", err);
        }
      }

      // 로컬/데모 저장소에 추가
      const mock = loadLocalMockLeaderboard();
      if (!mock[targetMode]) {
        mock[targetMode] = DEFAULT_MOCK_DATA[targetMode] || {};
      }
      if (!mock[targetMode][sanitized.difficulty]) {
        mock[targetMode][sanitized.difficulty] = [];
      }

      const newId = "local_" + Date.now();
      mock[targetMode][sanitized.difficulty].push({
        ...sanitized,
        id: newId,
      });

      // 정렬 후 상위 30개만 유지
      mock[targetMode][sanitized.difficulty].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.totalSolveTimeSec !== b.totalSolveTimeSec) {
          return a.totalSolveTimeSec - b.totalSolveTimeSec;
        }
        return a.totalSteps - b.totalSteps;
      });
      if (mock[targetMode][sanitized.difficulty].length > 30) {
        mock[targetMode][sanitized.difficulty].length = 30;
      }

      saveLocalMockLeaderboard(mock);
      return { success: true, isCloud: false, id: newId };
    },

    // 랭킹 기록 삭제 (진행자/선생님 관리 기능)
    async deleteScore(id, gameMode = "scale", difficulty = "standard") {
      let isCloudSuccess = false;
      if (this.isCloudConnected() && id && !String(id).startsWith("local_")) {
        try {
          await firestoreDb.collection("leaderboard").doc(id).delete();
          isCloudSuccess = true;
          console.log(`🗑️ [Firestore] 문서(${id})가 성공적으로 삭제되었습니다.`);
        } catch (err) {
          console.warn("Firestore 삭제 실패:", err);
        }
      }

      // 로컬/데모 저장소에서도 동시 삭제
      const mock = loadLocalMockLeaderboard();
      const targetMode = gameMode === "concentration" ? "concentration" : "scale";
      if (mock[targetMode] && mock[targetMode][difficulty]) {
        mock[targetMode][difficulty] = mock[targetMode][difficulty].filter((item) => item.id !== id);
        saveLocalMockLeaderboard(mock);
      }

      return { success: true, isCloud: isCloudSuccess };
    },
  };
})();
