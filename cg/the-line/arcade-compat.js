// Loaded synchronously before Capacitor, telemetry and every game's scripts.
// Older Android WebViews can run our modules but lack these newer APIs.
// Feature detection preserves the native implementation on current browsers.
(function (root) {
  'use strict';
  if (typeof Array.prototype.at !== 'function') {
    Object.defineProperty(Array.prototype, 'at', {
      configurable: true,
      writable: true,
      value: function at(index) {
        if (this == null) throw new TypeError('Array.prototype.at called on null or undefined');
        var object = Object(this);
        var length = +object.length;
        length = length !== length || length <= 0 ? 0 : Math.min(Math.floor(length), 9007199254740991);
        var offset = +index;
        offset = offset !== offset ? 0 : offset < 0 ? Math.ceil(offset) : Math.floor(offset);
        var key = offset < 0 ? length + offset : offset;
        return key < 0 || key >= length ? undefined : object[key];
      },
    });
  }

  // crypto.randomUUID arrived in Chrome 92; older WebViews have getRandomValues
  // only. Scrapyard Showdown still crashed on it after the 12 Oct builds
  // (6 errors 14 to 17 Oct, main.mjs:33), so it is filled the same way.
  var cryptoObject = root.crypto;
  if (cryptoObject && typeof cryptoObject.randomUUID !== 'function' && typeof cryptoObject.getRandomValues === 'function') {
    try {
      Object.defineProperty(cryptoObject, 'randomUUID', {
        configurable: true,
        writable: true,
        value: function randomUUID() {
          var b = cryptoObject.getRandomValues(new Uint8Array(16));
          b[6] = (b[6] & 0x0f) | 0x40;
          b[8] = (b[8] & 0x3f) | 0x80;
          var h = [];
          for (var i = 0; i < 16; i++) h.push((b[i] + 0x100).toString(16).slice(1));
          return h.slice(0, 4).join('') + '-' + h.slice(4, 6).join('') + '-' + h.slice(6, 8).join('') + '-' + h.slice(8, 10).join('') + '-' + h.slice(10).join('');
        },
      });
    } catch (e) {
      // a frozen crypto object cannot take the property; say so where the dashboard sees it
      if (root.console) root.console.error('compat: could not add crypto.randomUUID: ' + e.message);
    }
  }

  // CanvasPath roundRect semantics: scalar/1-4 radii, elliptical corner points,
  // proportional clamping and negative dimensions. ellipse predates roundRect
  // by many WebView generations; it also avoids replacing arcs with squares.
  function roundRect(x, y, width, height, radii) {
    if (arguments.length < 4) throw new TypeError('roundRect needs four coordinates');
    x = +x; y = +y; width = +width; height = +height;
    if (![x, y, width, height].every(Number.isFinite)) return;
    if (radii === undefined) radii = 0;
    var iterable = radii != null && typeof radii === 'object' && typeof Symbol !== 'undefined' && typeof radii[Symbol.iterator] === 'function';
    var values = iterable ? Array.from(radii) : [radii];
    if (!values.length || values.length > 4) throw new RangeError('roundRect needs one to four radii');
    var points = values.map(function (value) {
      var point = value != null && typeof value === 'object';
      var rx = point ? +(value.x === undefined ? 0 : value.x) : +value;
      var ry = point ? +(value.y === undefined ? 0 : value.y) : rx;
      if (rx < 0 || ry < 0) throw new RangeError('roundRect radii must be non-negative');
      return {x: rx, y: ry};
    });
    if (points.some(function (p) { return !Number.isFinite(p.x) || !Number.isFinite(p.y); })) return;
    var topLeft = points[0], topRight = points[1] || topLeft;
    var bottomRight = points[2] || topLeft, bottomLeft = points[3] || topRight;
    var w = Math.abs(width), h = Math.abs(height);
    function ratio(size, sum) { return sum > 0 ? size / sum : 1; }
    var factor = Math.min(1, ratio(w, topLeft.x + topRight.x), ratio(w, bottomLeft.x + bottomRight.x), ratio(h, topLeft.y + bottomLeft.y), ratio(h, topRight.y + bottomRight.y));
    var corners = [topLeft, topRight, bottomRight, bottomLeft].map(function (p) { return {x:p.x * factor, y:p.y * factor}; });
    var tl = corners[0], tr = corners[1], br = corners[2], bl = corners[3];
    this.save();
    try {
      this.translate(x, y);
      this.scale(width < 0 ? -1 : 1, height < 0 ? -1 : 1);
      this.moveTo(tl.x, 0);
      this.lineTo(w - tr.x, 0);
      this.ellipse(w - tr.x, tr.y, tr.x, tr.y, 0, -Math.PI / 2, 0);
      this.lineTo(w, h - br.y);
      this.ellipse(w - br.x, h - br.y, br.x, br.y, 0, 0, Math.PI / 2);
      this.lineTo(bl.x, h);
      this.ellipse(bl.x, h - bl.y, bl.x, bl.y, 0, Math.PI / 2, Math.PI);
      this.lineTo(0, tl.y);
      this.ellipse(tl.x, tl.y, tl.x, tl.y, 0, Math.PI, Math.PI * 1.5);
      this.closePath();
      this.moveTo(0, 0);
    } finally {
      this.restore();
    }
  }
  ['CanvasRenderingContext2D', 'OffscreenCanvasRenderingContext2D'].forEach(function (name) {
    var Constructor = root[name];
    if (Constructor && typeof Constructor.prototype.roundRect !== 'function') {
      Object.defineProperty(Constructor.prototype, 'roundRect', {value:roundRect, writable:true, configurable:true});
    }
  });
})(typeof window !== 'undefined' ? window : typeof self !== 'undefined' ? self : this);
