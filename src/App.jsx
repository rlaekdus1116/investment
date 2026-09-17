import React, { useState, useEffect, useRef } from "react";
import { sGet, sSet, sList, sDel, firebaseReady } from "./storage";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";

/* =========================================================
   머니 서바이벌 2 — 인생 대모험 (생애주기 서바이벌)
   · 혼자 연습: 한 화면에서 인생 전체(28세→노후)를 진행
   · 수업 참여: 다연쌤이 '한 해 넘기기 / 속보'를 눌러 전원 동시 진행
   · 다연쌤: 라운드·금리·속보 제어 + 실시간 현황판
   1 단위 = 10만원 · 1 라운드 = 4년
   ========================================================= */

const FONT = `
@import url('https://fonts.googleapis.com/css2?family=Black+Han+Sans&family=Gothic+A1:wght@400;500;700;900&display=swap');
* { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
::-webkit-scrollbar { width: 8px; height: 8px; }
::-webkit-scrollbar-thumb { background: #c9a24baa; border-radius: 8px; }
@keyframes flipIn { from { transform: rotateY(90deg); opacity:0 } to { transform: rotateY(0); opacity:1 } }
@keyframes pop { 0%{transform:scale(.85);opacity:0} 60%{transform:scale(1.04)} 100%{transform:scale(1);opacity:1} }
@keyframes blink { 0%,100%{opacity:1} 50%{opacity:.2} }
@keyframes shimmer { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
@keyframes shake { 0%,100%{transform:translateX(0)} 25%{transform:translateX(-4px)} 75%{transform:translateX(4px)} }
@keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
@keyframes slideDown { from{transform:translateY(-20px);opacity:0} to{transform:translateY(0);opacity:1} }
@keyframes pulseRed { 0%,100%{box-shadow:0 0 0 0 #ef444466} 50%{box-shadow:0 0 0 8px #ef444400} }
@keyframes floaty { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-6px)} }
`;

const C = {
  bg: "linear-gradient(170deg,#fff5e8 0%,#fdeef4 48%,#edf2ff 100%)",
  panel: "#ffffff", panel2: "#f5f1fb",
  gold: "#bb7d10", goldDim: "#8a5b08",
  green: "#0f9d6e", red: "#df3b3b", text: "#232a3a",
  sub: "#79839a", line: "#ebe6f3", ink: "#2a1d04", blue: "#3b7de0",
};
const UNIT = 10;

/* ====== 직업 ====== */
const JOBS = [
  { name: "의사", emoji: "🩺", salary: 65, color: "#ef4444", tag: "고소득·안정" },
  { name: "사업가", emoji: "💼", salary: [30, 65], color: "#f59e0b", tag: "수입 변동 큼" },
  { name: "약사", emoji: "💊", salary: 50, color: "#10b981", tag: "탄탄한 전문직" },
  { name: "대기업", emoji: "🏢", salary: 40, color: "#3b82f6", tag: "안정적 직장인" },
  { name: "유튜버", emoji: "🎥", salary: [5, 68], color: "#ec4899", tag: "대박 아니면 쪽박" },
  { name: "공무원", emoji: "🏛️", salary: 25, color: "#6366f1", tag: "박봉이지만 철밥통·연금 든든" },
  { name: "중소기업", emoji: "🏭", salary: 22, color: "#64748b", tag: "성실한 직장인" },
  { name: "프리랜서", emoji: "🎨", salary: [15, 45], color: "#14b8a6", tag: "자유롭지만 불안정" },
];
const jobByName = (n) => JOBS.find((j) => j.name === n);
const rollSalary = (job) =>
  Array.isArray(job.salary) ? job.salary[0] + Math.floor(Math.random() * (job.salary[1] - job.salary[0] + 1)) : job.salary;

/* ====== 자산 ====== */
const ASSETS = [
  { key: "bitcoin", name: "비트코인", color: "#f7931a" },
  { key: "stock", name: "주식", color: "#34d399" },
  { key: "savings", name: "적금", color: "#60a5fa" },
  { key: "realestate", name: "부동산", color: "#f472b6" },
  { key: "luxury", name: "명품", color: "#c084fc" },
  { key: "checking", name: "입출금통장", color: "#94a3b8" },
];
const RISK_ASSETS = ["bitcoin", "stock", "realestate", "luxury", "savings", "checking"];
const assetName = (k) => (k === "parents" ? "부모님 효도" : ASSETS.find((a) => a.key === k)?.name || k);

/* 분산투자 항목 · 환금성(유동성) 안내 포함 */
const ALLOC = [
  { key: "bitcoin", name: "비트코인", emoji: "₿", color: "#f7931a", hint: "고위험 고수익 · 언제든 현금화" },
  { key: "stock", name: "주식", emoji: "📈", color: "#34d399", hint: "중위험 · 배당 나옴 · 바로 현금화" },
  { key: "savings", name: "적금", emoji: "🏦", color: "#60a5fa", hint: "안전·이자 · 중도해지 손해" },
  { key: "realestate", name: "부동산", emoji: "🏠", color: "#f472b6", hint: "묵직·인플레 방어 · 팔기 느림(반토막 매물)" },
  { key: "luxury", name: "명품", emoji: "👜", color: "#c084fc", hint: "감가 위험 · 리셀 대박도" },
  { key: "parents", name: "부모님 용돈", emoji: "🎁", color: "#fb7185", hint: "효도지수↑ (가끔 목돈 보답)" },
  { key: "checking", name: "입출금통장", emoji: "💳", color: "#94a3b8", hint: "그냥 보관 (변동 없음)" },
];

const CAT = { 경제: "#e8c14d", 국제: "#60a5fa", IT: "#34d399", 부동산: "#fb923c", 사회: "#c084fc", 건강: "#ef4444" };

/* ====== 속보 이벤트 ======
   returns: 자산별 등락률 · rateDelta: 기준금리 변동 · parentsReturn: 효도 보답
   swan: 블랙스완(고정 피해, 보험으로 방어) */
