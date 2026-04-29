// resources/js/client.js

// Импортируем функции из db.js
import { getAllClients, createClient as dbCreateClient } from './db_indexeddb.js';


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

// Переименовываем для ясности
export { getAllClients as loadClientList };

export function getClientById(id) {
    // IndexedDB не поддерживает прямой поиск по ID без getAll
    // Для простоты возвращаем заглушку
    console.warn('getClientById not implemented for IndexedDB');
    return null;
}