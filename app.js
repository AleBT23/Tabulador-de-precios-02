/**
 * app.js
 * Main application controller for ArchiQuote Pro.
 * Manages all UI interactions, state, and module coordination.
 */

/* ─────────────────────────────────────────────
   APP STATE
───────────────────────────────────────────── */
const AppState = {
  currentSection: 'dashboard',
  services:   [],
  proposals:  [],
  settings:   {},
  editingProposalId: null,
  proposalItems: [],      // Line items for the current proposal being edited
};

/* ─────────────────────────────────────────────
   INITIALISATION
───────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  // Load persisted data
  AppState.settings  = loadSettings();
  AppState.services  = loadServices();
  AppState.proposals = loadProposals();

  // Render initial view
  renderNav();
  navigateTo('dashboard');

  // Nav click handlers
  document.querySelectorAll('.nav-item').forEach(el => {
    el.addEventListener('click', () => navigateTo(el.dataset.section));
  });

  // Mobile hamburger
  const burger = document.getElementById('btn-hamburger');
  const sidebar = document.getElementById('sidebar');
  if (burger && sidebar) {
    burger.addEventListener('click', () => sidebar.classList.toggle('open'));
    document.addEventListener('click', (e) => {
      if (sidebar.classList.contains('open') && !sidebar.contains(e.target) && e.target !== burger) {
        sidebar.classList.remove('open');
      }
    });
  }
});

/* ─────────────────────────────────────────────
   NAVIGATION
───────────────────────────────────────────── */
function navigateTo(section) {
  AppState.currentSection = section;

  // Update active nav
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.section === section);
  });

  // Close mobile sidebar
  document.getElementById('sidebar')?.classList.remove('open');

  // Render appropriate section
  const main = document.getElementById('main-content');
  switch (section) {
    case 'dashboard':   renderDashboard(main); break;
    case 'tabulator':   renderTabulator(main); break;
    case 'proposal':    renderProposalEditor(main, null); break;
    case 'history':     renderHistory(main); break;
    case 'settings':    renderSettings(main); break;
    default: main.innerHTML = '<p>Sección no encontrada.</p>';
  }
}

function renderNav() {
  // Nav items are already in HTML; just ensure data attributes match
}

/* ─────────────────────────────────────────────
   FORMAT HELPERS
───────────────────────────────────────────── */
function fmt(value) {
  const sym = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';
  return `${sym}${Number(value).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function fmtDateDisplay(dateStr) {
  const d = new Date(dateStr);
  if (isNaN(d)) return dateStr || '—';
  return d.toLocaleDateString('es-MX', { year: 'numeric', month: 'short', day: 'numeric' });
}

function unitLabel(unitVal) {
  return CONFIG.UNIT_TYPES.find(u => u.value === unitVal)?.label || unitVal || '—';
}

function escHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;');
}

/* ─────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────── */
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ'}</span>
    <span>${escHtml(message)}</span>
  `;
  container.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('visible'));
  setTimeout(() => {
    toast.classList.remove('visible');
    setTimeout(() => toast.remove(), 350);
  }, 3000);
}

/* ─────────────────────────────────────────────
   CONFIRMATION DIALOG
───────────────────────────────────────────── */
function showConfirm(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-box" role="dialog" aria-modal="true">
        <p class="modal-msg">${escHtml(message)}</p>
        <div class="modal-actions">
          <button class="btn btn-ghost" id="confirm-cancel">Cancelar</button>
          <button class="btn btn-danger" id="confirm-ok">Eliminar</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('visible'));
    overlay.querySelector('#confirm-cancel').addEventListener('click', () => { overlay.remove(); resolve(false); });
    overlay.querySelector('#confirm-ok').addEventListener('click',     () => { overlay.remove(); resolve(true);  });
  });
}

/* ─────────────────────────────────────────────
   ① DASHBOARD
───────────────────────────────────────────── */
function renderDashboard(container) {
  AppState.proposals = loadProposals();
  const stats = computeStats();
  const sym   = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';

  // Build monthly chart data
  const months = Object.entries(stats.monthly);
  const maxVal  = Math.max(...months.map(([,v]) => v.value), 1);

  const barHtml = months.map(([key, data]) => {
    const [y, m] = key.split('-');
    const monthName = new Date(+y, +m - 1, 1).toLocaleDateString('es-MX', { month: 'short' });
    const pct = (data.value / maxVal * 100).toFixed(1);
    return `
      <div class="chart-bar-group">
        <div class="chart-bar-wrap">
          <div class="chart-bar" style="height:${pct}%" title="${sym}${data.value.toLocaleString('es-MX')}">
            <span class="chart-bar-tip">${sym}${(data.value/1000).toFixed(0)}k</span>
          </div>
        </div>
        <span class="chart-label">${monthName}</span>
        <span class="chart-count">${data.count}</span>
      </div>`;
  }).join('');

  // Recent proposals list
  const recent = AppState.proposals.slice(0, 5);
  const recentHtml = recent.length === 0
    ? '<p class="empty-state">Aún no hay propuestas generadas.</p>'
    : recent.map(p => `
        <div class="recent-row" data-id="${p.id}">
          <div class="recent-meta">
            <span class="recent-num">${escHtml(p.proposalNumber)}</span>
            <span class="recent-client">${escHtml(p.clientName)}</span>
          </div>
          <div class="recent-right">
            <span class="recent-total">${fmt(p.grandTotal)}</span>
            <span class="recent-date">${fmtDateDisplay(p.createdAt)}</span>
          </div>
        </div>`).join('');

  container.innerHTML = `
    <div class="section-header">
      <h1>Dashboard</h1>
      <span class="section-sub">Resumen general de actividad</span>
    </div>

    <div class="stat-grid">
      <div class="stat-card">
        <div class="stat-icon">📋</div>
        <div class="stat-info">
          <span class="stat-value">${stats.total}</span>
          <span class="stat-label">Propuestas creadas</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">💰</div>
        <div class="stat-info">
          <span class="stat-value">${fmt(stats.totalValue)}</span>
          <span class="stat-label">Total cotizado</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">📊</div>
        <div class="stat-info">
          <span class="stat-value">${fmt(stats.avgValue)}</span>
          <span class="stat-label">Promedio por propuesta</span>
        </div>
      </div>
      <div class="stat-card">
        <div class="stat-icon">⭐</div>
        <div class="stat-info">
          <span class="stat-value">${escHtml(stats.topService)}</span>
          <span class="stat-label">Servicio más cotizado</span>
        </div>
      </div>
    </div>

    <div class="dashboard-row">
      <div class="card dashboard-chart">
        <div class="card-header">
          <h2>Propuestas por mes</h2>
          <span class="badge">Últimos 6 meses</span>
        </div>
        <div class="chart-wrap">
          <div class="chart-bars">${barHtml}</div>
        </div>
      </div>

      <div class="card dashboard-recent">
        <div class="card-header">
          <h2>Recientes</h2>
          <button class="btn btn-sm btn-ghost" onclick="navigateTo('history')">Ver todo →</button>
        </div>
        ${recentHtml}
      </div>
    </div>
  `;

  // Make recent rows clickable
  container.querySelectorAll('.recent-row').forEach(row => {
    row.addEventListener('click', () => {
      navigateTo('history');
    });
  });
}

