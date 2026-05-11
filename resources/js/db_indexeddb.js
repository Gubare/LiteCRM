// resources/js/db_indexeddb.js
import { showErrorWithRetry, executeWithRetry } from './error-handler.js';
import { logAction } from './logger.js';
const DB_NAME = 'CRM_Database';
const DB_VERSION = 6; // Увеличиваем версию для добавления новых хранилищ!
const STORE_NAME = 'clients'; 
let db = null;

// Инициализация БД с поддержкой нескольких таблиц
export function initDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            const oldVersion = event.oldVersion;
            
            console.log(`🔄 DB upgrade from ${oldVersion} to ${DB_VERSION}`);
            
            // Создаём хранилища, если их нет
            if (!db.objectStoreNames.contains('clients')) {
                db.createObjectStore('clients', { keyPath: 'id', autoIncrement: true });
                console.log('✅ Store "clients" created');
            }
            
            if (!db.objectStoreNames.contains('products')) {
                const products = db.createObjectStore('products', { keyPath: 'id', autoIncrement: true });
                products.createIndex('sku', 'sku', { unique: true });
                console.log('✅ Store "products" created');
            }
            
            if (!db.objectStoreNames.contains('tickets')) {
                db.createObjectStore('tickets', { keyPath: 'id', autoIncrement: true });
                console.log('✅ Store "tickets" created');
            }
            
            if (!db.objectStoreNames.contains('sales')) {
                db.createObjectStore('sales', { keyPath: 'id', autoIncrement: true });
                console.log('✅ Store "sales" created');
            }
            
            if (!db.objectStoreNames.contains('bulk_adjustments')) {
                db.createObjectStore('bulk_adjustments', { keyPath: 'id', autoIncrement: true });
                console.log('✅ Store "bulk_adjustments" created');
            }
            
            if (!db.objectStoreNames.contains('calendar_notes')) {
                const notes = db.createObjectStore('calendar_notes', { keyPath: 'id', autoIncrement: true });
                notes.createIndex('date', 'date', { unique: false });
                console.log('✅ Store "calendar_notes" created');
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
export async function addItem(storeName, itemData) {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        const req = store.add(itemData);
        
        req.onsuccess = () => {
            const newId = req.result;
            // Логируем создание
            logAction('create', storeName, newId, itemData);
            resolve(newId);
        };
        req.onerror = () => reject(req.error);
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
            console.error('❌ Database not initialized in getItemById');
            reject(new Error('База данных не инициализирована'));
            return;
        }

        console.log(`🔍 getItemById: store=${storeName}, id=${id}, type=${typeof id}`);

        const transaction = db.transaction([storeName], 'readonly');
        const store = transaction.objectStore(storeName);
        
        // Пробуем получить по ID (и как число, и как строку)
        const request = store.get(id);

        request.onsuccess = function(event) {
            let result = event.target.result;
            console.log('📦 getItemById result:', result);
            
            // Если не нашли по прямому ID, ищем перебором
            if (!result) {
                console.log(`⚠️ Not found by direct get(), trying getAll...`);
                getAllItems(storeName).then(items => {
                    // Ищем с приведением типов
                    const found = items.find(item => {
                        const itemId = item.id;
                        return itemId == id || itemId === String(id) || String(itemId) === String(id);
                    });
                    console.log('🔍 Found by getAll:', found);
                    resolve(found);
                }).catch(reject);
            } else {
                resolve(result);
            }
        };

        request.onerror = function(event) {
            console.error('❌ getItemById error:', event.target.error);
            reject(event.target.error);
        };
    });
}
// Обновить запись
export async function updateItem(storeName, id, updates) {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Получаем старую версию для лога
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const oldData = getReq.result || {};
            const newData = { ...oldData, ...updates, id, updated_at: new Date().toISOString() };
            
            const putReq = store.put(newData);
            putReq.onsuccess = () => {
                // Логируем изменение (сохраняем новые данные)
                logAction('update', storeName, id, newData);
                resolve();
            };
            putReq.onerror = () => reject(putReq.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}

// Удалить запись
export async function deleteItem(storeName, id) {
    const db = await getDbInstance();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([storeName], 'readwrite');
        const store = tx.objectStore(storeName);
        
        // Сначала получаем данные перед удалением
        const getReq = store.get(id);
        getReq.onsuccess = () => {
            const deletedData = getReq.result;
            
            const req = store.delete(id);
            req.onsuccess = () => {
                // Логируем с полными данными удалённой записи
                logAction('delete', storeName, id, deletedData, {
                    deletedAt: new Date().toISOString(),
                    reason: 'User initiated deletion'
                });
                resolve();
            };
            req.onerror = () => reject(req.error);
        };
        getReq.onerror = () => reject(getReq.error);
    });
}// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ТОВАРОВ ===

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
        getAllItems('bulk_adjustments'),
        getAllItems('calendar_notes')
    ]).then(([clients, products, tickets, sales, bulk, notes]) => JSON.stringify({
        version: DB_VERSION,
        exported_at: new Date().toISOString(),
        stores: [
            { store: 'clients', items: clients },
            { store: 'products', items: products },
            { store: 'tickets', items: tickets },
            { store: 'sales', items: sales },
            { store: 'bulk_adjustments', items: bulk },
            { store: 'calendar_notes', items: notes } 
        ]
    }))
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

