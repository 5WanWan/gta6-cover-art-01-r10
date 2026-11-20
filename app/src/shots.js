// Fixed scenes for screenshots: ?shot=editor shows the page with photos
// loaded; ?shot=cover, ?shot=cover-square and ?shot=cover-portrait show the
// cover alone at each export size. `caption` sets the title words.
// window.__shotReady is set once the scene has painted, so a headless
// screenshot can wait for it with a virtual time budget.

/**
 * Runs one shot scene. `tools` is the editor's own kit: its state, redraw
 * and the small render helpers main.js built, so a scene reuses the real
 * editor instead of a second copy of it.
 */
export async function runShot(shot, query, tools) {
  const { state, redraw, rebuildPanels, renderPresets, renderSizeRow, renderPanelList, syncPanelControls } = tools;
  const caption = query.get('caption');
  if (caption) {
    state.caption = caption;
    const input = document.getElementById('caption');
    if (input) input.value = caption;
  }
  const sizeFor = { cover: '1920x1080', 'cover-square': '1080x1080', 'cover-portrait': '1080x1350', editor: '1920x1080' };
  state.size = sizeFor[shot] ?? '1920x1080';
  renderSizeRow();
  if (shot === 'cover' || shot === 'cover-square' || shot === 'cover-portrait') {
    document.body.classList.add('shot-cover');
    state.layout = 'four';
    state.grade = 'sunset';
    rebuildPanels();
    renderPresets();
    renderPanelList();
    syncPanelControls();
  }
  if (shot === 'editor') {
    state.layout = 'four';
    state.grade = 'sunset';
    rebuildPanels();
    renderPresets();
    renderPanelList();
    syncPanelControls();
  }
  try {
    await document.fonts.ready;
  } catch {
    // Fonts fall back; the scene still paints.
  }
  redraw();
  await new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });
  window.__shotReady = true;
}
