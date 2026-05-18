// resources/js/db.js
// ЕДИНАЯ ТОЧКА ВХОДА ДЛЯ ВСЕХ ОПЕРАЦИЙ С БД (ГЛАВНЫЙ АДАПТЕР)

import { getDBType, DB_TYPES } from './db_config.js';
import * as indexedDBAdapter from './db_indexeddb.js';
import * as sqliteAdapter from './db_sqlite.js';

// Кэш экземпляра адаптера
let activeAdapter = null;
let initializationPromise = null;

// Получить активный адаптер (ленивая инициализация)
function getAdapter() {
    if (activeAdapter) return activeAdapter;
    
    const dbType = getDBType();
    console.log(`🔌 Using database adapter: ${dbType}`);
    
    switch (dbType) {
        case DB_TYPES.SQLITE:
            activeAdapter = sqliteAdapter;
            break;
        case DB_TYPES.INDEXEDDB:
        default:
            activeAdapter = indexedDBAdapter;
            break;
    }
    
    return activeAdapter;
}

// === ИНИЦИАЛИЗАЦИЯ ===

// Инициализация БД (вызывается один раз при старте)
export async function initDatabase() {
    if (initializationPromise) {
        return initializationPromise; 
    }
    
    const adapter = getAdapter();
    
    // Отключаем автосохранение на время инициализации
    if (adapter.disableAutoSave) {
        adapter.disableAutoSave();
    }
    
    initializationPromise = adapter.initDatabase();
    
    try {
        const result = await initializationPromise;
        
        // Включаем автосохранение после инициализации
        if (adapter.enableAutoSave) {
            setTimeout(() => adapter.enableAutoSave(), 1000);
        }
        
        return result;
    } catch (error) {
        initializationPromise = null; // Сбрасываем при ошибке
        throw error;
    }
}

// Получить экземпляр БД (для прямого доступа, если нужно)
export function getDbInstance() {
    const adapter = getAdapter();
    return adapter.getDbInstance?.() || null;
}

// === УНИВЕРСАЛЬНЫЕ ОПЕРАЦИИ (CRUD) ===

// Добавить запись
export async function addItem(storeName, itemData) {
    const adapter = getAdapter();
    return await adapter.addItem(storeName, itemData);
}

// Получить все записи
export async function getAllItems(storeName) {
    const adapter = getAdapter();
    return await adapter.getAllItems(storeName);
}

// Получить запись по ID
export async function getItemById(storeName, id) {
    const adapter = getAdapter();
    return await adapter.getItemById(storeName, id);
}

// Обновить запись
export async function updateItem(storeName, id, updates) {
    const adapter = getAdapter();
    return await adapter.updateItem(storeName, id, updates);
}

// Удалить запись
export async function deleteItem(storeName, id) {
    const adapter = getAdapter();
    return await adapter.deleteItem(storeName, id);
}

// Очистить хранилище
export async function clearStore(storeName) {
    const adapter = getAdapter();
    return await adapter.clearStore(storeName);
}

// === ЭКСПОРТ/ИМПОРТ ===

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

// Экспорт данных в JSON для сохранения в файл
export function exportToJSON() {
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('Database not initialized');
            reject(new Error('База данных не инициализирована'));
            return;
        }
        
        console.log('Exporting data to JSON...');
        
        const transaction = db.transaction([STORE_NAME], 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        
        request.onsuccess = function(event) {
            const data = {
                version: DB_VERSION,
                timestamp: new Date().toISOString(),
                clients: event.target.result
            };
            
            console.log('Exported', data.clients.length, 'clients to JSON');
            console.log('Data:', JSON.stringify(data, null, 2));
            
            resolve(JSON.stringify(data));
        };
        
        request.onerror = function(event) {
            console.error('Export error:', event.target.error);
            reject(event.target.error);
        };
    });
}

// Экспорт всех данных (универсальный формат)
export async function exportAllData() {
    const adapter = getAdapter();
    return await adapter.exportAllData();
}