const EVENTS = [
  { id: "btc_etf", cat: "경제", icon: "🚀", title: "비트코인 현물 ETF에 기관 자금 폭발… 코인시장 환호",
    body: "글로벌 대형 운용사들이 일제히 코인 매수에 나섰습니다. '디지털 금' 내러티브가 부활했습니다.",
    ticker: "비트코인 +60%·역대급 거래량·공포탐욕지수 '극도의 탐욕'",
    returns: { bitcoin: 0.6, stock: 0.05, savings: 0.004 } },
  { id: "ai_boom", cat: "IT", icon: "🤖", title: "AI 반도체 슈퍼사이클… 기술주 폭등",
    body: "AI 수요 폭발로 관련 기업 실적 전망이 상향됐습니다. 기술주 중심으로 매수세가 몰렸습니다.",
    ticker: "기술주 +42%·AI 반도체 품귀·어닝 서프라이즈",
    returns: { stock: 0.42, bitcoin: 0.06, savings: 0.004 } },
  { id: "housing_up", cat: "부동산", icon: "🏗️", title: "역세권 아파트값 급등… '지금 아니면 못 산다' 패닉바잉",
    body: "공급 부족과 저금리 기대가 겹치며 집값이 뛰었습니다. 부동산을 가진 사람만 웃었습니다.",
    ticker: "부동산 +30%·청약 경쟁률 최고·전세도 상승",
    returns: { realestate: 0.30, stock: 0.02 } },
  { id: "luxury_resell", cat: "사회", icon: "👜", title: "한정판 명품 리셀가 폭등… 매장마다 '오픈런'",
    body: "인기 브랜드의 가격 인상과 품귀가 맞물리며 중고 명품 시세가 치솟았습니다.",
    ticker: "명품 +28%·오픈런 대란·리셀 거래 폭주",
    returns: { luxury: 0.28, stock: 0.03, savings: 0.004 } },
  { id: "savings_gift", cat: "사회", icon: "🏦", title: "정부, 청년 적금 이자 두 배 우대 정책 발표",
    body: "안정적 자산 형성을 돕기 위한 파격 정책이 나왔습니다. 적금 가입자에게 추가 이자가 지급됩니다.",
    ticker: "적금 우대금리 지급·가입 문의 폭주",
    returns: { savings: 0.06 } },
  { id: "rate_up", cat: "경제", icon: "📉", title: "기준금리 깜짝 인상… 코인·증시 동반 급락, 대출자 비명",
    body: "중앙은행이 예상을 깨고 금리를 크게 올렸습니다. 위험자산에서 돈이 빠지고 대출 이자가 치솟습니다.",
    ticker: "비트코인 -45%·코스피 약세·대출금리 급등·예적금은 상승",
    returns: { bitcoin: -0.45, stock: -0.14, realestate: -0.10, savings: 0.012, luxury: -0.03 },
    rateDelta: 0.02 },
  { id: "hyperinflation", cat: "경제", icon: "🌡️", title: "초인플레이션 공포… 대출이자 눈덩이, 영끌족 초비상",
    body: "물가가 통제를 벗어나자 금리가 다시 뛰었습니다. 빚으로 투자한 사람들의 이자 부담이 폭발합니다.",
    ticker: "금리 급등·대출이자 눈덩이·현금가치 하락·실물 상승",
    returns: { bitcoin: -0.20, stock: -0.10, realestate: 0.05, luxury: 0.08, savings: 0.005, checking: -0.06 },
    rateDelta: 0.03 },
  { id: "rate_cut", cat: "경제", icon: "🕊️", title: "경기 부양 위해 금리 인하… 위험자산에 훈풍",
    body: "중앙은행이 금리를 내리자 대출 부담이 줄고 투자 심리가 살아났습니다.",
    ticker: "금리 인하·대출이자 완화·증시·코인 반등",
    returns: { stock: 0.12, bitcoin: 0.15, realestate: 0.06 },
    rateDelta: -0.02 },
  { id: "inflation", cat: "경제", icon: "🔥", title: "물가 고공행진… 통장 속 현금 가치 '눈 녹듯'",
    body: "고물가가 이어지며 통장에 묶인 현금의 실질가치가 하락했습니다. 실물·코인이 방어수단으로 주목됩니다.",
    ticker: "물가 6%대·현금가치 하락·실물자산 강세",
    returns: { bitcoin: 0.18, stock: -0.04, realestate: 0.10, luxury: 0.06, savings: -0.005, checking: -0.05 },
    rateDelta: 0.01 },
  { id: "crisis", cat: "국제", icon: "🌪️", title: "글로벌 금융위기 공포 확산… 자산시장 패닉",
    body: "대형 금융기관 부실 우려가 번지며 전 세계 증시가 동반 폭락했습니다. 빚투자자들은 반대매매 위기에 몰렸습니다.",
    ticker: "코스피 -38%·비트코인 -35%·부동산 급랭·반대매매 속출",
    returns: { bitcoin: -0.35, stock: -0.38, realestate: -0.20, savings: 0.0, luxury: -0.18 } },
  { id: "filial", cat: "사회", icon: "🎁", title: "'효도 보답' 훈훈… 부모님이 목돈으로 화답",
    body: "그동안 꾸준히 용돈을 드린 자녀들에게 부모님이 목돈을 돌려주는 사례가 화제입니다.",
    ticker: "효도 누적액의 80% 보답·따뜻한 미담 확산",
    returns: { savings: 0.004 }, parentsReturn: 0.8 },
  /* ── 블랙스완 (보험으로 방어) ── */
  { id: "swan_cancer", cat: "건강", icon: "🏥", title: "[블랙스완] 갑작스런 큰 병… 치료비 폭탄",
    body: "예고 없이 찾아온 큰 병. 목돈이 치료비로 빠져나갑니다. 실비·건강보험이 있다면 대부분 막을 수 있습니다.",
    ticker: "치료비 급증·간병 부담·보험 가입자만 방어 성공",
    returns: {}, swan: { label: "치료비", hit: 40 } },
  { id: "swan_accident", cat: "건강", icon: "🚑", title: "[블랙스완] 교통사고… 수리비·병원비 동시에",
    body: "갑작스런 사고로 큰돈이 나갑니다. 보험이 있으면 피해를 크게 줄일 수 있습니다.",
    ticker: "사고 다발·수리비 폭등·무보험자 직격탄",
    returns: {}, swan: { label: "사고 피해", hit: 28 } },
  { id: "swan_fraud", cat: "사회", icon: "🎣", title: "[블랙스완] 투자사기·보이스피싱 기승",
    body: "'원금 보장 고수익'에 속아 큰돈을 날리는 피해가 속출합니다. 의심스러우면 절대 송금 금지!",
    ticker: "사기 피해 급증·환급 어려움·보험도 일부만 보상",
    returns: {}, swan: { label: "사기 피해", hit: 34, coverage: 0.5 } },
];
const eventById = (id) => EVENTS.find((e) => e.id === id);

/* ====== 생애주기 ====== */
const START_AGE = 28;
const YEARS_PER_ROUND = 4;
const RETIRE_AGE = 60;
const ageForRound = (r) => START_AGE + (r - 1) * YEARS_PER_ROUND;
function stageForAge(age) {
  if (age < 30) return { key: "s20", label: "사회초년생 (20대)", emoji: "🌱", tone: "#34d399", desc: "첫 월급! 저축 습관이 평생을 좌우해요" };
  if (age < 40) return { key: "s30", label: "30대", emoji: "💍", tone: "#60a5fa", desc: "결혼·전세·차… 인생 최대 지출기" };
  if (age < 50) return { key: "s40", label: "40대", emoji: "👔", tone: "#f59e0b", desc: "소득 전성기 & 자녀 사교육비 폭탄" };
  if (age < 60) return { key: "s50", label: "50대", emoji: "🧭", tone: "#a78bfa", desc: "은퇴 준비 마지막 골든타임" };
  return { key: "s60", label: "은퇴 (60대+)", emoji: "🎏", tone: "#fb7185", desc: "근로소득 끝! 모아둔 자산으로 산다" };
}
const ageFactor = (age) => (age < 30 ? 0.8 : age < 40 ? 1.0 : age < 50 ? 1.3 : age < 60 ? 1.05 : 0);
const livingCost = (age) => (age < 30 ? 8 : age < 40 ? 18 : age < 50 ? 28 : age < 60 ? 22 : 16);
const PENSION_BASE = 12;              // 은퇴 후 기본 연금
const PENSION_BONUS = { 공무원: 10 }; // 공무원 연금 우대
const DIV_YIELD = 0.03;              // 주식 배당률
const LOAN_SPREAD = 0.03;            // 대출 가산금리 (기준금리 + 3%)
const INS_PREMIUM = 3;              // 보험료(고정)
const DEFAULT_RATE = 0.03;         // 시작 기준금리 3%
const loanRate = (rate) => rate + LOAN_SPREAD;

/* ====== 공유 저장소 키 ====== */
const GKEY = "mg:game";
const pkey = (id) => `mg:p:${id}`;
function syncSafe(id, obj) { sSet(pkey(id), { ...obj }); }

/* ====== 유틸 ====== */
const fmt = (units) => {
  const man = Math.round(units) * UNIT;
  if (man === 0) return "0원";
  const s = man < 0 ? "-" : "", a = Math.abs(man);
  if (a >= 10000) { const e = Math.floor(a / 10000), r = a % 10000; return `${s}${e}억${r ? " " + r.toLocaleString() + "만" : ""}원`; }
  return `${s}${a.toLocaleString()}만원`;
};
const assetsSum = (p) => (p.bitcoin || 0) + (p.stock || 0) + (p.savings || 0) + (p.realestate || 0) + (p.luxury || 0) + (p.checking || 0);
const netWorth = (p) => assetsSum(p) - (p.loan || 0);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

/* 스트레스(0~100): 빚 비율 + 파산 위험 */
function stressOf(p) {
  const assets = assetsSum(p), loan = p.loan || 0;
  let s = 0;
  if (loan > 0) s += clamp((loan / Math.max(1, assets)) * 60, 0, 70);
  if (netWorth(p) < 0) s = 100;
  else if (netWorth(p) < 20) s = Math.max(s, 55);
  return Math.round(clamp(s, 0, 100));
}
/* 아바타 표정 */
function avatarOf(p) {
  if (p.bankrupt || netWorth(p) < 0) return { face: "😵", label: "파산…", color: C.red };
  const st = stressOf(p), net = netWorth(p);
  if (st >= 60) return { face: "😰", label: "빚 스트레스", color: C.red };
  if (net >= 400) return { face: "😎", label: "부자!", color: C.gold };
  if (net >= 150) return { face: "😊", label: "든든", color: C.green };
  return { face: "🙂", label: "차근차근", color: C.blue };
}

/* ====== 한 해(라운드) 시작: 소득·지출 정산 ====== */
function startRound(prev, round, rate) {
  const p = { ...prev };
  const age = ageForRound(round);
  const retired = age >= RETIRE_AGE;
  const job = jobByName(p.job);
  const work = retired
    ? PENSION_BASE + (PENSION_BONUS[p.job] || 0)
    : Math.round(rollSalary(job) * ageFactor(age));
  const interest = Math.round((p.savings || 0) * rate);
  const dividend = Math.round((p.stock || 0) * DIV_YIELD);
  const living = livingCost(age);
  const loanInt = Math.round((p.loan || 0) * loanRate(rate));
  const premium = p.insured ? INS_PREMIUM : 0;
  const net = work + interest + dividend - living - loanInt - premium;
  p.checking = (p.checking || 0) + net;
  let deficitToLoan = 0;
  if (p.checking < 0) { deficitToLoan = -p.checking; p.loan = (p.loan || 0) + deficitToLoan; p.checking = 0; }
  p.age = age; p.round = round; p.retired = retired; p.rate = rate;
  p.lastSalaryAmt = work; p.lastSalaryRound = round; p.ready = false;
  p.income = { work, retired, interest, dividend, living, loanInt, premium, net, deficitToLoan };
  return p;
}

