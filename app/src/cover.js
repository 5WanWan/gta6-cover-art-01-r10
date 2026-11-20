// Sunset Heist — Comic Cover Studio: the cover renderer.
//
// drawCover(canvas, state) paints one finished cover onto a canvas of any
// size. Everything is drawn with the canvas 2D API: comic panels with thick
// black borders and halftone dots, a giant gradient title, a neon script
// subtitle, gold stars, a starburst stamp and a bottom strip. No image is
// fetched at draw time: the caller hands in loaded <img> elements.

/** Colour grades: sky stops, panel tint and glow colour, by grade name. */
export const GRADES = {
  sunset: {
    sky: ['#2a1052', '#8f2d7d', '#e8486f', '#ff7a18', '#ffd21f'],
    tint: 'rgba(255, 110, 60, 0.16)',
    glow: '#ff5fbf',
  },
  neon: {
    sky: ['#07031f', '#2a0a54', '#7a1278', '#c2188a', '#00e5ff'],
    tint: 'rgba(255, 0, 180, 0.20)',
    glow: '#00e5ff',
  },
  golden: {
    sky: ['#3d1c00', '#7a3a10', '#c96a1e', '#f59e0b', '#ffe08a'],
    tint: 'rgba(255, 170, 0, 0.16)',
    glow: '#ffb347',
  },
  midnight: {
    sky: ['#03030f', '#0d0d2e', '#241a5e', '#4a2a8f', '#7b2fbe'],
    tint: 'rgba(90, 70, 255, 0.18)',
    glow: '#8f7bff',
  },
};

/** Layout names the editor offers, in the order their buttons show. */
export const LAYOUTS = ['one', 'two-v', 'two-h', 'three', 'four'];