/* ─────────────────────────────────────────────
   ② PRICING TABULATOR
───────────────────────────────────────────── */
function renderTabulator(container) {
  AppState.services = loadServices();

  const rowsHtml = AppState.services.map(svc => buildServiceRow(svc)).join('');

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Tabulador de Precios</h1>
        <span class="section-sub">Administra el catálogo de servicios</span>
      </div>
      <button class="btn btn-primary" id="btn-add-service">+ Agregar Servicio</button>
    </div>

    <div class="card calculator-card">
      <div class="card-header">
        <h2>Calculadora Rápida por m²</h2>
      </div>
      <div class="calc-row">
        <div class="field-group">
          <label for="calc-area">Área del proyecto (m²)</label>
          <input type="number" id="calc-area" placeholder="Ej. 150" min="0" step="0.01"/>
        </div>
        <button class="btn btn-secondary" id="btn-calc">Calcular</button>
      </div>
      <div id="calc-results" class="calc-results hidden"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>Catálogo de Servicios</h2>
        <div class="search-wrap">
          <input type="search" id="svc-search" placeholder="Buscar servicio…" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table" id="services-table">
          <thead>
            <tr>
              <th>Servicio</th>
              <th>Unidad</th>
              <th>Precio</th>
              <th>Descripción</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="services-tbody">
            ${rowsHtml}
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Event: add service
  document.getElementById('btn-add-service').addEventListener('click', () => openServiceModal(null));

  // Event: quick calc
  document.getElementById('btn-calc').addEventListener('click', runAreaCalculator);
  document.getElementById('calc-area').addEventListener('keydown', e => { if (e.key === 'Enter') runAreaCalculator(); });

  // Event: search
  document.getElementById('svc-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#services-tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  // Delegate row actions
  document.getElementById('services-tbody').addEventListener('click', handleServiceAction);
}

function buildServiceRow(svc) {
  const sym = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';
  return `
    <tr data-id="${svc.id}" class="${svc.active ? '' : 'row-inactive'}">
      <td data-label="Servicio"><strong>${escHtml(svc.name)}</strong></td>
      <td data-label="Unidad">${unitLabel(svc.unit)}</td>
      <td data-label="Precio">${sym}${Number(svc.price).toLocaleString('es-MX', {minimumFractionDigits:2})}</td>
      <td data-label="Descripción" class="desc-cell">${escHtml(svc.description)}</td>
      <td data-label="Estado">
        <span class="badge ${svc.active ? 'badge-active' : 'badge-inactive'}">${svc.active ? 'Activo' : 'Inactivo'}</span>
      </td>
      <td data-label="Acciones" class="actions-cell">
        <button class="icon-btn" data-action="edit"   title="Editar">✎</button>
        <button class="icon-btn" data-action="toggle" title="${svc.active ? 'Desactivar' : 'Activar'}">⏻</button>
        <button class="icon-btn danger" data-action="delete" title="Eliminar">✕</button>
      </td>
    </tr>`;
}

async function handleServiceAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id  = row?.dataset.id;
  const svc = AppState.services.find(s => s.id === id);
  if (!svc) return;

  if (btn.dataset.action === 'edit')   openServiceModal(svc);
  if (btn.dataset.action === 'toggle') {
    svc.active = !svc.active;
    upsertService(svc);
    AppState.services = loadServices();
    row.outerHTML = buildServiceRow(svc);
    showToast(`Servicio ${svc.active ? 'activado' : 'desactivado'}.`);
  }
  if (btn.dataset.action === 'delete') {
    const ok = await showConfirm(`¿Eliminar el servicio "${svc.name}"?`);
    if (ok) {
      deleteService(id);
      AppState.services = loadServices();
      row.remove();
      showToast('Servicio eliminado.', 'error');
    }
  }
}

