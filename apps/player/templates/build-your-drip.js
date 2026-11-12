// Build your drip: base drips on one side, add-ins with their prices on the other.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('build-your-drip', {
    render: function (slide, ctx) {
      var services = slide.data.services || [];
      var addons = slide.data.addons || [];
      var portrait = ctx.screen.orientation === 'portrait';
      var columns = !portrait && services.length > 9 ? 2 : 1;
      return h('div', { class: 'tpl tpl-build' },
        V.heading(slide.slots, 'Arma tu Drip'),
        h('div', { class: 'build-panels' },
          h('section', { class: 'build-panel build-base' },
            h('h2', { class: 'step' }, h('span', { class: 'step-num' }, '1'), 'Elige tu drip'),
            h('div', { class: 'menu-columns cols-' + columns },
              V.chunk(services, columns).map(function (group) {
                return h('ul', { class: 'menu-list compact' }, group.map(function (s) { return V.menuRow(s, false); }));
              }))),
          addons.length
            ? h('section', { class: 'build-panel build-addons' },
              h('h2', { class: 'step' }, h('span', { class: 'step-num' }, '2'), 'Añade complementos'),
              h('ul', { class: 'menu-list compact' }, addons.map(function (a) {
                return h('li', { class: 'menu-row anim' },
                  h('span', { class: 'menu-name' }, a.name),
                  h('span', { class: 'menu-dots' }),
                  h('span', { class: 'price' }, h('span', { class: 'price-amount' }, '+ ' + a.price)));
              })))
            : null));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
