// resources/js/sales.js
// Логика страницы продаж

import { 
    getProductsForDropdown, 
    createSale, 
    createBulkAdjustment, 
    getSalesPaginated,
    updateClientMetrics,
    getAllItems
} from './db_indexeddb.js';
import { getSetting } from './settings-manager.js';
// === СОСТОЯНИЕ СТРАНИЦЫ ===
let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};

function goToPage(newPage) {
    currentPage = newPage;
    loadSalesTable(); // Перезагружаем таблицу с новым currentPage
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    await waitForDatabase();
    await populateDropdowns();
    await loadSalesTable();
    setupEventListeners();
    
    // Установка даты по умолчанию
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const isoString = now.toISOString().slice(0, 16);
    document.getElementById('saleDate').value = isoString;
    document.getElementById('bulkDate').value = isoString;
});

// Ожидание готовности БД
async function waitForDatabase() {
    if (window.isDatabaseReady) return;
    return new Promise(resolve => {
        const check = () => window.isDatabaseReady ? resolve() : setTimeout(check, 50);
        check();
    });
}

// === ЗАПОЛНЕНИЕ ВЫПАДАЮЩИХ СПИСКОВ ===
async function populateDropdowns() {
    try {
        const products = await getProductsForDropdown();
        const clients = await getAllItems('clients');
        
        const productOptions = products
            .filter(p => p.is_active)
            .map(p => `<option value="${p.id}" data-price="${p.price}" data-stock="${p.quantity}">
                ${p.sku} — ${p.name} (ост.: ${p.quantity}, ${p.price}₽)
            </option>`).join('');
        
        ['saleProduct', 'bulkProduct', 'filterProduct'].forEach(id => {
            const select = document.getElementById(id);
            if (id === 'filterProduct') {
                select.innerHTML = '<option value="">Все товары</option>' + productOptions;
            } else {
                select.innerHTML = '<option value="">Выберите товар...</option>' + productOptions;
            }
        });
        
        const clientOptions = clients.map(c => 
            `<option value="${c.id}">${c.name} (${c.phone || c.email || 'нет контакта'})</option>`
        ).join('');
        document.getElementById('saleClient').innerHTML = 
            '<option value="empty">🔘 Не указан</option><option value="new">➕ Создать клиента</option>' + clientOptions;
        
        // Автозаполнение цены
        document.getElementById('saleProduct').addEventListener('change', function() {
            const option = this.options[this.selectedIndex];
            const price = option.dataset.price;
            if (price) document.getElementById('salePrice').value = price;
        });
        
    } catch (error) {
        console.error('Error populating dropdowns:', error);
        showToast('⚠️ Не удалось загрузить списки товаров/клиентов');
    }
}

