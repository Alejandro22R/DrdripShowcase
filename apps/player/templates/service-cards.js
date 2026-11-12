// Service cards: a grid from 2x2 to 4x3 with icon or photo, name, text and price.
// When there are more services than cells, each loop shows the next page.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.serviceCard = function (service, brand) {
    var media = service.image
      ? h('div', { class: 'card-photo', style: 'font-size:' + (brand.photo_size || 100) / 100 + 'em' }, h('img', { src: service.image, alt: '' }))
      : h('div', { class: 'card-icon' }, V.icon(service.icon));
    return h('article', { class: 'card anim' + (service.available ? '' : ' is-unavailable') },
      service.badge ? h('span', { class: 'badge card-badge' }, service.badge) : null,
      V.offerSeal(service, 'card-seal'),
      media,
      h('h2', { class: 'card-name' }, service.name),
      service.description ? h('p', { class: 'card-text' }, service.description) : null,
      h('div', { class: 'card-foot' },
        service.duration ? h('span', { class: 'card-duration' }, service.duration) : null,
        service.available ? V.servicePrice(service) : h('span', { class: 'menu-na' }, 'No disponible')));
  };

  V.registerTemplate('service-cards', {
    pages: function (slide, ctx) {
      var grid = parseGrid(slide.slots.grid, ctx);
      return Math.ceil((slide.data.services || []).length / (grid.cols * grid.rows)) || 1;
    },
    render: function (slide, ctx) {
      var grid = parseGrid(slide.slots.grid, ctx);
      var services = slide.data.services || [];
      var perPage = grid.cols * grid.rows;
      var pages = Math.ceil(services.length / perPage) || 1;
      var page = ctx.cycle % pages;
      var visible = services.slice(page * perPage, page * perPage + perPage);
      // Fewer items than columns: centre them instead of leaving a hole.
      var cols = Math.min(grid.cols, Math.max(visible.length, 1));
      var rows = Math.ceil(visible.length / cols);
      return h('div', { class: 'tpl tpl-cards' },
        V.heading(slide.slots),
        h('div', {
          class: 'cards-grid',
          style: 'grid-template-columns:repeat(' + cols + ',1fr);grid-template-rows:repeat(' + rows + ',1fr)',
        }, visible.map(function (s) { return V.serviceCard(s, ctx.brand); })),
        pages > 1 ? h('div', { class: 'pager' }, (page + 1) + ' / ' + pages) : null);
    },
  });

  function parseGrid(value, ctx) {
    var m = /^(\d)x(\d)$/.exec(value || '3x2');
    var cols = m ? parseInt(m[1], 10) : 3;
    var rows = m ? parseInt(m[2], 10) : 2;
    // A vertical screen swaps the grid so cards stay readable.
    if (ctx.screen.orientation === 'portrait' && cols > rows) { var t = cols; cols = rows; rows = t; }
    return { cols: Math.min(Math.max(cols, 1), 4), rows: Math.min(Math.max(rows, 1), 4) };
  }
})(typeof window !== 'undefined' ? window : globalThis);
