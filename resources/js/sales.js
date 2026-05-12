// resources/js/sales.js
// Логика страницы продаж

import { 
    getProductsForDropdown, 
    createSale, 
    createBulkAdjustment, 
    getSalesPaginated,
    deleteItem,
    getItemById,
    updateItem,
    updateClientMetrics,
    getAllItems
} from './db_indexeddb.js';
import { getSetting } from './settings-manager.js';
import { renderPagination } from './partials/pagination.js';
import { createTruncatableHtml, initTextViewer } from './partials/textViewer.js';

// === СОСТОЯНИЕ СТРАНИЦЫ ===
let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};

function goToPage(newPage) {
    currentPage = newPage;
    loadSalesTable();
}

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    await waitForDatabase();
    await populateDropdowns();
    await loadSalesTable();
    setupEventListeners();
    initTextViewer();
    
    // Установка даты по умолчанию
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    const isoString = now.toISOString().slice(0, 16);
    document.getElementById('saleDate').value = isoString;
    // document.getElementById('bulkDate').value = isoString;
});

async function waitForDatabase() {
    if (window.isDatabaseReady) return;
    return new Promise(resolve => {
        const check = () => window.isDatabaseReady ? resolve() : setTimeout(check, 50);
        check();
    });
}

// === ЗАПОЛНЕНИЕ ВЫПАДАЮЩИХ СПИСКОВ ===
let priceAutoFillAttached = false;