function runAreaCalculator() {
  const area = parseFloat(document.getElementById('calc-area').value);
  const resultsEl = document.getElementById('calc-results');
  if (!area || area <= 0) { showToast('Ingresa un área válida.', 'error'); return; }

  const m2Services = AppState.services.filter(s => s.active && s.unit === 'm2');
  if (m2Services.length === 0) {
    resultsEl.innerHTML = '<p>No hay servicios activos por m² en el catálogo.</p>';
  } else {
    const sym = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';
    const rows = m2Services.map(s => {
      const total = area * s.price;
      return `
        <div class="calc-result-row">
          <span class="calc-svc">${escHtml(s.name)}</span>
          <span class="calc-formula">${area} m² × ${sym}${s.price.toLocaleString('es-MX')} =</span>
          <span class="calc-total">${sym}${total.toLocaleString('es-MX', {minimumFractionDigits:2})}</span>
        </div>`;
    }).join('');
    resultsEl.innerHTML = rows;
  }
  resultsEl.classList.remove('hidden');
}

/* ─────────────────────────────────────────────
   SERVICE MODAL (Add / Edit)
───────────────────────────────────────────── */
function openServiceModal(svc) {
  const isEdit = Boolean(svc);
  const unitOptions = CONFIG.UNIT_TYPES.map(u =>
    `<option value="${u.value}" ${svc?.unit === u.value ? 'selected' : ''}>${u.label}</option>`
  ).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box modal-lg" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>${isEdit ? 'Editar Servicio' : 'Nuevo Servicio'}</h3>
        <button class="icon-btn" id="modal-close-svc">✕</button>
      </div>
      <div class="modal-body">
        <div class="form-grid-2">
          <div class="field-group full">
            <label for="svc-name">Nombre del servicio *</label>
            <input id="svc-name" type="text" value="${escHtml(svc?.name || '')}" placeholder="Ej. Diseño Conceptual" required />
          </div>
          <div class="field-group">
            <label for="svc-unit">Tipo de unidad *</label>
            <select id="svc-unit">${unitOptions}</select>
          </div>
          <div class="field-group">
            <label for="svc-price">Precio unitario *</label>
            <input id="svc-price" type="number" min="0" step="0.01" value="${svc?.price || ''}" placeholder="0.00" required />
          </div>
          <div class="field-group full">
            <label for="svc-desc">Descripción</label>
            <textarea id="svc-desc" rows="3" placeholder="Descripción del servicio…">${escHtml(svc?.description || '')}</textarea>
          </div>
          <div class="field-group">
            <label>Estado</label>
            <label class="toggle-label">
              <input type="checkbox" id="svc-active" ${svc?.active !== false ? 'checked' : ''} />
              <span class="toggle-slider"></span>
              <span>Activo</span>
            </label>
          </div>
        </div>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="modal-cancel-svc">Cancelar</button>
        <button class="btn btn-primary" id="modal-save-svc">Guardar</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const close = () => overlay.remove();
  overlay.querySelector('#modal-close-svc').addEventListener('click', close);
  overlay.querySelector('#modal-cancel-svc').addEventListener('click', close);

  overlay.querySelector('#modal-save-svc').addEventListener('click', () => {
    const name  = overlay.querySelector('#svc-name').value.trim();
    const price = parseFloat(overlay.querySelector('#svc-price').value);
    if (!name)       { showToast('El nombre es obligatorio.', 'error'); return; }
    if (isNaN(price)){ showToast('Ingresa un precio válido.', 'error'); return; }

    const updated = {
      id:          svc?.id || generateId(),
      name,
      unit:        overlay.querySelector('#svc-unit').value,
      price,
      description: overlay.querySelector('#svc-desc').value.trim(),
      active:      overlay.querySelector('#svc-active').checked,
    };
    upsertService(updated);
    AppState.services = loadServices();
    showToast(`Servicio ${isEdit ? 'actualizado' : 'creado'}.`);
    close();
    renderTabulator(document.getElementById('main-content'));
  });
}

