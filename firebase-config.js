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
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
  };

  const MOCK_STORAGE_KEY = "sugar_merchant_mock_leaderboard_v1";

  // 기본 샘플 명예의 전당 랭커 데이터 (Firebase 연동 전 데모용)
  const DEFAULT_MOCK_DATA = {
    basic: [
      { id: "m1", nickname: "설탕장수지훈", solveTimeSec: 6.8, stepCount: 2, remainingSec: 23.2, equation: "2x + 3 = 11", ansX: 4, createdAt: Date.now() - 86400000 * 2 },
      { id: "m2", nickname: "등식의달인", solveTimeSec: 8.5, stepCount: 2, remainingSec: 21.5, equation: "3x + 1 = 13", ansX: 4, createdAt: Date.now() - 86400000 },
      { id: "m3", nickname: "번개어깨", solveTimeSec: 10.2, stepCount: 3, remainingSec: 19.8, equation: "2x + 4 = 10", ansX: 3, createdAt: Date.now() - 3600000 * 5 },
      { id: "m4", nickname: "수학꿈나무", solveTimeSec: 14.1, stepCount: 3, remainingSec: 15.9, equation: "3x + 2 = 14", ansX: 4, createdAt: Date.now() - 3600000 * 2 },
      { id: "m5", nickname: "달콤설탕", solveTimeSec: 18.4, stepCount: 4, remainingSec: 11.6, equation: "4x + 1 = 13", ansX: 3, createdAt: Date.now() - 3600000 },
    ],
    standard: [
      { id: "m6", nickname: "황금저울수호자", solveTimeSec: 11.4, stepCount: 3, remainingSec: 28.6, equation: "3x + 2 = x + 8", ansX: 3, createdAt: Date.now() - 86400000 * 3 },
      { id: "m7", nickname: "빛의속도", solveTimeSec: 13.8, stepCount: 3, remainingSec: 26.2, equation: "4x + 1 = 2x + 9", ansX: 4, createdAt: Date.now() - 86400000 },
      { id: "m8", nickname: "방정식마스터", solveTimeSec: 16.5, stepCount: 4, remainingSec: 23.5, equation: "3x + 5 = x + 11", ansX: 3, createdAt: Date.now() - 3600000 * 6 },
      { id: "m9", nickname: "설탕특공대", solveTimeSec: 21.2, stepCount: 4, remainingSec: 18.8, equation: "5x + 2 = 2x + 14", ansX: 4, createdAt: Date.now() - 3600000 * 3 },
      { id: "m10", nickname: "균형천재", solveTimeSec: 25.7, stepCount: 5, remainingSec: 14.3, equation: "4x + 3 = x + 15", ansX: 4, createdAt: Date.now() - 1800000 },
    ],
    challenge: [
      { id: "m11", nickname: "수학올림피아드", solveTimeSec: 19.3, stepCount: 4, remainingSec: 40.7, equation: "6x + 4 = 2x + 24", ansX: 5, createdAt: Date.now() - 86400000 * 4 },
      { id: "m12", nickname: "알고리즘신", solveTimeSec: 24.6, stepCount: 4, remainingSec: 35.4, equation: "4x + 6 = 2x + 16", ansX: 5, createdAt: Date.now() - 86400000 * 2 },
      { id: "m13", nickname: "지게마스터", solveTimeSec: 31.8, stepCount: 5, remainingSec: 28.2, equation: "5x + 3 = x + 23", ansX: 5, createdAt: Date.now() - 3600000 * 8 },
      { id: "m14", nickname: "설탕장인", solveTimeSec: 38.5, stepCount: 6, remainingSec: 21.5, equation: "6x + 3 = 3x + 18", ansX: 5, createdAt: Date.now() - 3600000 * 4 },
      { id: "m15", nickname: "포대계산기", solveTimeSec: 46.2, stepCount: 6, remainingSec: 13.8, equation: "5x + 4 = 2x + 19", ansX: 5, createdAt: Date.now() - 1200000 },
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
              solveTimeSec: Number(data.solveTimeSec) || 0,
              stepCount: Number(data.stepCount) || 0,
              remainingSec: Number(data.remainingSec) || 0,
              equation: data.equation || "",
              ansX: Number(data.ansX) || 0,
              createdAt: data.createdAt ? (data.createdAt.toMillis ? data.createdAt.toMillis() : data.createdAt) : Date.now(),
            });
          });

          // 1순위: 해결 시간 빠른 순, 2순위: 조작 단계 적은 순으로 정렬 후 상위 20개 반환
          list.sort((a, b) => {
            if (a.solveTimeSec !== b.solveTimeSec) {
              return a.solveTimeSec - b.solveTimeSec;
            }
            return a.stepCount - b.stepCount;
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
        if (a.solveTimeSec !== b.solveTimeSec) {
          return a.solveTimeSec - b.solveTimeSec; // 1순위: 해결 시간 빠른 순
        }
        return a.stepCount - b.stepCount; // 2순위: 조작 단계 적은 순
      });
    },

    // 랭킹 점수 등록
    async submitScore(entry) {
      const sanitized = {
        nickname: String(entry.nickname || "설탕장수").trim().slice(0, 12),
        difficulty: entry.difficulty || "standard",
        solveTimeSec: Number(Number(entry.solveTimeSec).toFixed(1)),
        stepCount: Number(entry.stepCount) || 1,
        remainingSec: Number(Number(entry.remainingSec).toFixed(1)),
        equation: String(entry.equation || ""),
        ansX: Number(entry.ansX) || 1,
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
        if (a.solveTimeSec !== b.solveTimeSec) {
          return a.solveTimeSec - b.solveTimeSec;
        }
        return a.stepCount - b.stepCount;
      });
      if (mock[sanitized.difficulty].length > 30) {
        mock[sanitized.difficulty].length = 30;
      }

      saveLocalMockLeaderboard(mock);
      return { success: true, isCloud: false, id: newId };
    },
  };
})();
