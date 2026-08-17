// 순수 로직 — 점수·견적·병합. 화면과 분리해서 node로 테스트 가능하게 둔다 (test.js)
// 데이터 구조
//   prop = { id, updatedAt, base:{}, price:{}, items:{ 항목id:{ 사람:{v, memo, at} } },
//            flags:{항목id:1}, verdict:{ 사람:{again, note, at} } }
//   v = rate:2|1|0 / num:숫자 / text·sel:문자열 / bool:true|false

const BASE_FIELDS  = ["단지명","주소","동","호수","평","층","총층","준공년도","세대수","부동산","전화","방문일","방문회차"];
const PRICE_FIELDS = ["매매호가","전세가","월세보증","월세"];

function uid() { return "p_" + Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4); }

function newProp(seed) {
  return Object.assign({ id: uid(), updatedAt: Date.now(), base: {}, price: {}, items: {}, flags: {}, verdict: {} }, seed || {});
}

// 두 사람 평가를 하나로 합칠 때: 낮은 쪽(보수적)을 채택
function resolve(entry) {
  if (!entry) return undefined;
  let out;
  for (const p in entry) {
    const v = entry[p] && entry[p].v;
    if (typeof v !== "number") continue;
    out = out === undefined ? v : Math.min(out, v);
  }
  return out;
}

// 점수: rate 항목만 대상. 미확인은 분모에서 제외 → "70점 (32/72 확인)"으로 표기
function calcScore(prop, ITEMS, CATS) {
  const byCat = {};
  CATS.forEach(c => byCat[c.id] = { got: 0, max: 0, done: 0, total: 0, pct: null });
  let got = 0, max = 0, done = 0, total = 0;
  ITEMS.forEach(it => {
    if (it.type !== "rate") return;
    const c = byCat[it.cat];
    total++; c.total++;
    const v = resolve(prop.items[it.id]);
    if (v === undefined) return;
    done++; c.done++;
    got += v; max += 2; c.got += v; c.max += 2;
  });
  CATS.forEach(c => { const b = byCat[c.id]; b.pct = b.max ? Math.round(b.got / b.max * 100) : null; });
  return { pct: max ? Math.round(got / max * 100) : null, done, total, byCat };
}

// 전체 항목(타입 무관) 기입 진행률
function calcProgress(prop, ITEMS) {
  let done = 0;
  ITEMS.forEach(it => {
    const e = prop.items[it.id];
    if (e && Object.keys(e).some(p => e[p] && e[p].v !== undefined && e[p].v !== "")) done++;
  });
  return { done, total: ITEMS.length, pct: Math.round(done / ITEMS.length * 100) };
}

// 인테리어 견적: fix가 걸린 항목이 '나쁨(0)'이면 그 공사 필요로 계산
function calcFix(prop, ITEMS, FIX_COST) {
  const pyeong = Number(prop.base.평) || 0;
  const list = [];
  ITEMS.forEach(it => {
    if (!it.fix) return;
    if (resolve(prop.items[it.id]) !== 0) return;
    const c = FIX_COST.공사[it.fix];
    if (!c) return;
    const mul = c.per === "평" ? pyeong : 1;
    list.push({ key: it.fix, label: c.label, min: c.min * mul, max: c.max * mul, per: c.per });
  });
  const min = list.reduce((s, x) => s + x.min, 0);
  const max = list.reduce((s, x) => s + x.max, 0);
  const isAll = list.length >= FIX_COST.올수리_기준개수;
  return {
    list, min, max, isAll, pyeongMissing: pyeong === 0 && list.some(x => x.per === "평"),
    allMin: pyeong * FIX_COST.올수리_평당.min, allMax: pyeong * FIX_COST.올수리_평당.max,
  };
}

function calcPrice(prop) {
  const 호가 = Number(prop.price.매매호가) || 0, 전세 = Number(prop.price.전세가) || 0, 평 = Number(prop.base.평) || 0;
  return {
    호가, 평당가: 평 && 호가 ? Math.round(호가 / 평) : null,
    전세가율: 호가 && 전세 ? Math.round(전세 / 호가 * 100) : null,
  };
}