/* ====== 속보 정산: 등락 + 블랙스완 + 반대매매 + 파산판정 ======
   주의: 전달된 record(r)를 직접 수정합니다. 호출부에서 사본을 넘기세요. */
function applyNews(r, event, round) {
  const lines = []; let total = 0;
  const ret = event.returns || {};
  ["bitcoin", "stock", "savings", "realestate", "luxury", "checking"].forEach((k) => {
    const before = r[k] || 0, rate = ret[k] || 0;
    if (before <= 0 && rate === 0) return;
    const after = Math.max(0, Math.round(before * (1 + rate)));
    const diff = after - before; r[k] = after; total += diff;
    lines.push({ key: k, before, after, diff, rate });
  });
  if (event.parentsReturn && (r.parents || 0) > 0) {
    const bonus = Math.round(r.parents * event.parentsReturn);
    r.checking += bonus; total += bonus;
    lines.push({ key: "parents", before: 0, after: bonus, diff: bonus, rate: event.parentsReturn, isParents: true });
  }
  /* 블랙스완 */
  let swan = null;
  if (event.swan) {
    const raw = event.swan.hit;
    const coverRate = event.swan.coverage != null ? event.swan.coverage : 0.9;
    const covered = r.insured ? Math.round(raw * coverRate) : 0;
    const damage = raw - covered;
    let rem = damage;
    for (const k of ["checking", "savings", "stock", "bitcoin", "realestate", "luxury"]) {
      if (rem <= 0) break;
      const take = Math.min(r[k] || 0, rem); r[k] = (r[k] || 0) - take; rem -= take;
    }
    if (rem > 0) r.loan = (r.loan || 0) + rem; // 자산으로 못 막으면 빚
    total -= damage;
    swan = { label: event.swan.label, raw, covered, damage, insured: !!r.insured };
  }
  /* 반대매매(마진콜): 빚 대비 자산이 너무 쪼그라들면 강제 청산 */
  let margin = null;
  if ((r.loan || 0) > 0) {
    const assets = assetsSum(r);
    if (assets < r.loan * 1.2) {
      const repay = Math.min(assets, r.loan);
      const leftover = assets - repay;
      r.bitcoin = 0; r.stock = 0; r.savings = 0; r.realestate = 0; r.luxury = 0;
      r.checking = Math.max(0, leftover);
      r.loan = Math.max(0, r.loan - repay);
      margin = { sold: assets, repay, remainLoan: r.loan };
    }
  }
  const bankrupt = netWorth(r) < 0;
  r.bankrupt = bankrupt;
  return { round, eventId: event.id, title: event.title, total, lines, swan, margin, bankrupt };
}

/* ===================================================================== */
export default function App() {
  const [mode, setMode] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Gothic A1', sans-serif" }}>
      <style>{FONT}</style>
      {!mode ? <ModeSelect onPick={setMode} />
        : mode === "admin" ? <AdminView onBack={() => setMode(null)} />
        : <PlayGame mode={mode} onBack={() => setMode(null)} />}
    </div>
  );
}

