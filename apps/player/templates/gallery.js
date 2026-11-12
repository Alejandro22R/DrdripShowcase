// Gallery of uploaded pictures: in columns, as a mosaic (one large picture
// and several small ones) or one at a time filling the slide.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  function images(slide) {
    return (slide.slots.images || []).filter(function (i) { return i && i.url; });
  }

  function perPage(slide, ctx) {
    var portrait = ctx.screen.orientation === 'portrait';
    var layout = slide.slots.layout || 'columns';
    if (layout === 'full') return 0; // rotates by itself inside the slide
    if (layout === 'mosaic') return 5;
    var cols = Math.min(Math.max(slide.slots.columns || 3, 2), 4);
    return portrait ? Math.min(cols, 2) * 2 : cols;
  }

  function figure(image, fit, className) {
    return h('figure', { class: 'gallery-item anim ' + (className || '') },
      V.photo(image.url, fit),
      image.caption ? h('figcaption', { class: 'gallery-caption' }, image.caption) : null);
  }

  /** Cross-fades through the pictures while the slide is on screen. */
  function slideshow(list, slide) {
    var frames = list.map(function (image, i) {
      return h('figure', { class: 'gallery-frame' + (i === 0 ? ' is-on' : '') },
        V.photo(image.url, slide.slots.fit),
        image.caption ? h('figcaption', { class: 'gallery-caption gallery-caption-big' }, image.caption) : null);
    });
    var stack = h('div', { class: 'gallery-stack anim' }, frames);
    if (frames.length > 1) {
      var current = 0;
      var every = Math.max(4000, Math.floor(((slide.duration_s || 12) * 1000) / frames.length));
      var timer = setInterval(function () {
        // The slide left the screen: stop, so no timer outlives its slide.
        if (!root.document || !root.document.body.contains(stack)) { clearInterval(timer); return; }
        frames[current].classList.remove('is-on');
        current = (current + 1) % frames.length;
        frames[current].classList.add('is-on');
      }, every);
    }
    return stack;
  }

  V.registerTemplate('gallery', {
    pages: function (slide, ctx) {
      var size = perPage(slide, ctx);
      return size ? Math.ceil(images(slide).length / size) || 1 : 1;
    },
    render: function (slide, ctx) {
      var list = images(slide);
      var layout = slide.slots.layout || 'columns';
      var fit = slide.slots.fit;
      var heading = slide.slots.title ? V.heading({ title: slide.slots.title }) : null;

      if (layout === 'full') return h('div', { class: 'tpl tpl-gallery gallery-full' }, heading, slideshow(list, slide));

      var page = V.page(list, perPage(slide, ctx), ctx.cycle);
      var body;
      if (layout === 'mosaic' && page.items.length > 1) {
        body = h('div', { class: 'gallery-mosaic count-' + page.items.length },
          figure(page.items[0], fit, 'gallery-lead'),
          h('div', { class: 'gallery-side' }, page.items.slice(1).map(function (image) { return figure(image, fit); })));
      } else {
        var portrait = ctx.screen.orientation === 'portrait';
        var cols = portrait ? Math.min(page.items.length, 2) : page.items.length;
        body = h('div', {
          class: 'gallery-columns',
          style: 'grid-template-columns:repeat(' + Math.max(cols, 1) + ',1fr);grid-template-rows:repeat(' + Math.ceil(page.items.length / Math.max(cols, 1)) + ',1fr)',
        }, page.items.map(function (image) { return figure(image, fit); }));
      }
      return h('div', { class: 'tpl tpl-gallery' }, heading, body, V.pager(page));
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
