// Sunset Heist — Comic Cover Studio: the editor.
//
// Wires the page: photos (uploads plus the built-in comic panels), layout
// and grade presets, editable lettering, per-panel crop controls, live
// preview and PNG export in the three post sizes. A `?shot=` query sets up
// a fixed scene for a screenshot instead (./shots.js).

import { drawCover, exportCoverPng, GRADES, LAYOUTS, panelRects, EXPORT_SIZES } from './cover.js';
import { runShot } from './shots.js';

/** Built-in photos: the four comic panels made for this studio, in order. */
const BUILTIN_PHOTOS = [
  { name: 'Heist', src: 'photos/heist.jpg' },
  { name: 'Chase', src: 'photos/chase.jpg' },
  { name: 'Drive', src: 'photos/drive.jpg' },
  { name: 'Sunset', src: 'photos/sunset.jpg' },
];

/** The two sample photos the kit ships, also free to use. */
const SAMPLE_PHOTOS = [
  { name: 'Boulevard', src: 'samples/boulevard.jpg' },
  { name: 'Pier', src: 'samples/pier.jpg' },
];

const canvas = document.getElementById('cover');
const statusEl = document.getElementById('status');
const panelListEl = document.getElementById('panel-list');
const photoStripEl = document.getElementById('photo-strip');

/** The whole editor state; drawCover reads it as-is. */
const state = {
  caption: 'SUNSET HEIST',
  subtitle: 'Vice City nights',
  tagline: 'TWO OUTLAWS · ONE LAST SCORE',
  strip: 'PALMS · NEON · NO RULES · COMING SOON',
  grade: 'sunset',
  layout: 'four',
  size: '1920x1080',
  photos: [],
  panels: [],
  selected: 0,
};

/** Loads an image from a URL, resolving once it can be drawn. */
export function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`cannot load ${url}`));
    img.src = url;
  });
}

/** One fresh panel pointing at photo `index`, centred and unzoomed. */
function freshPanel(index) {
  return { photo: index, x: 0, y: 0, zoom: 1, bright: 1, contrast: 1 };
}

/** Rebuilds state.panels for the current layout, keeping photos where set. */
function rebuildPanels() {
  const count = panelRects(state.layout, 1920, 1080).length;
  const old = state.panels;
  state.panels = Array.from({ length: count }, (_, i) => {
    if (old[i]) return old[i];
    return freshPanel(i % state.photos.length);
  });
  if (state.selected >= count) state.selected = 0;
}

/** Redraws the preview canvas at the chosen export size's aspect. */
function redraw() {
  const [w, h] = EXPORT_SIZES[state.size];
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }
  const panels = state.panels.map((p) => ({
    ...p,
    img: state.photos[p.photo] ? state.photos[p.photo].img : null,
  }));
  drawCover(canvas, { ...state, panels });
}

/** The photo strip: one button per loaded photo, click to use in panel. */
function renderPhotoStrip() {
  photoStripEl.innerHTML = '';
  state.photos.forEach((photo, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'thumb';
    button.title = photo.name;
    const img = document.createElement('img');
    img.src = photo.src;
    img.alt = photo.name;
    button.append(img);
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.append(label);
    button.addEventListener('click', () => {
      const panel = state.panels[state.selected];
      if (panel) panel.photo = i;
      renderPanelList();
      redraw();
    });
    photoStripEl.append(button);
  });
}

/** Panel picker buttons: which panel the sliders below are editing. */
function renderPanelList() {
  panelListEl.innerHTML = '';
  state.panels.forEach((panel, i) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = i === state.selected ? 'panel-pick active' : 'panel-pick';
    const name = state.photos[panel.photo] ? state.photos[panel.photo].name : 'Empty';
    button.textContent = `Panel ${i + 1} · ${name}`;
    button.addEventListener('click', () => {
      state.selected = i;
      renderPanelList();
      syncPanelControls();
    });
    panelListEl.append(button);
  });
}

/** Copies the selected panel's values into the crop sliders. */
function syncPanelControls() {
  const panel = state.panels[state.selected];
  if (!panel) return;
  document.getElementById('pan-x').value = panel.x;
  document.getElementById('pan-y').value = panel.y;
  document.getElementById('zoom').value = panel.zoom;
  document.getElementById('bright').value = panel.bright;
  document.getElementById('contrast').value = panel.contrast;
}

/** Binds one range slider to one field of the selected panel. */
function bindPanelSlider(id, field, parse) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    const panel = state.panels[state.selected];
    if (!panel) return;
    panel[field] = parse(input.value);
    redraw();
  });
}

/** Binds one text input to one field of the cover state. */
function bindText(id, field) {
  const input = document.getElementById(id);
  input.addEventListener('input', () => {
    state[field] = input.value;
    redraw();
  });
}

