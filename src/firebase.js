import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

/* Firebase 웹 설정.
   - 배포 시 별도 환경변수(VITE_FB_*)가 있으면 그 값을 우선 사용하고,
     없으면 아래 기본값(economy-game-investing 프로젝트)을 사용합니다.
   - 이 값들은 원래 클라이언트 번들에 실려 나가는 '공개용' 설정입니다.
     실제 보안은 Realtime Database의 '규칙(rules)'에서 잡습니다. */
const DEFAULT = {
  apiKey: "AIzaSyB_uWux_MGiQMxhNpEL-iZYFRqk0hZU0AE",
  authDomain: "economy-game-investing.firebaseapp.com",
  databaseURL: "https://economy-game-investing-default-rtdb.firebaseio.com",
  projectId: "economy-game-investing",
  storageBucket: "economy-game-investing.firebasestorage.app",
  messagingSenderId: "1018620315709",
  appId: "1:1018620315709:web:6077c3b19995d29d7d8254",
};

const cfg = {
  apiKey: import.meta.env.VITE_FB_API_KEY || DEFAULT.apiKey,
  authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN || DEFAULT.authDomain,
  databaseURL: import.meta.env.VITE_FB_DATABASE_URL || DEFAULT.databaseURL,
  projectId: import.meta.env.VITE_FB_PROJECT_ID || DEFAULT.projectId,
  appId: import.meta.env.VITE_FB_APP_ID || DEFAULT.appId,
};

export const firebaseReady = Boolean(cfg.apiKey && cfg.databaseURL);

let db = null;
if (firebaseReady) {
  try {
    db = getDatabase(initializeApp(cfg));
  } catch (e) {
    console.error("Firebase 초기화 실패:", e);
  }
}

export { db };
