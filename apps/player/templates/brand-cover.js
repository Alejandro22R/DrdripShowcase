// Brand cover: logo, descriptor, gold rule and one of the brand phrases.
// Also used as the fallback whenever a slide has nothing to show.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('brand-cover', {
    fullBleed: true,
    render: function (slide, ctx) {
      var brand = ctx.brand;
      var phrases = (brand.phrases || []).concat(brand.tagline ? [brand.tagline] : []);
      var phrase = phrases.length ? phrases[ctx.cycle % phrases.length] : '';
      return h('div', { class: 'tpl tpl-cover' },
        h('div', { class: 'cover-logo anim', style: 'font-size:' + (brand.logo_size || 100) / 100 + 'em' }, V.logo(brand, 'cover-symbol')),
        h('div', { class: 'cover-name anim' }, brand.name),
        h('div', { class: 'cover-descriptor anim' }, brand.descriptor),
        V.rule('anim'),
        phrase ? h('div', { class: 'cover-phrase anim' }, phrase) : null);
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
