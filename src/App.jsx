import React, { useState, useEffect, useRef } from "react";
import { sGet, sSet, sList, sDel, firebaseReady } from "./storage";
import * as XLSX from "xlsx";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, CartesianGrid,
} from "recharts";

/* =========================================================
   머니 서바이벌 2 — 인생 대모험 (생애주기 서바이벌)
   · 혼자 연습 / 수업 참여(다연쌤 진행) / 다연쌤 화면(비번 991116)
   · 자산 사고팔기(리밸런싱) · 속보 2개 동시 · 엑셀 저장 · 블랙스완 스케일링
   1 단위 = 10만원 · 1 라운드 = 4년 · 갤탭 가로 2단 레이아웃
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
@keyframes modalPop { 0%{transform:scale(.9) translateY(10px);opacity:0} 100%{transform:scale(1) translateY(0);opacity:1} }

.msWrap { max-width: 1160px; margin: 0 auto; padding: 16px; }
.msCols { display: grid; gap: 14px; grid-template-columns: 1fr; }
.msLeft { display: grid; gap: 10px; align-content: start; }
.allocGrid { display: grid; gap: 10px; grid-template-columns: 1fr; }
@media (min-width: 560px) { .allocGrid { grid-template-columns: 1fr 1fr; } }
@media (min-width: 900px) { .msCols { grid-template-columns: 380px 1fr; align-items: start; } }
`;

const C = {
  bg: "linear-gradient(170deg,#fff5e8 0%,#fdeef4 48%,#edf2ff 100%)",
  panel: "#ffffff", panel2: "#f5f1fb",
  gold: "#bb7d10", goldDim: "#8a5b08",
  green: "#0f9d6e", red: "#df3b3b", text: "#232a3a",
  sub: "#79839a", line: "#ebe6f3", ink: "#2a1d04", blue: "#3b7de0",
};
const UNIT = 10;
const ADMIN_PW = "991116";

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
  { key: "bond", name: "채권", color: "#0ea5e9" },
  { key: "savings", name: "적금", color: "#60a5fa" },
  { key: "pension", name: "연금", color: "#eab308" },
  { key: "realestate", name: "부동산", color: "#f472b6" },
  { key: "luxury", name: "명품", color: "#c084fc" },
  { key: "checking", name: "입출금통장", color: "#94a3b8" },
];
const assetName = (k) => (k === "parents" ? "부모님 효도" : ASSETS.find((a) => a.key === k)?.name || k);

/* 투자 항목 (checking 제외). sell:false = 팔 수 없음(장기·못 무름) */
const ALLOC = [
  { key: "bitcoin", name: "비트코인", emoji: "₿", color: "#f7931a", hint: "고위험 고수익 · 언제든 사고팔기", sell: true },
  { key: "stock", name: "주식", emoji: "📈", color: "#34d399", hint: "중위험 · 배당 · 자유롭게 매매", sell: true },
  { key: "bond", name: "채권", emoji: "📃", color: "#0ea5e9", hint: "이자 받는 안전자산 · 금리 오르면 값↓", sell: true },
  { key: "savings", name: "적금", emoji: "🏦", color: "#60a5fa", hint: "안전·이자 · 자유롭게 조정", sell: true },
  { key: "pension", name: "연금", emoji: "🧓", color: "#eab308", hint: "노후 대비 장기저축 · 아주 안전 · 못 팜(장기)", sell: false },
  { key: "realestate", name: "부동산", emoji: "🏠", color: "#f472b6", hint: "인플레 방어 · 팔 순 있지만 급할 땐 현금화 어려움", sell: true },
  { key: "luxury", name: "명품", emoji: "👜", color: "#c084fc", hint: "감가 위험 · 리셀 대박도 · 매매 가능", sell: true },
  { key: "parents", name: "부모님 용돈", emoji: "🎁", color: "#fb7185", hint: "효도지수↑ (가끔 목돈 보답) · 못 무름", sell: false },
];
const INVEST_KEYS = ALLOC.map((a) => a.key);

const CAT = { 경제: "#e8c14d", 국제: "#60a5fa", IT: "#34d399", 부동산: "#fb923c", 사회: "#c084fc", 건강: "#ef4444" };

/* ====== 속보 이벤트 ======
   returns: 자산 등락 · rateDelta: 금리 · parentsReturn/pensionBonus: 보너스
   swan: 블랙스완 { label, base, pct(자산비례), coverage } */
