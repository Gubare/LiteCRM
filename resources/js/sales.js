// resources/js/sales.js
// Логика страницы продаж (рефакторинг)

import { 
    getProductsForDropdown, 
    createSale, 
    createBulkAdjustment, 
    getSalesPaginated,
    deleteItem,
    getItemById,
    updateItem,
    getAllItems
} from './db_sqlite.js';
import { getSetting } from './settings-manager.js';
import { renderPagination } from './partials/pagination.js';
import { createTruncatableHtml, initTextViewer } from './partials/textViewer.js';
import { SelectionManager } from './partials/selectionManager.js';
import { confirmModal } from './partials/modalManager.js';
import { showSuccess, showError, showWarning } from './partials/toast.js';

// === СОСТОЯНИЕ СТРАНИЦЫ ===
let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};
let selectionManager = null;

// Маппинг типов для отображения (английский ключ → русский текст + класс)
const TYPE_LABELS = {
    sale: { text: 'Продажа', class: 'badge-success' },
    writeoff: { text: 'Списание', class: 'badge-danger' },
    restock: { text: 'Поступление', class: 'badge-info' }
};

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    await waitForDatabase();
    await populateDropdowns();
    await loadSalesTable();
    
    // Инициализация общих компонентов
    initTextViewer();
    initSelectionManager();
    
    setupEventListeners();
    
    // Установка даты по умолчанию
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('saleDate').value = now.toISOString().slice(0, 16);
});

async function waitForDatabase() {
    if (window.isDatabaseReady) return;
    return new Promise(resolve => {
        const check = () => window.isDatabaseReady ? resolve() : setTimeout(check, 50);
        check();
    });
}

function initSelectionManager() {
    selectionManager = new SelectionManager({
        tableBodySelector: '#salesTable tbody',
        actionBarId: 'bulkActionBar',
        ctxMenuId: 'ctxMenu',
        callbacks: {
            onEdit: openEditSale,
            onDelete: handleBulkDelete
        }
    });
}


async function handleBulkDelete() {
    await selectionManager.bulkDelete(
        'sales',
        (count) => {
            showSuccess(`✅ Удалено: ${count}`);
            loadSalesTable();
        },
        (err) => showError('❌ ' + err.message)
    );
}

window.deleteSelected = handleBulkDelete;

async function clearSelection(params) {
    await selectionManager.clear()
    
}

window.clearSelection = clearSelection
// === ЗАПОЛНЕНИЕ ВЫПАДАЮЩИХ СПИСКОВ ===
let priceAutoFillAttached = false;

async function populateDropdowns() {
    try {
        const [products, clients] = await Promise.all([
            getProductsForDropdown(),
            getAllItems('clients')
        ]);
        
        const productOptions = products
            .filter(p => p.is_active)
            .map(p => `<option value="${p.id}" data-price="${p.price}" data-stock="${p.quantity}">
                ${p.sku} — ${p.name} (ост.: ${p.quantity}, ${p.price}₽)
            </option>`).join('');
        
        // Заполнение селектов с проверкой на null
        const fillSelect = (id, defaultOption, options) => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = defaultOption + options;
        };
        
        fillSelect('filterProduct', '<option value="">Все товары</option>', productOptions);
        fillSelect('saleProduct', '<option value="">Выберите товар...</option>', productOptions);
        fillSelect('bulkProduct', '<option value="">Выберите товар...</option>', productOptions);
        
        const clientOptions = clients.map(c => 
            `<option value="${c.id}">${c.name} (${c.phone || c.email || 'нет контакта'})</option>`
        ).join('');
        fillSelect('saleClient', '<option value="empty">🔘 Не указан</option><option value="new">➕ Создать клиента</option>', clientOptions);
        
        // Автозаполнение цены (один раз)
        const saleProduct = document.getElementById('saleProduct');
        if (saleProduct && !priceAutoFillAttached) {
            saleProduct.addEventListener('change', function() {
                const price = this.options[this.selectedIndex]?.dataset.price;
                const salePriceInput = document.getElementById('salePrice');
                if (price && salePriceInput) salePriceInput.value = price;
            });
            priceAutoFillAttached = true;
        }
        
    } catch (error) {
        console.error('Error populating dropdowns:', error);
        showWarning('⚠️ Не удалось загрузить списки');
    }
}

