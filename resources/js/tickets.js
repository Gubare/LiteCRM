// resources/js/tickets.js
import { getAllItems, addItem, updateItem, deleteItem, getDbInstance } from './db_indexeddb.js';
import { getSetting } from './settings-manager.js';

let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};
let selectedRows = new Map();
let ctxTargetId = null;


// Создает HTML для обрезки текста с кликом для просмотра
function createTruncatableHtml(text, maxLen = 15) {
    if (!text || text === '—') return '<span style="color: #cbd5e1;">—</span>';
    const display = text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    // Экранируем кавычки для безопасной вставки в onclick
    const safeText = text.replace(/\\/g, '\\\\').replace(/`/g, '\\`').replace(/'/g, "\\'");
    return `<span class="truncatable-cell" onclick="viewFullText('${safeText}')" title="${text}">${display}</span>`;
}

// Просмотр полного текста
window.viewFullText = function(text) {
    document.getElementById('fullTextContent').textContent = text;
    openModal('fullTextModal');
};

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    await waitForDatabase();
    await populateDropdowns();
    await loadTickets();
    setupEventListeners();
});

async function waitForDatabase() {
    if (window.isDatabaseReady) return;
    return new Promise(resolve => {
        const check = () => window.isDatabaseReady ? resolve() : setTimeout(check, 50);
        check();
    });
}

async function populateDropdowns() {
    try {
        const clients = await getAllItems('clients');
        const clientOptions = clients.map(c => {
            // Формируем подпись: телефон -> email -> пусто
            let contactInfo = '';
            if (c.phone) contactInfo = ` (${c.phone})`;
            else if (c.email) contactInfo = ` (${c.email})`;
            return `<option value="${c.name}">${c.name}${contactInfo}</option>`;
        }).join('');
        
        const ticketClient = document.getElementById('ticketClient');
        const editTicketClient = document.getElementById('editTicketClient');
        const filterClient = document.getElementById('filterClient');
        
        if (ticketClient) ticketClient.innerHTML = '<option value="">Оставить пустым</option>' + clientOptions;
        if (editTicketClient) editTicketClient.innerHTML = '<option value="">Оставить пустым</option>' + clientOptions;
        if (filterClient) filterClient.innerHTML = '<option value="">Все клиенты</option>' + clientOptions;
    } catch (error) { console.error('Error populating dropdowns:', error); }
}

// === ЗАГРУЗКА ДАННЫХ ===
async function loadTickets() {
    const tbody = document.querySelector('#ticketTable tbody');
    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">⏳ Загрузка...</td></tr>';
    }
    
    const sortValue = document.getElementById('sortSelect').value;
    
    try {
        let tickets = await getAllItems('tickets');
        
        // Применяем фильтры
        if (currentFilters.type) {
            tickets = tickets.filter(t => t.type === currentFilters.type);
        }
        if (currentFilters.client_name) {
            tickets = tickets.filter(t => t.client_name === currentFilters.client_name);
        }
        if (currentFilters.status) {
            tickets = tickets.filter(t => t.status === currentFilters.status);
        }
        
        // Сортировка
        tickets.sort((a, b) => {
            if (sortValue === 'date_desc') return new Date(b.created_at) - new Date(a.created_at);
            if (sortValue === 'date_asc') return new Date(a.created_at) - new Date(b.created_at);
            return 0;
        });
        
        // Пагинация
        const total = tickets.length;
        const start = (currentPage - 1) * currentPageSize;
        const pagedTickets = tickets.slice(start, start + currentPageSize);
        
        renderTable(pagedTickets);
        renderPagination(currentPage, Math.ceil(total / currentPageSize), total, currentPageSize);
        
    } catch (error) {
        console.error('Error loading tickets:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #ef4444;">❌ Ошибка загрузки</td></tr>`;
        }
    }
}

function renderTable(tickets) {
    const shouldAnimate = getSetting('ui.animateRows');
    const tbody = document.querySelector('#ticketTable tbody');
    
    if (!tbody) return;
    
    if (tickets.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 40px; color: #94a3b8;">📭 Нет обращений</td></tr>';
        return;
    }
    
    tbody.innerHTML = tickets.map((ticket, index) => {
        const animClass = shouldAnimate ? 'table-row-animate' : '';
        const animDelay = shouldAnimate ? `style="animation-delay: ${index * 0.04}s;"` : '';
        
        const statusClass = {
            'Открыта': 'badge-open',
            'Выполнена': 'badge-done',
            'Архив': 'badge-archive'
        }[ticket.status] || 'badge-open';
        
        // 🔥 Обрезка контакта и описания
        const contactHtml = createTruncatableHtml(ticket.contact, 18);
        const descHtml = createTruncatableHtml(ticket.description, 25);
        
        return `
        <tr data-id="${ticket.id}" 
            class="${animClass}" 
            ${animDelay}
            onclick="handleRowClick(event, ${ticket.id})">
            <td><strong>#${ticket.id}</strong></td>
            <td>${ticket.client_name || '—'}</td>
            <td>${ticket.type}</td>
            <td>${contactHtml}</td>
            <td>${descHtml}</td>
            <td>${new Date(ticket.created_at).toLocaleDateString()}</td>
            <td><span class="badge ${statusClass}">${ticket.status}</span></td>
        </tr>`;
    }).join('');
}

