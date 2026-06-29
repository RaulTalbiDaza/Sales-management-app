const form = document.getElementById('salesForm');
const dateFilter = document.getElementById('dateFilter');

// Cargar ventas al abrir la app
document.addEventListener('DOMContentLoaded', () => {
    setTodayFilter();
    
    const monthSelect = document.getElementById('monthSelect');
    const now = new Date();
    const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    monthSelect.value = currentMonth;
    monthSelect.addEventListener('change', loadMonthlySummary);
    loadMonthlySummary();
});

// Registrar venta
form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const description = document.getElementById('description').value;
    const price = parseFloat(document.getElementById('price').value);
    const paymentType = document.querySelector('input[name="payment_type"]:checked').value;

    const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            description,
            price,
            payment_type: paymentType
        })
    });

    if (response.ok) {
        form.reset();
        loadSales();
        showMessage('✅ Venta registrada correctamente');
    }
});

// Cargar ventas
async function loadSales() {
    const date = dateFilter.value;
    const url = date ? `/api/sales?date=${date}` : '/api/sales';

    const response = await fetch(url);
    const sales = await response.json();

    // Actualizar resumen mensual
    loadMonthlySummary();

    // Calcular totales
    let collectedTotal = 0;
    let pendingTotal = 0;
    let cardTotal = 0;

    sales.forEach(sale => {
        if (sale.payment_type === 'Efectivo') {
            if (sale.collected === 1) {
                collectedTotal += sale.price;
            } else {
                pendingTotal += sale.price;
            }
        } else if (sale.payment_type === 'Tarjeta') {
            cardTotal += sale.price;
        }
    });

    document.getElementById('totalCollected').textContent = `${collectedTotal.toFixed(2)}€`;
    document.getElementById('totalPending').textContent = `${pendingTotal.toFixed(2)}€`;
    document.getElementById('totalCard').textContent = `${cardTotal.toFixed(2)}€`;

    const tableDiv = document.getElementById('salesTable');

    if (sales.length === 0) {
        tableDiv.innerHTML = '<div class="empty-state"><p>No hay ventas registradas</p></div>';
        return;
    }

    // ── Tabla para escritorio ──────────────────────────────────────────────
    let tableHtml = `
        <table class="sales-table-desktop">
            <thead>
                <tr>
                    <th>Hora</th>
                    <th>Prenda</th>
                    <th>Precio</th>
                    <th>Tipo Pago</th>
                    <th>Recogida</th>
                    <th>Acciones</th>
                </tr>
            </thead>
            <tbody>
    `;

    sales.forEach(sale => {
        const badgeClass = sale.payment_type === 'Efectivo' ? 'payment-efectivo' : 'payment-tarjeta';

        let collectedCell = '';
        if (sale.payment_type === 'Efectivo') {
            if (sale.collected === 1) {
                collectedCell = `<span class="collected-badge collected-yes">Recogido 📥</span>`;
            } else {
                collectedCell = `<button onclick="collectSale(${sale.id})" class="btn-collect">Marcar Recogido</button>`;
            }
        } else {
            collectedCell = `<span class="collected-na">—</span>`;
        }

        tableHtml += `
            <tr>
                <td>${sale.time}</td>
                <td>${sale.description}</td>
                <td>${sale.price.toFixed(2)}€</td>
                <td><span class="payment-badge ${badgeClass}">${sale.payment_type}</span></td>
                <td>${collectedCell}</td>
                <td>
                    <button onclick="deleteSale(${sale.id})" class="btn-delete" title="Eliminar Venta">🗑️</button>
                </td>
            </tr>
        `;
    });

    tableHtml += `</tbody></table>`;

    // ── Tarjetas para móvil ────────────────────────────────────────────────
    let cardsHtml = `<div class="sales-cards-mobile">`;

    sales.forEach(sale => {
        const badgeClass = sale.payment_type === 'Efectivo' ? 'payment-efectivo' : 'payment-tarjeta';

        let actionsHtml = '';
        if (sale.payment_type === 'Efectivo') {
            if (sale.collected === 1) {
                actionsHtml = `<span class="collected-badge collected-yes">Recogido 📥</span>`;
            } else {
                actionsHtml = `<button onclick="collectSale(${sale.id})" class="btn-collect">📥 Marcar Recogido</button>`;
            }
        } else {
            actionsHtml = `<span class="collected-na">—</span>`;
        }

        cardsHtml += `
            <div class="sale-card">
                <div class="sale-card-header">
                    <span class="sale-card-description">${sale.description}</span>
                    <span class="sale-card-price">${sale.price.toFixed(2)}€</span>
                </div>
                <div class="sale-card-meta">
                    <span class="sale-card-time">🕐 ${sale.time}</span>
                    <span class="payment-badge ${badgeClass}">${sale.payment_type}</span>
                </div>
                <div class="sale-card-actions">
                    ${actionsHtml}
                    <button onclick="deleteSale(${sale.id})" class="btn-delete" title="Eliminar Venta">🗑️</button>
                </div>
            </div>
        `;
    });

    cardsHtml += `</div>`;

    tableDiv.innerHTML = tableHtml + cardsHtml;
}

// Marcar venta como recogida
async function collectSale(saleId) {
    const response = await fetch(`/api/sales/${saleId}/collect`, {
        method: 'PUT'
    });

    if (response.ok) {
        loadSales();
        showMessage('✅ Dinero marcado como recogido');
    }
}

// Eliminar venta
function deleteSale(saleId) {
    // Mostrar modal de confirmación personalizado
    const modal = document.getElementById('deleteModal');
    modal.style.display = 'flex';

    document.getElementById('confirmDeleteBtn').onclick = async function() {
        modal.style.display = 'none';
        const response = await fetch(`/api/sales/${saleId}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            loadSales();
            showMessage('🗑️ Venta eliminada correctamente');
        } else {
            showMessage('❌ Error al eliminar la venta');
        }
    };

    document.getElementById('cancelDeleteBtn').onclick = function() {
        modal.style.display = 'none';
    };
}

// Cargar resumen mensual
async function loadMonthlySummary() {
    const monthSelect = document.getElementById('monthSelect');
    if (!monthSelect) return;
    const month = monthSelect.value;
    if (!month) return;

    const response = await fetch(`/api/summary?month=${month}`);
    const summary = await response.json();

    document.getElementById('monthlyCash').textContent = `${summary.cash.toFixed(2)}€`;
    document.getElementById('monthlyCard').textContent = `${summary.card.toFixed(2)}€`;
    document.getElementById('monthlyTotal').textContent = `${summary.total.toFixed(2)}€`;
}

// Filtrar por fecha
function filterSales() {
    loadSales();
}

// Exportar CSV
async function exportCSV() {
    const date = dateFilter.value;
    const url = date ? `/api/export?date=${date}` : '/api/export';
    window.location.href = url;
}

// Mostrar mensaje
function showMessage(msg) {
    const message = document.createElement('div');
    message.className = 'success-message';
    message.textContent = msg;
    message.style.display = 'block';
    message.style.background = '#d4edda';
    message.style.color = '#155724';
    message.style.padding = '12px 15px';
    message.style.borderRadius = '5px';
    message.style.marginBottom = '15px';
    document.querySelector('.form-section').prepend(message);
    setTimeout(() => message.remove(), 3000);
}

// Establecer fecha de hoy por defecto
function setTodayFilter() {
    const today = new Date().toISOString().split('T')[0];
    dateFilter.value = today;
    loadSales();
}