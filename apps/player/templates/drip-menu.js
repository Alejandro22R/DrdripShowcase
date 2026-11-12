// Drip menu: elegant list in one or two columns with name, duration and price.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.menuRow = function (service, showDuration) {
    return h('li', { class: 'menu-row anim' + (service.available ? '' : ' is-unavailable') },
      h('span', { class: 'menu-name' },
        service.name,
        service.badge ? h('span', { class: 'badge' }, service.badge) : null,
        showDuration && service.duration ? h('span', { class: 'menu-duration' }, service.duration) : null),
      h('span', { class: 'menu-dots' }),
      service.available ? V.price(service.price) : h('span', { class: 'menu-na' }, 'No disponible'));
  };

  V.registerTemplate('drip-menu', {
    render: function (slide, ctx) {
      var services = slide.data.services || [];
      var portrait = ctx.screen.orientation === 'portrait';
      var columns = portrait ? 1 : Math.min(Math.max(slide.slots.columns || 2, 1), 2);
      var durations = services.map(function (s) { return s.duration; });
      var same = durations.every(function (d) { return d === durations[0]; });
      var slots = slide.slots;
      // When every item lasts the same, say it once instead of on every row.
      if (same && durations[0] && !slots.subtitle) slots = Object.assign({}, slots, { subtitle: durations[0] + ' cada una' });

      return h('div', { class: 'tpl tpl-menu' },
        V.heading(slots, 'Menú'),
        h('div', { class: 'menu-columns cols-' + columns },
          V.chunk(services, columns).map(function (group) {
            return h('ul', { class: 'menu-list' }, group.map(function (s) { return V.menuRow(s, !same); }));
          })));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