const EVENTS = [
  /* 비트코인 */
  { id: "btc_etf", cat: "경제", icon: "🚀", title: "비트코인 현물 ETF에 기관 자금 폭발… 코인시장 환호",
    body: "글로벌 대형 운용사들이 일제히 코인 매수에 나섰습니다. '디지털 금' 내러티브가 부활했습니다.",
    ticker: "비트코인 +60%·역대급 거래량·공포탐욕지수 '극도의 탐욕'", returns: { bitcoin: 0.6, stock: 0.1, luxury: 0.06 } },
  { id: "btc_hack", cat: "IT", icon: "🕳️", title: "대형 코인 거래소 해킹… 코인 투자자 패닉",
    body: "해킹으로 자산이 유출됐다는 소식에 코인 시장이 급락했습니다. '내 돈은 안전할까' 공포가 번집니다.",
    ticker: "비트코인 -40%·거래소 출금중단·투자자 패닉", returns: { bitcoin: -0.4, stock: -0.08 } },
  /* 주식 */
  { id: "ai_boom", cat: "IT", icon: "🤖", title: "AI 반도체 슈퍼사이클… 기술주 폭등",
    body: "AI 수요 폭발로 관련 기업 실적 전망이 상향됐습니다. 기술주 중심으로 매수세가 몰렸습니다.",
    ticker: "기술주 +42%·AI 반도체 품귀·어닝 서프라이즈", returns: { stock: 0.42, bitcoin: 0.12, luxury: 0.05 } },
  { id: "stock_crash", cat: "경제", icon: "📉", title: "경기침체 공포·실적 쇼크… 증시 급락",
    body: "경기 둔화 우려에 기업 실적이 꺾이자 주식시장이 큰 폭으로 하락했습니다. 안전자산으로 돈이 이동합니다.",
    ticker: "코스피 -30%·실적 쇼크·안전자산 채권 강세", returns: { stock: -0.3, bond: 0.04 } },
  { id: "dividend", cat: "경제", icon: "💵", title: "주주환원 확대… 배당주에 뭉칫돈",
    body: "기업들이 배당을 늘리겠다고 발표하자 배당주가 강세를 보였습니다. 꾸준한 현금흐름이 매력으로 떠올랐습니다.",
    ticker: "배당주 +15%·주주환원 확대·장기투자 부각", returns: { stock: 0.15, bond: 0.02 } },
  /* 채권 */
  { id: "bond_rush", cat: "국제", icon: "🛟", title: "불확실성에 안전자산 선호… 국채에 뭉칫돈",
    body: "시장 불안이 커지자 안전한 채권으로 돈이 몰렸습니다. 위험자산은 소폭 조정을 받았습니다.",
    ticker: "채권 +7%·안전자산 선호·주식 소폭 조정", returns: { bond: 0.07, stock: -0.03, bitcoin: -0.05 } },
  /* 적금 */
  { id: "savings_gift", cat: "사회", icon: "🏦", title: "정부, 청년 적금 이자 두 배 우대 정책 발표",
    body: "안정적 자산 형성을 돕기 위한 파격 정책이 나왔습니다. 적금 가입자에게 추가 이자가 지급됩니다.",
    ticker: "적금 우대금리 지급·가입 문의 폭주", returns: { savings: 0.06, bond: 0.02 } },
  /* 연금 */
  { id: "pension_tax", cat: "사회", icon: "🧓", title: "노후 대비 붐… 연금저축 세액공제 확대",
    body: "정부가 연금저축 세제 혜택을 늘렸습니다. 미리 연금을 부어둔 사람에게 보너스가 돌아갑니다.",
    ticker: "연금저축 세액공제 확대·노후 준비 열풍", pensionBonus: 0.08 },
  /* 부동산 */
  { id: "housing_up", cat: "부동산", icon: "🏗️", title: "역세권 아파트값 급등… '지금 아니면 못 산다' 패닉바잉",
    body: "공급 부족과 저금리 기대가 겹치며 집값이 뛰었습니다. 부동산을 가진 사람만 웃었습니다.",
    ticker: "부동산 +30%·청약 경쟁률 최고·전세도 상승", returns: { realestate: 0.3, stock: 0.06, luxury: 0.05 } },
  { id: "housing_down", cat: "부동산", icon: "🏚️", title: "전세사기·미분양 공포… 집값 하락",
    body: "전세사기와 미분양이 겹치며 부동산 심리가 얼어붙었습니다. 집값이 하락하고 거래가 끊겼습니다.",
    ticker: "부동산 -22%·미분양 급증·거래 절벽·건설株 약세", returns: { realestate: -0.22, stock: -0.06 } },
  /* 명품 */
  { id: "luxury_resell", cat: "사회", icon: "👜", title: "한정판 명품 리셀가 폭등… 매장마다 '오픈런'",
    body: "인기 브랜드의 가격 인상과 품귀가 맞물리며 중고 명품 시세가 치솟았습니다.",
    ticker: "명품 +28%·오픈런 대란·리셀 거래 폭주", returns: { luxury: 0.28, stock: 0.05 } },
  { id: "luxury_down", cat: "사회", icon: "📦", title: "리셀 규제·경기 둔화… 명품 시세 급락",
    body: "리셀 시장 규제와 소비 위축이 겹치며 명품 되팔이 값이 크게 떨어졌습니다.",
    ticker: "명품 -20%·리셀 규제·소비 둔화·소비株 약세", returns: { luxury: -0.2, stock: -0.05 } },
  /* 금리 */
  { id: "rate_up", cat: "경제", icon: "📊", title: "기준금리 깜짝 인상… 코인·증시 급락, 대출자 비명",
    body: "중앙은행이 예상을 깨고 금리를 크게 올렸습니다. 위험자산에서 돈이 빠지고 대출 이자가 치솟습니다. 채권 값도 내려갑니다.",
    ticker: "비트코인 -45%·코스피 약세·채권값↓·대출금리 급등·예적금은 상승",
    returns: { bitcoin: -0.45, stock: -0.14, realestate: -0.1, bond: -0.06, savings: 0.012, luxury: -0.03 }, rateDelta: 0.02 },
  { id: "rate_cut", cat: "경제", icon: "🕊️", title: "경기 부양 위해 금리 인하… 위험자산·채권에 훈풍",
    body: "중앙은행이 금리를 내리자 대출 부담이 줄고 투자 심리가 살아났습니다. 금리가 내리면 채권 값은 올라갑니다.",
    ticker: "금리 인하·대출이자 완화·증시·코인 반등·채권값↑",
    returns: { stock: 0.12, bitcoin: 0.15, realestate: 0.06, bond: 0.07 }, rateDelta: -0.02 },
  { id: "hyperinflation", cat: "경제", icon: "🌡️", title: "초인플레이션 공포… 대출이자 눈덩이, 영끌족 초비상",
    body: "물가가 통제를 벗어나자 금리가 다시 뛰었습니다. 빚으로 투자한 사람들의 이자 부담이 폭발합니다.",
    ticker: "금리 급등·대출이자 눈덩이·채권값↓·현금가치 하락·실물 상승",
    returns: { bitcoin: -0.2, stock: -0.1, realestate: 0.05, bond: -0.08, luxury: 0.08, checking: -0.06 }, rateDelta: 0.03 },
  { id: "inflation", cat: "경제", icon: "🔥", title: "물가 고공행진… 통장 속 현금 가치 '눈 녹듯'",
    body: "고물가가 이어지며 통장에 묶인 현금의 실질가치가 하락했습니다. 실물·코인이 방어수단으로 주목됩니다.",
    ticker: "물가 6%대·현금가치 하락·실물자산 강세",
    returns: { bitcoin: 0.18, stock: -0.04, realestate: 0.1, luxury: 0.06, bond: -0.03, checking: -0.05 }, rateDelta: 0.01 },
  /* 위기 */
  { id: "crisis", cat: "국제", icon: "🌪️", title: "글로벌 금융위기 공포 확산… 자산시장 패닉",
    body: "대형 금융기관 부실 우려가 번지며 전 세계 증시가 동반 폭락했습니다. 빚투자자는 반대매매 위기, 안전한 채권엔 돈이 몰렸습니다.",
    ticker: "코스피 -38%·비트코인 -35%·부동산 급랭·채권 강세·반대매매 속출",
    returns: { bitcoin: -0.35, stock: -0.38, realestate: -0.2, bond: 0.05, luxury: -0.18 } },
  /* ── 대형 사건 (극적·여러 자산 동시) ── */
  { id: "super_boom", cat: "국제", icon: "🎉", title: "역대급 슈퍼 대호황! 모든 위험자산 동반 폭등",
    body: "경기·기업이익·투자심리가 한꺼번에 살아났습니다. 코인·주식·부동산·명품까지 안 오른 게 없습니다. '벼락부자' 소리가 여기저기서.",
    ticker: "코인 +40%·증시 +32%·부동산 +22%·명품 +18%·다 올랐다!",
    returns: { bitcoin: 0.4, stock: 0.32, realestate: 0.22, luxury: 0.18, bond: -0.02 }, rateDelta: 0.01 },
  { id: "great_depression", cat: "국제", icon: "🌑", title: "대공황 공포! 모든 자산 동반 대폭락",
    body: "은행 연쇄 파산과 소비 절벽이 겹치며 거의 모든 자산이 무너졌습니다. 오직 안전한 채권만 버팁니다. 빚투자자엔 지옥문이 열렸습니다.",
    ticker: "코인 -50%·증시 -48%·부동산 -32%·명품 -35%·반대매매 대란",
    returns: { bitcoin: -0.5, stock: -0.48, realestate: -0.32, luxury: -0.35, bond: 0.03 } },
  { id: "war", cat: "국제", icon: "💣", title: "전쟁 발발! 증시 패닉·안전자산으로 대피",
    body: "지정학적 충돌이 터지자 위험자산이 급락하고, 안전한 채권과 실물(부동산·명품)로 돈이 몰렸습니다.",
    ticker: "증시 -28%·코인 -22%·채권 강세·유가·실물 급등",
    returns: { stock: -0.28, bitcoin: -0.22, bond: 0.08, realestate: 0.06, luxury: 0.06 } },
  { id: "ai_bubble", cat: "IT", icon: "🫧", title: "AI 버블 붕괴! 기술주·코인 동반 대폭락",
    body: "과열됐던 AI 테마가 한순간에 꺼졌습니다. 기술주와 코인이 함께 무너지며 '버블은 언젠가 터진다'는 교훈만 남았습니다.",
    ticker: "기술주 -42%·비트코인 -38%·버블 붕괴·거품 논쟁",
    returns: { stock: -0.42, bitcoin: -0.38, luxury: -0.08 } },
  { id: "liquidity_party", cat: "경제", icon: "💸", title: "유동성 파티! 돈이 풀리자 코인·주식·부동산 동시 상승",
    body: "중앙은행이 돈을 크게 풀자 거의 모든 자산이 함께 올랐습니다. 금리 인하로 대출 부담도 줄었습니다.",
    ticker: "금리 인하·코인 +30%·증시 +25%·부동산 +18%·자산 파티",
    returns: { bitcoin: 0.3, stock: 0.25, realestate: 0.18, bond: 0.05 }, rateDelta: -0.02 },
  { id: "pandemic", cat: "건강", icon: "🦠", title: "신종 감염병 재유행! 증시 급락·경제 셧다운",
    body: "감염병이 다시 번지며 소비와 생산이 멈췄습니다. 위험자산이 급락하고 안전자산으로 대피가 이어졌습니다.",
    ticker: "증시 -25%·코인 -18%·부동산 -12%·채권 강세·셧다운",
    returns: { stock: -0.25, bitcoin: -0.18, realestate: -0.12, luxury: -0.15, bond: 0.04 } },
  /* 효도 */
  { id: "filial", cat: "사회", icon: "🎁", title: "'효도 보답' 훈훈… 부모님이 목돈으로 화답",
    body: "그동안 꾸준히 용돈을 드린 자녀들에게 부모님이 목돈을 돌려주는 사례가 화제입니다.",
    ticker: "효도 누적액의 80% 보답·따뜻한 미담 확산", parentsReturn: 0.8 },
  /* ── 블랙스완 (자산 비례 피해 · 보험으로 방어) ── */
  { id: "swan_cancer", cat: "건강", icon: "🏥", title: "[블랙스완] 갑작스런 큰 병… 치료비 폭탄",
    body: "예고 없이 찾아온 큰 병. 재산이 클수록 치료·간병비도 커집니다. 실비·건강보험이 있으면 대부분 막습니다.",
    ticker: "치료비 급증·간병 부담·보험 가입자만 방어 성공", swan: { label: "치료비", base: 30, pct: 0.15 } },
  { id: "swan_accident", cat: "건강", icon: "🚑", title: "[블랙스완] 교통사고… 수리비·병원비 동시에",
    body: "갑작스런 사고로 큰돈이 나갑니다. 보험이 있으면 피해를 크게 줄일 수 있습니다.",
    ticker: "사고 다발·수리비 폭등·무보험자 직격탄", swan: { label: "사고 피해", base: 22, pct: 0.1 } },
  { id: "swan_fire", cat: "건강", icon: "🔥", title: "[블랙스완] 집·상가에 화재… 복구비 폭탄",
    body: "예상치 못한 화재로 큰 복구비가 듭니다. 화재보험이 있으면 대부분 보장됩니다.",
    ticker: "화재 피해 속출·복구비 부담·보험 여부가 갈랐다", swan: { label: "화재 피해", base: 24, pct: 0.12 } },
  { id: "swan_family", cat: "건강", icon: "🧑‍🦳", title: "[블랙스완] 부모님 큰 수술… 목돈 병원비",
    body: "가족의 갑작스런 수술로 목돈이 나갑니다. 보험이 있으면 부담을 크게 덜 수 있습니다.",
    ticker: "가족 의료비 급증·간병 부담·보험이 버팀목", swan: { label: "가족 병원비", base: 18, pct: 0.09 } },
  { id: "swan_fraud", cat: "사회", icon: "🎣", title: "[블랙스완] 투자사기·보이스피싱 기승",
    body: "'원금 보장 고수익'에 속아 큰돈을 날리는 피해가 속출합니다. 의심스러우면 절대 송금 금지!",
    ticker: "사기 피해 급증·환급 어려움·보험도 일부만 보상", swan: { label: "사기 피해", base: 26, pct: 0.13, coverage: 0.5 } },
];
const eventById = (id) => EVENTS.find((e) => e.id === id);
const evsRateDelta = (evs) => evs.reduce((s, e) => s + (e.rateDelta || 0), 0);

/* ====== 정리 문제 (투자 3원칙) ====== */
const QUIZ = [
  { q: "원금 손실 위험이 거의 없는 '적금'의 가장 큰 특징은 투자의 3원칙 중 무엇인가요?", options: ["안전성", "수익성", "유동성"], answer: "안전성" },
  { q: "위험을 감수하고 큰 이익을 노리는 '비트코인'과 '주식'의 주된 목적은 무엇인가요?", options: ["안전성", "수익성", "유동성"], answer: "수익성" },
  { q: "덩치가 커서 즉시 현금으로 바꾸기 어려운 '부동산'은 3원칙 중 무엇이 가장 낮을까요?", options: ["안전성", "수익성", "유동성"], answer: "유동성" },
  { q: "한정판 '명품'을 비싸게 되팔아 차익을 얻는 투자는 어떤 특성을 노린 것인가요?", options: ["안전성", "수익성", "유동성"], answer: "수익성" },
  { q: "다음 중 자산과 그 자산이 가진 가장 큰 장점이 바르게 짝지어진 것은?", options: ["비트코인 - 안전성", "부동산 - 유동성", "적금 - 안전성", "명품 - 안전성"], answer: "적금 - 안전성" },
];

/* ====== 생애주기 ====== */
const START_AGE = 28, YEARS_PER_ROUND = 4, RETIRE_AGE = 60;
const ageForRound = (r) => START_AGE + (r - 1) * YEARS_PER_ROUND;
function stageForAge(age) {
  if (age < 30) return { key: "s20", label: "사회초년생 (20대)", emoji: "🌱", tone: "#34d399", desc: "첫 월급! 저축 습관이 평생을 좌우해요" };
  if (age < 40) return { key: "s30", label: "30대", emoji: "💍", tone: "#60a5fa", desc: "결혼·전세·차… 인생 최대 지출기" };
  if (age < 50) return { key: "s40", label: "40대", emoji: "👔", tone: "#f59e0b", desc: "소득 전성기 & 자녀 사교육비 폭탄" };
  if (age < 60) return { key: "s50", label: "50대", emoji: "🧭", tone: "#a78bfa", desc: "은퇴 준비 마지막 골든타임" };
  return { key: "s60", label: "은퇴 (60대+)", emoji: "🎏", tone: "#fb7185", desc: "근로소득 끝! 모아둔 자산·연금으로 산다" };
}
const ageFactor = (age) => (age < 30 ? 0.8 : age < 40 ? 1.0 : age < 50 ? 1.3 : age < 60 ? 1.05 : 0);
const livingCost = (age) => (age < 30 ? 8 : age < 40 ? 18 : age < 50 ? 28 : age < 60 ? 22 : 16);
const PENSION_BASE = 12, PENSION_BONUS = { 공무원: 10 };
const DIV_YIELD = 0.03, BOND_COUPON = 0.03, LOAN_SPREAD = 0.03, INS_PREMIUM = 3, DEFAULT_RATE = 0.03;
const loanRate = (rate) => rate + LOAN_SPREAD;

