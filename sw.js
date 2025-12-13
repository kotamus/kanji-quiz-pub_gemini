const CACHE_NAME = 'kanji-quiz-v1';
const urlsToCache = [
  './',
  './index.html',
  './css/style.css',
  './js/app.js',
  './manifest.json',
  './data/grade1.json',
  './data/grade2.json',
  './data/grade3.json',
  './data/grade4.json',
  './data/grade5.json',
  './data/grade6.json',
  './wav/correct.mp3',
  './wav/wrong.mp3',
  './wav/win.mp3',
  './images/background.png',
  './images/mascot_normal.png',
  './images/mascot_correct.png',
  './images/mascot_incorrect.png',
  './images/icon-192.png',
  './images/icon-512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
  );
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        if (response) {
          return response;
        }
        return fetch(event.request);
      }
      )
  );
});