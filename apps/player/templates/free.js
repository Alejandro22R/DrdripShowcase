// Free slide: any message as text, an image or a short muted video.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var h = V.h;

  V.registerTemplate('free', {
    render: function (slide) {
      var slots = slide.slots;
      var media = null;
      if (slots.video) {
        media = h('video', { class: 'free-media', src: slots.video, autoplay: true, loop: true, playsinline: true });
        media.muted = true; // required for autoplay on TVs
      } else if (slots.image) {
        media = h('img', { class: 'free-media', src: slots.image, alt: '' });
      }
      var hasText = slots.title || slots.body;
      var paragraphs = String(slots.body || '').split(/\n+/).filter(Boolean);
      return h('div', { class: 'tpl tpl-free' + (media ? ' has-media' : '') + (hasText ? '' : ' media-only') },
        media ? h('div', { class: 'free-media-wrap anim' }, media) : null,
        hasText
          ? h('div', { class: 'free-text' },
            slots.title ? h('h1', { class: 'title anim' }, slots.title) : null,
            slots.title ? V.rule('anim') : null,
            paragraphs.map(function (p) { return h('p', { class: 'free-body anim' }, p); }))
          : null);
    },
  });
})(typeof window !== 'undefined' ? window : globalThis);