// === ЗАГРУЗКА ТАБЛИЦЫ ===
async function loadSalesTable(customSort = null) {
    const tbody = document.querySelector('#salesTable tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 20px;">⏳ Загрузка...</td></tr>';
    }
    
    const sortValue = customSort || document.getElementById('sortSelect').value;
    
    try {
        const result = await getSalesPaginated(currentPage, currentPageSize, currentFilters, sortValue);
        renderSalesTable(result.items);
        renderPagination(result.pagination, goToPage);
        
        // 🔥 Показываем таблицу
        const table = document.getElementById('salesTable');
        if (table) table.classList.add('loaded');
        
    } catch (error) {
        console.error('Error loading sales:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #ef4444;">❌ Ошибка: ${error.message}</td></tr>`;
        }
    }
}
// === РЕНДЕР ТАБЛИЦЫ ===
function renderSalesTable(items) {
    // используем правильный ID
    const tbody = document.querySelector('#salesTable tbody');
    const shouldAnimate = localStorage.getItem('crm_animateRows') !== 'false';
    if (!tbody) {
        console.error('❌ Table body not found! Check HTML structure.');
        return;
    }
    
    if (items.length === 0) {
        //Показываем сообщение, когда нет данных
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">📭 Нет записей</td></tr>';
        return;
    }
    
    // Загружаем данные товаров и клиентов
    Promise.all([
        getAllItems('products'),
        getAllItems('clients')
    ]).then(([products, clients]) => {
        const productMap = {};
        const clientMap = {};
        products.forEach(p => productMap[p.id] = p);
        clients.forEach(c => clientMap[c.id] = c);
        
        tbody.innerHTML = items.map((item, index) => {
            const product = productMap[item.product_id];
            const client = item.client_id ? (clientMap[item.client_id]?.name || 'ID:' + item.client_id) : '—';

            const commentText = item.comment || '—';
            const commentDisplay = commentText === '—' ? '—' : (commentText.length > 20 ? commentText.substring(0, 20) + '...' : commentText);
            // Добавляем клик только если есть комментарий
            const commentHtml = commentText !== '—' 

                ? `<span class="comment-cell" onclick="viewComment(\`${item.comment.replace(/`/g, '\\`').replace(/'/g, "\\'")}\`)" title="Нажмите для просмотра">${commentDisplay}</span>`
                : `<span style="color: #cbd5e1;">—</span>`;
            // Цвет суммы
            const isPositive = item.type === 'restock';
            const sumClass = isPositive ? 'color: #166534;' : 'color: #991b1b;';
            const sumSign = isPositive ? '+' : '';
            
            // Бейдж типа
            let typeBadge = 'badge-gray';
            if (item.type === 'sale') typeBadge = 'badge-success';
            if (item.type === 'writeoff') typeBadge = 'badge-danger';
            if (item.type === 'restock') typeBadge = 'badge-info';
            
            const animStyle = shouldAnimate 
                ? `class="table-row-animate" style="animation-delay: ${index * 0.04}s;"` 
                : '';


            return `
            <tr ${animStyle}>
                <td><strong>#${item.id}</strong></td>
                <td>${product ? `${product.sku} ${product.name}` : '-'}</td>
                <td>${client}</td>
                <td style="text-align: center;">${item.quantity}</td>
                <td style="text-align: right; font-weight: 600; ${sumClass}">${sumSign}${item.total_amount?.toFixed(2) || 0} ₽</td>
                <td>${new Date(item.transaction_date).toLocaleDateString()}</td>
                <td><span class="badge ${typeBadge}">${item.type}</span></td>
                <td style="max-width: 150px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                    ${commentHtml}
                </td>
                <td style="text-align: center; white-space: nowrap;">
                    <button class="btn-action-icon" onclick="openEditSale(${item.id})" title="Редактировать">✏️</button>
                    <button class="btn-action-icon delete" onclick="window.deleteSaleById(${item.id})" title="Удалить">🗑️</button>
                </td>
            </tr>`;
        }).join('');

        
    });
}
// === РЕНДЕР ПАГИНАЦИИ (ПЕРЕИСПОЛЬЗУЕМАЯ ФУНКЦИЯ) ===
export function renderPagination({ current_page, total_pages, total_items, page_size }, onPageChange) {
    const container = document.getElementById('pagination');
    const info = document.getElementById('paginationInfo');
    
    if (!container) return;
    
    info.textContent = `Показано ${((current_page - 1) * page_size) + 1}–${Math.min(current_page * page_size, total_items)} из ${total_items}`;
    
    let buttons = '';
    buttons += `<button ${current_page === 1 ? 'disabled' : ''} data-page="1">«</button>`;
    buttons += `<button ${current_page === 1 ? 'disabled' : ''} data-page="${current_page - 1}">‹</button>`;
    
    for (let i = Math.max(1, current_page - 2); i <= Math.min(total_pages, current_page + 2); i++) {
        buttons += `<button class="${i === current_page ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }
    
    buttons += `<button ${current_page === total_pages ? 'disabled' : ''} data-page="${current_page + 1}">›</button>`;
    buttons += `<button ${current_page === total_pages ? 'disabled' : ''} data-page="${total_pages}">»</button>`;
    
    container.innerHTML = buttons;
    
    container.querySelectorAll('button[data-page]').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (page !== current_page && typeof onPageChange === 'function') {
                onPageChange(page);
            }
        });
    });
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    document.getElementById('singleSaleForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSingleSaleSubmit();
        closeModal('singleSaleModal');
    });
    
    document.getElementById('bulkAdjustmentForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleBulkAdjustmentSubmit();
        closeModal('bulkAdjustmentModal');
    });
    
    document.getElementById('pageSize').addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value);
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('btnApplyFilters').addEventListener('click', () => {
        currentFilters = {
            type: document.getElementById('filterType').value || null,
            product_id: document.getElementById('filterProduct').value || null,
            date_from: document.getElementById('filterDateFrom').value || null,
            date_to: document.getElementById('filterDateTo').value || null
        };
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('filterType').value = '';
        document.getElementById('filterProduct').value = '';
        document.getElementById('filterDateFrom').value = '';
        document.getElementById('filterDateTo').value = '';
        currentFilters = {};
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('modalCancel').addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
    });
    
    document.getElementById('confirmModal').addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') {
            document.getElementById('confirmModal').style.display = 'none';
        }
    });
    
    document.getElementById('saleClient').addEventListener('change', async (e) => {
        if (e.target.value === 'new') {
            e.target.value = 'empty';
            if (confirm('Перейти на страницу создания клиента?')) {
                window.location.href = 'clients.html';
            }
        }
    });

    // Обработчик сортировки
    document.getElementById('sortSelect').addEventListener('change', (e) => {
        // При смене сортировки сбрасываем на 1 страницу и перезагружаем
        currentPage = 1;
        loadSalesTable(e.target.value); 
    });


    // Переключение между комментарием и периодом
    document.getElementById('bulkPeriodToggle').addEventListener('change', function() {
        const commentContainer = document.getElementById('bulkCommentContainer');
        const periodContainer = document.getElementById('bulkPeriodContainer');
        const commentInput = document.getElementById('bulkComment');
        const periodFromInput = document.getElementById('bulkPeriodFrom');
        const periodToInput = document.getElementById('bulkPeriodTo');
        
        if (this.checked) {
            // Показываем период, скрываем комментарий
            commentContainer.style.display = 'none';
            periodContainer.style.display = 'block';
            commentInput.value = ''; // Очищаем комментарий
        } else {
            // Показываем комментарий, скрываем период
            periodContainer.style.display = 'none';
            commentContainer.style.display = 'block';
            periodFromInput.value = '';
            periodToInput.value = '';
        }
    });
}

