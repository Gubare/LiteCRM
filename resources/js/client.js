// resources/js/client.js

// Импортируем функции из db.js
import { 
    getAllClients, 
    createClient as dbCreateClient, 
    deleteClient as dbDeleteClient,
    updateClient as dbUpdateClient 
} from './db_indexeddb.js';

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