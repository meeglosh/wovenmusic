// Development tool to diagnose scroll blocking issues
export function installScrollProbe() {
  console.info('[ScrollProbe] Installing scroll diagnostics...');
  
  // Log first touch/wheel default-preventers
  const once = { capture: true, once: true } as AddEventListenerOptions;
  
  window.addEventListener('touchstart', (e) => {
    const el = document.elementFromPoint(e.touches[0].clientX, e.touches[0].clientY);
    console.log('[probe] touchstart on', el, 'defaultPrevented=', e.defaultPrevented);
  }, once);

  window.addEventListener('touchmove', (e) => {
    console.log('[probe] FIRST touchmove defaultPrevented=', e.defaultPrevented);
  }, once);

  window.addEventListener('wheel', (e) => {
    console.log('[probe] FIRST wheel defaultPrevented=', (e as any).defaultPrevented);
  }, { capture: true, once: true, passive: true });

  // Monkeypatch addEventListener to find non-passive touch/wheel listeners
  const orig = EventTarget.prototype.addEventListener;
  // @ts-ignore
  EventTarget.prototype.addEventListener = function(type: string, listener: any, options?: any) {
    const t = String(type).toLowerCase();
    if (t === 'touchmove' || t === 'touchstart' || t === 'wheel' || t === 'pointermove') {
      const passive = typeof options === 'boolean' ? false : options?.passive ?? false;
      if (!passive) {
        // Log non-passive listeners that could block scroll
        console.warn('[probe] non-passive listener', { target: this, type, listener: listener.name || listener.toString().substring(0, 50) });
      }
    }
    return orig.call(this, type, listener, options);
  };
}