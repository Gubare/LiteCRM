// resources/js/charts.js
import { getAllItems } from './db_sqlite.js';
import { getSetting, updateSetting } from './settings-manager.js';
// === КОНФИГУРАЦИЯ ГРАФИКОВ ===
const CHART_CONFIGS = {
    sales: {
        'revenueTrend': {
            title: 'Динамика выручки',
            type: 'line',
            icon: '',
            description: 'Выручка по дням'
        },
        'salesByType': {
            title: 'Продажи по типам',
            type: 'doughnut',
            icon: '',
            description: 'Продажа/Списание/Поступление'
        },
        'topProducts': {
            title: 'Топ-10 товаров',
            type: 'bar',
            icon: '',
            description: 'Самые продаваемые товары'
        },
        'avgCheckTrend': {
            title: 'Средний чек',
            type: 'line',
            icon: '',
            description: 'Динамика среднего чека'
        },
        'dealsPerDay': {
            title: 'Количество сделок в день',
            type: 'line',
            icon: '',
            description: 'Динамика числа транзакций'
        },
        'salesByCategory': {
            title: 'Продажи по категориям',
            type: 'pie',
            icon: '',
            description: 'Распределение выручки по категориям товаров'
        }
    },
    clients: {
        'clientGrowth': {
            title: 'Прирост клиентов',
            type: 'line',
            icon: '',
            description: 'Новые клиенты по периодам'
        },
        'clientSegments': {
            title: 'Сегментация',
            type: 'pie',
            icon: '',
            description: 'Распределение по сегментам'
        },
        'topClients': {
            title: 'Топ-10 клиентов',
            type: 'bar',
            icon: '',
            description: 'По сумме покупок'
        },
        'topClientsByCount': {
            title: 'Топ-10 по количеству покупок',
            type: 'bar',
            icon: '',
            description: 'Клиенты с наибольшим числом сделок'
    }
    },
    products: {
        'stockLevels': {
            title: 'Остатки на складе',
            type: 'bar',
            icon: '',
            description: 'Количество товаров'
        },
        'lowStock': {
            title: 'Заканчиваются',
            type: 'bar',
            icon: '',
            description: 'Товары с остатком < 10'
        },
        'productsByCategory': {
            title: 'Товары по категориям',
            type: 'doughnut',
            icon: '',
            description: 'Распределение товаров по категориям'
        },
        'categoryProfitability': {
            title: 'Доходность категорий',
            type: 'bar',
            icon: '',
            description: 'Выручка по категориям'
        }
    },
    tickets: {
        'ticketsOverTime': {
            title: 'Обращения по времени',
            type: 'line',
            icon: '',
            description: 'Нагрузка на поддержку'
        },
        'ticketsByStatus': {
            title: 'По статусам',
            type: 'pie',
            icon: '',
            description: 'Открытые/Выполненные/Архив'
        },
        'ticketsByType': {
            title: 'По типам',
            type: 'doughnut',
            icon: '',
            description: 'Вопросы/Жалобы/Заказы'
        }
    },
    activity: {
        'dailyActivity': {
            title: 'Активность по дням',
            type: 'line',
            icon: '',
            description: 'Сравнение клиентов, продаж и обращений',
            multiDataset: true  // Флаг объединения
        }
    }
};

// === СОСТОЯНИЕ ===
let currentMode = 'sales';
let currentCharts = {};
let currentPeriod = {
    type: '30',  // '7', '30', '90', '365', 'all', 'custom'
    from: null,
    to: null
};

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    // Загружаем сохранённый период из настроек
    await loadSavedPeriod();
    
    setupEventListeners();
    setupDateInputs();
    setupExpandHandlers();
    await renderChartsForMode('sales');
    updatePeriodInfo();
});

// === ОТРИСОВКА ГРАФИКОВ ===
async function renderChartsForMode(mode) {
    const container = document.getElementById('chartsContainer');
    if (!container) return;
    
    destroyAllCharts();
    container.innerHTML = '';
    
    const configs = CHART_CONFIGS[mode];
    if (!configs) return;
    
    const data = await loadDataForMode(mode);
    const periodDays = data.dateRange?.days || 30;
    
    for (const [key, config] of Object.entries(configs)) {
        const chartCard = createChartCard(key, config);
        container.appendChild(chartCard);
        
        const canvas = chartCard.querySelector('canvas');
        let chartData;
        
        if (config.multiDataset) {
            chartData = await prepareDailyActivity(periodDays);
        } else {
            chartData = prepareChartData(mode, key, data, periodDays);
        }
        
        currentCharts[key] = new Chart(canvas, {
            type: config.type,
            data: chartData,
            options: getChartOptions(config)
        });
    }
}