const GKEY = "mg:game";
const SELF_KEY = "mg:self"; // 재접속용: 내 학생 id/이름 (이 기기에만 저장)
const pkey = (id) => `mg:p:${id}`;
function syncSafe(id, obj) { sSet(pkey(id), { ...obj }); }
const saveSelf = (id, name) => { try { localStorage.setItem(SELF_KEY, JSON.stringify({ id, name })); } catch {} };
const loadSelf = () => { try { return JSON.parse(localStorage.getItem(SELF_KEY) || "null"); } catch { return null; } };
const clearSelf = () => { try { localStorage.removeItem(SELF_KEY); } catch {} };

const fmt = (units) => {
  const man = Math.round(units) * UNIT;
  if (man === 0) return "0원";
  const s = man < 0 ? "-" : "", a = Math.abs(man);
  if (a >= 10000) { const e = Math.floor(a / 10000), r = a % 10000; return `${s}${e}억${r ? " " + r.toLocaleString() + "만" : ""}원`; }
  return `${s}${a.toLocaleString()}만원`;
};
const LIQUID = ["bitcoin", "stock", "bond", "savings", "realestate", "luxury", "checking"]; // 연금 제외
const assetsSum = (p) => ASSETS.reduce((s, a) => s + (p[a.key] || 0), 0);
const liquidSum = (p) => LIQUID.reduce((s, k) => s + (p[k] || 0), 0);
const netWorth = (p) => assetsSum(p) - (p.loan || 0);
const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const randEvent = () => EVENTS[Math.floor(Math.random() * EVENTS.length)];

function stressOf(p) {
  const assets = assetsSum(p), loan = p.loan || 0; let s = 0;
  if (loan > 0) s += clamp((loan / Math.max(1, assets)) * 60, 0, 70);
  if (netWorth(p) < 0) s = 100; else if (netWorth(p) < 20) s = Math.max(s, 55);
  return Math.round(clamp(s, 0, 100));
}
function avatarOf(p) {
  if (p.bankrupt || netWorth(p) < 0) return { face: "😵", label: "파산…", color: C.red };
  const st = stressOf(p), net = netWorth(p);
  if (st >= 60) return { face: "😰", label: "빚 스트레스", color: C.red };
  if (net >= 400) return { face: "😎", label: "부자!", color: C.gold };
  if (net >= 150) return { face: "😊", label: "든든", color: C.green };
  return { face: "🙂", label: "차근차근", color: C.blue };
}

/* ====== 한 해 시작: 소득·지출 정산 ====== */
function startRound(prev, round, rate) {
  const p = { ...prev };
  const age = ageForRound(round), retired = age >= RETIRE_AGE, job = jobByName(p.job);
  const work = retired ? PENSION_BASE + (PENSION_BONUS[p.job] || 0) : Math.round(rollSalary(job) * ageFactor(age));
  const interest = Math.round((p.savings || 0) * rate);
  const bondCoupon = Math.round((p.bond || 0) * BOND_COUPON);
  const dividend = Math.round((p.stock || 0) * DIV_YIELD);
  const pensionInt = Math.round((p.pension || 0) * (rate * 0.5 + 0.015)) + (retired ? Math.round((p.pension || 0) * 0.05) : 0);
  const assetIncome = interest + bondCoupon + dividend + pensionInt;
  const living = livingCost(age);
  const loanInt = Math.round((p.loan || 0) * loanRate(rate));
  const premium = p.insured ? INS_PREMIUM : 0;
  const net = work + assetIncome - living - loanInt - premium;
  p.checking = (p.checking || 0) + net;
  let deficitToLoan = 0;
  if (p.checking < 0) { deficitToLoan = -p.checking; p.loan = (p.loan || 0) + deficitToLoan; p.checking = 0; }
  p.age = age; p.round = round; p.retired = retired; p.rate = rate;
  p.lastSalaryAmt = work; p.lastSalaryRound = round; p.ready = false;
  p.income = { work, retired, interest, bondCoupon, dividend, pensionInt, assetIncome, living, loanInt, premium, net, deficitToLoan };
  return p;
}

/* ====== 이벤트 1개 효과 (record 직접 수정, 마진콜은 나중에) ====== */
function applyEventEffects(r, event) {
  const lines = []; let total = 0;
  const ret = event.returns || {};
  ["bitcoin", "stock", "bond", "savings", "realestate", "luxury", "checking"].forEach((k) => {
    const before = r[k] || 0, rate = ret[k] || 0;
    if (before <= 0 && rate === 0) return;
    const after = Math.max(0, Math.round(before * (1 + rate)));
    const diff = after - before; r[k] = after; total += diff;
    if (before > 0) lines.push({ key: k, before, after, diff, rate });
  });
  if (event.parentsReturn && (r.parents || 0) > 0) {
    const bonus = Math.round(r.parents * event.parentsReturn);
    r.checking += bonus; total += bonus;
    lines.push({ key: "parents", before: 0, after: bonus, diff: bonus, rate: event.parentsReturn, isParents: true });
  }
  if (event.pensionBonus && (r.pension || 0) > 0) {
    const bonus = Math.round(r.pension * event.pensionBonus);
    r.pension += bonus; total += bonus;
    lines.push({ key: "pension", before: 0, after: bonus, diff: bonus, rate: event.pensionBonus, isBonus: true });
  }
  let swan = null;
  if (event.swan) {
    const raw = Math.round((event.swan.base || 0) + (event.swan.pct || 0) * liquidSum(r));
    const coverRate = event.swan.coverage != null ? event.swan.coverage : 0.9;
    const covered = r.insured ? Math.round(raw * coverRate) : 0;
    const damage = raw - covered;
    let rem = damage;
    for (const k of ["checking", "savings", "bond", "stock", "bitcoin", "realestate", "luxury"]) {
      if (rem <= 0) break;
      const take = Math.min(r[k] || 0, rem); r[k] = (r[k] || 0) - take; rem -= take;
    }
    let toLoan = 0;
    if (rem > 0) { toLoan = rem; r.loan = (r.loan || 0) + rem; }
    total -= damage;
    swan = { label: event.swan.label, raw, covered, damage, insured: !!r.insured, toLoan };
  }
  return { lines, total, swan };
}

/* ====== 속보 정산 (1~2개) + 마진콜 + 파산 ====== */
function settle(r, events, round) {
  let lines = [], swans = [], total = 0;
  for (const ev of events) { const e = applyEventEffects(r, ev); lines = lines.concat(e.lines); total += e.total; if (e.swan) swans.push(e.swan); }
  let margin = null;
  if ((r.loan || 0) > 0) {
    const liq = liquidSum(r);
    if (liq < r.loan * 1.2) {
      const repay = Math.min(liq, r.loan), leftover = liq - repay;
      LIQUID.forEach((k) => { r[k] = 0; });
      r.checking = Math.max(0, leftover);
      r.loan = Math.max(0, r.loan - repay);
      margin = { sold: liq, repay, remainLoan: r.loan };
    }
  }
  const bankrupt = netWorth(r) < 0; r.bankrupt = bankrupt;
  return { round, eventIds: events.map((e) => e.id), titles: events.map((e) => e.title), total, lines, swans, margin, bankrupt };
}

/* ===================================================================== */
export default function App() {
  const [mode, setMode] = useState(null);
  return (
    <div style={{ minHeight: "100vh", background: C.bg, color: C.text, fontFamily: "'Gothic A1', sans-serif" }}>
      <style>{FONT}</style>
      {!mode ? <ModeSelect onPick={setMode} />
        : mode === "admin" ? <AdminGate onBack={() => setMode(null)} />
        : <PlayGame mode={mode} onBack={() => setMode(null)} />}
    </div>
  );
}

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

