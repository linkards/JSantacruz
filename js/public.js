/* ============================================================
   PUBLIC.JS
   Carga el perfil, redes, categorías, enlaces y tema desde
   Supabase, y renderiza la página pública. Nunca muestra
   detalles técnicos ni errores de Supabase al visitante.
   ============================================================ */

/** Escapa texto para insertarlo de forma segura en innerHTML. */
function escapeHTML(str) {
  if (str === null || str === undefined) return '';
  const div = document.createElement('div');
  div.textContent = String(str);
  return div.innerHTML;
}

/**
 * Solo permite esquemas de URL seguros (http/https/mailto/tel).
 * Bloquea "javascript:" y otros esquemas peligrosos.
 */
function safeUrl(url) {
  if (!url) return '#';
  const trimmed = String(url).trim();
  if (/^(https?:|mailto:|tel:)/i.test(trimmed)) return trimmed;
  // Enlaces relativos simples también se permiten.
  if (/^[a-z0-9]/i.test(trimmed) && !trimmed.includes(':')) return trimmed;
  return '#';
}

function showPublicError() {
  const content = document.getElementById('public-content');
  if (content) {
    content.innerHTML = `<p class="public-state-msg">No se pudo cargar el contenido en este momento. Intenta de nuevo en unos minutos.</p>`;
  }
}

async function loadTheme() {
  try {
    const { data, error } = await supabaseClient
      .from('theme_config')
      .select('variables')
      .eq('id', 1)
      .single();
    if (error || !data) return;
    applyThemeVars(data.variables);
  } catch (e) {
    // Si falla, se quedan los valores por defecto de public.css.
  }
}

async function loadProfile() {
  try {
    const { data, error } = await supabaseClient
      .from('profile')
      .select('name, bio, avatar_url')
      .eq('id', 1)
      .single();
    if (error || !data) return;

    const nameEl = document.getElementById('public-name');
    const bioEl = document.getElementById('public-bio');
    const avatarEl = document.getElementById('public-avatar');

    if (nameEl) {
      const span = nameEl.querySelector('span');
      if (span) span.textContent = data.name || '';
    }
    if (bioEl) bioEl.textContent = data.bio || '';
    if (avatarEl) avatarEl.src = data.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=300&q=80';
  } catch (e) {
    // Se conserva el placeholder estático del HTML.
  }
}

async function loadSocials() {
  const container = document.getElementById('public-socials');
  if (!container) return;
  try {
    const { data, error } = await supabaseClient
      .from('socials')
      .select('name, icon, url')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (error || !data) return;

    container.innerHTML = '';
    data.forEach((s) => {
      const a = document.createElement('a');
      a.href = safeUrl(s.url);
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
      a.title = s.name;
      a.className = 'w-10 h-10 rounded-2xl custom-social-btn flex items-center justify-center text-lg hover:scale-105 transition shadow-sm';
      a.style.backgroundColor = 'var(--social-bg-color)';
      a.style.color = 'var(--social-icon-color)';
      a.style.borderColor = 'var(--social-border-color)';
      a.innerHTML = `<i class="fa-brands ${escapeHTML(s.icon)}"></i>`;
      container.appendChild(a);
    });
  } catch (e) {
    // Sin redes visibles si falla; no rompe el resto de la página.
  }
}

async function loadCategoriesAndLinks() {
  const content = document.getElementById('public-content');
  if (!content) return;

  try {
    const [{ data: categories, error: catError }, { data: links, error: linkError }] = await Promise.all([
      supabaseClient.from('categories').select('id, name, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
      supabaseClient.from('links').select('id, category_id, title, description, url, icon, image_url, is_featured, sort_order').eq('is_active', true).order('sort_order', { ascending: true }),
    ]);

    if (catError || linkError || !categories || !links) {
      showPublicError();
      return;
    }

    content.innerHTML = '';

    categories.forEach((cat) => {
      const catLinks = links.filter((l) => l.category_id === cat.id);
      if (catLinks.length === 0) return;

      const sec = document.createElement('div');
      sec.className = 'space-y-3';

      const title = document.createElement('h3');
      title.className = 'category-title font-bold px-1';
      title.textContent = `// ${cat.name}`;
      sec.appendChild(title);

      const list = document.createElement('div');
      list.className = 'space-y-2.5';

      catLinks.forEach((link) => {
        const a = document.createElement('a');
        a.href = safeUrl(link.url);
        a.target = '_blank';
        a.rel = 'noopener noreferrer';
        a.className = `custom-link-btn w-full p-4 flex items-center justify-between group ${link.is_featured ? 'featured-link-card' : ''}`;

        const iconHTML = link.image_url
          ? `<img src="${escapeHTML(link.image_url)}" class="w-full h-full object-cover rounded-xl" alt="">`
          : `<i class="fa-solid ${escapeHTML(link.icon || 'fa-link')} text-lg"></i>`;

        a.innerHTML = `
          <div class="flex items-center gap-3.5 min-w-0">
            <div class="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0 overflow-hidden">
              ${iconHTML}
            </div>
            <div class="text-left truncate">
              <div class="flex items-center gap-2">
                <span class="font-bold text-sm truncate">${escapeHTML(link.title)}</span>
                ${link.is_featured ? `<span class="featured-badge text-[9px] px-2 py-0.5 rounded-full font-extrabold uppercase tracking-wider">Destacado</span>` : ''}
              </div>
              ${link.description ? `<p class="text-xs opacity-75 truncate mt-0.5">${escapeHTML(link.description)}</p>` : ''}
            </div>
          </div>
          <i class="fa-solid fa-chevron-right text-xs opacity-50 group-hover:opacity-100 group-hover:translate-x-1 transition"></i>
        `;
        list.appendChild(a);
      });

      sec.appendChild(list);
      content.appendChild(sec);
    });

    if (!content.children.length) {
      content.innerHTML = `<p class="public-state-msg">Aún no hay enlaces publicados.</p>`;
    }
  } catch (e) {
    showPublicError();
  }
}

async function initPublicPage() {
  document.getElementById('year-span').textContent = new Date().getFullYear();

  try {
    await loadTheme();
    await Promise.all([loadProfile(), loadSocials(), loadCategoriesAndLinks()]);
  } finally {
    // Se revela la página siempre, incluso si algo falló a medio camino
    // (los propios loaders ya muestran su mensaje de error donde aplica).
    const loader = document.getElementById('page-loader');
    const view = document.getElementById('view-public');
    view.classList.add('ready');
    if (loader) {
      loader.style.opacity = '0';
      setTimeout(() => loader.remove(), 350);
    }
  }
}

window.addEventListener('DOMContentLoaded', initPublicPage);