async function populateDropdowns() {
    try {
        const products = await getProductsForDropdown();
        const clients = await getAllItems('clients');
        
        const productOptions = products
            .filter(p => p.is_active)
            .map(p => `<option value="${p.id}" data-price="${p.price}" data-stock="${p.quantity}">
                ${p.sku} — ${p.name} (ост.: ${p.quantity}, ${p.price}₽)
            </option>`).join('');
        
        // 🔥 Добавляем проверки на null
        const saleProduct = document.getElementById('saleProduct');
        const bulkProduct = document.getElementById('bulkProduct');
        const filterProduct = document.getElementById('filterProduct');
        
        if (filterProduct) {
            filterProduct.innerHTML = '<option value="">Все товары</option>' + productOptions;
        }
        if (saleProduct) {
            saleProduct.innerHTML = '<option value="">Выберите товар...</option>' + productOptions;
        }
        if (bulkProduct) {
            bulkProduct.innerHTML = '<option value="">Выберите товар...</option>' + productOptions;
        }
        
        const clientOptions = clients.map(c => 
            `<option value="${c.id}">${c.name} (${c.phone || c.email || 'нет контакта'})</option>`
        ).join('');
        
        const saleClient = document.getElementById('saleClient');
        if (saleClient) {
            saleClient.innerHTML = 
                '<option value="empty">🔘 Не указан</option><option value="new">➕ Создать клиента</option>' + clientOptions;
        }
        
        //Автозаполнение цены: проверяем существование элемента
        if (saleProduct && !priceAutoFillAttached) {
            saleProduct.addEventListener('change', function() {
                const option = this.options[this.selectedIndex];
                const price = option.dataset.price;
                const salePriceInput = document.getElementById('salePrice');
                if (price && salePriceInput) {
                    salePriceInput.value = price;
                }
            });
            priceAutoFillAttached = true;
        }
        
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

        let sales = await getAllItems('sales');
        const total = sales.length;
        const start = (currentPage - 1) * currentPageSize;
        const pagedTickets = sales.slice(start, start + currentPageSize);
        const paginationContainer = document.getElementById('pagination');
        const paginationInfo = document.getElementById('paginationInfo');

        // Вызываем функцию из импортированного модуля
        renderPagination(
            paginationContainer, 
            paginationInfo, 
            currentPage, 
            Math.ceil(total / currentPageSize), 
            total, 
            currentPageSize, 
            goToPage // Функция, которую вызывает модуль при клике
        );
        
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
    const shouldAnimate = getSetting('ui.animateRows');
    const tbody = document.querySelector('#salesTable tbody');
    
    if (!tbody) {
        console.error('❌ Table body not found! Check HTML structure.');
        return;
    }
    
    if (items.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9" style="text-align: center; padding: 40px; color: #94a3b8;">Нет ни одной записи!</td></tr>';
        return;
    }
    
    Promise.all([getAllItems('products'), getAllItems('clients')]).then(([products, clients]) => {
        const productMap = {};
        const clientMap = {};
        products.forEach(p => productMap[p.id] = p);
        clients.forEach(c => clientMap[c.id] = c);
        
        tbody.innerHTML = items.map((item, index) => {
            const product = productMap[item.product_id];
            const client = item.client_id ? (clientMap[item.client_id]?.name || 'ID:' + item.client_id) : '—';

            // Анимация: применяем класс к tr
            const animClass = shouldAnimate ? 'table-row-animate' : '';
            const animDelay = shouldAnimate ? `style="animation-delay: ${index * 0.04}s;"` : '';
            
            // Комментарий
            const commentText = item.comment || '—';
            const commentDisplay = commentText === '—' ? '—' : (commentText.length > 20 ? commentText.substring(0, 20) + '...' : commentText);
            const commentHtml = createTruncatableHtml(item.comment, 25, 'Описание');
            
            // Сумма
            const isPositive = item.type === 'restock';
            const sumClass = isPositive ? 'color: #166534;' : 'color: #991b1b;';
            const sumSign = isPositive ? '+' : '';
            
            // Бейдж типа
            let typeBadge = 'badge-gray';
            if (item.type === 'sale') typeBadge = 'badge-success';
            if (item.type === 'writeoff') typeBadge = 'badge-danger';
            if (item.type === 'restock') typeBadge = 'badge-info';
            
            // Тёмный фон для записей с периодом
            const hasPeriod = item.comment && item.comment.includes('📅 Период:');
            const rowBg = hasPeriod ? 'background: #f0f9ff;' : '';
            
            return `
            <tr data-id="${item.id}" 
                class="${animClass}" 
                ${animDelay}
                style="${rowBg}"
                onclick="handleRowClick(event, ${item.id})">
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
            </tr>`;
        }).join('');
    });
}


// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    // Формы
    const singleSaleForm = document.getElementById('singleSaleForm');
    const bulkAdjustmentForm = document.getElementById('bulkAdjustmentForm');
    
    if (singleSaleForm) {
        singleSaleForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleSingleSaleSubmit();
            closeModal('singleSaleModal');
        });
    }
    
    if (bulkAdjustmentForm) {
        bulkAdjustmentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleBulkAdjustmentSubmit();
            closeModal('bulkAdjustmentModal');
        });
    }
    
    // Пагинация и фильтры
    const pageSize = document.getElementById('pageSize');
    const btnApplyFilters = document.getElementById('btnApplyFilters');
    const btnResetFilters = document.getElementById('btnResetFilters');
    const sortSelect = document.getElementById('sortSelect');
    
    if (pageSize) {
        pageSize.addEventListener('change', (e) => {
            currentPageSize = parseInt(e.target.value);
            currentPage = 1;
            loadSalesTable();
        });
    }
    
    if (btnApplyFilters) {
        btnApplyFilters.addEventListener('click', () => {
            currentFilters = {
                type: document.getElementById('filterType')?.value || null,
                product_id: document.getElementById('filterProduct')?.value || null,
                date_from: document.getElementById('filterDateFrom')?.value || null,
                date_to: document.getElementById('filterDateTo')?.value || null
            };
            currentPage = 1;
            loadSalesTable();
        });
    }
    
    if (btnResetFilters) {
        btnResetFilters.addEventListener('click', () => {
            const filterType = document.getElementById('filterType');
            const filterProduct = document.getElementById('filterProduct');
            const filterDateFrom = document.getElementById('filterDateFrom');
            const filterDateTo = document.getElementById('filterDateTo');
            
            if (filterType) filterType.value = '';
            if (filterProduct) filterProduct.value = '';
            if (filterDateFrom) filterDateFrom.value = '';
            if (filterDateTo) filterDateTo.value = '';
            
            currentFilters = {};
            currentPage = 1;
            loadSalesTable();
        });
    }
    
    if (sortSelect) {
        sortSelect.addEventListener('change', (e) => {
            currentPage = 1;
            loadSalesTable(e.target.value); 
        });
    }
    
    // Модальные окна
    const modalCancel = document.getElementById('modalCancel');
    const confirmModal = document.getElementById('confirmModal');
    
    if (modalCancel) {
        modalCancel.addEventListener('click', () => {
            document.getElementById('confirmModal').style.display = 'none';
        });
    }
    
    if (confirmModal) {
        confirmModal.addEventListener('click', (e) => {
            if (e.target.id === 'confirmModal') {
                confirmModal.style.display = 'none';
            }
        });
    }
    
    // Клиент: создать нового
    const saleClient = document.getElementById('saleClient');
    if (saleClient) {
        saleClient.addEventListener('change', async (e) => {
            if (e.target.value === 'new') {
                e.target.value = 'empty';
                if (confirm('Перейти на страницу создания клиента?')) {
                    window.location.href = 'clients.html';
                }
            }
        });
    }

    // Период для единичной сделки - с проверкой
    const salePeriodToggle = document.getElementById('salePeriodToggle');
    if (salePeriodToggle) {
        salePeriodToggle.addEventListener('change', function() {
            const commentContainer = document.getElementById('saleCommentContainer');
            const periodContainer = document.getElementById('salePeriodContainer');
            const commentInput = document.getElementById('saleComment');
            const periodFromInput = document.getElementById('salePeriodFrom');
            const periodToInput = document.getElementById('salePeriodTo');
            
            if (this.checked) {
                if (commentContainer) commentContainer.style.display = 'none';
                if (periodContainer) periodContainer.style.display = 'block';
                if (commentInput) commentInput.value = '';
            } else {
                if (periodContainer) periodContainer.style.display = 'none';
                if (commentContainer) commentContainer.style.display = 'block';
                if (periodFromInput) periodFromInput.value = '';
                if (periodToInput) periodToInput.value = '';
            }
        });
    }
}
// === ОБРАБОТКА ФОРМ ===

