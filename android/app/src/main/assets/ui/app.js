/*
 * Şebeke Hakediş arayüz çekirdeği: ekran yığını, Android köprüsü, bağlama yardımcıları.
 * (Saha Ölçüm uygulamasındaki yapının aynısı.)
 *
 * Ekranların görünümü screens/<id>.html dosyalarındadır. Davranışı screens-*.js dosyalarında
 * App.screen(id, {...}) ile tanımlanır. HTML'de:
 *   data-b="anahtar"    metni App.set(s, 'anahtar', değer) ile değişen öğe
 *   data-a="eylem"      dokununca denetleyicinin actions.eylem(s, öğe) işlevi çalışır
 *   data-show="anahtar" App.show(s, 'anahtar', açık) ile görünür/gizli olur
 *   data-tpl="ad"       liste satırı şablonu (App.make ile çoğaltılır)
 */
(function () {
  'use strict';

  const cache = {};
  const stack = [];
  const controllers = {};
  let toastTimer = null;

  // ---- Android köprüsü ----

  /** Eşzamanlı çağrı; yanıt JSON olarak döner. Hata olursa {error} döner. */
  function api(method, args) {
    try {
      const raw = window.Android.call(method, JSON.stringify(args || {}));
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      console.error('api', method, e);
      return { error: String(e && e.message || e) };
    }
  }

  /** Arayüzle gelen sabit veri dosyası (katalog vb.); bulunamazsa null. */
  function loadJson(path) {
    try {
      const xhr = new XMLHttpRequest();
      xhr.open('GET', path, false);
      xhr.send();
      if (xhr.status !== 200 && xhr.status !== 0) return null;
      return JSON.parse(xhr.responseText);
    } catch (e) {
      console.error('json', path, e);
      return null;
    }
  }

  // ---- Ekran dosyaları ----

  function parseScreen(id, text) {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    const tpl = doc.querySelector('template');
    if (!tpl) throw new Error('Ekran şablonu yok: ' + id);
    return { bodyClass: tpl.dataset.bodyClass || '', html: tpl.innerHTML };
  }

  function loadSync(id) {
    if (cache[id]) return cache[id];
    const xhr = new XMLHttpRequest();
    xhr.open('GET', 'screens/' + id + '.html', false);
    xhr.send();
    if (xhr.status !== 200 && xhr.status !== 0) throw new Error('Ekran yüklenemedi: ' + id);
    cache[id] = parseScreen(id, xhr.responseText);
    return cache[id];
  }

  // ---- Ekran yığını ----

  function create(id, params) {
    const look = loadSync(id);
    const root = document.createElement('div');
    root.className = 'screen-root';
    root.dataset.screen = id;
    root.innerHTML = look.html;
    const inst = {
      id, params: params || {}, root, state: {}, tpl: {},
      ctrl: controllers[id] || {},
      $: sel => root.querySelector(sel),
      $$: sel => Array.from(root.querySelectorAll(sel))
    };
    inst.$$('[data-tpl]').forEach(el => {
      inst.tpl[el.dataset.tpl] = el;
      el.removeAttribute('data-tpl');
      el.remove();
    });
    inst.$$('[data-sample]').forEach(el => el.remove());
    root.querySelectorAll('form').forEach(f => f.addEventListener('submit', e => e.preventDefault()));
    root.querySelectorAll('nav a[data-path], nav button[data-path]').forEach(a => { a.dataset.a = a.dataset.a || 'nav'; });
    root.addEventListener('click', ev => onClick(inst, ev));
    return inst;
  }

  /** Şablondan satır üretir; [data-f=alan] öğelerine değerleri yazar. */
  function make(inst, name, values) {
    const el = inst.tpl[name].cloneNode(true);
    fillFields(el, values || {});
    return el;
  }

  function fillFields(el, values) {
    el.querySelectorAll('[data-f]').forEach(f => {
      const v = values[f.dataset.f];
      if (v !== undefined) f.textContent = v === null ? '' : String(v);
    });
    if (el.dataset && el.dataset.f && values[el.dataset.f] !== undefined) el.textContent = values[el.dataset.f];
  }

  function show(inst, resumed) {
    const host = document.getElementById('screen');
    host.replaceChildren(inst.root);
    document.body.className = cache[inst.id].bodyClass;
    paintNav(inst);
    window.scrollTo(0, inst.scrollY || 0);
    const c = inst.ctrl;
    if (!resumed) {
      if (c.mount) c.mount(inst);
    } else if (c.resume) {
      c.resume(inst);
    }
    if (App.fix && c.fix && !inst.closed && top() === inst) c.fix(inst, App.fix);
  }

  function top() { return stack[stack.length - 1]; }

  function push(id, params) {
    const current = top();
    if (current) {
      current.scrollY = window.scrollY;
      if (current.ctrl.pause) current.ctrl.pause(current);
    }
    const inst = create(id, params);
    stack.push(inst);
    show(inst, false);
    return inst;
  }

  function leave(inst) {
    if (inst.ctrl.leave) inst.ctrl.leave(inst);
    inst.closed = true;
  }

  function pop(result) {
    if (stack.length <= 1) return false;
    const inst = stack.pop();
    leave(inst);
    const prev = top();
    if (result !== undefined) prev.result = result;
    show(prev, true);
    return true;
  }

  /** Geri dönüşte verilen sonucu bir kez okur. */
  function takeResult(inst) {
    const r = inst.result;
    inst.result = undefined;
    return r;
  }

  function remove(inst, result) {
    const i = stack.indexOf(inst);
    if (i < 0) return;
    if (i === stack.length - 1) {
      pop(result);
      return;
    }
    if (i > 0 && result !== undefined) stack[i - 1].result = result;
    stack.splice(i, 1);
    leave(inst);
  }

  function root(id, params) {
    while (stack.length) leave(stack.pop());
    return push(id, params);
  }

  function replace(id, params) {
    const inst = stack.pop();
    if (inst) leave(inst);
    return push(id, params);
  }

  /** Geri tuşu. Yığın tek ekransa false döner (uygulama kapanır). */
  function back() {
    if (closeDialog()) return true;
    const inst = top();
    if (inst && inst.ctrl.back && inst.ctrl.back(inst) === true) return true;
    if (stack.length <= 1 && inst && inst.id !== 'ana' && inst.id !== 'projeler' && App.oturum && App.oturum.acik()) {
      // Alt menüdeki ekranlardan geri: proje ana ekranına
      root('ana');
      return true;
    }
    return pop();
  }

  // ---- Dokunma ----

  /** Alt gezinme: Proje, Harita, Hakediş. */
  const NAV = { proje: 'ana', harita: 'harita', hakedis: 'ozet' };

  function onClick(inst, ev) {
    const el = ev.target.closest('[data-a]');
    if (!el || !inst.root.contains(el)) return;
    if (el.disabled) return;
    const name = el.dataset.a;
    if (name === 'back') {
      ev.preventDefault();
      back();
      return;
    }
    if (name === 'nav') {
      ev.preventDefault();
      const target = NAV[el.dataset.path];
      if (target && target !== inst.id) root(target);
      return;
    }
    const handler = inst.ctrl.actions && inst.ctrl.actions[name];
    if (handler) {
      ev.preventDefault();
      handler(inst, el, ev);
      return;
    }
    if (App.globals && App.globals[name]) {
      ev.preventDefault();
      App.globals[name](inst, el, ev);
    }
  }

  function paintNav(inst) {
    const current = Object.keys(NAV).find(k => NAV[k] === inst.id);
    inst.$$('nav a[data-path], nav button[data-path]').forEach(a => {
      const on = a.dataset.path === current;
      a.classList.toggle('text-primary-container', on);
      a.classList.toggle('font-semibold', on);
      a.classList.toggle('text-secondary', !on);
      if (on) a.setAttribute('aria-current', 'page');
      else a.removeAttribute('aria-current');
      const icon = a.querySelector('.material-symbols-outlined');
      if (icon) icon.style.fontVariationSettings = on ? "'FILL' 1" : '';
    });
  }

  // ---- Bağlama yardımcıları ----

  function set(inst, key, value) {
    const text = value === undefined || value === null ? '' : String(value);
    inst.root.querySelectorAll('[data-b="' + key + '"]').forEach(el => {
      if (el.matches('input, textarea, select')) {
        if (el.value !== text && document.activeElement !== el) el.value = text;
      } else if (el.textContent !== text) {
        el.textContent = text;
      }
    });
  }

  function setAll(inst, values) {
    for (const [k, v] of Object.entries(values)) set(inst, k, v);
  }

  function showEl(inst, key, on) {
    inst.root.querySelectorAll('[data-show="' + key + '"]').forEach(el => { el.hidden = !on; });
  }

  function val(inst, key) {
    const el = inst.root.querySelector('[data-b="' + key + '"]');
    return el ? (el.value !== undefined ? el.value : el.textContent).trim() : '';
  }

  /** Sınıf takımlarından birini seçer: swap(el, {ok:'a b', warn:'c'}, 'ok'). */
  function swap(el, sets, which) {
    if (!el) return;
    for (const cls of Object.values(sets)) el.classList.remove(...cls.split(/\s+/).filter(Boolean));
    const add = sets[which];
    if (add) el.classList.add(...add.split(/\s+/).filter(Boolean));
  }

  function esc(s) {
    return String(s === undefined || s === null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function fmt(v, d) {
    return v === null || v === undefined || Number.isNaN(v) ? '—' : Number(v).toFixed(d);
  }

  /** Ondalık virgülü de kabul eder; sayı değilse NaN. */
  function num(text) {
    const t = String(text === undefined || text === null ? '' : text).replace(',', '.').trim();
    return t === '' ? NaN : Number(t);
  }

  // ---- GNSS durum şeridi ----

  const CHIP = {
    fixed: 'bg-success-container text-on-success-container',
    float: 'bg-warning-container text-on-warning-container',
    bad: 'bg-error-container text-on-error-container'
  };
  const DOT = { fixed: 'bg-success', float: 'bg-[#B45309]', bad: 'bg-error' };

  function chipKind(kind) {
    return kind === 'fixed' ? 'fixed' : (kind === 'float' || kind === 'dgps') ? 'float' : 'bad';
  }

  /** Çözüm etiketi: telefon konumunda "Telefon" / "Harici" öneki. */
  function fixLabel(f) {
    if (!f || !f.live) return 'Konum yok';
    if (!f.has) return f.label || 'Konum yok';
    if (f.source === 'phone') return (f.mock ? 'Harici' : 'Telefon') + (f.kind === 'fixed' ? ' · RTK' : '');
    return f.label;
  }

  /**
   * Ekranlardaki ortak konum okumaları: data-b="fix-label|fix-sats|fix-age|fix-hrms" ve çözüm rozeti
   * [data-chip] (içindeki nokta [data-dot]).
   */
  function telemetry(inst, f) {
    if (!f) return;
    const k = chipKind(f.kind);
    setAll(inst, {
      'fix-label': fixLabel(f),
      'fix-sats': f.live && f.sats ? f.sats : '—',
      'fix-age': f.age === null || f.age === undefined ? '—' : fmt(f.age, 1) + ' sn',
      'fix-hrms': f.hrms === null || f.hrms === undefined ? '—' : '±' + fmt(f.hrms, f.hrms < 1 ? 3 : 1) + ' m'
    });
    inst.$$('[data-chip]').forEach(el => swap(el, CHIP, k));
    inst.$$('[data-dot]').forEach(el => swap(el, DOT, k));
  }

  // ---- Bildirim ve iletişim kutusu ----

  function toast(message, action) {
    const host = document.getElementById('toast');
    // Alt panel açıksa bildirim panelin üstünde görünür (giriş alanlarını örtmesin).
    const sheet = Array.from(document.querySelectorAll('.sheet')).find(el => !el.hidden && el.offsetHeight > 0);
    host.style.bottom = sheet ? (sheet.offsetHeight + 12) + 'px' : '';
    host.innerHTML = '<div>' + esc(message) + (action ? '<button type="button">' + esc(action.label) + '</button>' : '') + '</div>';
    const box = host.firstChild;
    if (action) {
      box.querySelector('button').addEventListener('click', () => {
        box.classList.remove('show');
        action.run();
      });
    }
    requestAnimationFrame(() => box.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => box.classList.remove('show'), action ? 5000 : 2600);
  }

  let dialogDone = null;

  /**
   * Basit iletişim kutusu. opts: {title, message, html, items:[{label, sub, value, icon}],
   * input:{value, type, mode, placeholder}, fields:[{key, label, value, type, mode, options}],
   * checks:[{label, sub, on}], actions:[{label, value, main}]}. Seçilen değerle çözülen Promise
   * döner; kapatılırsa null. "ok" değerli eylem girişleri {ok, text, values, checks} olarak döndürür.
   */
  function dialog(opts) {
    closeDialog();
    return new Promise(resolve => {
      const wrap = document.createElement('div');
      wrap.id = 'dialog';
      let html = '<div class="box">';
      if (opts.title) html += '<h2>' + esc(opts.title) + '</h2>';
      if (opts.message) html += '<p>' + esc(opts.message) + '</p>';
      if (opts.html) html += '<div class="html">' + opts.html + '</div>';
      if (opts.input) {
        html += '<input id="dialog-input" type="' + (opts.input.type || 'text') + '" value="' + esc(opts.input.value || '') + '"' +
          (opts.input.mode ? ' inputmode="' + opts.input.mode + '"' : '') + (opts.input.placeholder ? ' placeholder="' + esc(opts.input.placeholder) + '"' : '') + '>';
      }
      if (opts.fields) {
        html += '<div class="fields">' + opts.fields.map((f, i) => {
          let input;
          if (f.options) {
            input = '<select data-fi="' + i + '">' + f.options.map(o => {
              const v = typeof o === 'object' ? o.value : o;
              const l = typeof o === 'object' ? o.label : o;
              return '<option value="' + esc(v) + '"' + (String(v) === String(f.value) ? ' selected' : '') + '>' + esc(l) + '</option>';
            }).join('') + '</select>';
          } else {
            input = '<input data-fi="' + i + '" type="' + (f.type || 'text') + '" value="' + esc(f.value === undefined ? '' : f.value) + '"' +
              (f.mode ? ' inputmode="' + f.mode + '"' : '') + (f.placeholder ? ' placeholder="' + esc(f.placeholder) + '"' : '') + '>';
          }
          return '<label><span>' + esc(f.label) + '</span>' + input + '</label>';
        }).join('') + '</div>';
      }
      if (opts.checks) {
        html += '<div class="items">' + opts.checks.map((it, i) =>
          '<button data-c="' + i + '"' + (it.locked ? ' disabled' : '') + '><span class="material-symbols-outlined" style="color:#0D4A7A" data-ci>' + (it.on ? 'check_box' : 'check_box_outline_blank') + '</span>' +
          '<span>' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span></button>').join('') + '</div>';
      }
      if (opts.items) {
        html += '<div class="items">' + opts.items.map((it, i) =>
          '<button data-i="' + i + '">' + (it.icon ? '<span class="material-symbols-outlined" style="color:' + (it.color || '#0D4A7A') + '">' + esc(it.icon) + '</span>' : '') +
          '<span>' + esc(it.label) + (it.sub ? '<small>' + esc(it.sub) + '</small>' : '') + '</span></button>').join('') + '</div>';
      }
      const actions = opts.actions || [{ label: 'Vazgeç', value: null }];
      html += '<div class="actions">' + actions.map((a, i) =>
        '<button data-k="' + i + '" class="' + (a.main ? 'main' : '') + (a.danger ? ' danger' : '') + '">' + esc(a.label) + '</button>').join('') + '</div>';
      html += '</div>';
      wrap.innerHTML = html;
      const finish = value => {
        wrap.remove();
        dialogDone = null;
        resolve(value);
      };
      dialogDone = () => finish(null);
      const checked = (opts.checks || []).map(c => !!c.on);
      wrap.addEventListener('click', ev => {
        if (ev.target === wrap) return finish(null);
        const check = ev.target.closest('[data-c]');
        if (check) {
          const i = +check.dataset.c;
          checked[i] = !checked[i];
          check.querySelector('[data-ci]').textContent = checked[i] ? 'check_box' : 'check_box_outline_blank';
          return;
        }
        const item = ev.target.closest('[data-i]');
        if (item) return finish(opts.items[+item.dataset.i].value);
        const act = ev.target.closest('[data-k]');
        if (act) {
          const a = actions[+act.dataset.k];
          if (a.value === 'ok' && (opts.input || opts.checks || opts.fields)) {
            const input = document.getElementById('dialog-input');
            const values = {};
            (opts.fields || []).forEach((f, i) => { values[f.key] = wrap.querySelector('[data-fi="' + i + '"]').value; });
            return finish({ ok: true, text: input ? input.value : '', values, checks: checked });
          }
          return finish(a.value);
        }
      });
      document.body.appendChild(wrap);
      const input = document.getElementById('dialog-input') || wrap.querySelector('[data-fi="0"]');
      if (input && input.tagName === 'INPUT') setTimeout(() => { input.focus(); input.select(); }, 50);
    });
  }

  function closeDialog() {
    if (!dialogDone) return false;
    dialogDone();
    return true;
  }

  /** Onay: güvenli seçenek ana düğmedir; [danger] seçilirse true döner. */
  async function confirmDanger(title, message, danger) {
    const v = await dialog({ title, message, actions: [{ label: danger, value: true, danger: true }, { label: 'Vazgeç', value: false, main: true }] });
    return v === true;
  }

  /** Uzun işlem sırasında gösterilen bekleme perdesi. */
  function busy(text) {
    let el = document.getElementById('busy');
    if (text === false) {
      if (el) el.remove();
      return;
    }
    if (!el) {
      el = document.createElement('div');
      el.id = 'busy';
      el.innerHTML = '<div><div class="spin"></div><span></span></div>';
      document.body.appendChild(el);
    }
    el.querySelector('span').textContent = text || 'Lütfen bekleyin…';
  }

  /** Arayüz bir kare çizsin diye bekler (uzun işlemden önce bekleme perdesi görünsün). */
  function frame() {
    return new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  }

  // ---- Yerelden gelen olaylar ----

  function emit(type, data) {
    if (type === 'fix') {
      App.fix = data;
      if (App.oturum) App.oturum.konum(data);
    }
    if (type === 'notice') {
      dialog({ message: data.text, actions: [{ label: 'Tamam', value: true, main: true }] });
      return;
    }
    if (type === 'toast') {
      toast(data.text);
      return;
    }
    if (type === 'pause') {
      if (App.oturum) App.oturum.bekleyenleriYaz();
      return;
    }
    const inst = top();
    if (!inst) return;
    const c = inst.ctrl;
    if (type === 'fix' && c.fix) c.fix(inst, data);
    else if (c.event) c.event(inst, type, data);
    // Yığında aşağıda kalan ekranların da bilmesi gereken olaylar
    if (type === 'veri' || type === 'photo' || type === 'status') {
      stack.slice().forEach(s => { if (s !== inst && !s.closed && s.ctrl.event) s.ctrl.event(s, type, data); });
    }
  }

  // ---- Başlangıç ----

  function screen(id, ctrl) { controllers[id] = ctrl; }

  function start() {
    const info = api('app.init') || {};
    App.version = info.version || '';
    App.kaynak = info.source || 'bt';
    App.katalogJson = loadJson('../katalog/kalemler.json') || { kalemler: [] };
    App.katsayilar = SH.katsayiHazirla(loadJson('../katalog/katsayilar.json'));
    const hash = location.hash.slice(1);
    if (hash.startsWith('raw=')) {
      const id = hash.slice(4);
      controllers[id] = {};
      push(id);
      return;
    }
    let opened = false;
    if (info.lastProject) opened = App.oturum.ac(info.lastProject, true);
    if (hash.startsWith('go=')) {
      // Önizleme: go=ekran[&params={...}]
      const q = new URLSearchParams(hash);
      root(opened ? 'ana' : 'projeler');
      push(q.get('go'), JSON.parse(q.get('params') || '{}'));
      return;
    }
    root(opened ? 'ana' : 'projeler');
  }

  window.App = {
    api, loadJson, screen, start, push, pop, replace, root, remove, back, top, takeResult,
    set, setAll, show: showEl, val, swap, esc, fmt, num, make, fillFields, telemetry, chipKind, fixLabel,
    toast, dialog, confirmDanger, closeDialog, busy, frame, emit,
    fix: null, globals: {}
  };
})();
