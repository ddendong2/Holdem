/* NL 홀덤 토너먼트 - 서비스 워커
   - 앱 셸(정적 파일)을 캐시해서 오프라인/재접속 시 빠르게 로드
   - Firebase/YouTube 등 실시간 통신은 항상 네트워크 사용 (캐시 안 함)
   ⚠️ 게임 코드를 수정해 배포할 때는 아래 CACHE_VERSION 을 올려주세요. */
var CACHE_VERSION = "holdem-v2";
var APP_SHELL = [
  "./",
  "./index.html",
  "./firebase-config.js",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

/* 설치: 앱 셸 캐시 */
self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE_VERSION).then(function (cache) {
      /* 일부 파일이 없어도 설치가 실패하지 않도록 개별 처리 */
      return Promise.all(APP_SHELL.map(function (url) {
        return cache.add(url).catch(function () { return null; });
      }));
    }).then(function () { return self.skipWaiting(); })
  );
});

/* 활성화: 옛 버전 캐시 정리 */
self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        if (k !== CACHE_VERSION) return caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

/* 요청 처리 */
self.addEventListener("fetch", function (e) {
  var req = e.request;
  if (req.method !== "GET") return;

  var url = new URL(req.url);

  /* 실시간 데이터는 절대 캐시하지 않고 항상 네트워크로
     (Firebase Realtime DB, Google APIs, YouTube, 외부 CDN 스크립트) */
  var liveHosts = [
    "firebaseio.com", "firebasedatabase.app", "googleapis.com",
    "google.com", "gstatic.com", "youtube.com", "ytimg.com",
    "unpkg.com", "cdnjs.cloudflare.com"
  ];
  var isLive = liveHosts.some(function (h) { return url.hostname.indexOf(h) >= 0; });
  if (isLive || url.origin !== self.location.origin) {
    return; /* 브라우저 기본 동작(네트워크) 사용 */
  }

  /* 같은 출처의 정적 파일: 네트워크 우선, 실패 시 캐시 (최신 게임 코드 우선 반영) */
  e.respondWith(
    fetch(req).then(function (res) {
      /* 성공 응답은 캐시에 갱신 */
      var copy = res.clone();
      caches.open(CACHE_VERSION).then(function (cache) {
        cache.put(req, copy).catch(function () {});
      });
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        return hit || caches.match("./index.html");
      });
    })
  );
});
