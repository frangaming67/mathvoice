import { useEffect, useState } from 'react';
export function OfflineStatus() {
  const [online, setOnline] = useState(navigator.onLine),
    [ready, setReady] = useState(false);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  useEffect(() => {
    let active = true;
    let removeRegistrationListener = () => {};
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    if ('serviceWorker' in navigator)
      void navigator.serviceWorker.ready.then((registration) => {
        if (!active) return;
        setReady(true);
        if (registration.waiting) setWaiting(registration.waiting);
        let installing: ServiceWorker | null = null;
        const changed = () => {
          if (active && registration.waiting) setWaiting(registration.waiting);
        };
        const found = () => {
          installing?.removeEventListener('statechange', changed);
          installing = registration.installing;
          installing?.addEventListener('statechange', changed);
        };
        found();
        registration.addEventListener('updatefound', found);
        removeRegistrationListener = () => {
          registration.removeEventListener('updatefound', found);
          installing?.removeEventListener('statechange', changed);
        };
      });
    return () => {
      active = false;
      removeRegistrationListener();
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);
  return (
    <div>
      <p className="hint">
        {!online
          ? 'Sin conexión. Los cálculos locales siguen disponibles; el dictado y algunas voces pueden necesitar internet.'
          : ready
            ? 'Aplicación preparada para usar sin conexión. Podés instalarla desde el menú de tu navegador.'
            : import.meta.env.DEV
              ? 'Vista de desarrollo. La instalación y el modo sin conexión se habilitan en la versión de producción.'
              : 'Preparando almacenamiento para uso sin conexión…'}
      </p>
      {waiting && (
        <div className="confirmation">
          <p>
            Hay una nueva versión disponible. Al recargar se conservan tu historial y preferencias;
            terminá primero el cálculo que estés escribiendo.
          </p>
          <button
            onClick={() => {
              navigator.serviceWorker.addEventListener(
                'controllerchange',
                () => window.location.reload(),
                { once: true },
              );
              waiting.postMessage({ type: 'SKIP_WAITING' });
            }}
          >
            Aplicar actualización y recargar
          </button>
        </div>
      )}
    </div>
  );
}