function createChartCard(key, config) {
    const card = document.createElement('div');
    card.className = 'chart-card';
    card.dataset.chartKey = key; // Для привязки к экземпляру Chart.js
    
    card.innerHTML = `
        <div class="chart-header">
            <h3>${config.icon} ${config.title}</h3>
            <p class="chart-description">${config.description}</p>
        </div>
        <div class="chart-body">
            <canvas id="chart-${key}"></canvas>
        </div>
        <button class="chart-expand-btn" title="Развернуть на весь экран">⛶</button>
    `;
    return card;
}

// === ПОДГОТОВКА ДАННЫХ ===
async function loadDataForMode(mode) {
    const dateRange = getDateRange();
    
    switch(mode) {
        case 'sales':
            const sales = await getAllItems('sales');
            const products = await getAllItems('products');
            return {
                sales: sales.filter(s => new Date(s.transaction_date) >= dateRange.from),
                products,
                dateRange
            };
            
        case 'clients':
            const clients = await getAllItems('clients');
            const allSales = await getAllItems('sales');
            return {
                clients: clients.filter(c => new Date(c.created_at) >= dateRange.from),
                allClients: clients,
                sales: allSales.filter(s => new Date(s.transaction_date) >= dateRange.from),
                dateRange
            };
            
        case 'products':
            const prods = await getAllItems('products');
            // Загружаем порог из настроек
            const lowStockThreshold = await getSetting('inventory.lowStockThreshold', 10);
            return { 
                products: prods, 
                dateRange,
                lowStockThreshold  // Передаём порог
            };
            
        case 'tickets':
            const tickets = await getAllItems('tickets');
            return {
                tickets: tickets.filter(t => new Date(t.created_at) >= dateRange.from),
                dateRange
            };
            
        case 'activity':
            // Для сводной активности загружаем всё
            return {
                clients: await getAllItems('clients'),
                sales: await getAllItems('sales'),
                tickets: await getAllItems('tickets'),
                dateRange
            };
            
        default:
            return { dateRange };
    }
}


function prepareChartData(mode, chartKey, data, periodDays = 30) {
    const type = document.getElementById('chartTypeSelect')?.value || 'line';
    
    switch(`${mode}.${chartKey}`) {
        // === ПРОДАЖИ ===
        case 'sales.revenueTrend':
            return prepareRevenueTrend(data.sales, type);
        case 'sales.salesByType':
            return prepareSalesByType(data.sales);
        case 'sales.topProducts':
            return prepareTopProducts(data.sales, data.products);
        case 'sales.avgCheckTrend':
            return prepareAvgCheckTrend(data.sales, type);
        case 'sales.dealsPerDay':
            return prepareDealsPerDay(data.sales, type);
        case 'sales.salesByCategory':
            return prepareSalesByCategory(data.sales, data.products);
            
        // === КЛИЕНТЫ ===
        case 'clients.clientGrowth':
            return prepareClientGrowth(data.clients, type);
        case 'clients.clientSegments':
            return prepareClientSegments(data.allClients);
        case 'clients.topClients':
            return prepareTopClients(data.allClients, data.sales, periodDays);
        case 'clients.topClientsByCount':
            return prepareTopClientsByCount(data.allClients, data.sales, periodDays);
            
        // === ТОВАРЫ ===
        case 'products.stockLevels':
            return prepareStockLevels(data.products);
        case 'products.lowStock':
            return prepareLowStock(data.products, data.lowStockThreshold || 10);
        case 'products.productsByCategory':
            return prepareProductsByCategory(data.products);
        case 'products.categoryProfitability':
            return prepareCategoryProfitability(data.sales, data.products);
            
        // === ОБРАЩЕНИЯ ===
        case 'tickets.ticketsOverTime':
            return prepareTicketsOverTime(data.tickets, type);
        case 'tickets.ticketsByStatus':
            return prepareTicketsByStatus(data.tickets);
        case 'tickets.ticketsByType':
            return prepareTicketsByType(data.tickets);
            
        default:
            return { labels: [], datasets: [] };
    }
}