// Импорт данных (универсальный формат)
export async function importAllData(jsonData) {
    const adapter = getAdapter();
    return await adapter.importAllData(jsonData);
}

// Экспорт конкретного хранилища
export async function exportStoreToJSON(storeName) {
    const adapter = getAdapter();
    return await adapter.exportStoreToJSON(storeName);
}

// Импорт в конкретное хранилище
export async function importStoreFromJSON(storeName, jsonData) {
    const adapter = getAdapter();
    return await adapter.importStoreFromJSON(storeName, jsonData);
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

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ КЛИЕНТОВ ===

export function getAllClients() {
    const adapter = getAdapter();
    return adapter.getAllClients();
}

export async function createClient(name, phone, email) {
    const adapter = getAdapter();
    return await adapter.createClient(name, phone, email);
}

export async function updateClientMetrics(clientId, saleAmount, countChange = 1) {
    const adapter = getAdapter();
    return await adapter.updateClientMetrics(clientId, saleAmount, countChange);
}

export function deleteClient(id) {
    const adapter = getAdapter();
    return adapter.deleteClient(id);
}

export function updateClient(id, data) {
    const adapter = getAdapter();
    return adapter.updateClient(id, data);
}

export function getClientById(id) {
    const adapter = getAdapter();
    return adapter.getClientById(id);
}

export function clearAllClients() {
    const adapter = getAdapter();
    return adapter.clearAllClients();
}

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ТОВАРОВ ===

export function generateSKU(category, id = null) {
    // Эта функция чистая, не зависит от БД
    const prefix = (category || '').trim().substring(0, 2).toUpperCase();
    return id ? `${prefix}-${id}` : `${prefix}-NEW`;
}

export async function createProduct(data) {
    const adapter = getAdapter();
    return await adapter.createProduct(data);
}

export function getActiveProducts() {
    const adapter = getAdapter();
    return adapter.getActiveProducts();
}

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ПРОДАЖ ===

export async function createSale(data, retry = true) {
    const adapter = getAdapter();
    return await adapter.createSale(data, retry);
}

export async function createBulkAdjustment(data, retry = true) {
    const adapter = getAdapter();
    return await adapter.createBulkAdjustment(data, retry);
}

export async function getSalesPaginated(page = 1, pageSize = 10, filters = {}, sortBy = 'date_desc', recordType = 'sales') {
    const adapter = getAdapter();
    return await adapter.getSalesPaginated(page, pageSize, filters, sortBy, recordType);
}

export async function getProductsForDropdown() {
    const adapter = getAdapter();
    return await adapter.getProductsForDropdown();
}

// === УТИЛИТЫ ===

// Переключить тип БД на лету (для тестирования)
export async function switchDBType(newType) {
    const { configureDB, DB_TYPES } = await import('./db_config.js');
    
    if (!Object.values(DB_TYPES).includes(newType)) {
        throw new Error(`Unsupported DB type: ${newType}`);
    }
    
    // Сохраняем данные перед переключением
    const currentData = await exportAllData();
    
    // Меняем конфигурацию
    configureDB({ type: newType });
    
    // Сбрасываем кэш адаптера
    activeAdapter = null;
    
    // Инициализируем новую БД
    await initDatabase();
    
    // Восстанавливаем данные (опционально)
    if (currentData) {
        await importAllData(currentData);
    }
    
    console.log(`✅ Switched to ${newType}`);
    return newType;
}

// Получить статистику по БД
export async function getDBStats() {
    const adapter = getAdapter();
    const stats = {
        type: getDBType(),
        stores: {}
    };
    
    const stores = ['clients', 'products', 'sales', 'tickets', 'bulk_adjustments', 'calendar_notes'];
    for (const store of stores) {
        try {
            const items = await getAllItems(store);
            stats.stores[store] = { count: items.length };
        } catch (e) {
            stats.stores[store] = { error: e.message };
        }
    }
    
    return stats;
}