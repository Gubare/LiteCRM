import { getAllItems, getDbInstance,  initDatabase} from './db_sqlite.js';

import { showToast } from './partials/toast.js';

// Конфигурация этапов воронки по умолчанию
const DEFAULT_FUNNEL_STAGES = [
    { id: 'lead', name: 'Лиды', color: '#3b82f6', description: 'Первичные обращения' },
    { id: 'contacted', name: 'В работе', color: '#f59e0b', description: 'Связались с клиентом' },
    { id: 'proposal', name: 'Предложение', color: '#8b5cf6', description: 'Отправлено КП' },
    { id: 'negotiation', name: 'Переговоры', color: '#ec4899', description: 'Обсуждение условий' },
    { id: 'won', name: 'Успешные сделки', color: '#10b981', description: 'Завершённые продажи' },
    { id: 'lost', name: 'Отказы', color: '#6b7280', description: 'Неудачные сделки' }
];

// Источники лидов
const DEAL_SOURCES = [
    { id: 'direct', name: 'Прямой заход', color: '#6b7280' },
    { id: 'website', name: 'Сайт', color: '#3b82f6' },
    { id: 'phone', name: 'Телефон', color: '#10b981' },
    { id: 'instagram', name: 'Instagram', color: '#ec4899' },
    { id: 'recommendation', name: 'Рекомендация', color: '#f59e0b' },
    { id: 'walk-in', name: 'Визит', color: '#8b5cf6' }
];

export async function getFunnelData(dateFrom = null, dateTo = null) {
    try {
        const stages = loadFunnelSettings();
        
        // Загружаем ВСЕ данные
        const [allSales, allClients, allTickets] = await Promise.all([
            getAllItems('sales'),
            getAllItems('clients'),
            getAllItems('tickets')
        ]);
        
        // Фильтруем по дате
        const filteredSales = allSales.filter(sale => {
            if (!dateFrom || !dateTo) return true;
            const saleDate = new Date(sale.transaction_date || sale.created_at);
            return saleDate >= new Date(dateFrom) && saleDate <= new Date(dateTo);
        });
        
        const filteredTickets = allTickets.filter(ticket => {
            if (!dateFrom || !dateTo) return true;
            const ticketDate = new Date(ticket.created_at);
            return ticketDate >= new Date(dateFrom) && ticketDate <= new Date(dateTo);
        });
        
        // === НОВЫЙ УРОВЕНЬ 0: ВСЕ КОНТАКТЫ ===
        
        // 1. Все зарегистрированные клиенты
        const registeredClients = allClients.length;
        
        // 2. Обращения БЕЗ клиента
        const ticketsWithoutClient = filteredTickets.filter(t => !t.client_id).length;
        
        // 3. Сделки БЕЗ клиента (исключаем type='поступление')
        const salesWithoutClient = filteredSales.filter(s => 
            !s.client_id && s.type !== 'поступление'
        ).length;
        
        const totalContacts = registeredClients + ticketsWithoutClient + salesWithoutClient;
        
        // === ОСТАЛЬНЫЕ УРОВНИ (как было) ===
        
        // Уровень 1: Клиенты с покупками
        const clientsWithSales = new Set(filteredSales.filter(s => s.client_id).map(s => s.client_id)).size;
        
        // Уровень 2: Повторные клиенты
        const purchaseCounts = {};
        filteredSales.filter(s => s.client_id).forEach(s => {
            purchaseCounts[s.client_id] = (purchaseCounts[s.client_id] || 0) + 1;
        });
        const repeatClients = Object.values(purchaseCounts).filter(c => c >= 2).length;
        
        // Уровень 3: VIP-клиенты
        const clientSpend = {};
        filteredSales.filter(s => s.client_id).forEach(s => {
            clientSpend[s.client_id] = (clientSpend[s.client_id] || 0) + (s.total_amount || 0);
        });
        const vipClients = Object.values(clientSpend).filter(amount => amount >= 10000).length;
        
        // Уровень 4: Всего сделок
        const wonDeals = filteredSales.length;
        const totalRevenue = filteredSales.reduce((sum, s) => sum + (s.total_amount || 0), 0);
        
        // === ФОРМИРУЕМ ДАННЫЕ ДЛЯ ВОРОНКИ ===
        
        const funnelData = [
            {
                id: 'total_contacts',
                name: 'Все контакты',
                color: '#6b7280',  // серый
                description: `Клиенты + обращения + сделки без клиента`,
                count: totalContacts,
                breakdown: {
                    registeredClients,
                    ticketsWithoutClient,
                    salesWithoutClient
                },
                conversionTotal: 100,
                conversionFromPrev: 100,
                revenue: 0
            },
            {
                id: 'all_clients',
                name: 'База клиентов',
                color: stages[0]?.color || '#3b82f6',
                description: 'Все зарегистрированные клиенты',
                count: registeredClients,
                conversionTotal: registeredClients > 0 ? Math.round(registeredClients / totalContacts * 100) : 0,
                conversionFromPrev: totalContacts > 0 ? Math.round(registeredClients / totalContacts * 100) : 0,
                revenue: 0
            },
            {
                id: 'active_clients',
                name: 'Совершили покупку',
                color: stages[1]?.color || '#f59e0b',
                description: 'Клиенты с ≥1 сделкой',
                count: clientsWithSales,
                conversionTotal: registeredClients > 0 ? Math.round(clientsWithSales / registeredClients * 100) : 0,
                conversionFromPrev: registeredClients > 0 ? Math.round(clientsWithSales / registeredClients * 100) : 0,
                revenue: totalRevenue
            },
            {
                id: 'repeat_clients',
                name: 'Повторные покупки',
                color: stages[2]?.color || '#8b5cf6',
                description: 'Клиенты с ≥2 сделками',
                count: repeatClients,
                conversionTotal: registeredClients > 0 ? Math.round(repeatClients / registeredClients * 100) : 0,
                conversionFromPrev: clientsWithSales > 0 ? Math.round(repeatClients / clientsWithSales * 100) : 0,
                revenue: Object.entries(clientSpend).filter(([_, v]) => v >= 10000).reduce((s, [_, v]) => s + v, 0)
            },
            {
                id: 'vip_clients',
                name: 'VIP-клиенты',
                color: stages[3]?.color || '#ec4899',
                description: 'Сумма покупок ≥10 000 ₽',
                count: vipClients,
                conversionTotal: registeredClients > 0 ? Math.round(vipClients / registeredClients * 100) : 0,
                conversionFromPrev: repeatClients > 0 ? Math.round(vipClients / repeatClients * 100) : 0,
                revenue: Object.entries(clientSpend).filter(([_, v]) => v >= 10000).reduce((s, [_, v]) => s + v, 0)
            }

        ];
        
        return {
            stages: funnelData,
            totalDeals: wonDeals,
            totalExpectedRevenue: totalRevenue,
            totalActualRevenue: totalRevenue,
            dateFrom,
            dateTo
        };
    } catch (error) {
        console.error('Error fetching funnel data:', error);
        throw error;
    }
}

