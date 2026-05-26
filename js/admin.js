// ===== ADMIN.JS - MULTI-TENANT =====
let allProducts = [];
let allOrders = [];
let currentOrderFilter = 'Todos';
let businessId = null;
let businessSlug = null;

// Toast notification
function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return console.log('Toast:', msg);
    t.textContent = msg;
    t.className = 'toast show ' + type;
    setTimeout(() => t.className = 'toast', 3000);
}

async function logout() {
    await supabaseClient.auth.signOut();
    window.location.href = 'login.html';
}

// AUTH GUARD: Check session and load business
async function initAdmin() {
    const session = await getCurrentSession();
    if (!session) { window.location.href = 'login.html'; return false; }
    const biz = await getCurrentBusiness();
    if (!biz) { alert('No se encontró un negocio asociado a tu cuenta.'); await supabaseClient.auth.signOut(); window.location.href = 'login.html'; return false; }
    
    if (biz.is_active === false) {
        alert('⚠️ Tu cuenta ha sido SUSPENDIDA. Contacta al administrador.');
        await supabaseClient.auth.signOut();
        window.location.href = 'login.html';
        return false;
    }

    businessId = biz.id;
    businessSlug = biz.slug;
    // Update header with business info
    const h1 = document.querySelector('header h1');
    if (h1) h1.textContent = '👨‍🍳 ' + biz.business_name;
    // Update menu link
    const menuLink = document.querySelector('a[href="index.html"]');
    if (menuLink) { menuLink.href = '/' + biz.slug; menuLink.innerHTML = '📱 Ver Menú'; }
    return true;
}

// PREVIEW IMAGE
function previewImage(event) {
    const file = event.target.files[0];
    if (file) {
        const reader = new FileReader();
        reader.onload = function (e) {
            const preview = document.getElementById("prodPreview");
            if (preview) {
                preview.src = e.target.result;
                preview.style.display = "block";
            }
        }
        reader.readAsDataURL(file);
    }
}

// ADD NEW CATEGORY
function addNewCategory() {
    const input = document.getElementById("newCategory");
    const value = input.value.trim();
    if (!value) return showToast("⚠️ Escribe una categoría", "error");

    const select = document.getElementById("prodCategory");
    const exists = [...select.options].some(option => option.value.toLowerCase() === value.toLowerCase());
    if (exists) return showToast("⚠️ Ya existe", "error");

    const option = document.createElement("option");
    option.value = value;
    option.textContent = "📂 " + value;
    select.appendChild(option);
    select.value = value;
    input.value = "";
    showToast("✅ Categoría agregada");
}

// Load settings on page load
async function loadSettings() {
    if (!businessId) return;
    try {
        const { data, error } = await supabaseClient.from('settings').select('*').eq('business_id', businessId).single();
        if (error) throw error;
        if (data) {
            const whatsappInput = document.getElementById('whatsappInput');
            if (whatsappInput) whatsappInput.value = data.whatsapp || '';

            const menuUrlInput = document.getElementById('menuUrlInput');
            if (menuUrlInput) menuUrlInput.value = data.menu_url || '';

            const tableCountInput = document.getElementById('tableCountInput');
            if (tableCountInput) tableCountInput.value = data.table_count || 1;

            const logoPreview = document.getElementById('logoPreview');
            const logoPlaceholder = document.getElementById('logoPlaceholder');
            if (logoPreview && data.logo_url) {
                logoPreview.src = data.logo_url;
                logoPreview.style.display = 'block';
                if (logoPlaceholder) logoPlaceholder.style.display = 'none';
            }
        }
    } catch (err) {
        console.error('Error loading settings:', err);
    }
}

