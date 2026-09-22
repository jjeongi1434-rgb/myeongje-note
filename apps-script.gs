/**
 * 명제 탐구 노트 — 제출 수집용 Google Apps Script
 * 1) 구글 시트 새로 만들기 → 확장 프로그램 → Apps Script → 이 코드 전체를 붙여넣기
 * 2) 아래 KEY를 원하는 교사 코드로 바꾸기 (앱의 교사 모드 코드와 같게 하면 편해요)
 * 3) 배포 → 새 배포 → 유형: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자 → 배포 → 웹 앱 URL 복사
 * 4) index.html 의  const SUBMIT_URL=''  안에 그 URL을 붙여넣고 GitHub에 올리기
 *
 * 시트 구성: '제출' 탭 = 제출 원본(JSON, 취합·불러오기용), '답변' 탭 = 학생 한 명당 한 줄, 필수 답변마다 한 열 (선생님이 읽는 용도)
 *
 * ※ 이 코드를 고친 뒤에는  배포 → 배포 관리 → (연필) 편집 → 버전: 새 버전 → 배포  를 해야 반영됩니다. (URL은 그대로)
 */
const KEY = '명제교사';
const SHEET = '제출';
const CHUNK = 45000; // 셀 하나에 넣을 최대 글자 수 (구글 시트 한도 50,000)

function doPost(e) {
  try {
    const d = JSON.parse(e.postData.contents);
    const st = d.student || {};
    const sh = sheet_();
    const json = JSON.stringify(d.state || {});
    const parts = [];
    for (let i = 0; i < json.length; i += CHUNK) parts.push(json.slice(i, i + CHUNK));
    const row = [new Date(), st.cls || '', st.sid || '', st.name || '', d.done || 0, d.total || 0, d.lessons || 0, parts.length].concat(parts);
    sh.appendRow(row);
    // 학급·학번이 날짜/숫자로 자동 변환되지 않도록 텍스트 서식으로 다시 기록
    const r = sh.getLastRow();
    sh.getRange(r, 2, 1, 3).setNumberFormat('@').setValues([[String(st.cls || ''), String(st.sid || ''), String(st.name || '')]]);
    if (d.answers && d.answers.length) upsertAnswers_(d.answers);
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

/* '답변' 탭: 학생 한 명 = 한 줄, 필수 답변마다 한 열. 같은 학번+이름이 다시 제출하면 그 줄을 덮어쓴다 */
const ANS_SHEET = '답변';
function upsertAnswers_(answers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(ANS_SHEET);
  if (!sh) { sh = ss.insertSheet(ANS_SHEET); sh.setFrozenRows(1); sh.setFrozenColumns(2); }
  const heads = answers.map(a => String(a[0]));
  const vals = answers.map(a => a[1] == null ? '' : String(a[1]));
  let header = sh.getLastColumn() ? sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String) : [];
  if (header.length === 0) { header = ['제출시각'].concat(heads); sh.getRange(1, 1, 1, header.length).setValues([header]).setFontWeight('bold'); }
  // 새 열 추가
  const missing = heads.filter(h => header.indexOf(h) < 0);
  if (missing.length) { sh.getRange(1, header.length + 1, 1, missing.length).setValues([missing]).setFontWeight('bold'); header = header.concat(missing); }
  // 기존 줄 찾기 (학번 + 이름)
  const iSid = header.indexOf('학번'), iName = header.indexOf('이름');
  const sid = vals[heads.indexOf('학번')] || '', name = vals[heads.indexOf('이름')] || '';
  let rowIdx = -1;
  if (sh.getLastRow() > 1) {
    const keys = sh.getRange(2, 1, sh.getLastRow() - 1, header.length).getValues();
    for (let r = 0; r < keys.length; r++) if (String(keys[r][iSid]) === sid && String(keys[r][iName]) === name) { rowIdx = r + 2; break; }
  }
  const row = header.map(h => { const k = heads.indexOf(h); return h === '제출시각' ? new Date() : (k < 0 ? '' : vals[k]); });
  if (rowIdx < 0) rowIdx = sh.getLastRow() + 1;
  const rng = sh.getRange(rowIdx, 1, 1, header.length);
  rng.setNumberFormat('@');
  rng.setValues([row]);
  sh.getRange(rowIdx, 1).setValue(new Date());
}

function doGet(e) {
  const P = e.parameter || {};
  // 학생 본인 기록 불러오기: ?cls=&sid=&name=&pin=
  if (P.name && P.pin) {
    const latest = readLatest_();
    const id = [String(P.cls || '').trim(), String(P.sid || '').trim(), String(P.name || '').trim()].join('|');
    const hit = latest[id];
    if (!hit) return out_({ ok: false, error: 'notfound' });
    const pin = (hit.state.student && hit.state.student.pin) || '';
    if (!pin || pin !== String(P.pin).trim()) return out_({ ok: false, error: 'pin' });
    return out_({ ok: true, submittedAt: hit.at, state: hit.state });
  }
  // 교사 취합: ?key=
  if (!P.key || P.key !== KEY) return out_({ ok: false, error: 'key' });
  const latest = readLatest_();
  const items = Object.keys(latest).map(k => Object.assign({ submittedAt: latest[k].at }, latest[k].state));
  return out_({ ok: true, count: items.length, items: items });
}

function readLatest_() {
  const sh = sheet_();
  const rows = sh.getDataRange().getValues();
  const latest = {};
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    if (!row[0]) continue;
    const n = Number(row[7]) || 1;
    let json = '';
    for (let i = 0; i < n; i++) json += String(row[8 + i] || '');
    try {
      const state = JSON.parse(json);
      // 시트 셀은 "1-3" 같은 학급을 날짜로 바꿔 버릴 수 있으므로, 기록 안의 학생 정보로 식별한다
      const st = state.student || {};
      const id = [String(st.cls || row[1]).trim(), String(st.sid || row[2]).trim(), String(st.name || row[3]).trim()].join('|');
      latest[id] = { at: row[0], state: state };   // 나중 행이 최신
    } catch (err) {}
  }
  return latest;
}

function sheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET);
  if (!sh) sh = ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) sh.appendRow(['제출시각', '학급', '학번', '이름', '완료단계', '전체단계', '완료차시', '조각수', '데이터']);
  return sh;
}

function out_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