/** Builds the preset button rows for layouts and grades. */
function renderPresets() {
  const layoutRow = document.getElementById('layout-row');
  layoutRow.innerHTML = '';
  const layoutNames = { one: '1 photo', 'two-v': '2 side by side', 'two-h': '2 stacked', three: '3 comic', four: '4 comic' };
  LAYOUTS.forEach((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = name === state.layout ? 'chip active' : 'chip';
    button.textContent = layoutNames[name];
    button.addEventListener('click', () => {
      state.layout = name;
      rebuildPanels();
      renderPresets();
      renderPanelList();
      syncPanelControls();
      redraw();
    });
    layoutRow.append(button);
  });
  const gradeRow = document.getElementById('grade-row');
  gradeRow.innerHTML = '';
  Object.keys(GRADES).forEach((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = name === state.grade ? 'chip active' : 'chip';
    button.textContent = name[0].toUpperCase() + name.slice(1);
    button.addEventListener('click', () => {
      state.grade = name;
      renderPresets();
      redraw();
    });
    gradeRow.append(button);
  });
}

/** Builds the export-size picker row. */
function renderSizeRow() {
  const row = document.getElementById('size-row');
  row.innerHTML = '';
  Object.keys(EXPORT_SIZES).forEach((name) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = name === state.size ? 'chip active' : 'chip';
    button.textContent = name.replace('x', ' × ');
    button.addEventListener('click', () => {
      state.size = name;
      renderSizeRow();
      redraw();
    });
    row.append(button);
  });
}

/** Clicking the preview selects the panel under the pointer. */
function bindCanvasPick() {
  canvas.addEventListener('click', (event) => {
    const box = canvas.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * canvas.width;
    const py = ((event.clientY - box.top) / box.height) * canvas.height;
    const rects = panelRects(state.layout, canvas.width, canvas.height);
    const hit = rects.findIndex((r) => px >= r.x && px <= r.x + r.w && py >= r.y && py <= r.y + r.h);
    if (hit >= 0) {
      state.selected = hit;
      renderPanelList();
      syncPanelControls();
    }
  });
  // Dragging the preview pans the selected panel's photo.
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  canvas.addEventListener('pointerdown', (event) => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
  });
  canvas.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const panel = state.panels[state.selected];
    if (!panel) return;
    const box = canvas.getBoundingClientRect();
    panel.x += ((event.clientX - lastX) / box.width) * 2;
    panel.y += ((event.clientY - lastY) / box.height) * 2;
    panel.x = Math.max(-1, Math.min(1, panel.x));
    panel.y = Math.max(-1, Math.min(1, panel.y));
    lastX = event.clientX;
    lastY = event.clientY;
    syncPanelControls();
    redraw();
  });
  canvas.addEventListener('pointerup', () => {
    dragging = false;
  });
}

/** Downloads the current cover as a PNG at the chosen export size. */
async function exportNow() {
  statusEl.textContent = 'Rendering…';
  try {
    const panels = state.panels.map((p) => ({
      ...p,
      img: state.photos[p.photo] ? state.photos[p.photo].img : null,
    }));
    const blob = await exportCoverPng({ ...state, panels }, state.size);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sunset-heist-${state.size}.png`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    statusEl.textContent = `Saved sunset-heist-${state.size}.png`;
  } catch (err) {
    statusEl.textContent = `Export failed: ${err.message}`;
  }
}

/** Loads the built-in photos, then starts the editor (or a shot scene). */
async function boot() {
  const wanted = [...BUILTIN_PHOTOS, ...SAMPLE_PHOTOS];
  const loaded = await Promise.all(
    wanted.map(async (photo) => {
      try {
        return { ...photo, img: await loadImage(photo.src) };
      } catch {
        return null;
      }
    }),
  );
  state.photos = loaded.filter(Boolean);
  rebuildPanels();
  renderPhotoStrip();
  renderPanelList();
  renderPresets();
  renderSizeRow();
  syncPanelControls();
  bindText('caption', 'caption');
  bindText('subtitle', 'subtitle');
  bindText('tagline', 'tagline');
  bindText('strip', 'strip');
  bindPanelSlider('pan-x', 'x', Number);
  bindPanelSlider('pan-y', 'y', Number);
  bindPanelSlider('zoom', 'zoom', Number);
  bindPanelSlider('bright', 'bright', Number);
  bindPanelSlider('contrast', 'contrast', Number);
  bindCanvasPick();
  document.getElementById('export').addEventListener('click', exportNow);
  document.getElementById('photo').addEventListener('change', async (event) => {
    const files = [...event.target.files];
    for (const file of files) {
      const img = await loadImage(URL.createObjectURL(file));
      state.photos.push({ name: file.name.replace(/\.[^.]+$/, ''), src: URL.createObjectURL(file), img });
    }
    renderPhotoStrip();
    redraw();
  });
  // Wait for the comic fonts before the first paint, so lettering is exact.
  try {
    await Promise.all([
      document.fonts.load('100px Bangers'),
      document.fonts.load('100px Pacifico'),
      document.fonts.load('100px Anton'),
    ]);
  } catch {
    // The system fallbacks still draw the cover.
  }
  const query = new URLSearchParams(location.search);
  const shot = query.get('shot');
  if (shot) {
    await runShot(shot, query, { state, redraw, rebuildPanels, renderPresets, renderSizeRow, renderPanelList, syncPanelControls, loadImage });
  } else {
    redraw();
  }
}

boot();
