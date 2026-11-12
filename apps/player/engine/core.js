// Player engine: reads the published JSON and renders slides with templates.
// Templates register themselves with Vitrina.registerTemplate(), so adding a
// template never requires touching this file.
(function (root) {
  'use strict';
  var V = (root.Vitrina = root.Vitrina || {});
  var h = V.h;

  V.templates = {};

  /**
   * def.render(slide, ctx) returns an element. Optional: def.pages(slide, ctx)
   * for templates that paginate, def.fullBleed to hide the header.
   */
  V.registerTemplate = function (id, def) {
    V.templates[id] = def;
  };

  V.DEFAULT_BRAND = {
    name: 'DrDrip',
    descriptor: 'Medical Aesthetics and Wellness',
    tagline: 'Tu bienestar, nuestra especialidad.',
    phrases: [],
    clinic_hours: {},
    logo: '',
    logo_size: 100,
    transition_logo_size: 100,
    photo_size: 100,
    ticker_seconds: 8,
    show_welcome: true,
  };

  V.fallbackSlide = function (theme) {
    return { key: 'fallback', template: 'brand-cover', theme: theme || 'dark', duration_s: 15, transition: 'fade', slots: {}, data: {}, empty: false };
  };

  /**
   * Renders one slide. A slide that is empty, uses an unknown template or
   * fails while rendering falls back to the brand cover, so a screen never
   * shows a blank or broken page.
   */
  V.renderSlide = function (slide, ctx) {
    var def = slide.empty ? null : V.templates[slide.template];
    var content = null;
    if (def) {
      try {
        content = def.render(slide, ctx);
      } catch (err) {
        content = null;
        if (root.console) root.console.error('Template "' + slide.template + '" failed', err);
      }
    }
    if (!content) {
      def = V.templates['brand-cover'];
      content = def.render(V.fallbackSlide(slide.theme), ctx);
    }
    var section = h('section', { class: 'slide theme-' + slide.theme + (def.fullBleed ? ' is-full' : ''), 'data-key': slide.key }, content);
    var anims = section.querySelectorAll('.anim');
    for (var i = 0; i < anims.length; i++) anims[i].style.animationDelay = Math.min(i * 55, 1400) + 'ms';
    return { el: section, fullBleed: !!def.fullBleed };
  };

  /** Number of pages a slide rotates through on successive loops. */
  V.slidePages = function (slide, ctx) {
    var def = slide.empty ? null : V.templates[slide.template];
    if (!def || !def.pages) return 1;
    try {
      return def.pages(slide, ctx) || 1;
    } catch (err) {
      return 1;
    }
  };

  /** Shrinks the content until it fits its slide: long menus and names never overflow. */
  V.fit = function (section) {
    var tpl = section.querySelector('.tpl');
    if (!tpl) return 1;
    var scale = 1;
    tpl.style.fontSize = '';
    for (var i = 0; i < 16; i++) {
      if (tpl.scrollHeight <= tpl.clientHeight + 1 && tpl.scrollWidth <= tpl.clientWidth + 1) break;
      scale -= 0.04;
      tpl.style.fontSize = scale + 'em';
    }
    return scale;
  };

  function imagesOf(slide) {
    var urls = [];
    var push = function (u) { if (u) urls.push(u); };
    (slide.data.services || []).forEach(function (s) { push(s.image); });
    if (slide.data.promo) push(slide.data.promo.image);
    push(slide.slots.image);
    (slide.slots.people || []).forEach(function (p) { push(p.image); });
    return urls;
  }

  // -------------------------------------------------------------------------

  function Player(opts) {
    this.opts = opts;
    this.stage = opts.stage;
    this.screenId = opts.screenId;
    this.preview = !!opts.draft;
    this.fixedKey = opts.slideKey || null;
    this.payload = null;
    this.current = null; // { slide, el, etag, page }
    this.cycles = {};
    this.timer = null;
    this.busy = false;
    this.quality = opts.quality || 'alta';
    this.storage = opts.storage || null;
  }

  Player.prototype.ctx = function (slide) {
    var payload = this.payload;
    return {
      brand: payload ? payload.brand : V.DEFAULT_BRAND,
      screen: { orientation: this.portrait ? 'portrait' : 'landscape', name: payload ? payload.screen.name : '' },
      cycle: (slide && this.cycles[slide.key]) || 0,
    };
  };

  Player.prototype.start = function () {
    var self = this;
    this.build();
    this.layout();
    root.addEventListener('resize', function () { self.layout(); if (self.current) V.fit(self.current.el); });
    this.setQuality(this.quality);

    this.load(function () {
      var brand = self.payload ? self.payload.brand : V.DEFAULT_BRAND;
      var welcome = !self.preview && brand.show_welcome !== false && self.quality !== 'baja';
      if (welcome) self.welcome(function () { self.advance(); });
      else self.advance();
      if (!self.opts.quality && !self.preview) self.measure();
    });

    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { self.refit(); });
    this.connect();
    // Safety net: catches a missed notice, a date change or a promo that just expired.
    setInterval(function () { self.load(); }, 60000);
    setInterval(function () { self.tickClock(); }, 10000);
  };

  Player.prototype.build = function () {
    var stage = this.stage;
    stage.textContent = '';
    this.el = {
      bg: h('div', { class: 'bg' }, h('div', { class: 'bg-glow' }), V.symbol('bg-drop')),
      header: h('header', { class: 'chrome chrome-header' }),
      slides: h('main', { class: 'slides' }),
      footer: h('footer', { class: 'chrome chrome-footer' }),
      curtain: h('div', { class: 'curtain' }, h('div', { class: 'curtain-logo' })),
      notice: h('div', { class: 'notice' }),
      status: h('div', { class: 'status', title: 'Sin conexión con el servidor' }),
    };
    var el = this.el;
    ['bg', 'header', 'slides', 'footer', 'curtain', 'notice', 'status'].forEach(function (k) { stage.appendChild(el[k]); });
  };

  /** Sizes the stage so that 1em is 1 % of the long side, at any resolution. */
  Player.prototype.layout = function () {
    var w = root.innerWidth;
    var hgt = root.innerHeight;
    var wantPortrait = this.payload && this.payload.screen.orientation === 'portrait';
    // A TV mounted vertically whose browser still reports landscape gets rotated.
    var rotate = wantPortrait && w > hgt && !this.preview;
    var sw = rotate ? hgt : w;
    var sh = rotate ? w : hgt;
    this.portrait = sh > sw;
    var unit = this.portrait ? Math.min(sw / 56.25, sh / 100) : Math.min(sw / 100, sh / 56.25);
    var s = this.stage.style;
    s.width = sw + 'px';
    s.height = sh + 'px';
    s.fontSize = unit + 'px';
    s.transform = rotate ? 'translate(-50%, -50%) rotate(90deg)' : 'translate(-50%, -50%)';
    this.stage.classList.toggle('is-portrait', this.portrait);
  };

  Player.prototype.setQuality = function (quality) {
    this.quality = quality;
    var list = this.stage.classList;
    list.remove('q-alta', 'q-media', 'q-baja');
    list.add('q-' + quality);
  };

  /** Counts frames for a few seconds and lowers the quality on slow screens. */
  Player.prototype.measure = function () {
    var self = this;
    var raf = root.requestAnimationFrame;
    if (!raf) return;
    var frames = 0;
    var start = 0;
    var step = function (now) {
      if (!start) start = now;
      frames++;
      if (now - start < 4000) return raf(step);
      var fps = (frames * 1000) / (now - start);
      if (fps < 22) self.setQuality('baja');
      else if (fps < 42) self.setQuality('media');
    };
    setTimeout(function () { raf(step); }, 6000);
  };

  // --- Data -------------------------------------------------------------------

  Player.prototype.cacheKey = function () { return 'vitrina.payload.' + this.screenId; };

  Player.prototype.load = function (done) {
    var self = this;
    var url = '/api/player/' + this.screenId + (this.preview ? '?draft=1&token=' + encodeURIComponent(this.opts.token || '') : '');
    var finish = function () { if (done) { var d = done; done = null; d(); } };

    root.fetch(url, { cache: 'no-store' })
      .then(function (res) {
        if (res.status === 404) { self.note('La pantalla ' + self.screenId + ' no existe. Revisa la dirección o créala en el panel.'); return null; }
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (payload) {
        if (payload) { self.note(''); self.accept(payload, true); }
        finish();
      })
      .catch(function () {
        // Server unreachable: keep showing the last published version.
        if (!self.payload && self.storage && !self.preview) {
          try {
            var cached = JSON.parse(self.storage.getItem(self.cacheKey()) || 'null');
            if (cached && cached.slides) self.accept(cached, false);
          } catch (err) { /* corrupt cache: ignore */ }
        }
        finish();
      });
  };

  Player.prototype.accept = function (payload, fresh) {
    var changed = !this.payload || this.payload.etag !== payload.etag;
    if (!changed) return;
    this.payload = payload;
    if (fresh && this.storage && !this.preview) {
      try { this.storage.setItem(this.cacheKey(), JSON.stringify(payload)); } catch (err) { /* storage full */ }
    }
    this.layout();
    this.chrome();
    // In the builder preview, show the edit right away instead of waiting a turn.
    if (this.preview && this.current) this.advance(true);
    else if (this.current) this.refit();
  };

  /** Fits the visible slide again after fonts or images change its size. */
  Player.prototype.refit = function () {
    if (this.current && this.current.el.parentNode) V.fit(this.current.el);
  };

  Player.prototype.note = function (text) {
    this.el.notice.textContent = text;
    this.el.notice.classList.toggle('is-visible', !!text);
  };

  // --- Header, footer, clock and rotating messages ------------------------------

  Player.prototype.chrome = function () {
    var p = this.payload;
    var brand = p.brand;
    var el = this.el;
    var self = this;

    el.header.textContent = '';
    el.header.appendChild(h('div', { class: 'brandmark', style: 'font-size:' + (brand.logo_size || 100) / 100 + 'em' },
      V.logo(brand, 'brandmark-symbol'),
      h('div', { class: 'brandmark-text' },
        V.brandName(brand, 'brandmark-name'),
        h('span', { class: 'brandmark-descriptor' }, brand.descriptor))));
    this.clockEl = p.screen.show_clock ? h('div', { class: 'clock' }) : null;
    if (this.clockEl) el.header.appendChild(this.clockEl);
    this.tickClock();

    el.footer.textContent = '';
    this.tickerEl = h('div', { class: 'ticker' });
    el.footer.appendChild(this.tickerEl);
    el.footer.appendChild(h('div', { class: 'contact' },
      brand.phone ? h('span', { class: 'contact-item' }, V.icon('phone'), brand.phone) : null,
      brand.instagram ? h('span', { class: 'contact-item' }, brand.instagram) : null));

    el.curtain.firstChild.textContent = '';
    el.curtain.firstChild.style.fontSize = (brand.transition_logo_size || 100) / 100 + 'em';
    el.curtain.firstChild.appendChild(V.logo(brand, 'curtain-symbol'));

    this.stage.classList.toggle('hide-header', !p.screen.show_header);
    this.stage.classList.toggle('hide-footer', !p.screen.show_footer);

    this.messages = p.screen.ticker.concat([brand.hours_text, brand.address]).filter(Boolean);
    this.messageIndex = -1;
    clearInterval(this.tickerTimer);
    this.rotateMessage();
    if (this.messages.length > 1) {
      this.tickerTimer = setInterval(function () { self.rotateMessage(); }, Math.max(brand.ticker_seconds || 8, 3) * 1000);
    }
  };

  Player.prototype.rotateMessage = function () {
    var el = this.tickerEl;
    if (!el || !this.messages.length) return;
    this.messageIndex = (this.messageIndex + 1) % this.messages.length;
    var text = this.messages[this.messageIndex];
    if (this.quality === 'baja' || !el.textContent) { el.textContent = text; return; }
    el.classList.add('is-changing');
    setTimeout(function () {
      el.textContent = text;
      el.classList.remove('is-changing');
    }, 600);
  };

  Player.prototype.tickClock = function () {
    if (!this.clockEl) return;
    var c = V.formatClock(new Date());
    this.clockEl.textContent = '';
    this.clockEl.appendChild(h('span', { class: 'clock-time' }, c.time, h('small', null, ' ' + c.suffix)));
    this.clockEl.appendChild(h('span', { class: 'clock-date' }, c.date));
  };

  // --- Slide loop -----------------------------------------------------------------

  Player.prototype.pick = function () {
    var p = this.payload;
    var theme = p ? p.screen.theme : 'dark';
    if (!p) return { slide: V.fallbackSlide(theme), count: 1 };
    var list = V.activeSlides(p.slides, p.brand.clinic_hours, new Date());
    if (this.fixedKey) {
      var key = this.fixedKey;
      var only = p.slides.filter(function (s) { return s.key === key; });
      if (only.length) list = only;
    }
    if (!list.length) return { slide: V.fallbackSlide(theme), count: 1 };
    var index = -1;
    if (this.current) {
      for (var i = 0; i < list.length; i++) if (list[i].key === this.current.slide.key) index = i;
    }
    var next = list[(index + 1) % list.length];
    return { slide: next, count: list.length, after: list[(index + 2) % list.length] };
  };

  /** Shows the next slide. `refresh` re-renders the current one (builder preview). */
  Player.prototype.advance = function (refresh) {
    var self = this;
    if (this.busy) {
      // A curtain is mid-way: a preview refresh waits for it instead of being lost.
      if (refresh) setTimeout(function () { self.advance(true); }, 1200);
      return;
    }
    clearTimeout(this.timer);

    var picked = this.pick();
    var slide = picked.slide;
    if (refresh) {
      // Stay on the slide being edited (or the one the builder asked for).
      var wanted = this.fixedKey || (this.current ? this.current.slide.key : null);
      var same = (this.payload ? this.payload.slides : []).filter(function (s) { return s.key === wanted; });
      if (same.length) slide = same[0];
    }

    var ctx = this.ctx(slide);
    var pages = V.slidePages(slide, ctx);
    var etag = this.payload ? this.payload.etag : '';
    var unchanged = this.current && this.current.slide.key === slide.key && this.current.etag === etag && pages <= 1;

    var schedule = function () {
      self.timer = setTimeout(function () { self.advance(); }, Math.max(slide.duration_s || 12, 3) * 1000);
    };
    if (unchanged) return schedule(); // single static slide: leave it on screen

    var rendered = V.renderSlide(slide, ctx);
    this.cycles[slide.key] = ((this.cycles[slide.key] || 0) + 1) % 1000000;
    this.el.slides.appendChild(rendered.el);
    // Photos change the height once they load.
    var imgs = rendered.el.querySelectorAll('img');
    for (var n = 0; n < imgs.length; n++) imgs[n].addEventListener('load', function () { self.refit(); });

    var previous = this.current;
    this.current = { slide: slide, el: rendered.el, etag: etag };
    var swap = function () {
      self.stage.className = self.stage.className.replace(/\btheme-\w+/g, '').trim() + ' theme-' + slide.theme;
      self.stage.classList.toggle('is-full', rendered.fullBleed);
      // Fit only now: the header may have just appeared or gone, changing the room available.
      V.fit(rendered.el);
      rendered.el.classList.add('is-active');
    };
    var drop = function () {
      if (previous && previous.el.parentNode) previous.el.parentNode.removeChild(previous.el);
    };

    var kind = refresh || !previous || this.quality === 'baja' ? 'none' : slide.transition;
    if (kind === 'curtain') {
      this.busy = true;
      var curtain = this.el.curtain;
      curtain.className = 'curtain is-in';
      setTimeout(function () {
        drop();
        swap();
        curtain.className = 'curtain is-out';
        setTimeout(function () { curtain.className = 'curtain'; self.busy = false; }, 900);
      }, 1100);
    } else if (kind === 'fade') {
      previous.el.classList.add('is-leaving');
      previous.el.classList.remove('is-active');
      swap();
      setTimeout(drop, 1000);
    } else {
      drop();
      swap();
    }

    // Warm the cache for the slide that comes next.
    if (picked.after && picked.after !== slide) {
      imagesOf(picked.after).forEach(function (url) { var img = new root.Image(); img.src = url; });
    }
    schedule();
  };

  // --- Brand welcome ---------------------------------------------------------------

  Player.prototype.welcome = function (done) {
    var brand = this.payload ? this.payload.brand : V.DEFAULT_BRAND;
    var theme = this.payload ? this.payload.screen.theme : 'dark';
    var letters = String(brand.descriptor || '').split('').map(function (ch, i) {
      return h('span', { style: 'animation-delay:' + (1200 + i * 45) + 'ms' }, ch === ' ' ? ' ' : ch);
    });
    var overlay = h('div', { class: 'welcome theme-' + theme },
      h('div', { class: 'welcome-logo' }, V.logo(brand, 'welcome-symbol')),
      V.brandName(brand, 'welcome-name'),
      h('div', { class: 'welcome-descriptor' }, letters),
      V.rule('welcome-rule'));
    this.stage.appendChild(overlay);
    var total = 1200 + letters.length * 45 + 2200;
    setTimeout(function () {
      done();
      overlay.classList.add('is-leaving');
      setTimeout(function () { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }, 1200);
    }, total);
  };

  // --- Live connection ---------------------------------------------------------------

  Player.prototype.connect = function () {
    var self = this;
    if (!root.WebSocket) return;
    var delay = this.retry || 1000;
    var socket;
    try {
      socket = new root.WebSocket((root.location.protocol === 'https:' ? 'wss://' : 'ws://') + root.location.host + '/ws');
    } catch (err) {
      return;
    }
    socket.onopen = function () {
      self.retry = 1000;
      self.stage.classList.remove('is-offline');
      socket.send(JSON.stringify({ type: 'hello', deviceId: self.opts.deviceId || '', screenId: self.screenId, preview: self.preview }));
      self.load(); // catch up on anything published while disconnected
    };
    socket.onmessage = function (ev) {
      var msg;
      try { msg = JSON.parse(ev.data); } catch (err) { return; }
      if (msg.type === 'update') self.load();
      else if (msg.type === 'reload') root.location.reload();
      else if ((msg.type === 'assign' || msg.type === 'hello') && msg.screenId && msg.screenId !== self.screenId && !self.preview) {
        root.location.href = '/' + msg.screenId;
      }
    };
    socket.onclose = function () {
      self.stage.classList.add('is-offline');
      self.retry = Math.min(delay * 2, 30000);
      setTimeout(function () { self.connect(); }, delay);
    };
    socket.onerror = function () { try { socket.close(); } catch (err) { /* ignore */ } };
  };

  V.Player = Player;
})(typeof window !== 'undefined' ? window : globalThis);
