// Benefits of the infusion, each with an icon picked from its wording.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  var KEYWORDS = [
    [/absorci|rápid|rapid/i, 'bolt'],
    [/personaliz|necesidad/i, 'user'],
    [/sangu|torrente|directo/i, 'pulse'],
    [/hidrat/i, 'drop'],
    [/efectos|segur|mínim|minim/i, 'shield'],
  ];

  function iconFor(text) {
    for (var i = 0; i < KEYWORDS.length; i++) if (KEYWORDS[i][0].test(text)) return KEYWORDS[i][1];
    return 'sparkle';
  }

  V.registerTemplate('benefits', {
    render: function (slide) {
      var items = slide.data.items || [];
      return h('div', { class: 'tpl tpl-benefits' },
        V.heading(slide.slots, 'Beneficios'),
        h('div', { class: 'benefits-row count-' + Math.min(items.length, 6) }, items.map(function (text) {
          return h('div', { class: 'benefit anim' },
            h('div', { class: 'benefit-icon' }, V.icon(iconFor(text))),
            h('p', { class: 'benefit-text' }, text));
        })));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
