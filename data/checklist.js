// 임장 체크리스트 정의 — 모든 항목·단가·프리셋의 단일 출처
// 출처: 포포의 가계부 임장 체크리스트(엑셀 51항목) + 노션 "임장 체크리스트 집안/집밖"(21항목 순증)
// 갱신: "임장 항목 추가해줘" / 단가는 "인테리어 단가 업데이트해줘"
// 항목을 추가·삭제해도 기존 기록은 id 기준이라 유지된다. id는 절대 바꾸지 말 것.

const PEOPLE = ["딩구", "저"];          // 표시 이름. 순서 = 화면 좌→우
const RATE_LABEL = { 2: "좋음", 1: "보통", 0: "나쁨" };

// type: rate(3단계) | num | text | sel | bool
// core: 핵심 항목 (현장에서 기본 노출)
// revisit: 저녁·출퇴근 등 특정 시간대라 재방문 확인이 필요한 항목
// fix: 인테리어 견적 연결 공사 키 (rate가 0=나쁨이면 그 공사 필요로 계산)
const CATS = [
  { id: "pre",    name: "사전 조사",   icon: "📋", desc: "집에서 미리" },
  { id: "danji",  name: "단지",        icon: "🏘", desc: "집 밖 30분" },
  { id: "traffic",name: "교통",        icon: "🚇", desc: "" },
  { id: "agent",  name: "부동산 조사", icon: "🤝", desc: "중개사에게 물어볼 것" },
  { id: "ext",    name: "건물 외부",   icon: "🧱", desc: "" },
  { id: "in",     name: "집 내부",     icon: "🏠", desc: "인테리어 예산이 여기서 갈림" },
  { id: "leak",   name: "배관·누수",   icon: "💧", desc: "가장 비싼 하자" },
  { id: "noise",  name: "소음·분위기", icon: "🔊", desc: "" },
  { id: "dev",    name: "개발 예정",   icon: "🏗", desc: "" },
];

