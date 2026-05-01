// resources/js/db_indexeddb.js

const DB_NAME = 'CRM_Database';
const DB_VERSION = 2; // Увеличиваем версию для добавления новых хранилищ!
const STORE_NAME = 'clients'; 
let db = null;

// Инициализация БД с поддержкой нескольких таблиц
export function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            const database = event.target.result;

            // Создаём хранилище клиентов, если нет
            if (!database.objectStoreNames.contains('clients')) {
                const clientStore = database.createObjectStore('clients', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                clientStore.createIndex('name', 'name', { unique: false });
                console.log('✅ Store "clients" created');
            }

            // Создаём хранилище товаров, если нет
            if (!database.objectStoreNames.contains('products')) {
                const productStore = database.createObjectStore('products', {
                    keyPath: 'id',
                    autoIncrement: true
                });
                productStore.createIndex('category', 'category', { unique: false });
                productStore.createIndex('sku', 'sku', { unique: true });
                productStore.createIndex('is_active', 'is_active', { unique: false });
                console.log('✅ Store "products" created');
            }

            // Здесь можно добавлять новые таблицы по аналогии
        };

        request.onsuccess = function(event) {
            db = event.target.result;
            console.log('✅ Database opened');
            resolve(db);
        };

        request.onerror = function(event) {
            console.error('❌ Database error:', event.target.error);
            reject(event.target.error);
        };
    });
}
// Получить экземпляр БД
export function getDbInstance() {
    return db;
}

// // Добавить клиента
// export function createClient(name, phone, email) {
//     return new Promise((resolve, reject) => {
//         if (!db) {
//             reject(new Error('База данных не инициализирована'));
//             return;
//         }

//         const transaction = db.transaction([STORE_NAME], 'readwrite');
//         const store = transaction.objectStore(STORE_NAME);

//         const client = {
//             name: name,
//             phone: phone || '',
//             email: email || '',
//             created_at: new Date().toISOString()
//         };

//         const request = store.add(client);

//         request.onsuccess = function(event) {
//             const id = event.target.result;
//             console.log('Клиент создан с ID:', id);
//             resolve(id);
//         };

//         request.onerror = function(event) {
//             console.error('Ошибка добавления клиента:', event.target.error);
//             reject(event.target.error);
//         };
//     });
// }

// // Получить всех клиентов
// export function getAllClients() {
//     return new Promise((resolve, reject) => {
//         if (!db) {
//             reject(new Error('База данных не инициализирована'));
//             return;
//         }

//         const transaction = db.transaction([STORE_NAME], 'readonly');
//         const store = transaction.objectStore(STORE_NAME);
//         const request = store.getAll();

//         request.onsuccess = function(event) {
//             const clients = event.target.result;
//             resolve(clients);
//         };

//         request.onerror = function(event) {
//             console.error('Ошибка получения клиентов:', event.target.error);
//             reject(event.target.error);
//         };
//     });
// }

// // Удалить клиента (для будущего использования)
// export function deleteClient(id) {
//     return new Promise((resolve, reject) => {
//         if (!db) {
//             reject(new Error('База данных не инициализирована'));
//             return;
//         }

//         const transaction = db.transaction([STORE_NAME], 'readwrite');
//         const store = transaction.objectStore(STORE_NAME);
//         const request = store.delete(id);

//         request.onsuccess = function() {
//             console.log('Клиент удалён');
//             resolve();
//         };

//         request.onerror = function(event) {
//             console.error('Ошибка удаления клиента:', event.target.error);
//             reject(event.target.error);
//         };
//     });
// }

// // Очистить всё хранилище (для тестов)
// export function clearAllClients() {
//     return new Promise((resolve, reject) => {
//         if (!db) {
//             reject(new Error('База данных не инициализирована'));
//             return;
//         }

//         const transaction = db.transaction([STORE_NAME], 'readwrite');
//         const store = transaction.objectStore(STORE_NAME);
//         const request = store.clear();

//         request.onsuccess = function() {
//             console.log('Все клиенты удалены');
//             resolve();
//         };

//         request.onerror = function(event) {
//             console.error('Ошибка очистки:', event.target.error);
//             reject(event.target.error);
//         };
//     });
// }

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

// // Обновить клиента
// export function updateClient(id, data) {
//     return new Promise((resolve, reject) => {
//         if (!db) {
//             reject(new Error('База данных не инициализирована'));
//             return;
//         }

//         const transaction = db.transaction([STORE_NAME], 'readwrite');
//         const store = transaction.objectStore(STORE_NAME);
        
//         // Сначала получаем существующую запись
//         const getRequest = store.get(id);
        
//         getRequest.onsuccess = function(event) {
//             const client = event.target.result;
//             if (!client) {
//                 reject(new Error('Клиент не найден'));
//                 return;
//             }
            
//             // Обновляем поля
//             const updatedClient = {
//                 ...client,
//                 ...data,
//                 updated_at: new Date().toISOString()
//             };
            
//             // Сохраняем
//             const request = store.put(updatedClient);
            
