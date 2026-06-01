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
import { openModal, confirmModal } from './partials/modalManager.js';


// === СОСТОЯНИЕ ===
let currentPage = 1;
let currentPageSize = 10;
let currentFilters = {};
let allSales = []; // Кэш продаж для метрик
window.selectionManager = null;

// === ИНИЦИАЛИЗАЦИЯ ===
// Этот блок выполняется после загрузки DOM, то есть после полной инициализации страницы
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    setupShortcutsPanel();
    initClientForm();
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

// Инициализация формы (перенесено из client.js)
function initClientForm() {
    const form = document.getElementById('clientForm');
    const modal = document.getElementById('clientModal');
    
    // Находим первое ВИДИМОЕ поле (пропускаем hidden)
    const getFirstVisibleInput = () => {
        return Array.from(form.querySelectorAll('input'))
            .find(input => input.type !== 'hidden' && !input.disabled);
    };
    
    // Обработка ESC: сохранить и закрыть
    modal.addEventListener('keydown', async (e) => {
        // Ctrl+Escape сохранить и закрыть
        if (e.key === 'Escape' && e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            
            const nameInput = document.getElementById('clientName');
            if (nameInput.value.trim()) {
                const saved = await handleClientFormSubmit(e, { 
                    quickAdd: false,
                    fromEscape: true 
                });
                
                if (saved) {
                    closeModal('clientModal');
                }
            } else {
                closeModal('clientModal');
            }
        }
        // Обычный Escape → просто закрыть БЕЗ сохранения
        else if (e.key === 'Escape' && !e.ctrlKey) {
            e.preventDefault();
            e.stopPropagation();
            
            // Проверяем, есть ли несохранённые данные
            const nameInput = document.getElementById('clientName');
            if (nameInput.value.trim()) {
                // Показываем предупреждение
                const confirmed = await confirmModal(
                    'Закрыть без сохранения?',
                    'У вас есть несохранённые данные. Закрыть форму?',
                    { type: 'warning', confirmText: 'Закрыть', cancelText: 'Отмена' }
                );
                
                if (confirmed) {
                    closeModal('clientModal');
                }
            } else {
                closeModal('clientModal');
            }
        }
    });
    
    // Обработка Ctrl+Tab: сохранить и создать нового
    const inputs = Array.from(form.querySelectorAll('input'))
        .filter(input => input.type !== 'hidden');
    
    inputs.forEach((input, index) => {
        input.addEventListener('keydown', async (e) => {
            // Ctrl+Tab или Ctrl+Enter
            if ((e.key === 'Tab' || e.key === 'Enter') && e.ctrlKey) {
                e.preventDefault();
                e.stopPropagation();
                
                const saved = await handleClientFormSubmit(e, { 
                    quickAdd: true,
                    fromCtrlTab: true 
                });
                
                if (saved) {
                    // Очищаем форму
                    form.reset();
                    document.getElementById('clientId').value = '';
                    
                    // Фокус на первое поле
                    const firstInput = getFirstVisibleInput();
                    if (firstInput) {
                        firstInput.focus();
                    }
                    
                    showToast('Клиент добавлен. Введите следующего:', 'success', 2000);
                }
            }
            // Обычный Enter → следующее поле
            else if (e.key === 'Enter' && !e.ctrlKey) {
                e.preventDefault();
                
                if (index < inputs.length - 1) {
                    const nextInput = inputs[index + 1];
                    nextInput.focus();
                    if (nextInput.type !== 'checkbox') {
                        nextInput.select();
                    }
                } else {
                    // Последнее поле → сохраняем
                    form.dispatchEvent(new Event('submit'));
                }
            }
        });
    });
    
    // Предотвращаем автозаполнение браузера
    form.setAttribute('autocomplete', 'off');
    inputs.forEach(input => {
        input.setAttribute('autocomplete', 'new-password'); // Хак для отключения автозаполнения
    });
    
    // Обработка submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await handleClientFormSubmit(e, { quickAdd: false });
    });
}