function ModeSelect({ onPick }) {
  return (
    <Centered>
      <div style={{ textAlign: "center", animation: "pop .4s" }}>
        <div style={{ fontSize: 54, animation: "floaty 3s ease-in-out infinite" }}>💰</div>
        <Title size={44}>머니 서바이벌 2</Title>
        <p style={{ color: C.gold, fontFamily: "'Black Han Sans'", marginTop: 2 }}>인생 대모험 · 28세부터 노후까지</p>
        <p style={{ color: C.sub, marginTop: 8, maxWidth: 360, marginInline: "auto", lineHeight: 1.6 }}>
          직업을 뽑고, 자산을 사고팔며, 금리·빚·블랙스완을 견디며 <b>파산 없이 노후까지 살아남아라!</b>
        </p>
        <div style={{ display: "grid", gap: 12, marginTop: 26, width: 300, marginInline: "auto" }}>
          <Btn fill onClick={() => onPick("solo")} full>🎮 혼자 연습 (내 인생 살아보기)</Btn>
          <Btn onClick={() => onPick("class")} full>🎓 수업 참여 (다연쌤과 함께)</Btn>
          <Btn color={C.sub} onClick={() => onPick("admin")} full>🖥️ 다연쌤 화면 🔒</Btn>
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

/* ====== 생활비 고지서 팝업 ====== */
function BudgetModal({ data, onClose }) {
  if (!data) return null;
  const { income: inc, age } = data, stage = stageForAge(age);
  const Row = ({ label, v, plus, strong }) => (v === 0 ? null : (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: strong ? 16 : 14, padding: strong ? "6px 0" : "3px 0", fontWeight: strong ? 900 : 500 }}>
      <span style={{ color: strong ? C.text : C.sub }}>{label}</span>
      <b style={{ color: plus ? C.green : C.red, fontSize: strong ? 18 : 14 }}>{plus ? "+" : "-"}{fmt(Math.abs(v))}</b>
    </div>
  ));
  return (
    <div style={{ position: "fixed", inset: 0, background: "#0009", display: "grid", placeItems: "center", padding: 16, zIndex: 60 }}>
      <div style={{ background: C.panel, borderRadius: 20, width: "100%", maxWidth: 460, overflow: "hidden", animation: "modalPop .3s", boxShadow: "0 20px 60px #0006" }}>
        <div style={{ background: `linear-gradient(120deg,${stage.tone},${stage.tone}bb)`, padding: "16px 20px", color: "#fff" }}>
          <div style={{ fontSize: 13, opacity: .95 }}>{stage.emoji} {stage.label}</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 24 }}>{age}세 · 이번 해 가계부 🧾</div>
          <div style={{ fontSize: 12.5, opacity: .95, marginTop: 2 }}>{stage.desc}</div>
        </div>
        <div style={{ padding: 20 }}>
          <Row label={inc.retired ? "연금 (근로소득 없음)" : "근로소득 (월급)"} v={inc.work} plus />
          <Row label="자산소득 (이자·배당·연금)" v={inc.assetIncome} plus />
          <div style={{ height: 1, background: C.line, margin: "6px 0" }} />
          <Row label="💸 생활비 (꼭 나가는 돈)" v={inc.living} strong />
          <Row label="대출이자" v={inc.loanInt} />
          <Row label="보험료" v={inc.premium} />
          <div style={{ borderTop: `2px solid ${C.line}`, marginTop: 8, paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <b style={{ fontSize: 16 }}>이번 해 여윳돈</b>
            <span style={{ fontFamily: "'Black Han Sans'", fontSize: 24, color: inc.net >= 0 ? C.green : C.red }}>{inc.net >= 0 ? "+" : "-"}{fmt(Math.abs(inc.net))}</span>
          </div>
          {inc.deficitToLoan > 0 && (
            <div style={{ marginTop: 10, background: "#fdeceb", color: C.red, borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
              ⚠️ 돈이 모자라 <b>{fmt(inc.deficitToLoan)}</b>를 빚으로 메꿨어요! 생활비를 감당할 자산소득을 키워야 해요.
            </div>
          )}
          {inc.retired && (
            <div style={{ marginTop: 10, background: "#eef3ff", color: C.blue, borderRadius: 12, padding: "10px 12px", fontSize: 13, fontWeight: 700 }}>
              🎏 은퇴! 이제 <b>연금 + 이자·배당</b>으로 살아야 해요. 모아둔 자산이 곧 월급.
            </div>
          )}
          <div style={{ marginTop: 16 }}><Btn fill full onClick={onClose}>확인했어요 · 투자하러 가기 →</Btn></div>
          <p style={{ textAlign: "center", color: C.sub, fontSize: 11, marginTop: 8 }}>천천히 읽어보고 준비되면 눌러요</p>
        </div>
      </div>
    </div>
  );
}

/* ===================== 게임 ===================== */
function PlayGame({ mode, onBack }) {
  const isClass = mode === "class";
  const [step, setStep] = useState("name");
  const [name, setName] = useState("");
  const [rec, setRec] = useState(null);
  const [round, setRound] = useState(1);
  const [rate, setRate] = useState(DEFAULT_RATE);
  const [events, setEvents] = useState([]); // 현재 속보(1~2개)
  const [phase, setPhase] = useState("invest");
  const [finalList, setFinalList] = useState([]);
  const [budget, setBudget] = useState(null);
  const idRef = useRef(uid());
  const recRef = useRef(null), roundRef = useRef(1), stepRef = useRef("name"), rateRef = useRef(DEFAULT_RATE);
  recRef.current = rec; roundRef.current = round; stepRef.current = step; rateRef.current = rate;

  const write = (r) => syncSafe(idRef.current, { ...r, id: idRef.current, name });
  const openBudget = (r) => setBudget({ income: r.income, age: r.age });

  /* 재접속: 새로고침/재접속 시 같은 학생으로 이어하기 (이 기기에 저장된 id 사용) */
  useEffect(() => {
    if (!isClass) return;
    const saved = loadSelf();
    if (!saved || !saved.id) return;
    let alive = true;
    (async () => {
      const rec0 = await sGet(pkey(saved.id));
      const g = await sGet(GKEY);
      if (!alive) return;
      if (!rec0 || !g) { clearSelf(); return; } // 초기화됨 → 새로 시작
      idRef.current = saved.id;
      setName(saved.name || rec0.name || "");
      setRec(rec0); recRef.current = rec0;
      setRound(g.round || 1); roundRef.current = g.round || 1;
      setRate(g.rate ?? DEFAULT_RATE); rateRef.current = g.rate ?? DEFAULT_RATE;
      setPhase(g.phase);
      if (g.phase === "end") return;
      const ids = g.newsIds || (g.newsId ? [g.newsId] : []);
      if (g.phase === "news" && ids.length && !(rec0.lastResult && rec0.lastResult.round === (g.round || 1))) { setEvents(ids.map(eventById).filter(Boolean)); setStep("news"); }
      else setStep(rec0.ready ? "waiting" : "invest");
    })();
    return () => { alive = false; };
  }, [isClass]);

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
      // 인생 바꾸기: 다연쌤이 내 인생을 바꿔치기했으면 새 삶을 받아온다
      const mine = await sGet(pkey(idRef.current));
      if (mine && mine.swapStamp && mine.swapStamp !== (r.swapStamp || 0)) {
        setRec(mine); recRef.current = mine; setName(mine.name || name); setEvents([]); setStep("invest");
        try { setTimeout(() => alert("🔀 인생이 바뀌었어요! 새 삶으로 다시 투자하세요."), 30); } catch {}
        return;
      }
      const ids = g.newsIds || (g.newsId ? [g.newsId] : null);
      if (g.phase === "invest" && (r.lastSalaryRound || 0) < g.round) {
        const nr = startRound(r, g.round, g.rate ?? DEFAULT_RATE);
        setRec(nr); recRef.current = nr; setEvents([]); setStep("invest"); openBudget(nr); write(nr);
      } else if (g.phase === "news" && ids && stepRef.current !== "news") {
        setEvents(ids.map(eventById).filter(Boolean)); setStep("news");
      }
    };
    poll(); const iv = setInterval(poll, 1500);
    return () => { active = false; clearInterval(iv); };
  }, [isClass]);

  const startJob = (job) => {
    const rnd = isClass ? roundRef.current : 1, rt = isClass ? rateRef.current : DEFAULT_RATE;
    const base = { id: idRef.current, name, job: job.name, bitcoin: 0, stock: 0, bond: 0, savings: 0, pension: 0, realestate: 0,
      luxury: 0, parents: 0, loan: 0, insured: false, ready: false, lastResult: null, jobChanged: false, bankrupt: false, history: [] };
    const r = startRound(base, rnd, rt);
    r.history = [{ round: rnd, age: r.age, net: netWorth(r) }];
    setRec(r); recRef.current = r; setStep("invest"); openBudget(r);
    if (isClass) { write(r); saveSelf(idRef.current, name); }
  };

  const confirmInvest = ({ targets, newLoan, repay, insured }) => {
    const investCur = INVEST_KEYS.reduce((s, k) => s + (rec[k] || 0), 0);
    const pool = rec.checking + newLoan + investCur; // 상환은 pool에서 차감
    const used = INVEST_KEYS.reduce((s, k) => s + (targets[k] || 0), 0);
    const rp = Math.min(repay, rec.loan || 0, Math.max(0, pool - used));
    const residual = pool - used - rp;
    if (residual < 0) return;
    if ((targets.pension || 0) < (rec.pension || 0)) return;
    if ((targets.parents || 0) < (rec.parents || 0)) return;
    const r = { ...rec };
    INVEST_KEYS.forEach((k) => { r[k] = targets[k] || 0; });
    r.checking = residual; r.insured = insured;
    r.loan = Math.max(0, (rec.loan || 0) + newLoan - rp);
    if (isClass) { r.ready = true; setRec(r); recRef.current = r; setStep("waiting"); write(r); }
    else { setRec(r); recRef.current = r; setEvents([randEvent()]); setStep("news"); }
  };

  const reveal = () => {
    const r = { ...rec };
    const res = settle(r, events, round); r.lastResult = res;
    r.history = [...(r.history || []), { round, age: ageForRound(round), net: netWorth(r) }];
    if (!isClass) { const d = evsRateDelta(events); if (d) { const nr = clamp(rate + d, 0, 0.15); setRate(nr); rateRef.current = nr; } }
    setRec(r); recRef.current = r; if (isClass) write(r);
  };

  const toggleSwap = () => {
    const r = { ...rec, wantSwap: !rec.wantSwap };
    setRec(r); recRef.current = r; write(r);
  };

  const changeJob = (job) => {
    const r = { ...rec, job: job.name, jobChanged: true };
    r.checking = Math.max(0, r.checking - (r.lastSalaryAmt || 0)); r.lastSalaryAmt = 0;
    if (r.income) r.income = { ...r.income, work: 0, net: r.income.net - (rec.lastSalaryAmt || 0) };
    setRec(r); recRef.current = r; setStep("invest"); if (isClass) write(r);
  };

  const nextYearSolo = () => {
    const nrnd = round + 1, r = startRound(rec, nrnd, rate);
    setRound(nrnd); roundRef.current = nrnd;
    setRec(r); recRef.current = r; setEvents([]); setStep("invest"); openBudget(r);
  };

  if (step === "name") return <JoinScreen name={name} setName={setName} onJoin={() => setStep("job")} onBack={onBack} sub={isClass ? "수업 참여" : "혼자 연습"} />;
  if (step === "job") return <JobPick name={name} onPickJob={startJob} onBack={() => setStep("name")} />;
  if (step === "rejob") return <JobPick name={name} onPickJob={changeJob} onBack={() => setStep("invest")} rejob />;
  if (step === "end") return <FinalRanking list={finalList} meId={idRef.current} onBack={onBack} />;
  if (step === "dead") return <BankruptScreen rec={rec} isClass={isClass} onBack={onBack} />;

  const revealed = rec.lastResult && rec.lastResult.round === round;
  const stage = stageForAge(rec.age);
  return (
    <div className="msWrap">
      <BudgetModal data={budget} onClose={() => setBudget(null)} />
      {step === "news" && !revealed && events.length > 0 && <NewsModal events={events} onReveal={reveal} />}
      <PlayerHeader name={name} rec={rec} isClass={isClass} />
      <div className="msCols" style={{ marginTop: 12 }}>
        <div className="msLeft">
          <MacroBar rec={rec} rate={rate} stage={stage} />
          <Portfolio rec={rec} />
          {(rec.history || []).length >= 2 && <NetWorthChart history={rec.history} />}
        </div>
        <div style={{ width: "100%", maxWidth: 640, justifySelf: "center" }}>
          {step === "invest" && <InvestScreen rec={rec} onSubmit={confirmInvest} onChangeJob={() => setStep("rejob")} onShowBudget={() => openBudget(rec)} />}

          {step === "waiting" && (
            <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 30, textAlign: "center" }}>
              <div style={{ fontSize: 46, animation: "blink 1.6s infinite" }}>📡</div>
              <div style={{ fontWeight: 900, marginTop: 8, fontSize: 18 }}>투자 완료! 속보 대기 중…</div>
              <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>모두 투자를 마치면 다연쌤이 속보를 띄웁니다.</div>
            </div>
          )}

          {step === "news" && (revealed
            ? <ResultBreakdown result={rec.lastResult} rec={rec} onNext={isClass ? null : nextYearSolo} />
            : <div style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 16, padding: 26, textAlign: "center" }}>
                <div style={{ fontSize: 40 }}>📺</div>
                <div style={{ fontWeight: 900, marginTop: 6, fontSize: 18, color: C.red }}>속보 발생!</div>
                <div style={{ color: C.sub, fontSize: 13, marginTop: 6 }}>팝업에서 뉴스를 확인하고 결과를 눌러요.</div>
              </div>
          )}

          {/* 인생 바꾸기 신청 (수업 · 투자/대기 중) */}
          {isClass && (step === "invest" || step === "waiting") && (
            <button onClick={toggleSwap}
              style={{ width: "100%", marginTop: 12, cursor: "pointer", borderRadius: 14, padding: 12, textAlign: "left",
                background: rec.wantSwap ? "#f3e8ff" : C.panel2, border: `2px solid ${rec.wantSwap ? "#a855f7" : C.line}`, display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 24 }}>🔀</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 900, color: rec.wantSwap ? "#9333ea" : C.text }}>인생 바꾸기 {rec.wantSwap ? "신청됨 ✓" : "신청하기"}</div>
                <div style={{ fontSize: 11, color: C.sub }}>신청한 친구들끼리 인생(재산·직업)을 통째로 랜덤 교환! 다연쌤이 실행해요.</div>
              </div>
              <span style={{ fontSize: 12, fontWeight: 800, color: rec.wantSwap ? "#9333ea" : C.sub }}>{rec.wantSwap ? "ON" : "OFF"}</span>
            </button>
          )}
        </div>
      </div>

      <div style={{ textAlign: "center", marginTop: 18 }}>
        <Btn small color={C.sub} onClick={() => { if (confirm("처음 화면으로 돌아갈까요? (내 진행이 사라져요)")) { try { sDel(pkey(idRef.current)); } catch {} clearSelf(); onBack(); } }}>나가기</Btn>
      </div>
    </div>
  );
}

