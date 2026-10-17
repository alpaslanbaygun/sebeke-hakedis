/*
 * Projeyi AutoCAD R12 DXF (ASCII) çizimi olarak yazar: görüntüleme ve başka programlara aktarma için.
 * Katmanlar PROMAGIS adlarıyla (nesnelerin "katman" alanı); Türkçe harfler Windows-1254 ile yazılır.
 * (Verinin kendisi .sebeke.json ile taşınır; AutoCAD eklentisi onu okur.)
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./sh-core.js'));
  else root.SHD = factory(root.SH);
})(typeof self !== 'undefined' ? self : this, function (SH) {
  'use strict';

  const CP1254 = { 0x011E: 0xD0, 0x0130: 0xDD, 0x015E: 0xDE, 0x011F: 0xF0, 0x0131: 0xFD, 0x015F: 0xFE };

  /** Metni Windows-1254 baytlarına çevirir; karşılığı olmayan harf "?" olur. */
  function cp1254(text) {
    const out = new Uint8Array(text.length);
    let n = 0;
    for (const ch of text) {
      const c = ch.codePointAt(0);
      let b;
      if (CP1254[c] !== undefined) b = CP1254[c];
      else if (c < 0x80) b = c;
      else if (c >= 0xA0 && c <= 0xFF && [0xD0, 0xDD, 0xDE, 0xF0, 0xFD, 0xFE].indexOf(c) < 0) b = c;
      else b = 0x3F;
      out[n++] = b;
    }
    return out.subarray(0, n);
  }

  const RENK = { AG_HAVAI: 5, AG_YERALTI: 4, AYDINLATMA: 2, OG_HAVAI: 1, OG_YERALTI: 6, REKORTMAN: 30, MUSTEREK: 140 };

  function dxf(p) {
    const L = [];
    const katmanlar = new Map();
    const katman = (ad, renk) => {
      const a = String(ad || '0').replace(/[<>/\\":;?*|=`]/g, '_') || '0';
      if (!katmanlar.has(a)) katmanlar.set(a, renk || 7);
      return a;
    };
    const g = (kod, deger) => { L.push(String(kod), String(deger)); };
    const sayi = v => (Number.isFinite(v) ? Number(v.toFixed(4)) : 0);
    const on = p.proje.katmanOnEki || 'SC';
    const ent = [];
    const E = (kod, deger) => { ent.push(String(kod), String(deger)); };

    const cizgi = (kose, lay, kapali) => {
      if (!kose || kose.length < 2) return;
      E(0, 'POLYLINE'); E(8, lay); E(66, 1); E(70, kapali ? 1 : 0);
      for (const q of kose) { E(0, 'VERTEX'); E(8, lay); E(10, sayi(q[0])); E(20, sayi(q[1])); E(30, 0); }
      E(0, 'SEQEND'); E(8, lay);
    };
    const yazi = (x, y, h, t, lay, aci) => {
      if (!t) return;
      E(0, 'TEXT'); E(8, lay); E(10, sayi(x)); E(20, sayi(y)); E(30, 0); E(40, h); E(1, t); if (aci) E(50, Number(aci.toFixed(3)));
    };

    for (const b of p.bolgeler) {
      const lay = katman(on + '_PROJE', 3);
      cizgi(b.sinir, lay, true);
      const bb = SH.kutu(b.sinir || []);
      if (bb) yazi((bb[0] + bb[2]) / 2, (bb[1] + bb[3]) / 2, 2.5, (b.ad || '') + ' ' + (b.kod || ''), lay);
    }
    for (const c of p.kanallar) {
      const lay = katman(on + '_KABLO_KANALI', 30);
      cizgi(c.kose, lay);
      const m = SH.ortaNokta(c.kose);
      const kl = (c.kalemler || []).find(x => x.ana) || {};
      if (m) yazi(m[0], m[1] - 1.2, 0.8, SH.kanalKablolari(c.kod) + ' ' + c.zemin + ' ' + (kl.miktar || '') + 'm', lay);
    }
    for (const s of p.sondajlar) cizgi(s.kose, katman(on + '_YATAY_SONDAJ', 6));
    for (const h of p.hatlar) {
      const lay = katman(h.katman || on + '_HAT', h.durum === 'DM' ? 1 : h.durum === 'MEVCUT' ? 8 : RENK[h.tur] || 7);
      cizgi(h.kose, lay);
      if (h.etiket && h.kose.length >= 2) {
        const m = SH.ortaNokta(h.kose);
        const a = h.kose[0];
        const z = h.kose[h.kose.length - 1];
        let aci = Math.atan2(z[1] - a[1], z[0] - a[0]) * 180 / Math.PI;
        if (aci > 90) aci -= 180;
        if (aci < -90) aci += 180;
        yazi(m[0], m[1] + 0.4, 0.8, h.etiket, lay, aci);
      }
    }
    for (const e of p.elemanlar) {
      const lay = katman(e.katman || on + '_ELEMAN', e.durum === 'DM' ? 1 : e.durum === 'MEVCUT' ? 8 : 5);
      E(0, 'CIRCLE'); E(8, lay); E(10, sayi(e.saga)); E(20, sayi(e.yukari)); E(30, 0); E(40, 0.6);
      yazi(e.saga + 0.9, e.yukari + 0.5, 1.0, e.gisId || '', lay);
      yazi(e.saga + 0.9, e.yukari - 0.9, 0.7, e.tip || '', lay);
    }
    for (const n of p.noktalar) {
      const lay = katman('GPS', 7);
      E(0, 'POINT'); E(8, lay); E(10, sayi(n.saga)); E(20, sayi(n.yukari)); E(30, sayi(n.kot || 0));
      yazi(n.saga + 0.5, n.yukari + 0.5, 0.6, n.ad || '', lay);
    }

    g(0, 'SECTION'); g(2, 'HEADER');
    g(9, '$ACADVER'); g(1, 'AC1009');
    g(9, '$DWGCODEPAGE'); g(3, 'ANSI_1254');
    const bb = SH.projeKutusu(p) || [0, 0, 100, 100];
    g(9, '$EXTMIN'); g(10, sayi(bb[0])); g(20, sayi(bb[1])); g(30, 0);
    g(9, '$EXTMAX'); g(10, sayi(bb[2])); g(20, sayi(bb[3])); g(30, 0);
    g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'TABLES');
    g(0, 'TABLE'); g(2, 'LAYER'); g(70, katmanlar.size + 1);
    g(0, 'LAYER'); g(2, '0'); g(70, 0); g(62, 7); g(6, 'CONTINUOUS');
    for (const [ad, renk] of katmanlar) { g(0, 'LAYER'); g(2, ad); g(70, 0); g(62, renk); g(6, 'CONTINUOUS'); }
    g(0, 'ENDTAB'); g(0, 'ENDSEC');
    g(0, 'SECTION'); g(2, 'ENTITIES');
    for (const x of ent) L.push(x);
    g(0, 'ENDSEC'); g(0, 'EOF');
    return cp1254(L.join('\r\n') + '\r\n');
  }

  /** Elemanlar ve GPS noktaları: Ad;Y;X;Kot;Kod (noktalı virgül, ondalık nokta). */
  function noktalarCsv(p) {
    const satir = ['Ad;Y (Saga);X (Yukari);Kot;Kod;Tur;Durum;Hakedis'];
    const f = v => (Number.isFinite(v) ? v.toFixed(3) : '');
    const temiz = s => String(s || '').replace(/[;\r\n]/g, ' ');
    for (const e of p.elemanlar) satir.push([temiz(e.gisId || e.id), f(e.saga), f(e.yukari), e.kot ? f(e.kot) : '', temiz(e.tip), e.tur, e.durum, e.hakedis].join(';'));
    for (const n of p.noktalar) satir.push([temiz(n.ad || n.id), f(n.saga), f(n.yukari), n.kot ? f(n.kot) : '', temiz(n.kod), 'GPS', '', n.hakedis].join(';'));
    return '﻿' + satir.join('\r\n') + '\r\n';
  }

  return { dxf, noktalarCsv, cp1254 };
});