// Функция для управления панелью подсказок
// === УПРАВЛЕНИЕ ПАНЕЛЯМИ ===
function setupShortcutsPanel() {
    const modal = document.getElementById('clientModal');
    const panel = document.getElementById('shortcutsPanel');
    
    if (!modal || !panel) return;
    
    // Показываем панель при открытии модалки
    modal.addEventListener('shown.bs.modal', () => {
        panel.style.display = 'block';
    });
    
    // Скрываем при закрытии
    modal.addEventListener('hidden.bs.modal', () => {
        panel.style.display = 'none';
    });
}
// Функция для закрытия модалки
// === ЗАКРЫТИЕ МОДАЛКИ ===
export function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Очищаем форму
    const form = modal.querySelector('form');
    if (form) {
        form.reset();
        const clientId = form.querySelector('#clientId');
        if (clientId) clientId.value = '';
    }
    
    // Скрываем модалку (Bootstrap или кастомно)
    if (window.bootstrap && bootstrap.Modal) {
        const bsModal = bootstrap.Modal.getInstance(modal);
        if (bsModal) bsModal.hide();
    } else {
        modal.style.display = 'none';
        modal.classList.remove('show');
    }
    
    // Снимаем фокус
    document.activeElement.blur();
}

// === ЗАГРУЗКА И РЕНДЕР ===
// Эта функция загружает клиентов и обогащает их данными
// На вход принимает массив клиентов из таблицы клиентов
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
            filtered = filtered.filter(c => getSegmentKey(c.segment) === currentFilters.segment);
        }
        
        // Сортировка
        if (currentFilters.sortBy === 'count_desc') {
            // По количеству покупок (убывание)
            filtered.sort((a, b) => b.count - a.count);
        } else if (currentFilters.sortBy === 'count_asc') {
            // По количеству покупок (возрастание)
            filtered.sort((a, b) => a.count - b.count);
        } else {
            // По умолчанию: по дате регистрации (новые сверху)
            filtered.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
        }
        
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

// === РЕНДЕР ТАБЛИЦЫ ===
// На вход принимает массив клиентов
// В ходе работы функция создает HTML таблицу
// и заполняет ее данными из массива клиентов