function PlayerHeader({ name, rec, isClass }) {
  const job = jobByName(rec.job), av = avatarOf(rec), st = stressOf(rec);
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 18px", flexWrap: "wrap" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <div style={{ fontSize: 40, animation: "floaty 3.5s ease-in-out infinite" }}>{av.face}</div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 17 }}>{name} <span style={{ fontSize: 16 }}>{job?.emoji}</span></div>
          <div style={{ color: C.sub, fontSize: 12.5 }}>{rec.age}세 · {rec.job} {isClass && <Badge color="#60a5fa">수업</Badge>}</div>
          <div style={{ marginTop: 5, display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: C.sub }}>스트레스</span>
            <div style={{ width: 90, height: 7, background: "#eceaf3", borderRadius: 6, overflow: "hidden" }}>
              <div style={{ width: `${st}%`, height: "100%", background: st >= 60 ? C.red : st >= 30 ? "#f59e0b" : C.green }} />
            </div>
            <span style={{ fontSize: 11, color: av.color, fontWeight: 800 }}>{av.label}</span>
          </div>
        </div>
      </div>
      <div style={{ textAlign: "right" }}>
        <div style={{ color: C.sub, fontSize: 11 }}>순자산 (자산-빚)</div>
        <div style={{ fontFamily: "'Black Han Sans'", color: netWorth(rec) < 0 ? C.red : C.gold, fontSize: 24 }}>{fmt(netWorth(rec))}</div>
        {(rec.loan || 0) > 0 && <div style={{ fontSize: 12, color: C.red }}>빚 {fmt(rec.loan)}</div>}
      </div>
    </div>
  );
}

function MacroBar({ rec, rate, stage }) {
  return (
    <div style={{ display: "flex", gap: 8 }}>
      <div style={{ flex: 1, background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 24 }}>{stage.emoji}</span>
        <div>
          <div style={{ fontWeight: 900, fontSize: 14, color: stage.tone }}>{stage.label}</div>
          <div style={{ color: C.sub, fontSize: 11 }}>{stage.desc}</div>
        </div>
      </div>
      <div style={{ width: 128, background: "#141019", borderRadius: 14, padding: "10px 14px", color: "#fff" }}>
        <div style={{ fontSize: 10, color: "#ffd9a8" }}>기준금리 📊</div>
        <div style={{ fontFamily: "'Black Han Sans'", fontSize: 22, color: rate >= 0.06 ? "#ff7a7a" : "#ffd36b" }}>{(rate * 100).toFixed(1)}%</div>
        <div style={{ fontSize: 9.5, color: "#9aa2b1" }}>대출금리 {((rate + LOAN_SPREAD) * 100).toFixed(1)}%</div>
      </div>
    </div>
  );
}

function NetWorthChart({ history }) {
  const data = history.map((h) => ({ name: `${h.age}세`, net: Math.round(h.net * UNIT) }));
  const min = Math.min(0, ...data.map((d) => d.net));
  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: "12px 8px 8px 0" }}>
      <div style={{ paddingLeft: 14 }}><SectionLabel>📈 내 순자산 그래프 (만원)</SectionLabel></div>
      <div style={{ width: "100%", height: 160, marginTop: 6 }}>
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
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
        <Title size={24}>{rejob ? "🔄 이직: 새 직업 고르기" : "직업 카드를 1장 고르세요"}</Title>
      </div>
      <p style={{ color: C.sub, marginTop: 6 }}>
        {rejob ? "주의: 이직하면 이번 해 월급은 받지 못하고, 뒤집은 카드로 확정돼요. (게임당 1회)" : `${name}님, 카드 1장을 뒤집으세요. 뒤집는 순간 그 직업으로 확정! (다시 못 골라요)`}
      </p>
      {!picked ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12, marginTop: 18 }}>
          {deck.map((job, i) => (
            <button key={i} onClick={() => setPicked(job)}
              style={{ aspectRatio: "3/4", borderRadius: 14, border: `2px solid ${C.gold}`, cursor: "pointer",
                background: "linear-gradient(135deg,#fff6e0,#ffe7b8)", color: C.gold, display: "grid", placeItems: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", inset: 0, background: "linear-gradient(110deg,transparent 30%,#ffffffcc 50%,transparent 70%)", backgroundSize: "200% 100%", animation: `shimmer ${2 + (i % 3)}s linear infinite` }} />
              <span style={{ fontSize: 32, position: "relative" }}>❓</span>
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
          <div style={{ display: "flex", flexDirection: "column", gap: 8, alignItems: "center", marginTop: 20 }}>
            <Btn fill onClick={() => onPickJob(picked)}>{rejob ? "이 직업으로 이직! →" : "이 직업으로 시작! →"}</Btn>
            <span style={{ color: C.sub, fontSize: 11 }}>⚠️ 카드는 한 번 뒤집으면 못 바꿔요 (운명!)</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ====== 투자(사고팔기·리밸런싱) ====== */
function InvestScreen({ rec, onSubmit, onChangeJob, onShowBudget }) {
  const [t, setT] = useState(() => Object.fromEntries(ALLOC.map((x) => [x.key, rec[x.key] || 0])));
  const [insured, setInsured] = useState(!!rec.insured);
  const [newLoan, setNewLoan] = useState(0);
  const [repay, setRepay] = useState(0);

  const inDebt = (rec.loan || 0) > 0;
  const investCur = INVEST_KEYS.reduce((s, k) => s + (rec[k] || 0), 0);
  const used = INVEST_KEYS.reduce((s, k) => s + (t[k] || 0), 0);
  // 빚이 있으면 새 대출 금지 (상환 먼저). 팔아서 만든 현금으로 빚을 갚을 수 있음.
  const maxNewLoan = inDebt || rec.age >= RETIRE_AGE ? 0 : Math.max(0, Math.round(assetsSum(rec) * 1.5));
  const pool = rec.checking + newLoan + investCur; // 굴릴 수 있는 총액 (상환 빼기 전)
  const maxRepay = Math.min(rec.loan || 0, Math.max(0, pool - used)); // 자산 판 돈까지 상환에 쓸 수 있음
  const repayEff = Math.min(repay, maxRepay);
  const residual = pool - used - repayEff; // 통장에 남는 현금
  const floors = { pension: rec.pension || 0, parents: rec.parents || 0 };
  const okFloors = (t.pension || 0) >= floors.pension && (t.parents || 0) >= floors.parents;
  const valid = residual >= 0 && okFloors;
  const setVal = (k, v) => { const fl = floors[k] || 0; setT((p) => ({ ...p, [k]: Math.max(fl, Math.min(Math.max(0, pool), Math.round(v))) })); };

  return (
    <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <SectionLabel>💼 자산 사고팔기 (리밸런싱)</SectionLabel>
        <button onClick={onShowBudget} style={{ background: "transparent", border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 10px", color: C.sub, fontSize: 12, cursor: "pointer" }}>가계부 다시보기</button>
      </div>
      <p style={{ color: C.sub, fontSize: 11.5, margin: "4px 0 0" }}>슬라이더를 <b>올리면 사기 / 내리면 팔기</b>. 남는 돈은 자동으로 💳통장에 담겨요. (연금·부모님용돈은 못 팜)</p>

      {/* 통장(현금) 잔액 */}
      <div style={{ marginTop: 10, borderRadius: 12, padding: "10px 14px", border: `2px solid ${residual < 0 ? C.red : C.green}`, background: residual < 0 ? "#fdeceb" : "#e8f8f1", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: C.sub }}>💳 남는 현금 (통장에 보관)</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 20, color: residual < 0 ? C.red : C.green }}>{fmt(Math.max(0, residual))}</div>
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: residual < 0 ? C.red : C.sub, textAlign: "right" }}>
          {residual < 0 ? `⚠️ ${fmt(-residual)} 초과! 줄여요` : `굴릴 수 있는 총액 ${fmt(pool)}`}
        </div>
      </div>

      {/* 보험 */}
      <button onClick={() => setInsured((v) => !v)}
        style={{ width: "100%", textAlign: "left", cursor: "pointer", marginTop: 10, background: insured ? "#e8f8f1" : C.panel2, border: `2px solid ${insured ? C.green : C.line}`, borderRadius: 12, padding: 12, display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24 }}>{insured ? "🛡️" : "🩹"}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 900, color: insured ? C.green : C.text }}>보험 {insured ? "가입 중" : "미가입"}</div>
          <div style={{ fontSize: 11.5, color: C.sub }}>매 해 {fmt(INS_PREMIUM)} 내고, 블랙스완(큰 병·사고·화재)의 <b>약 90% 피해를 막아요</b></div>
        </div>
        <span style={{ fontSize: 13, fontWeight: 800, color: insured ? C.green : C.sub }}>{insured ? "ON ✓" : "OFF"}</span>
      </button>

      {/* 레버리지 */}
      {(maxNewLoan > 0 || (rec.loan || 0) > 0) && (
        <div style={{ marginTop: 12, background: "#fff4f2", border: `2px solid #e8837a`, borderRadius: 14, padding: 14 }}>
          <div style={{ fontFamily: "'Black Han Sans'", color: "#c0392b", fontSize: 16 }}>{inDebt ? "🔴 빚 갚기 (상환 우선)" : "⚠️ 레버리지 — 빚내서 투자하기 (고급)"}</div>
          <div style={{ fontSize: 11.5, color: "#a2554e", marginTop: 2 }}>{inDebt ? <>지금은 <b>빚 {fmt(rec.loan)}</b>이 있어서 새 대출은 안 돼요. 자산을 팔아 빚부터 갚으세요.</> : <>빌린 돈으로 더 크게! 폭락하면 <b>강제청산(반대매매)</b>. 대출금리 {((rec.rate + LOAN_SPREAD) * 100).toFixed(1)}%</>}</div>
          {maxNewLoan > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b style={{ color: "#c0392b", fontSize: 14 }}>🔻 대출 받기</b><span style={{ color: C.gold, fontFamily: "'Black Han Sans'", fontSize: 18 }}>{fmt(newLoan)}</span>
              </div>
              <input type="range" min={0} max={maxNewLoan} value={newLoan} onChange={(e) => { setNewLoan(+e.target.value); }} style={{ width: "100%", height: 22, accentColor: "#c0392b" }} />
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, color: C.sub }}><span>0</span><span>최대 {fmt(maxNewLoan)}</span></div>
            </div>
          )}
          {inDebt && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                <b style={{ color: C.green, fontSize: 14 }}>🔺 빚 갚기</b><span style={{ color: C.gold, fontFamily: "'Black Han Sans'", fontSize: 18 }}>{fmt(repayEff)}</span>
              </div>
              <input type="range" min={0} max={Math.max(1, maxRepay)} value={repayEff} onChange={(e) => setRepay(+e.target.value)} style={{ width: "100%", height: 22, accentColor: C.green }} />
              <div style={{ fontSize: 10.5, color: C.sub }}>지금 갚을 수 있는 최대 {fmt(maxRepay)}. <b>더 갚으려면 위에서 자산을 파세요</b> (판 돈이 여기로).</div>
            </div>
          )}
        </div>
      )}

      {/* 자산 슬라이더 */}
      <div className="allocGrid" style={{ marginTop: 14 }}>
        {ALLOC.map((item) => {
          const cur = rec[item.key] || 0, val = t[item.key] || 0, delta = val - cur;
          const fl = floors[item.key] || 0;
          return (
            <div key={item.key} style={{ background: C.panel2, borderRadius: 12, padding: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 20 }}>{item.emoji}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, color: item.color }}>{item.name} {!item.sell && <span style={{ fontSize: 10, color: C.sub }}>🔒못팜</span>}</div>
                  <div style={{ fontSize: 10.5, color: C.sub }}>{item.hint}</div>
                </div>
                <div style={{ textAlign: "right", minWidth: 82 }}>
                  <div style={{ fontFamily: "'Black Han Sans'", color: C.gold }}>{fmt(val)}</div>
                  {delta !== 0 && <div style={{ fontSize: 10.5, fontWeight: 800, color: delta > 0 ? C.blue : C.red }}>{delta > 0 ? "사기 +" : "팔기 -"}{fmt(Math.abs(delta))}</div>}
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 8 }}>
                <Stepper onClick={() => setVal(item.key, val - 5)}>-5</Stepper>
                <Stepper onClick={() => setVal(item.key, val - 1)}>-1</Stepper>
                <input type="range" min={fl} max={Math.max(fl, pool)} value={val} onChange={(e) => setVal(item.key, +e.target.value)} style={{ flex: 1, accentColor: item.color }} />
                <Stepper onClick={() => setVal(item.key, val + 1)}>+1</Stepper>
                <Stepper onClick={() => setVal(item.key, val + 5)}>+5</Stepper>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ marginTop: 14 }}>
        <Btn fill full disabled={!valid} onClick={() => onSubmit({ targets: t, newLoan, repay: repayEff, insured })}>{valid ? "이대로 확정 →" : "금액이 초과됐어요 (줄여요)"}</Btn>
      </div>
      {onChangeJob && !rec.jobChanged && rec.age < RETIRE_AGE && (
        <div style={{ marginTop: 10, textAlign: "center" }}>
          <Btn small color="#fb923c" onClick={() => { if (confirm("이직하면 이번 해 월급을 받지 못합니다. (게임당 1회) 진행할까요?")) onChangeJob(); }}>🔄 이직하기 (1회 · 이번 해 월급 없음)</Btn>
        </div>
      )}
      {rec.jobChanged && <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>이직 기회는 모두 사용했어요.</p>}
      <p style={{ color: C.sub, fontSize: 11, textAlign: "center", marginTop: 8 }}>단위: 1칸 = 10만원 · 안 판 자산은 그대로 유지돼요</p>
    </div>
  );
}
const Stepper = ({ children, onClick }) => <button onClick={onClick} style={{ background: C.panel2, color: C.sub, border: `1px solid ${C.line}`, borderRadius: 8, padding: "4px 7px", fontSize: 12, cursor: "pointer", fontWeight: 700 }}>{children}</button>;

