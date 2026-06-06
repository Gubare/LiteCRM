// resources/js/reports-config.js

export const REPORTS_CONFIG = {
    // === КЛИЕНТЫ ===
    clients: {
        label: 'Клиенты',
        metrics: [
            {
                id: 'total_count',
                label: 'Всего клиентов',
                calculate: (items) => items.length,
                format: (val) => val.toString(),
                hint: 'Общее количество записей'
            },
            {
                id: 'with_phone',
                label: 'С телефоном',
                calculate: (items) => items.filter(c => c.phone?.trim()).length,
                format: (val, total) => `${val} (${total ? Math.round(val/total*100) : 0}%)`,
                hint: 'Клиенты с заполненным телефоном'
            },
            {
                id: 'with_email',
                label: 'С email',
                calculate: (items) => items.filter(c => c.email?.trim()).length,
                format: (val, total) => `${val} (${total ? Math.round(val/total*100) : 0}%)`,
                hint: 'Клиенты с заполненным email'
            },
            {
                id: 'recent_30d',
                label: 'За последние 30 дней',
                calculate: (items) => {
                    const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
                    return items.filter(c => new Date(c.created_at).getTime() > cutoff).length;
                },
                format: (val) => val.toString(),
                hint: 'Новые клиенты за месяц'
            }
        ]
    },

    // === ТОВАРЫ ===
    products: {
        label: 'Товары',
        metrics: [
            {
                id: 'total_count',
                label: 'Всего товаров',
                calculate: (items) => items.length,
                format: (val) => val.toString(),
                hint: 'Общее количество записей'
            },
            {
                id: 'active_count',
                label: 'В продаже',
                calculate: (items) => items.filter(p => p.is_active).length,
                format: (val, total) => `${val} (${total ? Math.round(val/total*100) : 0}%)`,
                hint: 'Активные товары'
            },
            {
                id: 'total_value',
                label: 'Общая стоимость',
                calculate: (items) => items.reduce((sum, p) => sum + (p.price * p.quantity || 0), 0),
                format: (val) => `${val.toLocaleString('ru-RU')} ₽`,
                hint: 'Сумма: цена × количество для всех товаров'
            },
            {
                id: 'avg_price',
                label: 'Средняя цена',
                calculate: (items) => {
                    const withPrice = items.filter(p => p.price > 0);
                    return withPrice.length ? withPrice.reduce((s, p) => s + p.price, 0) / withPrice.length : 0;
                },
                format: (val) => `${val.toFixed(2)} ₽`,
                hint: 'Средняя цена активных товаров'
            },
            {
                id: 'low_stock',
                label: 'Мало на складе',
                calculate: (items) => items.filter(p => p.quantity < (p.min_stock_threshold || 5)).length,
                format: (val) => val.toString(),
                hint: 'Товары ниже порога запаса'
            }
        ]
    },

    // === ОБРАЩЕНИЯ ===
    tickets: {
        label: 'Обращения',
        metrics: [
            {
                id: 'total_count',
                label: 'Всего обращений',
                calculate: (items) => items.length,
                format: (val) => val.toString(),
                hint: 'Общее количество записей'
            },
            {
                id: 'by_type',
                label: 'По типам',
                calculate: (items) => {
                    const stats = {};
                    items.forEach(t => { stats[t.type] = (stats[t.type] || 0) + 1; });
                    return stats;
                },
                format: (val) => Object.entries(val).map(([k, v]) => `${k}: ${v}`).join(', '),
                hint: 'Распределение по типам',
                isComplex: true
            },
            {
                id: 'with_client',
                label: 'С привязкой к клиенту',
                calculate: (items) => items.filter(t => t.client_id).length,
                format: (val, total) => `${val} (${total ? Math.round(val/total*100) : 0}%)`,
                hint: 'Обращения с выбранным клиентом'
            },
            {
                id: 'recent_7d',
                label: 'За последние 7 дней',
                calculate: (items) => {
                    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
                    return items.filter(t => new Date(t.created_at).getTime() > cutoff).length;
                },
                format: (val) => val.toString(),
                hint: 'Новые обращения за неделю'
            }
        ]
    }
};