async function prepareDailyActivity(periodDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    
    // Загружаем все данные параллельно
    const [clients, sales, tickets] = await Promise.all([
        getAllItems('clients'),
        getAllItems('sales'),
        getAllItems('tickets')
    ]);
    
    // Группируем по датам
    const byDate = {};
    
    // Клиенты: новые регистрации
    clients.forEach(c => {
        const date = new Date(c.created_at);
        if (date >= cutoffDate) {
            const dateStr = date.toLocaleDateString('ru-RU');
            byDate[dateStr] = byDate[dateStr] || { clients: 0, sales: 0, tickets: 0 };
            byDate[dateStr].clients++;
        }
    });
    
    // Продажи: транзакции
    sales.forEach(s => {
        const date = new Date(s.transaction_date);
        if (date >= cutoffDate && s.type === 'sale') {
            const dateStr = date.toLocaleDateString('ru-RU');
            byDate[dateStr] = byDate[dateStr] || { clients: 0, sales: 0, tickets: 0 };
            byDate[dateStr].sales++;
        }
    });
    
    // Обращения: новые тикеты
    tickets.forEach(t => {
        const date = new Date(t.created_at);
        if (date >= cutoffDate) {
            const dateStr = date.toLocaleDateString('ru-RU');
            byDate[dateStr] = byDate[dateStr] || { clients: 0, sales: 0, tickets: 0 };
            byDate[dateStr].tickets++;
        }
    });
    
    // Формируем данные для графика
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dA, mA, yA] = a.split('.').map(Number);
        const [dB, mB, yB] = b.split('.').map(Number);
        return new Date(yA, mA - 1, dA) - new Date(yB, mB - 1, dB);
    });
    
    return {
        labels,
        datasets: [
            {
                label: 'Новых клиентов',
                data: labels.map(d => byDate[d].clients),
                borderColor: '#8b5cf6',
                backgroundColor: 'rgba(139, 92, 246, 0.1)',
                yAxisID: 'y',
                tension: 0.4
            },
            {
                label: 'Продаж',
                data: labels.map(d => byDate[d].sales),
                borderColor: '#10b981',
                backgroundColor: 'rgba(16, 185, 129, 0.1)',
                yAxisID: 'y',
                tension: 0.4
            },
            {
                label: 'Обращений',
                data: labels.map(d => byDate[d].tickets),
                borderColor: '#f59e0b',
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                yAxisID: 'y',
                tension: 0.4
            }
        ]
    };
}


// === ФУНКЦИИ ПОДГОТОВКИ ДАННЫХ ===

export function prepareRevenueTrend(sales, type) {
    // Группировка по дням
    const byDate = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale') return;
        
        const date = new Date(sale.transaction_date);
        const dateStr = date.toLocaleDateString('ru-RU');
        
        const amount = parseFloat(sale.total_amount) || 0;
        byDate[dateStr] = (byDate[dateStr] || 0) + amount;
    });
    
    // Сортировка дат
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const values = labels.map(date => byDate[date]);
    
    return {
        labels,
        datasets: [{
            label: 'Выручка (₽)',
            data: values,
            borderColor: '#3b82f6',
            backgroundColor: type === 'line' ? 'rgba(59, 130, 246, 0.1)' : '#3b82f6',
            fill: type === 'line',
            tension: 0.4
        }]
    };
}

export function prepareSalesByType(sales) {
    const byType = { 
        sale: 0, 
        writeoff: 0, 
        restock: 0 
    };
    
    sales.forEach(sale => {
        const type = sale.type;
        const amount = parseFloat(sale.total_amount) || 0;
        
        if (byType.hasOwnProperty(type)) {
            byType[type] += amount;
        }
    });
    
    return {
        labels: ['Продажа', 'Списание', 'Поступление'],
        datasets: [{
            label: 'Сумма (₽)',
            data: [
                Number(byType.sale) || 0,
                Number(byType.writeoff) || 0,
                Number(byType.restock) || 0
            ],
            backgroundColor: ['#10b981', '#ef4444', '#3b82f6']
        }]
    };
}

function prepareDealsPerDay(sales, type) {
    const byDate = {};
    
    sales.forEach(sale => {
        const date = new Date(sale.transaction_date);
        const dateStr = date.toLocaleDateString('ru-RU');
        
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });
    
    // Сортировка дат
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const values = labels.map(date => byDate[date]);
    
    return {
        labels,
        datasets: [{
            label: 'Сделок',
            data: values,
            borderColor: '#f59e0b',
            backgroundColor: type === 'line' ? 'rgba(245, 158, 11, 0.1)' : '#f59e0b',
            fill: type === 'line',
            tension: 0.4
        }]
    };
}

export function prepareTopProducts(sales, products) {
    const productSales = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale') return;
        
        const productId = sale.product_id;
        const amount = parseFloat(sale.total_amount) || 0;
        
        productSales[productId] = (productSales[productId] || 0) + amount;
    });
    
    // Сортировка и топ-10
    const sorted = Object.entries(productSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    const labels = sorted.map(([id]) => {
        const product = products.find(p => p.id == id);
        return product ? `${product.sku} ${product.name}` : `ID:${id}`;
    });
    
    const values = sorted.map(([, value]) => Number(value) || 0);
    
    return {
        labels,
        datasets: [{
            label: 'Выручка (₽)',
            data: values,
            backgroundColor: '#3b82f6'
        }]
    };
}

function prepareAvgCheckTrend(sales, type) {
    const byDate = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale') return;
        
        const date = new Date(sale.transaction_date);
        const dateStr = date.toLocaleDateString('ru-RU');
        
        if (!byDate[dateStr]) {
            byDate[dateStr] = { total: 0, count: 0 };
        }
        
        const amount = parseFloat(sale.total_amount) || 0;
        byDate[dateStr].total += amount;
        byDate[dateStr].count += 1;
    });
    
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const values = labels.map(date => {
        const { total, count } = byDate[date];
        return count > 0 ? total / count : 0;
    });
    
    return {
        labels,
        datasets: [{
            label: 'Средний чек (₽)',
            data: values,
            borderColor: '#10b981',
            backgroundColor: type === 'line' ? 'rgba(16, 185, 129, 0.1)' : '#10b981',
            fill: type === 'line',
            tension: 0.4
        }]
    };
}

