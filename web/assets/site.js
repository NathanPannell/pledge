// Shared helpers for the Tributary pages: money formatting, the guilloche
// rosette, and counting animations. No dependencies.
(function () {
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function money(value, digits) {
    const d = digits === undefined ? (Math.abs(value) < 100 ? 2 : 0) : digits;
    return value.toLocaleString("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    });
  }

  function cssVar(name) {
    return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  }

  // Hypotrochoid curves layered at offsets, the same family of curves
  // banknote engravers use for anti-counterfeit rosettes.
  function rosettePoints(R, r, d, scale, steps) {
    const pts = [];
    const k = (R - r) / r;
    const turns = r / gcd(R, r);
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * Math.PI * 2 * turns;
      pts.push([
        ((R - r) * Math.cos(t) + d * Math.cos(k * t)) * scale,
        ((R - r) * Math.sin(t) - d * Math.sin(k * t)) * scale,
      ]);
    }
    return pts;
  }

  function gcd(a, b) {
    return b === 0 ? a : gcd(b, a % b);
  }

  const pointCache = {};

  const LAYERS = [
    { R: 96, r: 25, d: 58, color: "--guil", width: 0.8 },
    { R: 96, r: 25, d: 46, color: "--guil", width: 0.6 },
    { R: 80, r: 33, d: 60, color: "--guil-2", width: 0.7 },
    { R: 110, r: 41, d: 30, color: "--guil-2", width: 0.5 },
    { R: 140, r: 37, d: 40, color: "--guil", width: 0.45 },
  ];

  function drawRosette(canvas, progress) {
    const size = canvas.clientWidth;
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== Math.round(size * dpr)) {
      canvas.width = Math.round(size * dpr);
      canvas.height = Math.round(size * dpr);
    }
    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);
    ctx.translate(size / 2, size / 2);
    const scale = size / 2 / 150;
    LAYERS.forEach(function (layer) {
      const key = scale + ":" + layer.R + ":" + layer.r + ":" + layer.d;
      if (!pointCache[key]) pointCache[key] = rosettePoints(layer.R, layer.r, layer.d, scale, 7000);
      const pts = pointCache[key];
      const count = Math.max(2, Math.floor(pts.length * progress));
      ctx.beginPath();
      ctx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < count; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.strokeStyle = cssVar(layer.color);
      ctx.lineWidth = layer.width;
      ctx.globalAlpha = 0.85;
      ctx.stroke();
    });
    ctx.globalAlpha = 1;
  }

  function mountRosette(canvas) {
    if (!canvas) return;
    const duration = reduceMotion ? 0 : 1800;
    const start = performance.now();
    function frame(now) {
      const p = duration === 0 ? 1 : Math.min(1, (now - start) / duration);
      drawRosette(canvas, 1 - Math.pow(1 - p, 3));
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    const redraw = function () { drawRosette(canvas, 1); };
    window.addEventListener("resize", redraw);
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", redraw);
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  }

  // Counts from the current displayed value to a target. The final value is
  // written immediately when motion is reduced.
  function countTo(el, target, format, ms) {
    const from = Number(el.dataset.value || 0);
    el.dataset.value = String(target);
    if (reduceMotion || !ms) {
      el.textContent = format(target);
      return;
    }
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / ms);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = format(from + (target - from) * eased);
      if (p < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function referenceCode(prefix) {
    const d = new Date();
    const ym = d.getFullYear() + String(d.getMonth() + 1).padStart(2, "0");
    const n = Math.floor(Math.random() * 9000 + 1000);
    return prefix + "-" + ym + "-" + n;
  }

  window.Tributary = { money, mountRosette, countTo, referenceCode, reduceMotion };
})();