// === ЗАГРУЗКА ТАБЛИЦЫ ===
export async function loadSalesTable(customSort = null) {
    const tbody = document.querySelector('#salesTable tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:20px;">⏳ Загрузка...</td></tr>';
    
    const sortValue = customSort || document.getElementById('sortSelect')?.value;
    
    try {
        const result = await getSalesPaginated(currentPage, currentPageSize, currentFilters, sortValue);
        
        renderSalesTable(result.items);
        
        // Универсальная пагинация
        renderPagination(
            document.getElementById('pagination'),
            document.getElementById('paginationInfo'),
            currentPage,
            result.pagination.total_pages,
            result.pagination.total_items,
            currentPageSize,
            (page) => { currentPage = page; loadSalesTable(); }
        );
        
        const table = document.getElementById('salesTable');
        if (table) table.classList.add('loaded');
        
    } catch (error) {
        console.error('Error loading sales:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;color:#ef4444;">❌ ${error.message}</td></tr>`;
        }
        showError('Ошибка загрузки данных');
    }
}

// === РЕНДЕР ТАБЛИЦЫ ===
function renderSalesTable(items) {
    const shouldAnimate = getSetting('ui.animateRows');
    const tbody = document.querySelector('#salesTable tbody');
    
    if (!tbody) return;
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:40px;color:#94a3b8;">📭 Нет записей</td></tr>';
        return;
    }
    
    Promise.all([getAllItems('products'), getAllItems('clients')]).then(([products, clients]) => {
        const productMap = Object.fromEntries(products.map(p => [p.id, p]));
        const clientMap = Object.fromEntries(clients.map(c => [c.id, c]));
        
        tbody.innerHTML = items.map((item, index) => {
            const product = productMap[item.product_id];
            const client = item.client_id ? (clientMap[item.client_id]?.name || `ID:${item.client_id}`) : '—';
            
            // Анимация
            const animClass = shouldAnimate ? 'table-row-animate' : '';
            const animDelay = shouldAnimate ? `style="animation-delay:${index * 0.04}s"` : '';
            
            // Комментарий с обрезкой
            const commentHtml = createTruncatableHtml(item.comment, 25, 'Комментарий');
            
            // Сумма и тип
            const isPositive = item.type === 'restock';
            const sumClass = isPositive ? 'color:#166534' : 'color:#991b1b';
            const sumSign = isPositive ? '+' : '';
            const typeInfo = TYPE_LABELS[item.type] || { text: item.type, class: 'badge-gray' };
            
            // Фон для записей с периодом
            const hasPeriod = item.comment?.includes('📅 Период:');
            const rowBg = hasPeriod ? 'background:#f0f9ff' : '';
            
            return `
            <tr data-id="${item.id}" class="${animClass}" ${animDelay} style="${rowBg}">
                <td><strong>#${item.id}</strong></td>
                <td>${product ? `${product.sku} ${product.name}` : '-'}</td>
                <td>${client}</td>
                <td style="text-align:center">${item.quantity}</td>
                <td style="text-align:right;font-weight:600;${sumClass}">${sumSign}${(item.total_amount || 0).toFixed(2)} ₽</td>
                <td>${new Date(item.transaction_date).toLocaleDateString()}</td>
                <td><span class="badge ${typeInfo.class}">${typeInfo.text}</span></td>
                <td style="max-width:150px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                    ${commentHtml}
                </td>
            </tr>`;
        }).join('');
        
        // Перепривязываем обработчики выделения (для динамических строк)
        // if (selectionManager) selectionManager.refresh();
    });
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    // Формы
    document.getElementById('singleSaleForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleSingleSaleSubmit();
        closeModal('singleSaleModal');
    });
    
    document.getElementById('bulkAdjustmentForm')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleBulkAdjustmentSubmit();
        closeModal('bulkAdjustmentModal');
    });
    
    // Фильтры и пагинация
    document.getElementById('pageSize')?.addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value);
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('btnApplyFilters')?.addEventListener('click', () => {
        currentFilters = {
            type: document.getElementById('filterType')?.value || null,
            product_id: document.getElementById('filterProduct')?.value || null,
            date_from: document.getElementById('filterDateFrom')?.value || null,
            date_to: document.getElementById('filterDateTo')?.value || null
        };
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('btnResetFilters')?.addEventListener('click', () => {
        ['filterType', 'filterProduct', 'filterDateFrom', 'filterDateTo'].forEach(id => {
            const el = document.getElementById(id);
            if (el) el.value = '';
        });
        currentFilters = {};
        currentPage = 1;
        loadSalesTable();
    });
    
    document.getElementById('sortSelect')?.addEventListener('change', (e) => {
        currentPage = 1;
        loadSalesTable(e.target.value);
    });
    
    // Модальные окна
    document.getElementById('modalCancel')?.addEventListener('click', () => {
        document.getElementById('confirmModal').style.display = 'none';
    });
    
    document.getElementById('confirmModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'confirmModal') {
            document.getElementById('confirmModal').style.display = 'none';
        }
    });
    
    // Клиент: создать нового
    document.getElementById('saleClient')?.addEventListener('change', async (e) => {
        if (e.target.value === 'new') {
            e.target.value = 'empty';
            if (confirm('Перейти к созданию клиента?')) {
                window.location.href = 'clients.html';
            }
        }
    });
    
    // Переключение периода/комментария
    setupPeriodToggle('salePeriodToggle', 'saleCommentContainer', 'salePeriodContainer', 'saleComment', 'salePeriodFrom', 'salePeriodTo');
    setupPeriodToggle('bulkPeriodToggle', 'bulkCommentContainer', 'bulkPeriodContainer', 'bulkComment', 'bulkPeriodFrom', 'bulkPeriodTo');
}

