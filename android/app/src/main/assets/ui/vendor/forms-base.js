// @tailwindcss/forms (0.5.10) taban kuralları; yalnız Stitch'te bu eklentiyle tasarlanan ekranlarda
// (body[data-forms]) geçerlidir. Diğer ekranlarda giriş kutuları eklentisiz tasarlandığı için
// çerçevesiz kalır. Kurallar Tailwind'in taban katmanına eklenir (tw-config.js).
(function () {
  'use strict';
  const S = ':where(body[data-forms]) ';
  const TEXT = ["[type='text']", 'input:where(:not([type]))', "[type='email']", "[type='url']", "[type='password']",
    "[type='number']", "[type='date']", "[type='datetime-local']", "[type='month']", "[type='search']", "[type='tel']",
    "[type='time']", "[type='week']", '[multiple]', 'textarea', 'select'];
  const scope = list => list.map(x => S + x).join(',');
  const focusRing = (offset, width) => ({
    outline: '2px solid transparent',
    'outline-offset': '2px',
    '--tw-ring-inset': 'var(--tw-empty,/*!*/ /*!*/)',
    '--tw-ring-offset-width': offset,
    '--tw-ring-offset-color': '#fff',
    '--tw-ring-color': '#2563eb',
    '--tw-ring-offset-shadow': 'var(--tw-ring-inset) 0 0 0 var(--tw-ring-offset-width) var(--tw-ring-offset-color)',
    '--tw-ring-shadow': 'var(--tw-ring-inset) 0 0 0 calc(' + width + ' + var(--tw-ring-offset-width)) var(--tw-ring-color)',
    'box-shadow': 'var(--tw-ring-offset-shadow), var(--tw-ring-shadow), var(--tw-shadow)'
  });
  const check = "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3e%3c/svg%3e\")";
  const dot = "url(\"data:image/svg+xml,%3csvg viewBox='0 0 16 16' fill='white' xmlns='http://www.w3.org/2000/svg'%3e%3ccircle cx='8' cy='8' r='3'/%3e%3c/svg%3e\")";
  const chevron = "url(\"data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e\")";
  window.FORMS_BASE = {
    [scope(TEXT)]: {
      '-webkit-appearance': 'none', appearance: 'none', 'background-color': '#fff', 'border-color': '#6b7280',
      'border-width': '1px', 'border-radius': '0px', 'padding-top': '0.5rem', 'padding-right': '0.75rem',
      'padding-bottom': '0.5rem', 'padding-left': '0.75rem', 'font-size': '1rem', 'line-height': '1.5rem', '--tw-shadow': '0 0 #0000'
    },
    [TEXT.map(x => S + x + ':focus').join(',')]: Object.assign(focusRing('0px', '1px'), { 'border-color': '#2563eb' }),
    [S + 'input::placeholder,' + S + 'textarea::placeholder']: { color: '#6b7280', opacity: '1' },
    [S + 'select']: {
      'background-image': chevron, 'background-position': 'right 0.5rem center', 'background-repeat': 'no-repeat',
      'background-size': '1.5em 1.5em', 'padding-right': '2.5rem', 'print-color-adjust': 'exact'
    },
    [S + "[type='checkbox']," + S + "[type='radio']"]: {
      '-webkit-appearance': 'none', appearance: 'none', padding: '0', 'print-color-adjust': 'exact', display: 'inline-block',
      'vertical-align': 'middle', 'background-origin': 'border-box', 'user-select': 'none', 'flex-shrink': '0',
      height: '1rem', width: '1rem', color: '#2563eb', 'background-color': '#fff', 'border-color': '#6b7280',
      'border-width': '1px', '--tw-shadow': '0 0 #0000'
    },
    [S + "[type='checkbox']"]: { 'border-radius': '0px' },
    [S + "[type='radio']"]: { 'border-radius': '100%' },
    [S + "[type='checkbox']:focus," + S + "[type='radio']:focus"]: focusRing('2px', '2px'),
    [S + "[type='checkbox']:checked," + S + "[type='radio']:checked"]: {
      'border-color': 'transparent', 'background-color': 'currentColor', 'background-size': '100% 100%',
      'background-position': 'center', 'background-repeat': 'no-repeat'
    },
    [S + "[type='checkbox']:checked"]: { 'background-image': check },
    [S + "[type='radio']:checked"]: { 'background-image': dot }
  };
})();