/* ====== 공용 UI ====== */
function Centered({ children }) { return <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 20 }}>{children}</div>; }
function Btn({ children, onClick, color = C.gold, fill, small, disabled, full }) {
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ cursor: disabled ? "not-allowed" : "pointer", border: `2px solid ${color}`,
        background: fill ? color : "transparent", color: fill ? C.ink : color,
        fontFamily: "'Black Han Sans'", letterSpacing: 0.5, padding: small ? "8px 14px" : "13px 20px",
        fontSize: small ? 14 : 17, borderRadius: 12, opacity: disabled ? 0.4 : 1, width: full ? "100%" : "auto",
        boxShadow: fill && !disabled ? `0 4px 0 ${C.goldDim}` : "none" }}>{children}</button>
  );
}
const Title = ({ children, size = 30 }) => (
  <h1 style={{ fontFamily: "'Black Han Sans'", fontSize: size, margin: 0, letterSpacing: 1,
    background: `linear-gradient(95deg,#e07b2e,${C.gold})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>{children}</h1>
);
const SectionLabel = ({ children }) => <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 15 }}>{children}</div>;
const Badge = ({ children, color = C.gold }) => <span style={{ border: `1px solid ${color}`, color, borderRadius: 20, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{children}</span>;
const Empty = ({ children }) => <div style={{ background: C.panel, border: `1px dashed ${C.line}`, borderRadius: 14, padding: 24, textAlign: "center", color: C.sub, marginTop: 8 }}>{children}</div>;

/* ====== 모드 선택 ====== */
function ModeSelect({ onPick }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", animation: "pop .4s" }}>
        <div style={{ fontSize: 54, animation: "floaty 3s ease-in-out infinite" }}>💰</div>
        <Title size={44}>머니 서바이벌 2</Title>
        <p style={{ color: C.gold, fontFamily: "'Black Han Sans'", marginTop: 2 }}>인생 대모험 · 28세부터 노후까지</p>
        <p style={{ color: C.sub, marginTop: 8, maxWidth: 340, marginInline: "auto", lineHeight: 1.6 }}>
          직업을 뽑고, 월급을 굴리고, 금리·빚·블랙스완을 견디며 <b>파산 없이 노후까지 살아남아라!</b>
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 26, width: 300, marginInline: "auto" }}>
          <Btn fill onClick={() => onPick("solo")} full>🎮 혼자 연습 (내 인생 살아보기)</Btn>
          <Btn onClick={() => onPick("class")} full>🎓 수업 참여 (다연쌤과 함께)</Btn>
          <Btn color={C.sub} onClick={() => onPick("admin")} full>🖥️ 다연쌤 화면</Btn>
        </div>
        {!firebaseReady && (
          <p style={{ color: C.sub, fontSize: 11, marginTop: 18, maxWidth: 320, marginInline: "auto", lineHeight: 1.6 }}>
            ⚠️ 실시간 서버(Firebase)가 아직 연결 안 됨 → <b>혼자 연습</b>만 사용할 수 있어요.
          </p>
        )}
      </div>
    </Centered>
  );
}

/* ===================== 게임 (혼자/수업 공용) ===================== */
function PlayGame({ mode, onBack }) {
  const isClass = mode === "class";
  const [step, setStep] = useState("name"); // name|job|invest|waiting|news|end|dead
  const [name, setName] = useState("");
  const [rec, setRec] = useState(null);
  const [round, setRound] = useState(1);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [event, setEvent] = useState(null);
  const [phase, setPhase] = useState("invest");
  const [finalList, setFinalList] = useState([]);
  const idRef = useRef(uid());
  const recRef = useRef(null), roundRef = useRef(1), stepRef = useRef("name"), rateRef = useRef(DEFAULT_RATE);
  recRef.current = rec; roundRef.current = round; stepRef.current = step; rateRef.current = rate;

  const write = (r) => syncSafe(idRef.current, { ...r, id: idRef.current, name });

  /* 수업 모드: 다연쌤 상태 폴링 */
  useEffect(() => {
    if (!isClass) return;
    let active = true;
    const poll = async () => {
      const g = (await sGet(GKEY)) || { round: 1, phase: "invest", rate: DEFAULT_RATE };
      if (!active) return;
      setRound(g.round); setPhase(g.phase); setRate(g.rate ?? DEFAULT_RATE);
      if (g.phase === "end") {
        const keys = await sList("mg:p:");
        const list = (await Promise.all(keys.map((k) => sGet(k)))).filter(Boolean).sort((a, b) => netWorth(b) - netWorth(a));
        if (active) { setFinalList(list); setStep("end"); }
        return;
      }
      const r = recRef.current;
      if (!r) return;
      if (r.bankrupt) { if (stepRef.current !== "dead") setStep("dead"); return; }
      if (g.phase === "invest" && (r.lastSalaryRound || 0) < g.round) {
        const nr = startRound(r, g.round, g.rate ?? DEFAULT_RATE);
        setRec(nr); recRef.current = nr; setEvent(null); setStep("invest"); write(nr);
      } else if (g.phase === "news" && g.newsId && stepRef.current !== "news") {
        setEvent(eventById(g.newsId)); setStep("news");
      }
    };
    poll(); const iv = setInterval(poll, 1500);
    return () => { active = false; clearInterval(iv); };
  }, [isClass]);

  const startJob = (job) => {
    const rnd = isClass ? roundRef.current : 1;
    const rt = isClass ? rateRef.current : DEFAULT_RATE;
    const base = { id: idRef.current, name, job: job.name, bitcoin: 0, stock: 0, savings: 0, realestate: 0, luxury: 0,
      parents: 0, loan: 0, insured: false, ready: false, lastResult: null, jobChanged: false, bankrupt: false, history: [] };
    const r = startRound(base, rnd, rt);
    r.history = [{ round: rnd, age: r.age, net: netWorth(r) }];
    setRec(r); recRef.current = r; setStep("invest");
    write(r);
  };

  const confirmInvest = ({ alloc, newLoan, repay, insured }) => {
    const available = rec.checking + newLoan - repay;
    if (ALLOC.reduce((s, a) => s + (alloc[a.key] || 0), 0) !== available) return;
    const r = { ...rec };
    r.insured = insured;
    r.loan = Math.max(0, (rec.loan || 0) + newLoan - repay);
    r.bitcoin += alloc.bitcoin || 0; r.stock += alloc.stock || 0; r.savings += alloc.savings || 0;
    r.realestate += alloc.realestate || 0; r.luxury += alloc.luxury || 0; r.parents += alloc.parents || 0;
    r.checking = alloc.checking || 0;
    if (isClass) { r.ready = true; setRec(r); recRef.current = r; setStep("waiting"); write(r); }
    else { const ev = EVENTS[Math.floor(Math.random() * EVENTS.length)]; setRec(r); recRef.current = r; setEvent(ev); setStep("news"); }
  };

  const reveal = () => {
    const r = { ...rec };
    const res = applyNews(r, event, round); r.lastResult = res;
    r.history = [...(r.history || []), { round, age: ageForRound(round), net: netWorth(r) }];
    if (event.rateDelta && !isClass) { const nrate = clamp(rate + event.rateDelta, 0, 0.15); setRate(nrate); rateRef.current = nrate; }
    setRec(r); recRef.current = r; if (isClass) write(r);
    if (r.bankrupt && !isClass) { /* 솔로: 결과 화면에서 파산 표시 후 종료 버튼 */ }
  };

  const changeJob = (job) => {
    const r = { ...rec, job: job.name, jobChanged: true };
    r.checking = Math.max(0, r.checking - (r.lastSalaryAmt || 0));
    r.lastSalaryAmt = 0;
    if (r.income) r.income = { ...r.income, work: 0, net: r.income.net - (rec.lastSalaryAmt || 0) };
    setRec(r); recRef.current = r; setStep("invest"); write(r);
  };

  const nextYearSolo = () => {
    if (rec.bankrupt) { setStep("dead"); return; }
    const nrnd = round + 1;
    const r = startRound(rec, nrnd, rate);
    setRound(nrnd); roundRef.current = nrnd;
    setRec(r); recRef.current = r; setEvent(null); setStep("invest");
  };

  if (step === "name") return <JoinScreen name={name} setName={setName} onJoin={() => setStep("job")} onBack={onBack} sub={isClass ? "수업 참여" : "혼자 연습"} />;
  if (step === "job") return <JobPick name={name} onPickJob={startJob} onBack={() => setStep("name")} />;
  if (step === "rejob") return <JobPick name={name} onPickJob={changeJob} onBack={() => setStep("invest")} rejob />;
  if (step === "end") return <FinalRanking list={finalList} meId={idRef.current} onBack={onBack} />;
  if (step === "dead") return <BankruptScreen rec={rec} isClass={isClass} onBack={onBack} />;

  const job = jobByName(rec.job);
  const revealed = rec.lastResult && rec.lastResult.round === round;
  const stage = stageForAge(rec.age);
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16 }}>
      {/* 헤더: 아바타 + 총자산 */}
      <PlayerHeader name={name} rec={rec} isClass={isClass} rate={rate} />

      <MacroBar rec={rec} rate={rate} stage={stage} />

      <div style={{ marginTop: 10 }}><Portfolio rec={rec} /></div>

      {(rec.history || []).length >= 2 && <div style={{ marginTop: 10 }}><NetWorthChart history={rec.history} /></div>}

      {step === "invest" && <>
        <IncomeCard rec={rec} />
        <InvestScreen rec={rec} onSubmit={confirmInvest} onChangeJob={() => setStep("rejob")} />
      </>}

      {step === "waiting" && (
        <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 26, marginTop: 14, textAlign: "center" }}>
          <div style={{ fontSize: 40, animation: "blink 1.6s infinite" }}>📡</div>
          <div style={{ fontWeight: 900, marginTop: 8 }}>투자 완료! 속보 대기 중…</div>
          <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>모두 투자를 마치면 다연쌤이 속보를 띄웁니다.</div>
        </div>
      )}

      {step === "news" && (
        <>
          <NewsBanner event={event} />
          {!revealed ? (
            <div style={{ textAlign: "center", marginTop: 18 }}>
              <p style={{ color: C.sub, marginBottom: 12 }}>내 투자와 인생은 어떻게 됐을까?</p>
              <Btn fill onClick={reveal}>💥 결과 확인</Btn>
            </div>
          ) : (
            <ResultBreakdown result={rec.lastResult} rec={rec}
              onNext={isClass ? null : (rec.bankrupt ? null : nextYearSolo)}
              onDead={rec.bankrupt && !isClass ? () => setStep("dead") : null} />
          )}
        </>
      )}

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Btn small color={C.sub} onClick={() => { if (confirm("처음 화면으로 돌아갈까요?")) { try { sDel(pkey(idRef.current)); } catch {} onBack(); } }}>나가기</Btn>
      </div>
    </div>
  );
}

/* ====== 플레이어 헤더 (아바타) ====== */
function PlayerHeader({ name, rec, isClass }) {
  const job = jobByName(rec.job), av = avatarOf(rec), st = stressOf(rec);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "10px 14px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 34, animation: "floaty 3.5s ease-in-out infinite" }}>{av.face}</div>
        <div>
          <div style={{ fontWeight: 900 }}>{name} <span style={{ fontSize: 15 }}>{job?.emoji}</span></div>
          <div style={{ color: C.sub, fontSize: 12 }}>
            {rec.age}세 · {rec.job} {isClass && <Badge color="#60a5fa">수업</Badge>}
          </div>
          <div style={{ marginTop: 4, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.sub }}>스트레스</span>
            <div style={{ width: 70, height: 6, background: "#eceaf3", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${st}%`, height: "100%", background: st >= 60 ? C.red : st >= 30 ? "#f59e0b" : C.green }} />
            </div>
            <span style={{ fontSize: 10, color: av.color, fontWeight: 800 }}>{av.label}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: C.sub, fontSize: 11 }}>순자산 (자산-빚)</div>
        <div style={{ fontFamily: "'Black Han Sans'", color: netWorth(rec) < 0 ? C.red : C.gold, fontSize: 20 }}>{fmt(netWorth(rec))}</div>
        {(rec.loan || 0) > 0 && <div style={{ fontSize: 11, color: C.red }}>빚 {fmt(rec.loan)}</div>}
      </div>
    </div>
  );
}

/* ====== 거시경제 바 (금리·생애단계) ====== */
function MacroBar({ rec, rate, stage }) {
  return (
    <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
      <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "8px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 22 }}>{stage.emoji}</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: 13, color: stage.tone }}>{stage.label}</div>
          <div style={{ color: C.sub, fontSize: 10.5 }}>{stage.desc}</div>
        </div>
      </div>
      <div style={{ width: 118, background: "#141019", borderRadius: 14, padding: "8px 12px", color: "#fff" }}>
        <div style={{ fontSize: 10, color: "#ffd9a8" }}>기준금리 📊</div>
        <div style={{ fontFamily: "'Black Han Sans'", fontSize: 20, color: rate >= 0.06 ? "#ff7a7a" : "#ffd36b" }}>{(rate * 100).toFixed(1)}%</div>
        <div style={{ fontSize: 9.5, color: "#9aa2b1" }}>대출금리 {((rate + LOAN_SPREAD) * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

/* ====== 이번 해 가계부 (소득·지출) ====== */
function IncomeCard({ rec }) {
  const inc = rec.income; if (!inc) return null;
  const Row = ({ label, v, plus }) => (v === 0 ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, padding: "3px 0" }}>
      <span style={{ color: C.sub }}>{label}</span>
      <b style={{ color: plus ? C.green : C.red }}>{plus ? "+" : "-"}{fmt(Math.abs(v))}</b>
    </div>
  ));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginTop: 12 }}>
      <SectionLabel>🧾 이번 해 가계부 ({rec.age}세)</SectionLabel>
      <div style={{ marginTop: 8 }}>
        <Row label={inc.retired ? "연금" : "근로소득 (월급)"} v={inc.work} plus />
        <Row label="이자 (적금)" v={inc.interest} plus />
        <Row label="배당 (주식)" v={inc.dividend} plus />
        <Row label="생활비" v={inc.living} />
        <Row label="대출이자" v={inc.loanInt} />
        <Row label="보험료" v={inc.premium} />
      </div>
      <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 6, paddingTop: 8, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <b>이번 해 여윳돈</b>
        <span style={{ fontFamily: "'Black Han Sans'", fontSize: 18, color: inc.net >= 0 ? C.green : C.red }}>{inc.net >= 0 ? "+" : "-"}{fmt(Math.abs(inc.net))}</span>
      </div>
      {inc.deficitToLoan > 0 && (
        <div style={{ marginTop: 8, background: "#fdeceb", color: C.red, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
          ⚠️ 돈이 모자라 <b>{fmt(inc.deficitToLoan)}</b>를 빚으로 메꿨어요! (빚 비상)
        </div>
      )}
      {inc.retired && (
        <div style={{ marginTop: 8, background: "#eef3ff", color: C.blue, borderRadius: 10, padding: "8px 10px", fontSize: 12, fontWeight: 700 }}>
          🎏 은퇴! 이제 <b>연금 + 이자·배당</b>으로 살아야 해요. 자산이 곧 월급.
        </div>
      )}
    </div>
  );
}

