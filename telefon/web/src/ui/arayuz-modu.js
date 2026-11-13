// Arayüz modu (13.11.2026, kullanıcı kararı: "basit mod olarak yapalım", Basit varsayılan, Ayrıntılı ayarda).
// Basit: sahada teknolojiye uzak personel için sade ekranlar — haritalı aplikasyon (anlık yön, haritadan nokta seçip
// başlatma), harita ekranında büyük AL düğmesi, ekranın yarısını geçmeyen "Ne alıyorsunuz?" ve direk penceresi.
// Ayrıntılı: bütün seçenekler (önceki görünüm). Yalnız bu cihazda saklanır (ds.setting('arayuzModu')); web (ofis)
// sürümünün varsayılanı Ayrıntılı. Açık ve koyu temada aynı (yalnız CSS değişkenleri kullanılır).
import { app } from './ctx.js';

export const ARAYUZ_MODLARI = [['basit', 'Basit'], ['ayrintili', 'Ayrıntılı']];

/** Etkin mod: 'basit' | 'ayrintili'. */
export const arayuzModu = () => (app.state.arayuzModu === 'basit' || app.state.arayuzModu === 'ayrintili' ? app.state.arayuzModu : app.web ? 'ayrintili' : 'basit');
export const basitMi = () => arayuzModu() === 'basit';

/** Modu değiştirir, bu cihazın ayarına yazar ve ekranlara bildirir. */
export function arayuzModuSec(m) {
  app.state.arayuzModu = m === 'ayrintili' ? 'ayrintili' : 'basit';
  try { if (app.ds) app.ds.setting('arayuzModu', app.state.arayuzModu); } catch (e) { /* */ }
  if (app.bus) app.bus.emit('settings:change', { key: 'arayuzModu' });
}