// Upload logo
async function uploadLogo(event) {
    const fileInput = document.getElementById('logoFile');
    const file = fileInput.files[0];
    if (!file) return showToast('⚠️ Selecciona una imagen primero', 'error');

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '⏳ Subiendo...';
    btn.disabled = true;

    const ext = file.name.split('.').pop();
    const fileName = 'logo_' + Date.now() + '.' + ext;

    try {
        const { error: uploadErr } = await supabaseClient.storage.from('images').upload(fileName, file, { upsert: true });
        if (uploadErr) throw uploadErr;

        const { data: urlData } = supabaseClient.storage.from('images').getPublicUrl(fileName);
        const { error: updateErr } = await supabaseClient.from('settings').update({ logo_url: urlData.publicUrl }).eq('business_id', businessId);
        if (updateErr) throw updateErr;

        const logoPreview = document.getElementById('logoPreview');
        const logoPlaceholder = document.getElementById('logoPlaceholder');
        if (logoPreview) {
            logoPreview.src = urlData.publicUrl;
            logoPreview.style.display = 'block';
            if (logoPlaceholder) logoPlaceholder.style.display = 'none';
        }

        showToast('✅ Logo actualizado correctamente');
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Save WhatsApp
async function saveWhatsApp(event) {
    const phone = document.getElementById('whatsappInput').value.trim();
    if (!phone) return showToast('⚠️ Ingresa un número', 'error');

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.from('settings').update({ whatsapp: phone }).eq('business_id', businessId);
        if (error) throw error;
        showToast('✅ Teléfono guardado');
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Save Menu Config (Tables & URL)
async function saveMenuConfig(event) {
    const menuUrl = document.getElementById('menuUrlInput').value.trim();
    const tableCount = parseInt(document.getElementById('tableCountInput').value) || 1;

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '⏳ Guardando...';
    btn.disabled = true;

    try {
        const { error } = await supabaseClient.from('settings').update({ 
            menu_url: menuUrl,
            table_count: tableCount
        }).eq('business_id', businessId);
        
        if (error) throw error;
        showToast('✅ Configuración guardada');
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Generate QR Codes
function generateQRs() {
    const menuUrl = document.getElementById('menuUrlInput').value.trim();
    const tableCount = parseInt(document.getElementById('tableCountInput').value) || 0;

    if (!menuUrl) {
        return showToast('⚠️ Primero debes guardar la URL de tu menú', 'error');
    }

    if (tableCount < 1) {
        return showToast('⚠️ La cantidad de mesas debe ser mayor a 0', 'error');
    }

    const container = document.getElementById('qrContainer');
    container.innerHTML = ''; // Limpiar anteriores

    // 1. QR General (Directo a la página del cliente)
    const qrGeneralCard = document.createElement('div');
    qrGeneralCard.className = 'qr-card';
    qrGeneralCard.innerHTML = `<h3>Menú Digital (Local)</h3><div id="qr-general"></div><p class="mt-2 text-sm text-gray-500">Escanea para ver el menú</p>`;
    container.appendChild(qrGeneralCard);

    new QRCode(document.getElementById('qr-general'), {
        text: menuUrl,
        width: 200,
        height: 200,
        colorDark : "#000000",
        colorLight : "#ffffff",
        correctLevel : QRCode.CorrectLevel.H
    });

    // 2. QRs por cada mesa
    for (let i = 1; i <= tableCount; i++) {
        const qrCard = document.createElement('div');
        qrCard.className = 'qr-card';
        
        const qrId = 'qr-mesa-' + i;
        qrCard.innerHTML = `<h3>Mesa ${i}</h3><div id="${qrId}"></div><p class="mt-2 text-sm text-gray-500">Mesa ${i}</p>`;
        container.appendChild(qrCard);

        // Si la URL ya tiene parámetros (ej ?id=1), usamos &mesa=i, si no ?mesa=i
        const separator = menuUrl.includes('?') ? '&' : '?';
        const tableUrl = `${menuUrl}${separator}mesa=${i}`;

        new QRCode(document.getElementById(qrId), {
            text: tableUrl,
            width: 200,
            height: 200,
            colorDark : "#000000",
            colorLight : "#ffffff",
            correctLevel : QRCode.CorrectLevel.H
        });
    }

    document.getElementById('qrModal').classList.remove('hidden');
}

// Upload product image
async function uploadImage(file) {
    const ext = file.name.split('.').pop();
    const fileName = 'prod_' + Date.now() + '.' + ext;
    try {
        const { error } = await supabaseClient.storage.from('images').upload(fileName, file, { upsert: true });
        if (error) throw error;
        const { data } = supabaseClient.storage.from('images').getPublicUrl(fileName);
        return data.publicUrl;
    } catch (err) {
        showToast('❌ Error subiendo imagen: ' + err.message, 'error');
        return null;
    }
}

// Add product
async function addProduct(event) {
    const name = document.getElementById('prodName').value.trim();
    const price = parseFloat(document.getElementById('prodPrice').value);
    const category = document.getElementById('prodCategory').value.trim();
    const description = document.getElementById('prodDescription').value.trim();
    const accompaniments = document.getElementById('prodAccompaniments').value.trim();
    const file = document.getElementById('prodImage').files[0];

    if (!name || isNaN(price) || !category) return showToast('⚠️ Completa nombre, precio y categoría', 'error');

    const btn = event.target;
    const originalText = btn.innerText;
    btn.innerText = '⏳ Agregando...';
    btn.disabled = true;

    let image_url = '';
    if (file) {
        image_url = await uploadImage(file);
        if (!image_url) {
            btn.innerText = originalText;
            btn.disabled = false;
            return;
        }
    }

    try {
        const { error } = await supabaseClient.from('products').insert([{ 
            name, 
            price, 
            category, 
            description,
            accompaniments,
            image_url,
            business_id: businessId
        }]);
        if (error) throw error;

        showToast('✅ Producto agregado correctamente');
        
        // Clear fields
        document.getElementById('prodName').value = '';
        document.getElementById('prodPrice').value = '';
        document.getElementById('prodCategory').value = '';
        document.getElementById('prodDescription').value = '';
        document.getElementById('prodAccompaniments').value = '';
        document.getElementById('prodImage').value = '';
        document.getElementById('prodPreview').src = '';
        document.getElementById('prodPreview').style.display = 'none';
        
        loadProducts();
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Load products
async function loadProducts() {
    if (!businessId) return;
    try {
        const { data, error } = await supabaseClient.from('products').select('*').eq('business_id', businessId).order('id', { ascending: false });
        if (error) throw error;
        allProducts = data || [];
        renderProducts();
    } catch (err) {
        showToast('Error cargando: ' + (err.message || 'Desconocido'), 'error');
        console.error(err);
    }
}

// Render products grouped by category
function renderProducts() {
    const container = document.getElementById('productsList');
    const totalEl = document.getElementById('totalProducts');
    if (!container) return;

    if (totalEl) {
        totalEl.innerText = `${allProducts.length} productos en total`;
    }

    if (!allProducts.length) {
        container.innerHTML = '<div class="col-span-full py-20 text-center text-gray-400 font-bold">No hay productos aún. Empieza agregando uno. 🍟</div>';
        return;
    }

    // Group by category
    const categories = [...new Set(allProducts.map(p => p.category))];
    
    let html = '';
    categories.forEach(cat => {
        const catProducts = allProducts.filter(p => p.category === cat);
        const emoji = { 'Desayunos': '🍳', 'Almuerzos': '🍛', 'Comidas Rápidas': '🍔', 'Acompañantes': '🍟', 'Bebidas': '🥤', 'Postres': '🍰' }[cat] || '📂';
        
        // Add Category Header
        html += `
        <div class="col-span-full flex items-center gap-4 mt-4 mb-2">
            <h2 class="text-2xl font-black text-orange-600 flex items-center gap-2 whitespace-nowrap">
                <span>${emoji}</span> ${(cat || 'Sin Categoría').toUpperCase()}
            </h2>
            <div class="h-[2px] bg-gray-100 w-full rounded-full"></div>
        </div>`;

        // Add Products for this category
        html += catProducts.map(p => `
        <div class="product-card">
          ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}" class="product-img">` : '<div class="product-img flex items-center justify-center bg-gray-100 text-4xl">🍽️</div>'}
          <div class="p-5">
            <div class="flex justify-between items-start">
                <h3 class="text-xl font-black leading-tight">${p.name}</h3>
                <span class="w-3 h-3 rounded-full ${p.available ? 'bg-green-500' : 'bg-red-500'} shadow-sm mt-1" title="${p.available ? 'Disponible' : 'No disponible'}"></span>
            </div>
            
            <div class="text-red-600 text-2xl font-black mt-2">
                $${Number(p.price).toLocaleString()}
            </div>
            
            <p class="text-gray-500 text-sm mt-2 line-clamp-2 min-h-[40px]">
                ${p.description || 'Sin descripción disponible.'}
            </p>
            ${p.accompaniments ? `<p class="text-xs text-orange-600 font-bold mt-1">🍟 Acompañamientos: ${p.accompaniments}</p>` : ''}

            <div class="grid grid-cols-2 gap-2 mt-5">
              <button class="col-span-2 ${p.available ? 'bg-gray-800' : 'bg-green-600'} text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all" onclick="toggleAvailable('${p.id}', ${p.available})">
                ${p.available ? '❌ Desactivar' : '✅ Activar'}
              </button>
              <button class="bg-blue-600 text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all" onclick="openEdit('${p.id}')">✏️ Editar</button>
              <button class="bg-red-500 text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all" onclick="deleteProduct('${p.id}')">🗑️ Eliminar</button>
              <button class="col-span-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider active:scale-95 transition-all flex items-center justify-center gap-2" onclick="openPostModal('${p.id}')">
                📢 Generar Post de Venta
              </button>
            </div>
          </div>
        </div>
      `).join('');
    });

    container.innerHTML = html;
}

// Toggle availability
async function toggleAvailable(id, current) {
    try {
        const { error } = await supabaseClient.from('products').update({ available: !current }).eq('id', id);
        if (error) throw error;
        showToast(current ? '❌ Producto desactivado' : '✅ Producto activado');
        loadProducts();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Delete product
async function deleteProduct(id) {
    if (!confirm('¿Eliminar este producto?')) return;
    try {
        const { error } = await supabaseClient.from('products').delete().eq('id', id);
        if (error) throw error;
        showToast('🗑️ Producto eliminado');
        loadProducts();
    } catch (err) {
        showToast('Error: ' + err.message, 'error');
    }
}

// Open edit modal
function openEdit(id) {
    const p = allProducts.find(x => String(x.id) === String(id));
    if (!p) return;
    document.getElementById('editId').value = p.id;
    document.getElementById('editName').value = p.name;
    document.getElementById('editPrice').value = p.price;
    document.getElementById('editCategory').value = p.category;
    document.getElementById('editDescription').value = p.description || '';
    document.getElementById('editAccompaniments').value = p.accompaniments || '';
    document.getElementById('editImage').value = '';
    
    const preview = document.getElementById('editPreview');
    if (p.image_url) {
        preview.src = p.image_url;
        preview.style.display = 'block';
    } else {
        preview.src = '';
        preview.style.display = 'none';
    }
    document.getElementById('editModal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('editModal').style.display = 'none';
}

// Save edit
async function saveEdit() {
    const id = document.getElementById('editId').value;
    const name = document.getElementById('editName').value.trim();
    const price = parseFloat(document.getElementById('editPrice').value);
    const category = document.getElementById('editCategory').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const accompaniments = document.getElementById('editAccompaniments').value.trim();
    const file = document.getElementById('editImage').files[0];

    if (!name || isNaN(price) || !category) return showToast('⚠️ Completa todos los campos', 'error');

    const updateData = { name, price, category, description, accompaniments };
    if (file) {
        showToast('⏳ Subiendo imagen...');
        const url = await uploadImage(file);
        if (!url) return;
        updateData.image_url = url;
    }

    try {
        const { error } = await supabaseClient.from('products').update(updateData).eq('id', id);
        if (error) throw error;
        showToast('✅ Producto actualizado correctamente');
        closeModal();
        loadProducts();
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    }
}

// Tab Management
function showSection(sectionId, event) {
    event = event || window.event;
    document.querySelectorAll('.section-content').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-tab').forEach(t => t.classList.remove('active'));
    
    document.getElementById(`section-${sectionId}`).classList.add('active');
    if (event && event.target) event.target.classList.add('active');

    if (sectionId === 'orders') loadOrders();
    if (sectionId === 'customers') loadCustomers();
    if (sectionId === 'reports') initReports();
}

// Load orders
async function loadOrders() {
    try {
        const { data, error } = await supabaseClient.from('orders').select('*').eq('business_id', businessId).order('created_at', { ascending: false });
        if (error) throw error;
        allOrders = data || [];
        renderOrders();
    } catch (err) {
        console.error('Error loading orders:', err);
        showToast('Error cargando pedidos', 'error');
    }
}

// Render orders with active filter
function renderOrders() {
    const container = document.getElementById('ordersList');
    if (!container) return;

    let filtered = allOrders;
    if (currentOrderFilter !== 'Todos') {
        filtered = allOrders.filter(o => (o.status || 'Pendiente') === currentOrderFilter);
    }

    if (!filtered.length) {
        container.innerHTML = `<tr><td colspan="7" class="text-center py-10 text-gray-400">No hay pedidos ${currentOrderFilter !== 'Todos' ? 'con estado ' + currentOrderFilter : 'registrados'}</td></tr>`;
        return;
    }

    container.innerHTML = filtered.map(o => {
        const status = o.status || 'Pendiente';
        return `
            <tr>
                <td class="font-bold text-orange-600">#${String(o.id).padStart(4, '0')}</td>
                <td>
                    <div class="font-bold">${o.customer_name}</div>
                    <div class="text-xs text-gray-400">${o.customer_phone}</div>
                </td>
                <td class="text-xs">${new Date(o.created_at).toLocaleString()}</td>
                <td class="font-black">$${Number(o.total).toLocaleString()}</td>
                <td><span class="text-[10px] bg-gray-100 px-2 py-1 rounded-full font-bold uppercase">${o.payment_method}</span></td>
                <td>${getStatusBadge(status)}</td>
                <td>
                    <div class="flex items-center gap-2">
                        <select onchange="updateOrderStatus(${o.id}, this.value)" class="bg-gray-50 border border-gray-250 text-gray-950 text-xs font-bold rounded-lg p-1.5 focus:outline-none focus:ring-1 focus:ring-orange-500">
                            <option value="Pendiente" ${status === 'Pendiente' ? 'selected' : ''}>⏳ Pendiente</option>
                            <option value="Confirmado" ${status === 'Confirmado' ? 'selected' : ''}>✅ Confirmado</option>
                            <option value="Preparando" ${status === 'Preparando' ? 'selected' : ''}>👨‍🍳 Preparando</option>
                            <option value="Entregado" ${status === 'Entregado' ? 'selected' : ''}>🚚 Entregado</option>
                        </select>
                        <button onclick="viewOrderDetail(${o.id})" class="bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm">Ver detalles</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// Get status badge HTML
function getStatusBadge(status) {
    status = status || 'Pendiente';
    switch(status) {
        case 'Confirmado':
            return `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-blue-100 text-blue-800">✅ Confirmado</span>`;
        case 'Preparando':
            return `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-purple-100 text-purple-800">👨‍🍳 Preparando</span>`;
        case 'Entregado':
            return `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-green-100 text-green-800">🚚 Entregado</span>`;
        case 'Pendiente':
        default:
            return `<span class="px-2.5 py-1 text-xs font-bold rounded-full bg-yellow-100 text-yellow-800">⏳ Pendiente</span>`;
    }
}

// Filter orders by status tab
function filterOrdersByStatus(status) {
    currentOrderFilter = status;
    
    // Toggle active state in buttons
    document.querySelectorAll('.order-filter-btn').forEach(btn => {
        if (btn.getAttribute('onclick').includes(`'${status}'`)) {
            btn.classList.add('active');
        } else {
            btn.classList.remove('active');
        }
    });

    renderOrders();
}

// Update order status in Supabase
async function updateOrderStatus(orderId, newStatus) {
    try {
        const { error } = await supabaseClient.from('orders').update({ status: newStatus }).eq('id', orderId);
        if (error) throw error;
        
        // Update local list without re-fetching everything
        const order = allOrders.find(o => o.id === orderId);
        if (order) order.status = newStatus;
        
        showToast('✅ Estado del pedido actualizado');
        renderOrders();
    } catch (err) {
        console.error('Error updating order status:', err);
        showToast('❌ Error al actualizar estado: ' + err.message, 'error');
    }
}

function viewOrderDetail(id) {
    const o = allOrders.find(x => x.id === id);
    if (!o) return;

    window.currentActiveDetailOrder = o;

    document.getElementById('detailOrderTitle').textContent = `📋 Pedido #${String(o.id).padStart(4, '0')}`;
    document.getElementById('detailCustomerName').textContent = o.customer_name;
    document.getElementById('detailCustomerPhone').textContent = o.customer_phone;
    document.getElementById('detailDeliveryMethod').textContent = o.delivery_method || 'Domicilio';
    document.getElementById('detailAddress').textContent = o.address || 'Sin dirección';
    document.getElementById('detailPaymentMethod').textContent = o.payment_method || 'Efectivo';
    document.getElementById('detailNotes').textContent = o.notes || 'Ninguna';

    const items = o.items || [];
    const container = document.getElementById('detailProducts');
    container.innerHTML = items.map(item => `
        <div class="flex justify-between py-1 border-b border-gray-50">
            <span>${item.name} <strong class="text-orange-600">x${item.qty}</strong></span>
            <span class="font-bold">$${Number(item.price * item.qty).toLocaleString()}</span>
        </div>
    `).join('');

    document.getElementById('detailTotal').textContent = `$${Number(o.total).toLocaleString()}`;

    // Generar enlace de seguimiento
    const trackingUrl = window.location.origin + window.location.pathname.replace(/\/[^\/]*$/, '') + '/order-status.html?id=' + o.id;
    document.getElementById('detailTrackingUrl').value = trackingUrl;

    document.getElementById('orderDetailModal').style.display = 'flex';
}

function closeOrderDetailModal() {
    document.getElementById('orderDetailModal').style.display = 'none';
    window.currentActiveDetailOrder = null;
}

function sendTrackingLinkWhatsApp() {
    const o = window.currentActiveDetailOrder;
    if (!o) return;
    
    const trackingUrl = document.getElementById('detailTrackingUrl').value;
    const cleanPhone = o.customer_phone.replace(/\D/g, '');
    
    let msg = `Hola *${o.customer_name}*, el estado de tu pedido *#${String(o.id).padStart(4, '0')}* en *Tronco E' Filo* ha sido actualizado.\n\n`;
    msg += `Puedes ver su progreso en tiempo real aquí (enlace temporal válido por 1 hora):\n${trackingUrl}`;
    
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
}

// Load customers
async function loadCustomers() {
    try {
        const { data, error } = await supabaseClient.from('customers').select('*').eq('business_id', businessId).order('name');
        if (error) throw error;

        const container = document.getElementById('customersList');
        if (!data.length) {
            container.innerHTML = '<tr><td colspan="6" class="text-center py-10 text-gray-400">No hay clientes registrados</td></tr>';
            return;
        }

        container.innerHTML = data.map(c => `
            <tr>
                <td class="text-center">
                  <input type="checkbox" class="customer-checkbox w-5 h-5 accent-red-500 rounded cursor-pointer" value="${c.id}">
                </td>
                <td class="font-bold">${c.name}</td>
                <td><a href="https://wa.me/${c.phone.replace(/\D/g, '')}" target="_blank" class="text-green-600 font-bold">📱 ${c.phone}</a></td>
                <td class="text-xs text-gray-500">${c.address || 'Sin dirección'}</td>
                <td class="text-xs">${new Date(c.created_at).toLocaleDateString()}</td>
                <td class="text-center">
                  <button onclick="deleteCustomer('${c.id}')" class="text-red-500 hover:text-red-700 font-bold p-2 bg-red-50 hover:bg-red-100 rounded-xl transition-all">🗑️ Eliminar</button>
                </td>
            </tr>
        `).join('');
    } catch (err) {
        showToast('Error cargando clientes', 'error');
    }
}

// Delete single customer
async function deleteCustomer(id) {
    if (!confirm('¿Estás seguro de eliminar este cliente? Esta acción no se puede deshacer.')) return;
    try {
        const { error } = await supabaseClient.from('customers').delete().eq('id', id);
        if (error) throw error;
        showToast('✅ Cliente eliminado');
        loadCustomers();
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    }
}

// Toggle all checkboxes
function toggleAllCustomers(source) {
    const checkboxes = document.querySelectorAll('.customer-checkbox');
    checkboxes.forEach(cb => cb.checked = source.checked);
}

// Delete selected customers
async function deleteSelectedCustomers() {
    const checkboxes = document.querySelectorAll('.customer-checkbox:checked');
    const ids = Array.from(checkboxes).map(cb => cb.value);
    
    if (ids.length === 0) return showToast('⚠️ Selecciona al menos un cliente', 'error');
    if (!confirm(`¿Eliminar ${ids.length} clientes seleccionados?`)) return;

    try {
        const { error } = await supabaseClient.from('customers').delete().in('id', ids);
        if (error) throw error;
        showToast(`✅ ${ids.length} clientes eliminados`);
        
        const selectAll = document.getElementById('selectAllCustomers');
        if (selectAll) selectAll.checked = false;
        
        loadCustomers();
    } catch (err) {
        showToast('❌ Error: ' + err.message, 'error');
    }
}

// Reports logic
function initReports() {
    const today = new Date().toISOString().split('T')[0];
    document.getElementById('reportEndDate').value = today;
    
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    document.getElementById('reportStartDate').value = lastMonth.toISOString().split('T')[0];
    
    generateReport();
}

async function generateReport() {
    const start = document.getElementById('reportStartDate').value;
    const end = document.getElementById('reportEndDate').value;

    if (!start || !end) return showToast('Selecciona un rango de fechas', 'error');

    try {
        const endDateTime = end + 'T23:59:59';
        
        const { data, error } = await supabaseClient.from('orders')
            .select('*')
            .eq('business_id', businessId)
            .gte('created_at', start)
            .lte('created_at', endDateTime);

        if (error) throw error;

        let totalSales = 0;
        let orderCount = data.length;
        
        data.forEach(o => totalSales += Number(o.total));

        document.getElementById('reportTotalSales').textContent = `$${totalSales.toLocaleString()}`;
        document.getElementById('reportOrderCount').textContent = orderCount;
        document.getElementById('reportAverageOrder').textContent = `$${(orderCount > 0 ? (totalSales / orderCount) : 0).toLocaleString(undefined, {maximumFractionDigits:0})}`;

        const summaryContainer = document.getElementById('reportSummary');
        if (orderCount === 0) {
            summaryContainer.innerHTML = 'No hubo ventas en este período 😕';
        } else {
            summaryContainer.innerHTML = `
                <div class="text-black">
                    <p class="text-lg">Resultados del <span class="font-bold">${new Date(start).toLocaleDateString()}</span> al <span class="font-bold">${new Date(end).toLocaleDateString()}</span></p>
                    <p class="mt-2 text-gray-500">Se han procesado correctamente todos los registros en el sistema.</p>
                </div>
            `;
        }
    } catch (err) {
        showToast('Error generando reporte', 'error');
    }
}

// SALES POST GENERATOR
function openPostModal(id) {
    const p = allProducts.find(x => String(x.id) === String(id));
    if (!p) return;

    document.getElementById('postName').innerText = p.name;
    document.getElementById('postPrice').innerText = `$${Number(p.price).toLocaleString()}`;
    document.getElementById('postDesc').innerText = p.description || '¡No te quedes sin probarlo! Calidad y sabor garantizado.';
    
    const postImg = document.getElementById('postImage');
    if (p.image_url) {
        // Para evitar problemas de CORS con html2canvas, intentamos cargar la imagen con crossOrigin
        postImg.crossOrigin = "anonymous";
        postImg.src = p.image_url;
    } else {
        postImg.src = 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?q=80&w=360&auto=format&fit=crop';
    }

    const whatsapp = document.getElementById('whatsappInput').value || '573001234567';
    document.getElementById('postPhone').innerText = whatsapp;

    // Logo
    const logoUrl = document.getElementById('logoPreview').src;
    const postLogo = document.getElementById('postLogo');
    const postLogoEmoji = document.getElementById('postLogoEmoji');
    
    if (logoUrl && !logoUrl.includes('hidden')) {
        postLogo.src = logoUrl;
        postLogo.classList.remove('hidden');
        postLogoEmoji.classList.add('hidden');
    } else {
        postLogo.classList.add('hidden');
        postLogoEmoji.classList.remove('hidden');
    }

    document.getElementById('postModal').style.display = 'flex';
}

function closePostModal() {
    document.getElementById('postModal').style.display = 'none';
}

async function downloadPost(e) {
    const btn = e.target;
    const originalText = btn.innerText;
    btn.innerText = '⏳ Procesando...';
    btn.disabled = true;

    try {
        const postElement = document.getElementById('salesPost');
        const canvas = await html2canvas(postElement, {
            useCORS: true,
            scale: 2, // Mejor calidad
            backgroundColor: null,
            logging: false
        });

        const image = canvas.toDataURL("image/png");
        const link = document.createElement('a');
        link.download = `post_${document.getElementById('postName').innerText.toLowerCase().replace(/\s+/g, '_')}.png`;
        link.href = image;
        link.click();
        
        showToast('✅ Imagen generada y descargada');
    } catch (err) {
        console.error(err);
        showToast('❌ Error al generar imagen', 'error');
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
}

// Init with auth guard
document.addEventListener('DOMContentLoaded', async () => {
    const ok = await initAdmin();
    if (!ok) return;
    await loadSettings();
    await loadProducts();
});

async function logout() { await supabaseClient.auth.signOut(); window.location.href = 'login.html'; }


// ==========================================
// PWA INSTALL LOGIC
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstallApp');
  if(btn) {
    btn.classList.remove('hidden');
    btn.addEventListener('click', async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        console.log('App instalada');
      }
      deferredPrompt = null;
      btn.classList.add('hidden');
    });
  }
});