/* ====== 순자산 그래프 (Recharts) ====== */
function NetWorthChart({ history }) {
  const data = history.map((h) => ({ name: `${h.age}세`, net: Math.round(h.net * UNIT) })); // 만원
  const min = Math.min(0, ...data.map((d) => d.net));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 8px 8px 0" }}>
      <div style={{ paddingLeft: 14 }}><SectionLabel>📈 내 순자산 그래프 (만원)</SectionLabel></div>
      <div style={{ width: "100%", height: 150, marginTop: 6 }}>
        <ResponsiveContainer>
          <LineChart data={data} margin={{ top: 6, right: 16, bottom: 0, left: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#eee" />
            <XAxis dataKey="name" tick={{ fontSize: 11, fill: C.sub }} />
            <YAxis tick={{ fontSize: 10, fill: C.sub }} width={48} tickFormatter={(v) => (v >= 10000 ? (v / 10000).toFixed(0) + "억" : v)} />
            <Tooltip formatter={(v) => [v.toLocaleString() + "만원", "순자산"]} labelStyle={{ color: C.text }} />
            {min < 0 && <ReferenceLine y={0} stroke={C.red} strokeDasharray="4 4" />}
            <Line type="monotone" dataKey="net" stroke={C.gold} strokeWidth={3} dot={{ r: 3, fill: C.gold }} activeDot={{ r: 5 }} isAnimationActive={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function JoinScreen({ name, setName, onJoin, onBack, sub }) {
  const locked = sub === "수업 참여" && !firebaseReady;
  return (
    <Centered>
      <div style={{ textAlign: "center", width: 300, animation: "pop .3s", position: "relative" }}>
        <span style={{ cursor: "pointer", color: C.sub, position: "absolute", left: -4, top: -8 }} onClick={onBack}>←</span>
        <div style={{ fontSize: 44 }}>🙋</div>
        <Title size={28}>이름을 입력하세요</Title>
        {sub && <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>{sub}</div>}
        {locked ? (
          <Empty>실시간 서버가 아직 연결되지 않아 수업 모드를 쓸 수 없어요.<br />‘혼자 연습’으로 즐겨주세요!</Empty>
        ) : (
          <>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="닉네임"
              onKeyDown={(e) => e.key === "Enter" && name.trim() && onJoin()}
              style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `2px solid ${C.line}`, background: C.panel, color: C.text, fontSize: 16, textAlign: "center", outline: "none" }} />
            <div style={{ marginTop: 14 }}><Btn fill full disabled={!name.trim()} onClick={onJoin}>입장하기 →</Btn></div>
          </>
        )}
      </div>
    </Centered>
  );
}

function JobPick({ name, onPickJob, onBack, rejob }) {
  const [deck] = useState(() => [...JOBS].sort(() => Math.random() - 0.5));
  const [picked, setPicked] = useState(null);
  return (
    <div style={{ maxWidth: 520, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
        <Title size={24}>{rejob ? "🔄 이직: 새 직업 고르기" : "직업 카드를 1장 고르세요"}</Title>
      </div>
      <p style={{ color: C.sub, marginTop: 6 }}>
        {rejob ? "주의: 이직하면 이번 해 월급은 받지 못해요. (게임당 1회)" : `${name}님, 카드를 뒤집어 보세요. 고른 카드가 당신의 직업이 됩니다.`}
      </p>
      {!picked ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 10, marginTop: 18 }}>
          {deck.map((job, i) => (
            <button key={i} onClick={() => setPicked(job)}
              style={{ aspectRatio: "3/4", borderRadius: 14, border: `2px solid ${C.gold}`, cursor: "pointer",
                background: "linear-gradient(135deg,#fff6e0,#ffe7b8)", color: C.gold, display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg,transparent 30%,#ffffffcc 50%,transparent 70%)", backgroundSize: "200% 100%", animation: `shimmer ${2 + (i % 3)}s linear infinite` }} />
              <span style={{ fontSize: 30, position: "relative" }}>❓</span>
              <span style={{ position: "absolute", bottom: 6, fontSize: 10, color: C.sub }}>#{i + 1}</span>
            </button>
          ))}
        </div>
      ) : (
        <div style={{ marginTop: 24, animation: "flipIn .5s", textAlign: "center" }}>
          <div style={{ maxWidth: 240, margin: "0 auto", aspectRatio: "3/4", borderRadius: 18, border: `3px solid ${picked.color}`,
            background: `linear-gradient(160deg,${picked.color}33,${C.panel})`, display: "grid", placeContent: "center", gap: 6, padding: 16 }}>
            <div style={{ fontSize: 56 }}>{picked.emoji}</div>
            <div style={{ fontFamily: "'Black Han Sans'", fontSize: 30, color: picked.color }}>{picked.name}</div>
            <div style={{ color: C.sub, fontSize: 13 }}>{picked.tag}</div>
            <div style={{ marginTop: 8, fontFamily: "'Black Han Sans'", color: C.gold, fontSize: 18 }}>
              월급 {Array.isArray(picked.salary) ? `${fmt(picked.salary[0])}~${fmt(picked.salary[1])}` : fmt(picked.salary)}
            </div>
          </div>
          <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 20 }}>
            <Btn color={C.sub} onClick={() => setPicked(null)}>다시 고르기</Btn>
            <Btn fill onClick={() => onPickJob(picked)}>{rejob ? "이 직업으로 이직! →" : "이 직업으로 시작! →"}</Btn>
          </div>
        </div>
      )}
    </div>
  );
}

function InvestScreen({ rec, onSubmit, onChangeJob }) {
  const [a, setA] = useState(() => Object.fromEntries(ALLOC.map((x) => [x.key, 0])));
  const [insured, setInsured] = useState(!!rec.insured);
  const [newLoan, setNewLoan] = useState(0);
  const [repay, setRepay] = useState(0);
  const [advOpen, setAdvOpen] = useState(false);

  const assets = assetsSum(rec);
  const maxNewLoan = rec.age >= RETIRE_AGE ? 0 : Math.max(0, Math.round(assets * 1.5) - (rec.loan || 0));
  const maxRepay = Math.min(rec.checking, rec.loan || 0);
  const available = rec.checking + newLoan - repay;
  const used = ALLOC.reduce((s, x) => s + (a[x.key] || 0), 0);
  const diff = available - used, matched = diff === 0;
  const set = (k, v) => setA((p) => ({ ...p, [k]: Math.min(available, Math.max(0, v)) }));

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 12 }}>
      {/* 보험 */}
      <button onClick={() => setInsured((v) => !v)}
        style={{ width: "100%", textAlign: "left", cursor: "pointer", background: insured ? "#e8f8f1" : C.panel2, border: `2px solid ${insured ? C.green : C.line}`, borderRadius: 12, padding: 10, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 22 }}>{insured ? "🛡️" : "🩹"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: insured ? C.green : C.text }}>보험 {insured ? "가입 중" : "미가입"}</div>
          <div style={{ fontSize: 11, color: C.sub }}>매 해 {fmt(INS_PREMIUM)} 내고, 블랙스완(큰 병·사고) 피해를 막아요</div>
        </div>
        <span style={{ fontSize: 12, fontWeight: 800, color: insured ? C.green : C.sub }}>{insured ? "ON" : "OFF"}</span>
      </button>

      {/* 고급: 빚 */}
      {(maxNewLoan > 0 || (rec.loan || 0) > 0) && (
        <div style={{ marginTop: 10 }}>
          <button onClick={() => setAdvOpen((v) => !v)} style={{ width: "100%", cursor: "pointer", background: "transparent", border: "none", color: "#c0392b", fontFamily: "'Black Han Sans'", textAlign: "left", padding: "2px 2px" }}>
            {advOpen ? "▾" : "▸"} ⚠️ 빚내서 투자 / 빚 갚기 (고급)
          </button>
          {advOpen && (
            <div style={{ background: "#fff6f5", border: `1px solid #f3c9c4`, borderRadius: 12, padding: 12, marginTop: 4 }}>
              {maxNewLoan > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <b style={{ color: "#c0392b" }}>🔻 대출 받기 (레버리지)</b><span style={{ color: C.gold, fontFamily: "'Black Han Sans'" }}>{fmt(newLoan)}</span>
                  </div>
                  <input type="range" min={0} max={maxNewLoan} value={newLoan} onChange={(e) => { setNewLoan(+e.target.value); setRepay(0); }} style={{ width: "100%", accentColor: "#c0392b" }} />
                  <div style={{ fontSize: 10.5, color: C.sub }}>빌린 돈도 투자할 수 있어요. 폭락 시 <b>반대매매(강제청산)</b> 위험! 대출금리 {((rec.rate + LOAN_SPREAD) * 100).toFixed(1)}%</div>
                </div>
              )}
              {(rec.loan || 0) > 0 && (
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                    <b style={{ color: C.green }}>🔺 빚 갚기 (현재 빚 {fmt(rec.loan)})</b><span style={{ color: C.gold, fontFamily: "'Black Han Sans'" }}>{fmt(repay)}</span>
                  </div>
                  <input type="range" min={0} max={maxRepay} value={repay} onChange={(e) => { setRepay(+e.target.value); setNewLoan(0); }} style={{ width: "100%", accentColor: C.green }} />
                  <div style={{ fontSize: 10.5, color: C.sub }}>통장 돈으로 빚을 갚으면 이자 부담이 줄어요.</div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* 배분 */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: 14 }}>
        <SectionLabel>💸 돈을 전부 배분하세요</SectionLabel>
        <span style={{ fontSize: 12, color: C.sub }}>배분할 총액 <b style={{ color: C.gold }}>{fmt(available)}</b></span>
      </div>
      <div style={{ textAlign: "center", padding: "10px 12px", borderRadius: 12, margin: "8px 0 12px", fontWeight: 700,
        border: `2px solid ${matched ? C.green : C.red}`, background: matched ? "#e8f8f1" : "#fdeceb",
        color: matched ? C.green : C.red, animation: diff < 0 ? "shake .35s" : "none" }}>
        {available < 0 && "⚠️ 갚을 돈이 통장보다 많아요. 줄여주세요"}
        {available >= 0 && diff < 0 && `⚠️ ${fmt(-diff)} 초과했습니다! 줄여주세요`}
        {available >= 0 && diff > 0 && `🔸 아직 ${fmt(diff)} 남았습니다 (전부 배분해야 진행돼요)`}
        {available >= 0 && matched && "✅ 딱 맞췄습니다! 진행할 수 있어요"}
      </div>
      <div style={{ display: "grid", gap: 10 }}>
        {ALLOC.map((item) => (
          <div key={item.key} style={{ background: C.panel2, borderRadius: 12, padding: 10 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 20 }}>{item.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: item.color }}>{item.name}</div>
                <div style={{ fontSize: 11, color: C.sub }}>{item.hint}</div>
              </div>
              <div style={{ fontFamily: "'Black Han Sans'", color: C.gold, minWidth: 80, textAlign: "right" }}>{fmt(a[item.key])}</div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
              <Stepper onClick={() => set(item.key, a[item.key] - 5)}>-5</Stepper>
              <Stepper onClick={() => set(item.key, a[item.key] - 1)}>-1</Stepper>
              <input type="range" min={0} max={Math.max(0, available)} value={a[item.key]} onChange={(e) => set(item.key, +e.target.value)} style={{ flex: 1, accentColor: item.color }} />
              <Stepper onClick={() => set(item.key, a[item.key] + 1)}>+1</Stepper>
              <Stepper onClick={() => set(item.key, a[item.key] + 5)}>+5</Stepper>
            </div>
          </div>
        ))}
      </div>
      <div style={{ marginTop: 14 }}>
        <Btn fill full disabled={!matched} onClick={() => onSubmit({ alloc: a, newLoan, repay, insured })}>{matched ? "투자 확정 →" : "금액을 딱 맞춰주세요"}</Btn>
      </div>
      {onChangeJob && !rec.jobChanged && rec.age < RETIRE_AGE && (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <Btn small color="#fb923c" onClick={() => { if (confirm("이직하면 이번 해 월급을 받지 못합니다. (게임당 1회) 진행할까요?")) onChangeJob(); }}>🔄 이직하기 (1회 · 이번 해 월급 없음)</Btn>
        </div>
      )}
      {rec.jobChanged && <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>이직 기회는 모두 사용했어요.</p>}
      <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>단위: 1칸 = 10만원 · 남길 돈은 💳입출금통장에</p>
    </div>
  );
}
const Stepper = ({ children, onClick }) => <button onClick={onClick} style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 7px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>{children}</button>;

