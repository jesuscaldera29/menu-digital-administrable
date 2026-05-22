// ===== SUPER ADMIN LOGIC =====

// ⚠️ REEMPLAZA ESTO POR EL CORREO QUE USARÁS PARA SER SUPER ADMIN
const SUPER_ADMIN_EMAIL = 'jesuscaldera2000@gmail.com';

let allBusinesses = [];

function showToast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show';
  setTimeout(() => t.className = 'toast', 3000);
}

async function logout() {
  await supabaseClient.auth.signOut();
  window.location.href = 'login.html';
}

async function initSuperAdmin() {
  const session = await getCurrentSession();

  // No session -> redirect to login
  if (!session) {
    window.location.href = 'login.html';
    return;
  }

  const userEmail = session.user.email;

  // Check if it's the super admin
  // To test easily, you can remove the specific email check and just let anyone view it, but in production it's bad.
  // For now, we compare ignoring case.
  if (userEmail.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    document.getElementById('accessDenied').classList.remove('hidden');
    document.getElementById('superAdminPanel').classList.add('hidden');
    
    // MOSTRAR EL ERROR EN PANTALLA
    const errP = document.createElement('p');
    errP.className = "text-yellow-400 mt-4 font-bold text-sm bg-black/50 p-4 rounded-xl";
    errP.innerHTML = `⚠️ Diagnóstico:<br>Iniciaste sesión con: <b>${userEmail}</b><br>El superadmin es: <b>${SUPER_ADMIN_EMAIL}</b>`;
    document.getElementById('accessDenied').appendChild(errP);
    
    console.warn('Acceso denegado: el correo no coincide con SUPER_ADMIN_EMAIL');
    return;
  }

  // Access granted
  document.getElementById('accessDenied').classList.add('hidden');
  document.getElementById('superAdminPanel').classList.remove('hidden');
  document.getElementById('adminEmailText').textContent = userEmail;

  await loadBusinesses();
}

async function loadBusinesses() {
  const tbody = document.getElementById('businessesTableBody');
  tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">Cargando...</td></tr>';

  try {
    const { data, error } = await supabaseClient
      .from('superadmin_businesses_view')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error(error);
      if (error.code === '42P01') {
        tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-400">⚠️ Error: No has ejecutado el script SQL 'update_superadmin.sql' en Supabase.</td></tr>`;
        return;
      }
      throw error;
    }

    allBusinesses = data || [];
    renderBusinesses();
    updateStats();
  } catch (err) {
    showToast('❌ Error cargando restaurantes');
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-10 text-red-500">Error: ${err.message}</td></tr>`;
  }
}

function updateStats() {
  const total = allBusinesses.length;
  const active = allBusinesses.filter(b => b.is_active).length;
  const inactive = total - active;

  document.getElementById('statTotal').textContent = total;
  document.getElementById('statActive').textContent = active;
  document.getElementById('statInactive').textContent = inactive;
}

function renderBusinesses() {
  const tbody = document.getElementById('businessesTableBody');

  if (allBusinesses.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-500">No hay restaurantes registrados aún.</td></tr>';
    return;
  }

  const basePath = window.location.origin;

  tbody.innerHTML = allBusinesses.map(b => {
    const date = new Date(b.created_at).toLocaleDateString();
    const url = `${basePath}/${b.slug}`;
    const statusHtml = b.is_active
      ? `<span class="status-badge status-active">🟢 Activo</span>`
      : `<span class="status-badge status-inactive">🔴 Suspendido</span>`;

    const actionBtn = b.is_active
      ? `<button onclick="toggleStatus('${b.id}', false)" class="btn-toggle btn-deactivate">Bloquear</button>`
      : `<button onclick="toggleStatus('${b.id}', true)" class="btn-toggle btn-activate">Activar</button>`;

    return `
      <tr>
        <td>
          <div class="font-bold text-white text-base">${b.business_name}</div>
          <div class="text-xs text-gray-500 mt-1">Registrado: ${date}</div>
        </td>
        <td>
          <a href="${url}" target="_blank" class="text-orange-400 hover:underline flex items-center gap-1">
            /${b.slug} <span class="text-xs">↗</span>
          </a>
        </td>
        <td>
          <div class="text-gray-300 text-sm">📱 ${b.whatsapp || 'Sin registrar'}</div>
        </td>
        <td>
          <div class="flex gap-3 text-xs">
            <span class="bg-white/5 px-2 py-1 rounded">🍔 ${b.products_count || 0} prod</span>
            <span class="bg-white/5 px-2 py-1 rounded">🛒 ${b.orders_count || 0} ped</span>
          </div>
        </td>
        <td>${statusHtml}</td>
        <td>${actionBtn}</td>
      </tr>
    `;
  }).join('');
}

async function toggleStatus(businessId, newStatus) {
  const confirmMsg = newStatus
    ? "¿Estás seguro de reactivar este restaurante? Volverá a funcionar normal."
    : "⚠️ ¿Estás seguro de SUSPENDER este restaurante? Su menú público y su panel admin quedarán bloqueados.";

  if (!confirm(confirmMsg)) return;

  try {
    const { error } = await supabaseClient
      .from('businesses')
      .update({ is_active: newStatus })
      .eq('id', businessId);

    if (error) throw error;

    showToast(newStatus ? '✅ Restaurante reactivado' : '🛑 Restaurante suspendido');
    await loadBusinesses(); // recargar
  } catch (err) {
    console.error(err);
    showToast('❌ Error actualizando estado. Asegúrate de haber ejecutado el SQL del superadmin.');
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', initSuperAdmin);