export async function createClient(name, phone, email) {
    const client = {
        name,
        phone: phone || '',
        email: email || '',
        total_spent: 0,       
        purchase_count: 0,   
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    return await addItem('clients', client);
}

// Функция обновления метрик клиента (вызывается из sales.js)
export async function updateClientMetrics(clientId, saleAmount, countChange = 1) {
    // Игнорируем пустые или служебные ID
    if (!clientId || clientId === 'empty' || clientId === 'new') return;
    
    const id = parseInt(clientId);
    const client = await getItemById('clients', id);
    if (!client) return;

    await updateItem('clients', id, {
        ...client,
        total_spent: (client.total_spent || 0) + saleAmount,
        purchase_count: (client.purchase_count || 0) + countChange,
        updated_at: new Date().toISOString()
    });
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
export async function createSale(data, retry = true) {
    console.log('💰 Creating sale:', data);
    
    try {
        // Проверяем существование товара ПЕРЕД созданием продажи
        const product = await getItemById('products', parseInt(data.product_id));
        
        if (!product) {
            const errorMsg = `Товар с ID ${data.product_id} не найден в базе. ` +
                           `Возможно, он был удалён. Проверьте таблицу товаров.`;
            
            if (retry) {
                // Пробуем показать ошибку с возможностью повтора
                throw new Error(errorMsg);
            } else {
                // Если уже была попытка — просто выбрасываем
                throw new Error(errorMsg);
            }
        }
        
        // Проверяем, достаточно ли товара на складе (для продаж и списаний)
        if (data.type === 'sale' || data.type === 'writeoff') {
            const requestedQty = parseInt(data.quantity);
            const availableQty = product.quantity || 0;
            
            if (requestedQty > availableQty) {
                throw new Error(
                    `Недостаточно товара "${product.name}" на складе. ` +
                    `Запрошено: ${requestedQty}, доступно: ${availableQty}`
                );
            }
        }
        
        const sale = {
            client_id: data.client_id === 'empty' ? null : parseInt(data.client_id),
            product_id: parseInt(data.product_id),
            quantity: parseInt(data.quantity),
            unit_price: parseFloat(data.unit_price),
            total_amount: parseFloat(data.quantity) * parseFloat(data.unit_price),
            transaction_date: data.transaction_date || new Date().toISOString(),
            comment: data.comment || '',
            type: data.type || 'sale',
            is_bulk: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        };
        
        // Создаём запись о продаже
        const id = await addItem('sales', sale);
        console.log('✅ Sale created with id:', id);
        
        // Обновляем остаток товара
        const quantityChange = data.type === 'restock' 
            ? +sale.quantity
            : -sale.quantity;
        
        const stockUpdated = await updateProductStock(
            parseInt(data.product_id),
            quantityChange
        );
        
        if (!stockUpdated) {
            // Откатываем продажу, если не удалось обновить остаток
            await deleteItem('sales', id);
            throw new Error('Не удалось обновить остаток товара. Продажа отменена.');
        }
        
        return id;
        
    } catch (error) {
        console.error('❌ Error in createSale:', error);
        
        if (retry) {
            // Показываем окно с ошибкой и возможностью повтора
            // Но не бесконечно — только один раз
            await showErrorWithRetry(
                error.message,
                () => createSale(data, false) // Повтор без показа окна
            );
        }
        
        throw error;
    }
}

// Создать пакетную корректировку
export async function createBulkAdjustment(data, retry = true) {
    console.log('📦 Creating bulk adjustment:', data);
    
    try {
        // Проверяем существование товара
        const product = await getItemById('products', parseInt(data.product_id));
        
        if (!product) {
            throw new Error(`Товар с ID ${data.product_id} не найден в базе.`);
        }
        
        // Для списаний проверяем остаток
        if (data.type === 'writeoff') {
            const requestedQty = parseInt(data.quantity);
            const availableQty = product.quantity || 0;
            
            if (requestedQty > availableQty) {
                throw new Error(
                    `Недостаточно товара "${product.name}" для списания. ` +
                    `Запрошено: ${requestedQty}, доступно: ${availableQty}`
                );
            }
        }
        
        const adjustment = {
            product_id: parseInt(data.product_id),
            quantity: parseInt(data.quantity),
            period_start: data.period_start,
            period_end: data.period_end,
            type: data.type,
            comment: data.comment || '',
            registered_at: new Date().toISOString()
        };
        
        const id = await addItem('bulk_adjustments', adjustment);
        console.log('✅ Bulk adjustment created with id:', id);
        
        // Обновляем остаток
        const quantityChange = data.type === 'restock' 
            ? +adjustment.quantity 
            : -adjustment.quantity;
        
        const stockUpdated = await updateProductStock(
            parseInt(data.product_id), 
            quantityChange
        );        
        if (!stockUpdated) {
            await deleteItem('bulk_adjustments', id);
            throw new Error('Не удалось обновить остаток товара. Корректировка отменена.');
        }
        
        return id;
        
    } catch (error) {
        console.error('❌ Error in createBulkAdjustment:', error);
        
        if (retry) {
            await showErrorWithRetry(
                error.message,
                () => createBulkAdjustment(data, false)
            );
        }
        
        throw error;
    }
}

// Обновить остаток товара (вспомогательная функция)
async function updateProductStock(productId, quantityChange) {
    // 🔥 ВАЖНО: Приводим к числу!
    const numericId = typeof productId === 'number' ? productId : parseInt(productId);
    
    console.log(`🔄 Updating stock: product_id=${numericId} (was ${productId}), change=${quantityChange}`);
    
    if (!db) {
        console.error('❌ Database not initialized in updateProductStock');
        return false;
    }
    
    try {
        // Ищем по ЧИСЛУ, не по строке
        const product = await getItemById('products', numericId);
        console.log('📦 Current product:', product);
        
        if (!product) {
            console.error(`❌ Product with id=${numericId} not found`);
            return false;
        }
        
        const currentQty = product.quantity || 0;
        const newQuantity = Math.max(0, currentQty + quantityChange);
        
        console.log(`📊 Quantity: ${currentQty} ${quantityChange >= 0 ? '+' : ''}${quantityChange} = ${newQuantity}`);
        
        await updateItem('products', numericId, {
            ...product,
            quantity: newQuantity,
            updated_at: new Date().toISOString()
        });
        
        console.log('✅ Product stock updated successfully');
        return true;
        
    } catch (error) {
        console.error('❌ Error in updateProductStock:', error);
        return false;
    }
}
// Получить все продажи с пагинацией
export async function getSalesPaginated(page = 1, pageSize = 10, filters = {}, sortBy = 'date_desc', recordType = 'sales') {
    let allSales = [];
    let allBulk = [];
    
    // 🔥 Загружаем только нужную таблицу (или обе, если нужно)
    if (recordType === 'sales' || recordType === 'all') {
        allSales = await getAllItems('sales');
    }
    if (recordType === 'bulk' || recordType === 'all') {
        allBulk = await getAllItems('bulk_adjustments');
    }
    
    // Объединяем с меткой источника
    let combined = [];
    
    if (recordType === 'sales' || recordType === 'all') {
        combined = combined.concat(allSales.map(s => ({ ...s, source: 'single', tag: s.type })));
    }
    
    if (recordType === 'bulk' || recordType === 'all') {
        combined = combined.concat(allBulk.map(b => ({ 
            ...b, 
            source: 'bulk', 
            tag: b.type,
            transaction_date: b.period_start,
            total_amount: null,
            unit_price: null,
            client_id: null
        })));
    }
    
    // Применяем фильтры (как было раньше)
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
    
    // Сортировка
    combined.sort((a, b) => {
        switch (sortBy) {
            case 'date_asc':
                return new Date(a.transaction_date) - new Date(b.transaction_date);
            case 'amount_desc':
                return (b.total_amount || 0) - (a.total_amount || 0);
            case 'amount_asc':
                return (a.total_amount || 0) - (b.total_amount || 0);
            case 'date_desc':
            default:
                return new Date(b.transaction_date) - new Date(a.transaction_date);
        }
    });
    
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
