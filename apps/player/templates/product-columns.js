// Products in columns: a tall photo of each service with its name and price.
// With more services than columns, each loop shows the next page.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  function layout(slide, ctx) {
    var portrait = ctx.screen.orientation === 'portrait';
    var cols = Math.min(Math.max(slide.slots.columns || 4, 2), 5);
    // A vertical screen stacks two rows of at most three columns.
    return portrait ? { cols: Math.min(cols, 3), rows: 2 } : { cols: cols, rows: 1 };
  }

  V.productColumn = function (service, fit) {
    return h('article', { class: 'product anim' + (service.available ? '' : ' is-unavailable') },
      h('div', { class: 'product-media' },
        service.image ? V.photo(service.image, fit) : h('div', { class: 'product-icon' }, V.icon(service.icon)),
        V.offerSeal(service, 'product-seal'),
        service.badge ? h('span', { class: 'badge product-badge' }, service.badge) : null),
      h('div', { class: 'product-body' },
        h('h2', { class: 'product-name' }, service.name),
        service.description ? h('p', { class: 'product-text' }, service.description) : null,
        service.duration ? h('span', { class: 'card-duration' }, service.duration) : null,
        service.available ? V.servicePrice(service) : h('span', { class: 'menu-na' }, 'No disponible')));
  };

  V.registerTemplate('product-columns', {
    pages: function (slide, ctx) {
      var l = layout(slide, ctx);
      return Math.ceil((slide.data.services || []).length / (l.cols * l.rows)) || 1;
    },
    render: function (slide, ctx) {
      var l = layout(slide, ctx);
      var page = V.page(slide.data.services || [], l.cols * l.rows, ctx.cycle);
      var cols = Math.min(l.cols, Math.max(page.items.length, 1));
      var rows = Math.ceil(page.items.length / cols);
      return h('div', { class: 'tpl tpl-products' },
        V.heading(slide.slots),
        h('div', {
          class: 'products-grid',
          style: 'grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr)',
        }, page.items.map(function (s) { return V.productColumn(s, slide.slots.fit); })),
        V.pager(page));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