function ResultBreakdown({ result, rec, onNext, onDead }) {
  return (
    <div style={{ animation: "pop .35s" }}>
      <div style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 16, padding: 16, marginTop: 12 }}>
        <SectionLabel>📑 나의 결과</SectionLabel>
        <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
          {result.lines.length === 0 && result.swans.length === 0 && <div style={{ color: C.sub }}>이번엔 시장 등락 영향은 없었어요.</div>}
          {result.lines.map((l, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, background: C.panel2, borderRadius: 10, padding: "8px 10px" }}>
              <span style={{ flex: 1, fontWeight: 700 }}>{l.isParents ? "🎁 부모님 보답" : l.isBonus ? "🧓 연금 보너스" : assetName(l.key)}
                {!l.isParents && !l.isBonus && <span style={{ color: C.sub, fontSize: 11, marginLeft: 6 }}>{(l.rate * 100).toFixed(1)}%</span>}</span>
              {!l.isParents && !l.isBonus && <span style={{ color: C.sub, fontSize: 12 }}>{fmt(l.before)} →</span>}
              <span style={{ fontWeight: 900, color: l.diff >= 0 ? C.green : C.red, minWidth: 90, textAlign: "right" }}>{l.diff >= 0 ? "+" : "-"}{fmt(Math.abs(l.diff))}</span>
            </div>
          ))}
        </div>
        {result.swans.map((swan, i) => (
          <div key={i} style={{ marginTop: 10, borderRadius: 12, padding: 12, border: `2px solid ${swan.insured ? C.green : C.red}`, background: swan.insured ? "#e8f8f1" : "#fdeceb" }}>
            <div style={{ fontWeight: 900, color: swan.insured ? C.green : C.red }}>
              {swan.insured ? "🛡️ 보험이 지켜줬어요!" : "💥 블랙스완 직격!"} — {swan.label}
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>
              총 피해 {fmt(swan.raw)} 중 {swan.insured ? <>보험이 <b style={{ color: C.green }}>{fmt(swan.covered)}</b> 보장 → 실제 </> : "보험 없어서 "}
              <b style={{ color: C.red }}>-{fmt(swan.damage)}</b>
            </div>
            {swan.toLoan > 0 && (
              <div style={{ fontSize: 12, color: C.red, marginTop: 4, fontWeight: 700 }}>
                💸 당장 현금화할 자산이 부족해 <b>{fmt(swan.toLoan)}</b>를 빚으로! (부동산·연금은 급할 때 못 씀 → 유동성 중요)
              </div>
            )}
          </div>
        ))}
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
      {result.bankrupt && (
        <div style={{ marginTop: 12, background: "#fdeceb", border: `2px solid ${C.red}`, borderRadius: 12, padding: "10px 12px", textAlign: "center", color: C.red, fontWeight: 800, fontSize: 13 }}>
          ⚠️ 빚이 자산보다 많아요! 파산은 아니지만, <b>새 대출은 막히고</b> 소득·매각으로 빚부터 갚아야 해요. 💪
        </div>
      )}
      {onNext ? (
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

/* 포트폴리오 막대 (최종 결산용) */
function PortfolioBar({ p, showLegend }) {
  const s = Math.max(1, assetsSum(p));
  return (
    <div>
      <div style={{ display: "flex", height: 9, borderRadius: 6, overflow: "hidden", background: "#eceaf3" }}>
        {ASSETS.map((a) => { const v = p[a.key] || 0; return v > 0 ? <div key={a.key} style={{ width: `${(v / s) * 100}%`, background: a.color }} /> : null; })}
      </div>
      {showLegend && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 8px", marginTop: 5, justifyContent: "center" }}>
          {ASSETS.filter((a) => (p[a.key] || 0) > 0).map((a) => (
            <span key={a.key} style={{ fontSize: 10.5, color: C.sub }}><span style={{ color: a.color }}>●</span> {a.name} {fmt(p[a.key])}</span>
          ))}
          {(p.pension || 0) > 0 && null}
          {(p.loan || 0) > 0 && <span style={{ fontSize: 10.5, color: C.red, fontWeight: 700 }}>▼ 빚 {fmt(p.loan)}</span>}
        </div>
      )}
    </div>
  );
}

function BankruptScreen({ rec, isClass, onBack }) {
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <QuizScreen onBack={() => setQuiz(false)} />;
  return (
    <Centered>
      <div style={{ textAlign: "center", maxWidth: 400, animation: "pop .4s" }}>
        <div style={{ fontSize: 64 }}>💀</div>
        <Title size={34}>파산…</Title>
        <p style={{ color: C.sub, marginTop: 10, lineHeight: 1.6 }}>{rec.name}님은 <b>{rec.age}세</b>에 순자산이 마이너스가 되어 게임에서 탈락했어요.</p>
        <div style={{ background: C.panel, border: `2px solid ${C.red}`, borderRadius: 14, padding: 14, marginTop: 12 }}>
          <div style={{ color: C.red, fontFamily: "'Black Han Sans'", fontSize: 22 }}>{fmt(netWorth(rec))}</div>
          <div style={{ fontSize: 12, color: C.sub, marginTop: 4 }}>빚 {fmt(rec.loan || 0)}</div>
        </div>
        <p style={{ color: C.gold, fontWeight: 800, marginTop: 14, lineHeight: 1.6 }}>"빚투·몰빵은 위험해. 분산투자 + 보험 + 꾸준한 저축이 진짜 생존법!"</p>
        <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
          <Btn fill onClick={() => setQuiz(true)}>📝 정리 문제 풀기</Btn>
          <Btn color={C.sub} onClick={onBack}>처음으로</Btn>
        </div>
      </div>
    </Centered>
  );
}

function FinalRanking({ list, meId, onBack }) {
  const [quiz, setQuiz] = useState(false);
  if (quiz) return <QuizScreen onBack={() => setQuiz(false)} />;
  const ranked = [...list].sort((a, b) => netWorth(b) - netWorth(a));
  const top3 = ranked.slice(0, 3), rest = ranked.slice(3);
  const myRank = ranked.findIndex((p) => p.id === meId);
  const me = myRank >= 0 ? ranked[myRank] : null;
  const filial = [...ranked].sort((a, b) => (b.parents || 0) - (a.parents || 0))[0];
  const medals = ["🥇", "🥈", "🥉"], pColor = ["#e8c14d", "#cbd5e1", "#cd7f32"], pHeight = [140, 105, 88];
  return (
    <div style={{ maxWidth: 640, margin: "0 auto", padding: 16, animation: "pop .4s" }}>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontSize: 46 }}>🏆</div>
        <Title size={34}>인생 최종 결산</Title>
      </div>
      {me && (
        <div style={{ textAlign: "center", margin: "14px 0", background: C.panel, border: `2px solid ${C.gold}`, borderRadius: 14, padding: 14, animation: "pop .5s" }}>
          <div style={{ color: C.sub, fontSize: 13 }}>{me.name}님은</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 30, color: me.bankrupt ? C.red : C.gold }}>{me.bankrupt ? "빚더미 💦" : `${myRank + 1}등 🎉`}</div>
          <div style={{ marginTop: 2 }}>순자산 <b style={{ color: me.bankrupt ? C.red : C.gold }}>{fmt(netWorth(me))}</b></div>
          <div style={{ marginTop: 10 }}><PortfolioBar p={me} showLegend /></div>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, alignItems: "end", marginTop: 8 }}>
        {[1, 0, 2].map((idx) => {
          const p = top3[idx]; if (!p) return <div key={idx} />;
          const job = jobByName(p.job), isMe = p.id === meId;
          return (
            <div key={p.id} style={{ textAlign: "center" }}>
              <div style={{ fontSize: 28 }}>{medals[idx]}</div>
              <div style={{ fontSize: 22 }}>{job?.emoji}</div>
              <div style={{ fontWeight: 900, fontSize: 13, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""}</div>
              <div style={{ fontFamily: "'Black Han Sans'", fontSize: 12, color: C.gold }}>{fmt(netWorth(p))}</div>
              <div style={{ height: pHeight[idx], marginTop: 6, borderRadius: "10px 10px 0 0", background: `linear-gradient(180deg,${pColor[idx]},${pColor[idx]}33)`, border: `1px solid ${pColor[idx]}`, display: "grid", placeItems: "start center", paddingTop: 6, fontFamily: "'Black Han Sans'", color: C.ink, fontSize: 18 }}>{idx + 1}</div>
            </div>
          );
        })}
      </div>
      {rest.length > 0 && (
        <div style={{ display: "grid", gap: 6, marginTop: 14 }}>
          {rest.map((p, i) => {
            const isMe = p.id === meId, job = jobByName(p.job);
            return (
              <div key={p.id} style={{ background: C.panel, border: `1px solid ${isMe ? C.gold : C.line}`, borderRadius: 10, padding: "8px 12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontFamily: "'Black Han Sans'", color: C.sub, width: 24 }}>{i + 4}</span>
                  <span style={{ fontSize: 18 }}>{job?.emoji}</span>
                  <span style={{ flex: 1, fontWeight: 700, color: isMe ? C.gold : C.text }}>{p.name}{isMe ? " (나)" : ""} <span style={{ color: C.sub, fontSize: 11, fontWeight: 400 }}>{p.job}{p.bankrupt ? " · 빚더미" : ""}</span></span>
                  <b style={{ color: p.bankrupt ? C.red : C.gold }}>{fmt(netWorth(p))}</b>
                </div>
                <div style={{ marginTop: 7 }}><PortfolioBar p={p} /></div>
              </div>
            );
          })}
        </div>
      )}
      {filial && (filial.parents || 0) > 0 && (
        <div style={{ textAlign: "center", marginTop: 14, color: C.sub, fontSize: 13 }}>🎁 효도왕: <b style={{ color: "#fb7185" }}>{filial.name}</b> (누적 {fmt(filial.parents)})</div>
      )}
      {ranked.length === 0 && <Empty>참가자 데이터가 없어요.</Empty>}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
        <Btn fill onClick={() => setQuiz(true)}>📝 정리 문제 풀기</Btn>
        <Btn small color={C.sub} onClick={onBack}>처음으로</Btn>
      </div>
    </div>
  );
}

function QuizScreen({ onBack }) {
  const [picked, setPicked] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const score = QUIZ.reduce((s, q, i) => s + (picked[i] === q.answer ? 1 : 0), 0);
  const allDone = QUIZ.every((_, i) => picked[i] != null);
  return (
    <div style={{ maxWidth: 720, margin: "0 auto", padding: 16, animation: "pop .3s" }}>
      <div style={{ textAlign: "center", marginTop: 6 }}>
        <div style={{ fontSize: 40 }}>📝</div>
        <Title size={30}>정리 문제 · 투자의 3원칙</Title>
        <p style={{ color: C.sub, fontSize: 13, marginTop: 4 }}>안전성 · 수익성 · 유동성 — 오늘 배운 걸 확인해봐요!</p>
      </div>
      <div style={{ display: "grid", gap: 12, marginTop: 16 }}>
        {QUIZ.map((q, i) => {
          const correct = picked[i] === q.answer;
          return (
            <div key={i} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 14, padding: 14 }}>
              <div style={{ fontWeight: 800, marginBottom: 8 }}><span style={{ color: C.gold }}>Q{i + 1}.</span> {q.q}</div>
              <div style={{ display: "grid", gap: 8, gridTemplateColumns: q.options.length > 3 ? "1fr 1fr" : "repeat(3,1fr)" }}>
                {q.options.map((op) => {
                  const chosen = picked[i] === op;
                  let bg = C.panel2, bd = C.line, col = C.text;
                  if (submitted) { if (op === q.answer) { bg = "#e8f8f1"; bd = C.green; col = C.green; } else if (chosen) { bg = "#fdeceb"; bd = C.red; col = C.red; } }
                  else if (chosen) { bg = "#fff7e6"; bd = C.gold; col = C.gold; }
                  return (
                    <button key={op} disabled={submitted} onClick={() => setPicked((p) => ({ ...p, [i]: op }))}
                      style={{ cursor: submitted ? "default" : "pointer", background: bg, border: `2px solid ${bd}`, color: col, borderRadius: 10, padding: "10px 8px", fontWeight: 800, fontSize: 14 }}>
                      {op}{submitted && op === q.answer ? " ✓" : ""}
                    </button>
                  );
                })}
              </div>
              {submitted && <div style={{ marginTop: 8, fontSize: 13, fontWeight: 700, color: correct ? C.green : C.red }}>{correct ? "정답! 🎉" : `아쉬워요. 정답은 "${q.answer}"`}</div>}
            </div>
          );
        })}
      </div>
      {submitted && (
        <div style={{ textAlign: "center", marginTop: 16, background: C.panel, border: `2px solid ${C.gold}`, borderRadius: 14, padding: 16 }}>
          <div style={{ color: C.sub, fontSize: 13 }}>내 점수</div>
          <div style={{ fontFamily: "'Black Han Sans'", fontSize: 34, color: C.gold }}>{score} / {QUIZ.length}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{score === QUIZ.length ? "완벽해요! 투자 3원칙 마스터 👑" : score >= 3 ? "잘했어요! 조금만 더 🔥" : "다시 한 번 복습해봐요 💪"}</div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, justifyContent: "center", marginTop: 18, flexWrap: "wrap" }}>
        {!submitted
          ? <Btn fill disabled={!allDone} onClick={() => setSubmitted(true)}>{allDone ? "채점하기" : "모든 문제를 풀어주세요"}</Btn>
          : <Btn color={C.sub} onClick={() => { setSubmitted(false); setPicked({}); }}>다시 풀기</Btn>}
        <Btn small color={C.sub} onClick={onBack}>← 돌아가기</Btn>
      </div>
    </div>
  );
}

