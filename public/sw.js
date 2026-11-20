// Service worker do Pede Aí: só recebe os avisos da equipe (Web Push). Não guarda páginas em cache.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let message = { title: "Pede Aí", body: "Há algo novo no salão.", tag: "pede-ai", url: "/" };
  try {
    message = { ...message, ...event.data.json() };
  } catch {
    // Aviso sem conteúdo legível: mostra o texto padrão.
  }
  event.waitUntil(
    self.registration.showNotification(message.title, {
      body: message.body,
      tag: message.tag,
      renotify: true,
      icon: "/icon.svg",
      badge: "/icon.svg",
      data: { url: message.url },
    }),
  );
});

// Tocar no aviso abre (ou traz para a frente) a tela do garçom.
self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      const open = windows.find((client) => client.url === url);
      return open ? open.focus() : self.clients.openWindow(url);
    }),
  );
});