function ResultBreakdown({ result, rec, onNext, onDead }) {
  return (
    <div style={{ marginTop: 12, animation: "pop .35s" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
        <SectionLabel>📑 나의 결과</SectionLabel>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {result.lines.length === 0 && !result.swan && <div style={{ color: C.sub }}>이번엔 시장 등락 영향은 없었어요.</div>}
          {result.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, borderRadius: 10, padding: "8px 10px" }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{l.isParents ? "🎁 부모님 보답" : assetName(l.key)}
                {!l.isParents && <span style={{ color: C.sub, fontSize: 11, marginLeft: 6 }}>{(l.rate * 100).toFixed(1)}%</span>}</span>
              {!l.isParents && <span style={{ color: C.sub, fontSize: 12 }}>{fmt(l.before)} →</span>}
              <span style={{ fontWeight: 900, color: l.diff >= 0 ? C.green : C.red, minWidth: 90, textAlign: "right" }}>{l.diff >= 0 ? "+" : "-"}{fmt(Math.abs(l.diff))}</span>
            </div>
          ))}
        </div>
        {result.swan && (
          <div style={{ marginTop: 10, borderRadius: 12, padding: 12, border: `2px solid ${result.swan.insured ? C.green : C.red}`, background: result.swan.insured ? "#e8f8f1" : "#fdeceb" }}>
            <div style={{ fontWeight: 900, color: result.swan.insured ? C.green : C.red }}>
              {result.swan.insured ? "🛡️ 보험이 지켜줬어요!" : "💥 블랙스완 직격!"} — {result.swan.label}
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              총 피해 {fmt(result.swan.raw)} 중 {result.swan.insured ? <>보험이 <b style={{ color: C.green }}>{fmt(result.swan.covered)}</b> 보장 → 실제 </> : "보험 없어서 "}
              <b style={{ color: C.red }}>-{fmt(result.swan.damage)}</b>
            </div>
          </div>
        )}
        {result.margin && (
          <div style={{ marginTop: 10, borderRadius: 12, padding: 12, border: `2px solid ${C.red}`, background: "#fdeceb", animation: "pulseRed 1.4s infinite" }}>
            <div style={{ fontWeight: 900, color: C.red }}>🚨 반대매매(강제청산) 발생!</div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              빚 대비 자산이 너무 줄어, 시스템이 자산 <b>{fmt(result.margin.sold)}</b>를 강제로 팔아 빚을 갚았어요.
              {result.margin.remainLoan > 0 && <> 남은 빚 <b style={{ color: C.red }}>{fmt(result.margin.remainLoan)}</b>.</>}
            </div>
          </div>
        )}
        <div style={{ borderTop: `1px solid ${C.line}`, marginTop: 10, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <b>이번 속보 손익</b>
          <span style={{ fontFamily: "'Black Han Sans'", fontSize: 22, color: result.total >= 0 ? C.green : C.red }}>{result.total >= 0 ? "▲ +" : "▼ -"}{fmt(Math.abs(result.total))}</span>
        </div>
      </div>
      {result.bankrupt ? (
        <div style={{ marginTop: 14 }}>
          <div style={{ textAlign: "center", color: C.red, fontWeight: 900, marginBottom: 8 }}>💀 순자산이 마이너스… 파산 위기!</div>
          {onDead ? <Btn fill full color={C.red} onClick={onDead}>결말 보기 →</Btn>
            : <p style={{ textAlign: "center", color: C.sub, fontSize: 13, animation: "blink 1.6s infinite" }}>다연쌤 화면에서 진행을 기다리는 중…</p>}
        </div>
      ) : onNext ? (
        <div style={{ marginTop: 14 }}><Btn fill full onClick={onNext}>⏭ 다음 해로 (4년 후 · {ageForRound((result.round || 1) + 1)}세)</Btn></div>
      ) : (
        <p style={{ textAlign: "center", color: C.sub, fontSize: 13, marginTop: 12, animation: "blink 1.6s infinite" }}>다연쌤이 다음 해를 시작하길 기다리는 중…</p>
      )}
    </div>
  );
}

function Portfolio({ rec }) {
  const net = Math.max(1, assetsSum(rec));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 12 }}>
      <div style={{ display: "flex", height: 10, borderRadius: 6, overflow: "hidden", background: "#eceaf3" }}>
        {ASSETS.map((a) => { const v = rec[a.key] || 0; return v > 0 ? <div key={a.key} style={{ width: `${(v / net) * 100}%`, background: a.color }} /> : null; })}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 6, marginTop: 10 }}>
        {ASSETS.map((a) => (
          <div key={a.key} style={{ fontSize: 12 }}><span style={{ color: a.color }}>● </span><span style={{ color: C.sub }}>{a.name}</span><br /><b>{fmt(rec[a.key] || 0)}</b></div>
        ))}
        {(rec.parents || 0) > 0 && <div style={{ fontSize: 12 }}><span style={{ color: "#fb7185" }}>🎁 </span><span style={{ color: C.sub }}>누적 효도</span><br /><b>{fmt(rec.parents)}</b></div>}
        {(rec.loan || 0) > 0 && <div style={{ fontSize: 12 }}><span style={{ color: C.red }}>▼ </span><span style={{ color: C.sub }}>빚(대출)</span><br /><b style={{ color: C.red }}>-{fmt(rec.loan)}</b></div>}
      </div>
    </div>
  );
}

