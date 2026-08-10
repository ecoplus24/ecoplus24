/* ══════════════════════════════════════════════════════════════
   에코플러스 방문·클릭 분석 수집기 (Google Apps Script)  v1.0
   ──────────────────────────────────────────────────────────────
   대상 사이트 : ecoplus100.com (홈페이지) · ecofree.cloud (자가진단)
   저장 위치   : 이 스크립트가 붙어 있는 Google 스프레드시트

   [최초 설치 순서]
   1. Google Sheets 새 문서 생성 → 이름: "에코플러스 방문분석"
   2. 확장 프로그램 → Apps Script → 이 코드 전체를 붙여넣고 저장
   3. 함수 목록에서 초기설정 선택 → 실행 → 권한 승인
   4. 배포 → 새 배포 → 유형 "웹 앱"
        · 실행 계정        : 나
        · 액세스 권한      : 모든 사용자
      → 배포 후 나오는 /exec URL 을 복사
   5. eco-track.js 설정의 gasUrl 값을 그 URL로 교체 → 사이트 재배포

   [주의] 이름·연락처 같은 개인정보는 이 시트에 들어오지 않는다.
          상담 신청 내용은 기존대로 Supabase에만 저장된다.
══════════════════════════════════════════════════════════════ */

var SHEET_EVENTS  = '이벤트';
var SHEET_DAILY   = '일별요약';
var SHEET_SOURCE  = '유입경로';
var SHEET_CTA     = 'CTA클릭';

var KEEP_DAYS     = 180;   // 원본 이벤트 보관 일수 (초과분 자동 삭제)
var DASHBOARD_KEY = '';    // 외부 대시보드에서 읽을 때 쓸 열쇠. 빈 값이면 조회 API 비활성.

/* 홈페이지 방문 카운터 표시 설정
   표시값 = COUNTER_BASE + 실제 고유 방문자수
   COUNTER_BASE 는 실측이 아닌 시작값이다. 숫자를 바꾸려면 이 값만 고치고 재배포하면 된다. */
var COUNTER_BASE      = 1234;
var COUNTER_CACHE_SEC = 600;   // 집계 캐시 유지 시간(초). 짧게 잡으면 실행시간 할당량을 더 쓴다.

var HEADERS = [
  '수신시각', '발생시각', '사이트', '이벤트', '방문자ID', '세션ID',
  '경로', '제목', '라벨', '값',
  '유입매체', '유입소스', '캠페인', '리퍼러', '랜딩페이지',
  '기기', '화면', '언어'
];

/* ─────────────────────────────────────────────────────────────
   1. 수집 엔드포인트
───────────────────────────────────────────────────────────── */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return _json({ ok: false, error: 'no body' });
    }

    var d = JSON.parse(e.postData.contents);

    var row = [
      new Date(),
      d.ts || '',
      d.site || '',
      d.event || '',
      d.vid || '',
      d.sid || '',
      d.path || '',
      d.title || '',
      d.label || '',
      d.value || '',
      d.medium || '',
      d.source || '',
      d.campaign || '',
      d.referrer || '',
      d.landing || '',
      d.device || '',
      d.screen || '',
      d.lang || ''
    ];

    var lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      _sheet(SHEET_EVENTS, HEADERS).appendRow(row);
    } finally {
      lock.releaseLock();
    }

    return _json({ ok: true });
  } catch (err) {
    return _json({ ok: false, error: String(err) });
  }
}

/* 브라우저로 열어 동작 확인 · 카운터 조회 · (선택) 요약 JSON 조회 */
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || '';

  /* 홈페이지 카운터. 이 응답은 누구나 볼 수 있으므로 합계만 내보낸다
     (시작값과 실측치를 따로 돌려주면 외부에서 구분할 수 있다). */
  if (action === 'counter') {
    return _json({ ok: true, total: COUNTER_BASE + _visitorCount() });
  }

  if (action === 'summary') {
    if (!DASHBOARD_KEY) { return _json({ ok: false, error: 'dashboard disabled' }); }
    if (!e.parameter.key || e.parameter.key !== DASHBOARD_KEY) {
      return _json({ ok: false, error: 'unauthorized' });
    }
    return _json({ ok: true, daily: _sheetValues(SHEET_DAILY), cta: _sheetValues(SHEET_CTA) });
  }

  return _json({ ok: true, service: 'ecoplus-tracker', version: '1.0' });
}