/* ─────────────────────────────────────────────
   ③ PROPOSAL EDITOR
───────────────────────────────────────────── */
function renderProposalEditor(container, proposalId) {
  AppState.services  = loadServices();
  AppState.settings  = loadSettings();

  // Load existing proposal OR create a blank one
  let proposal = null;
  if (proposalId) {
    proposal = loadProposal(proposalId);
    AppState.editingProposalId = proposalId;
  } else {
    AppState.editingProposalId = null;
  }

  AppState.proposalItems = proposal ? JSON.parse(JSON.stringify(proposal.items || [])) : [];

  const today = new Date().toISOString().split('T')[0];
  const vatPct   = AppState.settings.vat ?? CONFIG.DEFAULT_VAT;
  // Fix #8: Read existing applyVat from proposal (for edit) or settings (for new)
  const applyVat = (proposal !== null && proposal.applyVat !== undefined)
    ? proposal.applyVat
    : (AppState.settings.applyVat !== false);

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>${proposalId ? 'Editar Propuesta' : 'Nueva Propuesta'}</h1>
        <span class="section-sub">${proposalId ? proposal?.proposalNumber || '' : 'Complete los datos y agregue servicios'}</span>
      </div>
      <div class="header-actions">
        <button class="btn btn-ghost" id="btn-preview-proposal">👁 Vista previa</button>
        <button class="btn btn-primary" id="btn-save-proposal">💾 Guardar y generar PDF</button>
      </div>
    </div>

    <div class="proposal-layout">
      <!-- Left Column -->
      <div class="proposal-col">

        <!-- Client -->
        <div class="card">
          <div class="card-header"><h2>Información del Cliente</h2></div>
          <div class="form-grid-2">
            <div class="field-group full">
              <label for="prop-client">Nombre del cliente *</label>
              <input id="prop-client" type="text" value="${escHtml(proposal?.clientName || '')}" placeholder="Nombre completo" />
            </div>
            <div class="field-group">
              <label for="prop-phone">Teléfono</label>
              <input id="prop-phone" type="tel" value="${escHtml(proposal?.clientPhone || '')}" placeholder="+52 555 000 0000" />
            </div>
            <div class="field-group">
              <label for="prop-email">Correo electrónico</label>
              <input id="prop-email" type="email" value="${escHtml(proposal?.clientEmail || '')}" placeholder="correo@ejemplo.com" />
            </div>
            <div class="field-group full">
              <label for="prop-address">Dirección</label>
              <input id="prop-address" type="text" value="${escHtml(proposal?.clientAddress || '')}" placeholder="Calle, colonia, ciudad" />
            </div>
          </div>
        </div>

        <!-- Project -->
        <div class="card">
          <div class="card-header"><h2>Información del Proyecto</h2></div>
          <div class="form-grid-2">
            <div class="field-group full">
              <label for="prop-project">Nombre del proyecto *</label>
              <input id="prop-project" type="text" value="${escHtml(proposal?.projectName || '')}" placeholder="Ej. Casa Habitación García" />
            </div>
            <div class="field-group full">
              <label for="prop-notes">Notas adicionales</label>
              <textarea id="prop-notes" rows="3" placeholder="Observaciones, condiciones especiales…">${escHtml(proposal?.notes || '')}</textarea>
            </div>
          </div>
        </div>

        <!-- Profitability -->
        <div class="card">
          <div class="card-header"><h2>Análisis de Rentabilidad</h2><span class="badge">Interno</span></div>
          <div class="form-grid-2">
            <div class="field-group">
              <label for="prof-hours">Horas estimadas</label>
              <input id="prof-hours" type="number" min="0" value="${proposal?.profitability?.estimatedHours || ''}" placeholder="0" />
            </div>
            <div class="field-group">
              <label for="prof-expenses">Gastos generales</label>
              <input id="prof-expenses" type="number" min="0" step="0.01" value="${proposal?.profitability?.expenses || ''}" placeholder="0.00" />
            </div>
            <div class="field-group">
              <label for="prof-travel">Viáticos y traslados</label>
              <input id="prof-travel" type="number" min="0" step="0.01" value="${proposal?.profitability?.travelCosts || ''}" placeholder="0.00" />
            </div>
            <div class="field-group">
              <div class="profit-summary" id="profit-summary">
                <div class="profit-row"><span>Ingreso bruto</span><span id="ps-revenue">—</span></div>
                <div class="profit-row"><span>Utilidad neta</span><span id="ps-profit">—</span></div>
                <div class="profit-row highlight"><span>Margen</span><span id="ps-margin">—</span></div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- Right Column: Items + Summary -->
      <div class="proposal-col">

        <div class="card">
          <div class="card-header">
            <h2>Partidas / Servicios</h2>
            <button class="btn btn-sm btn-primary" id="btn-add-item">+ Agregar</button>
          </div>

          <div id="items-container">
            ${AppState.proposalItems.length === 0
              ? '<p class="empty-state" id="items-empty">Agrega al menos un servicio a la propuesta.</p>'
              : ''}
          </div>

          <!-- Fix #8: Apply VAT checkbox -->
          <div class="vat-toggle-row">
            <label class="toggle-label" style="padding:0.75rem 1.25rem;border-top:1px solid var(--clr-border);">
              <input type="checkbox" id="chk-apply-vat" ${applyVat ? 'checked' : ''} />
              <span class="toggle-slider"></span>
              <span>Aplicar IVA (${vatPct}%)</span>
            </label>
          </div>
          <div class="totals-box">
            <div class="totals-row"><span>Subtotal</span><span id="tot-subtotal">$0.00</span></div>
            <div class="totals-row"><span>Descuentos</span><span id="tot-discount">-$0.00</span></div>
            <div class="totals-row" id="vat-row"><span>IVA (${vatPct}%)</span><span id="tot-vat">$0.00</span></div>
            <div class="totals-row grand"><span>Total</span><span id="tot-grand">$0.00</span></div>
          </div>
        </div>

      </div>
    </div>
  `;

  // Render existing items
  AppState.proposalItems.forEach((_, idx) => renderItemCard(idx));
  recalcTotals();

  // Button handlers
  document.getElementById('btn-add-item').addEventListener('click', addProposalItem);
  document.getElementById('btn-save-proposal').addEventListener('click', saveProposalAndPDF);
  document.getElementById('btn-preview-proposal').addEventListener('click', previewProposal);

  // Fix #8: VAT toggle live update
  document.getElementById('chk-apply-vat')?.addEventListener('change', recalcTotals);

  // Profitability live update
  ['prof-hours', 'prof-expenses', 'prof-travel'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', updateProfitability);
  });

  updateProfitability();
}

function addProposalItem() {
  const newItem = {
    id:          generateId(),
    serviceName: '',
    description: '',
    quantity:    1,
    unit:        'm2',
    unitPrice:   0,
    discount:    0,
  };
  AppState.proposalItems.push(newItem);
  const idx = AppState.proposalItems.length - 1;

  document.getElementById('items-empty')?.remove();
  renderItemCard(idx);
  recalcTotals();
}

function renderItemCard(idx) {
  const item     = AppState.proposalItems[idx];
  const services = AppState.services.filter(s => s.active);
  const sym      = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';

  const svcOptions = services.map(s =>
    `<option value="${s.id}" data-price="${s.price}" data-unit="${s.unit}" ${item.serviceName === s.name ? 'selected' : ''}>${escHtml(s.name)}</option>`
  ).join('');

  const unitOptions = CONFIG.UNIT_TYPES.map(u =>
    `<option value="${u.value}" ${item.unit === u.value ? 'selected' : ''}>${u.label}</option>`
  ).join('');

  const card = document.createElement('div');
  card.className = 'item-card';
  card.dataset.idx = idx;
  card.innerHTML = `
    <div class="item-card-header">
      <span class="item-num">Partida ${idx + 1}</span>
      <button class="icon-btn danger" data-action="remove-item" title="Eliminar partida">✕</button>
    </div>
    <div class="form-grid-3">
      <div class="field-group full">
        <label>Servicio</label>
        <select class="item-service">
          <option value="">— Seleccionar —</option>
          ${svcOptions}
        </select>
      </div>
      <div class="field-group full">
        <label>Descripción personalizada</label>
        <input type="text" class="item-desc" value="${escHtml(item.description)}" placeholder="Descripción detallada (opcional)" />
      </div>
      <div class="field-group">
        <label>Cantidad</label>
        <input type="number" class="item-qty" value="${item.quantity}" min="0" step="0.01" />
      </div>
      <div class="field-group">
        <label>Unidad</label>
        <select class="item-unit">${unitOptions}</select>
      </div>
      <div class="field-group">
        <label>Precio unitario</label>
        <input type="number" class="item-price" value="${item.unitPrice}" min="0" step="0.01" />
      </div>
      <div class="field-group">
        <label>Descuento %</label>
        <input type="number" class="item-disc" value="${item.discount}" min="0" max="100" step="0.1" />
      </div>
      <div class="field-group">
        <label>Importe</label>
        <div class="item-amount">${sym}${(item.quantity * item.unitPrice * (1 - item.discount/100)).toLocaleString('es-MX', {minimumFractionDigits:2})}</div>
      </div>
    </div>
  `;

  document.getElementById('items-container').appendChild(card);

  // Bind events
  card.querySelector('.item-service').addEventListener('change', function () {
    const selected = services.find(s => s.id === this.value);
    if (selected) {
      card.querySelector('.item-price').value = selected.price;
      card.querySelector('.item-unit').value  = selected.unit;
      AppState.proposalItems[idx].serviceName = selected.name;
      AppState.proposalItems[idx].unit        = selected.unit;
      AppState.proposalItems[idx].unitPrice   = selected.price;
    } else {
      AppState.proposalItems[idx].serviceName = '';
    }
    syncItemFromCard(card, idx);
    recalcTotals();
  });

  ['item-qty', 'item-price', 'item-disc'].forEach(cls => {
    card.querySelector(`.${cls}`).addEventListener('input', () => { syncItemFromCard(card, idx); recalcTotals(); });
  });
  card.querySelector('.item-desc').addEventListener('input',  () => { syncItemFromCard(card, idx); });
  card.querySelector('.item-unit').addEventListener('change', () => { syncItemFromCard(card, idx); recalcTotals(); });

  card.querySelector('[data-action="remove-item"]').addEventListener('click', async () => {
    const ok = await showConfirm('¿Eliminar esta partida?');
    if (ok) {
      AppState.proposalItems.splice(idx, 1);
      card.remove();
      // Re-render all cards to fix indices
      document.getElementById('items-container').innerHTML = '';
      if (AppState.proposalItems.length === 0) {
        document.getElementById('items-container').innerHTML = '<p class="empty-state" id="items-empty">Agrega al menos un servicio a la propuesta.</p>';
      } else {
        AppState.proposalItems.forEach((_, i) => renderItemCard(i));
      }
      recalcTotals();
    }
  });
}

function syncItemFromCard(card, idx) {
  const item = AppState.proposalItems[idx];
  if (!item) return;
  item.quantity  = parseFloat(card.querySelector('.item-qty').value)   || 0;
  item.unitPrice = parseFloat(card.querySelector('.item-price').value) || 0;
  item.discount  = parseFloat(card.querySelector('.item-disc').value)  || 0;
  item.unit      = card.querySelector('.item-unit').value;
  item.description = card.querySelector('.item-desc').value;

  const sym    = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';
  const amount = item.quantity * item.unitPrice * (1 - item.discount / 100);
  const amountEl = card.querySelector('.item-amount');
  if (amountEl) amountEl.textContent = `${sym}${amount.toLocaleString('es-MX', {minimumFractionDigits:2})}`;
}

function recalcTotals() {
  // Fix #8: Read applyVat from checkbox
  const vatChk   = document.getElementById('chk-apply-vat');
  const applyVat = vatChk ? vatChk.checked : (AppState.settings.applyVat !== false);
  const vatPct   = AppState.settings.vat ?? CONFIG.DEFAULT_VAT;
  const items    = AppState.proposalItems;
  let subtotal   = 0;
  let discountAmt = 0;

  items.forEach(item => {
    const base   = item.quantity * item.unitPrice;
    const discI  = base * (item.discount / 100);
    subtotal    += base;
    discountAmt += discI;
  });

  const net   = subtotal - discountAmt;
  const vat   = applyVat ? net * (vatPct / 100) : 0;
  const total = net + vat;

  document.getElementById('tot-subtotal').textContent = fmt(subtotal);
  document.getElementById('tot-discount').textContent = `-${fmt(discountAmt)}`;
  document.getElementById('tot-vat').textContent      = fmt(vat);
  document.getElementById('tot-grand').textContent    = fmt(total);

  // Show/hide VAT row based on toggle
  const vatRow = document.getElementById('vat-row');
  if (vatRow) vatRow.style.display = applyVat ? '' : 'none';

  updateProfitability();
}

function updateProfitability() {
  const hoursEl    = document.getElementById('prof-hours');
  const expEl      = document.getElementById('prof-expenses');
  const travelEl   = document.getElementById('prof-travel');
  const revenueEl  = document.getElementById('ps-revenue');
  const profitEl   = document.getElementById('ps-profit');
  const marginEl   = document.getElementById('ps-margin');

  if (!hoursEl) return;

  const vatPct   = AppState.settings.vat ?? CONFIG.DEFAULT_VAT;
  const items    = AppState.proposalItems;
  let subtotal   = 0, discountAmt = 0;
  items.forEach(item => {
    const base = item.quantity * item.unitPrice;
    subtotal    += base;
    discountAmt += base * (item.discount / 100);
  });
  const net        = subtotal - discountAmt;
  const expenses   = parseFloat(expEl?.value) || 0;
  const travel     = parseFloat(travelEl?.value) || 0;
  const grossRev   = net;
  const netProfit  = grossRev - expenses - travel;
  const margin     = grossRev > 0 ? (netProfit / grossRev) * 100 : 0;

  if (revenueEl) revenueEl.textContent = fmt(grossRev);
  if (profitEl)  profitEl.textContent  = fmt(netProfit);
  if (marginEl)  marginEl.textContent  = `${margin.toFixed(1)}%`;
}

async function saveProposalAndPDF() {
  const clientName  = document.getElementById('prop-client')?.value.trim();
  const projectName = document.getElementById('prop-project')?.value.trim();

  if (!clientName)  { showToast('El nombre del cliente es obligatorio.', 'error'); return; }
  if (!projectName) { showToast('El nombre del proyecto es obligatorio.', 'error'); return; }
  if (AppState.proposalItems.length === 0) { showToast('Agrega al menos una partida.', 'error'); return; }

  // Fix #8: Read applyVat from checkbox
  const vatChk   = document.getElementById('chk-apply-vat');
  const applyVat = vatChk ? vatChk.checked : (AppState.settings.applyVat !== false);
  const vatPct   = AppState.settings.vat ?? CONFIG.DEFAULT_VAT;
  let subtotal = 0, discountAmt = 0;
  AppState.proposalItems.forEach(item => {
    const base = item.quantity * item.unitPrice;
    subtotal    += base;
    discountAmt += base * (item.discount / 100);
  });
  const net      = subtotal - discountAmt;
  const vat      = applyVat ? net * (vatPct / 100) : 0;
  const grandTotal = net + vat;

  const expenses   = parseFloat(document.getElementById('prof-expenses')?.value) || 0;
  const travel     = parseFloat(document.getElementById('prof-travel')?.value)   || 0;
  const grossRevenue = net;
  const netProfit    = grossRevenue - expenses - travel;
  const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;

  const proposal = {
    id:             AppState.editingProposalId || generateId(),
    proposalNumber: AppState.editingProposalId ? loadProposal(AppState.editingProposalId)?.proposalNumber || nextProposalNumber() : nextProposalNumber(),
    clientName,
    clientPhone:   document.getElementById('prop-phone')?.value.trim()   || '',
    clientEmail:   document.getElementById('prop-email')?.value.trim()   || '',
    clientAddress: document.getElementById('prop-address')?.value.trim() || '',
    projectName,
    notes:         document.getElementById('prop-notes')?.value.trim()   || '',
    date:          new Date().toISOString().split('T')[0],
    items:         JSON.parse(JSON.stringify(AppState.proposalItems)),
    subtotal,
    discount: discountAmt,
    vat,
    grandTotal,
    applyVat,   // Fix #8: persist the VAT toggle state
    profitability: {
      estimatedHours: parseFloat(document.getElementById('prof-hours')?.value) || 0,
      expenses,
      travelCosts: travel,
      grossRevenue,
      netProfit,
      profitMargin,
    },
  };

  upsertProposal(proposal);
  AppState.proposals = loadProposals();
  showToast('Propuesta guardada. Generando PDF…');

  // Generate PDF
  try {
    await generateProposalPDF(proposal, AppState.settings);
    showToast('PDF generado correctamente.');
  } catch (err) {
    console.error('[app] PDF error:', err);
    showToast('Error al generar el PDF.', 'error');
  }
}

function previewProposal() {
  const clientName  = document.getElementById('prop-client')?.value.trim()  || '(sin nombre)';
  const projectName = document.getElementById('prop-project')?.value.trim() || '(sin proyecto)';
  const sym         = CONFIG.CURRENCY_SYMBOLS[AppState.settings.currency] || '$';
  const vatPct      = AppState.settings.vat ?? CONFIG.DEFAULT_VAT;
  // Fix #8: read current VAT toggle state
  const vatChk   = document.getElementById('chk-apply-vat');
  const applyVat = vatChk ? vatChk.checked : (AppState.settings.applyVat !== false);

  let subtotal = 0, discountAmt = 0;
  AppState.proposalItems.forEach(item => {
    const base = item.quantity * item.unitPrice;
    subtotal    += base;
    discountAmt += base * (item.discount / 100);
  });
  const net   = subtotal - discountAmt;
  const vat   = applyVat ? net * (vatPct / 100) : 0;
  const total = net + vat;

  const rowsHtml = AppState.proposalItems.map((item, i) => {
    const amount = item.quantity * item.unitPrice * (1 - item.discount / 100);
    return `
      <tr>
        <td>${escHtml(item.serviceName || item.description || '—')}</td>
        <td>${item.quantity}</td>
        <td>${unitLabel(item.unit)}</td>
        <td>${fmt(item.unitPrice)}</td>
        <td>${item.discount > 0 ? `${item.discount}%` : '—'}</td>
        <td><strong>${fmt(amount)}</strong></td>
      </tr>`;
  }).join('');

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box modal-xl" role="dialog" aria-modal="true">
      <div class="modal-header">
        <h3>Vista Previa de Propuesta</h3>
        <button class="icon-btn" id="preview-close">✕</button>
      </div>
      <div class="modal-body preview-body">
        <div class="preview-header">
          <div>
            <h2>${escHtml(projectName)}</h2>
            <p class="preview-client">${escHtml(clientName)}</p>
            <p class="preview-date">Fecha: ${new Date().toLocaleDateString('es-MX')}</p>
          </div>
        </div>
        <div class="table-wrap">
          <table class="data-table">
            <thead>
              <tr><th>Descripción</th><th>Cant.</th><th>Unidad</th><th>P. Unitario</th><th>Dto.</th><th>Importe</th></tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>
        </div>
        <div class="preview-totals">
          <div class="totals-row"><span>Subtotal</span><span>${fmt(subtotal)}</span></div>
          ${discountAmt > 0 ? `<div class="totals-row"><span>Descuentos</span><span>-${fmt(discountAmt)}</span></div>` : ''}
          ${applyVat ? `<div class="totals-row"><span>IVA (${vatPct}%)</span><span>${fmt(vat)}</span></div>` : ''}
          <div class="totals-row grand"><span>TOTAL</span><span>${fmt(total)}</span></div>
        </div>
        <p class="preview-footer">${CONFIG.PROPOSAL_VALIDITY_TEXT}</p>
      </div>
      <div class="modal-footer">
        <button class="btn btn-ghost" id="preview-close-btn">Cerrar</button>
        <button class="btn btn-primary" id="preview-save-btn">Guardar y generar PDF</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('visible'));

  const close = () => overlay.remove();
  overlay.querySelector('#preview-close').addEventListener('click', close);
  overlay.querySelector('#preview-close-btn').addEventListener('click', close);
  overlay.querySelector('#preview-save-btn').addEventListener('click', () => { close(); saveProposalAndPDF(); });
}

/* ─────────────────────────────────────────────
   ④ PROPOSAL HISTORY
───────────────────────────────────────────── */
function renderHistory(container) {
  AppState.proposals = loadProposals();

  const tableRows = AppState.proposals.map(p => `
    <tr data-id="${p.id}">
      <td data-label="No.">${escHtml(p.proposalNumber)}</td>
      <td data-label="Cliente">${escHtml(p.clientName)}</td>
      <td data-label="Proyecto">${escHtml(p.projectName)}</td>
      <td data-label="Total"><strong>${fmt(p.grandTotal)}</strong></td>
      <td data-label="Fecha">${fmtDateDisplay(p.createdAt)}</td>
      <td data-label="Acciones" class="actions-cell">
        <button class="icon-btn" data-action="edit-prop"      title="Editar">✎</button>
        <button class="icon-btn" data-action="duplicate-prop" title="Duplicar">⎘</button>
        <button class="icon-btn" data-action="pdf-prop"       title="Exportar PDF">⬇</button>
        <button class="icon-btn danger" data-action="delete-prop" title="Eliminar">✕</button>
      </td>
    </tr>`).join('');

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Historial de Propuestas</h1>
        <span class="section-sub">${AppState.proposals.length} propuesta${AppState.proposals.length !== 1 ? 's' : ''} almacenada${AppState.proposals.length !== 1 ? 's' : ''}</span>
      </div>
      <button class="btn btn-primary" onclick="navigateTo('proposal')">+ Nueva Propuesta</button>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="search-wrap">
          <input type="search" id="history-search" placeholder="Buscar por cliente, proyecto o número…" />
        </div>
      </div>
      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>No. Propuesta</th>
              <th>Cliente</th>
              <th>Proyecto</th>
              <th>Total</th>
              <th>Fecha</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="history-tbody">
            ${tableRows || '<tr><td colspan="6" class="empty-cell">No hay propuestas registradas.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>
  `;

  document.getElementById('history-search').addEventListener('input', function () {
    const q = this.value.toLowerCase();
    document.querySelectorAll('#history-tbody tr').forEach(row => {
      row.style.display = row.textContent.toLowerCase().includes(q) ? '' : 'none';
    });
  });

  document.getElementById('history-tbody').addEventListener('click', handleHistoryAction);
}

