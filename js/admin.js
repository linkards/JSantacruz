/* ============================================================
   ADMIN.JS
   CRUD completo contra Supabase. RLS en la base de datos es la
   barrera real; este código solo ofrece la interfaz.
   ============================================================ */

// ---------- ESTADO LOCAL (solo caché de lo cargado, no la fuente de verdad) ----------
let adminState = {
  profile: null,
  categories: [],
  links: [],
  socials: [],
  themeVariables: {},
  initialized: false,
};

// ---------- UTILIDADES ----------
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

function showToast(msg, type = 'info') {
  const container = document.getElementById('admin-toast-container');
  const toast = document.createElement('div');
  toast.className = `admin-toast ${type === 'error' ? 'error' : ''}`;
  const icon = type === 'error' ? 'fa-circle-exclamation text-red-400' : 'fa-circle-check text-emerald-400';
  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${escapeHTML(msg)}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 10);
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3200);
}

function friendlyError(error) {
  // Nunca se muestra el mensaje crudo de Supabase al usuario.
  console.error(error);
  return 'Ocurrió un problema. Intenta de nuevo.';
}

// ---------- INICIALIZACIÓN DEL PANEL ----------
async function initAdminPanel() {
  if (adminState.initialized) return; // evita recargar todo si ya está montado
  adminState.initialized = true;

  setAdminTab('content');
  await Promise.all([loadAdminProfile(), loadAdminTheme(), loadAdminCategoriesAndLinks(), loadAdminSocials()]);
  renderThemePresetsGrid();
}

function setAdminTab(tab) {
  document.getElementById('tab-content').classList.toggle('hidden', tab !== 'content');
  document.getElementById('tab-design').classList.toggle('hidden', tab !== 'design');
  document.getElementById('nav-tab-content').classList.toggle('bg-purple-600', tab === 'content');
  document.getElementById('nav-tab-content').classList.toggle('text-white', tab === 'content');
  document.getElementById('nav-tab-design').classList.toggle('bg-purple-600', tab === 'design');
  document.getElementById('nav-tab-design').classList.toggle('text-white', tab === 'design');

  if (tab === 'design') {
    renderStudioPreview();
  }
}

// ============================================================
// PERFIL
// ============================================================
async function loadAdminProfile() {
  const { data, error } = await supabaseClient.from('profile').select('*').eq('id', 1).single();
  if (error) { showToast(friendlyError(error), 'error'); return; }
  adminState.profile = data;
  document.getElementById('profile-name-input').value = data.name || '';
  document.getElementById('profile-bio-input').value = data.bio || '';
  document.getElementById('profile-avatar-preview').src = data.avatar_url || '';
}

