
// resources/js/db.js - Реализация на IndexedDB
// Хранение данных в браузере

const DB_NAME = 'CRM_Database';
const DB_VERSION = 1;
const STORE_NAME = 'clients';

let db = null;

// Инициализация базы данных IndexedDB
export function initDatabase() {
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
export function getDbInstance() {
    return db;
}

// Добавить клиента
export function createClient(name, phone, email) {
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
export function getAllClients() {
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
export function deleteClient(id) {
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
export function clearAllClients() {
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

// Экспорт всех данных для бэкапа
export function exportDatabase() {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const data = {
                version: DB_VERSION,
                exported_at: new Date().toISOString(),
                clients: event.target.result
            };
            resolve(JSON.stringify(data, null, 2));
        };
        
        request.onerror = function(event) {
            reject(event.target.error);
        };
    });
}

// Импорт данных из бэкапа
export function importDatabase(jsonData) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = JSON.parse(jsonData);
            if (!db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }
            
            // Очищаем текущие данные
            await clearAllClients();
            
            // Вставляем новые
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            for (const client of data.clients) {
                store.add(client);
            }
            
            transaction.oncomplete = function() {
                console.log('Database imported successfully');
                resolve();
            };
            
            transaction.onerror = function(event) {
                reject(event.target.error);
            };
            
        } catch (error) {
            reject(error);
        }
    });
}

// Экспорт данных в JSON для сохранения в файл
export function exportToJSON() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('❌ Database not initialized');
            reject(new Error('База данных не инициализирована'));
            return;
        }
        
        console.log('📦 Exporting data to JSON...');
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const data = {
                version: DB_VERSION,
                timestamp: new Date().toISOString(),
                clients: event.target.result
            };
            
            console.log('💾 Exported', data.clients.length, 'clients to JSON');
            console.log('Data:', JSON.stringify(data, null, 2));
            
            resolve(JSON.stringify(data));
        };
        
        request.onerror = function(event) {
            console.error('❌ Export error:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Импорт данных из JSON файла
export function importFromJSON(jsonData) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = JSON.parse(jsonData);
            
            if (!db) {
                reject(new Error('База данных не инициализирована'));
                return;
            }
            
            // Очищаем текущие данные
            await clearAllClients();
            
            // Вставляем новые данные
            const transaction = db.transaction([STORE_NAME], 'readwrite');
            const store = transaction.objectStore(STORE_NAME);
            
            for (const client of data.clients) {
                // Удаляем id, чтобы autoIncrement работал корректно
                const { id, ...clientData } = client;
                store.add(clientData);
            }
            
            transaction.oncomplete = function() {
                console.log('✅ Данные импортированы из файла');
                resolve();
            };
            
            transaction.onerror = function(event) {
                reject(event.target.error);
            };
            
        } catch (error) {
            reject(error);
        }
    });
}

// Обновить клиента
export function updateClient(id, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        
        // Сначала получаем существующую запись
        const getRequest = store.get(id);
        
        getRequest.onsuccess = function(event) {
            const client = event.target.result;
            if (!client) {
                reject(new Error('Клиент не найден'));
                return;
            }
            
            // Обновляем поля
            const updatedClient = {
                ...client,
                ...data,
                updated_at: new Date().toISOString()
            };
            
            // Сохраняем
            const request = store.put(updatedClient);
            
            request.onsuccess = function() {
                console.log('✅ Клиент обновлён в БД');
                resolve(id);
            };
            
            request.onerror = function(event) {
                reject(event.target.error);
            };
        };
        
        getRequest.onerror = function(event) {
            reject(event.target.error);
        };
    });
}