function prepareClientGrowth(clients, type) {
    const byDate = {};
    
    clients.forEach(client => {
        const date = new Date(client.created_at);
        const dateStr = date.toLocaleDateString('ru-RU');
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });
    
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const values = labels.map(date => byDate[date]);
    
    return {
        labels,
        datasets: [{
            label: 'Новых клиентов',
            data: values,
            borderColor: '#8b5cf6',
            backgroundColor: type === 'line' ? 'rgba(139, 92, 246, 0.1)' : '#8b5cf6',
            fill: type === 'line',
            tension: 0.4
        }]
    };
}

function prepareClientSegments(clients) {
    const segments = { 
        new: 0,           // Новый
        active: 0,        // Активный
        loyal: 0,         // Лояльный
        regular: 0,       // Обычный
        vip: 0,          // VIP
        churnRisk: 0,    // Риск ухода
        inactive: 0,     // Неактивный
        potential: 0     // Потенциальный
    };
    
    const now = new Date();
    const days30Ago = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const days90Ago = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
    
    clients.forEach(client => {
        const count = parseInt(client.purchase_count) || 0;
        const total = parseFloat(client.total_spent) || 0;
        const lastPurchase = client.last_purchase_date ? new Date(client.last_purchase_date) : null;
        const created = new Date(client.created_at);
        
        // Логика сегментации
        if (count === 0 && (now - created) / (1000 * 60 * 60 * 24) <= 30) {
            // Новый клиент (зарегистрирован менее 30 дней назад и нет покупок)
            segments.new++;
        } else if (count === 0) {
            // Потенциальный (зарегистрирован, но нет покупок)
            segments.potential++;
        } else if (count >= 10 || total >= 150000) {
            // VIP (много покупок или большая сумма)
            segments.vip++;
        } else if (count >= 5 && total >= 50000) {
            // Лояльный (регулярные покупки)
            segments.loyal++;
        } else if (lastPurchase && lastPurchase >= days30Ago && count >= 2) {
            // Активный (недавние покупки)
            segments.active++;
        } else if (lastPurchase && lastPurchase >= days90Ago && lastPurchase < days30Ago) {
            // Риск ухода (был активен 1-3 месяца назад)
            segments.churnRisk++;
        } else if (lastPurchase && lastPurchase < days90Ago) {
            // Неактивный (давно не покупал)
            segments.inactive++;
        } else {
            // Обычный (всё остальное)
            segments.regular++;
        }
    });
    
    // Фильтруем пустые сегменты и формируем данные
    const segmentConfig = {
        new: { label: 'Новый', color: '#10b981' },
        active: { label: 'Активный', color: '#3b82f6' },
        loyal: { label: 'Лояльный', color: '#8b5cf6' },
        regular: { label: 'Обычный', color: '#64748b' },
        vip: { label: 'VIP', color: '#f59e0b' },
        churnRisk: { label: 'Риск ухода', color: '#f97316' },
        inactive: { label: 'Неактивный', color: '#ef4444' },
        potential: { label: 'Потенциальный', color: '#94a3b8' }
    };
    
    const labels = [];
    const data = [];
    const colors = [];
    
    for (const [key, value] of Object.entries(segments)) {
        if (value > 0) {
            labels.push(segmentConfig[key].label);
            data.push(value);
            colors.push(segmentConfig[key].color);
        }
    }
    
    return {
        labels,
        datasets: [{
            data,
            backgroundColor: colors
        }]
    };
}

function prepareTopClients(allClients, sales, periodDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    
    const filteredSales = sales.filter(sale => {
        if (sale.type !== 'sale') return false;
        const saleDate = new Date(sale.transaction_date);
        return saleDate >= cutoffDate;
    });
    
    const clientSales = {};
    filteredSales.forEach(sale => {
        const clientId = sale.client_id;
        if (!clientId) return;
        
        const amount = parseFloat(sale.total_amount) || 0;
        clientSales[clientId] = (clientSales[clientId] || 0) + amount;
    });
    
    const sorted = Object.entries(clientSales)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        return {
            labels: ['Нет данных за период'],
            datasets: [{
                label: 'Сумма покупок (₽)',
                data: [0],
                backgroundColor: '#cbd5e1'
            }]
        };
    }
    
    const labels = sorted.map(([id]) => {
        const client = allClients.find(c => c.id == id);
        return client ? client.name : `ID:${id}`;
    });
    
    const values = sorted.map(([, value]) => Number(value) || 0);
    
    return {
        labels,
        datasets: [{
            label: 'Сумма покупок (₽)',
            data: values,
            backgroundColor: '#3b82f6'
        }]
    };
}