/**
 * Загрузка настроек воронки из localStorage
 */
export function loadFunnelSettings() {
    try {
        const saved = localStorage.getItem('crm_funnel_stages');
        return saved ? JSON.parse(saved) : DEFAULT_FUNNEL_STAGES;
    } catch (e) {
        console.error('Error loading funnel settings:', e);
        return DEFAULT_FUNNEL_STAGES;
    }
}

/**
 * Сохранение настроек воронки
 */
export function saveFunnelSettings(stages) {
    try {
        localStorage.setItem('crm_funnel_stages', JSON.stringify(stages));
        return true;
    } catch (e) {
        console.error('Error saving funnel settings:', e);
        return false;
    }
}

/**
 * Отрисовка воронки (адаптирована под данные из sales/clients)
 */
export function renderFunnelChart(containerId, funnelData) {
    const container = document.getElementById(containerId);
    if (!container) return;
    
    const stages = funnelData.stages.filter(s => s.count > 0);
    
    if (stages.length === 0) {
        container.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #64748b;">
                <div style="font-size: 48px; margin-bottom: 16px;"></div>
                <h3>Нет данных для отображения</h3>
                <p>Добавьте клиентов и продажи для просмотра воронки</p>
            </div>
        `;
        return;
    }
    
    const maxValue = Math.max(...stages.map(s => s.count));
    
    let html = `
        <div class="funnel-chart-container">
            <div class="funnel-header">
                
                <div class="funnel-summary">
                    <span class="summary-item">
                        <strong>${funnelData.totalDeals}</strong> сделок
                    </span>
                    <span class="summary-item">
                        <strong>${funnelData.totalActualRevenue?.toLocaleString('ru-RU') || 0} ₽</strong> выручка
                    </span>
                </div>
            </div>
            <div class="funnel-bars">
    `;
    
    stages.forEach((stage, index) => {
        const barWidth = maxValue > 0 ? (stage.count / maxValue) * 100 : 0;
        
        html += `
            <div class="funnel-stage-row">
                <div class="stage-label" style="border-left-color: ${stage.color}">
                    <div class="stage-name">${stage.name}</div>
                    <div class="stage-desc">${stage.description}</div>
                </div>
                <div class="stage-bar-wrapper">
                    <div class="stage-bar" style="width: ${barWidth}%; background: ${stage.color}">
                        <div class="stage-count">${stage.count}</div>
                    </div>
                </div>
                <div class="stage-metrics">
                    <div class="metric-item">
                        <span class="metric-label">Конверсия:</span>
                        <span class="metric-value">${stage.conversionTotal}%</span>
                    </div>
                    ${stage.revenue > 0 ? `
                    <div class="metric-item">
                        <span class="metric-label">Сумма:</span>
                        <span class="metric-value">${stage.revenue.toLocaleString('ru-RU')} ₽</span>
                    </div>
                    ` : ''}
                </div>
            </div>
        `;
    });
    
    html += `</div></div>`;
    container.innerHTML = html;
}
/**
 * Инициализация воронки на странице
 */
export async function initFunnelReports() {
    try {
        const funnelContainer = document.getElementById('funnelContainer');
        if (!funnelContainer) return;
        
        // Показываем загрузку
        funnelContainer.innerHTML = '<div class="loading">Загрузка данных воронки...</div>';
        // migrateToDeals();
        // Получаем данные
        const funnelData = await getFunnelData();
        
        // Отрисовываем
        renderFunnelChart('funnelContainer', funnelData);
        
    } catch (error) {
        console.error('Error initializing funnel:', error);
        const container = document.getElementById('funnelContainer');
        if (container) {
            container.innerHTML = `
                <div class="error">
                    ❌ Ошибка загрузки воронки: ${error.message}
                </div>
            `;
        }
    }
}

// Экспортируем для использования в других модулях
export { DEFAULT_FUNNEL_STAGES, DEAL_SOURCES };