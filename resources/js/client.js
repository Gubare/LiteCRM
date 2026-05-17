// resources/js/clients.js
import { getSetting } from './settings-manager.js';
import { 
    getAllClients, 
    createClient as dbCreateClient, 
    deleteClient as dbDeleteClient,
    updateClient as dbUpdateClient,
    getAllItems
} from './db_sqlite.js';
import { renderPagination } from './partials/pagination.js';
import { SelectionManager } from './partials/selectionManager.js';
import { openModal, closeModal, confirmModal } from './partials/modalManager.js';


// === СОСТОЯНИЕ ===
let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};
let allSales = []; // Кэш продаж для метрик
window.selectionManager = null;

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    // Инициализация менеджера выделения
    window.selectionManager = new SelectionManager({
        tableBodySelector: '#clientTable tbody',
        actionBarId: 'bulkActionBar',
        ctxMenuId: 'ctxMenu',
        callbacks: {
            onEdit: openClientModal,
            onDelete: handleDelete
        }
    });

    // Загрузка данных
    await loadClients();
    setupEventListeners();
    
    // Обработчик формы (используем ваш рабочий код)
    const form = document.getElementById('clientForm');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleClientFormSubmit();
        });
    }
});

// === ЗАГРУЗКА И РЕНДЕР ===
async function loadClients() {
    const tbody = document.querySelector('#clientTable tbody');
    // if (tbody) tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:20px;">⏳ Загрузка...</td></tr>';
    
    try {
        // Загружаем клиентов и продажи
        const clients = await getAllClients();
        allSales = await getAllItems('sales');
        
        // Обогащаем данными и считаем метрики
        const enriched = clients.map(client => {
            const display = calculateClientDisplayData(client, allSales);
            return { ...client, ...display };
        });
        
        // Применяем фильтры
        let filtered = enriched;
        if (currentFilters.search) {
            const q = currentFilters.search.toLowerCase();
            filtered = filtered.filter(c => 
                c.name.toLowerCase().includes(q) || 
                (c.phone && c.phone.includes(q)) ||
                (c.email && c.email.includes(q))
            );
        }
        if (currentFilters.segment) {
            filtered = filtered.filter(c => c.segment === currentFilters.segment);
        }
        
        // Сортировка по дате регистрации (новые сверху)
        filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        
        // Пагинация
        const total = filtered.length;
        const start = (currentPage - 1) * currentPageSize;
        const paged = filtered.slice(start, start + currentPageSize);
        
        renderTable(paged);
        renderPagination(
            document.getElementById('pagination'),
            document.getElementById('paginationInfo'),
            currentPage,
            Math.ceil(total / currentPageSize),
            total,
            currentPageSize,
            (page) => { currentPage = page; loadClients(); }
        );
        
    } catch (error) {
        console.error('❌ Error loading clients:', error);
        if (tbody) {
            tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color:#ef4444; padding:20px;">Ошибка загрузки: ${error.message}</td></tr>`;
        }
    }
}

function renderTable(clients) {
    const shouldAnimate = getSetting('ui.animateRows');
    const tbody = document.querySelector('#clientTable tbody');
    
    if (!tbody) return;
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:#94a3b8;">📭 Нет клиентов</td></tr>';
        return;
    }
    
    tbody.innerHTML = clients.map((client, index) => {
        const animClass = shouldAnimate ? 'table-row-animate' : '';
        const animDelay = shouldAnimate ? `style="animation-delay: ${index * 0.04}s;"` : '';
        
        // Бейдж сегмента
        const segmentBadge = `
            <span class="badge-cluster cluster-${client.segment.toLowerCase()}" 
                  style="background: ${client.segmentColor}20; color: ${client.segmentColor}; border: 1px solid ${client.segmentColor}40;"
                  onclick="showClusterInfo(${client.id}, event)"
                  title="${client.segmentTooltip}">
                ${client.newBadge?.icon || ''} ${client.segment}
            </span>
        `;
        
        return `
        <tr data-id="${client.id}" 
            class="${animClass}" 
            ${animDelay}
            onclick="window.selectionManager.handleClick(event)">
            <td><strong>#${client.id}</strong></td>
            <td>${client.name}</td>
            <td>${client.phone || '—'}</td>
            <td>${client.email || '—'}</td>
            <td style="text-align: center;">${client.count}</td>
            <td style="text-align: right;">${client.total.toLocaleString('ru-RU')} ₽</td>
            <td style="text-align: right; color: #64748b;">${Math.round(client.avgCheck).toLocaleString('ru-RU')} ₽</td>
            <td>${segmentBadge}</td>
        </tr>`;
    }).join('');
}