function prepareTopClientsByCount(allClients, sales, periodDays) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - periodDays);
    
    // Считаем количество покупок по каждому клиенту
    const clientCounts = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale' || !sale.client_id) return;
        
        const saleDate = new Date(sale.transaction_date);
        if (saleDate < cutoffDate) return;
        
        clientCounts[sale.client_id] = (clientCounts[sale.client_id] || 0) + 1;
    });
    
    // Сортируем и берём топ-10
    const sorted = Object.entries(clientCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    if (sorted.length === 0) {
        return {
            labels: ['Нет данных'],
            datasets: [{
                label: 'Количество покупок',
                data: [0],
                backgroundColor: '#cbd5e1'
            }]
        };
    }
    
    const labels = sorted.map(([id]) => {
        const client = allClients.find(c => c.id == id);
        return client ? client.name : `ID:${id}`;
    });
    
    const values = sorted.map(([, count]) => count);
    
    return {
        labels,
        datasets: [{
            label: 'Покупок',
            data: values,
            backgroundColor: '#8b5cf6'
        }]
    };
}


function prepareStockLevels(products) {
    const sorted = [...products]
        .sort((a, b) => (b.quantity || 0) - (a.quantity || 0))
        .slice(0, 15);
    
    return {
        labels: sorted.map(p => `${p.sku} ${p.name}`),
        datasets: [{
            label: 'Остаток',
            data: sorted.map(p => parseInt(p.quantity) || 0),
            backgroundColor: sorted.map(p => {
                const qty = parseInt(p.quantity) || 0;
                return qty < 10 ? '#ef4444' : '#10b981';
            })
        }]
    };
}

function prepareLowStock(products, lowStockThreshold = 10) {
    const low = products.filter(p => {
        const qty = parseInt(p.quantity) || 0;
        return qty < lowStockThreshold && qty > 0 && (p.is_active !== false);
    });
    
    // Сортируем по возрастанию остатка (сначала самые критичные)
    low.sort((a, b) => (parseInt(a.quantity) || 0) - (parseInt(b.quantity) || 0));
    
    if (low.length === 0) {
        return {
            labels: ['Все товары в наличии (выше порога)'],
            datasets: [{
                label: `Остаток (порог: ${lowStockThreshold})`,
                data: [0],
                backgroundColor: ['#10b981']
            }]
        };
    }
    
    //  Цвета: красный для критически низких (0-3), оранжевый для остальных
    const backgroundColors = low.map(p => {
        const qty = parseInt(p.quantity) || 0;
        if (qty === 0) return 'rgba(239, 68, 68, 0.8)';      // Красный - нет в наличии
        if (qty <= 3) return 'rgba(239, 68, 68, 0.7)';       // Красный - критически мало
        if (qty <= 5) return 'rgba(249, 115, 22, 0.7)';      // Оранжевый - мало
        return 'rgba(251, 191, 36, 0.7)';                     // Жёлтый - ниже порога
    });
    
    return {
        labels: low.map(p => `${p.sku} ${p.name}`),
        datasets: [{
            label: `Остаток (порог: ${lowStockThreshold})`,
            data: low.map(p => parseInt(p.quantity) || 0),
            backgroundColor: backgroundColors
        }]
    };
}

function prepareTicketsOverTime(tickets, type) {
    const byDate = {};
    
    tickets.forEach(ticket => {
        const date = new Date(ticket.created_at);
        const dateStr = date.toLocaleDateString('ru-RU');
        byDate[dateStr] = (byDate[dateStr] || 0) + 1;
    });
    
    const labels = Object.keys(byDate).sort((a, b) => {
        const [dayA, monthA, yearA] = a.split('.').map(Number);
        const [dayB, monthB, yearB] = b.split('.').map(Number);
        return new Date(yearA, monthA - 1, dayA) - new Date(yearB, monthB - 1, dayB);
    });
    
    const values = labels.map(date => byDate[date]);
    
    return {
        labels,
        datasets: [{
            label: 'Обращений',
            data: values,
            borderColor: '#f59e0b',
            backgroundColor: type === 'line' ? 'rgba(245, 158, 11, 0.1)' : '#f59e0b',
            fill: type === 'line',
            tension: 0.4
        }]
    };
}

function prepareTicketsByStatus(tickets) {
    const byStatus = { 
        'Открыта': 0, 
        'Выполнена': 0, 
        'Архив': 0 
    };
    
    tickets.forEach(ticket => {
        const status = ticket.status;
        if (byStatus.hasOwnProperty(status)) {
            byStatus[status]++;
        }
    });
    
    // Фильтруем пустые статусы
    const labels = [];
    const data = [];
    const colors = [];
    
    if (byStatus['Открыта'] > 0) {
        labels.push('Открыта');
        data.push(byStatus['Открыта']);
        colors.push('#f59e0b');
    }
    if (byStatus['Выполнена'] > 0) {
        labels.push('Выполнена');
        data.push(byStatus['Выполнена']);
        colors.push('#10b981');
    }
    if (byStatus['Архив'] > 0) {
        labels.push('Архив');
        data.push(byStatus['Архив']);
        colors.push('#94a3b8');
    }
    
    return {
        labels,
        datasets: [{
            data,
            backgroundColor: colors
        }]
    };
}