// === ОБРАБОТКА ФОРМ ===
async function handleSingleSaleSubmit() {
    const btn = document.getElementById('btnSingleSale');
    if (btn.disabled) return;
    
    const formData = {
        client_id: document.getElementById('saleClient').value,
        product_id: document.getElementById('saleProduct').value,
        quantity: document.getElementById('saleQty').value,
        unit_price: document.getElementById('salePrice').value,
        transaction_date: document.getElementById('saleDate').value || new Date().toISOString(),
        comment: document.getElementById('saleComment').value,
        type: document.getElementById('saleType').value
    };
    
    if (!formData.product_id) { 
        showToast('⚠️ Выберите товар'); 
        return; 
    }
    
    // Подтверждение для списаний
    if (formData.type === 'writeoff') {
        const confirmed = await confirmModal(
            'Подтверждение списания',
            `Вы действительно хотите списать ${formData.quantity} ед. товара?`
        );
        if (!confirmed) return;
    }
    
    btn.disabled = true; 
    btn.textContent = '⏳ Обработка...';
    
    try {
        await createSale(formData);
        
        // 🔥 Обновляем метрики клиента
        if (formData.client_id && formData.client_id !== 'empty' && formData.client_id !== 'new') {
            const saleAmount = parseFloat(formData.unit_price) * parseInt(formData.quantity);
            await updateClientMetrics(formData.client_id, saleAmount, 1);
        }
        
        if (window.saveDataToFile) await window.saveDataToFile();
        showToast('✅ Сделка зарегистрирована');        
        document.getElementById('singleSaleForm').reset();
        document.getElementById('saleDate').value = new Date().toISOString().slice(0, 16);
        
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        // Ошибка уже показана пользователю в createSale
        console.error('Sale failed:', error);
    } finally {
        btn.disabled = false; 
        btn.textContent = 'Зарегистрировать сделку';
    }
}