// Хелпер для переключения период/комментарий
function setupPeriodToggle(toggleId, commentContainerId, periodContainerId, commentInputId, fromInputId, toInputId) {
    const toggle = document.getElementById(toggleId);
    if (!toggle) return;
    
    toggle.addEventListener('change', function() {
        const showPeriod = this.checked;
        document.getElementById(commentContainerId).style.display = showPeriod ? 'none' : 'block';
        document.getElementById(periodContainerId).style.display = showPeriod ? 'block' : 'none';
        
        const commentInput = document.getElementById(commentInputId);
        const fromInput = document.getElementById(fromInputId);
        const toInput = document.getElementById(toInputId);
        
        if (showPeriod) {
            if (commentInput) commentInput.value = '';
        } else {
            if (fromInput) fromInput.value = '';
            if (toInput) toInput.value = '';
        }
    });
}

// === ОБРАБОТКА ФОРМ ===

async function handleSingleSaleSubmit() {
    const btn = document.getElementById('btnSingleSale');
    if (btn?.disabled) return;
    
    const isPeriod = document.getElementById('salePeriodToggle')?.checked;
    let comment = '';
    
    if (isPeriod) {
        const from = document.getElementById('salePeriodFrom')?.value;
        const to = document.getElementById('salePeriodTo')?.value;
        
        if (!from || !to) { showWarning('Укажите обе даты периода'); return; }
        if (new Date(from) > new Date(to)) { showWarning('Некорректный период'); return; }
        
        const fmt = d => new Date(d).toLocaleDateString('ru-RU');
        comment = `📅 Период: с ${fmt(from)} по ${fmt(to)}`;
    } else {
        comment = document.getElementById('saleComment')?.value || '';
    }
    
    const formData = {
        client_id: document.getElementById('saleClient')?.value,
        product_id: document.getElementById('saleProduct')?.value,
        quantity: document.getElementById('saleQty')?.value,
        unit_price: document.getElementById('salePrice')?.value,
        transaction_date: document.getElementById('saleDate')?.value || new Date().toISOString(),
        comment,
        type: document.getElementById('saleType')?.value
    };
    
    if (!formData.product_id) { showWarning('Выберите товар'); return; }
    
    if (formData.type === 'writeoff') {
        const ok = await confirmModal('Подтверждение', `Списать ${formData.quantity} ед.?`);
        if (!ok) return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Обработка...';
    
    try {
        await createSale(formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showSuccess('✅ Сделка зарегистрирована');
        
        // Сброс формы
        document.getElementById('singleSaleForm')?.reset();
        document.getElementById('saleDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('salePeriodToggle').checked = false;
        document.getElementById('saleCommentContainer').style.display = 'block';
        document.getElementById('salePeriodContainer').style.display = 'none';
        
        closeModal('singleSaleModal');
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        console.error('Error creating sale:', error);
        showError('❌ ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Зарегистрировать сделку';
    }
}

async function handleBulkAdjustmentSubmit() {
    const btn = document.getElementById('btnBulkAdjustment');
    if (btn?.disabled) return;
    
    const isPeriod = document.getElementById('bulkPeriodToggle')?.checked;
    let comment = '';
    
    if (isPeriod) {
        const from = document.getElementById('bulkPeriodFrom')?.value;
        const to = document.getElementById('bulkPeriodTo')?.value;
        
        if (!from || !to) { showWarning('Укажите обе даты'); return; }
        if (new Date(from) > new Date(to)) { showWarning('Некорректный период'); return; }
        
        const fmt = d => new Date(d).toLocaleDateString('ru-RU');
        comment = `📅 Период: с ${fmt(from)} по ${fmt(to)}`;
    } else {
        comment = document.getElementById('bulkComment')?.value || '';
    }
    
    const formData = {
        product_id: document.getElementById('bulkProduct')?.value,
        quantity: document.getElementById('bulkQty')?.value,
        period_start: document.getElementById('bulkDate')?.value || new Date().toISOString(),
        period_end: null,
        type: document.getElementById('bulkType')?.value,
        comment
    };
    
    if (!formData.product_id) { showWarning('Выберите товар'); return; }
    
    if (formData.type === 'writeoff') {
        const ok = await confirmModal('Подтверждение', `Списать ${formData.quantity} ед.?`);
        if (!ok) return;
    }
    
    btn.disabled = true;
    btn.textContent = '⏳ Обработка...';
    
    try {
        await createBulkAdjustment(formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showSuccess('✅ Корректировка зарегистрирована');
        
        document.getElementById('bulkAdjustmentForm')?.reset();
        document.getElementById('bulkDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('bulkPeriodToggle').checked = false;
        document.getElementById('bulkCommentContainer').style.display = 'block';
        document.getElementById('bulkPeriodContainer').style.display = 'none';
        
        closeModal('bulkAdjustmentModal');
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        console.error('Error creating bulk adjustment:', error);
        showError('❌ ' + error.message);
    } finally {
        btn.disabled = false;
        btn.textContent = 'Зарегистрировать корректировку';
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function showToast(message) {
    // Обёртка для обратной совместимости
    showSuccess(message);
}

// Управление модальными окнами (глобальные для HTML)
window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};

window.closeModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

window.closeModalOnOverlay = function(event, modalId) {
    if (event.target.id === modalId) {
        window.closeModal(modalId);
    }
};

// Редактирование записи
window.openEditSale = async function(id) {
    try {
        const item = await getItemById('sales', id);
        if (!item) { showError('Запись не найдена'); return; }
        
        document.getElementById('editSaleId').value = item.id;
        document.getElementById('editSaleQty').value = item.quantity;
        document.getElementById('editSalePrice').value = item.unit_price;
        document.getElementById('editSaleComment').value = item.comment || '';
        
        const dateObj = new Date(item.transaction_date);
        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        document.getElementById('editSaleDate').value = dateObj.toISOString().slice(0, 16);
        
        openModal('editSaleModal');
    } catch (err) {
        showError('❌ ' + err.message);
    }
};

// Удаление записи
window.deleteSaleById = async function(id) {
    if (!confirm('Удалить запись?')) return;
    try {
        await deleteItem('sales', id);
        if (window.saveDataToFile) await window.saveDataToFile();
        showSuccess('✅ Запись удалена');
        loadSalesTable();
    } catch (err) {
        showError('❌ Ошибка удаления');
    }
};

// === КОНТЕКСТНОЕ МЕНЮ И ДЕЙСТВИЯ ===

// Редактирование из контекстного меню
window.ctxEditAction = async function() {
    hideContextMenu();
    const id = selectionManager?.getCtxTargetId();
    if (id) await openEditSale(id);
};

// Удаление из контекстного меню
window.ctxDeleteAction = async function() {
    hideContextMenu();
    const id = selectionManager?.getCtxTargetId();
    if (!id) return;
    
    if (!confirm('Удалить эту запись?')) return;
    
    try {
        await deleteItem('sales', id);
        if (window.saveDataToFile) await window.saveDataToFile();
        showSuccess('✅ Запись удалена');
        loadSalesTable();
    } catch (err) {
        showError('❌ ' + err.message);
    }
};

// Массовое удаление (как у клиентов - без редактирования)
export async function deleteSelected() {
    const count = selectionManager?.getSelectedIds().length || 0;
    if (count === 0) return;
    
    if (!confirm(`Удалить ${count} записей?`)) return;

    try {
        const ids = selectionManager.getSelectedIds();
        for (const id of ids) {
            await deleteItem('sales', id);
        }
        if (window.saveDataToFile) await window.saveDataToFile();
        
        selectionManager.clear();
        showSuccess(`✅ Удалено записей: ${count}`);
        loadSalesTable();
    } catch (err) {
        showError('❌ ' + err.message);
    }
}

// Скрытие контекстного меню
function hideContextMenu() {
    const menu = document.getElementById('ctxMenu');
    if (menu) menu.style.display = 'none';
}

// Глобальный экспорт
window.deleteSelected = deleteSelected;
window.ctxEditAction = ctxEditAction;
window.ctxDeleteAction = ctxDeleteAction;
window.hideContextMenu = hideContextMenu;