function prepareTicketsByType(tickets) {
    const byType = {};
    
    tickets.forEach(ticket => {
        const type = ticket.type;
        byType[type] = (byType[type] || 0) + 1;
    });
    
    const typeColors = {
        'Вопрос': '#3b82f6',
        'Жалоба': '#ef4444',
        'Заказ': '#10b981',
        'Предложение': '#8b5cf6',
        'Претензия': '#f59e0b',
        'Благодарность': '#06b6d4'
    };
    
    return {
        labels: Object.keys(byType),
        datasets: [{
            data: Object.values(byType),
            backgroundColor: Object.keys(byType).map(type => 
                typeColors[type] || '#64748b'
            )
        }]
    };
}

// === НАСТРОЙКИ CHART.JS ===
function getChartOptions(config) {
    return {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: {
                position: config.type === 'pie' || config.type === 'doughnut' ? 'bottom' : 'top',
                labels: {
                    usePointStyle: true,
                    padding: 15
                }
            },
            title: {
                display: false
            },
            tooltip: {
                enabled: true,
                callbacks: {
                    label: function(context) {
                        let label = context.label || '';
                        let value = context.parsed;
                        
                        // Для круговых диаграмм
                        if (context.type === 'pie' || context.type === 'doughnut') {
                            // value уже число, просто форматируем
                            const numValue = Number(value) || 0;
                            return `${label}: ${numValue}`;
                        }
                        
                        // Для линейных и столбчатых
                        if (typeof value === 'number') {
                            // Форматируем число с разделителями
                            const formatted = new Intl.NumberFormat('ru-RU').format(value);
                            
                            // Добавляем ₽ если нужно
                            if (label.includes('₽') || label.includes('сумма') || label.includes('чек')) {
                                return `${label}: ${formatted} ₽`;
                            }
                            
                            return `${label}: ${formatted}`;
                        }
                        
                        // Если value не число - показываем как есть
                        return `${label}: ${value}`;
                    }
                },
                backgroundColor: 'rgba(0, 0, 0, 0.8)',
                titleColor: '#fff',
                bodyColor: '#fff',
                padding: 12,
                displayColors: true,
                boxPadding: 6
            }
        },
        scales: (config.type === 'line' || config.type === 'bar') ? {
            x: {
                grid: {
                    display: false
                }
            },
            y: {
                beginAtZero: true,
                grid: {
                    color: '#f1f5f9'
                },
                ticks: {
                    callback: function(value) {
                        // Форматируем числа на оси Y
                        if (typeof value === 'number') {
                            return new Intl.NumberFormat('ru-RU', {
                                notation: 'compact',
                                compactDisplay: 'short'
                            }).format(value);
                        }
                        return value;
                    }
                }
            }
        } : undefined
    };
}
// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function refreshAllCharts() {
    destroyAllCharts();
    renderChartsForMode(currentMode);
}

function destroyAllCharts() {
    Object.values(currentCharts).forEach(chart => chart.destroy());
    currentCharts = {};
}

// === ПОЛУЧЕНИЕ ПЕРИОДА ===
function getDateRange() {
    const now = new Date();
    
    if (currentPeriod.type === 'custom' && currentPeriod.from && currentPeriod.to) {
        return {
            from: new Date(currentPeriod.from),
            to: new Date(currentPeriod.to),
            days: Math.ceil((new Date(currentPeriod.to) - new Date(currentPeriod.from)) / (1000 * 60 * 60 * 24))
        };
    }
    
    if (currentPeriod.type === 'all') {
        return {
            from: new Date(2020, 0, 1),
            to: now,
            days: 3650
        };
    }
    
    const days = parseInt(currentPeriod.type) || 30;
    const to = now;
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    return { from, to, days };
}
// === ОБРАБОТЧИКИ СОБЫТИЙ ===

function setupEventListeners() {
    // Переключение режима данных
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMode = e.target.dataset.mode;
            await renderChartsForMode(currentMode);
        });
    });
    
    // Изменение периода
    const periodSelect = document.getElementById('chartPeriod');
    if (periodSelect) {
        periodSelect.addEventListener('change', async (e) => {
            const value = e.target.value;
            
            if (value === 'custom') {
                showCustomPeriodSection();
            } else {
                hideCustomPeriodSection();
                await applyPeriod(value);
            }
        });
    }
    
    // Кнопка "Применить" для произвольного периода
    document.getElementById('btnApplyCustomPeriod')?.addEventListener('click', async () => {
        const from = document.getElementById('customDateFrom').value;
        const to = document.getElementById('customDateTo').value;
        
        if (!from || !to) {
            alert('⚠️ Выберите обе даты');
            return;
        }
        
        if (new Date(from) > new Date(to)) {
            alert('⚠️ Дата начала не может быть позже даты окончания');
            return;
        }
        
        await applyPeriod('custom', from, to);
    });
    
    // Кнопка "Сбросить"
    document.getElementById('btnResetPeriod')?.addEventListener('click', async () => {
        hideCustomPeriodSection();
        const periodSelect = document.getElementById('chartPeriod');
        if (periodSelect) {
            periodSelect.value = '30'; // Возвращаем к стандартному 30 дням
        }
        await applyPeriod('30');
    });
}