// Единичная сделка
async function handleSingleSaleSubmit() {
    const btn = document.getElementById('btnSingleSale');
    if (btn.disabled) return;
    
    const isPeriodEnabled = document.getElementById('salePeriodToggle')?.checked || false;
    
    let comment = '';
    if (isPeriodEnabled) {
        const periodFrom = document.getElementById('salePeriodFrom').value;
        const periodTo = document.getElementById('salePeriodTo').value;
        
        if (!periodFrom || !periodTo) {
            showToast('⚠️ Укажите обе даты периода (С и ПО)');
            return;
        }
        if (new Date(periodFrom) > new Date(periodTo)) {
            showToast('⚠️ Дата "С" не может быть позже даты "ПО"');
            return;
        }
        const fromFormatted = new Date(periodFrom).toLocaleDateString('ru-RU');
        const toFormatted = new Date(periodTo).toLocaleDateString('ru-RU');
        comment = `📅 Период: с ${fromFormatted} по ${toFormatted}`;
    } else {
        comment = document.getElementById('saleComment').value;
    }
    
    const formData = {
        client_id: document.getElementById('saleClient').value,
        product_id: document.getElementById('saleProduct').value,
        quantity: document.getElementById('saleQty').value,
        unit_price: document.getElementById('salePrice').value,
        transaction_date: document.getElementById('saleDate').value || new Date().toISOString(),
        comment: comment,
        type: document.getElementById('saleType').value
    };
    
    if (!formData.product_id) { showToast('⚠️ Выберите товар'); return; }
    
    if (formData.type === 'writeoff') {
        const confirmed = await confirmModal('Подтверждение списания', `Списать ${formData.quantity} ед. товара?`);
        if (!confirmed) return;
    }
    
    btn.disabled = true; btn.textContent = '⏳ Обработка...';
    
    try {
        await createSale(formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showToast('✅ Сделка зарегистрирована');
        
        document.getElementById('singleSaleForm').reset();
        document.getElementById('saleDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('salePeriodToggle').checked = false;
        document.getElementById('saleCommentContainer').style.display = 'block';
        document.getElementById('salePeriodContainer').style.display = 'none';
        
        closeModal('singleSaleModal');
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        console.error('Error creating sale:', error);
        showToast('❌ Ошибка: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Зарегистрировать сделку';
    }
}

// Пакетная корректировка
async function handleBulkAdjustmentSubmit() {
    const btn = document.getElementById('btnBulkAdjustment');
    if (btn.disabled) return;
    
    const isPeriodEnabled = document.getElementById('bulkPeriodToggle')?.checked || false;
    
    let comment = '';
    if (isPeriodEnabled) {
        const periodFrom = document.getElementById('bulkPeriodFrom').value;
        const periodTo = document.getElementById('bulkPeriodTo').value;
        
        if (!periodFrom || !periodTo) { showToast('⚠️ Укажите обе даты периода'); return; }
        if (new Date(periodFrom) > new Date(periodTo)) { showToast('⚠️ Некорректный период'); return; }
        
        const fromFormatted = new Date(periodFrom).toLocaleDateString('ru-RU');
        const toFormatted = new Date(periodTo).toLocaleDateString('ru-RU');
        comment = `📅 Период: с ${fromFormatted} по ${toFormatted}`;
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
    
    if (!formData.product_id) { showToast('⚠️ Выберите товар'); return; }
    
    if (formData.type === 'writeoff') {
        const confirmed = await confirmModal('Подтверждение списания', `Списать ${formData.quantity} ед.?`);
        if (!confirmed) return;
    }
    
    btn.disabled = true; btn.textContent = '⏳ Обработка...';
    
    try {
        await createBulkAdjustment(formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showToast('✅ Корректировка зарегистрирована');
        
        document.getElementById('bulkAdjustmentForm').reset();
        document.getElementById('bulkDate').value = new Date().toISOString().slice(0, 16);
        document.getElementById('bulkPeriodToggle').checked = false;
        document.getElementById('bulkCommentContainer').style.display = 'block';
        document.getElementById('bulkPeriodContainer').style.display = 'none';
        
        closeModal('bulkAdjustmentModal');
        await populateDropdowns();
        loadSalesTable();
        
    } catch (error) {
        console.error('Error creating bulk adjustment:', error);
        showToast('❌ Ошибка: ' + error.message);
    } finally {
        btn.disabled = false; btn.textContent = 'Зарегистрировать корректировку';
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function formatDate(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    return date.toLocaleDateString('ru-RU') + ' ' + date.toLocaleTimeString('ru-RU', {hour: '2-digit', minute:'2-digit'});
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

// === ВЫДЕЛЕНИЕ И КОНТЕКСТНОЕ МЕНЮ ===
window.selectedRows = new Map();
window.ctxTargetId = null;

window.handleRowClick = function(event, id) {
    event.preventDefault();
    const row = event.currentTarget;
    const modifier = getSetting('ui.selectionModifier') || 'shift';
    const isModifier = modifier === 'shift' ? event.shiftKey : (event.ctrlKey || event.metaKey);

    if (isModifier) {
        if (window.selectedRows.has(id)) window.selectedRows.delete(id);
        else window.selectedRows.set(id, row);
    } else {
        window.selectedRows.clear();
        window.selectedRows.set(id, row);
    }
    window.updateSelectionUI();
};

window.updateSelectionUI = function() {
    document.querySelectorAll('.crm-table tbody tr').forEach(tr => tr.classList.remove('selected'));
    window.selectedRows.forEach(row => row.classList.add('selected'));

    const bar = document.getElementById('bulkActionBar');
    const countBadge = document.getElementById('selectedCount');
    const btnEdit = document.getElementById('btnBulkEdit');
    const btnDelete = document.getElementById('btnBulkDelete');
    const count = window.selectedRows.size;

    if (count > 0) {
        bar.classList.add('visible');
        countBadge.textContent = count;
        btnEdit.disabled = count !== 1;
        btnDelete.disabled = false;
    } else {
        bar.classList.remove('visible');
    }
};

// ПКМ
document.addEventListener('contextmenu', async (e) => {
    const row = e.target.closest('tr');
    if (!row || !row.dataset.id) return;
    e.preventDefault();
    
    window.ctxTargetId = parseInt(row.dataset.id);
    window.showContextMenu(e.pageX, e.pageY);
});

window.showContextMenu = function(x, y) {
    const menu = document.getElementById('ctxMenu');
    const btnEdit = document.getElementById('ctxEdit');
    const btnDelete = document.getElementById('ctxDelete');
    
    btnEdit.disabled = !window.ctxTargetId;
    btnDelete.disabled = !window.ctxTargetId;

    const finalX = Math.min(x, window.innerWidth - 190);
    const finalY = Math.min(y, window.innerHeight - 130);
    
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.display = 'block';
};

export function hideContextMenu() {
    document.getElementById('ctxMenu').style.display = 'none';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-menu')) hideContextMenu();
});

window.ctxEditAction = async function() {
    hideContextMenu();
    if (window.ctxTargetId) await window.openEditSale(window.ctxTargetId);
};

window.ctxDeleteAction = async function() {
    hideContextMenu();
    if (!window.ctxTargetId) return;
    if (!confirm('Удалить эту запись?')) return;
    
    try {
        await deleteItem('sales', window.ctxTargetId);
        if (window.saveDataToFile) await window.saveDataToFile();
        showToast('✅ Удалено');
        loadSalesTable();
    } catch (err) { showToast('❌ Ошибка: ' + err.message); }
};

window.openEditSale = async function(id) {
    try {
        const item = await getItemById('sales', id);
        if (!item) { showToast('❌ Запись не найдена'); return; }
        
        document.getElementById('editSaleId').value = item.id;
        document.getElementById('editSaleQty').value = item.quantity;
        document.getElementById('editSalePrice').value = item.unit_price;
        document.getElementById('editSaleComment').value = item.comment || '';
        
        const dateObj = new Date(item.transaction_date);
        dateObj.setMinutes(dateObj.getMinutes() - dateObj.getTimezoneOffset());
        document.getElementById('editSaleDate').value = dateObj.toISOString().slice(0, 16);
        
        openModal('editSaleModal');
    } catch (err) { showToast('❌ Ошибка: ' + err.message); }
};

window.editSelected = async function() {
    if (window.selectedRows.size !== 1) return;
    const [id] = window.selectedRows.keys();
    await window.openEditSale(id);
};

window.deleteSelected = async function() {
    const count = window.selectedRows.size;
    if (count === 0) return;
    if (!confirm(`Удалить ${count} записей?`)) return;

    try {
        for (const id of Array.from(window.selectedRows.keys())) {
            await deleteItem('sales', id);
        }
        if (window.saveDataToFile) await window.saveDataToFile();
        window.clearSelection();
        showToast(`✅ Удалено записей: ${count}`);
        loadSalesTable();
    } catch (err) { showToast('❌ Ошибка: ' + err.message); }
};

window.clearSelection = function() {
    window.selectedRows.clear();
    window.updateSelectionUI();
};

// Просмотр комментария
window.viewComment = function(text) {
    if (!text || text === '—') return;
    const modal = document.getElementById('viewCommentModal');
    const textContainer = document.getElementById('viewCommentText');
    if (textContainer) {
        textContainer.innerHTML = text.replace(/\n/g, '<br>');
        if (modal) openModal('viewCommentModal');
    }
};

// Управление модалками
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
    if (event.target === document.getElementById(modalId)) {
        window.closeModal(modalId);
    }
};

// Глобальный экспорт
window.deleteSaleById = async function(id) {
    if (!confirm('Удалить эту запись?')) return;
    try {
        await deleteItem('sales', id);
        if (window.saveDataToFile) await window.saveDataToFile();
        showToast('✅ Запись удалена');
        loadSalesTable();
    } catch (err) { showToast('❌ Ошибка удаления'); }
};

// Экспорт для HTML
window.handleRowClick = window.handleRowClick;
window.clearSelection = window.clearSelection;
window.ctxEditAction = window.ctxEditAction;
window.ctxDeleteAction = window.ctxDeleteAction;
window.editSelected = window.editSelected;
window.deleteSelected = window.deleteSelected;
window.openEditSale = window.openEditSale;
window.deleteItem = deleteItem;
window.loadSalesTable = loadSalesTable;
window.showToast = showToast;
window.getItemById = getItemById;
window.getAllItems = getAllItems;
window.updateItem = updateItem;
window.viewComment = window.viewComment;
window.openModal = window.openModal;
window.closeModal = window.closeModal;
window.closeModalOnOverlay = window.closeModalOnOverlay;

export { loadSalesTable, populateDropdowns };