async function handleBulkAdjustmentSubmit() {
    const btn = document.getElementById('btnBulkAdjustment');
    if (btn.disabled) return;
    
    const isPeriodEnabled = document.getElementById('bulkPeriodToggle').checked;
    
    // Формируем комментарий
    let comment = '';
    if (isPeriodEnabled) {
        const periodFrom = document.getElementById('bulkPeriodFrom').value;
        const periodTo = document.getElementById('bulkPeriodTo').value;
        
        if (!periodFrom || !periodTo) {
            showToast('⚠️ Укажите обе даты периода (С и ПО)');
            return;
        }
        
        if (new Date(periodFrom) > new Date(periodTo)) {
            showToast('⚠️ Дата "С" не может быть позже даты "ПО"');
            return;
        }
        
        // Форматируем как текст для сохранения
        const fromFormatted = new Date(periodFrom).toLocaleDateString('ru-RU');
        const toFormatted = new Date(periodTo).toLocaleDateString('ru-RU');
        comment = `Период: с ${fromFormatted} по ${toFormatted}`;
    } else {
        comment = document.getElementById('bulkComment').value;
    }
    
    const formData = {
        product_id: document.getElementById('bulkProduct').value,
        quantity: document.getElementById('bulkQty').value,
        period_start: document.getElementById('bulkDate').value || new Date().toISOString(),
        period_end: null,
        type: document.getElementById('bulkType').value,
        comment: comment
    };
    
    if (!formData.product_id) {
        showToast('⚠️ Выберите товар');
        return;
    }
    
    // Подтверждение для списаний
    if (formData.type === 'writeoff') {
        const confirmed = await confirmModal(
            'Подтверждение пакетного списания',
            `Списать ${formData.quantity} ед. товара?`
        );
        if (!confirmed) return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Обработка...';
    
    try {
        await createBulkAdjustment(formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showToast('✅ Корректировка зарегистрирована');
        
        // Сброс формы
        document.getElementById('bulkAdjustmentForm').reset();
        document.getElementById('bulkDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('bulkPeriodToggle').checked = false;
        document.getElementById('bulkCommentContainer').style.display = 'block';
        document.getElementById('bulkPeriodContainer').style.display = 'none';
        
        // Если модальное окно открыто - закрываем
        closeModal('bulkAdjustmentModal');
        
        // Обновление
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        console.error('Error creating bulk adjustment:', error);
        showToast('❌ Ошибка: ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Зарегистрировать корректировку';
    }
}


// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
}

function getTagLabel(type) {
    const labels = { sale: 'Продажа', writeoff: 'Списание', restock: 'Поступление' };
    return labels[type] || type;
}

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

function confirmModal(title, message) {
    return new Promise(resolve => {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        document.getElementById('confirmModal').style.display = 'block';
        
        const onConfirm = () => { cleanup(); resolve(true); };
        const onCancel = () => { cleanup(); resolve(false); };
        const cleanup = () => {
            document.getElementById('modalConfirm').removeEventListener('click', onConfirm);
            document.getElementById('modalCancel').removeEventListener('click', onCancel);
        };
        
        document.getElementById('modalConfirm').addEventListener('click', onConfirm);
        document.getElementById('modalCancel').addEventListener('click', onCancel);
    });
}

// Удаление записи о продаже
window.deleteSaleById = async function(id) {
    if (!confirm('Удалить эту запись?')) return;
    
    try {
        await deleteItem('sales', id);
        if (window.saveDataToFile) await window.saveDataToFile();
        loadSalesTable();
        showToast('✅ Запись удалена');
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message);
    }
};

// === ЭКСПОРТ ДЛЯ ПЕРЕИСПОЛЬЗОВАНИЯ ===
export { loadSalesTable, populateDropdowns };