function setupDateInputs() {
    const dateFrom = document.getElementById('customDateFrom');
    const dateTo = document.getElementById('customDateTo');
    
    // Устанавливаем значения только если нет сохранённого произвольного периода
    if (currentPeriod.type !== 'custom' || !currentPeriod.from || !currentPeriod.to) {
        const today = new Date().toISOString().split('T')[0];
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const defaultFrom = thirtyDaysAgo.toISOString().split('T')[0];
        
        if (dateFrom) dateFrom.value = defaultFrom;
        if (dateTo) dateTo.value = today;
    }
}

function showCustomPeriodSection() {
    const section = document.getElementById('customPeriodSection');
    if (section) section.style.display = 'flex';
}

function hideCustomPeriodSection() {
    const section = document.getElementById('customPeriodSection');
    if (section) section.style.display = 'none';
}

// === РАБОТА С НАСТРОЙКАМИ ПЕРИОДА ===

async function loadSavedPeriod() {
    try {
        // Читаем файл настроек напрямую
        const settingsFile = 'crm_data/settings.json';
        
        try {
            const data = await Neutralino.filesystem.readFile(settingsFile);
            const settings = JSON.parse(data);
            
            const savedPeriod = settings['charts.period'];
            console.log('📅 Loading saved period:', savedPeriod);
            
            if (savedPeriod) {
                currentPeriod = savedPeriod;
                
                const periodSelect = document.getElementById('chartPeriod');
                if (periodSelect) {
                    periodSelect.value = currentPeriod.type;
                }
                
                if (currentPeriod.type === 'custom' && currentPeriod.from && currentPeriod.to) {
                    showCustomPeriodSection();
                    const dateFrom = document.getElementById('customDateFrom');
                    const dateTo = document.getElementById('customDateTo');
                    if (dateFrom) dateFrom.value = currentPeriod.from;
                    if (dateTo) dateTo.value = currentPeriod.to;
                }
                
                console.log('✅ Loaded saved period:', currentPeriod);
            } else {
                console.log('⚠️ No saved period found, using default');
                currentPeriod = { type: '30', from: null, to: null };
            }
        } catch (err) {
            // Файл не существует или невалидный JSON
            console.log('⚠️ Settings file not found or invalid, using default');
            currentPeriod = { type: '30', from: null, to: null };
        }
    } catch (error) {
        console.error('❌ Error loading saved period:', error);
        currentPeriod = { type: '30', from: null, to: null };
    }
}

async function savePeriod(period) {
    try {
        const settingsFile = 'crm_data/settings.json';
        
        // 1. Читаем существующие настройки
        let settings = {};
        try {
            const data = await Neutralino.filesystem.readFile(settingsFile);
            settings = JSON.parse(data);
            console.log('📖 Read existing settings:', Object.keys(settings).length, 'keys');
        } catch (err) {
            console.log('⚠️ Settings file not found, creating new');
        }
        
        // 2. Добавляем/обновляем период
        settings['charts.period'] = {
            ...period,
            appliedAt: new Date().toISOString()
        };
        
        // 3. Сохраняем обратно
        await Neutralino.filesystem.writeFile(
            settingsFile,
            JSON.stringify(settings, null, 2)
        );
        
        currentPeriod = period;
        console.log('✅ Saved period. Total settings:', Object.keys(settings).length);
        
    } catch (error) {
        console.error('❌ Failed to save period:', error);
    }
}
export async function applyPeriod(type, from = null, to = null) {
    const period = {
        type,
        from,
        to,
        appliedAt: new Date().toISOString()
    };
    
    await savePeriod(period);
    updatePeriodInfo();
    
    // Перерисовываем графики
    await renderChartsForMode(currentMode);
}

export function updatePeriodInfo() {
    const infoEl = document.getElementById('periodInfo');
    if (!infoEl) return;
    
    const periodText = getPeriodDescription(currentPeriod);
    infoEl.textContent = ` ${periodText}`;
    infoEl.title = `Период: ${periodText}`;
}

export function getPeriodDescription(period) {
    switch(period.type) {
        case '7': return 'Последние 7 дней';
        case '30': return 'Последние 30 дней';
        case '90': return 'Последние 3 месяца';
        case '365': return 'Последний год';
        case 'all': return 'Всё время';
        case 'custom':
            if (period.from && period.to) {
                const from = new Date(period.from).toLocaleDateString('ru-RU');
                const to = new Date(period.to).toLocaleDateString('ru-RU');
                return `С ${from} по ${to}`;
            }
            return 'Произвольный период';
        default: return 'Не выбрано';
    }
}

