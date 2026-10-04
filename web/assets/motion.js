// Shared motion: scroll reveals, number tweens and small celebrations.
// Loaded in <head> so the "motion" class is set before first paint; the
// styles that hide content until it is revealed only apply under it. With
// reduced motion nothing is hidden and every number lands at once.
(function () {
  const root = document.documentElement;
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!reduce) root.classList.add("motion");

  const ease = (p) => 1 - Math.pow(1 - p, 3);
  const shown = new WeakMap(); // the number each element displays right now
  const running = new WeakMap(); // the latest tween per element; older ones stop

  // Rolls an element's number from one value to another. A newer tween on the
  // same element takes over from wherever the older one had got to.
  function tween(el, from, to, ms, format) {
    const token = {};
    running.set(el, token);
    if (reduce || ms <= 0 || from === to) {
      shown.set(el, to);
      el.textContent = format(to);
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        if (running.get(el) === token) {
          shown.set(el, to);
          el.textContent = format(to);
        }
        resolve();
      };
      const start = performance.now();
      const frame = (now) => {
        if (done) return;
        if (running.get(el) !== token) return finish();
        const p = Math.min(1, (now - start) / ms);
        const value = from + (to - from) * ease(p);
        shown.set(el, value);
        el.textContent = format(value);
        if (p < 1) requestAnimationFrame(frame);
        else finish();
      };
      requestAnimationFrame(frame);
      // Animation frames pause in background tabs; the final value always lands.
      setTimeout(finish, ms + 150);
    });
  }

  // Tweens from whatever the element shows now.
  function to(el, value, ms, format) {
    return tween(el, shown.has(el) ? shown.get(el) : value, value, ms, format);
  }

  function set(el, value, format) {
    running.delete(el);
    shown.set(el, value);
    el.textContent = format(value);
  }

  // Restarts a one-shot CSS animation class.
  function pop(el, cls = "pop") {
    if (!el || reduce) return;
    el.classList.remove(cls);
    void el.offsetWidth;
    el.classList.add(cls);
  }

  // A "+$188.22" chip that rises from just right of `anchor` and fades. The
  // anchor's parent must be positioned.
  function floatDelta(anchor, text) {
    if (reduce || !anchor) return;
    const chip = document.createElement("span");
    chip.className = "delta";
    chip.textContent = text;
    chip.style.left = anchor.offsetLeft + anchor.offsetWidth + 12 + "px";
    chip.style.top = anchor.offsetTop + "px";
    anchor.parentElement.appendChild(chip);
    const a = chip.animate([
      { opacity: 0, transform: "translateY(10px) scale(0.9)" },
      { opacity: 1, transform: "translateY(0) scale(1)", offset: 0.18 },
      { opacity: 1, transform: "translateY(-10px)", offset: 0.7 },
      { opacity: 0, transform: "translateY(-26px)" },
    ], { duration: 1700, easing: "cubic-bezier(.2,.8,.2,1)" });
    a.onfinish = () => chip.remove();
    setTimeout(() => chip.remove(), 2200);
  }

  const HEART = "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z";
  const COLORS = ["#0e7f72", "#1fa392", "#5fd6c4", "#19486a", "#e3a43a"];

  // Hearts and dots thrown out from (x, y) inside a positioned container.
  function burst(container, x, y, count = 18) {
    if (reduce || !container) return;
    for (let i = 0; i < count; i++) {
      const p = document.createElement("span");
      const heart = i % 3 === 0;
      const size = heart ? 14 + Math.random() * 10 : 5 + Math.random() * 5;
      p.className = "particle";
      p.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;color:${COLORS[i % COLORS.length]};`;
      if (heart) p.innerHTML = `<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="${HEART}"/></svg>`;
      else p.style.background = "currentColor";
      container.appendChild(p);
      const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
      const dist = 70 + Math.random() * 90;
      const dx = Math.cos(angle) * dist;
      const dy = Math.sin(angle) * dist - 40;
      const spin = (Math.random() - 0.5) * 120;
      const a = p.animate([
        { transform: "translate(-50%, -50%) scale(0.3)", opacity: 0 },
        { transform: `translate(calc(-50% + ${dx * 0.7}px), calc(-50% + ${dy * 0.7}px)) scale(1) rotate(${spin / 2}deg)`, opacity: 1, offset: 0.35 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 70}px)) scale(0.8) rotate(${spin}deg)`, opacity: 0 },
      ], { duration: 1300 + Math.random() * 500, easing: "cubic-bezier(.15,.7,.35,1)" });
      a.onfinish = () => p.remove();
      setTimeout(() => p.remove(), 2400);
    }
  }

  // ---- Scroll reveals ---------------------------------------------------------
  // [data-reveal] fades up the first time it scrolls into view; [data-reveal-group]
  // does the same for its children, one after another; [data-inview] only gets
  // the "in" class, for effects the element styles itself.

  const SELECTOR = "[data-reveal], [data-reveal-group], [data-inview]";

  function show(el) {
    el.classList.add("in");
    if (!el.hasAttribute("data-reveal-group")) return;
    const kids = [...el.children];
    kids.forEach((k, i) => k.style.setProperty("--i", i));
    const delay = parseInt(getComputedStyle(el).getPropertyValue("--d"), 10) || 0;
    // Once the group has arrived, children added later appear without replaying it.
    setTimeout(() => el.classList.add("settled"), delay + kids.length * 90 + 900);
  }

  const io = !reduce && "IntersectionObserver" in window
    ? new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        show(e.target);
      }
    }, { rootMargin: "0px 0px -6% 0px" })
    : null;

  function targets(scope) {
    const list = [...scope.querySelectorAll(SELECTOR)];
    if (scope !== document && scope.matches(SELECTOR)) list.unshift(scope);
    return list;
  }

  function reveal(scope = document) {
    targets(scope).forEach((el) => {
      if (el.classList.contains("in")) return;
      if (io) io.observe(el);
      else show(el);
    });
  }

  // Plays a scope's reveals again, for a view that is shown more than once.
  function replay(scope) {
    if (!io) return;
    targets(scope).forEach((el) => {
      el.classList.remove("in", "settled");
      io.unobserve(el);
    });
    reveal(scope);
  }

  function start() {
    reveal(document);
    const nav = document.querySelector(".nav");
    if (nav) {
      const onScroll = () => nav.classList.toggle("scrolled", window.scrollY > 8);
      window.addEventListener("scroll", onScroll, { passive: true });
      onScroll();
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();

  window.Motion = { reduce, tween, to, set, pop, floatDelta, burst, reveal, replay };
})();
