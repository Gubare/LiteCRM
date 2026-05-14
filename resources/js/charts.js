// resources/js/charts.js
import { getAllItems } from './db_indexeddb.js';
import { getSetting } from './settings-manager.js';

// === КОНФИГУРАЦИЯ ГРАФИКОВ ===
const CHART_CONFIGS = {
    sales: {
        'revenueTrend': {
            title: 'Динамика выручки',
            type: 'line',
            icon: '📈',
            description: 'Выручка по дням'
        },
        'salesByType': {
            title: 'Продажи по типам',
            type: 'doughnut',
            icon: '🍩',
            description: 'Продажа/Списание/Поступление'
        },
        'topProducts': {
            title: 'Топ-10 товаров',
            type: 'bar',
            icon: '📊',
            description: 'Самые продаваемые товары'
        },
        'avgCheckTrend': {
            title: 'Средний чек',
            type: 'line',
            icon: '📈',
            description: 'Динамика среднего чека'
        }
    },
    clients: {
        'clientGrowth': {
            title: 'Прирост клиентов',
            type: 'line',
            icon: '📈',
            description: 'Новые клиенты по периодам'
        },
        'clientSegments': {
            title: 'Сегментация',
            type: 'pie',
            icon: '🥧',
            description: 'Распределение по сегментам'
        },
        'topClients': {
            title: 'Топ-10 клиентов',
            type: 'bar',
            icon: '📊',
            description: 'По сумме покупок'
        }
    },
    products: {
        'stockLevels': {
            title: 'Остатки на складе',
            type: 'bar',
            icon: '📊',
            description: 'Количество товаров'
        },
        'lowStock': {
            title: 'Заканчиваются',
            type: 'bar',
            icon: '⚠️',
            description: 'Товары с остатком < 10'
        }
    },
    tickets: {
        'ticketsOverTime': {
            title: 'Обращения по времени',
            type: 'line',
            icon: '📈',
            description: 'Нагрузка на поддержку'
        },
        'ticketsByStatus': {
            title: 'По статусам',
            type: 'pie',
            icon: '🥧',
            description: 'Открытые/Выполненные/Архив'
        },
        'ticketsByType': {
            title: 'По типам',
            type: 'doughnut',
            icon: '🍩',
            description: 'Вопросы/Жалобы/Заказы'
        }
    }
};

// === СОСТОЯНИЕ ===
let currentMode = 'sales';
let currentCharts = {}; // Хранилище экземпляров Chart.js

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    setupEventListeners();
    await renderChartsForMode('sales');
});

function setupEventListeners() {
    // Переключение режима данных (Продажи/Клиенты/...)
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            document.querySelectorAll('.mode-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMode = e.target.dataset.mode;
            await renderChartsForMode(currentMode);
        });
    });
    
    // Изменение типа диаграммы
    document.getElementById('chartTypeSelect')?.addEventListener('change', () => {
        refreshAllCharts();
    });
    
    // Изменение периода
    document.getElementById('chartPeriod')?.addEventListener('change', () => {
        refreshAllCharts();
    });
}

// === ОТРИСОВКА ГРАФИКОВ ===
async function renderChartsForMode(mode) {
    const container = document.getElementById('chartsContainer');
    if (!container) return;
    
    // Очистка старых графиков
    destroyAllCharts();
    container.innerHTML = '';
    
    const configs = CHART_CONFIGS[mode];
    const period = document.getElementById('chartPeriod')?.value || '30';
    
    // Загрузка данных
    const data = await loadDataForMode(mode);
    const periodDays = data.dateRange?.days || 30;
    
    // Создание графиков
    for (const [key, config] of Object.entries(configs)) {
        const chartCard = createChartCard(key, config);
        container.appendChild(chartCard);
        
        const canvas = chartCard.querySelector('canvas');
        const chartData = prepareChartData(mode, key, data, periodDays);
        
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
    card.innerHTML = `
        <div class="chart-header">
            <h3>${config.icon} ${config.title}</h3>
            <p class="chart-description">${config.description}</p>
        </div>
        <div class="chart-body">
            <canvas id="chart-${key}"></canvas>
        </div>
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
                products: products,
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
            return { products: prods, dateRange };
            
        case 'tickets':
            const tickets = await getAllItems('tickets');
            return {
                tickets: tickets.filter(t => new Date(t.created_at) >= dateRange.from),
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
            
        // === КЛИЕНТЫ ===
        case 'clients.clientGrowth':
            return prepareClientGrowth(data.clients, type);
        case 'clients.clientSegments':
            return prepareClientSegments(data.allClients);
        case 'clients.topClients':
            return prepareTopClients(data.allClients, data.sales, periodDays);
            
        // === ТОВАРЫ ===
        case 'products.stockLevels':
            return prepareStockLevels(data.products);
        case 'products.lowStock':
            return prepareLowStock(data.products);
            
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

// === ПРИМЕРЫ ПОДГОТОВКИ ДАННЫХ ===

// === ИСПРАВЛЕННЫЕ ФУНКЦИИ ПОДГОТОВКИ ДАННЫХ ===

function prepareRevenueTrend(sales, type) {
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

function prepareSalesByType(sales) {
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

function prepareTopProducts(sales, products) {
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
        potential: 0, 
        regular: 0, 
        vip: 0 
    };
    
    clients.forEach(client => {
        const count = parseInt(client.purchase_count) || 0;
        const total = parseFloat(client.total_spent) || 0;
        
        if (count >= 10 || total >= 150000) {
            segments.vip++;
        } else if (count >= 3) {
            segments.regular++;
        } else {
            segments.potential++;
        }
    });
    
    // Фильтруем пустые сегменты
    const labels = [];
    const data = [];
    const colors = [];
    
    if (segments.potential > 0) {
        labels.push('Потенциальный');
        data.push(segments.potential);
        colors.push('#94a3b8');
    }
    if (segments.regular > 0) {
        labels.push('Обычный');
        data.push(segments.regular);
        colors.push('#3b82f6');
    }
    if (segments.vip > 0) {
        labels.push('VIP');
        data.push(segments.vip);
        colors.push('#8b5cf6');
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

function prepareLowStock(products) {
    const low = products.filter(p => {
        const qty = parseInt(p.quantity) || 0;
        return qty < 10 && qty > 0;
    });
    
    if (low.length === 0) {
        return {
            labels: ['Все товары в наличии'],
            datasets: [{
                data: [0],
                backgroundColor: ['#cbd5e1']
            }]
        };
    }
    
    return {
        labels: low.map(p => `${p.sku} ${p.name}`),
        datasets: [{
            label: 'Остаток',
            data: low.map(p => parseInt(p.quantity) || 0),
            backgroundColor: '#ef4444'
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
    const period = document.getElementById('chartPeriod')?.value || '30';
    
    if (period === 'custom') {
        const from = document.getElementById('customDateFrom')?.value;
        const to = document.getElementById('customDateTo')?.value;
        
        if (from && to) {
            return {
                from: new Date(from),
                to: new Date(to),
                days: Math.ceil((new Date(to) - new Date(from)) / (1000 * 60 * 60 * 24))
            };
        }
    }
    
    if (period === 'all') {
        return {
            from: new Date(2020, 0, 1),
            to: new Date(),
            days: 3650
        };
    }
    
    const days = parseInt(period);
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    
    return { from, to, days };
}