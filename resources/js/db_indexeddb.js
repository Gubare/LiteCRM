// resources/js/db.js - Реализация на IndexedDB
// Хранение данных в браузере с сохранением между перезапусками

const DB_NAME = 'CRM_Database';
const DB_VERSION = 1;
const STORE_NAME = 'clients';

let db = null;

// Инициализация базы данных IndexedDB
function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        // Создаётся только если базы нет или версия изменилась
        request.onupgradeneeded = function(event) {
            const database = event.target.result;
            
            // Создаём хранилище клиентов, если его нет
            if (!database.objectStoreNames.contains(STORE_NAME)) {
                const objectStore = database.createObjectStore(STORE_NAME, {
                    keyPath: 'id',
                    autoIncrement: true
                });
                objectStore.createIndex('name', 'name', { unique: false });
                objectStore.createIndex('email', 'email', { unique: false });
                console.log('Хранилище clients создано');
            }
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('База данных IndexedDB успешно открыта');
            resolve(db);
        };

        request.onerror = function(event) {
            console.error('Ошибка открытия базы данных:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Получить экземпляр БД
function getDbInstance() {
    return db;
}

// Добавить клиента
function createClient(name, phone, email) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        const client = {
            name: name,
            phone: phone || '',
            email: email || '',
            created_at: new Date().toISOString()
        };

        const request = store.add(client);

        request.onsuccess = function(event) {
            const id = event.target.result;
            console.log('Клиент создан с ID:', id);
            resolve(id);
        };

        request.onerror = function(event) {
            console.error('Ошибка добавления клиента:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Получить всех клиентов
function getAllClients() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();

        request.onsuccess = function(event) {
            const clients = event.target.result;
            resolve(clients);
        };

        request.onerror = function(event) {
            console.error('Ошибка получения клиентов:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Удалить клиента (для будущего использования)
function deleteClient(id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);

        request.onsuccess = function() {
            console.log('Клиент удалён');
            resolve();
        };

        request.onerror = function(event) {
            console.error('Ошибка удаления клиента:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Очистить всё хранилище (для тестов)
function clearAllClients() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();

        request.onsuccess = function() {
            console.log('Все клиенты удалены');
            resolve();
        };

        request.onerror = function(event) {
            console.error('Ошибка очистки:', event.target.error);
            reject(event.target.error);
        };
    });
}