//             request.onsuccess = function() {
//                 console.log('✅ Клиент обновлён в БД');
//                 resolve(id);
//             };
            
//             request.onerror = function(event) {
//                 reject(event.target.error);
//             };
//         };
        
//         getRequest.onerror = function(event) {
//             reject(event.target.error);
//         };
//     });
// }

// === УНИВЕРСАЛЬНЫЕ ФУНКЦИИ ===

// Добавить запись в любую таблицу
export function addItem(storeName, item) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.add(item);

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Получить все записи из таблицы  
export function getAllItems(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.getAll();

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Получить одну запись по ID
export function getItemById(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        const request = store.get(id);

        request.onsuccess = (e) => resolve(e.target.result);
        request.onerror = (e) => reject(e.target.error);
    });
}

// Обновить запись
export function updateItem(storeName, id, data) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);

        // Сначала получаем старую запись, чтобы сохранить id
        const getRequest = store.get(id);

        getRequest.onsuccess = function(event) {
            const existing = event.target.result;
            if (!existing) {
                reject(new Error('Запись не найдена'));
                return;
            }

            const updated = { ...existing, ...data, id };
            const request = store.put(updated);

            request.onsuccess = () => resolve(id);
            request.onerror = (e) => reject(e.target.error);
        };

        getRequest.onerror = (e) => reject(e.target.error);
    });
}

// Удалить запись
export function deleteItem(storeName, id) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }

        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.delete(id);

        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ТОВАРОВ ===

// Генерация SKU: первые 2 буквы категории + "-" + id
export function generateSKU(category, id = null) {
    // Берём первые 2 символа, удаляем пробелы, приводим к верхнему регистру
    const prefix = (category || '').trim().substring(0, 2).toUpperCase();
    
    if (id) {
        return `${prefix}-${id}`;
    }
    
    // Если id ещё нет (при создании), возвращаем шаблон
    // Реальный SKU установим после получения autoIncrement id
    return `${prefix}-NEW`;
}

// Создать товар с автогенерацией SKU
export async function createProduct(data) {
    // Генерируем временный SKU для валидации (если нужно)
    const tempSKU = generateSKU(data.category);
    
    // Создаём объект товара
    const product = {
        category: data.category || '',
        name: data.name || '',
        description: data.description || '',
        price: parseFloat(data.price) || 0,
        quantity: parseInt(data.quantity) || 0,
        is_active: data.is_active !== false, // по умолчанию true
        sku: tempSKU, // будет обновлён после получения id
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };

    // Добавляем в БД
    const id = await addItem('products', product);
    
    // Теперь, когда есть id, обновляем SKU
    const finalSKU = generateSKU(data.category, id);
    await updateItem('products', id, { sku: finalSKU });
    
    return id;
}

// Получить все активные товары
export function getActiveProducts() {
    return new Promise((resolve, reject) => {
        getAllItems('products')
            .then(products => {
                const active = products.filter(p => p.is_active);
                resolve(active);
            })
            .catch(reject);
    });
}

// Экспорт/импорт для бэкапа (универсальный)
export function exportStoreToJSON(storeName) {
    return new Promise((resolve, reject) => {
        getAllItems(storeName)
            .then(data => {
                resolve(JSON.stringify({
                    store: storeName,
                    timestamp: new Date().toISOString(),
                    items: data
                }));
            })
            .catch(reject);
    });
}

// Экспорт всех данных для полного бэкапа
export function exportAllData() {
    return Promise.all([
        exportStoreToJSON('clients'),
        exportStoreToJSON('products')
        // Добавьте новые таблицы здесь
    ]).then(results => JSON.stringify({
        version: DB_VERSION,
        exported_at: new Date().toISOString(),
        stores: results.map(r => JSON.parse(r))
    }));
}

// Импорт данных (универсальный)
export function importStoreFromJSON(storeName, jsonData) {
    return new Promise(async (resolve, reject) => {
        try {
            const data = JSON.parse(jsonData);
            await clearStore(storeName);
            
            const transaction = db.transaction([storeName], 'readwrite');
            const store = transaction.objectStore(storeName);
            
            for (const item of data.items) {
                store.add(item);
            }
            
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        } catch (error) {
            reject(error);
        }
    });
}

// Очистить таблицу
export function clearStore(storeName) {
    return new Promise((resolve, reject) => {
        if (!db) {
            reject(new Error('База данных не инициализирована'));
            return;
        }
        const transaction = db.transaction([storeName], 'readwrite');
        const store = transaction.objectStore(storeName);
        const request = store.clear();
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

export function getAllClients() {
    return getAllItems('clients');
}

export function createClient(name, phone, email) {
    const client = {
        name: name,
        phone: phone || '',
        email: email || '',
        created_at: new Date().toISOString()
    };
    return addItem('clients', client);
}

export function deleteClient(id) {
    return deleteItem('clients', id);
}

export function updateClient(id, data) {
    return updateItem('clients', id, {
        ...data,
        updated_at: new Date().toISOString()
    });
}

export function getClientById(id) {
    return getItemById('clients', id);
}

export function clearAllClients() {
    return clearStore('clients');
}