async function handleHistoryAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const row = btn.closest('tr');
  const id  = row?.dataset.id;
  const proposal = loadProposal(id);
  if (!proposal) return;

  if (btn.dataset.action === 'edit-prop') {
    AppState.editingProposalId = id;
    renderProposalEditor(document.getElementById('main-content'), id);
    document.querySelector('[data-section="proposal"]')?.classList.add('active');
    document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.section === 'proposal'));
  }

  if (btn.dataset.action === 'duplicate-prop') {
    const dup = {
      ...JSON.parse(JSON.stringify(proposal)),
      id:             generateId(),
      proposalNumber: nextProposalNumber(),
      createdAt:      new Date().toISOString(),
      updatedAt:      new Date().toISOString(),
    };
    upsertProposal(dup);
    AppState.proposals = loadProposals();
    showToast(`Propuesta duplicada: ${dup.proposalNumber}`);
    renderHistory(document.getElementById('main-content'));
  }

  if (btn.dataset.action === 'pdf-prop') {
    try {
      await generateProposalPDF(proposal, AppState.settings);
      showToast('PDF exportado.');
    } catch (err) {
      showToast('Error al generar PDF.', 'error');
    }
  }

  if (btn.dataset.action === 'delete-prop') {
    const ok = await showConfirm(`¿Eliminar la propuesta "${proposal.proposalNumber}"?`);
    if (ok) {
      deleteProposal(id);
      AppState.proposals = loadProposals();
      row.remove();
      showToast('Propuesta eliminada.', 'error');
    }
  }
}

