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

var SHEET_EVENTS   = '이벤트';
var SHEET_DAILY    = '일별요약';
var SHEET_SOURCE   = '유입경로';
var SHEET_CTA      = 'CTA클릭';
var SHEET_PARTNERS = '영업자';

/* 접수 알림 메일 설정
   · 발신 주소는 Gmail 별칭으로 등록된 경우에만 SENDER_EMAIL 이 적용된다.
     등록 여부는 함수 「발신주소확인」 을 실행해 확인할 수 있다.
   · 무료 계정 기준 하루 100통 제한. 접수 1건당 2통이므로 하루 50건까지 안전.
   · 영업자 명부는 '영업자' 시트에서 읽는다(코드 / 이름 / 이메일 / 비고). */
var OWNER_EMAIL  = 'ecoplus100@naver.com';   // 접수 알림을 받을 대표 주소
var SENDER_EMAIL = 'ecoplus8953@gmail.com';  // 발신 주소. Gmail '다른 주소에서 메일 보내기'에
                                             // 별칭으로 등록돼 있어야 적용된다.
                                             // 등록 전이면 스크립트 소유 계정으로 발송된다.
var SENDER_NAME  = '(주)에코플러스 경영지도사그룹';
var TRACK_NAME  = {
  TAX:     '체납 정리 우선',
  STARTUP: '창업 지원 계열',
  CORP:    '중소기업 정책자금 계열',
  SOHO:    '소상공인 정책자금 계열'
};

/* 고객이 결과 화면에서 본 진단 요약 (진단 페이지 index.html 과 동일 문구 — 수정 시 양쪽 동기화) */
var TRACK_SUMMARY = {
  TAX: '[진단 결과: 체납 해소가 최우선 과제입니다]\n'
    + '세금 체납 시 정책자금 신청이 제한됩니다. 국세·지방세 체납이 있으면 대부분의 정책자금·지원사업 심사에서 제외됩니다. 다만 분납 약정 등 체납 정리 방법부터 순서대로 풀어가면 신청 자격을 회복할 수 있는 경우가 많습니다.\n'
    + '키워드: 체납 정리 우선 / 분납 약정 검토 / 자격 회복 플랜\n'
    + '※ 체납 정리 가능 여부와 절차는 개별 상황에 따라 다르므로 확인이 필요합니다.',
  STARTUP: '[진단 결과: 창업 준비 단계 지원 계열 검토 대상입니다]\n'
    + '지역신용보증재단 창업자금, 정부 창업지원사업(K-스타트업 등) 계열이 검토 대상이 될 수 있습니다. 창업 전 준비 단계에서 설계를 시작하면 개업 직후 신청 타이밍을 잡기에 유리합니다.\n'
    + '키워드: 창업자금 / 창업지원사업 / 사업계획서 설계\n'
    + '※ 지원 대상·한도·모집 시기는 기관·공고별로 다르며 변동됩니다. 정밀 진단으로 확인이 필요합니다.',
  CORP: '[진단 결과: 중소기업 정책자금 계열 검토 대상 가능성이 높습니다]\n'
    + '중소벤처기업진흥공단·기술보증기금 계열 — 입력하신 규모라면 소상공인 자금보다 중소기업 시설·운전자금, R&D 지원 계열이 검토 대상이 될 가능성이 높습니다. 통상 억 단위 자금이 다뤄지는 영역으로, 사업계획서의 완성도가 승인에 큰 영향을 줍니다.\n'
    + '키워드: 시설·운전자금 / 기술보증 / R&D 지원\n'
    + '※ 자금별 조건·한도·금리는 공고 기준으로 수시 변동되므로 확정 금액은 정밀 진단 후 안내드립니다.',
  SOHO: '[진단 결과: 소상공인 정책자금 계열 검토 대상 가능성이 높습니다]\n'
    + '소상공인시장진흥공단·지역신용보증재단 계열 — 입력하신 조건이라면 소상공인 정책자금(통상 20,000,000원~70,000,000원대 범위에서 검토)과 무상환 지원사업 계열이 우선 검토 대상입니다. 어느 자금이 유리한지는 업력·신용·기존 대출에 따라 달라집니다.\n'
    + '키워드: 소상공인 정책자금 / 신용보증 / 지원사업 병행\n'
    + '※ 위 범위는 통상적 검토 범위이며 확정 한도가 아닙니다. 조건·한도·금리는 기관 공고에 따라 변동되므로 확인이 필요합니다.'
};

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

    /* ── 접수 알림 요청 (submit.js 가 호출) ──
       이 주소는 공개돼 있으므로 열쇠가 맞을 때만 처리한다. */
    if (d.action === 'lead_notify') {
      var token = PropertiesService.getScriptProperties().getProperty('NOTIFY_TOKEN');
      if (!token || d.token !== token) {
        return _json({ ok: false, error: 'unauthorized' });
      }
      return _json({ ok: true, sent: _notifyLead(d) });
    }

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

  /* 영업자 코드 → 이름 (접수 관리 페이지가 이름으로 표시하기 위해 사용).
     이메일은 내보내지 않는다. */
  if (action === 'partners') {
    var m = _partnerMap();
    var out = {};
    for (var k in m) { out[k] = m[k].name; }
    return _json({ ok: true, partners: out });
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
  _sheet(SHEET_PARTNERS, ['코드', '이름', '이메일', '비고']);

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
   6. 접수 알림 메일 — 영업자 + 대표
      영업자 명부('영업자' 시트)에서 코드로 담당자를 찾아 보낸다.
      명부에 없는 코드거나 이메일이 비어 있으면 대표에게만 보낸다.
───────────────────────────────────────────────────────────── */
function _partnerMap() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('partner_map');
  if (hit) { try { return JSON.parse(hit); } catch (e) {} }

  var sh = _sheet(SHEET_PARTNERS, ['코드', '이름', '이메일', '비고']);
  var map = {};

  if (sh.getLastRow() > 1) {
    var rows = sh.getRange(2, 1, sh.getLastRow() - 1, 3).getValues();
    for (var i = 0; i < rows.length; i++) {
      var code = String(rows[i][0] || '').trim();
      if (!code) { continue; }
      map[code] = {
        name:  String(rows[i][1] || '').trim() || code,
        email: String(rows[i][2] || '').trim()
      };
    }
  }

  cache.put('partner_map', JSON.stringify(map), 300);
  return map;
}