// === Создание/Обновление клиента ===
export async function handleClientFormSubmit() {
    const id = document.getElementById('clientId')?.value;
    const formData = {
        name: document.getElementById('clientName').value,
        phone: document.getElementById('clientPhone').value,
        email: document.getElementById('clientEmail').value
    };
    
    try {
        if (id) {
            // Обновление (ваш код)
            await dbUpdateClient(parseInt(id), formData);
            showToast('Клиент обновлён');
        } else {
            // Создание (ваш код)
            formData.created_at = new Date().toISOString();
            await dbCreateClient(formData.name, formData.phone, formData.email);
            showToast('Клиент создан');
        }
        
        // Сохранение в файл и перезагрузка
        if (window.saveDataToFile) await window.saveDataToFile();
        closeModal('clientModal');
        loadClients();
        
    } catch (error) {
        console.error('Error saving client:', error);
        showToast('Ошибка: ' + error.message);
    }
}

// === Удаление ===
export async function handleDelete(id) {
    try {
        await dbDeleteClient(id);
        if (window.saveDataToFile) await window.saveDataToFile();
        showToast('Клиент удалён');
        loadClients();
        return true;
    } catch (error) {
        console.error('Error deleting client:', error);
        showToast('Ошибка: ' + error.message);
        return false;
    }
}

