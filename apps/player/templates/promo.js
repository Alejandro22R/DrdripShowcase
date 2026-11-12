// Promotion / gift card banner with optional image and validity dates.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('promo', {
    render: function (slide) {
      var promo = slide.data.promo;
      return h('div', { class: 'tpl tpl-promo' + (promo.image ? ' has-image' : '') },
        promo.image ? h('div', { class: 'promo-image anim' }, h('img', { src: promo.image, alt: '' })) : null,
        h('div', { class: 'promo-frame' },
          promo.image ? null : h('div', { class: 'promo-icon anim' }, V.icon('gift')),
          h('h1', { class: 'title promo-title anim' }, promo.title),
          V.rule('anim'),
          promo.subtitle ? h('p', { class: 'promo-subtitle anim' }, promo.subtitle) : null,
          promo.validity ? h('p', { class: 'kicker promo-validity anim' }, promo.validity) : null));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