/** A tiny deterministic generator, so the grain is identical every export. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A five-pointed star path centred on (cx, cy) with outer radius r. */
function starPath(ctx, cx, cy, r) {
  const inner = r * 0.42;
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const angle = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : inner;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/** A spiky starburst path (n spikes) centred on (cx, cy). */
function burstPath(ctx, cx, cy, outer, inner, spikes) {
  ctx.beginPath();
  for (let i = 0; i < spikes * 2; i++) {
    const angle = (i * Math.PI) / spikes;
    const rad = i % 2 === 0 ? outer : inner;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
}

/**
 * Panel rectangles for a layout inside the cover's panel zone.
 * Returns [{x, y, w, h}] in canvas pixels. Landscape covers lay four panels
 * in a row; square and portrait covers use a 2 x 2 grid for 'four'.
 */
export function panelRects(layout, W, H) {
  const margin = W * 0.02;
  const gap = W * 0.012;
  const zone = { x: margin, y: H * 0.02, w: W - margin * 2, h: H * 0.48 };
  const rect = (x, y, w, h) => ({ x, y, w, h });
  if (layout === 'one') return [rect(zone.x, zone.y, zone.w, zone.h)];
  if (layout === 'two-v') {
    const w = (zone.w - gap) / 2;
    return [rect(zone.x, zone.y, w, zone.h), rect(zone.x + w + gap, zone.y, w, zone.h)];
  }
  if (layout === 'two-h') {
    const h = (zone.h - gap) / 2;
    return [rect(zone.x, zone.y, zone.w, h), rect(zone.x, zone.y + h + gap, zone.w, h)];
  }
  if (layout === 'three') {
    const leftW = zone.w * 0.52;
    const rightX = zone.x + leftW + gap;
    const rightW = zone.w - leftW - gap;
    const h = (zone.h - gap) / 2;
    return [
      rect(zone.x, zone.y, leftW, zone.h),
      rect(rightX, zone.y, rightW, h),
      rect(rightX, zone.y + h + gap, rightW, h),
    ];
  }
  // 'four': a row on wide covers, a grid on square / portrait ones.
  if (W / H > 1.3) {
    const w = (zone.w - gap * 3) / 4;
    return [0, 1, 2, 3].map((i) => rect(zone.x + i * (w + gap), zone.y, w, zone.h));
  }
  const w = (zone.w - gap) / 2;
  const h = (zone.h - gap) / 2;
  return [
    rect(zone.x, zone.y, w, h),
    rect(zone.x + w + gap, zone.y, w, h),
    rect(zone.x, zone.y + h + gap, w, h),
    rect(zone.x + w + gap, zone.y + h + gap, w, h),
  ];
}

/** Paints the sunset sky and a soft sun glow behind the panels. */
function drawSky(ctx, W, H, grade) {
  const sky = ctx.createLinearGradient(0, 0, 0, H);
  grade.sky.forEach((color, i) => sky.addColorStop(i / (grade.sky.length - 1), color));
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sun = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, H * 0.42);
  sun.addColorStop(0, 'rgba(255, 214, 90, 0.55)');
  sun.addColorStop(0.55, 'rgba(255, 140, 60, 0.18)');
  sun.addColorStop(1, 'rgba(255, 140, 60, 0)');
  ctx.fillStyle = sun;
  ctx.fillRect(0, 0, W, H);
}

/** Halftone dots over a panel's lower-right corner, growing toward it. */
function drawHalftone(ctx, r, W) {
  const step = Math.max(7, W * 0.011);
  ctx.fillStyle = 'rgba(0, 0, 0, 0.22)';
  for (let y = r.y + r.h * 0.55; y < r.y + r.h; y += step) {
    for (let x = r.x + r.w * 0.45; x < r.x + r.w; x += step) {
      const depth = ((x - r.x) / r.w + (y - r.y) / r.h) / 2;
      const rad = step * 0.16 + step * 0.3 * depth;
      ctx.beginPath();
      ctx.arc(x, y, rad, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/** One comic panel: photo, cel shading, halftone and a thick black frame. */
function drawPanel(ctx, r, panel, W) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(r.x, r.y, r.w, r.h);
  ctx.clip();
  ctx.fillStyle = '#1a1026';
  ctx.fillRect(r.x, r.y, r.w, r.h);
  const img = panel && panel.img;
  if (img && img.naturalWidth > 0) {
    const zoom = panel.zoom ?? 1;
    const base = Math.max(r.w / img.naturalWidth, r.h / img.naturalHeight) * zoom;
    const dw = img.naturalWidth * base;
    const dh = img.naturalHeight * base;
    const px = panel.x ?? 0;
    const py = panel.y ?? 0;
    let dx = r.x + (r.w - dw) / 2 + (px * (dw - r.w)) / 2;
    let dy = r.y + (r.h - dh) / 2 + (py * (dh - r.h)) / 2;
    if (dw > r.w) dx = Math.min(r.x, Math.max(r.x + r.w - dw, dx));
    if (dh > r.h) dy = Math.min(r.y, Math.max(r.y + r.h - dh, dy));
    ctx.filter = `brightness(${panel.bright ?? 1}) contrast(${panel.contrast ?? 1})`;
    ctx.drawImage(img, dx, dy, dw, dh);
    ctx.filter = 'none';
  }
  // Cel shading: bright top edge, dark foot.
  const shade = ctx.createLinearGradient(0, r.y, 0, r.y + r.h);
  shade.addColorStop(0, 'rgba(255, 255, 255, 0.10)');
  shade.addColorStop(0.45, 'rgba(255, 255, 255, 0)');
  shade.addColorStop(1, 'rgba(0, 0, 0, 0.38)');
  ctx.fillStyle = shade;
  ctx.fillRect(r.x, r.y, r.w, r.h);
  drawHalftone(ctx, r, W);
  ctx.restore();
  // Thick black comic frame.
  ctx.lineWidth = Math.max(4, W * 0.006);
  ctx.strokeStyle = '#0d0d0d';
  ctx.strokeRect(r.x, r.y, r.w, r.h);
  // White inner keyline, like an inked panel edge.
  ctx.lineWidth = Math.max(1.5, W * 0.0016);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.55)';
  ctx.strokeRect(r.x + W * 0.004, r.y + W * 0.004, r.w - W * 0.008, r.h - W * 0.008);
}

/** The giant title: gradient fill, thick black outline, slight comic lean. */
function drawTitle(ctx, W, H, text) {
  const words = (text || 'SUNSET HEIST').trim().toUpperCase();
  let size = H * 0.1;
  const target = W * 0.9;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const setFont = (s) => {
    ctx.font = `${s}px Bangers, "Arial Black", sans-serif`;
  };
  setFont(size);
  while (ctx.measureText(words).width < target && size < H * 0.22) {
    size += 2;
    setFont(size);
  }
  while (ctx.measureText(words).width > target && size > 10) {
    size -= 2;
    setFont(size);
  }
  const cx = W / 2;
  const cy = H * 0.615;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.transform(1, 0, -0.07, 1, 0, 0);
  const grad = ctx.createLinearGradient(-target / 2, 0, target / 2, 0);
  grad.addColorStop(0, '#ffd21f');
  grad.addColorStop(0.5, '#ff7a18');
  grad.addColorStop(1, '#ff2e88');
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(6, size * 0.17);
  ctx.strokeStyle = '#0d0d0d';
  ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
  ctx.shadowBlur = size * 0.08;
  ctx.shadowOffsetY = size * 0.04;
  ctx.strokeText(words, 0, 0);
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.fillStyle = grad;
  ctx.fillText(words, 0, 0);
  // A thin white top highlight keeps the letters popping off the sky.
  ctx.lineWidth = Math.max(1.5, size * 0.02);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
  ctx.strokeText(words, 0, -size * 0.02);
  ctx.restore();
}

/** The neon script subtitle under the title. */
function drawSubtitle(ctx, W, H, grade, text) {
  const words = (text || '').trim();
  if (!words) return;
  ctx.save();
  ctx.translate(W / 2, H * 0.705);
  ctx.rotate(-0.035);
  ctx.font = `${H * 0.047}px Pacifico, cursive`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = grade.glow;
  ctx.shadowBlur = H * 0.022;
  ctx.fillStyle = '#ff6ec7';
  ctx.fillText(words, 0, 0);
  ctx.shadowBlur = 0;
  // A dark hairline keeps the script legible where it crosses the title.
  ctx.lineWidth = Math.max(1.5, H * 0.002);
  ctx.strokeStyle = 'rgba(60, 0, 40, 0.55)';
  ctx.strokeText(words, 0, 0);
  ctx.fillStyle = '#ffd7ef';
  ctx.fillText(words, 0, -H * 0.003);
  ctx.restore();
}

/** Five gold stars over the tagline. */
function drawStarsAndTagline(ctx, W, H, tagline) {
  const cy = H * 0.775;
  const r = H * 0.02;
  const gap = r * 2.7;
  const total = gap * 4;
  ctx.save();
  for (let i = 0; i < 5; i++) {
    const cx = W / 2 - total / 2 + i * gap;
    starPath(ctx, cx, cy, r);
    ctx.fillStyle = '#ffd21f';
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.16);
    ctx.strokeStyle = '#0d0d0d';
    ctx.stroke();
  }
  ctx.restore();
  const words = (tagline || '').trim();
  if (!words) return;
  let size = H * 0.033;
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  try {
    ctx.letterSpacing = `${Math.max(2, H * 0.004)}px`;
  } catch {
    // Older canvas builds ignore letterSpacing; the text still draws.
  }
  while (ctx.measureText(words).width > W * 0.86 && size > 10) {
    size -= 1;
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  }
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(3, size * 0.14);
  ctx.strokeStyle = '#0d0d0d';
  ctx.strokeText(words, W / 2, H * 0.825);
  ctx.fillStyle = '#fff6e0';
  ctx.fillText(words, W / 2, H * 0.825);
  try {
    ctx.letterSpacing = '0px';
  } catch {
    // No-op on builds without letterSpacing.
  }
}

/** The rotated starburst stamp in the top-right corner. */
function drawStarburst(ctx, W, H) {
  const cx = W * 0.895;
  const cy = H * 0.115;
  const outer = W * 0.082;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(-0.22);
  burstPath(ctx, 0, 0, outer, outer * 0.72, 16);
  ctx.fillStyle = '#ffd21f';
  ctx.fill();
  ctx.lineWidth = Math.max(3, W * 0.004);
  ctx.strokeStyle = '#0d0d0d';
  ctx.stroke();
  ctx.fillStyle = '#c81e3a';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const size = Math.max(10, W * 0.0165);
  ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
  ctx.fillText('ORIGINAL', 0, -size * 0.55);
  ctx.fillText('COVER ART', 0, size * 0.55);
  ctx.restore();
}

/** The black strip along the foot and the small print under it. */
function drawStripAndPrint(ctx, W, H, strip) {
  const y = H * 0.865;
  const h = H * 0.068;
  ctx.fillStyle = '#0d0d0d';
  ctx.fillRect(0, y, W, h);
  ctx.fillStyle = '#ffd21f';
  ctx.fillRect(0, y, W, Math.max(2, H * 0.004));
  ctx.fillRect(0, y + h - Math.max(2, H * 0.004), W, Math.max(2, H * 0.004));
  const words = (strip || '').trim();
  if (words) {
    let size = H * 0.032;
    ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    try {
      ctx.letterSpacing = `${Math.max(2, H * 0.005)}px`;
    } catch {
      // Letter spacing is a nicety, not a requirement.
    }
    while (ctx.measureText(words).width > W * 0.92 && size > 10) {
      size -= 1;
      ctx.font = `${size}px Anton, "Arial Black", sans-serif`;
    }
    ctx.fillStyle = '#ffd21f';
    ctx.fillText(words, W / 2, y + h / 2);
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // No-op on builds without letterSpacing.
    }
  }
  ctx.font = `${Math.max(10, H * 0.015)}px Anton, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = 'rgba(255, 255, 255, 0.85)';
  ctx.fillText(
    'SUNSET HEIST IS A FAN-MADE COVER STUDIO  •  PHOTOS ARE YOUR OWN  •  NOT AFFILIATED WITH ANY GAME STUDIO',
    W / 2,
    H * 0.962,
  );
}

/** Deterministic grain plus a vignette, for the printed-poster feel. */
function drawGrainAndVignette(ctx, W, H) {
  const rand = mulberry32(20261120);
  ctx.save();
  for (let i = 0; i < 900; i++) {
    const x = rand() * W;
    const y = rand() * H;
    ctx.fillStyle = rand() > 0.5 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.05)';
    ctx.fillRect(x, y, Math.max(1, W * 0.0012), Math.max(1, W * 0.0012));
  }
  const vig = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.42, W / 2, H / 2, Math.max(W, H) * 0.75);
  vig.addColorStop(0, 'rgba(0,0,0,0)');
  vig.addColorStop(1, 'rgba(0,0,0,0.30)');
  ctx.fillStyle = vig;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

/**
 * Paints the whole cover. `state` holds caption, subtitle, tagline, strip,
 * grade (a key of GRADES), layout (a key of LAYOUTS) and panels: one entry
 * per panel rectangle, each {img, x, y, zoom, bright, contrast}.
 */
export function drawCover(canvas, state) {
  const ctx = canvas.getContext('2d');
  const W = canvas.width;
  const H = canvas.height;
  const grade = GRADES[state.grade] ?? GRADES.sunset;
  drawSky(ctx, W, H, grade);
  const rects = panelRects(state.layout ?? 'four', W, H);
  rects.forEach((r, i) => drawPanel(ctx, r, (state.panels ?? [])[i], W));
  drawTitle(ctx, W, H, state.caption);
  drawSubtitle(ctx, W, H, grade, state.subtitle);
  drawStarsAndTagline(ctx, W, H, state.tagline);
  drawStarburst(ctx, W, H);
  drawStripAndPrint(ctx, W, H, state.strip);
  drawGrainAndVignette(ctx, W, H);
}

/** The export sizes the app offers, as [width, height] pairs. */
export const EXPORT_SIZES = {
  '1920x1080': [1920, 1080],
  '1080x1080': [1080, 1080],
  '1080x1350': [1080, 1350],
};

/** Renders the cover at an export size and returns a PNG blob. */
export function exportCoverPng(state, sizeName) {
  const [w, h] = EXPORT_SIZES[sizeName] ?? EXPORT_SIZES['1920x1080'];
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  drawCover(canvas, state);
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