async function handleSaveProfile(event) {
  event.preventDefault();
  const name = document.getElementById('profile-name-input').value.trim();
  const bio = document.getElementById('profile-bio-input').value.trim();

  const { error } = await supabaseClient
    .from('profile')
    .update({ name, bio, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) { showToast(friendlyError(error), 'error'); return; }
  showToast('Perfil actualizado');
}

async function handleAvatarUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Selecciona un archivo de imagen válido.', 'error');
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showToast('La imagen no debe superar 5MB.', 'error');
    return;
  }

  const ext = file.name.split('.').pop();
  const path = `avatar/avatar-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage
    .from('linktree-media')
    .upload(path, file, { upsert: false });

  if (uploadError) { showToast(friendlyError(uploadError), 'error'); return; }

  const { data: publicUrlData } = supabaseClient.storage.from('linktree-media').getPublicUrl(path);
  const avatarUrl = publicUrlData.publicUrl;

  const { error: updateError } = await supabaseClient
    .from('profile')
    .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (updateError) { showToast(friendlyError(updateError), 'error'); return; }

  document.getElementById('profile-avatar-preview').src = avatarUrl;
  showToast('Foto de perfil actualizada');
}

// ============================================================
// CATEGORÍAS Y ENLACES
// ============================================================
async function loadAdminCategoriesAndLinks() {
  const [{ data: categories, error: catErr }, { data: links, error: linkErr }] = await Promise.all([
    supabaseClient.from('categories').select('*').order('sort_order', { ascending: true }),
    supabaseClient.from('links').select('*').order('sort_order', { ascending: true }),
  ]);

  if (catErr || linkErr) { showToast(friendlyError(catErr || linkErr), 'error'); return; }

  adminState.categories = categories || [];
  adminState.links = links || [];
  renderAdminLinks();
}

function renderAdminLinks() {
  const container = document.getElementById('admin-links-list');
  container.innerHTML = '';

  if (adminState.links.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">Aún no tienes enlaces. Crea el primero.</p>`;
    return;
  }

  adminState.links.forEach((link) => {
    const card = document.createElement('div');
    card.className = 'bg-slate-900 border border-slate-800 p-3 rounded-xl flex items-center justify-between gap-3';
    card.innerHTML = `
      <div class="flex items-center gap-3 truncate">
        <span class="w-8 h-8 rounded-lg bg-slate-950 flex items-center justify-center text-xs text-purple-400 shrink-0">
          <i class="fa-solid ${escapeHTML(link.icon || 'fa-link')}"></i>
        </span>
        <div class="truncate">
          <p class="font-bold text-xs text-white truncate">${escapeHTML(link.title)} ${link.is_active ? '' : '<span class="text-slate-500">(oculto)</span>'}</p>
          <p class="text-[10px] text-slate-400 font-mono truncate">${escapeHTML(link.url)}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="openLinkModal('${link.id}')" class="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button onclick="confirmDeleteLink('${link.id}')" class="p-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    container.appendChild(card);
  });
}

function openLinkModal(linkId = null) {
  const select = document.getElementById('link-category');
  select.innerHTML = adminState.categories.map((c) => `<option value="${c.id}">${escapeHTML(c.name)}</option>`).join('');

  if (linkId) {
    const l = adminState.links.find((x) => x.id === linkId);
    if (l) {
      document.getElementById('link-id').value = l.id;
      document.getElementById('link-title').value = l.title;
      document.getElementById('link-desc').value = l.description || '';
      document.getElementById('link-url').value = l.url;
      document.getElementById('link-category').value = l.category_id || '';
      document.getElementById('link-icon').value = l.icon || '';
      document.getElementById('link-featured').checked = l.is_featured || false;
      document.getElementById('link-active').checked = l.is_active;
      document.getElementById('modal-link-title').textContent = 'Editar Enlace';
    }
  } else {
    document.getElementById('link-form').reset();
    document.getElementById('link-id').value = '';
    document.getElementById('link-active').checked = true;
    document.getElementById('modal-link-title').textContent = 'Nuevo Enlace';
  }
  document.getElementById('modal-link').classList.remove('hidden');
}

function closeLinkModal() {
  document.getElementById('modal-link').classList.add('hidden');
}

async function handleSaveLink(event) {
  event.preventDefault();
  const id = document.getElementById('link-id').value;
  const data = {
    title: document.getElementById('link-title').value.trim(),
    description: document.getElementById('link-desc').value.trim(),
    url: document.getElementById('link-url').value.trim(),
    category_id: document.getElementById('link-category').value,
    icon: document.getElementById('link-icon').value.trim(),
    is_featured: document.getElementById('link-featured').checked,
    is_active: document.getElementById('link-active').checked,
    updated_at: new Date().toISOString(),
  };

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('links').update(data).eq('id', id));
  } else {
    data.sort_order = adminState.links.length + 1;
    ({ error } = await supabaseClient.from('links').insert(data));
  }

  if (error) { showToast(friendlyError(error), 'error'); return; }

  closeLinkModal();
  await loadAdminCategoriesAndLinks();
  showToast('Enlace guardado correctamente');
}

function confirmDeleteLink(id) {
  if (!confirm('¿Eliminar este enlace? Esta acción no se puede deshacer.')) return;
  deleteLink(id);
}

async function deleteLink(id) {
  const { error } = await supabaseClient.from('links').delete().eq('id', id);
  if (error) { showToast(friendlyError(error), 'error'); return; }
  await loadAdminCategoriesAndLinks();
  showToast('Enlace eliminado');
}

// ---------- CATEGORÍAS ----------
function openCategoryModal(catId = null) {
  if (catId) {
    const c = adminState.categories.find((x) => x.id === catId);
    if (c) {
      document.getElementById('cat-id').value = c.id;
      document.getElementById('cat-name').value = c.name;
      document.getElementById('modal-cat-title').textContent = 'Editar Categoría';
    }
  } else {
    document.getElementById('cat-form').reset();
    document.getElementById('cat-id').value = '';
    document.getElementById('modal-cat-title').textContent = 'Nueva Categoría';
  }
  renderCategoryModalList();
  document.getElementById('modal-cat').classList.remove('hidden');
}

function closeCategoryModal() {
  document.getElementById('modal-cat').classList.add('hidden');
}

function renderCategoryModalList() {
  const container = document.getElementById('cat-modal-list');
  container.innerHTML = '';
  adminState.categories.forEach((cat) => {
    const item = document.createElement('div');
    item.className = 'flex items-center justify-between bg-slate-950 px-3 py-1.5 rounded-xl border border-slate-800 text-xs text-slate-200';
    item.innerHTML = `
      <span class="font-medium truncate">${escapeHTML(cat.name)} ${cat.is_active ? '' : '<span class="text-slate-500">(oculta)</span>'}</span>
      <div class="flex items-center gap-1 shrink-0">
        <button onclick="openCategoryModal('${cat.id}')" class="p-1 text-slate-400 hover:text-white"><i class="fa-solid fa-pen text-[10px]"></i></button>
        <button onclick="confirmDeleteCategory('${cat.id}')" class="p-1 text-red-400 hover:text-red-300"><i class="fa-solid fa-trash text-[10px]"></i></button>
      </div>
    `;
    container.appendChild(item);
  });
}

async function handleSaveCategory(event) {
  event.preventDefault();
  const id = document.getElementById('cat-id').value;
  const name = document.getElementById('cat-name').value.trim();
  if (!name) return;

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('categories').update({ name, updated_at: new Date().toISOString() }).eq('id', id));
  } else {
    ({ error } = await supabaseClient.from('categories').insert({ name, sort_order: adminState.categories.length + 1 }));
  }

  if (error) { showToast(friendlyError(error), 'error'); return; }

  document.getElementById('cat-form').reset();
  document.getElementById('cat-id').value = '';
  document.getElementById('modal-cat-title').textContent = 'Nueva Categoría';
  await loadAdminCategoriesAndLinks();
  renderCategoryModalList();
  showToast('Categoría guardada correctamente');
}

function confirmDeleteCategory(id) {
  if (adminState.categories.length <= 1) {
    showToast('Debes mantener al menos una categoría', 'error');
    return;
  }
  if (!confirm('¿Eliminar esta categoría? Los enlaces dentro de ella quedarán sin categoría.')) return;
  deleteCategory(id);
}

async function deleteCategory(id) {
  const { error } = await supabaseClient.from('categories').delete().eq('id', id);
  if (error) { showToast(friendlyError(error), 'error'); return; }
  await loadAdminCategoriesAndLinks();
  renderCategoryModalList();
  showToast('Categoría eliminada');
}

// ============================================================
// REDES SOCIALES
// ============================================================
async function loadAdminSocials() {
  const { data, error } = await supabaseClient.from('socials').select('*').order('sort_order', { ascending: true });
  if (error) { showToast(friendlyError(error), 'error'); return; }
  adminState.socials = data || [];
  renderAdminSocials();
}

function renderAdminSocials() {
  const container = document.getElementById('admin-socials-list');
  container.innerHTML = '';

  if (adminState.socials.length === 0) {
    container.innerHTML = `<p class="text-xs text-slate-400 text-center py-4">No tienes redes sociales agregadas.</p>`;
    return;
  }

  adminState.socials.forEach((s) => {
    const item = document.createElement('div');
    item.className = 'bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between gap-3';
    item.innerHTML = `
      <div class="flex items-center gap-3 truncate">
        <div class="w-8 h-8 rounded-lg bg-slate-900 border border-slate-800 flex items-center justify-center text-purple-400 shrink-0">
          <i class="fa-brands ${escapeHTML(s.icon)}"></i>
        </div>
        <div class="truncate">
          <div class="flex items-center gap-2">
            <span class="font-bold text-xs text-white truncate">${escapeHTML(s.name)}</span>
            <span class="text-[9px] px-1.5 py-0.5 rounded ${s.is_active ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'}">
              ${s.is_active ? 'Visible' : 'Oculto'}
            </span>
          </div>
          <p class="text-[10px] text-slate-400 font-mono truncate">${escapeHTML(s.url)}</p>
        </div>
      </div>
      <div class="flex items-center gap-1.5 shrink-0">
        <button onclick="toggleSocialActive('${s.id}')" class="p-1.5 rounded-lg text-xs ${s.is_active ? 'bg-slate-800 text-emerald-400' : 'bg-slate-800 text-slate-500'}" title="Activar/Desactivar">
          <i class="fa-solid ${s.is_active ? 'fa-eye' : 'fa-eye-slash'}"></i>
        </button>
        <button onclick="openSocialModal('${s.id}')" class="p-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs" title="Editar"><i class="fa-solid fa-pen"></i></button>
        <button onclick="confirmDeleteSocial('${s.id}')" class="p-1.5 bg-red-500/20 text-red-400 rounded-lg text-xs" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
      </div>
    `;
    container.appendChild(item);
  });
}

function openSocialModal(socialId = null) {
  if (socialId) {
    const s = adminState.socials.find((x) => x.id === socialId);
    if (s) {
      document.getElementById('social-id').value = s.id;
      document.getElementById('social-name').value = s.name;
      document.getElementById('social-icon').value = s.icon;
      document.getElementById('social-url').value = s.url;
      document.getElementById('social-active').checked = s.is_active;
      document.getElementById('modal-social-title').textContent = 'Editar Red Social';
    }
  } else {
    document.getElementById('social-form').reset();
    document.getElementById('social-id').value = '';
    document.getElementById('social-active').checked = true;
    document.getElementById('modal-social-title').textContent = 'Nueva Red Social';
  }
  document.getElementById('modal-social').classList.remove('hidden');
}

function closeSocialModal() {
  document.getElementById('modal-social').classList.add('hidden');
}

function setSocialIconPreset(name, iconClass) {
  document.getElementById('social-name').value = name;
  document.getElementById('social-icon').value = iconClass;
}

async function handleSaveSocial(event) {
  event.preventDefault();
  const id = document.getElementById('social-id').value;
  const data = {
    name: document.getElementById('social-name').value.trim(),
    icon: document.getElementById('social-icon').value.trim(),
    url: document.getElementById('social-url').value.trim(),
    is_active: document.getElementById('social-active').checked,
    updated_at: new Date().toISOString(),
  };
  if (!data.name || !data.icon || !data.url) return;

  let error;
  if (id) {
    ({ error } = await supabaseClient.from('socials').update(data).eq('id', id));
  } else {
    data.sort_order = adminState.socials.length + 1;
    ({ error } = await supabaseClient.from('socials').insert(data));
  }

  if (error) { showToast(friendlyError(error), 'error'); return; }

  closeSocialModal();
  await loadAdminSocials();
  showToast('Red social guardada correctamente');
}

async function toggleSocialActive(id) {
  const s = adminState.socials.find((x) => x.id === id);
  if (!s) return;
  const { error } = await supabaseClient.from('socials').update({ is_active: !s.is_active }).eq('id', id);
  if (error) { showToast(friendlyError(error), 'error'); return; }
  await loadAdminSocials();
}

function confirmDeleteSocial(id) {
  if (!confirm('¿Eliminar esta red social?')) return;
  deleteSocial(id);
}

async function deleteSocial(id) {
  const { error } = await supabaseClient.from('socials').delete().eq('id', id);
  if (error) { showToast(friendlyError(error), 'error'); return; }
  await loadAdminSocials();
  showToast('Red social eliminada');
}

// ============================================================
// ESTUDIO DE DISEÑO / TEMAS
// ============================================================
const THEME_PRESETS = {
  midnight: { name: 'Midnight Purple', color: '#7c3aed', vars: { 'bg-type': 'gradient', 'bg-color': '#0b0b0f', 'bg-grad-1': '#0b0b0f', 'bg-grad-2': '#1e1b4b', 'bg-grad-angle': '135deg', 'primary-color': '#7c3aed', 'secondary-color': '#2563eb', 'surface-bg': 'rgba(24, 24, 31, 0.75)', 'text-main': '#f5f5f5', 'verified-badge': '#7c3aed', 'btn-radius': '16px', 'avatar-radius': '9999px', 'cat-color': '#7c3aed' } },
  electric: { name: 'Electric Blue', color: '#3b82f6', vars: { 'bg-type': 'gradient', 'bg-color': '#070913', 'bg-grad-1': '#070913', 'bg-grad-2': '#0f2942', 'bg-grad-angle': '160deg', 'primary-color': '#3b82f6', 'secondary-color': '#06b6d4', 'surface-bg': 'rgba(15, 23, 42, 0.75)', 'text-main': '#f8fafc', 'verified-badge': '#3b82f6', 'btn-radius': '14px', 'avatar-radius': '9999px', 'cat-color': '#3b82f6' } },
  lime: { name: 'Cyber Lime', color: '#84cc16', vars: { 'bg-type': 'solid', 'bg-color': '#0a0c08', 'primary-color': '#84cc16', 'secondary-color': '#10b981', 'surface-bg': 'rgba(20, 26, 16, 0.8)', 'text-main': '#ecfdf5', 'verified-badge': '#84cc16', 'btn-radius': '20px', 'avatar-radius': '24px', 'cat-color': '#84cc16' } },
  sunset: { name: 'Sunset Glow', color: '#f97316', vars: { 'bg-type': 'gradient', 'bg-color': '#0f0a0a', 'bg-grad-1': '#1c0d13', 'bg-grad-2': '#361017', 'bg-grad-angle': '120deg', 'primary-color': '#f97316', 'secondary-color': '#ec4899', 'surface-bg': 'rgba(28, 18, 20, 0.8)', 'text-main': '#fff7ed', 'verified-badge': '#f97316', 'btn-radius': '18px', 'avatar-radius': '9999px', 'cat-color': '#f97316' } },
  minimal: { name: 'Minimal Light', color: '#18181b', vars: { 'bg-type': 'solid', 'bg-color': '#f8fafc', 'primary-color': '#0f172a', 'secondary-color': '#475569', 'surface-bg': '#ffffff', 'text-main': '#0f172a', 'verified-badge': '#2563eb', 'btn-radius': '12px', 'avatar-radius': '9999px', 'cat-color': '#0f172a' } },
  glass: { name: 'Dark Glass', color: '#a855f7', vars: { 'bg-type': 'gradient', 'bg-color': '#030712', 'bg-grad-1': '#0f172a', 'bg-grad-2': '#1e1035', 'bg-grad-angle': '45deg', 'primary-color': '#a855f7', 'secondary-color': '#6366f1', 'surface-bg': 'rgba(255, 255, 255, 0.05)', 'text-main': '#f8fafc', 'verified-badge': '#a855f7', 'btn-radius': '24px', 'avatar-radius': '9999px', 'cat-color': '#a855f7' } },
};

async function loadAdminTheme() {
  const { data, error } = await supabaseClient.from('theme_config').select('variables').eq('id', 1).single();
  if (error) { showToast(friendlyError(error), 'error'); return; }
  adminState.themeVariables = data.variables || {};
  applyThemeVars(adminState.themeVariables, document.getElementById('studio-preview-frame').closest('.studio-frame-wrapper'));
  syncStudioInputsWithState();
}

/** Actualiza el estado local en memoria (NO guarda todavía en Supabase). */
function updateStudioVar(varName, value) {
  adminState.themeVariables[varName] = value;
  applyThemeVars(adminState.themeVariables, document.getElementById('studio-frame-wrapper'));
  syncStudioInputsWithState();
}

function syncStudioInputsWithState() {
  const v = adminState.themeVariables;
  const map = {
    'picker-bg-color': 'bg-color', 'hex-bg-color': 'bg-color',
    'picker-surface-bg': 'surface-bg', 'hex-surface-bg': 'surface-bg',
    'picker-grad-1': 'bg-grad-1', 'picker-grad-2': 'bg-grad-2',
    'picker-avatar-border': 'avatar-border-color', 'hex-avatar-border': 'avatar-border-color',
    'picker-avatar-glow': 'avatar-glow-color', 'hex-avatar-glow': 'avatar-glow-color',
    'picker-text-name': 'text-main', 'picker-text-bio': 'text-muted', 'picker-verified-icon': 'verified-badge',
    'picker-social-icon': 'social-icon-color', 'picker-social-bg': 'social-bg-color', 'picker-social-border': 'social-border-color',
    'picker-btn-bg': 'btn-bg', 'hex-btn-bg': 'btn-bg',
    'picker-btn-text': 'btn-text', 'hex-btn-text': 'btn-text',
    'picker-btn-border': 'btn-border-color', 'hex-btn-border': 'btn-border-color',
    'picker-btn-hover': 'btn-hover-glow', 'hex-btn-hover': 'btn-hover-glow',
    'picker-cat-color': 'cat-color', 'hex-cat-color': 'cat-color',
    'picker-featured-border': 'featured-border', 'hex-featured-border': 'featured-border',
    'picker-featured-badge': 'featured-badge-bg', 'hex-featured-badge': 'featured-badge-bg',
  };
  Object.keys(map).forEach((elId) => {
    const el = document.getElementById(elId);
    if (!el) return;
    const val = v[map[elId]];
    if (val && String(val).startsWith('#')) el.value = val;
  });

  if (document.getElementById('select-font-family')) document.getElementById('select-font-family').value = v['font-family'] || "'Inter', sans-serif";
  if (document.getElementById('select-cat-transform')) document.getElementById('select-cat-transform').value = v['cat-transform'] || 'uppercase';
}

function applyThemePreset(key) {
  const preset = THEME_PRESETS[key];
  if (!preset) return;
  Object.assign(adminState.themeVariables, preset.vars);
  applyThemeVars(adminState.themeVariables, document.getElementById('studio-frame-wrapper'));
  syncStudioInputsWithState();
  showToast(`Tema "${preset.name}" aplicado (recuerda guardar)`);
}

function renderThemePresetsGrid() {
  const container = document.getElementById('presets-grid');
  container.innerHTML = '';
  Object.keys(THEME_PRESETS).forEach((key) => {
    const p = THEME_PRESETS[key];
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.onclick = () => applyThemePreset(key);
    btn.className = 'p-2.5 rounded-xl bg-slate-950 border border-slate-800 text-left hover:border-slate-700 transition flex items-center gap-2';
    btn.innerHTML = `<span class="w-4 h-4 rounded-full shrink-0" style="background-color: ${p.color};"></span><span class="text-xs font-medium text-slate-300 truncate">${p.name}</span>`;
    container.appendChild(btn);
  });
}

function applyButtonStylePreset(type) {
  if (type === 'glass') {
    updateStudioVar('btn-bg', 'rgba(30, 30, 42, 0.7)');
    updateStudioVar('btn-border-color', 'rgba(255, 255, 255, 0.12)');
    updateStudioVar('btn-border-width', '1px');
  } else if (type === 'solid') {
    updateStudioVar('btn-bg', '#1e1b4b');
    updateStudioVar('btn-border-color', 'transparent');
    updateStudioVar('btn-border-width', '0px');
  } else if (type === 'outline') {
    updateStudioVar('btn-bg', 'transparent');
    updateStudioVar('btn-border-color', adminState.themeVariables['primary-color'] || '#7c3aed');
    updateStudioVar('btn-border-width', '2px');
  }
}

/** Renderiza el marco de vista previa clonando el markup público con datos reales. */
function renderStudioPreview() {
  const frame = document.getElementById('studio-preview-frame');
  const p = adminState.profile || {};
  frame.innerHTML = `
    <div class="dynamic-bg-wrapper" style="position:absolute;"><div id="studio-bg-layer" class="dynamic-bg-gradient"></div></div>
    <section class="text-center flex flex-col items-center mb-6 relative z-10">
      <img src="${escapeHTML(p.avatar_url || '')}" class="profile-avatar-frame object-cover shadow-2xl glow-pulse" alt="">
      <h2 class="font-bold tracking-tight text-white flex items-center justify-center gap-2 mt-3" style="font-size: var(--name-size);">
        ${escapeHTML(p.name || '')}
        <i class="fa-solid fa-circle-check text-base" style="color: var(--verified-badge);"></i>
      </h2>
      <p class="text-slate-300 text-sm mt-1.5 max-w-xs leading-relaxed" style="font-size: var(--bio-size); color: var(--text-muted);">${escapeHTML(p.bio || '')}</p>
      <div class="flex flex-wrap justify-center gap-3 mt-5">
        ${adminState.socials.filter((s) => s.is_active).map((s) => `<span class="w-10 h-10 rounded-2xl flex items-center justify-center text-lg" style="background-color: var(--social-bg-color); color: var(--social-icon-color); border: 1px solid var(--social-border-color);"><i class="fa-brands ${escapeHTML(s.icon)}"></i></span>`).join('')}
      </div>
    </section>
    <div class="space-y-6 relative z-10">
      ${adminState.categories.filter((c) => c.is_active !== false).map((cat) => {
        const catLinks = adminState.links.filter((l) => l.category_id === cat.id && l.is_active);
        if (catLinks.length === 0) return '';
        return `
          <div class="space-y-3">
            <h3 class="category-title font-bold px-1">// ${escapeHTML(cat.name)}</h3>
            <div class="space-y-2.5">
              ${catLinks.map((link) => `
                <div class="custom-link-btn w-full p-4 flex items-center justify-between ${link.is_featured ? 'featured-link-card' : ''}">
                  <div class="flex items-center gap-3.5 min-w-0">
                    <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><i class="fa-solid ${escapeHTML(link.icon || 'fa-link')} text-lg"></i></div>
                    <div class="text-left truncate">
                      <span class="font-bold text-sm truncate">${escapeHTML(link.title)}</span>
                      ${link.description ? `<p class="text-xs opacity-75 truncate mt-0.5">${escapeHTML(link.description)}</p>` : ''}
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
  updateBgLayer(document.getElementById('studio-frame-wrapper'));
  const bgLayer = document.getElementById('studio-bg-layer');
  if (bgLayer) {
    const root = document.getElementById('studio-frame-wrapper');
    const bgType = getComputedStyle(root).getPropertyValue('--bg-type').trim();
    bgLayer.className = bgType === 'solid' ? 'dynamic-bg-solid' : bgType === 'image' ? 'dynamic-bg-image' : 'dynamic-bg-gradient';
  }
}

async function handleSaveTheme() {
  const { error } = await supabaseClient
    .from('theme_config')
    .update({ variables: adminState.themeVariables, updated_at: new Date().toISOString() })
    .eq('id', 1);

  if (error) { showToast(friendlyError(error), 'error'); return; }
  showToast('Diseño guardado — index.html ya refleja los cambios');
}

async function handleBgImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.type.startsWith('image/')) { showToast('Selecciona una imagen válida.', 'error'); return; }
  if (file.size > 8 * 1024 * 1024) { showToast('La imagen no debe superar 8MB.', 'error'); return; }

  const ext = file.name.split('.').pop();
  const path = `backgrounds/bg-${Date.now()}.${ext}`;

  const { error: uploadError } = await supabaseClient.storage.from('linktree-media').upload(path, file);
  if (uploadError) { showToast(friendlyError(uploadError), 'error'); return; }

  const { data } = supabaseClient.storage.from('linktree-media').getPublicUrl(path);
  updateStudioVar('bg-image-url', `url('${data.publicUrl}')`);
  updateStudioVar('bg-type', 'image');
  showToast('Imagen de fondo cargada (recuerda guardar)');
}