/* ====== 파산 화면 ====== */
function BankruptScreen({ rec, isClass, onBack }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", maxWidth: 380, animation: "pop .4s" }}>
        <div style={{ fontSize: 64 }}>💀</div>
        <Title size={34}>파산…</Title>
        <p style={{ color: C.sub, marginTop: 10, lineHeight: 1.6 }}>
          {rec.name}님은 <b>{rec.age}세</b>에 순자산이 마이너스가 되어 게임에서 탈락했어요.
        </p>
        <div style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ color: C.red, fontFamily: "'Black Han Sans'", fontSize: 22 }}>{fmt(netWorth(rec))}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>빚 {fmt(rec.loan || 0)}</div>
        </div>
        <p style={{ color: C.gold, fontWeight: 800, marginTop: 14, lineHeight: 1.6 }}>
          "빚투·몰빵은 위험해. 분산투자 + 보험 + 꾸준한 저축이 진짜 생존법!"
        </p>
        {isClass && <p style={{ color: C.sub, fontSize: 12, marginTop: 8 }}>친구들의 최종 순위는 다연쌤 화면에서 함께 봐요.</p>}
        <div style={{ marginTop: 18 }}><Btn onClick={onBack}>처음으로</Btn></div>
      </div>
    </Centered>
  );
}

