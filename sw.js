const CACHE_NAME = 'dieta-pastoressa-v5.3';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      try {
        // 1. Cancella TUTTE le vecchie cache (v1, v2, v3, v4, v5.0)
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      } catch (e) {}

      try {
        await self.clients.claim();
      } catch (e) {}

      try {
        // 2. Forza automaticamente l'aggiornamento immediato della schermata aperta sull'app di Vita Lucia e Leonardo!
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of clientList) {
          if (client.url && client.url.indexOf('v5_ready=1') === -1 && 'navigate' in client) {
            await client.navigate('./?v5_ready=1&t=' + Date.now());
          }
        }
      } catch (e) {}
    })()
  );
});

let lastSwChatCount = -1;
let swPhoneOwner = null;

self.addEventListener('message', (event) => {
  const data = event.data || {};
  if (data.type === 'SET_OWNER_AND_CHAT_COUNT') {
    swPhoneOwner = data.owner || swPhoneOwner;
    if (typeof data.chatCount === 'number') {
      lastSwChatCount = data.chatCount;
    }
  }
});

// Strategia Network-First Pura con no-store: scarica sempre la versione live dal server
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  event.respondWith(
    fetch(event.request, { cache: 'no-store' })
      .then((networkRes) => {
        const clone = networkRes.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone)).catch(() => {});
        return networkRes;
      })
      .catch(() => caches.match(event.request, { ignoreSearch: true }))
  );
});

// Controllo chat in background (anche quando l'app è ridotta a icona o chiusa)
async function checkPartnerChatInBackground() {
  try {
    const res = await fetch('./api/sync', { cache: 'no-store' });
    if (!res.ok) return;
    const remote = await res.json();
    if (!Array.isArray(remote.coupleChatMessages)) return;
    const count = remote.coupleChatMessages.length;
    if (lastSwChatCount >= 0 && count > lastSwChatCount) {
      const latest = remote.coupleChatMessages[count - 1];
      if (latest && (!swPhoneOwner || latest.senderKey !== swPhoneOwner)) {
        const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        const anyFocused = clientList.some((c) => c.focused);
        if (!anyFocused) {
          await self.registration.showNotification(`💬 ${latest.sender || 'Partner'} (Dieta PassoPasso)`, {
            body: `${latest.text} • (${latest.time || 'ora'})`,
            icon: './icon-192.png',
            badge: './icon-192.png',
            tag: 'whatsapp-couple-chat-alert',
            renotify: true,
            requireInteraction: true,
            vibrate: [250, 120, 250, 120, 350],
            actions: [
              { action: 'open_chat', title: '💬 Leggi e Rispondi' }
            ]
          });
        }
      }
    }
    lastSwChatCount = count;
  } catch (e) {}
}

self.addEventListener('sync', (event) => {
  if (event.tag === 'check-couple-chat') {
    event.waitUntil(checkPartnerChatInBackground());
  }
});

self.addEventListener('periodicsync', (event) => {
  if (event.tag === 'check-couple-chat-periodic') {
    event.waitUntil(checkPartnerChatInBackground());
  }
});

self.addEventListener('notificationclick', (event) => {
  const action = event.action;
  event.notification.close();

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        const client = clientList[0];
        if (action === 'mark_meal') {
          client.postMessage({ type: 'WIDGET_ACTION_MEAL' });
        } else if (action === 'add_water') {
          client.postMessage({ type: 'WIDGET_ACTION_WATER' });
        } else if (action === 'open_chat') {
          client.postMessage({ type: 'OPEN_CHAT_TAB' });
        }
        return client.focus();
      }
      if (action === 'add_water') {
        return self.clients.openWindow('./?quickWater=1');
      }
      if (action === 'open_chat') {
        return self.clients.openWindow('./?tab=progressi');
      }
      return self.clients.openWindow('./');
    })
  );
});
