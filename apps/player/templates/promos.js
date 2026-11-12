// Promotions board: every promotion that is active today, side by side.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  function perPage(slide, ctx) {
    var cols = Math.min(Math.max(slide.slots.columns || 2, 1), 3);
    return ctx.screen.orientation === 'portrait' ? Math.min(cols, 2) : cols;
  }

  V.registerTemplate('promos', {
    pages: function (slide, ctx) { return Math.ceil((slide.data.promos || []).length / perPage(slide, ctx)) || 1; },
    render: function (slide, ctx) {
      var page = V.page(slide.data.promos || [], perPage(slide, ctx), ctx.cycle);
      return h('div', { class: 'tpl tpl-promos' },
        V.heading(slide.slots, 'Promociones'),
        h('div', { class: 'promos-row count-' + page.items.length }, page.items.map(function (p) {
          return h('article', { class: 'promo-card anim' + (p.image ? ' has-image' : '') },
            p.image ? V.photo(p.image, 'cover', 'promo-card-photo') : h('div', { class: 'promo-card-icon' }, V.icon('gift')),
            h('div', { class: 'promo-card-body' },
              h('h2', { class: 'promo-card-title' }, p.title),
              V.rule(),
              p.subtitle ? h('p', { class: 'promo-card-text' }, p.subtitle) : null,
              p.validity ? h('p', { class: 'kicker promo-card-validity' }, p.validity) : null));
        })),
        V.pager(page));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
