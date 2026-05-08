// resources/js/client.js
import { getSetting } from './settings-manager.js';
// Импортируем функции из db.js
import { 
    getAllClients, 
    createClient as dbCreateClient, 
    deleteClient as dbDeleteClient,
    updateClient as dbUpdateClient 
} from './db_indexeddb.js';

const STORE_NAME = 'clients';

export async function handleClientFormSubmit(formData) {
    try {
        // Создаём клиента через IndexedDB
        const clientId = await dbCreateClient(
            formData.name,
            formData.phone,
            formData.email
        );
        
        // Показываем сообщение
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = `Клиент создан с ID: ${clientId}`;
            messageEl.style.color = 'green';
        }
        
        console.log('client.js: Client created with ID:', clientId);
        return clientId;
    } catch (error) {
        console.error('client.js: Error creating client:', error);
        
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = 'Не удалось создать клиента: ' + error.message;
            messageEl.style.color = 'red';
        }
        
        return null;
    }
}



// Экспортируем deleteClient
export async function deleteClient(id) {
    try {
        await dbDeleteClient(id);
        console.log('client.js: Client deleted with ID:', id);
        return true;
    } catch (error) {
        console.error('client.js: Error deleting client:', error);
        throw error;
    }
}

// Экспортируем updateClient
export async function updateClient(id, data) {
    try {
        await dbUpdateClient(id, data);
        console.log('client.js: Client updated with ID:', id);
        return true;
    } catch (error) {
        console.error('client.js: Error updating client:', error);
        throw error;
    }
}

// Переименовываем для ясности
export { getAllClients as loadClientList };

export function getClientById(id) {
    // IndexedDB не поддерживает прямой поиск по ID без getAll
    // Для простоты возвращаем заглушку
    console.warn('getClientById not implemented for IndexedDB');
    return null;
}

// Рассчёт метрик и сегмента для отображения
export function calculateClientDisplayData(client) {
    const total = client.total_spent || 0;
    const count = client.purchase_count || 0;
    const avgCheck = count > 0 ? total / count : 0;

    // Определение основной категории (сегмента)
    let segment = 'Обычный';
    let segmentColor = '#6b7280'; // Серый
    let segmentTooltip = 'Стандартный клиент';

    // Логика сегментации по активности
    if (count === 0) {
        segment = 'Потенциальный';
        segmentColor = '#94a3b8';
        segmentTooltip = 'Клиент без покупок';
    } else if (count >= 10 || total >= 150000) {
        segment = 'VIP';
        segmentColor = '#8b5cf6';
        segmentTooltip = 'VIP клиент (10+ покупок или 150к+ ₽)';
    } else if (count >= 3) {
        segment = 'Постоянный';
        segmentColor = '#3b82f6';
        segmentTooltip = 'Постоянный клиент (3+ покупки)';
    }

    // Отдельно проверяем "Нового" клиента (< 30 дней)
    const daysSinceReg = (Date.now() - new Date(client.created_at).getTime()) / (1000 * 60 * 60 * 24);
    const isNew = daysSinceReg <= 30;
    const newBadge = isNew ? {
        icon: '⭐',
        tooltip: 'Новый клиент (менее 30 дней с регистрации)',
        color: '#f59e0b'
    } : null;

    return {
        total,
        count,
        avgCheck,
        segment,
        segmentColor,
        segmentTooltip,
        newBadge,
        isNew
    };
}