// ===== MENU.JS - MULTI-TENANT =====
let products = [];
let cart = {};
let categories = [];
let activeCategory = 'Todos';
let whatsappNumber = '';
let currency = 'COP';
let currentBusinessId = null;
let currentBusinessSlug = null;

function showToast(msg, type = 'success') {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show ' + type;
  setTimeout(() => t.className = 'toast', 3000);
}

// ===== MULTI-TENANT: Resolve business from URL slug =====
async function initBusiness() {
  const slug = getSlugFromUrl();

  if (!slug) {
    // No slug = redirect to landing
    window.location.href = '/';
    return false;
  }

  const business = await getBusinessBySlug(slug);
  if (!business) {
    // Show 404
    const loadingEl = document.getElementById('loadingBizScreen');
    const notFoundEl = document.getElementById('notFoundScreen');
    if (loadingEl) loadingEl.style.display = 'none';
    if (notFoundEl) notFoundEl.style.display = 'flex';
    return false;
  }

  if (business.is_active === false) {
    // Show suspended screen
    document.body.innerHTML = `
      <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100vh;background:#0a0a0a;color:white;font-family:sans-serif;text-align:center;padding:20px;">
        <div style="font-size:4rem;margin-bottom:1rem;">⚠️</div>
        <h1 style="font-size:2rem;margin-bottom:0.5rem;font-weight:bold;">Menú no disponible</h1>
        <p style="color:#9ca3af;">El servicio para este restaurante se encuentra temporalmente suspendido.</p>
      </div>
    `;
    return false;
  }

  currentBusinessId = business.id;
  currentBusinessSlug = business.slug;
  return true;
}

// Load settings filtered by business_id
async function loadSettings() {
  if (!currentBusinessId) return;
  try {
    const { data } = await supabaseClient
      .from('settings')
      .select('*')
      .eq('business_id', currentBusinessId)
      .single();

    if (data) {
      whatsappNumber = data.whatsapp || '';
      currency = data.currency || 'COP';

      // Update page title
      if (data.business_name) {
        document.title = data.business_name + ' | Menú Digital';
        const h1 = document.querySelector('header h1');
        if (h1) h1.textContent = 'MENÚ ' + data.business_name.toUpperCase();
        const subtitle = document.querySelector('header p');
        if (subtitle) subtitle.textContent = data.business_name;
      }

      const logoImg = document.getElementById('logoImg');
      const logoPlaceholder = document.getElementById('logoPlaceholder');
      if (logoImg && data.logo_url) {
        logoImg.src = data.logo_url;
        logoImg.style.display = 'block';
        if (logoPlaceholder) logoPlaceholder.style.display = 'none';
      }

      // Populate tables for en-el-local
      const tableSelect = document.getElementById('customerTable');
      if (tableSelect && data.table_count) {
        let options = '<option value="">Selecciona tu Mesa</option>';
        for (let i = 1; i <= data.table_count; i++) {
          options += `<option value="${i}">Mesa ${i}</option>`;
        }
        tableSelect.innerHTML = options;
      }

      // Check URL for ?mesa=X
      const urlParams = new URLSearchParams(window.location.search);
      const mesaQuery = urlParams.get('mesa');
      if (mesaQuery) {
        const pills = document.querySelectorAll('#customerForm .option-pill');
        const localPill = Array.from(pills).find(p => p.innerText.includes('LOCAL'));
        if (localPill) {
          selectDelivery('En el Local', localPill);
          if (tableSelect) tableSelect.value = mesaQuery;
        }
      }

      // === GENERAR PWA MANIFEST DINÁMICO ===
      try {
        const fallbackIcon = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(data.business_name || 'MP') + '&background=EA580C&color=fff&size=512';
        const iconUrl = data.logo_url || fallbackIcon;
        const bizName = data.business_name || 'Menú Digital';
        
        const manifestContent = {
          name: bizName,
          short_name: bizName,
          start_url: window.location.pathname + window.location.search,
          display: "standalone",
          background_color: "#F8F9FA",
          theme_color: "#EA580C",
          icons: [
            { src: iconUrl, sizes: "192x192", type: "image/png", purpose: "any maskable" },
            { src: iconUrl, sizes: "512x512", type: "image/png", purpose: "any maskable" }
          ]
        };
        
        const blob = new Blob([JSON.stringify(manifestContent)], { type: 'application/json' });
        const manifestURL = URL.createObjectURL(blob);
        const manifestLink = document.getElementById('dynamic-manifest');
        if (manifestLink) manifestLink.setAttribute('href', manifestURL);
      } catch (e) {
        console.warn('No se pudo generar el manifest dinámico', e);
      }
    }
  } catch (err) {
    console.error('Error loading settings:', err);
  }
}

