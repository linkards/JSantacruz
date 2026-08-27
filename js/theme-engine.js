/* ============================================================
   THEME ENGINE
   Traduce el objeto JSONB guardado en theme_config.variables
   (mismo formato que el "Estudio de Temas" del prototipo original)
   a variables CSS reales sobre :root.
   Compartido entre index.html y el panel admin (vista previa).
   ============================================================ */

/**
 * Aplica un objeto { 'bg-color': '#000', 'btn-radius': '16px', ... }
 * como variables CSS --bg-color, --btn-radius, etc.
 * @param {Object} variables
 * @param {HTMLElement} [target] - por defecto document.documentElement
 */
function applyThemeVars(variables, target) {
  const root = target || document.documentElement;
  if (!variables) return;
  Object.keys(variables).forEach((key) => {
    root.style.setProperty(`--${key}`, variables[key]);
  });
  updateBgLayer(target);
}

/**
 * Sincroniza la capa visual de fondo (#bg-layer) con --bg-type
 * (solid | gradient | image), igual que el prototipo original.
 */
function updateBgLayer(target) {
  const root = target || document.documentElement;
  const bgLayer = (target ? target.querySelector('#bg-layer') : document.getElementById('bg-layer'));
  if (!bgLayer) return;

  const bgType = getComputedStyle(root).getPropertyValue('--bg-type').trim();

  if (bgType === 'solid') {
    bgLayer.className = 'dynamic-bg-solid';
  } else if (bgType === 'image') {
    bgLayer.className = 'dynamic-bg-image';
  } else {
    bgLayer.className = 'dynamic-bg-gradient';
  }
}
