// 서버 동기화 — 비공개 저장소(zelrho/imjang-data)의 JSON 파일 한 개를 두 사람이 나눠 쓴다.
// 규칙: 항상 [서버 것을 받아 → 합치고 → 다시 올린다]. 덮어쓰기가 아니라 병합이라 상대 기록이 날아가지 않는다.
// 토큰은 기기 브라우저에만 저장하고, 내보내기 JSON에는 절대 넣지 않는다(별도 키).
const SYNC = { owner: "zelrho", repo: "imjang-data", path: "data.json", branch: "main" };
const TKEY = "imjang.token";

const Sync = {
  get token() { return localStorage.getItem(TKEY) || ""; },
  set token(v) { v ? localStorage.setItem(TKEY, v.trim()) : localStorage.removeItem(TKEY); },
  busy: false, sha: null,

  async api(path, opt) {
    opt = opt || {};
    // 헤더는 반드시 병합할 것 — 통째로 넘기면 인증 헤더가 사라진다
    const headers = Object.assign({
      Authorization: "Bearer " + this.token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }, opt.headers);
    const r = await fetch("https://api.github.com/repos/" + SYNC.owner + "/" + SYNC.repo + path,
      Object.assign({}, opt, { headers }));
    if (r.status === 401 || r.status === 403) throw new Error("토큰이 없거나 권한이 부족합니다 (만료됐을 수 있어요)");
    return r;
  },

  async pull() {
    const r = await this.api(`/contents/${SYNC.path}?ref=${SYNC.branch}&t=${Date.now()}`);
    if (r.status === 404) { this.sha = null; return null; }
    if (!r.ok) throw new Error("받기 실패 " + r.status);
    const j = await r.json();
    this.sha = j.sha;
    return JSON.parse(b64decode(j.content.replace(/\n/g, "")));
  },

  async put(state, message) {
    const body = { message, content: b64encode(JSON.stringify(state)), branch: SYNC.branch };
    if (this.sha) body.sha = this.sha;
    const r = await this.api(`/contents/${SYNC.path}`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    if (r.status === 409 || r.status === 422) return false;      // 그 사이 상대가 올림 → 다시 합쳐야 함
    if (!r.ok) throw new Error("올리기 실패 " + r.status);
    this.sha = (await r.json()).content.sha;
    return true;
  },

  // getState/setState 로 앱 상태를 주고받는다. 성공하면 { added, updatedItems } 반환
  async run(getState, setState, who) {
    if (!this.token) throw new Error("토큰이 아직 없습니다");
    if (this.busy) return null;
    this.busy = true;
    try {
      for (let attempt = 0; attempt < 2; attempt++) {
        const remote = await this.pull();
        let state = getState(), stat = { added: 0, updatedItems: 0 };
        if (remote && Array.isArray(remote.props)) {
          const m = L.mergeState(state, remote, null);   // 사람 이름 그대로 — 각자 기록이 각자 자리에 남는다
          state = m.state; stat = m.stat;
        }
        state.syncedAt = Date.now();
        setState(state);
        if (await this.put(state, `${who} 동기화 ${new Date().toISOString().slice(0, 16).replace("T", " ")}`)) return stat;
      }
      throw new Error("상대가 동시에 저장 중입니다. 잠시 후 다시 시도하세요");
    } finally { this.busy = false; }
  },
};

function b64encode(s) {
  const b = new TextEncoder().encode(s);
  let out = "";
  for (let i = 0; i < b.length; i++) out += String.fromCharCode(b[i]);
  return btoa(out);
}
function b64decode(s) {
  const bin = atob(s);
  const b = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) b[i] = bin.charCodeAt(i);
  return new TextDecoder().decode(b);
}