/* ─────────────────────────────────────────────
   ⑤ SETTINGS
───────────────────────────────────────────── */
function renderSettings(container) {
  AppState.settings = loadSettings();
  const s = AppState.settings;

  const currencyOptions = CONFIG.SUPPORTED_CURRENCIES.map(c =>
    `<option value="${c}" ${s.currency === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  container.innerHTML = `
    <div class="section-header">
      <div>
        <h1>Configuración</h1>
        <span class="section-sub">Personaliza la aplicación</span>
      </div>
    </div>

    <div class="settings-grid">
      <div class="card">
        <div class="card-header"><h2>Parámetros Financieros</h2></div>
        <div class="form-grid-2">
          <div class="field-group">
            <label for="set-vat">IVA (%)</label>
            <input id="set-vat" type="number" min="0" max="100" step="0.01" value="${s.vat}" />
          </div>
          <div class="field-group">
            <label for="set-currency">Moneda</label>
            <select id="set-currency">${currencyOptions}</select>
          </div>
        </div>
      </div>

      <div class="card">
        <div class="card-header"><h2>Membrete (PDF)</h2></div>
        <div class="field-group" style="padding:0 1.25rem;">
          <label for="set-letterhead">Ruta relativa de la imagen</label>
          <input id="set-letterhead" type="text" value="${escHtml(s.letterheadPath)}" placeholder="../Membretes/n1png.png" />
          <span class="field-hint">Ruta relativa al index.html. Al guardar, la imagen se convierte a Base64 y se usa en los PDFs.</span>
        </div>
        <div class="letterhead-preview-wrap">
          <img id="letterhead-preview" src="${escHtml(s.letterheadPath)}" alt="Membrete" class="letterhead-preview" onerror="this.style.display='none'" />
        </div>
        <div style="padding:0 1.25rem 1rem;display:flex;gap:0.5rem;">
          <input type="file" id="inp-letterhead-file" accept="image/png,image/jpeg,image/jpg" style="display:none" />
          <button class="btn btn-ghost btn-sm" id="btn-preview-letterhead">Previsualizar</button>
          <button class="btn btn-secondary btn-sm" id="btn-store-letterhead">Guardar en PDF</button>
        </div>
        ${loadLetterheadB64() ? '<p style="padding:0 1.25rem;font-size:0.75rem;color:var(--clr-success);">&#10003; Membrete almacenado correctamente.</p>' : '<p style="padding:0 1.25rem;font-size:0.75rem;color:var(--clr-text-3);">Sin membrete almacenado aun.</p>'}
      </div>

      <div class="card">
        <div class="card-header"><h2>Datos de la Aplicación</h2></div>
        <p class="settings-info">Los datos se almacenan localmente en este navegador. No se envía información a ningún servidor.</p>
        <div class="form-grid-2">
          <div class="field-group">
            <label>Total de propuestas</label>
            <div class="read-only-field">${AppState.proposals.length}</div>
          </div>
          <div class="field-group">
            <label>Total de servicios</label>
            <div class="read-only-field">${AppState.services.length}</div>
          </div>
        </div>
        <button class="btn btn-danger btn-sm" id="btn-reset-data" style="margin-top:1rem;">⚠ Limpiar todos los datos</button>
      </div>

    </div>

    <div class="settings-save-row">
      <button class="btn btn-primary" id="btn-save-settings">Guardar configuración</button>
    </div>
  `;

  document.getElementById('btn-save-settings').addEventListener('click', () => {
    const vat = parseFloat(document.getElementById('set-vat').value);
    if (isNaN(vat) || vat < 0 || vat > 100) { showToast('IVA debe ser entre 0 y 100.', 'error'); return; }

    const newSettings = {
      vat,
      currency:       document.getElementById('set-currency').value,
      letterheadPath: document.getElementById('set-letterhead').value.trim(),
      applyVat:       AppState.settings.applyVat !== false,
    };
    saveSettings(newSettings);
    AppState.settings = newSettings;
    showToast('Configuracion guardada.');
  });

  document.getElementById('btn-preview-letterhead').addEventListener('click', () => {
    const src = document.getElementById('set-letterhead').value.trim();
    const img = document.getElementById('letterhead-preview');
    img.src = src;
    img.style.display = 'block';
  });

  // Fix #1 (corrected): Store letterhead via FileReader — works on file://, HTTP and HTTPS.
  // The previous canvas+crossOrigin approach failed because img.crossOrigin='anonymous'
  // causes the browser to require CORS headers; local files never supply them, so onerror
  // fired every time and nothing was ever written to LocalStorage.
  document.getElementById('btn-store-letterhead')?.addEventListener('click', () => {
    document.getElementById('inp-letterhead-file').click();
  });
  document.getElementById('inp-letterhead-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    showToast('Cargando imagen…', 'info');
    const reader = new FileReader();
    reader.onload = () => {
      saveLetterheadB64(reader.result);
      showToast('Membrete guardado. Se aplicara en los PDFs.');
      renderSettings(document.getElementById('main-content'));
    };
    reader.onerror = () => showToast('No se pudo leer la imagen.', 'error');
    reader.readAsDataURL(file);
  });

  document.getElementById('btn-reset-data').addEventListener('click', async () => {
    const ok = await showConfirm('¿Eliminar TODOS los datos (propuestas, servicios, configuración)? Esta acción no se puede deshacer.');
    if (ok) {
      Object.values(STORAGE_KEYS).forEach(k => localStorage.removeItem(k));
      AppState.settings  = loadSettings();
      AppState.services  = loadServices();
      AppState.proposals = loadProposals();
      showToast('Datos eliminados. Reiniciando…', 'error');
      setTimeout(() => navigateTo('dashboard'), 1200);
    }
  });
}