function renderPagination(currentPage, totalPages, totalItems, pageSize) {
    const container = document.getElementById('pagination');
    const info = document.getElementById('paginationInfo');
    
    if (!container) return;
    
    info.textContent = `Показано ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalItems)} из ${totalItems}`;
    
    let buttons = '';
    buttons += `<button ${currentPage === 1 ? 'disabled' : ''} onclick="goToPage(${currentPage - 1})" style="padding: 6px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer;">‹</button>`;
    
    for (let i = Math.max(1, currentPage - 2); i <= Math.min(totalPages, currentPage + 2); i++) {
        const activeClass = i === currentPage ? 'style="background: #3b82f6; color: white; border-color: #3b82f6;"' : 'style="padding: 6px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer;"';
        buttons += `<button ${activeClass} onclick="goToPage(${i})">${i}</button>`;
    }
    
    buttons += `<button ${currentPage === totalPages ? 'disabled' : ''} onclick="goToPage(${currentPage + 1})" style="padding: 6px 10px; border: 1px solid #e2e8f0; background: white; border-radius: 4px; cursor: pointer;">›</button>`;
    
    container.innerHTML = buttons;
}

window.goToPage = function(newPage) {
    currentPage = newPage;
    loadTickets();
};

// === ВЫДЕЛЕНИЕ СТРОК ===
window.handleRowClick = function(event, id) {
    event.preventDefault();
    const row = event.currentTarget;
    const modifier = getSetting('ui.selectionModifier') || 'shift';
    const isModifier = modifier === 'shift' ? event.shiftKey : (event.ctrlKey || event.metaKey);

    if (isModifier) {
        if (selectedRows.has(id)) selectedRows.delete(id);
        else selectedRows.set(id, row);
    } else {
        selectedRows.clear();
        selectedRows.set(id, row);
    }
    updateSelectionUI();
};

window.updateSelectionUI = function() {
    document.querySelectorAll('.crm-table tbody tr').forEach(tr => tr.classList.remove('selected'));
    selectedRows.forEach(row => row.classList.add('selected'));

    const bar = document.getElementById('bulkActionBar');
    const countBadge = document.getElementById('selectedCount');
    const btnEdit = document.getElementById('btnBulkEdit');
    const btnDelete = document.getElementById('btnBulkDelete');
    const count = selectedRows.size;

    if (count > 0) {
        bar.classList.add('visible');
        countBadge.textContent = count;
        btnEdit.disabled = count !== 1;
        btnDelete.disabled = false;
    } else {
        bar.classList.remove('visible');
    }
};

window.clearSelection = function() {
    selectedRows.clear();
    updateSelectionUI();
};

// === КОНТЕКСТНОЕ МЕНЮ ===
document.addEventListener('contextmenu', (e) => {
    const row = e.target.closest('tr');
    if (!row || !row.dataset.id) return;
    e.preventDefault();
    
    ctxTargetId = parseInt(row.dataset.id);
    showContextMenu(e.pageX, e.pageY);
});

function showContextMenu(x, y) {
    const menu = document.getElementById('ctxMenu');
    const btnEdit = document.getElementById('ctxEdit');
    const btnDelete = document.getElementById('ctxDelete');
    
    btnEdit.disabled = false;
    btnDelete.disabled = false;

    const finalX = Math.min(x, window.innerWidth - 190);
    const finalY = Math.min(y, window.innerHeight - 130);
    
    menu.style.left = `${finalX}px`;
    menu.style.top = `${finalY}px`;
    menu.style.display = 'block';
}

document.addEventListener('click', (e) => {
    if (!e.target.closest('.ctx-menu')) {
        document.getElementById('ctxMenu').style.display = 'none';
    }
});


window.ctxEditAction = async function() {
    document.getElementById('ctxMenu').style.display = 'none';
    if (ctxTargetId) {
        await openEditTicket(ctxTargetId);
    }
};

window.ctxDeleteAction = async function() {
    document.getElementById('ctxMenu').style.display = 'none';
    
    if (!ctxTargetId) return;
    if (!confirm('Удалить это обращение?')) return;
    
    try {
        await deleteItem('tickets', ctxTargetId);
        if (window.saveDataToFile) await window.saveDataToFile();
        showToast('✅ Обращение удалено');
        loadTickets();
    } catch (err) {
        showToast('❌ Ошибка: ' + err.message);
    }
};