/* ====== 속보 배너 ====== */
function NewsList({ events }) {
  return (
    <div style={{ display: "grid", gap: 10 }}>
      {events.length > 1 && <div style={{ fontFamily: "'Black Han Sans'", color: C.red, fontSize: 14 }}>📰 속보 {events.length}건 동시 발생!</div>}
      {events.map((ev, i) => <NewsBanner key={i} event={ev} />)}
    </div>
  );
}
/* 뉴스 팝업 */
function NewsModal({ events, onReveal }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "#000b", display: "grid", placeItems: "center", padding: 16, zIndex: 65, overflow: "auto" }}>
      <div style={{ width: "100%", maxWidth: 520, animation: "modalPop .3s" }}>
        {events.length > 1 && <div style={{ textAlign: "center", fontFamily: "'Black Han Sans'", color: "#ffd9d9", fontSize: 16, marginBottom: 8 }}>📰 속보 {events.length}건 동시 발생!</div>}
        <div style={{ display: "grid", gap: 10 }}>{events.map((ev, i) => <NewsBanner key={i} event={ev} />)}</div>
        <div style={{ textAlign: "center", marginTop: 16 }}>
          <Btn fill onClick={onReveal}>💥 내 결과 확인하기</Btn>
        </div>
      </div>
    </div>
  );
}
function NewsBanner({ event }) {
  const cc = CAT[event.cat] || C.gold;
  const now = new Date();
  const hh = String(now.getHours()).padStart(2, "0"), mm = String(now.getMinutes()).padStart(2, "0");
  const tick = ` 📢 속보  ·  ${event.ticker || event.title}  ·  ${event.title}  · `;
  return (
    <div style={{ borderRadius: 14, overflow: "hidden", border: `2px solid #ef4444`, animation: "slideDown .4s", boxShadow: "0 10px 30px #0008" }}>
      <div style={{ background: "linear-gradient(90deg,#b91c1c,#ef4444)", color: "#fff", padding: "7px 12px", display: "flex", alignItems: "center", gap: 8 }}>
        <span style={{ background: "#fff", color: "#b91c1c", fontFamily: "'Black Han Sans'", fontSize: 12, padding: "1px 7px", borderRadius: 4 }}>LIVE</span>
        <span style={{ fontFamily: "'Black Han Sans'", letterSpacing: 1 }}>📺 머니뉴스 24</span>
        <span style={{ marginLeft: "auto", fontSize: 12, opacity: 0.9 }}>속보 · {hh}:{mm}</span>
      </div>
      <div style={{ background: "linear-gradient(160deg,#1a1014,#15171f)", padding: 16 }}>
        <span style={{ display: "inline-block", background: `${cc}22`, color: cc, border: `1px solid ${cc}`, borderRadius: 6, fontSize: 11, fontWeight: 800, padding: "2px 8px", marginBottom: 10 }}>{event.icon} {event.cat}</span>
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

/* ===================== 다연쌤: 비밀번호 게이트 ===================== */
function AdminGate({ onBack }) {
  const [authed, setAuthed] = useState(false);
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  if (authed) return <AdminView onBack={onBack} />;
  const submit = () => { if (pw === ADMIN_PW) setAuthed(true); else { setErr(true); setPw(""); } };
  return (
    <Centered>
      <div style={{ textAlign: "center", width: 300, animation: "pop .3s", position: "relative" }}>
        <span style={{ cursor: "pointer", color: C.sub, position: "absolute", left: -4, top: -8 }} onClick={onBack}>←</span>
        <div style={{ fontSize: 44 }}>🔒</div>
        <Title size={26}>다연쌤 전용</Title>
        <div style={{ color: C.sub, fontSize: 12, marginTop: 4 }}>비밀번호를 입력하세요</div>
        <input value={pw} type="password" inputMode="numeric" onChange={(e) => { setPw(e.target.value); setErr(false); }}
          onKeyDown={(e) => e.key === "Enter" && submit()} placeholder="● ● ● ● ● ●"
          style={{ marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: `2px solid ${err ? C.red : C.line}`, background: C.panel, color: C.text, fontSize: 20, textAlign: "center", letterSpacing: 6, outline: "none" }} />
        {err && <div style={{ color: C.red, fontSize: 12, marginTop: 8, fontWeight: 700 }}>비밀번호가 틀렸어요</div>}
        <div style={{ marginTop: 14 }}><Btn fill full disabled={!pw} onClick={submit}>입장 →</Btn></div>
      </div>
    </Centered>
  );
}

/* ====== 엑셀 저장 ====== */
function exportExcel(players) {
  const rows = [...players].sort((a, b) => netWorth(b) - netWorth(a)).map((p, i) => ({
    순위: i + 1, 이름: p.name, 직업: p.job, 나이: p.age || ageForRound(p.round || 1),
    "순자산(만원)": netWorth(p) * UNIT, "비트코인": (p.bitcoin || 0) * UNIT, "주식": (p.stock || 0) * UNIT,
    "채권": (p.bond || 0) * UNIT, "적금": (p.savings || 0) * UNIT, "연금": (p.pension || 0) * UNIT,
    "부동산": (p.realestate || 0) * UNIT, "명품": (p.luxury || 0) * UNIT, "통장": (p.checking || 0) * UNIT,
    "빚(대출)": (p.loan || 0) * UNIT, "누적효도": (p.parents || 0) * UNIT, "보험": p.insured ? "O" : "X", "파산": p.bankrupt ? "O" : "X",
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "머니서바이벌 결과");
  XLSX.writeFile(wb, `머니서바이벌_결과_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/* ===================== 다연쌤 ===================== */
function AdminView({ onBack }) {
  const [players, setPlayers] = useState([]);
  const [game, setGame] = useState(null);
  const [pickNews, setPickNews] = useState(false);
  const [sel, setSel] = useState([]); // 선택한 속보 id (최대 2)

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
  const newsIds = game?.newsIds || (game?.newsId ? [game.newsId] : []);

  const start = () => sSet(GKEY, { round: 1, phase: "invest", newsIds: null, rate: DEFAULT_RATE });
  const release = (ids) => {
    const arr = ids && ids.length ? ids : [randEvent().id];
    const evs = arr.map(eventById).filter(Boolean);
    const nrate = clamp(rate + evsRateDelta(evs), 0, 0.15);
    sSet(GKEY, { ...(game || { round: 1 }), phase: "news", newsIds: arr, newsId: null, rate: nrate });
  };
  const next = () => sSet(GKEY, { round: round + 1, phase: "invest", newsIds: null, rate });
  const setRateManual = (d) => sSet(GKEY, { ...(game || { round: 1, phase: "invest" }), rate: clamp(rate + d, 0, 0.15) });
  const endGame = () => sSet(GKEY, { ...(game || { round: 1 }), phase: "end" });
  const reset = async () => { const keys = await sList("mg:p:"); await Promise.all(keys.map(sDel)); await sDel(GKEY); setPlayers([]); setGame(null); };
  const toggleSel = (id) => setSel((s) => s.includes(id) ? s.filter((x) => x !== id) : s.length >= 2 ? s : [...s, id]);
  const swapLives = async () => {
    const keys = await sList("mg:p:");
    const all = (await Promise.all(keys.map((k) => sGet(k)))).filter(Boolean);
    const vol = all.filter((p) => p.wantSwap && (p.round || 1) === round);
    if (vol.length < 2) { alert("‘인생 바꾸기’ 신청자가 2명 이상이어야 해요."); return; }
    if (!confirm(`인생 바꾸기 신청자 ${vol.length}명의 재산·직업을 서로 랜덤 교환할까요?`)) return;
    const shuffled = [...vol].sort(() => Math.random() - 0.5);
    const stamp = Date.now();
    const fin = shuffled.map((p) => { const { id, name, swapStamp, wantSwap, ...rest } = p; return rest; });
    await Promise.all(shuffled.map((p, i) => {
      const nf = fin[(i + 1) % fin.length]; // 회전 → 아무도 자기 인생 유지 안 함
      return sSet(pkey(p.id), { ...nf, id: p.id, name: p.name, round, age: ageForRound(round), lastSalaryRound: round, ready: false, wantSwap: false, swapStamp: stamp });
    }));
  };
  const swapCount = players.filter((p) => p.wantSwap && (p.round || 1) === round).length;

  if (!firebaseReady) {
    return (
      <div style={{ maxWidth: 640, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ cursor: "pointer", color: C.sub }} onClick={onBack}>←</span>
          <Title size={24}>🖥️ 다연쌤</Title>
        </div>
        <Empty>실시간 교실 모드는 <b>Firebase 연결</b>이 필요해요.<br />(연결 전에도 학생들은 ‘혼자 연습’으로 전체 기능을 즐길 수 있어요.)</Empty>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: 16 }}>
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
        <div style={{ display: "flex", gap: 8 }}>
          {players.length > 0 && <Btn small color={C.green} onClick={() => exportExcel(players)}>📥 엑셀 다운로드</Btn>}
          <Btn small color={C.sub} onClick={() => { if (confirm("전체 초기화할까요? 모든 참가자 데이터가 삭제됩니다.")) reset(); }}>전체 초기화</Btn>
        </div>
      </div>

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
              <Btn fill color={C.red} onClick={() => { setSel([]); setPickNews(true); }}>📰 속보 띄우기 (최대 2개)</Btn>
            </div>
            <span style={{ color: C.sub, fontSize: 14 }}>투자 완료 <b style={{ color: C.gold }}>{readyCount}</b> / {classPlayers.length}명</span>
            {classPlayers.length > 0 && readyCount === classPlayers.length && <Badge color={C.green}>전원 완료!</Badge>}
            <span style={{ borderLeft: `1px solid ${C.line}`, paddingLeft: 10, color: C.sub, fontSize: 13 }}>금리 조절:</span>
            <Btn small color={C.blue} onClick={() => setRateManual(-0.01)}>▼ 인하</Btn>
            <Btn small color={C.red} onClick={() => setRateManual(0.01)}>▲ 인상</Btn>
            <Btn small color="#9333ea" onClick={swapLives}>🔀 인생 바꾸기 실행 ({swapCount})</Btn>
          </>
        ) : (
          <Btn fill onClick={next}>⏭ 다음 해로 ({ageForRound(round + 1)}세)</Btn>
        )}
        {game && phase !== "end" && (
          <Btn color={C.gold} onClick={() => { if (confirm("게임을 종료하고 최종 순위를 발표할까요?")) endGame(); }}>🏁 게임 종료 · 순위 발표</Btn>
        )}
      </div>

      {phase === "news" && newsIds.length > 0 && (
        <div style={{ marginTop: 14, display: "grid", gap: 10 }}>
          {newsIds.length > 1 && <div style={{ fontFamily: "'Black Han Sans'", color: C.red }}>📰 속보 {newsIds.length}건 동시!</div>}
          {newsIds.map((id) => { const e = eventById(id); return e ? <NewsBanner key={id} event={e} /> : null; })}
        </div>
      )}

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
                          {p.wantSwap && <span style={{ marginLeft: 4, color: "#9333ea", fontSize: 11, fontWeight: 800 }}>🔀신청</span>}
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
          <div onClick={(e) => e.stopPropagation()} style={{ background: C.panel, border: `1px solid ${C.line}`, borderRadius: 18, padding: 18, width: "100%", maxWidth: 520, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <Title size={22}>📰 속보 고르기 (최대 2개)</Title>
            <p style={{ color: C.sub, fontSize: 12, margin: "4px 0 0" }}>여러 개 고르면 동시에 터집니다. 선택 <b style={{ color: C.gold }}>{sel.length}</b>/2</p>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              <Btn small color={C.gold} onClick={() => { release([]); setPickNews(false); }}>🎲 랜덤 1개</Btn>
              <Btn small fill color={C.red} disabled={sel.length === 0} onClick={() => { release(sel); setPickNews(false); }}>▶ 선택한 속보 띄우기 ({sel.length})</Btn>
            </div>
            <div style={{ overflow: "auto", marginTop: 12, display: "grid", gap: 6 }}>
              {Object.keys(CAT).map((cat) => {
                const evs = EVENTS.filter((e) => e.cat === cat);
                if (!evs.length) return null;
                return (
                  <div key={cat}>
                    <div style={{ fontSize: 11, fontWeight: 800, color: CAT[cat], margin: "6px 2px 2px" }}>{cat}</div>
                    <div style={{ display: "grid", gap: 6 }}>
                      {evs.map((e) => {
                        const on = sel.includes(e.id);
                        return (
                          <button key={e.id} onClick={() => toggleSel(e.id)}
                            style={{ textAlign: "left", background: on ? "#fff7e6" : C.panel2, border: `2px solid ${on ? C.gold : C.line}`, borderRadius: 10, padding: 10, color: C.text, cursor: "pointer", display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontSize: 16 }}>{on ? "✅" : e.icon}</span>
                            <div style={{ flex: 1 }}>
                              <div style={{ fontWeight: 800, fontSize: 13 }}>{e.title}</div>
                              <div style={{ fontSize: 10.5, color: C.sub }}>{e.rateDelta ? `금리${e.rateDelta > 0 ? "▲" : "▼"} · ` : ""}{e.swan ? "블랙스완 · " : ""}{e.ticker || ""}</div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
