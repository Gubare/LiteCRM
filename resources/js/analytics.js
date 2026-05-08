// resources/js/analytics.js
import { getSetting } from './settings-manager.js';
// RFM-сегментация клиентов
export function rfmSegmentation(clients, sales) {
    // Подсчёт метрики для каждого клиента
    const clientMetrics = clients.map(client => {
        const clientSales = sales.filter(s => s.client_id === client.id);
        
        if (clientSales.length === 0) {
            return {
                clientId: client.id,
                name: client.name,
                r: 999, // Не покупал никогда
                f: 0,
                m: 0,
                segment: 'Lost'
            };
        }
        
        const dates = clientSales.map(s => new Date(s.transaction_date).getTime());
        const lastPurchase = Math.max(...dates);
        const recency = (Date.now() - lastPurchase) / (1000 * 60 * 60 * 24); // дней
        
        return {
            clientId: client.id,
            name: client.name,
            r: recency,
            f: clientSales.length,
            m: clientSales.reduce((sum, s) => sum + (s.total_amount || 0), 0)
        };
    });
    
    // 2. Считаем квантили для скоринга (1-5)
    const getScore = (values, value, inverse = false) => {
        const sorted = [...values].sort((a, b) => inverse ? b - a : a - b);
        const p20 = sorted[Math.floor(sorted.length * 0.2)];
        const p40 = sorted[Math.floor(sorted.length * 0.4)];
        const p60 = sorted[Math.floor(sorted.length * 0.6)];
        const p80 = sorted[Math.floor(sorted.length * 0.8)];
        
        if (inverse) {
            if (value <= p20) return 5;
            if (value <= p40) return 4;
            if (value <= p60) return 3;
            if (value <= p80) return 2;
            return 1;
        } else {
            if (value >= p80) return 5;
            if (value >= p60) return 4;
            if (value >= p40) return 3;
            if (value >= p20) return 2;
            return 1;
        }
    };
    
    const rValues = clientMetrics.map(c => c.r);
    const fValues = clientMetrics.map(c => c.f);
    const mValues = clientMetrics.map(c => c.m);
    
    // 3. Присваиваем скоры и сегменты
    return clientMetrics.map(c => {
        const rScore = getScore(rValues, c.r, true); // меньше дней = лучше
        const fScore = getScore(fValues, c.f);
        const mScore = getScore(mValues, c.m);
        
        // Простые правила сегментации
        let segment = 'Regular';
        if (rScore >= 4 && fScore >= 4 && mScore >= 4) segment = 'Champions';
        else if (rScore >= 4 && fScore >= 3) segment = 'Loyal';
        else if (rScore >= 4 && fScore <= 2) segment = 'New';
        else if (rScore <= 2 && fScore >= 3) segment = 'At Risk';
        else if (rScore <= 2 && fScore <= 2) segment = 'Lost';
        
        return {
            ...c,
            rScore, fScore, mScore,
            rfmScore: rScore * 100 + fScore * 10 + mScore,
            segment
        };
    });
}

// Вспомогательная: получить цвет для сегмента
export function getSegmentColor(segment) {
    const colors = {
        'Champions': '#10b981', // зеленый
        'Loyal': '#3b82f6',     // синий
        'New': '#8b5cf6',       // фиолетовый
        'Regular': '#6b7280',   // серый
        'At Risk': '#f59e0b',   // оранжевый
        'Lost': '#ef4444'       // красный
    };
    return colors[segment] || '#6b7280';
}