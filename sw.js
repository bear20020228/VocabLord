// 註冊安裝事件
self.addEventListener('install', (e) => {
    console.log('[Service Worker] 安裝成功');
    self.skipWaiting();
});

// 註冊啟動事件
self.addEventListener('activate', (e) => {
    console.log('[Service Worker] 啟動成功');
    return self.clients.claim();
});

// ⭐️ 關鍵：必須要有 fetch 事件，瀏覽器才會承認這是一個合格的 PWA
self.addEventListener('fetch', (e) => {
    // 目前先什麼都不做，讓網路請求正常通過
});