// resources/js/client.js - Работа с клиентами через IndexedDB

let db = null;

// Получаем экземпляр БД из main.js после инициализации
function setDbInstance(dbInstance) {
    db = dbInstance;
}

async function handleClientFormSubmit(formData) {
    try {
        const clientId = await createClient(
            formData.name,
            formData.phone,
            formData.email
        );
        
        // Обновление UI
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = 'Клиент создан с ID: ' + clientId;
        }
        
        // Перезагружаем список клиентов
        if (typeof window.renderClientTable === 'function') {
            const clients = await loadClientList();
            window.renderClientTable(clients);
        }
        
        return clientId;
    } catch (error) {
        console.error('Ошибка создания клиента:', error);
        if (typeof Neutralino !== 'undefined') {
            Neutralino.os.showMessageBox('Ошибка', 
                'Не удалось создать клиента: ' + error.message);
        }
        return null;
    }
}

async function loadClientList() {
    if (!db) {
        console.error('База данных не инициализирована');
        return [];
    }
    const clients = await getAllClients();
    return clients || [];
}