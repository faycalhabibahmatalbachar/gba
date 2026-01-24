importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.9.1/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAy7cHyAZF9hPDzkhs1fPOTbEeJayruh7w',
  authDomain: 'globalbusinessamdaradir-fba45.firebaseapp.com',
  projectId: 'globalbusinessamdaradir-fba45',
  storageBucket: 'globalbusinessamdaradir-fba45.firebasestorage.app',
  messagingSenderId: '113996075487',
  appId: '1:113996075487:android:2bac369101f3c820b7b46a',
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const title = payload?.notification?.title ?? 'Notification';
  const options = {
    body: payload?.notification?.body ?? '',
    icon: '/icons/Icon-192.png',
    data: payload?.data ?? {},
  };
  self.registration.showNotification(title, options);
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const route = event?.notification?.data?.route;
  const urlToOpen = route ? `/#${route}` : '/';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(urlToOpen) && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(urlToOpen);
      }
      return null;
    }),
  );
});
