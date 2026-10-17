// Basit olay yolu: veri değişiklikleri, GNSS akışı ve UI yenilemeleri buradan yayılır.
export class Bus {
  constructor() { this.map = new Map(); }
  on(evt, fn) {
    if (!this.map.has(evt)) this.map.set(evt, new Set());
    this.map.get(evt).add(fn);
    return () => this.off(evt, fn);
  }
  off(evt, fn) { const s = this.map.get(evt); if (s) s.delete(fn); }
  emit(evt, payload) {
    const s = this.map.get(evt);
    if (s) for (const fn of [...s]) { try { fn(payload); } catch (e) { console.error('[bus]', evt, e); } }
    const any = this.map.get('*');
    if (any) for (const fn of [...any]) { try { fn(evt, payload); } catch (e) { console.error('[bus*]', e); } }
  }
}
export const bus = new Bus();