// === РЕДАКТИРОВАНИЕ ===
async function openEditTicket(id) {
    try {
        const tickets = await getAllItems('tickets');
        const ticket = tickets.find(t => t.id === id);
        if (!ticket) { showToast('❌ Обращение не найдено'); return; }
        
        document.getElementById('editTicketId').value = ticket.id;
        document.getElementById('editTicketClient').value = ticket.client_name || '';
        document.getElementById('editTicketType').value = ticket.type;
        document.getElementById('editTicketContact').value = ticket.contact || '';
        document.getElementById('editTicketStatus').value = ticket.status;
        document.getElementById('editTicketDescription').value = ticket.description || '';
        
        openModal('editTicketModal');
    } catch (err) {
        showToast('❌ Ошибка: ' + err.message);
    }
}

window.editSelected = async function() {
    if (selectedRows.size !== 1) return;
    const [id] = selectedRows.keys();
    await openEditTicket(id);
};

window.deleteSelected = async function() {
    const count = selectedRows.size;
    if (count === 0) return;
    if (!confirm(`Удалить ${count} обращений?`)) return;

    try {
        for (const id of Array.from(selectedRows.keys())) {
            await deleteItem('tickets', id);
        }
        if (window.saveDataToFile) await window.saveDataToFile();
        window.clearSelection();
        showToast(`✅ Удалено обращений: ${count}`);
        loadTickets();
    } catch (err) {
        showToast('❌ Ошибка: ' + err.message);
    }
};

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    // Форма создания
    document.getElementById('createTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleCreateTicket();
    });
    
    // Форма редактирования
    document.getElementById('editTicketForm').addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleEditTicket();
    });
    
    // Фильтры
    document.getElementById('btnApplyFilters').addEventListener('click', () => {
        currentFilters = {
            type: document.getElementById('filterType').value || null,
            client_name: document.getElementById('filterClient').value || null,
            status: document.getElementById('filterStatus').value || null
        };
        currentPage = 1;
        loadTickets();
    });
    
    document.getElementById('btnResetFilters').addEventListener('click', () => {
        document.getElementById('filterType').value = '';
        document.getElementById('filterClient').value = '';
        document.getElementById('filterStatus').value = '';
        currentFilters = {};
        currentPage = 1;
        loadTickets();
    });
    
    // Пагинация и сортировка
    document.getElementById('pageSize').addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value);
        currentPage = 1;
        loadTickets();
    });
    
    document.getElementById('sortSelect').addEventListener('change', () => {
        currentPage = 1;
        loadTickets();
    });
}

async function handleCreateTicket() {
    const formData = {
        client_name: document.getElementById('ticketClient').value || null,
        type: document.getElementById('ticketType').value,
        contact: document.getElementById('ticketContact').value,
        status: document.getElementById('ticketStatus').value,
        description: document.getElementById('ticketDescription').value,
        created_at: new Date().toISOString()
    };
    
    if (!formData.type) {
        showToast('⚠️ Выберите тип обращения');
        return;
    }
    
    try {
        await addItem('tickets', formData);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showToast('✅ Обращение создано');
        document.getElementById('createTicketForm').reset();
        closeModal('createTicketModal');
        loadTickets();
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message);
    }
}

async function handleEditTicket() {
    const id = parseInt(document.getElementById('editTicketId').value);
    const updates = {
        client_name: document.getElementById('editTicketClient').value || null,
        type: document.getElementById('editTicketType').value,
        contact: document.getElementById('editTicketContact').value,
        status: document.getElementById('editTicketStatus').value,
        description: document.getElementById('editTicketDescription').value,
        updated_at: new Date().toISOString()
    };
    
    try {
        await updateItem('tickets', id, updates);
        if (window.saveDataToFile) await window.saveDataToFile();
        
        showToast('✅ Обращение обновлено');
        closeModal('editTicketModal');
        loadTickets();
    } catch (error) {
        showToast('❌ Ошибка: ' + error.message);
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    toast.style.cssText = 'position: fixed; bottom: 20px; right: 20px; background: #333; color: white; padding: 12px 20px; border-radius: 8px; z-index: 9999; animation: fadeIn 0.3s;';
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

window.openModal = function(modalId) {
    document.getElementById(modalId).classList.add('active');
    document.body.style.overflow = 'hidden';
};

window.closeModal = function(modalId) {
    document.getElementById(modalId).classList.remove('active');
    document.body.style.overflow = '';
};

window.closeModalOnOverlay = function(event, modalId) {
    if (event.target.id === modalId) {
        window.closeModal(modalId);
    }
};


window.viewFullText = function(text) {
    const content = document.getElementById('fullTextContent');
    if (content) {
        content.textContent = text;
        openModal('fullTextModal');
    }
};

// Глобальный экспорт
window.openEditTicket = openEditTicket;
window.editSelected = window.editSelected;
window.deleteSelected = window.deleteSelected;
window.clearSelection = window.clearSelection;
window.ctxEditAction = window.ctxEditAction;
window.ctxDeleteAction = window.ctxDeleteAction;