/* ====== 최종 순위 / 시상대 ====== */
function FinalRanking({ list, meId, onBack }) {
  const ranked = [...list].sort((a, b) => netWorth(b) - netWorth(a));
  const top3 = ranked.slice(0, 3), rest = ranked.slice(3);
  const myRank = ranked.findIndex((p) => p.id === meId);
  const me = myRank >= 0 ? ranked[myRank] : null;
  const filial = [...ranked].sort((a, b) => (b.parents || 0) - (a.parents || 0))[0];
  const medals = ["🥇", "🥈", "🥉"], pColor = ["#e8c14d", "#cbd5e1", "#cd7f32"], pHeight = [140, 105, 88];
  return (
    <div style={{ maxWidth: 560, margin: "0 auto", padding: 16, animation: "pop .4s" }}>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontSize: 46 }}>🏆</div>
        <Title size={34}>인생 최종 결산</Title>
      </div>
      {me && (
        <div style={{ textAlign: "center", margin: "14px 0", background: C.panel, border: `2px solid ${C.gold}`, borderRadius: 14, padding: 14, animation: "pop .5s" }}>
          <div style={{ color: C.sub, fontSize: 13 }}>{me.name}님은</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 30, color: me.bankrupt ? C.red : C.gold }}>{me.bankrupt ? "파산 💀" : `${myRank + 1}등 🎉`}</div>
          <div style={{ marginTop: 2 }}>순자산 <b style={{ color: me.bankrupt ? C.red : C.gold }}>{fmt(netWorth(me))}</b></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end", marginTop: 8 }}>
        {[1, 0, 2].map((idx) => {
          const p = top3[idx];
          if (!p) return <div key={idx} />;
          const job = jobByName(p.job), isMe = p.id === meId;
          return (
            <div key={p.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{medals[idx]}</div>
              <div style={{ fontSize: 22 }}>{job?.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 13, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""}</div>
              <div style={{ fontFamily: "'Black Han Sans'", fontSize: 12, color: C.gold }}>{fmt(netWorth(p))}</div>
              <div style={{ height: pHeight[idx], marginTop: 6, borderRadius: "10px 10px 0 0",
                background: `linear-gradient(180deg,${pColor[idx]},${pColor[idx]}33)`, border: `1px solid ${pColor[idx]}`,
                display: "grid", placeItems: "start center", paddingTop: 6, fontFamily: "'Black Han Sans'", color: C.ink, fontSize: 18 }}>{idx + 1}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
          {rest.map((p, i) => {
            const isMe = p.id === meId, job = jobByName(p.job);
            return (
              <div key={p.id} style={{ display: "flex", alignItems: "center", gap: 10, background: C.panel, border: `1px solid ${isMe ? C.gold : C.line}`, borderRadius: 10, padding: "8px 12px" }}>
                <span style={{ fontFamily: "'Black Han Sans'", color: C.sub, width: 24 }}>{i + 4}</span>
                <span style={{ fontSize: 18 }}>{job?.emoji}</span>
                <span style={{ flex: 1, fontWeight: 700, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""} <span style={{ color: C.sub, fontSize: 11, fontWeight: 400 }}>{p.job}{p.bankrupt ? " · 파산" : ""}</span></span>
                <b style={{ color: p.bankrupt ? C.red : C.gold }}>{fmt(netWorth(p))}</b>
              </div>
            );
          })}
        </div>
      )}
      {filial && (filial.parents || 0) > 0 && (
        <div style={{ textAlign: "center", marginTop: 14, color: C.sub, fontSize: 13 }}>🎁 효도왕: <b style={{ color: "#fb7185" }}>{filial.name}</b> (누적 {fmt(filial.parents)})</div>
      )}
      {ranked.length === 0 && <Empty>참가자 데이터가 없어요.</Empty>}
      <div style={{ textAlign: "center", marginTop: 18 }}><Btn small color={C.sub} onClick={onBack}>처음으로</Btn></div>
    </div>
  );
}

/* ====== 리치 속보 배너 ====== */
function NewsBanner({ event }) {
  const cc = CAT[event.cat] || C.gold;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  const tick = ` 📢 속보  ·  ${event.ticker}  ·  ${event.title}  · `;
  return (
    <div style={{ marginTop: 12, borderRadius: 14, overflow: "hidden", border: `2px solid #ef4444`, animation: "slideDown .4s", boxShadow: "0 10px 30px #0008" }}>
      <div style={{ background: "linear-gradient(90deg,#b91c1c,#ef4444)", color: "#fff", padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: "#fff", color: "#b91c1c", fontFamily: "'Black Han Sans'", fontSize: 12, padding: "1px 7px", borderRadius: 4 }}>LIVE</span>
        <span style={{ fontFamily: "'Black Han Sans'", letterSpacing: 1 }}>📺 머니뉴스 24</span>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>속보 · {hh}:{mm}</span>
      </div>
      <div style={{ background: "linear-gradient(160deg,#1a1014,#15171f)", padding: 16 }}>
        <span style={{ display: "inline-block", background: `${cc}22`, color: cc, border: `1px solid ${cc}`, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: "2px 8px", marginBottom: 10 }}>
          {event.icon} {event.cat}
        </span>
        <div style={{ fontFamily: "'Black Han Sans'", fontSize: 21, lineHeight: 1.3, color: "#fff" }}>{event.title}</div>
        <p style={{ color: "#c9ced8", marginTop: 8, fontSize: 14, lineHeight: 1.55 }}>{event.body}</p>
      </div>
      <div style={{ overflow: "hidden", background: "#000", borderTop: "2px solid #b91c1c", display: "flex", alignItems: "center" }}>
        <span style={{ background: "#b91c1c", color: "#fff", fontFamily: "'Black Han Sans'", fontSize: 12, padding: "6px 10px", whiteSpace: "nowrap", flexShrink: 0 }}>속보</span>
        <div style={{ display: "inline-flex", whiteSpace: "nowrap", animation: "ticker 18s linear infinite", color: "#ffd9d9", fontSize: 13, padding: "6px 0" }}>
          <span>{tick}{tick}</span><span>{tick}{tick}</span>
        </div>
      </div>
    </div>
  );
}

/* ===================== 다연쌤 ===================== */
function AdminView({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [pickNews, setPickNews] = useState(false);

  useEffect(() => {
    let active = true;
    const tick = async () => {
      const g = await sGet(GKEY);
      const keys = await sList("mg:p:");
      const list = (await Promise.all(keys.map((k) => sGet(k)))).filter(Boolean);
      if (!active) return;
      setGame(g); setPlayers(list.sort((a, b) => netWorth(b) - netWorth(a)));
    };
    tick(); const iv = setInterval(tick, 2000);
    return () => { active = false; clearInterval(iv); };
  }, []);

  const round = game?.round || 1, phase = game?.phase || "invest", rate = game?.rate ?? DEFAULT_RATE;
  const age = ageForRound(round), stage = stageForAge(age);
  const maxNet = Math.max(1, ...players.map((p) => Math.abs(netWorth(p))));
  const classPlayers = players.filter((p) => (p.round || 1) === round && !p.bankrupt);
  const readyCount = classPlayers.filter((p) => p.ready).length;
  const alive = players.filter((p) => !p.bankrupt).length;

  const start = () => sSet(GKEY, { round: 1, phase: "invest", newsId: null, rate: DEFAULT_RATE });
  const release = (id) => {
    const ev = id ? eventById(id) : EVENTS[Math.floor(Math.random() * EVENTS.length)];
    const nrate = clamp(rate + (ev.rateDelta || 0), 0, 0.15);
    sSet(GKEY, { ...(game || { round: 1 }), phase: "news", newsId: ev.id, rate: nrate });
  };
  const next = () => sSet(GKEY, { round: round + 1, phase: "invest", newsId: null, rate });
  const setRateManual = (d) => sSet(GKEY, { ...(game || { round: 1, phase: "invest" }), rate: clamp(rate + d, 0, 0.15) });
  const endGame = () => sSet(GKEY, { ...(game || { round: 1 }), phase: "end" });
  const reset = async () => { const keys = await sList("mg:p:"); await Promise.all(keys.map(sDel)); await sDel(GKEY); setPlayers([]); setGame(null); };

  if (!firebaseReady) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
          <Title size={24}>🖥️ 다연쌤</Title>
        </div>
        <Empty>
          실시간 교실 모드는 <b>Firebase 연결</b>이 필요해요.<br />
          배포 플랫폼(Vercel)의 환경변수에 <b>VITE_FB_*</b> 값을 넣으면 켜집니다.<br />
          (연결 전에도 학생들은 ‘혼자 연습’으로 전체 기능을 즐길 수 있어요.)
        </Empty>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1000, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
          <Title size={24}>🖥️ 다연쌤</Title>
          <Badge>{players.length}명 · 생존 {alive}</Badge>
          <span style={{ fontFamily: "'Black Han Sans'", color: C.gold }}>{round}라운드 · {age}세</span>
          <Badge color={stage.tone}>{stage.emoji} {stage.label}</Badge>
          <Badge color={rate >= 0.06 ? C.red : C.gold}>기준금리 {(rate * 100).toFixed(1)}%</Badge>
          <Badge color={phase === "news" ? C.red : phase === "end" ? C.gold : C.green}>{phase === "news" ? "속보 발생" : phase === "end" ? "게임 종료" : "투자 시간"}</Badge>
        </div>
        <Btn small color={C.sub} onClick={() => { if (confirm("전체 초기화할까요? 모든 참가자 데이터가 삭제됩니다.")) reset(); }}>전체 초기화</Btn>
      </div>

      {/* 컨트롤 */}
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 14, marginTop: 14, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {!game ? (
          <Btn fill onClick={start}>▶ 게임 시작 (28세부터)</Btn>
        ) : phase === "end" ? (
          <>
            <span style={{ fontFamily: "'Black Han Sans'", color: C.gold }}>🏆 최종 순위 발표 중</span>
            <Btn fill onClick={() => { if (confirm("새 게임을 시작할까요? 현재 기록이 초기화됩니다.")) reset(); }}>🔄 새 게임 (초기화)</Btn>
          </>
        ) : phase === "invest" ? (
          <>
            <div style={{ animation: readyCount === classPlayers.length && classPlayers.length ? "pulseRed 1.4s infinite" : "none", borderRadius: 12 }}>
              <Btn fill color={C.red} onClick={() => setPickNews(true)}>📰 속보 띄우기 (전원 동시)</Btn>
            </div>
            <span style={{ color: C.sub, fontSize: 14 }}>투자 완료 <b style={{ color: C.gold }}>{readyCount}</b> / {classPlayers.length}명</span>
            {classPlayers.length > 0 && readyCount === classPlayers.length && <Badge color={C.green}>전원 완료!</Badge>}
            <span style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 10, color: C.sub, fontSize: 13 }}>금리 직접 조절:</span>
            <Btn small color={C.blue} onClick={() => setRateManual(-0.01)}>▼ 인하</Btn>
            <Btn small color={C.red} onClick={() => setRateManual(0.01)}>▲ 인상</Btn>
          </>
        ) : (
          <Btn fill onClick={next}>⏭ 다음 해로 ({ageForRound(round + 1)}세)</Btn>
        )}
        {game && phase !== "end" && (
          <Btn color={C.gold} onClick={() => { if (confirm("게임을 종료하고 최종 순위를 발표할까요?")) endGame(); }}>🏁 게임 종료 · 순위 발표</Btn>
        )}
      </div>

      {phase === "news" && game?.newsId && <NewsBanner event={eventById(game.newsId)} />}

      {phase === "end" ? (
        <FinalRanking list={players} meId={null} onBack={onBack} />
      ) : (
      <div style={{ marginTop: 16 }}>
        <SectionLabel>📊 실시간 순위 (순자산 = 자산 - 빚)</SectionLabel>
        {players.length === 0 ? <Empty>아직 참가자가 없어요. 학생들에게 '수업 참여'로 입장하라고 안내하세요.</Empty> : (
          <div style={{ display: "grid", gap: 8, marginTop: 8 }}>
            {players.map((p, i) => {
              const net = netWorth(p), job = jobByName(p.job);
              const isReady = p.ready && (p.round || 1) === round && phase === "invest";
              const av = avatarOf(p);
              return (
                <div key={p.id} style={{ background: C.panel, border: `1px solid ${p.bankrupt ? C.red : isReady ? C.green : C.line}`, borderRadius: 12, padding: 12, opacity: p.bankrupt ? 0.7 : 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontFamily: "'Black Han Sans'", width: 28, color: i === 0 ? C.gold : C.sub, fontSize: 18 }}>{i === 0 ? "👑" : i + 1}</span>
                    <span style={{ fontSize: 22 }}>{p.bankrupt ? "💀" : av.face}</span>
                    <span style={{ fontSize: 18 }}>{job?.emoji}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900 }}>{p.name} <span style={{ color: C.sub, fontSize: 12, fontWeight: 500 }}>{p.job} · {p.age || ageForRound(p.round || 1)}세</span>
                        {p.bankrupt && <span style={{ marginLeft: 6 }}><Badge color={C.red}>파산</Badge></span>}
                        {isReady && <span style={{ marginLeft: 6 }}><Badge color={C.green}>완료</Badge></span>}
                        {p.insured && <span style={{ marginLeft: 4 }}>🛡️</span>}
                        {(p.loan || 0) > 0 && <span style={{ marginLeft: 4, color: C.red, fontSize: 11 }}>빚 {fmt(p.loan)}</span>}</div>
                      <div style={{ height: 6, background: "#eceaf3", borderRadius: 6, marginTop: 6, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${(Math.abs(net) / maxNet) * 100}%`, background: net < 0 ? C.red : `linear-gradient(90deg,${C.goldDim},${C.gold})`, borderRadius: 6 }} />
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontFamily: "'Black Han Sans'", color: net < 0 ? C.red : C.gold, fontSize: 16 }}>{fmt(net)}</div>
                      {p.lastResult && <div style={{ fontSize: 12, color: p.lastResult.total >= 0 ? C.green : C.red }}>{p.lastResult.total >= 0 ? "▲" : "▼"} {fmt(Math.abs(p.lastResult.total))}</div>}
                    </div>
                  </div>
                  <div style={{ display: "flex", height: 8, borderRadius: 6, overflow: "hidden", marginTop: 10, background: "#eceaf3" }}>
                    {ASSETS.map((a) => { const v = p[a.key] || 0, s = Math.max(1, assetsSum(p)); return v > 0 ? <div key={a.key} style={{ width: `${(v / s) * 100}%`, background: a.color }} /> : null; })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      )}

      {pickNews && (
        <div onClick={() => setPickNews(false)} style={{ position: "fixed", inset: 0, background: "#000a", display: "grid", placeItems: "center", padding: 16, zIndex: 50 }}>
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, width: "100%", maxWidth: 480 }}>
            <Title size={22}>📰 어떤 속보를 띄울까요?</Title>
            <div style={{ marginTop: 10 }}><Btn fill color={C.red} full onClick={() => { release(); setPickNews(false); }}>🎲 랜덤 속보!</Btn></div>
            <div style={{ maxHeight: 340, overflow: "auto", marginTop: 12, display: "grid", gap: 6 }}>
              {EVENTS.map((e) => (
                <button key={e.id} onClick={() => { release(e.id); setPickNews(false); }} style={{ textAlign: "left", background: C.panel2, border: `1px solid ${C.line}`, borderRadius: 10, padding: 10, color: C.text, cursor: "pointer" }}>
                  <span style={{ color: CAT[e.cat], fontSize: 11, fontWeight: 800 }}>{e.icon} {e.cat}{e.rateDelta ? ` · 금리${e.rateDelta > 0 ? "▲" : "▼"}` : ""}{e.swan ? " · 블랙스완" : ""}</span>
                  <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2 }}>{e.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