// === Расчёт метрик и сегментов ===
export function calculateClientDisplayData(client, sales = []) {
    // Фильтруем продажи этого клиента
    const clientSales = sales.filter(s => 
        s.client_id === client.id || s.client_name === client.name
    );
    
    const count = clientSales.length;
    const total = clientSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const avgCheck = count > 0 ? total / count : 0;

    // Сегментация
    let segment = 'Обычный';
    let segmentColor = '#6b7280';
    let segmentTooltip = 'Стандартный клиент';

    if (count === 0) {
        segment = 'Потенциальный';
        segmentColor = '#94a3b8';
        segmentTooltip = 'Клиент без покупок';
    } else if (count >= 10 || total >= 150000) {
        segment = 'VIP';
        segmentColor = '#8b5cf6';
        segmentTooltip = 'VIP: 10+ покупок или 150к+ ₽';
    } else if (count >= 3) {
        segment = 'Постоянный';
        segmentColor = '#3b82f6';
        segmentTooltip = 'Постоянный: 3+ покупки';
    }

    // Бейдж "Новый"
    const daysSinceReg = (Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const isNew = daysSinceReg <= 30;
    const newBadge = isNew ? {
        icon: '⭐',
        tooltip: 'Новый клиент (< 30 дней)',
        color: '#f59e0b'
    } : null;

    return {
        total, count, avgCheck,
        segment, segmentColor, segmentTooltip,
        newBadge, isNew
    };
}

// === МОДАЛЬНОЕ ОКНО КЛИЕНТА ===
window.openClientModal = async function(id = null) {
    // Сброс формы
    const ctxMenu = document.getElementById('ctxMenu');
    if (ctxMenu) ctxMenu.style.display = 'none';
    const form = document.getElementById('clientForm');
    if (form) form.reset();
    document.getElementById('clientId').value = '';
    document.getElementById('clientModalTitle').textContent = 'Добавить клиента';
    
    // Если редактирование — заполняем данные
    if (id) {
        const clients = await getAllClients();
        const client = clients.find(c => c.id === id);
        if (client) {
            document.getElementById('clientId').value = client.id;
            document.getElementById('clientName').value = client.name;
            document.getElementById('clientPhone').value = client.phone || '';
            document.getElementById('clientEmail').value = client.email || '';
            document.getElementById('clientModalTitle').textContent = 'Редактировать клиента';
        }
    }
    
    openModal('clientModal');
};

// === ПРОСМОТР ИНФОРМАЦИИ О СЕГМЕНТЕ ===
window.showClusterInfo = async function(clientId, event) {
    event.stopPropagation(); // Чтобы не срабатывало выделение строки
    
    const clients = await getAllClients();
    const client = clients.find(c => c.id === clientId);
    if (!client) return;
    
    // Считаем детальную статистику
    const display = calculateClientDisplayData(client, allSales);
    
    const statsHtml = `
        <div style="text-align: left; line-height: 2;">
            <p><strong>Клиент:</strong> ${client.name}</p>
            <p><strong>Дата регистрации:</strong> ${new Date(client.created_at).toLocaleDateString('ru-RU')}</p>
            <p><strong>Покупок:</strong> ${display.count}</p>
            <p><strong>Общая сумма:</strong> ${display.total.toLocaleString('ru-RU')} ₽</p>
            <p><strong>Средний чек:</strong> ${Math.round(display.avgCheck).toLocaleString('ru-RU')} ₽</p>
            <hr style="margin: 15px 0; border: none; border-top: 1px solid #e2e8f0;">
            <p><strong>Сегмент:</strong> 
                <span style="color: ${display.segmentColor}; font-weight: 600;">
                    ${display.newBadge?.icon || ''} ${display.segment}
                </span>
            </p>
            <p style="color: #64748b; font-size: 13px;">${display.segmentTooltip}</p>
            ${display.newBadge ? `<p style="color: ${display.newBadge.color}; font-size: 13px;">${display.newBadge.tooltip}</p>` : ''}
        </div>
    `;
    
    document.getElementById('clusterStats').innerHTML = statsHtml;
    openModal('clusterInfoModal');
};

// === КОНТЕКСТНОЕ МЕНЮ И МАССОВЫЕ ДЕЙСТВИЯ ===
window.editFromCtx = async function() {
    const id = window.selectionManager.getCtxTargetId();
    if (id) await window.openClientModal(id);
};

window.deleteFromCtx = async function() {
    const id = window.selectionManager.getCtxTargetId();
    if (id) await handleDelete(id);
};

window.bulkDelete = async function() {
    const ids = window.selectionManager.getSelectedIds();
    if (ids.length === 0) return;
    
    const confirmed = await confirmModal(
        'Удаление клиентов',
        `Удалить ${ids.length} записей? Это действие нельзя отменить.`,
        { type: 'danger', confirmText: 'Удалить' }
    );
    
    if (!confirmed) return;
    
    for (const id of ids) {
        await dbDeleteClient(id);
    }
    if (window.saveDataToFile) await window.saveDataToFile();
    
    window.selectionManager.clear();
    loadClients();
    // showToast(`✅ Удалено клиентов: ${ids.length}`);
};

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    // Фильтры
    document.getElementById('btnApplyFilters')?.addEventListener('click', () => {
        currentFilters = {
            search: document.getElementById('filterSearch')?.value || null,
            segment: document.getElementById('filterSegment')?.value || null
        };
        currentPage = 1;
        loadClients();
    });
    
    document.getElementById('btnResetFilters')?.addEventListener('click', () => {
        if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';
        if (document.getElementById('filterSegment')) document.getElementById('filterSegment').value = '';
        currentFilters = {};
        loadClients();
    });
    
    // Пагинация: размер страницы
    document.getElementById('pageSize')?.addEventListener('change', (e) => {
        currentPageSize = parseInt(e.target.value);
        currentPage = 1;
        loadClients();
    });
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function showToast(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px;
        background: #334155; color: white;
        padding: 12px 20px; border-radius: 8px;
        z-index: 9999; animation: fadeIn 0.3s;
        font-size: 14px;
    `;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}