let expandedChart = null; // Хранит текущий развёрнутый график

function setupExpandHandlers() {
    // Обработчик клика по кнопке
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.chart-expand-btn');
        if (btn) {
            const card = btn.closest('.chart-card');
            toggleExpandChart(card);
        }
    });

    // Закрытие по клику на оверлей
    const overlay = document.querySelector('.chart-overlay') || createChartOverlay();
    overlay.addEventListener('click', () => {
        if (expandedChart) toggleExpandChart(expandedChart);
    });

    // Закрытие по Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && expandedChart) {
            toggleExpandChart(expandedChart);
        }
    });
}

function createChartOverlay() {
    const overlay = document.createElement('div');
    overlay.className = 'chart-overlay';
    document.body.appendChild(overlay);
    return overlay;
}

function toggleExpandChart(card) {
    if (!card) return;

    const overlay = document.querySelector('.chart-overlay');
    const key = card.dataset.chartKey;
    const chartInstance = currentCharts[key];

    if (card.classList.contains('expanded')) {
        // === Сворачивание ===
        card.classList.remove('expanded');
        overlay.classList.remove('active');
        document.body.style.overflow = '';
        
        // Пересчёт размеров графика
        if (chartInstance) {
            setTimeout(() => chartInstance.resize(), 50);
        }
        expandedChart = null;
    } else {
        // === Разворачивание ===
        // Сначала свернём предыдущий, если был
        if (expandedChart) {
            expandedChart.classList.remove('expanded');
        }
        
        card.classList.add('expanded');
        overlay.classList.add('active');
        document.body.style.overflow = 'hidden'; // Блокируем скролл фона
        
        // Пересчёт размеров графика под новый контейнер
        if (chartInstance) {
            // Небольшая задержка для применения CSS-перехода
            setTimeout(() => chartInstance.resize(), 100);
        }
        expandedChart = card;
    }
}

// Продажи по категориям товаров
export function prepareSalesByCategory(sales, products) {
    const categorySales = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale') return;
        
        const product = products.find(p => p.id == sale.product_id);
        const category = product?.category || 'Без категории';
        const amount = parseFloat(sale.total_amount) || 0;
        
        categorySales[category] = (categorySales[category] || 0) + amount;
    });
    
    const sorted = Object.entries(categorySales)
        .sort((a, b) => b[1] - a[1]);
    
    // Если категорий больше 8, объединяем остальные в "Другие"
    let labels, data;
    if (sorted.length > 8) {
        const top = sorted.slice(0, 7);
        const others = sorted.slice(7).reduce((sum, [, val]) => sum + val, 0);
        
        labels = top.map(([cat]) => cat);
        labels.push('Другие');
        data = top.map(([, val]) => Number(val) || 0);
        data.push(Number(others) || 0);
    } else {
        labels = sorted.map(([cat]) => cat);
        data = sorted.map(([, val]) => Number(val) || 0);
    }
    
    // Цвета для категорий
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#f97316', '#84cc16',
        '#ec4899', '#64748b'
    ];
    
    return {
        labels,
        datasets: [{
            label: 'Выручка (₽)',
            data,
            backgroundColor: colors.slice(0, labels.length)
        }]
    };
}

// Товары по категориям
export function prepareProductsByCategory(products) {
    const categoryCount = {};
    
    products.forEach(product => {
        const category = product.category || 'Без категории';
        categoryCount[category] = (categoryCount[category] || 0) + 1;
    });
    
    const sorted = Object.entries(categoryCount)
        .sort((a, b) => b[1] - a[1]);
    
    const labels = sorted.map(([cat]) => cat);
    const data = sorted.map(([, count]) => count);
    
    const colors = [
        '#3b82f6', '#10b981', '#f59e0b', '#ef4444',
        '#8b5cf6', '#06b6d4', '#f97316', '#84cc16'
    ];
    
    return {
        labels,
        datasets: [{
            label: 'Количество товаров',
            data,
            backgroundColor: colors.slice(0, labels.length)
        }]
    };
}

// Доходность категорий
export function prepareCategoryProfitability(sales, products) {
    const categoryRevenue = {};
    
    sales.forEach(sale => {
        if (sale.type !== 'sale') return;
        
        const product = products.find(p => p.id == sale.product_id);
        const category = product?.category || 'Без категории';
        const amount = parseFloat(sale.total_amount) || 0;
        
        categoryRevenue[category] = (categoryRevenue[category] || 0) + amount;
    });
    
    const sorted = Object.entries(categoryRevenue)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    
    return {
        labels: sorted.map(([cat]) => cat),
        datasets: [{
            label: 'Выручка (₽)',
            data: sorted.map(([, val]) => Number(val) || 0),
            backgroundColor: '#3b82f6'
        }]
    };
}