/* ─────────────────────────────────────────────────────────────
   2. 최초 설정 (수동 1회 실행)
───────────────────────────────────────────────────────────── */
function 초기설정() {
  _sheet(SHEET_EVENTS, HEADERS);
  _sheet(SHEET_DAILY,  ['날짜', '방문자수', '세션수', '페이지뷰', 'CTA클릭수',
                        '진단시작', '진단완료', '진단제출', '진단완료율(%)',
                        '결제창열기', '결제성공', '방문→진단시작(%)']);
  _sheet(SHEET_SOURCE, ['날짜', '유입매체', '유입소스', '방문자수', '세션수', '진단제출']);
  _sheet(SHEET_CTA,    ['날짜', '사이트', 'CTA 라벨', '클릭수', '클릭 방문자수', '방문자대비 클릭률(%)']);

  // 매일 새벽 3시 요약 생성 트리거 (중복 방지 후 재등록)
  var triggers = ScriptApp.getProjectTriggers();
  for (var i = 0; i < triggers.length; i++) {
    if (triggers[i].getHandlerFunction() === '일별요약갱신') {
      ScriptApp.deleteTrigger(triggers[i]);
    }
  }
  ScriptApp.newTrigger('일별요약갱신').timeBased().atHour(3).everyDays(1).create();

  SpreadsheetApp.getActive().toast('설치 완료. 이제 웹 앱으로 배포하세요.', '에코플러스 트래커', 8);
}

/* ─────────────────────────────────────────────────────────────
   3. 일별 요약 (매일 자동 · 수동 실행도 가능)
───────────────────────────────────────────────────────────── */
function 일별요약갱신() {
  var tz = Session.getScriptTimeZone();
  var sh = _sheet(SHEET_EVENTS, HEADERS);
  var last = sh.getLastRow();
  if (last < 2) { return; }

  var data = sh.getRange(2, 1, last - 1, HEADERS.length).getValues();

  var day    = {};   // 날짜별 집계
  var source = {};   // 날짜|매체|소스
  var cta    = {};   // 날짜|사이트|라벨

  for (var i = 0; i < data.length; i++) {
    var r = data[i];
    var when = r[0];
    if (!(when instanceof Date)) { continue; }

    var date   = Utilities.formatDate(when, tz, 'yyyy-MM-dd');
    var site   = r[2], event = r[3], vid = r[4], sid = r[5], label = r[8];
    var medium = r[10], src = r[11];

    if (!day[date]) {
      day[date] = { vids: {}, sids: {}, pv: 0, click: 0, dstart: 0, dresult: 0,
                    dsubmit: 0, payopen: 0, paysuccess: 0 };
    }
    var D = day[date];
    if (vid) { D.vids[vid] = 1; }
    if (sid) { D.sids[sid] = 1; }

    if (event === 'page_view')    { D.pv++; }
    if (event === 'click')        { D.click++; }
    if (event === 'diag_start')   { D.dstart++; }
    if (event === 'diag_result')  { D.dresult++; }
    if (event === 'diag_submit')  { D.dsubmit++; }
    if (event === 'pay_open')     { D.payopen++; }
    if (event === 'pay_success')  { D.paysuccess++; }

    // 유입경로
    var sKey = date + '|' + (medium || '(미상)') + '|' + (src || '(미상)');
    if (!source[sKey]) { source[sKey] = { vids: {}, sids: {}, submit: 0 }; }
    if (vid) { source[sKey].vids[vid] = 1; }
    if (sid) { source[sKey].sids[sid] = 1; }
    if (event === 'diag_submit') { source[sKey].submit++; }

    // CTA 클릭
    if (event === 'click' && label) {
      var cKey = date + '|' + site + '|' + label;
      if (!cta[cKey]) { cta[cKey] = { n: 0, vids: {} }; }
      cta[cKey].n++;
      if (vid) { cta[cKey].vids[vid] = 1; }
    }
  }

  // ── 일별요약 ──
  var rowsDaily = [];
  var dates = Object.keys(day).sort();
  for (var j = 0; j < dates.length; j++) {
    var d0 = dates[j], D0 = day[d0];
    var visitors = _count(D0.vids);
    rowsDaily.push([
      d0, visitors, _count(D0.sids), D0.pv, D0.click,
      D0.dstart, D0.dresult, D0.dsubmit,
      D0.dstart ? Math.round(D0.dsubmit / D0.dstart * 1000) / 10 : 0,
      D0.payopen, D0.paysuccess,
      visitors ? Math.round(D0.dstart / visitors * 1000) / 10 : 0
    ]);
  }
  _write(SHEET_DAILY, rowsDaily);

  // ── 유입경로 ──
  var rowsSource = [];
  var sKeys = Object.keys(source).sort();
  for (var k = 0; k < sKeys.length; k++) {
    var parts = sKeys[k].split('|'), S = source[sKeys[k]];
    rowsSource.push([parts[0], parts[1], parts[2], _count(S.vids), _count(S.sids), S.submit]);
  }
  _write(SHEET_SOURCE, rowsSource);

  // ── CTA 클릭 (클릭수 많은 순) ──
  var rowsCta = [];
  var cKeys = Object.keys(cta);
  for (var m = 0; m < cKeys.length; m++) {
    var cp = cKeys[m].split('|'), C = cta[cKeys[m]];
    var dayVisitors = day[cp[0]] ? _count(day[cp[0]].vids) : 0;
    rowsCta.push([
      cp[0], cp[1], cp[2], C.n, _count(C.vids),
      dayVisitors ? Math.round(_count(C.vids) / dayVisitors * 1000) / 10 : 0
    ]);
  }
  rowsCta.sort(function (a, b) { return (a[0] === b[0]) ? b[3] - a[3] : (a[0] < b[0] ? 1 : -1); });
  _write(SHEET_CTA, rowsCta);

  오래된이벤트정리();
}