const ITEMS = [
  // ── 사전 조사 (준공년도·세대수·시세는 기본정보/시세 폼에서 입력) ──
  { id:"pre_heat",   cat:"pre", label:"난방 방식", type:"sel", opts:["개별","지역","중앙"], core:1,
    hint:"중앙난방은 관리비·개별제어 불리" },
  { id:"pre_trade",  cat:"pre", label:"최근 매매·전세 거래량", type:"rate", core:1,
    hint:"거래가 없는 단지는 팔 때 고생" },
  { id:"pre_price",  cat:"pre", label:"주변 시세 대비 가격", type:"rate", core:1 },
  { id:"pre_school", cat:"pre", label:"배정 초등학교", type:"text" },
  { id:"pre_hakgun", cat:"pre", label:"학군 평판", type:"rate" },

  // ── 단지 ──
  { id:"dan_school", cat:"danji", label:"초등학교까지 거리·안전", type:"rate", core:1,
    hint:"큰길 건너야 하는지" },
  { id:"dan_gap",    cat:"danji", label:"동 간 거리 (채광·프라이버시)", type:"rate", core:1 },
  { id:"dan_park",   cat:"danji", label:"세대당 주차 대수", type:"num", unit:"대", core:1,
    hint:"1.0 미만이면 저녁에 전쟁" },
  { id:"dan_park2",  cat:"danji", label:"이중주차·주차난", type:"rate", core:1, revisit:1,
    hint:"저녁 8시 이후에 봐야 진짜" },
  { id:"dan_elev",   cat:"danji", label:"지하주차장 ↔ 엘리베이터 연결", type:"bool", core:1,
    hint:"연결 안 되면 비 오는 날·장 볼 때 고생" },
  { id:"dan_cvs",    cat:"danji", label:"편의점까지 도보", type:"num", unit:"분", core:1 },
  { id:"dan_bar",    cat:"danji", label:"주차 차단바 유무", type:"bool" },
  { id:"dan_slope",  cat:"danji", label:"경사·평지 여부", type:"rate" },
  { id:"dan_infra",  cat:"danji", label:"주변 인프라 (마트·병원)", type:"rate" },
  { id:"dan_royal",  cat:"danji", label:"로열동·로열층 여부", type:"rate" },
  { id:"dan_academy",cat:"danji", label:"학원가 위치·거리", type:"rate" },
  { id:"dan_rent",   cat:"danji", label:"단지 내 임대세대 여부", type:"bool" },
  { id:"dan_paint",  cat:"danji", label:"외벽 페인트(도색) 시기", type:"text",
    hint:"도색하며 외벽 크랙을 같이 보수함" },
  { id:"dan_trash",  cat:"danji", label:"분리수거장 위치·상태", type:"rate" },
  { id:"dan_neighbor",cat:"danji",label:"이웃 단지 분위기", type:"rate" },

  // ── 교통 ──
  { id:"tr_station", cat:"traffic", label:"역세권 여부", type:"rate", core:1 },
  { id:"tr_walk",    cat:"traffic", label:"역·정거장까지 도보", type:"num", unit:"분", core:1 },
  { id:"tr_bus",     cat:"traffic", label:"버스 노선 수", type:"num", unit:"개" },
  { id:"tr_rush",    cat:"traffic", label:"출퇴근 시간대 교통", type:"rate", revisit:1 },
  { id:"tr_plan",    cat:"traffic", label:"향후 교통 인프라 개발계획", type:"rate" },

  // ── 부동산 조사 ──
  { id:"ag_nego",    cat:"agent", label:"가격 조정 가능 여부", type:"rate", core:1 },
  { id:"ag_gap",     cat:"agent", label:"매물별 가격 차이", type:"rate" },
  { id:"ag_demand",  cat:"agent", label:"최근 매매·전세 수요", type:"rate" },
  { id:"ag_resident",cat:"agent", label:"주 거주층 (직장인/가족 등)", type:"text" },
  { id:"ag_compare", cat:"agent", label:"주변 단지와 선호도 비교", type:"rate" },

  // ── 건물 외부 ──
  { id:"ex_wall",    cat:"ext", label:"외벽 상태·균열", type:"rate" },
  { id:"ex_elev",    cat:"ext", label:"엘리베이터 상태", type:"rate" },
  { id:"ex_sec",     cat:"ext", label:"공동현관 보안", type:"rate" },
  { id:"ex_clean",   cat:"ext", label:"단지 내 조경·청결", type:"rate" },

  // ── 집 내부 ──
  { id:"in_light",   cat:"in", label:"채광 (향)", type:"rate", core:1, hint:"남향·동남향인지" },
  { id:"in_water",   cat:"in", label:"수압", type:"rate", core:1, hint:"싱크대·화장실 동시에 틀어보기" },
  { id:"in_dobae",   cat:"in", label:"도배 상태", type:"rate", core:1, fix:"도배" },
  { id:"in_floor",   cat:"in", label:"장판·마루 상태", type:"rate", core:1, fix:"장판" },
  { id:"in_bath",    cat:"in", label:"화장실 상태", type:"rate", core:1, fix:"화장실" },
  { id:"in_kitchen", cat:"in", label:"싱크대·주방 상태", type:"rate", core:1, fix:"주방" },
  { id:"in_sash",    cat:"in", label:"샷시 상태·교체 여부", type:"rate", core:1, fix:"샷시",
    hint:"교체했으면 언제 했는지 메모" },
  { id:"in_boiler",  cat:"in", label:"보일러 연식", type:"num", unit:"년", core:1,
    hint:"10년 넘으면 교체 대상 (100만원대)" },
  { id:"in_air",     cat:"in", label:"통풍 (맞통풍 되는지)", type:"rate" },
  { id:"in_molding", cat:"in", label:"몰딩 상태", type:"rate" },
  { id:"in_bath2",   cat:"in", label:"화장실 덧방 시공 여부", type:"bool",
    hint:"덧방이면 수리비 저렴, 이미 덧방이면 다음엔 철거 필요" },
  { id:"in_shower",  cat:"in", label:"샤워부스 / 욕조", type:"rate" },
  { id:"in_fan",     cat:"in", label:"환풍기 작동", type:"rate" },
  { id:"in_veranda", cat:"in", label:"베란다 확장 여부", type:"bool" },
  { id:"in_vwater",  cat:"in", label:"베란다 수도관 연결 (세탁기)", type:"bool" },
  { id:"in_door",    cat:"in", label:"중문 여부", type:"bool" },
  { id:"in_dist",    cat:"in", label:"싱크대 아래 분배기 상태·냄새", type:"rate" },
  { id:"in_sill",    cat:"in", label:"문지방 (턱·울퉁불퉁)", type:"rate" },
  { id:"in_win",     cat:"in", label:"창문 상태·방범창", type:"rate" },
  { id:"in_closet",  cat:"in", label:"붙박이장 여부", type:"bool" },
  { id:"in_room",    cat:"in", label:"방 크기 (싱글 침대 들어가는지)", type:"rate" },

  // ── 배관·누수 ──
  { id:"lk_pipe",    cat:"leak", label:"배관 종류", type:"sel", opts:["엑셀배관","동배관","모름"], core:1,
    hint:"동배관 구축은 녹물·누수 위험" },
  { id:"lk_hist",    cat:"leak", label:"누수·수리 이력", type:"rate", core:1 },
  { id:"lk_neighbor",cat:"leak", label:"윗집·아랫집 누수 이력", type:"rate", core:1 },
  { id:"lk_stain",   cat:"leak", label:"천장·벽지 얼룩·곰팡이", type:"rate", core:1 },
  { id:"lk_cond",    cat:"leak", label:"창 주변 결로 흔적", type:"rate", core:1 },
  { id:"lk_smell",   cat:"leak", label:"습기·습한 냄새", type:"rate", core:1 },
  { id:"lk_partial", cat:"leak", label:"부분 도배 (누수 가림 의심)", type:"rate", core:1,
    hint:"한 면만 새 벽지면 의심" },
  { id:"lk_mold",    cat:"leak", label:"결로·곰팡이 발견 위치", type:"text" },

  // ── 소음·분위기 ──
  { id:"no_night",   cat:"noise", label:"저녁 시간대 분위기", type:"rate", core:1, revisit:1 },
  { id:"no_road",    cat:"noise", label:"대로변 차량 소음", type:"rate" },
  { id:"no_rail",    cat:"noise", label:"철도 소음", type:"rate" },
  { id:"no_const",   cat:"noise", label:"공사 현장 소음", type:"rate" },
  { id:"no_floor",   cat:"noise", label:"층간 소음", type:"rate" },

  // ── 개발 예정 ──
  { id:"dv_redev",   cat:"dev", label:"재개발·재건축 계획", type:"rate",
    hint:"재건축 30년↑, 리모델링 15년↑ 가능" },
  { id:"dv_city",    cat:"dev", label:"도시개발 사업", type:"rate" },
  { id:"dv_traffic", cat:"dev", label:"교통 인프라 계획", type:"rate" },
  { id:"dv_mall",    cat:"dev", label:"대형 상업시설 개발", type:"rate" },
];

