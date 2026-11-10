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

  const MOCK_STORAGE_KEY = "sugar_merchant_mock_leaderboard_v2";

  // 기본 샘플 명예의 전당 랭커 데이터 (점수제 기반)
  const DEFAULT_MOCK_DATA = {
    basic: [
      { id: "m1", nickname: "빛의지훈", score: 960, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 24.5, totalSteps: 10, createdAt: Date.now() - 86400000 * 2 },
      { id: "m2", nickname: "등식의달인", score: 890, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 36.2, totalSteps: 11, createdAt: Date.now() - 86400000 },
      { id: "m3", nickname: "번개어깨", score: 810, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 42.1, totalSteps: 13, createdAt: Date.now() - 3600000 * 5 },
      { id: "m4", nickname: "수학꿈나무", score: 720, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 58.0, totalSteps: 15, createdAt: Date.now() - 3600000 * 2 },
      { id: "m5", nickname: "달콤설탕", score: 610, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 65.4, totalSteps: 16, createdAt: Date.now() - 3600000 },
    ],
    standard: [
      { id: "m6", nickname: "황금저울수호자", score: 940, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 42.8, totalSteps: 14, createdAt: Date.now() - 86400000 * 3 },
      { id: "m7", nickname: "방정식마스터", score: 865, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 58.4, totalSteps: 15, createdAt: Date.now() - 86400000 },
      { id: "m8", nickname: "설탕특공대", score: 780, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 69.2, totalSteps: 18, createdAt: Date.now() - 3600000 * 6 },
      { id: "m9", nickname: "균형천재", score: 690, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 85.0, totalSteps: 20, createdAt: Date.now() - 3600000 * 3 },
      { id: "m10", nickname: "포대계산기", score: 580, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 92.5, totalSteps: 22, createdAt: Date.now() - 1800000 },
    ],
    challenge: [
      { id: "m11", nickname: "수학올림피아드", score: 920, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 78.5, totalSteps: 18, createdAt: Date.now() - 86400000 * 4 },
      { id: "m12", nickname: "알고리즘신", score: 840, correctCount: 5, totalQuestions: 5, totalSolveTimeSec: 96.0, totalSteps: 21, createdAt: Date.now() - 86400000 * 2 },
      { id: "m13", nickname: "지게마스터", score: 750, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 112.4, totalSteps: 24, createdAt: Date.now() - 3600000 * 8 },
      { id: "m14", nickname: "설탕장인", score: 640, correctCount: 4, totalQuestions: 5, totalSolveTimeSec: 135.0, totalSteps: 27, createdAt: Date.now() - 3600000 * 4 },
      { id: "m15", nickname: "방정식탐험가", score: 510, correctCount: 3, totalQuestions: 5, totalSolveTimeSec: 150.2, totalSteps: 29, createdAt: Date.now() - 1200000 },
    ],
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
      return JSON.parse(raw);
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

    // 랭킹 목록 가져오기 (난이도별 TOP 20)
    async getLeaderboard(difficulty = "standard") {
      if (this.isCloudConnected()) {
        try {
          // 복합 색인(Index) 설정 번거로움 없이 즉시 작동하도록 난이도별 조회 후 클라이언트 정렬
          const snapshot = await firestoreDb
            .collection("leaderboard")
            .where("difficulty", "==", difficulty)
            .limit(100)
            .get();

          const list = [];
          snapshot.forEach((doc) => {
            const data = doc.data();
            list.push({
              id: doc.id,
              nickname: data.nickname || "익명",
              score: Math.max(0, Math.round(Number(data.score) || 0)),
              correctCount: Number(data.correctCount ?? 5),
              totalQuestions: Number(data.totalQuestions ?? 5),
              totalSolveTimeSec: Number(data.totalSolveTimeSec ?? data.solveTimeSec ?? 0),
              totalSteps: Number(data.totalSteps ?? data.stepCount ?? 0),
              createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now(),
            });
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

          return list.slice(0, 20);
        } catch (err) {
          console.warn("Firestore 조회 실패 (로컬 데이터로 대체):", err);
          // 실패 시 로컬 데이터 fallback
        }
      }

      // 로컬/데모 데이터 반환
      const mock = loadLocalMockLeaderboard();
      const list = mock[difficulty] || [];
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
      const sanitized = {
        nickname: String(entry.nickname || "설탕장수").trim().slice(0, 12),
        difficulty: entry.difficulty || "standard",
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
      if (!mock[sanitized.difficulty]) {
        mock[sanitized.difficulty] = [];
      }

      const newId = "local_" + Date.now();
      mock[sanitized.difficulty].push({
        ...sanitized,
        id: newId,
      });

      // 정렬 후 상위 30개만 유지
      mock[sanitized.difficulty].sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        if (a.totalSolveTimeSec !== b.totalSolveTimeSec) {
          return a.totalSolveTimeSec - b.totalSolveTimeSec;
        }
        return a.totalSteps - b.totalSteps;
      });
      if (mock[sanitized.difficulty].length > 30) {
        mock[sanitized.difficulty].length = 30;
      }

      saveLocalMockLeaderboard(mock);
      return { success: true, isCloud: false, id: newId };
    },
  };
})();
