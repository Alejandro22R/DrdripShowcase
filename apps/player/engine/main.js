// Boot: reads the address (/1, /2 …), identifies the device and starts the player.
(function (root) {
  'use strict';
  var V = root.Vitrina;
  var params = {};
  root.location.search.replace(/^\?/, '').split('&').forEach(function (pair) {
    var parts = pair.split('=');
    if (parts[0]) params[decodeURIComponent(parts[0])] = decodeURIComponent(parts[1] || '');
  });

  var storage = null;
  try {
    root.localStorage.setItem('vitrina.test', '1');
    root.localStorage.removeItem('vitrina.test');
    storage = root.localStorage;
  } catch (err) { /* private mode or blocked storage: run without cache */ }

  /** Stable random id so the panel can recognise this TV next time. */
  V.deviceId = function () {
    if (!storage) return '';
    var id = storage.getItem('vitrina.device');
    if (!id) {
      id = 'tv-';
      for (var i = 0; i < 14; i++) id += 'abcdefghjkmnpqrstuvwxyz23456789'.charAt(Math.floor(Math.random() * 31));
      storage.setItem('vitrina.device', id);
    }
    return id;
  };

  V.boot = function () {
    var match = /^\/(\d{1,4})\/?$/.exec(root.location.pathname);
    var screenId = parseInt(match ? match[1] : params.pantalla || '1', 10);
    var draft = params.borrador === '1';
    var quality = { alta: 'alta', media: 'media', baja: 'baja' }[params.calidad] || '';
    if (storage && !draft) storage.setItem('vitrina.last', String(screenId));

    var player = new V.Player({
      stage: document.getElementById('stage'),
      screenId: screenId,
      draft: draft,
      token: params.token,
      slideKey: params.diapositiva || null,
      quality: quality,
      deviceId: draft ? '' : V.deviceId(),
      storage: storage,
    });
    player.start();
    V.player = player;

    // The builder tells its preview which slide to hold and when to refresh.
    root.addEventListener('message', function (ev) {
      var msg = ev.data || {};
      if (ev.origin !== root.location.origin || msg.type !== 'vitrina-preview') return;
      player.fixedKey = msg.slideKey || null;
      player.payload = player.payload ? Object.assign({}, player.payload, { etag: '' }) : null;
      player.load(function () { player.advance(true); });
    });
  };
})(typeof window !== 'undefined' ? window : globalThis);
