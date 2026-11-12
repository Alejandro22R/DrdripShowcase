// Featured service: one service full screen with its benefits and price.
// With several services chosen, each loop features the next one.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('featured-service', {
    pages: function (slide) { return (slide.data.services || []).length || 1; },
    render: function (slide, ctx) {
      var services = slide.data.services || [];
      var service = services[ctx.cycle % services.length];
      return h('div', { class: 'tpl tpl-featured' },
        h('div', { class: 'featured-text' },
          slide.slots.subtitle ? h('p', { class: 'kicker anim' }, slide.slots.subtitle) : null,
          h('h1', { class: 'title featured-name anim' }, service.name),
          V.rule('rule-left anim'),
          service.description ? h('p', { class: 'featured-desc anim' }, service.description) : null,
          service.benefits.length
            ? h('ul', { class: 'featured-benefits' }, service.benefits.map(function (b) {
              return h('li', { class: 'anim' }, h('span', { class: 'star' }, '✦'), b);
            }))
            : null),
        h('div', { class: 'featured-side anim' },
          service.image
            ? h('div', { class: 'featured-photo' }, h('img', { src: service.image, alt: '' }))
            : h('div', { class: 'featured-symbol' }, V.symbol()),
          service.badge ? h('span', { class: 'badge' }, service.badge) : null,
          service.duration ? h('div', { class: 'featured-duration' }, service.duration) : null,
          service.offer ? h('div', { class: 'featured-offer' }, V.offerSeal(service), service.offer.until ? h('span', { class: 'kicker' }, service.offer.until) : null) : null,
          service.available ? V.servicePrice(service, 'price-big') : h('span', { class: 'menu-na' }, 'No disponible')));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
