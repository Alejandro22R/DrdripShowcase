// Team members or testimonials. Shown only with the client's permission.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('team', {
    pages: function (slide) { return Math.ceil((slide.slots.people || []).length / 4) || 1; },
    render: function (slide, ctx) {
      var people = slide.slots.people || [];
      var pages = Math.ceil(people.length / 4) || 1;
      var page = ctx.cycle % pages;
      var visible = people.slice(page * 4, page * 4 + 4);
      return h('div', { class: 'tpl tpl-team' },
        V.heading(slide.slots, 'Nuestro equipo'),
        h('div', { class: 'team-row' }, visible.map(function (p) {
          var initials = String(p.name || '').split(/\s+/).map(function (w) { return w.charAt(0); }).join('').slice(0, 2).toUpperCase();
          return h('article', { class: 'person anim' },
            h('div', { class: 'person-photo' }, p.image ? h('img', { src: p.image, alt: '' }) : h('span', null, initials)),
            p.quote ? h('p', { class: 'person-quote' }, '“' + p.quote + '”') : null,
            h('h2', { class: 'person-name' }, p.name),
            p.role ? h('p', { class: 'kicker person-role' }, p.role) : null);
        })));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
