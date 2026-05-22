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
        <td>
          <div class="flex gap-2">
            ${actionBtn}
            <button onclick="openEditModal('${b.id}', '${b.business_name.replace(/'/g, "\\'")}', '${b.slug}')" class="px-3 py-1 bg-blue-900/50 text-blue-400 border border-blue-900 rounded-lg text-sm hover:bg-blue-600 hover:text-white transition-all">✏️ Editar</button>
            <button onclick="deleteBusiness('${b.id}', '${b.business_name.replace(/'/g, "\\'")}')" class="px-3 py-1 bg-red-900/50 text-red-400 border border-red-900 rounded-lg text-sm hover:bg-red-600 hover:text-white transition-all">🗑️ Eliminar</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

async function deleteBusiness(businessId, businessName) {
  const confirmMsg = `⚠️ ADVERTENCIA DE SEGURIDAD ⚠️\n\n¿Estás absolutamente seguro de que quieres ELIMINAR el restaurante "${businessName}"?\n\nEsta acción borrará TODOS sus productos, configuraciones, clientes y pedidos de forma IRREVERSIBLE.`;
  
  if (!confirm(confirmMsg)) return;

  const doubleCheck = prompt(`Para confirmar la eliminación, escribe el nombre del restaurante exacto: ${businessName}`);
  if (doubleCheck !== businessName) {
    showToast('❌ Eliminación cancelada. El nombre no coincide.');
    return;
  }

  try {
    const { error } = await supabaseClient
      .from('businesses')
      .delete()
      .eq('id', businessId);

    if (error) throw error;

    showToast('✅ Restaurante y todos sus datos eliminados.');
    await loadBusinesses(); // recargar
  } catch (err) {
    console.error(err);
    showToast('❌ Error al eliminar: ' + err.message);
  }
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

// ==========================================
// LÓGICA PARA CREAR NUEVO CLIENTE (MODAL)
// ==========================================

// Cliente secundario de Supabase que NO guarda sesión, para no cerrar la sesión del admin.
const supabaseAdminAuth = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  }
});

function openClientModal() {
  document.getElementById('clientModal').classList.remove('hidden');
}

function closeClientModal() {
  document.getElementById('clientModal').classList.add('hidden');
  document.getElementById('createClientForm').reset();
}

function generateNewClientSlug(name) {
  const slug = name.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]/g, '').replace(/\s+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  document.getElementById('newBizSlug').value = slug;
}

async function handleCreateClient(e) {
  e.preventDefault();
  
  const bizName = document.getElementById('newBizName').value.trim();
  const slug = document.getElementById('newBizSlug').value.trim();
  const email = document.getElementById('newBizEmail').value.trim();
  const password = document.getElementById('newBizPassword').value;
  const btn = document.getElementById('btnCreateClient');

  btn.disabled = true;
  btn.textContent = '⏳ Creando cliente...';

  try {
    // 1. Crear usuario en Auth de Supabase con el cliente secundario
    const { data: authData, error: authError } = await supabaseAdminAuth.auth.signUp({
      email,
      password
    });
    
    if (authError) throw authError;
    if (!authData || !authData.user) throw new Error('El correo ya existe o requiere confirmación');

    const userId = authData.user.id;

    // 2. Crear negocio usando la función RPC (usando la sesión principal del Superadmin)
    const { data: bizId, error: bizError } = await supabaseClient.rpc('create_business_with_settings', {
      p_owner_id: userId,
      p_slug: slug,
      p_business_name: bizName
    });

    if (bizError) throw bizError;

    showToast('✅ ¡Cliente creado exitosamente!');
    closeClientModal();
    await loadBusinesses(); // Recargar la tabla

  } catch (err) {
    showToast('❌ Error: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Crear y Guardar';
  }
}

// ==========================================
// LÓGICA PARA EDITAR CLIENTE (MODAL)
// ==========================================

function openEditModal(id, name, slug) {
  document.getElementById('editBizId').value = id;
  document.getElementById('editBizName').value = name;
  document.getElementById('editBizSlug').value = slug;
  document.getElementById('editClientModal').classList.remove('hidden');
}

function closeEditModal() {
  document.getElementById('editClientModal').classList.add('hidden');
  document.getElementById('editClientForm').reset();
}

async function handleEditClient(e) {
  e.preventDefault();
  
  const id = document.getElementById('editBizId').value;
  const name = document.getElementById('editBizName').value.trim();
  const slug = document.getElementById('editBizSlug').value.trim();
  const btn = document.getElementById('btnEditClient');

  btn.disabled = true;
  btn.textContent = '⏳ Guardando...';

  try {
    const { error } = await supabaseClient
      .from('businesses')
      .update({ business_name: name, slug: slug })
      .eq('id', id);

    if (error) throw error;

    showToast('✅ Cambios guardados correctamente.');
    closeEditModal();
    await loadBusinesses(); // Recargar la tabla

  } catch (err) {
    showToast('❌ Error al editar: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Guardar Cambios';
  }
}

// Inicializar
document.addEventListener('DOMContentLoaded', initSuperAdmin);
