// 자체 점검: node imjang/test.js
// 기록 유실(병합 사고)이 이 앱의 유일한 치명적 실패라 병합 로직 위주로 본다.
const assert = require("assert");
const { CATS, ITEMS, FIX_COST } = require("./data/checklist.js");
const L = require("./lib.js");

const 딩구 = "딩구", 저 = "저";
const at = t => ({ at: t });
const e = (v, t, memo) => ({ v, at: t, memo: memo || "" });

// ── 점수 ────────────────────────────────────────────────
{
  const p = L.newProp();
  p.items["in_light"] = { [딩구]: e(2, 1), [저]: e(0, 2) };   // 갈리면 낮은 쪽
  p.items["in_dobae"] = { [저]: e(2, 1) };
  const s = L.calcScore(p, ITEMS, CATS);
  assert.strictEqual(s.done, 2, "확인한 rate 항목 수");
  assert.strictEqual(s.pct, 50, "(0+2)/4 = 50점");
  assert.strictEqual(s.byCat["in"].done, 2);
  assert.strictEqual(s.byCat["leak"].pct, null, "미확인 카테고리는 null (0점 아님)");
}

// ── 진행률: 타입 무관, 값이 하나라도 있으면 기입으로 침 ──
{
  const p = L.newProp();
  p.items["pre_school"] = { [저]: e("천천초", 1) };
  p.items["dan_park"]   = { [저]: e(0.8, 1) };
  assert.strictEqual(L.calcProgress(p, ITEMS).done, 2);
}

// ── 인테리어 견적 ───────────────────────────────────────
{
  const p = L.newProp({ base: { 평: 24 } });
  p.items["in_dobae"] = { [저]: e(0, 1) };            // 도배 필요
  p.items["in_bath"]  = { [저]: e(1, 1) };            // 보통 → 계산 안 함
  let f = L.calcFix(p, ITEMS, FIX_COST);
  assert.strictEqual(f.list.length, 1);
  assert.strictEqual(f.min, 6 * 24); assert.strictEqual(f.max, 10 * 24);
  assert.strictEqual(f.isAll, false);

  p.items["in_floor"]   = { [저]: e(0, 1) };
  p.items["in_kitchen"] = { [딩구]: e(0, 1) };        // 누가 체크했든 반영
  f = L.calcFix(p, ITEMS, FIX_COST);
  assert.strictEqual(f.list.length, 3);
  assert.strictEqual(f.isAll, true, "3건 이상이면 사실상 올수리");
  assert.strictEqual(f.allMin, 24 * 200);
}

// ── 시세 계산 ───────────────────────────────────────────
{
  const p = L.newProp({ base: { 평: 24 }, price: { 매매호가: 48000, 전세가: 30000 } });
  const c = L.calcPrice(p);
  assert.strictEqual(c.평당가, 2000);
  assert.strictEqual(c.전세가율, 63);
}

// ── 불일치 ──────────────────────────────────────────────
{
  const p = L.newProp();
  p.items["in_light"] = { [딩구]: e(2, 1), [저]: e(0, 1) };
  p.items["in_water"] = { [딩구]: e(1, 1), [저]: e(1, 1) };
  const c = L.conflicts(p, ITEMS, [딩구, 저]);
  assert.deepStrictEqual(c.map(x => x.id), ["in_light"]);
}

// ── 병합: 핵심 ──────────────────────────────────────────
{
  // 내 폰: 저가 채광/도배 기록
  const mine = { v: 1, people: [딩구, 저], me: 저, props: [
    L.newProp({ id: "p_a", updatedAt: 100, base: { 단지명: "한일타운", 평: 24 },
      items: { in_light: { [저]: e(2, 100) }, in_dobae: { [저]: e(1, 100) } } })
  ]};
  // 딩구 폰: 같은 매물에 화장실/도배 기록 (딩구 폰에선 자기를 '저'라고 저장했을 수도 있음)
  const theirs = { v: 1, props: [
    L.newProp({ id: "p_a", updatedAt: 200, base: { 단지명: "한일타운", 호수: "1203" },
      items: { in_bath: { "저": e(0, 200) }, in_dobae: { "저": e(0, 200) } } }),
    L.newProp({ id: "p_b", updatedAt: 150, base: { 단지명: "매탄위브" },
      items: { in_light: { "저": e(1, 150) } } })
  ]};

  const { state, stat } = L.mergeState(mine, theirs, 딩구);   // ← 딩구 것으로 넣기
  const a = state.props.find(p => p.id === "p_a");

  assert.strictEqual(stat.added, 1, "새 매물 1건 추가");
  assert.strictEqual(a.items.in_light[저].v, 2, "내 기록은 그대로 남는다");
  assert.strictEqual(a.items.in_bath[딩구].v, 0, "상대 기록은 상대 이름으로 들어온다");
  assert.strictEqual(a.items.in_dobae[저].v, 1, "같은 항목이어도 사람이 다르면 안 덮어씀");
  assert.strictEqual(a.items.in_dobae[딩구].v, 0);
  assert.strictEqual(a.base.호수, "1203", "빈 필드는 채워진다");
  assert.strictEqual(a.base.평, 24, "내 값이 있으면 유지");
  assert.strictEqual(state.props.find(p => p.id === "p_b").items.in_light[딩구].v, 1);

  // 같은 사람 같은 항목: at 최신이 이긴다
  const later = { v: 1, props: [ L.newProp({ id: "p_a", updatedAt: 300, items: { in_light: { "저": e(0, 300) } } }) ]};
  const r2 = L.mergeState(state, later, 저);
  assert.strictEqual(r2.state.props.find(p => p.id === "p_a").items.in_light[저].v, 0, "최신 기록이 이김");

  const older = { v: 1, props: [ L.newProp({ id: "p_a", updatedAt: 50, items: { in_light: { "저": e(2, 50) } } }) ]};
  const r3 = L.mergeState(r2.state, older, 저);
  assert.strictEqual(r3.state.props.find(p => p.id === "p_a").items.in_light[저].v, 0, "오래된 파일은 최신을 덮지 못함");

  // 병합은 원본을 건드리지 않는다 (미리보기 → 취소가 가능해야 함)
  assert.strictEqual(mine.props[0].items.in_bath, undefined, "원본 불변");
}

// ── 필드 충돌은 기록으로 남는다 ─────────────────────────
{
  const mine   = { v: 1, props: [ L.newProp({ id: "p_a", updatedAt: 100, base: { 단지명: "A", 호수: "101" } }) ]};
  const theirs = { v: 1, props: [ L.newProp({ id: "p_a", updatedAt: 200, base: { 단지명: "A", 호수: "202" } }) ]};
  const { state, stat } = L.mergeState(mine, theirs, 딩구);
  assert.strictEqual(stat.conflicts.length, 1);
  assert.strictEqual(state.props[0].base.호수, "202", "최신 쪽 채택");
}

// ── 항목 정의 무결성 ────────────────────────────────────
{
  const ids = ITEMS.map(i => i.id);
  assert.strictEqual(new Set(ids).size, ids.length, "항목 id 중복");
  const cats = new Set(CATS.map(c => c.id));
  ITEMS.forEach(i => assert.ok(cats.has(i.cat), "없는 카테고리: " + i.id));
  ITEMS.forEach(i => { if (i.fix) assert.ok(FIX_COST.공사[i.fix], "없는 공사 단가: " + i.fix); });
  console.log(`항목 ${ITEMS.length}개 / 핵심 ${ITEMS.filter(i => i.core).length}개 / 카테고리 ${CATS.length}개`);
}

console.log("OK — 전부 통과");
