import React, { useEffect, useRef } from "react";

// --- Noise function (Perlin Noise) ---
class Noise {
  constructor(seed = Math.random()) {
    this.p = new Uint8Array(512);
    this.permutation = [];
    for (let i = 0; i < 256; i++) this.permutation[i] = i;

    // Shuffle using seed
    for (let i = 0; i < 256; i++) {
      const r = (seed * (i + 1) * 16807) % 256;
      [this.permutation[i], this.permutation[r]] = [
        this.permutation[r],
        this.permutation[i],
      ];
    }

    for (let i = 0; i < 512; i++) {
      this.p[i] = this.permutation[i % 256];
    }
  }

  fade(t) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }
  lerp(t, a, b) {
    return a + t * (b - a);
  }
  grad(hash, x, y) {
    switch (hash & 3) {
      case 0:
        return x + y;
      case 1:
        return -x + y;
      case 2:
        return x - y;
      case 3:
        return -x - y;
      default:
        return 0;
    }
  }
  perlin2(x, y) {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;
    const xf = x - Math.floor(x);
    const yf = y - Math.floor(y);
    const topRight = this.p[this.p[X + 1] + Y];
    const topLeft = this.p[this.p[X] + Y];
    const bottomRight = this.p[this.p[X + 1] + Y + 1];
    const bottomLeft = this.p[this.p[X] + Y + 1];

    const u = this.fade(xf);
    const v = this.fade(yf);

    const x1 = this.lerp(
      u,
      this.grad(topLeft, xf, yf),
      this.grad(topRight, xf - 1, yf)
    );
    const x2 = this.lerp(
      u,
      this.grad(bottomLeft, xf, yf - 1),
      this.grad(bottomRight, xf - 1, yf - 1)
    );

    return this.lerp(v, x1, x2);
  }
}

// --- React Component ---
export default function WavyBackground() {
  const svgRef = useRef();
  const mouse = useRef({
    x: -10,
    y: 0,
    lx: 0,
    ly: 0,
    sx: 0,
    sy: 0,
    v: 0,
    vs: 0,
    a: 0,
    set: false,
  });

  const lines = useRef([]);
  const paths = useRef([]);
  const noise = useRef(new Noise(Math.random()));

  useEffect(() => {
    const svg = svgRef.current;
    function setSize() {
      const bounds = svg.getBoundingClientRect();
      svg.style.width = `${bounds.width}px`;
      svg.style.height = `${bounds.height}px`;
      setLines(bounds);
    }

    function setLines(bounds) {
      lines.current = [];
      paths.current = [];
      svg.innerHTML = "";

      const xGap = 10;
      const yGap = 32;
      const oWidth = bounds.width + 200;
      const oHeight = bounds.height + 30;
      const totalLines = Math.ceil(oWidth / xGap);
      const totalPoints = Math.ceil(oHeight / yGap);
      const xStart = (bounds.width - xGap * totalLines) / 2;
      const yStart = (bounds.height - yGap * totalPoints) / 2;

      for (let i = 0; i <= totalLines; i++) {
        const pts = [];

        for (let j = 0; j <= totalPoints; j++) {
          pts.push({
            x: xStart + xGap * i,
            y: yStart + yGap * j,
            wave: { x: 0, y: 0 },
            cursor: { x: 0, y: 0, vx: 0, vy: 0 },
          });
        }

        const path = document.createElementNS(
          "http://www.w3.org/2000/svg",
          "path"
        );
        path.setAttribute("fill", "none");
        path.setAttribute("stroke", "#dff5e1"); // light green
        path.setAttribute("stroke-width", "1");
        svg.appendChild(path);

        lines.current.push(pts);
        paths.current.push(path);
      }
    }

    function updateMouse(x, y) {
      const m = mouse.current;

      m.x = x;
      m.y = y;

      if (!m.set) {
        m.sx = x;
        m.sy = y;
        m.lx = x;
        m.ly = y;
        m.set = true;
      }
    }

    function movePoints(time) {
      lines.current.forEach((pts) => {
        pts.forEach((p) => {
          const move =
            noise.current.perlin2(
              (p.x + time * 0.0125) * 0.002,
              (p.y + time * 0.005) * 0.0015
            ) * 12;

          p.wave.x = Math.cos(move) * 32;
          p.wave.y = Math.sin(move) * 16;
        });
      });
    }

    function drawLines() {
      lines.current.forEach((pts, i) => {
        let d = `M ${pts[0].x} ${pts[0].y}`;
        pts.forEach((p) => {
          d += ` L ${p.x + p.wave.x} ${p.y + p.wave.y}`;
        });
        paths.current[i].setAttribute("d", d);
      });
    }

    function animate(t) {
      movePoints(t);
      drawLines();
      requestAnimationFrame(animate);
    }

    // Init
    setSize();
    requestAnimationFrame(animate);

    window.addEventListener("resize", setSize);
    window.addEventListener("mousemove", (e) => updateMouse(e.clientX, e.clientY));

    return () => {
      window.removeEventListener("resize", setSize);
      window.removeEventListener("mousemove", updateMouse);
    };
  }, []);

  return (
    <div className="wavy-wrapper">
      <svg ref={svgRef} className="wavy-svg"></svg>
    </div>
  );
}