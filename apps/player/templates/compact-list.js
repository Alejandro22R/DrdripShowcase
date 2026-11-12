// Compact list for injectables and weight control, with "Desde" and "Consultar".
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('compact-list', {
    render: function (slide, ctx) {
      var services = slide.data.services || [];
      var portrait = ctx.screen.orientation === 'portrait';
      var columns = portrait ? 1 : Math.min(Math.max(slide.slots.columns || 1, 1), 2);
      return h('div', { class: 'tpl tpl-compact cols-' + columns },
        V.heading(slide.slots, 'Servicios'),
        h('div', { class: 'menu-columns cols-' + columns },
          V.chunk(services, columns).map(function (group) {
            return h('ul', { class: 'menu-list' }, group.map(function (s) { return V.menuRow(s, true); }));
          })));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