/* ─────────────────────────────────────────────────────────────
   4. 보관기간 초과분 삭제 (시트 용량 보호)
───────────────────────────────────────────────────────────── */
function 오래된이벤트정리() {
  var sh = _sheet(SHEET_EVENTS, HEADERS);
  var last = sh.getLastRow();
  if (last < 2) { return; }

  var cutoff = new Date().getTime() - KEEP_DAYS * 24 * 60 * 60 * 1000;
  var stamps = sh.getRange(2, 1, last - 1, 1).getValues();

  var deleteCount = 0;
  for (var i = 0; i < stamps.length; i++) {
    var v = stamps[i][0];
    if (v instanceof Date && v.getTime() < cutoff) { deleteCount++; } else { break; }
  }
  if (deleteCount > 0) { sh.deleteRows(2, deleteCount); }
}

/* ─────────────────────────────────────────────────────────────
   5. 고유 방문자 수 집계 (홈페이지 카운터용)
   방문자ID 열만 읽어 중복을 제거한다. 결과는 캐시에 담아
   방문자마다 시트를 읽지 않도록 한다.
───────────────────────────────────────────────────────────── */
function _visitorCount() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('visitor_count');
  if (hit !== null) { return Number(hit); }

  var sh = SpreadsheetApp.getActive().getSheetByName(SHEET_EVENTS);
  var n = 0;

  if (sh && sh.getLastRow() > 1) {
    var vids = sh.getRange(2, 5, sh.getLastRow() - 1, 1).getValues();   // 5열 = 방문자ID
    var seen = {};
    for (var i = 0; i < vids.length; i++) {
      var v = vids[i][0];
      if (v && !seen[v]) { seen[v] = 1; n++; }
    }
  }

  cache.put('visitor_count', String(n), COUNTER_CACHE_SEC);
  return n;
}

/* ─────────────────────────────────────────────────────────────
   내부 도우미
───────────────────────────────────────────────────────────── */
function _sheet(name, headers) {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.appendRow(headers);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#14432A').setFontColor('#FFFFFF');
    sh.setFrozenRows(1);
  }
  return sh;
}

function _write(name, rows) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) { return; }
  var cols = sh.getLastColumn();
  if (sh.getLastRow() > 1) { sh.getRange(2, 1, sh.getLastRow() - 1, cols).clearContent(); }
  if (rows.length) { sh.getRange(2, 1, rows.length, rows[0].length).setValues(rows); }
}

function _sheetValues(name) {
  var sh = SpreadsheetApp.getActive().getSheetByName(name);
  return sh ? sh.getDataRange().getValues() : [];
}

function _count(obj) { return Object.keys(obj).length; }

function _json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}