// ── 인테리어 견적 단가 (단위: 만원) ─────────────────────────────
// 기준일 2026-06 소형평수 기준. 해당 항목이 '나쁨'이면 그 공사가 필요하다고 보고 합산한다.
// per: "평" = 평당단가 × 평수, "식" = 평수 무관 고정
const FIX_COST = {
  기준일: "2026-06",
  공사: {
    도배:   { per:"평", min:6,  max:10, label:"도배(실크)" },
    장판:   { per:"평", min:4,  max:15, label:"장판 / 강마루" },
    화장실: { per:"식", min:250, max:450, label:"화장실 1개" },
    주방:   { per:"식", min:250, max:450, label:"싱크대·주방" },
    샷시:   { per:"평", min:30, max:50, label:"샷시 전체 교체" },
  },
  // 3개 이상 필요하면 사실상 올수리 → 업계 통상 견적선을 참고로 함께 보여준다
  올수리_평당: { min:200, max:250, 기준:"고급자재 포함 리모델링 전체" },
  올수리_기준개수: 3,
};

// ── 단지 프리셋 (data/policy.js 매물리스트와 동일 — 국토부 실거래가, 20평형대) ──
// 매매 = 2026년 5월 이후 실거래 평균. 현장 호가는 보통 이보다 10%쯤 높다 — 호가는 직접 입력할 것.
const PRESETS = [
  // 권선구 = 비규제 (LTV 70%)
  { 단지:"수원 아이파크시티 5단지", 구:"수원시 권선구", 동:"권선동", 연식:2015, 세대수:704,
    평형: [ {평:25, 매매:55300, 전세:38000} ] },
  { 단지:"수원역 해모로", 구:"수원시 권선구", 동:"세류동", 연식:2015, 세대수:863,
    평형: [ {평:23, 매매:56300, 전세:36000} ] },
  { 단지:"권선자이e편한세상", 구:"수원시 권선구", 동:"권선동", 연식:2011, 세대수:1753,
    평형: [ {평:25, 매매:60860, 전세:42000} ] },
  { 단지:"수원 아이파크시티 7단지", 구:"수원시 권선구", 동:"권선동", 연식:2016, 세대수:1596,
    평형: [ {평:24, 매매:61900, 전세:40000} ] },
  { 단지:"수원하늘채더퍼스트 2단지", 구:"수원시 권선구", 동:"곡반정동", 연식:2022, 세대수:1833,
    평형: [ {평:25, 매매:61625, 전세:40000} ] },
  { 단지:"수원하늘채더퍼스트 1단지", 구:"수원시 권선구", 동:"곡반정동", 연식:2022, 세대수:1403,
    평형: [ {평:25, 매매:69660, 전세:43000} ] },
  // 규제지역 (LTV 40%)
  { 단지:"수원한일타운", 구:"수원시 장안구", 동:"조원동", 연식:1999, 세대수:5282,
    평형: [ {평:24, 매매:49320, 전세:31000} ] },
  { 단지:"영통포레파크원", 구:"수원시 영통구", 동:"영통동", 연식:1997, 세대수:3129,
    평형: [ {평:20, 매매:46920, 전세:34000}, {평:23, 매매:52540, 전세:34000}, {평:25, 매매:58600, 전세:39000} ] },
  { 단지:"인계 래미안 노블클래스 1단지", 구:"수원시 팔달구", 동:"인계동", 연식:2009, 세대수:892,
    평형: [ {평:25, 매매:65800, 전세:50000} ] },
  { 단지:"매탄위브 하늘채", 구:"수원시 영통구", 동:"매탄동", 연식:2008, 세대수:3391,
    평형: [ {평:24, 매매:67460, 전세:41000}, {평:29, 매매:71000, 전세:44000} ] },
  { 단지:"화서역 푸르지오 더 에듀포레", 구:"수원시 장안구", 동:"천천동", 연식:2009, 세대수:2571,
    평형: [ {평:25, 매매:71620, 전세:44000} ] },
  { 단지:"수원SK스카이뷰", 구:"수원시 장안구", 동:"정자동", 연식:2013, 세대수:3498,
    평형: [ {평:24, 매매:72900, 전세:43000} ] },
  { 단지:"수원역 푸르지오자이", 구:"수원시 팔달구", 동:"고등동", 연식:2021, 세대수:4086,
    평형: [ {평:24, 매매:72100, 전세:46000} ] },
];
const PRESET_기준일 = "2026-08-17 실거래";

if (typeof module !== "undefined") module.exports = { PEOPLE, RATE_LABEL, CATS, ITEMS, FIX_COST, PRESETS, PRESET_기준일 };