// Load products filtered by business_id
async function loadProducts() {
  if (!currentBusinessId) return;
  const { data } = await supabaseClient
    .from('products')
    .select('*')
    .eq('business_id', currentBusinessId)
    .eq('available', true)
    .order('category');

  products = data || [];
  // Excluir Acompañantes y Acompañantes del dia de las categorías de la landing/tabs principales
  categories = ['Todos', ...new Set(products.map(p => p.category))].filter(c => c !== 'Acompañantes' && c !== 'Acompañantes del dia');
  renderCategories();
  renderMenu();
}

// Render category tabs
function renderCategories() {
  const container = document.getElementById('categoryTabs');
  if (!container) return;
  container.innerHTML = categories.map(c =>
    `<button class="category-tab ${c === activeCategory ? 'active' : ''}" onclick="setCategory('${c}')">${c}</button>`
  ).join('');
}

function setCategory(cat) {
  activeCategory = cat;
  renderCategories();
  renderMenu();
}

function filterProducts() {
  renderMenu();
}

function renderMenu() {
  const searchInput = document.getElementById('searchInput');
  const search = searchInput ? searchInput.value.toLowerCase() : '';
  let filtered = products.filter(p => {
    // Excluir Acompañantes del renderizado del menú principal
    const notAccompaniment = p.category !== 'Acompañantes' && p.category !== 'Acompañantes del dia';
    const matchCat = activeCategory === 'Todos' || p.category === activeCategory;
    const matchSearch = p.name.toLowerCase().includes(search);
    return notAccompaniment && matchCat && matchSearch;
  });

  const container = document.getElementById('menuGrid');
  if (!container) return;

  if (!filtered.length) {
    container.innerHTML = '<div class="empty-state" style="grid-column:1/-1">No se encontraron productos</div>';
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="menu-product-card">
      ${p.image_url ? `<img src="${p.image_url}" alt="${p.name}">` : '<div style="height:140px;background:#eee;display:flex;align-items:center;justify-content:center;font-size:2rem">🍽️</div>'}
      <div class="m-info">
        <h4>${p.name}</h4>
        <div class="m-price">${currency} $${Number(p.price).toLocaleString()}</div>
        <button class="btn-add" onclick="openAccompanimentsModal(${p.id})">Agregar</button>
      </div>
    </div>
  `).join('');
}

// Cart functions
function addToCart(id, accompaniments = []) {
  const key = accompaniments.length ? `${id}_${accompaniments.join(',')}` : String(id);
  if (cart[key]) {
    cart[key].qty++;
  } else {
    cart[key] = { id, qty: 1, accompaniments };
  }
  updateCartUI();
  showToast('✅ Agregado al carrito');
}

function addToCartFromKey(key) {
  if (cart[key]) {
    cart[key].qty++;
    updateCartUI();
    showToast('✅ Agregado al carrito');
    
    const el = document.getElementById('orderDetails');
    if (el && el.style.display !== 'none') {
      el.style.display = 'none';
      toggleOrderDetails();
    }
  }
}

function removeFromCart(key) {
  if (cart[key]) {
    if (cart[key].qty > 1) cart[key].qty--;
    else delete cart[key];
    updateCartUI();
    
    const el = document.getElementById('orderDetails');
    if (el && el.style.display !== 'none') {
      if (Object.keys(cart).length === 0) {
        el.style.display = 'none';
        const form = document.getElementById('customerForm');
        if (form) form.style.display = 'none';
      } else {
        el.style.display = 'none';
        toggleOrderDetails();
      }
    }
  }
}

function updateCartUI() {
  let total = 0;
  for (const [key, item] of Object.entries(cart)) {
    const p = products.find(x => String(x.id) === String(item.id));
    if (p) total += p.price * item.qty;
  }
  const cartTotal = document.getElementById('cartTotal');
  const cartTotalBottom = document.getElementById('cartTotalBottom');
  if (cartTotal) cartTotal.textContent = total.toLocaleString();
  if (cartTotalBottom) cartTotalBottom.textContent = total.toLocaleString();
}

function toggleOrderDetails() {
  if (!Object.keys(cart).length) return showToast('Agrega productos al carrito primero', 'error');
  const el = document.getElementById('orderDetails');
  const form = document.getElementById('customerForm');
  if (!el) return;
  const isOpen = el.style.display !== 'none' && el.style.display !== '';

  if (!isOpen) {
    let html = '';
    for (const [key, item] of Object.entries(cart)) {
      const p = products.find(x => String(x.id) === String(item.id));
      if (!p) continue;
      const displayName = item.accompaniments.length 
        ? `${p.name} <span class="text-xs text-gray-500 block">(Acompañamientos: ${item.accompaniments.join(', ')})</span>`
        : p.name;
      html += `<div class="order-item">
        <span>${displayName}</span>
        <div class="qty-controls">
          <button onclick="removeFromCart('${key}')">−</button>
          <span class="qty">${item.qty}</span>
          <button onclick="addToCartFromKey('${key}')">+</button>
        </div>
      </div>`;
    }
    el.innerHTML = html;
    el.style.display = 'block';
    if (form) form.style.display = 'block';
  } else {
    el.style.display = 'none';
    if (form) form.style.display = 'none';
  }
}

async function processOrder() {
  if (!Object.keys(cart).length) return showToast('Agrega productos al carrito', 'error');
  if (!currentBusinessId) return showToast('Error: negocio no identificado', 'error');

  const name = document.getElementById('customerName').value.trim();
  const phone = document.getElementById('customerPhone').value.trim();
  const notes = document.getElementById('customerNotes').value.trim();
  const delivery = document.getElementById('deliveryMethod')?.value || 'Domicilio';
  const payment = document.getElementById('paymentMethod')?.value || 'Efectivo';

  let finalAddress = '';
  if (delivery === 'Domicilio') {
    finalAddress = document.getElementById('customerAddress')?.value.trim();
    if (!finalAddress) return showToast('⚠️ Por favor ingresa tu dirección', 'error');
  } else {
    const table = document.getElementById('customerTable')?.value;
    if (!table) return showToast('⚠️ Por favor selecciona tu mesa', 'error');
    finalAddress = 'Mesa ' + table;
  }

  if (!name) return showToast('⚠️ Por favor ingresa tu nombre', 'error');
  if (!phone) return showToast('⚠️ Por favor ingresa tu teléfono', 'error');

  const btn = document.getElementById('btnProcessOrder');
  const originalText = btn.innerHTML;
  btn.innerHTML = '⏳ Procesando...';
  btn.disabled = true;

  try {
    await supabaseClient.from('customers').upsert({
      phone, name,
      address: delivery === 'Domicilio' ? finalAddress : '',
      business_id: currentBusinessId
    }, { onConflict: 'phone' });

    let total = 0;
    const orderItems = [];
    for (const [key, item] of Object.entries(cart)) {
      const p = products.find(x => String(x.id) === String(item.id));
      if (!p) continue;
      total += p.price * item.qty;
      const displayName = item.accompaniments.length 
        ? `${p.name} (Acompañamientos: ${item.accompaniments.join(', ')})`
        : p.name;
      orderItems.push({ id: p.id, name: displayName, qty: item.qty, price: p.price });
    }

    const { data: order, error: orderErr } = await supabaseClient.from('orders').insert([{
      customer_phone: phone,
      customer_name: name,
      items: orderItems,
      total,
      delivery_method: delivery,
      payment_method: payment,
      address: finalAddress,
      notes,
      business_id: currentBusinessId
    }]).select().single();

    if (orderErr) throw orderErr;

    window.currentOrderData = { order, items: orderItems };
    showTicket(order, orderItems);
    showToast('✅ Pedido registrado con éxito');
  } catch (err) {
    console.error(err);
    showToast('❌ Error procesando pedido', 'error');
  } finally {
    btn.innerHTML = originalText;
    btn.disabled = false;
  }
}

// Ticket functions
function showTicket(order, items) {
  const elId = document.getElementById('ticketOrderId');
  if (elId) elId.textContent = `#${String(order.id).padStart(4, '0')}`;
  document.getElementById('tName').textContent = order.customer_name;
  document.getElementById('tPhone').textContent = order.customer_phone;
  document.getElementById('tType').textContent = order.delivery_method;

  const addressRow = document.getElementById('tAddressRow');
  const addressEl = document.getElementById('tAddress');
  if (order.delivery_method === 'En el Local') {
    addressRow.style.display = 'flex';
    addressRow.querySelector('span').textContent = 'Ubicación:';
    addressEl.textContent = order.address;
  } else {
    addressRow.style.display = 'flex';
    addressRow.querySelector('span').textContent = 'Dirección:';
    addressEl.textContent = order.address || 'Sin dirección';
  }

  document.getElementById('tPayment').textContent = order.payment_method;
  const itemsContainer = document.getElementById('tItems');
  itemsContainer.innerHTML = items.map(item => `
    <div class="flex justify-between">
      <span>${item.qty}x ${item.name}</span>
      <span>$${(item.price * item.qty).toLocaleString()}</span>
    </div>
  `).join('');
  document.getElementById('tTotal').textContent = `$${Number(order.total).toLocaleString()}`;

  // Tracking link uses slug-based path
  const basePath = window.location.origin;
  const trackingUrl = basePath + '/order-status.html?id=' + order.id;
  const tLinkContainer = document.getElementById('tLinkContainer');
  const tStatusLink = document.getElementById('tStatusLink');
  if (tStatusLink) { tStatusLink.href = trackingUrl; tStatusLink.textContent = trackingUrl; }
  if (tLinkContainer) tLinkContainer.style.display = 'block';
  document.getElementById('ticketModal').style.display = 'flex';
}

function sendTicketWhatsApp() {
  if (!window.currentOrderData) return;
  const { order, items } = window.currentOrderData;
  let msg = `🛒 *NUEVO PEDIDO #${String(order.id).padStart(4, '0')}*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  for (const item of items) {
    msg += `▪️ ${item.name} x${item.qty} — $${(item.price * item.qty).toLocaleString()}\n`;
  }
  msg += `\n💰 *TOTAL: $${Number(order.total).toLocaleString()}*\n━━━━━━━━━━━━━━━━━━━\n\n`;
  msg += `👤 *CLIENTE:* ${order.customer_name}\n📞 *TELÉFONO:* ${order.customer_phone}\n📦 *TIPO:* ${order.delivery_method}\n💳 *PAGO:* ${order.payment_method}\n`;
  if (order.delivery_method === 'Domicilio') msg += `📍 *DIRECCIÓN:* ${order.address}\n`;
  else msg += `🪑 *UBICACIÓN:* ${order.address}\n`;
  if (order.notes) msg += `📝 *NOTAS:* ${order.notes}\n`;

  const trackingUrl = window.location.origin + '/order-status.html?id=' + order.id;
  msg += `\n🔗 *Sigue tu pedido en vivo (1 hora):*\n${trackingUrl}\n`;

  const numero = whatsappNumber ? whatsappNumber.replace(/\D/g, '') : '573001234567';
  window.open(`https://wa.me/${numero}?text=${encodeURIComponent(msg)}`, '_blank');
}

async function downloadTicket() {
  const element = document.getElementById('ticketReceipt');
  try {
    const canvas = await html2canvas(element, { scale: 2, backgroundColor: '#ffffff' });
    const image = canvas.toDataURL("image/png");
    const link = document.createElement('a');
    const orderId = window.currentOrderData ? window.currentOrderData.order.id : '0000';
    link.download = `Ticket_Pedido_${orderId}.png`;
    link.href = image;
    link.click();
  } catch (err) {
    console.error(err);
    showToast('❌ Error al descargar ticket', 'error');
  }
}

function closeTicket() {
  const modal = document.getElementById('ticketModal');
  if (modal) modal.style.display = 'none';
  cart = {};
  updateCartUI();
  toggleOrderDetails();
  window.currentOrderData = null;
}

// ===== INIT =====
(async function init() {
  const ok = await initBusiness();
  if (!ok) return;

  // Hide loading screen
  const loadingEl = document.getElementById('loadingBizScreen');
  if (loadingEl) loadingEl.style.display = 'none';

  await loadSettings();
  await loadProducts();
})();

// ==========================================
// PWA INSTALL LOGIC (PUBLIC MENU)
// ==========================================
let deferredPrompt;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  const btn = document.getElementById('btnInstallMenu');
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