function _notifyLead(d) {
  var map = _partnerMap();
  var code = String(d.ref || '').trim();
  var p = map[code] || null;

  var phone = String(d.phone || '');
  var phoneFmt = (phone.length === 11)
    ? phone.slice(0, 3) + '-' + phone.slice(3, 7) + '-' + phone.slice(7)
    : phone;

  var partnerLabel = p ? (p.name + ' (' + code + ')')
                   : (code ? code + ' — 명부에 등록되지 않은 코드' : '직접 유입');

  var rows = [
    ['접수 시각',   Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm')],
    ['유입 영업자', partnerLabel],
    ['고객명',     d.name || ''],
    ['연락처',     phoneFmt],
    ['업종',       d.industry || ''],
    ['사업자 형태', d.biz_type || ''],
    ['매출 규모',   d.sales || ''],
    ['필요 자금',   d.fund_need || ''],
    ['체납 여부',   d.tax_status || ''],
    ['진단 결과',   TRACK_NAME[d.track] || d.track || '']
  ];

  var table   = _mailTable(rows);
  var summary = _trackSummaryHtml(d.track, d.fund_need);
  var sent    = { partner: false, owner: false };

  if (p && p.email) {
    sent.partner = _sendMail(
      p.email,
      '[에코플러스] 내 QR 신규 접수 — ' + (d.name || '') + '님',
      '<p style="font-family:sans-serif;font-size:15px;color:#16241C">'
      + p.name + '님, QR을 통해 <b>신규 상담 신청</b>이 접수되었습니다.</p>'
      + table
      + summary
      + '<p style="font-family:sans-serif;font-size:12px;color:#B23B3B;margin-top:16px">'
      + '고객 개인정보입니다. 상담 목적 외 사용과 외부 공유를 금합니다.</p>'
    );
  }

  sent.owner = _sendMail(
    OWNER_EMAIL,
    '[에코플러스] 신규 접수 — ' + (d.name || '') + '님'
    + (p ? ' / ' + p.name : (code ? ' / ' + code : '')),
    '<p style="font-family:sans-serif;font-size:15px;color:#16241C">신규 상담 신청이 접수되었습니다.</p>'
    + table
    + summary
  );

  return sent;
}

/* 발신 주소를 SENDER_EMAIL 로 지정해 보낸다.
   별칭이 등록돼 있지 않으면 스크립트 소유 계정으로 발송된다(메일은 정상 발송). */
function _sendMail(to, subject, htmlBody) {
  try {
    var opts = { htmlBody: htmlBody, name: SENDER_NAME };
    var aliases = GmailApp.getAliases();
    if (SENDER_EMAIL && aliases.indexOf(SENDER_EMAIL) > -1) {
      opts.from = SENDER_EMAIL;
    }
    GmailApp.sendEmail(to, subject, '', opts);
    return true;
  } catch (e) {
    try {
      MailApp.sendEmail({ to: to, subject: subject, htmlBody: htmlBody, name: SENDER_NAME });
      return true;
    } catch (e2) {
      return false;
    }
  }
}

/* 별칭이 제대로 등록됐는지 확인용 — Apps Script 에서 직접 실행해 로그를 본다 */
function 발신주소확인() {
  var aliases = GmailApp.getAliases();
  var ok = aliases.indexOf(SENDER_EMAIL) > -1;
  var msg = '설정한 발신 주소: ' + SENDER_EMAIL + '\n'
          + '등록된 별칭 목록: ' + (aliases.length ? aliases.join(', ') : '(없음)') + '\n'
          + (ok ? '→ 정상입니다. 이 주소로 발송됩니다.'
                : '→ 아직 별칭으로 등록되지 않았습니다. 스크립트 소유 계정으로 발송됩니다.');
  Logger.log(msg);
  try { SpreadsheetApp.getActive().toast(ok ? '별칭 등록 확인됨' : '별칭 미등록', '발신 주소', 8); } catch (e) {}
  return msg;
}

/* 진단 요약을 메일용 상자로 만든다. track 값으로 문구를 되살리므로
   submit.js 나 index.html 을 고칠 필요가 없다. */
function _trackSummaryHtml(track, fundText) {
  var t = TRACK_SUMMARY[track];
  if (!t) { return ''; }
  return '<div style="font-family:sans-serif;font-size:13.5px;color:#4B5A50;line-height:1.75;'
       + 'background:#FAF9F2;border:1px solid #E0DECF;border-left:3px solid #B0863B;'
       + 'border-radius:8px;padding:14px 16px;margin-top:16px">'
       + '<div style="font-weight:700;color:#14432A;margin-bottom:8px">진단 결과 상세 (고객이 본 내용)</div>'
       + t.replace(/\n/g, '<br>')
       + (fundText ? '<br>필요 자금 규모: ' + fundText : '')
       + '</div>';
}

function _mailTable(rows) {
  var html = '<table style="border-collapse:collapse;font-family:sans-serif;font-size:14px;color:#16241C">';
  for (var i = 0; i < rows.length; i++) {
    html += '<tr>'
         +  '<td style="padding:7px 14px 7px 0;color:#4B5A50;white-space:nowrap;border-bottom:1px solid #E0DECF">' + rows[i][0] + '</td>'
         +  '<td style="padding:7px 0;font-weight:600;border-bottom:1px solid #E0DECF">' + rows[i][1] + '</td>'
         +  '</tr>';
  }
  return html + '</table>';
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
