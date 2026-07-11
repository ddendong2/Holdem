/* =========================================================================
   NL 홀덤 토너먼트 — PWA 부트스트랩 (게임 코드와 분리)
   이 파일 하나가 담당하는 것:
     1) manifest / 아이콘 링크를 <head>에 자동 주입 (index.html 수정 최소화)
     2) 서비스 워커 등록 (설치 가능 + 오프라인 캐시)
     3) '홈 화면에 추가' 안내 배너 표시
     4) 이미 설치(홈 화면 실행)한 사용자에겐 안내 안 함
   ========================================================================= */
(function () {
  "use strict";

  /* ---------- 0. 중복 실행 방지 ---------- */
  if (window.__HOLDEM_PWA__) return;
  window.__HOLDEM_PWA__ = true;

  var DISMISS_KEY = "holdem_pwa_dismissed";   // '나중에' 누른 시각
  var DISMISS_DAYS = 7;                        // 이 기간엔 다시 안 물어봄

  /* ---------- 1. <head>에 필요한 링크 자동 주입 ---------- */
  function ensureLink(rel, href, extra) {
    var sel = 'link[rel="' + rel + '"]' + (extra && extra.sizes ? '[sizes="' + extra.sizes + '"]' : "");
    if (document.querySelector(sel)) return;
    var l = document.createElement("link");
    l.rel = rel;
    l.href = href;
    if (extra) Object.keys(extra).forEach(function (k) { l.setAttribute(k, extra[k]); });
    document.head.appendChild(l);
  }
  function ensureMeta(name, content, useNameAttr) {
    var attr = useNameAttr ? "name" : "property";
    if (document.querySelector('meta[' + attr + '="' + name + '"]')) return;
    var m = document.createElement("meta");
    m.setAttribute(attr, name);
    m.setAttribute("content", content);
    document.head.appendChild(m);
  }

  ensureLink("manifest", "./manifest.json");
  // iOS 홈 화면 지원
  ensureLink("apple-touch-icon", "./apple-touch-icon.png");
  ensureMeta("apple-mobile-web-app-capable", "yes", true);
  ensureMeta("apple-mobile-web-app-status-bar-style", "black-translucent", true);
  ensureMeta("apple-mobile-web-app-title", "홀덤", true);
  ensureMeta("mobile-web-app-capable", "yes", true);
  ensureMeta("theme-color", "#0c0f0d", true);

  /* ---------- 2. 서비스 워커 등록 ---------- */
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", function () {
      navigator.serviceWorker.register("./sw.js").catch(function () {});
    });
  }

  /* ---------- 3. 설치 여부 판단 ---------- */
  function isStandalone() {
    return (window.matchMedia && window.matchMedia("(display-mode: standalone)").matches) ||
           window.navigator.standalone === true ||   // iOS
           document.referrer.indexOf("android-app://") === 0;
  }
  function isIOS() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
  }
  function recentlyDismissed() {
    try {
      var t = parseInt(localStorage.getItem(DISMISS_KEY) || "0", 10);
      if (!t) return false;
      return (Date.now() - t) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
    } catch (e) { return false; }
  }

  // 이미 앱으로 실행 중이면 → 아무것도 안 함 (앞으로도 안 물어봄)
  if (isStandalone()) return;

  /* ---------- 4. 설치 배너 UI ---------- */
  var deferredPrompt = null;

  function makeBanner(innerHTML) {
    var wrap = document.createElement("div");
    wrap.id = "pwa-install-banner";
    wrap.style.cssText = [
      "position:fixed", "left:0", "right:0", "bottom:0", "z-index:99999",
      "background:linear-gradient(180deg,#14201a,#0c0f0d)",
      "border-top:1px solid #2f5a45",
      "box-shadow:0 -6px 24px rgba(0,0,0,0.55)",
      "padding:16px 18px calc(16px + env(safe-area-inset-bottom,0px))",
      "color:#ece6d8",
      "font-family:Georgia,'Apple SD Gothic Neo',serif",
      "animation:pwaUp .35s ease-out"
    ].join(";");
    wrap.innerHTML = innerHTML;
    return wrap;
  }

  function injectKeyframes() {
    if (document.getElementById("pwa-kf")) return;
    var s = document.createElement("style");
    s.id = "pwa-kf";
    s.textContent =
      "@keyframes pwaUp{from{transform:translateY(100%);opacity:0}to{transform:translateY(0);opacity:1}}" +
      "#pwa-install-banner .pwa-btn{cursor:pointer;border-radius:9px;font-size:15px;font-weight:700;padding:11px 16px;border:none}" +
      "#pwa-install-banner .pwa-primary{background:linear-gradient(180deg,#e7c465,#b9942f);color:#1a1500}" +
      "#pwa-install-banner .pwa-ghost{background:transparent;border:1px solid #3a3f3a;color:#b9b2a0;font-weight:400}";
    document.head.appendChild(s);
  }

  function removeBanner() {
    var el = document.getElementById("pwa-install-banner");
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function dismiss() {
    try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
    removeBanner();
  }

  /* ---- 4-a. Android/Chrome 계열: 네이티브 설치 프롬프트 ---- */
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    deferredPrompt = e;
    if (recentlyDismissed()) return;
    injectKeyframes();
    if (document.getElementById("pwa-install-banner")) return;

    var banner = makeBanner(
      '<div style="display:flex;align-items:center;gap:14px;max-width:520px;margin:0 auto">' +
        '<img src="./icon-192.png" alt="" style="width:46px;height:46px;border-radius:11px;flex:0 0 auto"/>' +
        '<div style="flex:1;min-width:0">' +
          '<div style="font-size:15px;font-weight:700;color:#f3e3a3">홈 화면에 추가할까요?</div>' +
          '<div style="font-size:12.5px;color:#b9b2a0;margin-top:2px">앱처럼 전체화면으로 빠르게 실행돼요.</div>' +
        '</div>' +
      '</div>' +
      '<div style="display:flex;gap:9px;margin-top:13px;max-width:520px;margin-left:auto;margin-right:auto">' +
        '<button class="pwa-btn pwa-ghost" id="pwa-later" style="flex:0 0 auto">나중에</button>' +
        '<button class="pwa-btn pwa-primary" id="pwa-add" style="flex:1">홈 화면에 추가</button>' +
      '</div>'
    );
    document.body.appendChild(banner);

    document.getElementById("pwa-later").onclick = dismiss;
    document.getElementById("pwa-add").onclick = function () {
      removeBanner();
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then(function (choice) {
        if (choice && choice.outcome === "dismissed") {
          try { localStorage.setItem(DISMISS_KEY, String(Date.now())); } catch (e) {}
        }
        deferredPrompt = null;
      });
    };
  });

  // 설치 완료 시 배너 정리
  window.addEventListener("appinstalled", function () {
    try { localStorage.removeItem(DISMISS_KEY); } catch (e) {}
    deferredPrompt = null;
    removeBanner();
  });

  /* ---- 4-b. iOS 사파리: beforeinstallprompt 미지원 → 수동 안내 ---- */
  // iOS는 '공유 → 홈 화면에 추가'만 가능하므로 방법을 그림과 함께 안내
  if (isIOS() && !recentlyDismissed()) {
    // 사파리에서만 홈 화면 추가가 됨 (크롬 iOS 등은 불가) — 그래도 안내는 노출
    window.addEventListener("load", function () {
      setTimeout(function () {
        if (document.getElementById("pwa-install-banner")) return;
        injectKeyframes();
        var banner = makeBanner(
          '<div style="display:flex;align-items:center;gap:14px;max-width:520px;margin:0 auto">' +
            '<img src="./icon-192.png" alt="" style="width:46px;height:46px;border-radius:11px;flex:0 0 auto"/>' +
            '<div style="flex:1;min-width:0">' +
              '<div style="font-size:15px;font-weight:700;color:#f3e3a3">홈 화면에 추가하기</div>' +
              '<div style="font-size:12.5px;color:#b9b2a0;margin-top:3px;line-height:1.5">' +
                '사파리 하단의 <b style="color:#ece6d8">공유 <span style="font-family:-apple-system">􀈂</span></b> 버튼 → ' +
                '<b style="color:#ece6d8">홈 화면에 추가</b> 를 누르면 앱처럼 사용할 수 있어요.' +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div style="display:flex;gap:9px;margin-top:13px;max-width:520px;margin-left:auto;margin-right:auto">' +
            '<button class="pwa-btn pwa-ghost" id="pwa-later" style="flex:1">확인했어요</button>' +
          '</div>'
        );
        document.body.appendChild(banner);
        document.getElementById("pwa-later").onclick = dismiss;
      }, 1500);
    });
  }
})();
