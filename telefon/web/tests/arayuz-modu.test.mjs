// Arayüz modu (13.11.2026): telefonda Basit varsayılan, web (ofis) sürümünde Ayrıntılı; seçim bu cihazın ayarına yazılır.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { app } from '../src/ui/ctx.js';
import { arayuzModu, basitMi, arayuzModuSec, ARAYUZ_MODLARI } from '../src/ui/arayuz-modu.js';

test('AM1 · varsayılanlar, seçim ve kayıt', () => {
  const yazilan = [], olay = [];
  const eski = { web: app.web, ds: app.ds, bus: app.bus, mod: app.state.arayuzModu };
  try {
    app.state.arayuzModu = null; app.web = false;
    assert.equal(arayuzModu(), 'basit'); assert.ok(basitMi());
    app.web = true; assert.equal(arayuzModu(), 'ayrintili');
    app.ds = { setting: (k, v) => yazilan.push([k, v]) }; app.bus = { emit: (e, d) => olay.push([e, d && d.key]) };
    arayuzModuSec('basit');
    assert.equal(arayuzModu(), 'basit');
    arayuzModuSec('xyz');
    assert.equal(arayuzModu(), 'basit', 'tanınmayan seçim Basit');
    arayuzModuSec('ayrintili');
    assert.equal(arayuzModu(), 'ayrintili');
    assert.deepEqual(yazilan.map((x) => x[1]), ['basit', 'basit', 'ayrintili']);
    assert.deepEqual(olay[0], ['settings:change', 'arayuzModu']);
    assert.deepEqual(ARAYUZ_MODLARI.map((x) => x[0]), ['basit', 'ayrintili']);
  } finally { app.web = eski.web; app.ds = eski.ds; app.bus = eski.bus; app.state.arayuzModu = eski.mod; }
});

test('AM2 · Basit mod ekranları: harita alt paneli, seçim penceresi, haritalı aplikasyon; yalnız tema değişkenleri', () => {
  const harita = fs.readFileSync(new URL('../src/ui/screens/map.js', import.meta.url), 'utf8');
  const apl = fs.readFileSync(new URL('../src/ui/screens/stakeout.js', import.meta.url), 'utf8');
  for (const x of ['dock basit', 'NeAliyorsunuz', 'BasitDirek', 'sheet basit']) assert.ok(harita.includes(x), 'harita: ' + x);
  for (const x of ['AplikasyonHaritasi', 'RadarGorunumu', 'aplh-kart', 'yonKonisi', 'trail']) assert.ok(apl.includes(x), 'aplikasyon: ' + x);
  // Yeni CSS kuralları açık temada da doğru görünsün diye sabit koyu zemin rengi kullanmaz
  const css = fs.readFileSync(new URL('../src/ui/theme.css', import.meta.url), 'utf8');
  const bas = css.indexOf('/* Basit mod (13.11.2026)'), son = css.indexOf('@media (max-width:360px){.aplh-mesafe');
  assert.ok(bas > 0 && son > bas);
  const bolum = css.slice(bas, son);
  assert.deepEqual(bolum.match(/background:#[0-9a-f]{3,6}/gi) || [], [], 'yeni kurallarda sabit zemin rengi');
});
