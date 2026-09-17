import { db, firebaseReady } from "./firebase";
import { ref, get, set, remove } from "firebase/database";

/*
  키 매핑:
    "mg:game"       -> game        (전체 상태 { round, phase, newsId, rate, started })
    "mg:p:<학생id>"  -> players/<id> (학생별 기록)
  Firebase 미설정 시 모든 함수는 안전하게 no-op / null 을 돌려줍니다.
*/
export { firebaseReady };

function pathFor(key) {
  if (key === "mg:game") return "game";
  if (key.startsWith("mg:p:")) return "players/" + key.slice(5);
  return "misc/" + key.replace(/[.#$/[\]]/g, "_");
}

export async function sGet(key) {
  if (!db) return null;
  try {
    const snap = await get(ref(db, pathFor(key)));
    return snap.exists() ? snap.val() : null;
  } catch (e) {
    console.error("sGet 실패:", key, e);
    return null;
  }
}

export async function sSet(key, value) {
  if (!db) return;
  try {
    await set(ref(db, pathFor(key)), value);
  } catch (e) {
    console.error("sSet 실패:", key, e);
  }
}

export async function sList(prefix) {
  if (!db) return [];
  try {
    if (prefix === "mg:p:") {
      const snap = await get(ref(db, "players"));
      if (!snap.exists()) return [];
      return Object.keys(snap.val()).map((id) => "mg:p:" + id);
    }
    return [];
  } catch (e) {
    console.error("sList 실패:", prefix, e);
    return [];
  }
}

export async function sDel(key) {
  if (!db) return;
  try {
    await remove(ref(db, pathFor(key)));
  } catch (e) {
    console.error("sDel 실패:", key, e);
  }
}