function renderTable(clients) {
    const shouldAnimate = getSetting('ui.animateRows');
    const tbody = document.querySelector('#clientTable tbody');
    
    if (!tbody) return;
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="8" style="text-align:center; padding:40px; color:#94a3b8;"> Нет клиентов</td></tr>';
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
export async function handleClientFormSubmit(event, options = {}) {
    const { 
        quickAdd = false, 
        fromEscape = false,
        fromCtrlTab = false 
    } = options;
    
    const nameInput = document.getElementById('clientName');
    const phoneInput = document.getElementById('clientPhone');
    const emailInput = document.getElementById('clientEmail');
    const idInput = document.getElementById('clientId');
    
    const formData = {
        name: nameInput.value.trim(),
        phone: phoneInput.value.trim(),
        email: emailInput.value.trim()
    };
    
    // Валидация обязательных полей
    if (!formData.name) {
        if (!fromEscape) {
            showToast('Имя клиента обязательно', 'error');
            nameInput.focus();
        }
        return false;
    }
    
    try {
        const id = idInput.value;
        
        if (id) {
            // Обновление
            await dbUpdateClient(parseInt(id), formData);
            showToast(fromCtrlTab ? 'Сохранено' : 'Клиент обновлён');
        } else {
            // Создание
            formData.created_at = new Date().toISOString();
            await dbCreateClient(formData.name, formData.phone, formData.email);
            showToast(
                fromCtrlTab ? 'Добавлен' : 'Клиент создан',
                'success'
            );
        }
        
        // Если быстрое добавление (Ctrl+Tab)
        if (quickAdd || fromCtrlTab) {
            // Перезагружаем список
            if (window.loadClients) await window.loadClients();
            return true;
        }
        
        // Обычное сохранение
        if (window.saveDataToFile) await window.saveDataToFile();
        
        // Перезагружаем список
        if (window.loadClients) await window.loadClients();
        
        return true;
        
    } catch (error) {
        console.error('Error saving client:', error);
        showToast('Ошибка: ' + error.message, 'error');
        return false;
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

// === Обновлённая сегментация клиентов ===
export function calculateClientDisplayData(client, sales = []) {
    // Фильтруем продажи этого клиента
    const clientSales = sales.filter(s => 
        s.client_id === client.id || s.client_name === client.name
    );
    
    // === БАЗОВЫЕ МЕТРИКИ ===
    const count = clientSales.length;
    const total = clientSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
    const avgCheck = count > 0 ? total / count : 0;
    
    // === ДАТЫ ДЛЯ RFM ===
    const now = Date.now();
    const lastPurchaseDate = clientSales.length > 0 
        ? Math.max(...clientSales.map(s => new Date(s.transaction_date).getTime()))
        : null;
    
    const daysSinceLastPurchase = lastPurchaseDate 
        ? Math.floor((now - lastPurchaseDate) / (1000 * 60 * 60 * 24))
        : null;
    
    const daysSinceRegistration = Math.floor(
        (now - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    // === НАСТРАИВАЕМЫЕ ПОРОГИ (можно вынести в settings) ===
    // Правила сегментации по умолчанию усреднены, для истинных данных лучше использовать более точные метрики, которые можно расчитать экспериментально
    const THRESHOLDS = {
        newClientDays: 30,           // Новый клиент: регистрация < 30 дней
        atRiskDays: 90,              // Риск ухода: нет покупок > 90 дней
        dormantDays: 180,            // Неактивный: нет покупок > 180 дней
        loyalPurchases: 5,           // Лояльный: 5+ покупок
        loyalTotal: 50000,           // Лояльный: 50к+ ₽
        vipTotal: 150000,            // VIP: 150к+ ₽
        vipPercentile: 0.1           // VIP: топ-10% по выручке (опционально)
    };

    // === СЕГМЕНТАЦИЯ (приоритет сверху вниз) ===
    let segment = 'Обычный';
    let segmentColor = '#6b7280';    // gray-500
    let segmentTooltip = 'Стандартный клиент';
    let segmentPriority = 3;         // Для сортировки

    // Риск ухода (был активен, но пропал)
    if (count >= 2 && daysSinceLastPurchase >= THRESHOLDS.atRiskDays) {
        segment = 'Риск ухода';
        segmentColor = '#f59e0b';    // amber-500
        segmentTooltip = `Последняя покупка: ${daysSinceLastPurchase} дн. назад`;
        segmentPriority = 5;
    }
    // Неактивный (никогда не покупал или ушёл давно)
    else if (count === 0 || daysSinceLastPurchase >= THRESHOLDS.dormantDays) {
        segment = 'Неактивный';
        segmentColor = '#94a3b8';    // slate-400
        segmentTooltip = count === 0 
            ? 'Клиент без покупок' 
            : `Не покупал ${daysSinceLastPurchase} дн.`;
        segmentPriority = 6;
    }
    // VIP (топ-клиенты по выручке)
    else if (total >= THRESHOLDS.vipTotal) {
        segment = 'VIP';
        segmentColor = '#8b5cf6';    // violet-500
        segmentTooltip = `VIP: ${total.toLocaleString('ru-RU')} ₽`;
        segmentPriority = 1;
    }
    // Лояльный (регулярные покупатели)
    else if (count >= THRESHOLDS.loyalPurchases || total >= THRESHOLDS.loyalTotal) {
        segment = 'Лояльный';
        segmentColor = '#3b82f6';    // blue-500
        segmentTooltip = `Лояльный: ${count} покупок, ${total.toLocaleString('ru-RU')} ₽`;
        segmentPriority = 2;
    }
    // Активный (недавно покупал, но ещё не лояльный)
    else if (count >= 2 && daysSinceLastPurchase <= 60) {
        segment = 'Активный';
        segmentColor = '#22c55e';    // green-500
        segmentTooltip = `Активный: последняя покупка ${daysSinceLastPurchase} дн. назад`;
        segmentPriority = 3;
    }
    //  Новый (регистрация < 30 дней, 0-1 покупка)
    else if (daysSinceRegistration <= THRESHOLDS.newClientDays) {
        segment = 'Новый';
        segmentColor = '#06b6d4';    // cyan-500
        segmentTooltip = `Новый: зарегистрирован ${daysSinceRegistration} дн. назад`;
        segmentPriority = 4;
    }
    // Обычный (дефолт)
    else {
        segment = 'Обычный';
        segmentColor = '#6b7280';
        segmentTooltip = 'Стандартный клиент';
        segmentPriority = 3;
    }

    // === ДОПОЛНИТЕЛЬНЫЕ БАДЖИ (иконки) ===
    const badges = [];

    // Бейдж "Новый" (временный, исчезает через 30 дней)
    if (daysSinceRegistration <= THRESHOLDS.newClientDays && count <= 1) {
        badges.push({
            icon: '⭐',
            tooltip: 'Новый клиент',
            color: '#f59e0b',
            type: 'new'
        });
    }

    // Бейдж "Опт" (крупные разовые покупки)
    const hasBulkPurchase = clientSales.some(s => (s.total_amount || 0) >= 50000);
    if (hasBulkPurchase && !segment.includes('VIP')) {
        badges.push({
            icon: '',
            tooltip: 'Делал крупные покупки',
            color: '#8b5cf6',
            type: 'bulk'
        });
    }


    // Бейдж "Снизил активность" (для риск-менеджмента)
    if (segment === 'Риск ухода' && count >= 5) {
        badges.push({
            icon: '',
            tooltip: 'Раньше покупал чаще',
            color: '#ef4444',
            type: 'declining'
        });
    }

    // === РЕЗУЛЬТАТ ===
    return {
        // Базовые метрики
        total, count, avgCheck,
        daysSinceLastPurchase,
        daysSinceRegistration,
        
        // Сегмент
        segment,
        segmentColor,
        segmentTooltip,
        segmentPriority,  // Для сортировки в таблице
        
        // Дополнительные баджи (массив)
        badges,
        
        // Флаги для фильтрации
        flags: {
            isNew: daysSinceRegistration <= THRESHOLDS.newClientDays,
            isAtRisk: segment === 'Риск ухода',
            isVIP: segment === 'VIP',
            isLoyal: segment === 'Лояльный',
            hasBulkPurchase
        }
    };
}

// Преобразует название сегмента в ключ для фильтрации
function getSegmentKey(segmentName) {
    const map = {
        'VIP': 'vip',
        'Лояльный': 'loyal', 
        'Активный': 'active',
        'Новый': 'new',
        'Обычный': 'regular',
        'Риск ухода': 'at_risk',
        'Неактивный': 'dormant'
    };
    return map[segmentName] || segmentName?.toLowerCase().replace(/\s+/g, '_');
}

// Преобразует ключ фильтра в название сегмента
function getSegmentName(key) {
    const map = {
        'vip': 'VIP',
        'loyal': 'Лояльный',
        'active': 'Активный', 
        'new': 'Новый',
        'regular': 'Обычный',
        'at_risk': 'Риск ухода',
        'dormant': 'Неактивный'
    };
    return map[key] || key;
}

// === МОДАЛЬНОЕ ОКНО КЛИЕНТА ===
// === МОДАЛЬНОЕ ОКНО КЛИЕНТА ===
window.openClientModal = async function(id = null) {
    // Сброс формы
    console.log('🔍 openClientModal вызван, id=', id);
    console.log('🔍 clientName элемент:', document.getElementById('clientName'));

    // После openModal:
    console.log('🔍 openModal вызван, пробуем фокус...');
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
    
    // Открываем модалку
    openModal('clientModal');
    
    
    setTimeout(() => {
        const nameInput = document.getElementById('clientName');
        if (nameInput && nameInput.offsetParent !== null) {
            nameInput.focus();
            nameInput.select();
            console.log('✅ Фокус установлен на clientName');
        }
    }, 150); // Задержка для гарантированного рендеринга
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
            segment: document.getElementById('filterSegment')?.value || null,
            sortBy: document.getElementById('filterSort')?.value || null  
        };
        currentPage = 1;
        loadClients();
    });
    
    document.getElementById('btnResetFilters')?.addEventListener('click', () => {
        if (document.getElementById('filterSearch')) document.getElementById('filterSearch').value = '';
        if (document.getElementById('filterSegment')) document.getElementById('filterSegment').value = '';
        if (document.getElementById('filterSort')) document.getElementById('filterSort').value = ''; 
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