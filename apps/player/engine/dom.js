// Tiny DOM helpers and the brand's icon set. Text always goes in through
// textContent, never innerHTML, so catalog text can never inject markup.
(function (root) {
  'use strict';
  var V = (root.Vitrina = root.Vitrina || {});
  var SVG_NS = 'http://www.w3.org/2000/svg';

  /** h('div', {class: 'x'}, child, 'text', [more]) */
  V.h = function (tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (key) {
        var value = attrs[key];
        if (value === null || value === undefined || value === false) return;
        if (key === 'class') el.className = value;
        else if (key === 'style') el.style.cssText = value;
        else el.setAttribute(key, value === true ? '' : value);
      });
    }
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  };

  function append(el, child) {
    if (child === null || child === undefined || child === false || child === '') return;
    if (Array.isArray(child)) child.forEach(function (c) { append(el, c); });
    else if (typeof child === 'string' || typeof child === 'number') el.appendChild(document.createTextNode(String(child)));
    else el.appendChild(child);
  }

  function svg(viewBox, className) {
    var el = document.createElementNS(SVG_NS, 'svg');
    el.setAttribute('viewBox', viewBox);
    el.setAttribute('class', className);
    el.setAttribute('aria-hidden', 'true');
    return el;
  }

  function path(d, attrs) {
    var el = document.createElementNS(SVG_NS, 'path');
    el.setAttribute('d', d);
    Object.keys(attrs || {}).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    return el;
  }

  /** The official DrDrip symbol: the drop takes the text colour, the leaf stays gold. */
  V.symbol = function (className) {
    var el = svg(V.ART.symbolBox, 'symbol ' + (className || ''));
    el.appendChild(path(V.ART.drop, { fill: 'currentColor', 'fill-rule': 'evenodd' }));
    el.appendChild(path(V.ART.leaf, { fill: '#C6A66B', 'fill-rule': 'evenodd' }));
    return el;
  };

  /**
   * Brand name: the official lettering while the name is still "DrDrip",
   * plain Bodoni text if the client ever renames the brand in the panel.
   */
  V.brandName = function (brand, className) {
    if (!brand || brand.name !== 'DrDrip') return V.h('div', { class: className + ' is-text' }, brand ? brand.name : '');
    var el = svg(V.ART.wordmarkBox, 'wordmark');
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', 'DrDrip');
    el.removeAttribute('aria-hidden');
    el.appendChild(path(V.ART.wordmark, { fill: 'currentColor', 'fill-rule': 'evenodd' }));
    return V.h('div', { class: className + ' is-wordmark' }, el);
  };

  /** Logo for headers and covers: the uploaded image, or the bundled symbol. */
  V.logo = function (brand, className) {
    if (brand && brand.logo) return V.h('img', { class: 'logo-img ' + (className || ''), src: brand.logo, alt: '' });
    return V.symbol(className);
  };

  // Line icons, 24x24, drawn with the current text colour.
  var ICONS = {
    drop: ['M12 3s-6.5 7.2-6.5 11.5a6.5 6.5 0 0 0 13 0C18.5 10.2 12 3 12 3Z', 'M9.5 15a2.7 2.7 0 0 0 2.5 2.5'],
    syringe: ['M17 3l4 4', 'M19 5l-2.5 2.5', 'M14.5 5.500l4 4', 'M16 8L7 17l-3 .5.5-3 9-9', 'M9 11l2 2', 'M11.5 8.500l2 2', 'M4 20l1.5-1.5'],
    stethoscope: ['M6 3v6a4 4 0 0 0 8 0V3', 'M4.5 3h3', 'M12.5 3h3', 'M10 13v3a4.5 4.5 0 0 0 9 0v-1.5', 'M19 14.500a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z'],
    scale: ['M5 4h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z', 'M8 9a5.5 5.5 0 0 1 8 0', 'M12 9.500l1.5-2'],
    sparkle: ['M12 3l1.8 5.200L19 10l-5.2 1.800L12 17l-1.8-5.200L5 10l5.2-1.800L12 3Z', 'M19 16l.7 1.8 1.8.7-1.8.700L19 21l-.7-1.8-1.8-.7 1.8-.700L19 16Z'],
    wave: ['M3 8c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 2-1.5 3-1.5', 'M3 13c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 2-1.5 3-1.5', 'M3 18c2.5-2.5 5-2.5 7.5 0s5 2.5 7.5 0 2-1.5 3-1.5'],
    gift: ['M4 11h16v9H4z', 'M3 7h18v4H3z', 'M12 7v13', 'M12 7s-1-4-3.5-4a2 2 0 0 0 0 4H12Z', 'M12 7s1-4 3.5-4a2 2 0 0 1 0 4H12Z'],
    bolt: ['M13 3L5 13.500h6L10 21l8-10.500h-6L13 3Z'],
    user: ['M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z', 'M4.5 20.500a7.5 7.5 0 0 1 15 0'],
    pulse: ['M3 12h4l2.5-6 4 12 2.5-6h5'],
    shield: ['M12 3l7.5 3v5.500c0 4.5-3.2 8-7.5 9.5-4.3-1.5-7.5-5-7.5-9.500V6L12 3Z', 'M9 12l2.2 2.200L15.5 10'],
    phone: ['M6.5 3h3l1.5 4.5-2 1.500a11 11 0 0 0 6 6l1.5-2 4.5 1.500v3a2 2 0 0 1-2 2A16 16 0 0 1 4.5 5a2 2 0 0 1 2-2Z'],
    clock: ['M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z', 'M12 7v5l3 2'],
  };

  V.icon = function (name, className) {
    var el = svg('0 0 24 24', 'icon ' + (className || ''));
    el.setAttribute('fill', 'none');
    el.setAttribute('stroke', 'currentColor');
    el.setAttribute('stroke-width', '1.4');
    el.setAttribute('stroke-linecap', 'round');
    el.setAttribute('stroke-linejoin', 'round');
    (ICONS[name] || ICONS.drop).forEach(function (d) { el.appendChild(path(d)); });
    return el;
  };

  V.hasIcon = function (name) { return Object.prototype.hasOwnProperty.call(ICONS, name); };

  /** Gold hairline with the ✦ in the middle, as in the brand manual. */
  V.rule = function (className) {
    return V.h('div', { class: 'rule ' + (className || '') },
      V.h('span', { class: 'rule-line' }), V.h('span', { class: 'rule-star' }, '✦'), V.h('span', { class: 'rule-line' }));
  };

  /** Price block: optional "Desde" prefix plus the amount (or "Consultar"). */
  V.price = function (price, className) {
    var el = V.h('span', { class: 'price price-' + price.mode + ' ' + (className || '') });
    if (price.prefix) el.appendChild(V.h('span', { class: 'price-prefix' }, price.prefix));
    el.appendChild(V.h('span', { class: 'price-amount' }, price.text));
    return el;
  };

  /**
   * Price of a service. With an active offer the regular price is shown
   * struck through next to the offer price.
   */
  V.servicePrice = function (service, className) {
    if (!service.offer) return V.price(service.price, className);
    var el = V.h('span', { class: 'price has-offer price-' + service.price.mode + ' ' + (className || '') });
    if (service.price.prefix) el.appendChild(V.h('span', { class: 'price-prefix' }, service.price.prefix));
    el.appendChild(V.h('span', { class: 'price-old' }, service.price.text));
    el.appendChild(V.h('span', { class: 'price-amount' }, service.offer.text));
    return el;
  };

  /** Round seal with the discount ("-20 %") or the custom offer label. */
  V.offerSeal = function (service, className) {
    if (!service.offer) return null;
    return V.h('span', { class: 'seal ' + (className || '') }, service.offer.label);
  };

  /** Picture in a frame. `fit` is "cover" (fills, may crop) or "contain" (whole picture). */
  V.photo = function (url, fit, className) {
    return V.h('div', { class: 'photo ' + (fit === 'contain' ? 'photo-contain ' : '') + (className || '') }, V.h('img', { src: url, alt: '' }));
  };

  /** Page `cycle` of a list, with `perPage` items each. */
  V.page = function (list, perPage, cycle) {
    var pages = Math.ceil(list.length / perPage) || 1;
    var index = cycle % pages;
    return { items: list.slice(index * perPage, index * perPage + perPage), index: index, pages: pages };
  };

  V.pager = function (page) {
    return page.pages > 1 ? V.h('div', { class: 'pager' }, (page.index + 1) + ' / ' + page.pages) : null;
  };

  /** Standard slide heading: title, spaced subtitle and gold rule. */
  V.heading = function (slots, fallbackTitle) {
    var title = slots.title || fallbackTitle;
    if (!title && !slots.subtitle) return null;
    return V.h('div', { class: 'heading' },
      title ? V.h('h1', { class: 'title' }, title) : null,
      slots.subtitle ? V.h('p', { class: 'kicker' }, slots.subtitle) : null,
      V.rule());
  };

  /** Splits a list into `count` consecutive chunks of similar size. */
  V.chunk = function (list, count) {
    var size = Math.ceil(list.length / Math.max(count, 1));
    var out = [];
    for (var i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
    return out;
  };
})(typeof window !== 'undefined' ? window : globalThis);
