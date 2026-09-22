/**
 * 명제 탐구 노트 — 제출 수집용 Google Apps Script
 * 1) 구글 시트 새로 만들기 → 확장 프로그램 → Apps Script → 이 코드 전체를 붙여넣기
 * 2) 아래 KEY를 원하는 교사 코드로 바꾸기 (앱의 교사 모드 코드와 같게 하면 편해요)
 * 3) 배포 → 새 배포 → 유형: 웹 앱 / 실행 사용자: 나 / 액세스 권한: 모든 사용자 → 배포 → 웹 앱 URL 복사
 * 4) index.html 의  const SUBMIT_URL=''  안에 그 URL을 붙여넣고 GitHub에 올리기
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
    sh.appendRow([new Date(), st.cls || '', st.sid || '', st.name || '', d.done || 0, d.total || 0, d.lessons || 0, parts.length].concat(parts));
    return out_({ ok: true });
  } catch (err) {
    return out_({ ok: false, error: String(err) });
  }
}

function doGet(e) {
  if (!e.parameter.key || e.parameter.key !== KEY) return out_({ ok: false, error: 'key' });
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
      const id = [row[1], row[2], row[3]].join('|');
      latest[id] = { at: row[0], state: state };   // 나중 행이 최신
    } catch (err) {}
  }
  const items = Object.keys(latest).map(k => Object.assign({ submittedAt: latest[k].at }, latest[k].state));
  return out_({ ok: true, count: items.length, items: items });
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
