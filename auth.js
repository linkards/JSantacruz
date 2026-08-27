/* ============================================================
   AUTH.JS
   Login / logout / persistencia de sesión con Supabase Auth.
   La AUTORIZACIÓN real (quién puede escribir) vive en RLS —
   esto solo controla qué ve el usuario en la interfaz.
   ============================================================ */

/** true si el usuario autenticado actualmente está en la tabla admins. */
async function checkIsAdmin() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return false;

  const { data, error } = await supabaseClient
    .from('admins')
    .select('user_id')
    .eq('user_id', user.id)
    .maybeSingle();

  if (error) return false;
  return !!data;
}

async function handleLogin(event) {
  event.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const errorEl = document.getElementById('login-error');
  const btn = document.getElementById('login-submit-btn');

  errorEl.classList.add('hidden');
  btn.disabled = true;
  btn.textContent = 'Ingresando...';

  const { error } = await supabaseClient.auth.signInWithPassword({ email, password });

  if (error) {
    errorEl.textContent = 'Correo o contraseña incorrectos.';
    errorEl.classList.remove('hidden');
    btn.disabled = false;
    btn.textContent = 'Iniciar sesión';
    return;
  }

  await routeByAuthState();
}

async function handleLogout() {
  await supabaseClient.auth.signOut();
  await routeByAuthState();
}

/**
 * Decide qué pantalla mostrar: login, panel, o "no autorizado".
 * Se llama al cargar la página y después de login/logout.
 */
async function routeByAuthState() {
  const loginView = document.getElementById('view-login');
  const deniedView = document.getElementById('view-denied');
  const panelView = document.getElementById('view-panel');

  loginView.classList.add('hidden');
  deniedView.classList.add('hidden');
  panelView.classList.add('hidden');

  const { data: { session } } = await supabaseClient.auth.getSession();

  if (!session) {
    loginView.classList.remove('hidden');
    return;
  }

  const isAdmin = await checkIsAdmin();
  if (!isAdmin) {
    deniedView.classList.remove('hidden');
    return;
  }

  panelView.classList.remove('hidden');
  if (typeof initAdminPanel === 'function') {
    initAdminPanel();
  }
}

// Reacciona a expiración de sesión / login en otra pestaña.
supabaseClient.auth.onAuthStateChange((_event, _session) => {
  routeByAuthState();
});

window.addEventListener('DOMContentLoaded', () => {
  document.getElementById('login-form').addEventListener('submit', handleLogin);
  document.getElementById('logout-btn').addEventListener('click', handleLogout);
  document.getElementById('denied-logout-btn').addEventListener('click', handleLogout);
  routeByAuthState();
});
