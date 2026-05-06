// resources/js/db_indexeddb.js

const DB_NAME = 'CRM_Database';
const DB_VERSION = 5; // Увеличиваем версию для добавления новых хранилищ!
const STORE_NAME = 'clients'; 
let db = null;

// Инициализация БД с поддержкой нескольких таблиц
export function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = function(event) {
            const database = event.target.result;

            // 1. Clients
            if (!database.objectStoreNames.contains('clients')) {
                const store = database.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
                store.createIndex('name', 'name', { unique: false });
            }

            // 2. Products
            if (!database.objectStoreNames.contains('products')) {
                const store = database.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                store.createIndex('category', 'category', { unique: false });
                store.createIndex('sku', 'sku', { unique: true });
            }

            // 3. Tickets
            if (!database.objectStoreNames.contains('tickets')) {
                const store = database.createObjectStore('tickets', { keyPath: 'id', autoIncrement: true });
                store.createIndex('client_id', 'client_id', { unique: false });
                store.createIndex('status', 'status', { unique: false });
                store.createIndex('type', 'type', { unique: false });
                console.log('✅ Store "tickets" created');
            }

            // === Продажи (единичные сделки) ===
            if (!database.objectStoreNames.contains('sales')) {
                const salesStore = database.createObjectStore('sales', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                salesStore.createIndex('product_id', 'product_id', { unique: false });
                salesStore.createIndex('client_id', 'client_id', { unique: false });
                salesStore.createIndex('transaction_date', 'transaction_date', { unique: false });
                salesStore.createIndex('type', 'type', { unique: false }); // sale, writeoff, restock
                salesStore.createIndex('is_bulk', 'is_bulk', { unique: false });
                console.log('✅ Store "sales" created');
            }

            // НОВОЕ: Пакетные корректировки (списание/поступление за период) ===
            if (!database.objectStoreNames.contains('bulk_adjustments')) {
                const bulkStore = database.createObjectStore('bulk_adjustments', { 
                    keyPath: 'id', 
                    autoIncrement: true 
                });
                bulkStore.createIndex('product_id', 'product_id', { unique: false });
                bulkStore.createIndex('period_start', 'period_start', { unique: false });
                bulkStore.createIndex('period_end', 'period_end', { unique: false });
                bulkStore.createIndex('type', 'type', { unique: false }); // writeoff, restock
                console.log('✅ Store "bulk_adjustments" created');
            }
        };


        request.onsuccess = (e) => { db = e.target.result; resolve(db); };
        request.onerror = (e) => reject(e.target.error);
    });
}


// Получить экземпляр БД
export function getDbInstance() {
    return db;
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

        // Сначала необходимо получить старую запись, чтобы сохранить id
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
    // Реальный SKU будет установлен после получения autoIncrement id
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
        getAllItems('clients'),
        getAllItems('products'),
        getAllItems('tickets'),
        getAllItems('sales'),
        getAllItems('bulk_adjustments')
    ]).then(([clients, products, tickets, sales, bulk]) => JSON.stringify({
        version: DB_VERSION,
        exported_at: new Date().toISOString(),
        stores: [
            { store: 'clients', items: clients },
            { store: 'products', items: products },
            { store: 'tickets', items: tickets },
            { store: 'sales', items: sales },
            { store: 'bulk_adjustments', items: bulk }
        ]
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
            for (const item of data.items) store.add(item);
            transaction.oncomplete = () => resolve();
            transaction.onerror = (e) => reject(e.target.error);
        } catch (error) { reject(error); }
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

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ПРОДАЖ ===

// Создать единичную сделку
export async function createSale(data) {
    const sale = {
        client_id: data.client_id === 'empty' ? null : parseInt(data.client_id),
        product_id: parseInt(data.product_id),
        quantity: parseInt(data.quantity),
        unit_price: parseFloat(data.unit_price),
        total_amount: parseFloat(data.quantity) * parseFloat(data.unit_price),
        transaction_date: data.transaction_date || new Date().toISOString(),
        comment: data.comment || '',
        type: data.type || 'sale', // sale, writeoff, restock
        is_bulk: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    const id = await addItem('sales', sale);
    
    // Обновляем остаток товара
    await updateProductStock(data.product_id, data.type === 'restock' ? +sale.quantity : -sale.quantity);
    
    return id;
}

// Создать пакетную корректировку
export async function createBulkAdjustment(data) {
    const adjustment = {
        product_id: parseInt(data.product_id),
        quantity: parseInt(data.quantity),
        period_start: data.period_start,
        period_end: data.period_end,
        type: data.type, // writeoff, restock
        comment: data.comment || '',
        registered_at: new Date().toISOString()
    };
    
    const id = await addItem('bulk_adjustments', adjustment);
    
    // Обновляем остаток товара
    await updateProductStock(data.product_id, data.type === 'restock' ? +adjustment.quantity : -adjustment.quantity);
    
    return id;
}

// Обновить остаток товара (вспомогательная функция)
async function updateProductStock(productId, quantityChange) {
    const product = await getItemById('products', productId);
    if (!product) return;
    
    const newQuantity = Math.max(0, (product.quantity || 0) + quantityChange);
    
    await updateItem('products', productId, {
        quantity: newQuantity,
        updated_at: new Date().toISOString()
    });
}

// Получить все продажи с пагинацией
export async function getSalesPaginated(page = 1, pageSize = 10, filters = {}) {
    const allSales = await getAllItems('sales');
    const allBulk = await getAllItems('bulk_adjustments');
    
    // Объединяем и нормализуем данные для отображения
    let combined = [
        ...allSales.map(s => ({ ...s, source: 'single', tag: s.type })),
        ...allBulk.map(b => ({ 
            ...b, 
            source: 'bulk', 
            tag: b.type,
            transaction_date: b.period_start,
            total_amount: null,
            unit_price: null,
            client_id: null
        }))
    ];
    
    // Применяем фильтры
    if (filters.type) {
        combined = combined.filter(item => item.tag === filters.type);
    }
    if (filters.product_id) {
        combined = combined.filter(item => item.product_id === parseInt(filters.product_id));
    }
    if (filters.date_from) {
        combined = combined.filter(item => new Date(item.transaction_date) >= new Date(filters.date_from));
    }
    if (filters.date_to) {
        combined = combined.filter(item => new Date(item.transaction_date) <= new Date(filters.date_to));
    }
    
    // Сортировка по дате (новые сверху)
    combined.sort((a, b) => new Date(b.transaction_date) - new Date(a.transaction_date));
    
    // Пагинация
    const total = combined.length;
    const start = (page - 1) * pageSize;
    const items = combined.slice(start, start + pageSize);
    
    return {
        items,
        pagination: {
            current_page: page,
            page_size: pageSize,
            total_items: total,
            total_pages: Math.ceil(total / pageSize)
        }
    };
}

// Получить товары для выпадающего списка (без описания)
export async function getProductsForDropdown() {
    const products = await getAllItems('products');
    return products.map(p => ({
        id: p.id,
        name: p.name,
        category: p.category,
        sku: p.sku,
        price: p.price,
        quantity: p.quantity,
        is_active: p.is_active
    }));
}
