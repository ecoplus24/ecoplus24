/* ══════════════════════════════════════════════════════════════
   eco-track.js — 에코플러스 통합 방문·클릭 트래커  v1.0
   ──────────────────────────────────────────────────────────────
   · 수집처 : Google Apps Script 웹앱 → Google Sheets
   · 전송   : navigator.sendBeacon (text/plain → CORS 사전요청 없음)
   · 개인정보: 이름·연락처·IP 를 수집하지 않는다.
              방문자 식별은 브라우저에만 저장되는 익명 난수 ID.
   · GA4 가 같은 페이지에 있으면 동일 이벤트를 자동으로 함께 전송.

   [사용법] 페이지의 <\/body> 직전에 설정 블록을 두고 이 파일을 불러온다.
     <script> window.ECO_TRACK_CONFIG = {
         gasUrl: 'https://script.google.com/macros/s/AKfy.../exec',
         site: 'ecoplus100',
         crossDomains: ['ecofree.cloud']
     }; <\/script>
     <script src="eco-track.js"><\/script>
     ※ 위 주석의 역슬래시는 이 파일을 HTML 안에 인라인으로 붙여넣을 때
        스크립트가 조기 종료되지 않도록 하기 위한 것이다. 지우지 말 것.

   [수동 이벤트] 어디서든 호출 가능
     ecoTrack('diag_complete', { label: 'SOHO' });
══════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  var CFG     = window.ECO_TRACK_CONFIG || {};
  var GAS_URL = CFG.gasUrl || '';
  var SITE    = CFG.site || location.hostname;
  var CROSS   = CFG.crossDomains || [];
  var DEBUG   = !!CFG.debug;

  var SESSION_MINUTES = 30;
  var T0 = new Date().getTime();

  /* ── 저장소 안전 래퍼 (시크릿 모드 대비) ───────────────── */
  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }

  function uuid() {
    if (window.crypto && crypto.randomUUID) { return crypto.randomUUID(); }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = Math.random() * 16 | 0, v = (c === 'x') ? r : ((r & 0x3) | 0x8);
      return v.toString(16);
    });
  }

  /* ── 방문자 ID (도메인 간 인계 지원) ───────────────────── */
  function param(name) {
    var m = new RegExp('[?&]' + name + '=([^&#]*)').exec(location.search);
    return m ? decodeURIComponent(m[1]) : '';
  }

  var VID = param('_ev');                 // 다른 도메인에서 넘어온 방문자 ID
  if (VID) {
    set('eco_vid', VID);
  } else {
    VID = get('eco_vid');
    if (!VID) { VID = uuid(); set('eco_vid', VID); }
  }

  /* ── 세션 ID (마지막 활동으로부터 30분) ────────────────── */
  function sessionId() {
    var now = new Date().getTime();
    var sid = get('eco_sid');
    var last = parseInt(get('eco_sid_ts') || '0', 10);
    if (!sid || !last || (now - last) > SESSION_MINUTES * 60 * 1000) {
      sid = uuid().slice(0, 8) + '-' + now;
      set('eco_sid', sid);
    }
    set('eco_sid_ts', String(now));
    return sid;
  }

  /* ── 최초 유입 경로 (first-touch, 한 번만 기록) ────────── */
  var SRC;
  (function () {
    var saved = get('eco_src');
    if (saved) {
      try { SRC = JSON.parse(saved); } catch (e) { SRC = null; }
    }
    if (!SRC) {
      var ref = document.referrer || '';
      var refHost = '';
      try { refHost = ref ? new URL(ref).hostname : ''; } catch (e) {}
      var medium = param('utm_medium');
      if (!medium) {
        if (!ref) { medium = 'direct'; }
        else if (refHost.indexOf(location.hostname) > -1) { medium = 'internal'; }
        else if (/google|naver|daum|bing|yahoo|zum/i.test(refHost)) { medium = 'organic'; }
        else { medium = 'referral'; }
      }
      SRC = {
        source: param('utm_source') || refHost || '(direct)',
        medium: medium,
        campaign: param('utm_campaign') || '',
        referrer: ref.slice(0, 200),
        landing: location.pathname
      };
      set('eco_src', JSON.stringify(SRC));
    }
  })();

  /* ── 기기 구분 ─────────────────────────────────────────── */
  var DEVICE = /Mobi|Android|iPhone|iPod/i.test(navigator.userAgent) ? 'mobile'
             : /iPad|Tablet/i.test(navigator.userAgent) ? 'tablet' : 'desktop';

  /* ── 전송 ──────────────────────────────────────────────── */
  function send(event, props) {
    props = props || {};

    var payload = {
      ts:       new Date().toISOString(),
      site:     SITE,
      event:    event,
      vid:      VID,
      sid:      sessionId(),
      path:     location.pathname,
      title:    (document.title || '').slice(0, 80),
      label:    String(props.label != null ? props.label : '').slice(0, 80),
      value:    props.value != null ? String(props.value).slice(0, 200) : '',
      source:   SRC.source,
      medium:   SRC.medium,
      campaign: SRC.campaign,
      referrer: SRC.referrer,
      landing:  SRC.landing,
      device:   DEVICE,
      screen:   (screen.width || 0) + 'x' + (screen.height || 0),
      lang:     navigator.language || ''
    };

    if (DEBUG) { console.log('[eco-track]', payload); }

    /* GA4 가 있으면 같은 이벤트를 함께 전송 */
    if (window.gtag) {
      try { gtag('event', event, { eco_label: payload.label, eco_value: payload.value, eco_site: SITE }); } catch (e) {}
    }

    /* 자리표시자(GAS_WEBAPP_URL_HERE)가 그대로면 전송하지 않는다 */
    if (!GAS_URL || GAS_URL.indexOf('http') !== 0) { return; }

    var body = JSON.stringify(payload);
    try {
      if (navigator.sendBeacon) {
        var blob = new Blob([body], { type: 'text/plain;charset=UTF-8' });
        if (navigator.sendBeacon(GAS_URL, blob)) { return; }
      }
    } catch (e) {}
    try {
      fetch(GAS_URL, {
        method: 'POST', mode: 'no-cors', keepalive: true,
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        body: body
      });
    } catch (e) {}
  }

  window.ecoTrack = send;

  /* ── 1. 페이지뷰 ───────────────────────────────────────── */
  send('page_view', { label: document.title });

  /* ── 2. 도메인 간 링크에 방문자 ID 부착 (클릭 기록보다 먼저) ── */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) { return; }
    var a = e.target.closest('a[href]');
    if (!a) { return; }
    var href = a.getAttribute('href') || '';
    for (var i = 0; i < CROSS.length; i++) {
      if (href.indexOf(CROSS[i]) > -1 && href.indexOf('_ev=') === -1) {
        a.setAttribute('href', href + (href.indexOf('?') > -1 ? '&' : '?') + '_ev=' + VID);
        break;
      }
    }
  }, true);

  /* ── 3. 클릭 자동 수집 (a · button · [data-track]) ─────── */
  document.addEventListener('click', function (e) {
    if (!e.target.closest) { return; }
    var el = e.target.closest('a,button,[data-track]');
    if (!el) { return; }

    var label = el.getAttribute('data-track')
             || (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 60)
             || el.getAttribute('aria-label')
             || el.tagName.toLowerCase();

    send('click', { label: label, value: el.getAttribute('href') || '' });
  }, true);

  /* ── 4. 스크롤 깊이 25 / 50 / 75 / 100% ────────────────── */
  (function () {
    var hit = {}, ticking = false;
    function check() {
      ticking = false;
      var doc = document.documentElement;
      var h = Math.max(doc.scrollHeight, document.body.scrollHeight) - window.innerHeight;
      if (h <= 0) { return; }
      var pct = Math.round((window.pageYOffset / h) * 100);
      var marks = [25, 50, 75, 100];
      for (var i = 0; i < marks.length; i++) {
        if (pct >= marks[i] && !hit[marks[i]]) {
          hit[marks[i]] = true;
          send('scroll_depth', { label: marks[i] + '%', value: marks[i] });
        }
      }
    }
    window.addEventListener('scroll', function () {
      if (!ticking) { ticking = true; setTimeout(check, 300); }
    }, { passive: true });
  })();

  /* ── 5. 페이지 체류시간 (이탈 시 1회) ──────────────────── */
  (function () {
    var sent = false;
    function leave() {
      if (sent) { return; }
      sent = true;
      send('page_leave', { label: document.title, value: Math.round((new Date().getTime() - T0) / 1000) });
    }
    document.addEventListener('visibilitychange', function () {
      if (document.visibilityState === 'hidden') { leave(); }
    });
    window.addEventListener('pagehide', leave);
  })();

})();
