/*
 * Harita: projenin bölgeleri, elemanları, hatları, kanalları ve GNSS konumu tek bir tuvalde çizilir.
 * Altlık karoları (OpenStreetMap, Google, Yandex) Web Mercator düzenindedir; her karonun üç köşesi
 * projenin TM dilimine çevrilip resim afin dönüşümle yerleştirilir (Saha Ölçüm'deki yöntem).
 * Kuzey yukarı; sürükleyerek kaydırma, iki parmakla yakınlaştırma, dokunarak seçim.
 */
(function () {
  'use strict';
  const SH = window.SH;

  const MIN_K = 0.0005;
  const MAX_K = 400;
  const TILE = 256;
  const MERC_RES = 156543.03392804097;
  const MAX_TILES = 90;

  const DURUM_RENK = { M: '#1D4ED8', 'M+M': '#15803D', DM: '#DC2626', 'DM+M': '#EA580C', MEVCUT: '#6B7280' };
  const HAT_RENK = {
    AG_HAVAI: '#1D4ED8', AG_YERALTI: '#0F766E', AYDINLATMA: '#CA8A04', OG_HAVAI: '#DC2626', OG_YERALTI: '#991B1B',
    REKORTMAN: '#7C3AED', MUSTEREK: '#0369A1'
  };

  function durumRengi(d) { return DURUM_RENK[d] || '#6B7280'; }
  function hatRengi(h) { return h.durum === 'MEVCUT' ? '#9CA3AF' : HAT_RENK[h.tur] || '#334155'; }

  function niceFloor(m) {
    const p = Math.pow(10, Math.floor(Math.log10(m)));
    const f = m / p;
    return (f >= 5 ? 5 : f >= 2 ? 2 : 1) * p;
  }

  function mesafeYazisi(m) {
    if (m >= 1000) return (m / 1000) + ' km';
    return (m >= 1 ? String(m) : m.toFixed(1)) + ' m';
  }

  function segDist(px, py, ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    const l2 = dx * dx + dy * dy;
    let t = l2 ? ((px - ax) * dx + (py - ay) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
  }

  // ---- Altlık karoları ----

  function tileLon(x, n) { return x / n * 360 - 180; }
  function tileLat(y, n) { return Math.atan(Math.sinh(Math.PI * (1 - 2 * y / n))) * 180 / Math.PI; }
  function lonTile(lon, n) { return (lon + 180) / 360 * n; }
  function latTile(lat, n) {
    const r = Math.max(-85.05, Math.min(85.05, lat)) * Math.PI / 180;
    return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * n;
  }

  function karolar(layer, v, boyut, ekran, dom, attrib) {
    const t = { base: null, imgs: new Map(), vtx: new Map(), failures: 0, lastCheck: 0, dom: 0, google: '', attribKey: '', attribAt: 0, loaded: false };

    function provider() {
      const b = t.base;
      return b ? b.providers.find(p => p.id === b.id) : null;
    }

    function clear() {
      layer.replaceChildren();
      t.imgs.clear();
    }

    function place(img) {
      const { z, x, y } = img.dataset;
      const a = t.vtx.get(z + '/' + x + '/' + y);
      const b = t.vtx.get(z + '/' + (+x + 1) + '/' + y);
      const c = t.vtx.get(z + '/' + x + '/' + (+y + 1));
      if (!a || !b || !c) {
        img.style.display = 'none';
        return;
      }
      const p0 = ekran(a[0], a[1]);
      const p1 = ekran(b[0], b[1]);
      const p2 = ekran(c[0], c[1]);
      img.style.transform = 'matrix(' + [(p1[0] - p0[0]) / TILE, (p1[1] - p0[1]) / TILE, (p2[0] - p0[0]) / TILE,
        (p2[1] - p0[1]) / TILE, p0[0], p0[1]].map(q => q.toFixed(4)).join(',') + ')';
      if (img.dataset.ok === '1') img.style.display = '';
    }

    function render() {
      const p = provider();
      const d = dom();
      if (d !== t.dom) {
        t.vtx.clear();
        t.dom = d;
      }
      const active = p && p.id !== 'none' && p.ready && d;
      if (!active) {
        if (t.imgs.size) clear();
        t.loaded = false;
        if (attrib) {
          attrib.hidden = true;
          const logo = attrib.parentNode.querySelector('[data-logo]');
          if (logo) logo.hidden = true;
        }
        return false;
      }
      const { W, H } = boyut();
      const corners = [[0, 0], [W, 0], [0, H], [W, H]].map(([px, py]) => SH.tmGeri(v.cx + (px - W / 2) / v.k, v.cy - (py - H / 2) / v.k, d));
      const lats = corners.map(c => c[0]);
      const lons = corners.map(c => c[1]);
      const latN = Math.max(...lats);
      const latS = Math.min(...lats);
      const lonW = Math.min(...lons);
      const lonE = Math.max(...lons);
      const latMid = (latN + latS) / 2;
      let z = Math.round(Math.log2(MERC_RES * Math.cos(latMid * Math.PI / 180) * v.k));
      z = Math.max(1, Math.min(p.maxZoom, z));
      let x0, x1, y0, y1;
      for (;;) {
        const n = 2 ** z;
        x0 = Math.floor(lonTile(lonW, n));
        x1 = Math.floor(lonTile(lonE, n));
        y0 = Math.floor(latTile(latN, n));
        y1 = Math.floor(latTile(latS, n));
        if ((x1 - x0 + 1) * (y1 - y0 + 1) <= MAX_TILES || z <= 1) break;
        z--;
      }
      const n = 2 ** z;
      x0 = Math.max(0, x0);
      y0 = Math.max(0, y0);
      x1 = Math.min(n - 1, x1);
      y1 = Math.min(n - 1, y1);
      for (let x = x0; x <= x1 + 1; x++) {
        for (let y = y0; y <= y1 + 1; y++) {
          const key = z + '/' + x + '/' + y;
          if (!t.vtx.has(key)) t.vtx.set(key, SH.tmIleri(tileLat(y, n), tileLon(x, n), d));
        }
      }
      if (t.vtx.size > 8000) t.vtx.clear();
      const wanted = new Set();
      let pending = 0;
      for (let x = x0; x <= x1; x++) {
        for (let y = y0; y <= y1; y++) {
          const key = p.id + '/' + z + '/' + x + '/' + y;
          wanted.add(key);
          let img = t.imgs.get(key);
          if (!img) {
            img = document.createElement('img');
            img.alt = '';
            img.draggable = false;
            img.decoding = 'async';
            img.dataset.z = z;
            img.dataset.x = x;
            img.dataset.y = y;
            img.style.cssText = 'position:absolute;left:0;top:0;width:' + (TILE + 1) + 'px;height:' + (TILE + 1) + 'px;transform-origin:0 0;display:none;max-width:none';
            img.onload = () => {
              img.dataset.ok = '1';
              t.loaded = true;
              t.failures = 0;
              place(img);
            };
            img.onerror = () => {
              img.dataset.ok = '0';
              img.style.display = 'none';
              t.failures++;
              hataDenetle();
            };
            img.src = '/tiles/' + p.id + '/' + z + '/' + x + '/' + y;
            layer.appendChild(img);
            t.imgs.set(key, img);
          }
          if (img.dataset.ok !== '1') pending++;
          place(img);
        }
      }
      for (const [key, img] of t.imgs) {
        if (wanted.has(key)) continue;
        const sameZoom = +img.dataset.z === z && key.startsWith(p.id + '/');
        if (sameZoom || pending === 0 || t.imgs.size > 220 || !key.startsWith(p.id + '/')) {
          img.remove();
          t.imgs.delete(key);
        } else {
          place(img);
        }
      }
      if (attrib) {
        attrib.hidden = false;
        // Sağlayıcıların istediği resmî logo (Google, Yandex)
        let logo = attrib.parentNode.querySelector('[data-logo]');
        if (!logo) {
          logo = document.createElement('img');
          logo.dataset.logo = '1';
          logo.alt = '';
          logo.style.cssText = 'position:absolute;left:8px;bottom:30px;pointer-events:none';
          attrib.parentNode.appendChild(logo);
        }
        const src = p.needs === 'google' ? (p.id === 'g-road' ? 'img/google-maps-logo-light.svg' : 'img/google-maps-logo-dark.svg')
          : p.needs === 'yandex' ? 'img/yandex-logo.svg' : '';
        logo.hidden = !src;
        if (src && logo.getAttribute('src') !== src) logo.src = src;
        logo.style.height = p.needs === 'yandex' ? '26px' : '18px';
        let text = p.attribution;
        if (p.needs === 'yandex') text = '© Yandex';
        if (p.needs === 'google') {
          text = t.google || 'Google';
          const akey = p.id + '/' + z + '/' + latN.toFixed(2) + '/' + lonW.toFixed(2);
          const now = Date.now();
          if (akey !== t.attribKey && now - t.attribAt > 1500) {
            t.attribKey = akey;
            t.attribAt = now;
            App.api('map.attrib', { id: p.id, z, n: latN, s: latS, e: lonE, w: lonW });
          }
        }
        attrib.textContent = text;
      }
      return t.loaded;
    }

    function hataDenetle() {
      const now = Date.now();
      if (t.failures < 3 || now - t.lastCheck < 8000) return;
      t.lastCheck = now;
      const b = App.api('map.base');
      if (b && b.error && b.error !== t.lastError) {
        t.lastError = b.error;
        App.toast(b.error);
      }
    }

    return {
      render,
      setBase(b) {
        const changed = !t.base || t.base.id !== b.id;
        t.base = b;
        if (changed) {
          clear();
          t.loaded = false;
          t.google = '';
          t.attribKey = '';
          t.lastError = null;
        }
      },
      attrib(d) {
        const p = provider();
        if (p && d.id === p.id) t.google = d.text || '';
      },
      base: () => t.base,
      loaded: () => t.loaded
    };
  }

  // ---- Harita ----

  /**
   * kutu: [data-map] öğesi (içinde [data-tiles], <canvas>, isteğe bağlı [data-attrib]).
   * opts: {veri: () => proje, ozel(ctx, ekran) ek çizim, dokun(hit, dunya), degisti()}
   */
  function olustur(kutu, opts) {
    const tuval = kutu.querySelector('canvas');
    const layer = kutu.querySelector('[data-tiles]');
    const v = {
      cx: null, cy: null, k: 1, takip: false, konum: null, secim: null, taslak: null, arti: false, frame: 0,
      katman: { bolge: true, nokta: true, eleman: true, hat: true, kanal: true, etiket: true, yalnizHakedis: false },
      vurgula: null
    };
    const boyut = () => ({ W: kutu.clientWidth || 360, H: kutu.clientHeight || 480 });
    const ekran = (e, n) => {
      const { W, H } = boyut();
      return [W / 2 + (e - v.cx) * v.k, H / 2 - (n - v.cy) * v.k];
    };
    const dunya = (x, y) => {
      const { W, H } = boyut();
      return [v.cx + (x - W / 2) / v.k, v.cy - (y - H / 2) / v.k];
    };
    const dom = () => (App.oturum.acik() ? App.oturum.dom() : 0);
    const tiles = karolar(layer, v, boyut, ekran, dom, kutu.querySelector('[data-attrib]'));

    function gorunurAlan(pad) {
      const { W, H } = boyut();
      const q = (pad || 0) / v.k;
      return [v.cx - W / 2 / v.k - q, v.cy - H / 2 / v.k - q, v.cx + W / 2 / v.k + q, v.cy + H / 2 / v.k + q];
    }

    function kesisir(bb, a) { return bb && !(bb[2] < a[0] || bb[0] > a[2] || bb[3] < a[1] || bb[1] > a[3]); }

    function fit(bb, oran) {
      const { W, H } = boyut();
      if (!bb) {
        if (v.cx === null) { v.cx = 500000; v.cy = 4400000; v.k = 0.01; }
        return;
      }
      v.cx = (bb[0] + bb[2]) / 2;
      v.cy = (bb[1] + bb[3]) / 2;
      const span = Math.max(bb[2] - bb[0], (bb[3] - bb[1]) * W / H, 20);
      v.k = Math.min(MAX_K, Math.max(MIN_K, W * (oran || 0.85) / span));
    }

    function tumu() {
      const ot = App.oturum;
      let bb = ot.acik() ? ot.kutu : null;
      if (!bb && ot.konumTM && ot.konumTM.e !== null) bb = [ot.konumTM.e - 50, ot.konumTM.n - 50, ot.konumTM.e + 50, ot.konumTM.n + 50];
      fit(bb);
      v.takip = false;
      schedule();
    }

    function zoomAt(f, px, py) {
      const { W, H } = boyut();
      if (px === undefined) {
        px = W / 2;
        py = H / 2;
      }
      const [wx, wy] = dunya(px, py);
      v.k = Math.min(MAX_K, Math.max(MIN_K, v.k * f));
      v.cx = wx - (px - W / 2) / v.k;
      v.cy = wy + (py - H / 2) / v.k;
    }

    // ---- Çizim ----

    function render() {
      v.frame = 0;
      if (v.cx === null) tumu();
      const kTM = App.oturum.konumTM;
      if (v.takip && kTM && kTM.e !== null) {
        v.cx = kTM.e;
        v.cy = kTM.n;
      }
      const { W, H } = boyut();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const cw = Math.round(W * dpr);
      const ch = Math.round(H * dpr);
      if (tuval.width !== cw || tuval.height !== ch) {
        tuval.width = cw;
        tuval.height = ch;
        tuval.style.width = W + 'px';
        tuval.style.height = H + 'px';
      }
      const altlikVar = tiles.render();
      const ctx = tuval.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      if (!altlikVar) izgara(ctx, W, H);
      const ot = App.oturum;
      if (ot.acik()) cizProje(ctx, ot.p, W, H);
      if (opts.ozel) opts.ozel(ctx, ekran, v);
      cizTaslak(ctx);
      cizKonum(ctx);
      if (v.arti) cizArti(ctx, W, H);
      cizOlcek(ctx, W, H);
      if (opts.degisti) opts.degisti(v);
    }

    function schedule() {
      if (v.frame) return;
      v.frame = requestAnimationFrame(render);
    }

    function izgara(ctx, W, H) {
      const adim = niceFloor(120 / v.k);
      const [e0, n0, e1, n1] = gorunurAlan(0);
      ctx.strokeStyle = 'rgba(15,23,42,0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let e = Math.floor(e0 / adim) * adim; e <= e1; e += adim) {
        const [x] = ekran(e, 0);
        ctx.moveTo(Math.round(x) + 0.5, 0);
        ctx.lineTo(Math.round(x) + 0.5, H);
      }
      for (let n = Math.floor(n0 / adim) * adim; n <= n1; n += adim) {
        const [, y] = ekran(0, n);
        ctx.moveTo(0, Math.round(y) + 0.5);
        ctx.lineTo(W, Math.round(y) + 0.5);
      }
      ctx.stroke();
    }

    function soluk(o) {
      return v.katman.yalnizHakedis && o.hakedis !== App.oturum.hakedis();
    }

    function yol(ctx, kose) {
      ctx.beginPath();
      for (let i = 0; i < kose.length; i++) {
        const [x, y] = ekran(kose[i][0], kose[i][1]);
        if (i === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
    }

    function cizProje(ctx, p, W, H) {
      const alan = gorunurAlan(40);
      const k = v.k;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';

      // Bölgeler
      if (v.katman.bolge) {
        for (const b of p.bolgeler) {
          if (!b.sinir || b.sinir.length < 2 || !kesisir(b._kutu, alan)) continue;
          yol(ctx, b.sinir);
          ctx.closePath();
          ctx.fillStyle = 'rgba(37,99,235,0.035)';
          ctx.fill();
          ctx.strokeStyle = 'rgba(37,99,235,0.75)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([8, 4]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
      }

      // Kanallar
      if (v.katman.kanal) {
        ctx.lineWidth = Math.max(4, Math.min(10, 0.8 * k));
        for (const c of p.kanallar) {
          if (!kesisir(c._kutu, alan)) continue;
          ctx.globalAlpha = soluk(c) ? 0.15 : 0.45;
          ctx.strokeStyle = '#B45309';
          yol(ctx, c.kose);
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.strokeStyle = '#7C3AED';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([3, 4]);
        for (const s of p.sondajlar) {
          if (!kesisir(s._kutu, alan)) continue;
          ctx.globalAlpha = soluk(s) ? 0.25 : 1;
          yol(ctx, s.kose);
          ctx.stroke();
        }
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // Hatlar
      if (v.katman.hat) {
        const genis = k > 2 ? 3 : 2;
        for (const h of p.hatlar) {
          if (!kesisir(h._kutu, alan)) continue;
          ctx.globalAlpha = soluk(h) ? 0.2 : 1;
          ctx.strokeStyle = hatRengi(h);
          ctx.lineWidth = h.durum === 'MEVCUT' ? genis - 0.5 : genis;
          if (h.durum === 'DM') ctx.setLineDash([7, 5]);
          yol(ctx, h.kose);
          ctx.stroke();
          if (h.durum === 'DM') ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
      }

      // Seçili çizgi
      const sec = v.secim;
      if (sec && sec.k !== 'elemanlar' && sec.k !== 'noktalar') {
        const o = App.oturum.nesne(sec.k, sec.id);
        const kose = o && (sec.k === 'bolgeler' ? o.sinir : o.kose);
        if (kose && kose.length) {
          yol(ctx, kose);
          if (sec.k === 'bolgeler') ctx.closePath();
          ctx.strokeStyle = 'rgba(245,158,11,0.9)';
          ctx.lineWidth = 7;
          ctx.globalAlpha = 0.6;
          ctx.stroke();
          ctx.globalAlpha = 1;
        }
      }

      // GPS noktaları
      const etiketler = [];
      if (v.katman.nokta && k > 0.15) {
        ctx.strokeStyle = '#111827';
        ctx.lineWidth = 1.2;
        for (const n of p.noktalar) {
          if (n.saga < alan[0] || n.saga > alan[2] || n.yukari < alan[1] || n.yukari > alan[3]) continue;
          const [x, y] = ekran(n.saga, n.yukari);
          ctx.globalAlpha = soluk(n) ? 0.3 : 0.9;
          ctx.beginPath();
          ctx.moveTo(x - 3, y - 3); ctx.lineTo(x + 3, y + 3);
          ctx.moveTo(x - 3, y + 3); ctx.lineTo(x + 3, y - 3);
          ctx.stroke();
          if (k > 2.5) etiketler.push([x + 5, y + 10, n.ad, '#374151']);
        }
        ctx.globalAlpha = 1;
      }

      // Elemanlar
      if (v.katman.eleman) {
        const r = k < 0.3 ? 2 : k < 1 ? 3.5 : k < 4 ? 5 : 7;
        const gorunen = [];
        for (const e of p.elemanlar) {
          if (e.saga < alan[0] || e.saga > alan[2] || e.yukari < alan[1] || e.yukari > alan[3]) continue;
          gorunen.push(e);
        }
        const kenar = r >= 3.5;
        for (const e of gorunen) {
          const [x, y] = ekran(e.saga, e.yukari);
          ctx.globalAlpha = soluk(e) ? 0.25 : 1;
          ctx.fillStyle = durumRengi(e.durum);
          const sekil = SH.elemanTuru(e.tur).sekil;
          if (r <= 2) {
            ctx.fillRect(x - 1.5, y - 1.5, 3, 3);
            continue;
          }
          ctx.beginPath();
          if (sekil === 'kare') ctx.rect(x - r, y - r, 2 * r, 2 * r);
          else if (sekil === 'ucgen') { ctx.moveTo(x, y - r * 1.2); ctx.lineTo(x + r * 1.1, y + r * 0.8); ctx.lineTo(x - r * 1.1, y + r * 0.8); ctx.closePath(); }
          else if (sekil === 'elmas') { ctx.moveTo(x, y - r); ctx.lineTo(x + r, y); ctx.lineTo(x, y + r); ctx.lineTo(x - r, y); ctx.closePath(); }
          else ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();
          if (kenar) {
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 1.5;
            ctx.stroke();
          }
          if (v.katman.etiket && k > 1.2 && gorunen.length < 500) etiketler.push([x + r + 3, y - r - 1, e.gisId || e.tip, '#0F172A']);
        }
        ctx.globalAlpha = 1;
        if (sec && sec.k === 'elemanlar') {
          const e = App.oturum.nesne('elemanlar', sec.id);
          if (e) halka(ctx, e.saga, e.yukari, r + 6);
        }
      }
      if (sec && sec.k === 'noktalar') {
        const n = App.oturum.nesne('noktalar', sec.id);
        if (n) halka(ctx, n.saga, n.yukari, 9);
      }
      if (v.vurgula) {
        for (const id of v.vurgula) {
          const e = App.oturum.nesne('elemanlar', id);
          if (e) halka(ctx, e.saga, e.yukari, 10, '#16A34A');
        }
      }

      // Bölge kodları: sınırın sol üst köşesinde, küçük (ağın üstünü kapatmasın)
      if (v.katman.bolge && k > 0.02) {
        ctx.font = '600 10px Inter, sans-serif';
        const { W } = boyut();
        for (const b of p.bolgeler) {
          if (!b._kutu || !kesisir(b._kutu, alan)) continue;
          const genislik = (b._kutu[2] - b._kutu[0]) * k;
          if (genislik < 70) continue;
          let [x, y] = ekran(b._kutu[0], b._kutu[3]);
          x = Math.max(4, x + 4);
          y = Math.max(14, y + 13);
          const metin = b.kod || b.ad || '';
          const sigan = Math.max(6, Math.floor(Math.min(genislik, W - x) / 6.2));
          yazi(ctx, metin.length > sigan ? metin.slice(0, sigan - 1) + '…' : metin, x, y, 'rgba(29,78,216,0.8)');
        }
      }

      // Etiketler
      ctx.font = '600 11px Inter, sans-serif';
      for (const [x, y, t, c] of etiketler) if (t) yazi(ctx, t, x, y, c);
    }

    function yazi(ctx, t, x, y, renk) {
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.strokeText(t, x, y);
      ctx.fillStyle = renk;
      ctx.fillText(t, x, y);
    }

    function halka(ctx, e, n, r, renk) {
      const [x, y] = ekran(e, n);
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.strokeStyle = renk || '#F59E0B';
      ctx.lineWidth = 3;
      ctx.stroke();
    }

    function cizTaslak(ctx) {
      const t = v.taslak;
      if (!t || !t.kose) return;
      const kose = t.kose.slice();
      const imlec = t.imlec ? t.imlec() : null;
      ctx.lineWidth = 3;
      ctx.strokeStyle = t.renk || '#0D4A7A';
      if (kose.length > 1) {
        yol(ctx, kose);
        if (t.kapali) ctx.closePath();
        ctx.stroke();
      }
      if (imlec && kose.length) {
        const [ax, ay] = ekran(kose[kose.length - 1][0], kose[kose.length - 1][1]);
        const [bx, by] = ekran(imlec[0], imlec[1]);
        ctx.setLineDash([6, 5]);
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(bx, by);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      ctx.fillStyle = '#FFFFFF';
      for (const q of kose) {
        const [x, y] = ekran(q[0], q[1]);
        ctx.beginPath();
        ctx.arc(x, y, 4.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
      }
    }

    function cizKonum(ctx) {
      const kTM = App.oturum.konumTM;
      if (!kTM || kTM.e === null) return;
      const [x, y] = ekran(kTM.e, kTM.n);
      const f = kTM.f || {};
      const acc = f.hrms ? Math.max(9, Math.min(80, f.hrms * v.k)) : 12;
      ctx.beginPath();
      ctx.arc(x, y, acc, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37,99,235,0.16)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(37,99,235,0.6)';
      ctx.lineWidth = 1;
      ctx.stroke();
      const moving = f.speed > 0.5 && f.bearing !== null && f.bearing !== undefined;
      if (moving) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(f.bearing * Math.PI / 180);
        ctx.beginPath();
        ctx.moveTo(0, -11); ctx.lineTo(7, 8); ctx.lineTo(0, 4); ctx.lineTo(-7, 8); ctx.closePath();
        ctx.fillStyle = '#1D4ED8';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.stroke();
        ctx.restore();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = '#1D4ED8';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }

    function cizArti(ctx, W, H) {
      const x = W / 2;
      const y = H / 2;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x - 18, y); ctx.lineTo(x - 6, y);
      ctx.moveTo(x + 6, y); ctx.lineTo(x + 18, y);
      ctx.moveTo(x, y - 18); ctx.lineTo(x, y - 6);
      ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 18);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fillStyle = '#C2410C';
      ctx.fill();
    }

    function cizOlcek(ctx, W, H) {
      const m = niceFloor(90 / v.k);
      const px = m * v.k;
      const x0 = 12;
      const y0 = H - 14;
      ctx.strokeStyle = '#0F172A';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(x0, y0 - 5); ctx.lineTo(x0, y0); ctx.lineTo(x0 + px, y0); ctx.lineTo(x0 + px, y0 - 5);
      ctx.stroke();
      ctx.font = '600 11px Inter, sans-serif';
      yazi(ctx, mesafeYazisi(m), x0 + 4, y0 - 6, '#0F172A');
    }

    // ---- Seçim ----

    /** Dokunulan yerdeki nesne: önce eleman, sonra nokta, sonra çizgiler, en son bölge. */
    function bul(x, y) {
      const ot = App.oturum;
      if (!ot.acik()) return null;
      const p = ot.p;
      const [we, wn] = dunya(x, y);
      const r = 24 / v.k;
      let best = null;
      let bestD = 24;
      if (v.katman.eleman) {
        for (const e of p.elemanlar) {
          if (Math.abs(e.saga - we) > r || Math.abs(e.yukari - wn) > r) continue;
          const [sx, sy] = ekran(e.saga, e.yukari);
          const d = Math.hypot(sx - x, sy - y);
          if (d < bestD) { bestD = d; best = { k: 'elemanlar', id: e.id }; }
        }
      }
      if (best) return best;
      if (v.katman.nokta) {
        bestD = 18;
        for (const n of p.noktalar) {
          if (Math.abs(n.saga - we) > r || Math.abs(n.yukari - wn) > r) continue;
          const [sx, sy] = ekran(n.saga, n.yukari);
          const d = Math.hypot(sx - x, sy - y);
          if (d < bestD) { bestD = d; best = { k: 'noktalar', id: n.id }; }
        }
      }
      if (best) return best;
      bestD = 14;
      const cizgi = (k, list) => {
        for (const o of list) {
          const bb = o._kutu;
          if (!bb || we < bb[0] - r || we > bb[2] + r || wn < bb[1] - r || wn > bb[3] + r) continue;
          for (let i = 1; i < o.kose.length; i++) {
            const a = ekran(o.kose[i - 1][0], o.kose[i - 1][1]);
            const b = ekran(o.kose[i][0], o.kose[i][1]);
            const d = segDist(x, y, a[0], a[1], b[0], b[1]);
            if (d < bestD) { bestD = d; best = { k, id: o.id }; }
          }
        }
      };
      if (v.katman.hat) cizgi('hatlar', p.hatlar);
      if (v.katman.kanal) {
        cizgi('kanallar', p.kanallar);
        cizgi('sondajlar', p.sondajlar);
      }
      if (best) return best;
      if (v.katman.bolge) {
        let alan = Infinity;
        for (const b of p.bolgeler) {
          if (!b.sinir || b.sinir.length < 3 || !SH.icinde([we, wn], b.sinir)) continue;
          const a = ot.alanlar.get(b.id) || SH.alan(b.sinir);
          if (a < alan) { alan = a; best = { k: 'bolgeler', id: b.id }; }
        }
      }
      return best;
    }

    /** Yakındaki eleman (hat ucu yakalama); yoksa null. */
    function yakinEleman(e, n, px) {
      const ot = App.oturum;
      if (!ot.acik()) return null;
      const r = (px || 30) / v.k;
      let best = null;
      let bestD = r;
      for (const x of ot.p.elemanlar) {
        const d = Math.hypot(x.saga - e, x.yukari - n);
        if (d < bestD) { bestD = d; best = x; }
      }
      return best;
    }

    // ---- Dokunma ----

    const ptrs = new Map();
    let pinch = null;
    let moved = false;

    function local(e) {
      const r = kutu.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function down(e) {
      if (e.target.closest('button, [data-a]')) return;
      try { kutu.setPointerCapture(e.pointerId); } catch (err) { /* yok */ }
      const [x, y] = local(e);
      ptrs.set(e.pointerId, { x, y, x0: x, y0: y });
      if (ptrs.size === 1) moved = false;
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    }

    function move(e) {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      const [x, y] = local(e);
      if (ptrs.size === 1) {
        if (!moved && Math.hypot(x - p.x0, y - p.y0) < 8) return;
        moved = true;
        v.takip = false;
        v.cx -= (x - p.x) / v.k;
        v.cy += (y - p.y) / v.k;
      } else if (ptrs.size === 2 && pinch) {
        p.x = x;
        p.y = y;
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d > 10) zoomAt(d / pinch, (a.x + b.x) / 2, (a.y + b.y) / 2);
        pinch = d;
        moved = true;
      }
      p.x = x;
      p.y = y;
      schedule();
    }

    function up(e) {
      const p = ptrs.get(e.pointerId);
      if (!p) return;
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinch = null;
      if (!moved && ptrs.size === 0 && opts.dokun) {
        const [x, y] = local(e);
        opts.dokun(bul(x, y), dunya(x, y), [x, y]);
      }
    }

    function wheel(e) {
      e.preventDefault();
      const [x, y] = local(e);
      zoomAt(e.deltaY < 0 ? 1.25 : 0.8, x, y);
      schedule();
    }

    kutu.addEventListener('pointerdown', down);
    kutu.addEventListener('pointermove', move);
    kutu.addEventListener('pointerup', up);
    kutu.addEventListener('pointercancel', up);
    kutu.addEventListener('wheel', wheel, { passive: false });
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => schedule()) : null;
    if (ro) ro.observe(kutu);

    return {
      v,
      render,
      ciz: schedule,
      ekran,
      dunya,
      boyut,
      tumu,
      fit(bb, oran) { v.takip = false; fit(bb, oran); schedule(); },
      merkez(e, n, genislikM) {
        v.cx = e;
        v.cy = n;
        if (genislikM) v.k = Math.min(MAX_K, Math.max(MIN_K, boyut().W / genislikM));
        schedule();
      },
      merkezNokta() { return [v.cx, v.cy]; },
      yakinlas(f) { zoomAt(f); schedule(); },
      takip(on) {
        v.takip = on === undefined ? !v.takip : !!on;
        schedule();
        return v.takip;
      },
      secim(s) { v.secim = s || null; schedule(); },
      taslak(t) { v.taslak = t || null; schedule(); },
      arti(on) { v.arti = !!on; schedule(); },
      vurgula(ids) { v.vurgula = ids || null; schedule(); },
      katman(ad, on) {
        if (on !== undefined) { v.katman[ad] = !!on; schedule(); }
        return v.katman[ad];
      },
      bul,
      yakinEleman,
      altlik(b) { tiles.setBase(b); schedule(); },
      altlikBilgi: () => tiles.base(),
      attrib(d) { tiles.attrib(d); schedule(); },
      kapat() {
        if (ro) ro.disconnect();
        kutu.removeEventListener('pointerdown', down);
        kutu.removeEventListener('pointermove', move);
        kutu.removeEventListener('pointerup', up);
        kutu.removeEventListener('pointercancel', up);
        kutu.removeEventListener('wheel', wheel);
      }
    };
  }

  window.Harita = { olustur, durumRengi, hatRengi, HAT_RENK, DURUM_RENK };
})();