// 두 사람 평가가 갈린 rate 항목
function conflicts(prop, ITEMS, people) {
  return ITEMS.filter(it => {
    const e = prop.items[it.id]; if (!e) return false;
    const vs = people.map(p => e[p] && e[p].v).filter(v => v !== undefined && v !== "");
    return vs.length > 1 && vs.some(v => v !== vs[0]);
  });
}

// ── 병합 ────────────────────────────────────────────────────────
// asPerson: 불러온 파일의 기록을 누구 것으로 넣을지. 지정하면 파일 안의 사람 키를 전부 그 사람으로 바꿔 넣는다.
//           (딩구 폰에서 받은 파일 = 전부 딩구 기록으로 취급)
// 규칙: 항목은 사람별로 at(수정시각) 최신 우선 → 상대 기록이 내 기록을 지우지 않는다.
function mergeState(local, incoming, asPerson) {
  const out = JSON.parse(JSON.stringify(local));
  const stat = { added: 0, updatedProps: 0, updatedItems: 0, conflicts: [] };
  const byId = {};
  out.props.forEach(p => byId[p.id] = p);

  (incoming.props || []).forEach(src => {
    const inc = remapPerson(src, asPerson);
    const dst = byId[inc.id];
    if (!dst) { out.props.push(inc); byId[inc.id] = inc; stat.added++; return; }
    let touched = 0;
    const srcNewer = (inc.updatedAt || 0) > (dst.updatedAt || 0);

    [["base", BASE_FIELDS], ["price", PRICE_FIELDS]].forEach(([k, fields]) => {
      fields.forEach(f => {
        const a = dst[k][f], b = inc[k][f];
        if (b === undefined || b === "") return;
        if (a === undefined || a === "") { dst[k][f] = b; touched++; return; }
        if (String(a) === String(b)) return;
        stat.conflicts.push({ prop: dst.base.단지명 || dst.id, field: f, mine: a, theirs: b, taken: srcNewer ? b : a });
        if (srcNewer) { dst[k][f] = b; touched++; }
      });
    });

    for (const itemId in inc.items) {
      const se = inc.items[itemId];
      const de = dst.items[itemId] || (dst.items[itemId] = {});
      for (const person in se) {
        const s = se[person], d = de[person];
        if (!d || (s.at || 0) > (d.at || 0)) { de[person] = s; touched++; stat.updatedItems++; }
      }
    }
    for (const itemId in inc.flags || {}) if (!dst.flags[itemId]) { dst.flags[itemId] = inc.flags[itemId]; touched++; }
    for (const person in inc.verdict || {}) {
      const s = inc.verdict[person], d = dst.verdict[person];
      if (!d || (s.at || 0) > (d.at || 0)) { dst.verdict[person] = s; touched++; }
    }
    if (touched) { dst.updatedAt = Math.max(dst.updatedAt || 0, inc.updatedAt || 0); stat.updatedProps++; }
  });
  return { state: out, stat };
}

function remapPerson(prop, asPerson) {
  const p = JSON.parse(JSON.stringify(prop));
  if (!asPerson) return p;
  for (const itemId in p.items) {
    const merged = {};
    let best = null;
    for (const who in p.items[itemId]) {
      const e = p.items[itemId][who];
      if (!best || (e.at || 0) > (best.at || 0)) best = e;   // 한 파일에 여러 사람이 있으면 최신 것만 채택
    }
    if (best) merged[asPerson] = best;
    p.items[itemId] = merged;
  }
  const v = {};
  let bestV = null;
  for (const who in p.verdict || {}) {
    const e = p.verdict[who];
    if (!bestV || (e.at || 0) > (bestV.at || 0)) bestV = e;
  }
  if (bestV) v[asPerson] = bestV;
  p.verdict = v;
  return p;
}

const L = { uid, newProp, resolve, calcScore, calcProgress, calcFix, calcPrice, conflicts, mergeState, remapPerson, BASE_FIELDS, PRICE_FIELDS };
if (typeof module !== "undefined") module.exports = L;
