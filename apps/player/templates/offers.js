// Offers: services on sale with the old price struck through, the new price
// and the discount in a seal.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  function perPage(ctx) { return ctx.screen.orientation === 'portrait' ? 2 : 3; }

  V.registerTemplate('offers', {
    pages: function (slide, ctx) { return Math.ceil((slide.data.services || []).length / perPage(ctx)) || 1; },
    render: function (slide, ctx) {
      var page = V.page(slide.data.services || [], perPage(ctx), ctx.cycle);
      return h('div', { class: 'tpl tpl-offers' },
        V.heading(slide.slots, 'Ofertas'),
        h('div', { class: 'offers-row count-' + page.items.length }, page.items.map(function (s) {
          return h('article', { class: 'offer anim' + (s.available ? '' : ' is-unavailable') },
            V.offerSeal(s, 'offer-seal'),
            s.image ? V.photo(s.image, 'cover', 'offer-photo') : h('div', { class: 'offer-icon' }, V.icon(s.icon)),
            h('h2', { class: 'offer-name' }, s.name),
            s.description ? h('p', { class: 'offer-text' }, s.description) : null,
            s.available ? V.servicePrice(s, 'offer-price') : h('span', { class: 'menu-na' }, 'No disponible'),
            s.offer && s.offer.until ? h('p', { class: 'kicker offer-until' }, s.offer.until) : null);
        })),
        V.pager(page));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
