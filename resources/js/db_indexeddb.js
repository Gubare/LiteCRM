// // resources/js/db_indexeddb.js
// import { showErrorWithRetry, executeWithRetry } from './error-handler.js';
// import { logAction } from './logger.js';
// const DB_NAME = 'CRM_Database';
// const DB_VERSION = 6;
// let dbInstance = null;

// // Инициализация
// export async function initDatabase() {
//     return await getDbInstance();
// }

// export async function getDbInstance() {
//     if (dbInstance) return dbInstance;
    
//     return new Promise((resolve, reject) => {
//         const request = indexedDB.open(DB_NAME, DB_VERSION);
        
//         request.onupgradeneeded = (event) => {
//             const db = event.target.result;
//             const stores = ['clients', 'products', 'sales', 'tickets', 'bulk_adjustments', 'calendar_notes'];
            
//             stores.forEach(storeName => {
//                 if (!db.objectStoreNames.contains(storeName)) {
//                     const store = db.createObjectStore(storeName, { 
//                         keyPath: 'id', 
//                         autoIncrement: true 
//                     });
//                     // Индексы
//                     if (storeName === 'clients') {
//                         store.createIndex('name', 'name', { unique: false });
//                         store.createIndex('phone', 'phone', { unique: false });
//                     } else if (storeName === 'products') {
//                         store.createIndex('sku', 'sku', { unique: true });
//                     } else if (storeName === 'sales') {
//                         store.createIndex('client_id', 'client_id', { unique: false });
//                         store.createIndex('transaction_date', 'transaction_date', { unique: false });
//                     } else if (storeName === 'calendar_notes') {
//                         store.createIndex('date', 'date', { unique: false });
//                     }
//                     console.log(`✅ Store "${storeName}" created`);
//                 }
//             });
//         };
        
//         request.onsuccess = () => {
//             dbInstance = request.result;
//             resolve(dbInstance);
//         };
        
//         request.onerror = () => reject(request.error);
//     });
// }

// // === CRUD ===

// export async function addItem(storeName, itemData) {
//     const db = await getDbInstance();
//     return new Promise((resolve, reject) => {
//         const tx = db.transaction([storeName], 'readwrite');
//         const store = tx.objectStore(storeName);
//         const req = store.add(itemData);
        
//         req.onsuccess = () => {
//             logAction('create', storeName, req.result, itemData);
//             resolve(req.result);
//         };
//         req.onerror = () => reject(req.error);
//     });
// }

// export async function getAllItems(storeName) {
//     const db = await getDbInstance();
//     return new Promise((resolve, reject) => {
//         if (!db.objectStoreNames.contains(storeName)) {
//             console.warn(`⚠️ Store "${storeName}" not found`);
//             resolve([]);
//             return;
//         }
        
//         const tx = db.transaction([storeName], 'readonly');
//         const store = tx.objectStore(storeName);
//         const req = store.getAll();
        
//         req.onsuccess = () => resolve(req.result || []);
//         req.onerror = () => reject(req.error);
//     });
// }

// export async function getItemById(storeName, id) {
//     const db = await getDbInstance();
//     return new Promise((resolve, reject) => {
//         if (!db.objectStoreNames.contains(storeName)) {
//             resolve(null);
//             return;
//         }
        
//         const tx = db.transaction([storeName], 'readonly');
//         const store = tx.objectStore(storeName);
//         const req = store.get(id);
        
//         req.onsuccess = () => resolve(req.result || null);
//         req.onerror = () => reject(req.error);
//     });
// }

// export async function updateItem(storeName, id, updates) {
//     const db = await getDbInstance();
//     return new Promise(async (resolve, reject) => {
//         const tx = db.transaction([storeName], 'readwrite');
//         const store = tx.objectStore(storeName);
        
//         const getReq = store.get(id);
//         getReq.onsuccess = async () => {
//             const oldData = getReq.result || {};
//             const newData = { ...oldData, ...updates, id, updated_at: new Date().toISOString() };
            
//             const putReq = store.put(newData);
//             putReq.onsuccess = () => {
//                 logAction('update', storeName, id, newData);
//                 resolve();
//             };
//             putReq.onerror = () => reject(putReq.error);
//         };
//         getReq.onerror = () => reject(getReq.error);
//     });
// }

// export async function deleteItem(storeName, id) {
//     const db = await getDbInstance();
//     return new Promise(async (resolve, reject) => {
//         const tx = db.transaction([storeName], 'readwrite');
//         const store = tx.objectStore(storeName);
        
//         const getReq = store.get(id);
//         getReq.onsuccess = async () => {
//             const deletedData = getReq.result;
//             const req = store.delete(id);
//             req.onsuccess = () => {
//                 logAction('delete', storeName, id, deletedData);
//                 resolve();
//             };
//             req.onerror = () => reject(req.error);
//         };
//         getReq.onerror = () => reject(getReq.error);
//     });
// }

// export async function clearStore(storeName) {
//     const db = await getDbInstance();
//     return new Promise((resolve, reject) => {
//         const tx = db.transaction([storeName], 'readwrite');
//         const store = tx.objectStore(storeName);
//         const req = store.clear();
//         req.onsuccess = () => resolve();
//         req.onerror = () => reject(req.error);
//     });
// }

// // === ЭКСПОРТ/ИМПОРТ ===

// export async function exportAllData() {
//     const stores = ['clients', 'products', 'sales', 'tickets', 'bulk_adjustments', 'calendar_notes'];
//     const result = {
//         version: DB_VERSION,
//         exported_at: new Date().toISOString(),
//         stores: []
//     };
    
//     for (const storeName of stores) {
//         try {
//             const items = await getAllItems(storeName);
//             result.stores.push({ store: storeName, items });
//         } catch (e) {
//             console.warn(`⚠️ Could not export ${storeName}:`, e);
//         }
//     }
    
//     return JSON.stringify(result, null, 2);
// }

// export async function importAllData(jsonData) {
//     const data = JSON.parse(jsonData);
    
//     for (const { store, items } of data.stores) {
//         await clearStore(store);
//         for (const item of items) {
//             // Удаляем id для autoIncrement
//             const { id, ...itemData } = item;
//             await addItem(store, itemData);
//         }
//     }
// }

// export async function exportStoreToJSON(storeName) {
//     const items = await getAllItems(storeName);
//     return JSON.stringify({
//         store: storeName,
//         timestamp: new Date().toISOString(),
//         items
//     });
// }

// export async function importStoreFromJSON(storeName, jsonData) {
//     const data = JSON.parse(jsonData);
//     await clearStore(storeName);
//     for (const item of data.items) {
//         const { id, ...itemData } = item;
//         await addItem(storeName, itemData);
//     }
// }

// // === СПЕЦИФИЧНЫЕ ФУНКЦИИ (оставляем как есть) ===

// export function getAllClients() { return getAllItems('clients'); }

// export async function createClient(name, phone, email) {
//     return await addItem('clients', {
//         name,
//         phone: phone || '',
//         email: email || '',
//         total_spent: 0,
//         purchase_count: 0,
//         created_at: new Date().toISOString(),
//         updated_at: new Date().toISOString()
//     });
// }

// export async function updateClientMetrics(clientId, saleAmount, countChange = 1) {
//     if (!clientId || clientId === 'empty' || clientId === 'new') return;
    
//     const id = parseInt(clientId);
//     const client = await getItemById('clients', id);
//     if (!client) return;
    
//     await updateItem('clients', id, {
//         ...client,
//         total_spent: (client.total_spent || 0) + saleAmount,
//         purchase_count: (client.purchase_count || 0) + countChange,
//         updated_at: new Date().toISOString()
//     });
// }

// export function deleteClient(id) { return deleteItem('clients', id); }
// export function updateClient(id, data) { return updateItem('clients', { ...data, updated_at: new Date().toISOString() }); }
// export function getClientById(id) { return getItemById('clients', id); }
// export function clearAllClients() { return clearStore('clients'); }


// // === СПЕЦИФИЧНЫЕ ФУНКЦИИ ДЛЯ ПРОДАЖ ===

// // Создать единичную сделку
// export async function createSale(data, retry = true) {
//     console.log('💰 Creating sale:', data);
    
//     try {
//         // Проверяем существование товара ПЕРЕД созданием продажи
//         const product = await getItemById('products', parseInt(data.product_id));
        
//         if (!product) {
//             const errorMsg = `Товар с ID ${data.product_id} не найден в базе. ` +
//                            `Возможно, он был удалён. Проверьте таблицу товаров.`;
            
//             if (retry) {
//                 // Пробуем показать ошибку с возможностью повтора
//                 throw new Error(errorMsg);
//             } else {
//                 // Если уже была попытка — просто выбрасываем
//                 throw new Error(errorMsg);
//             }
//         }
        
//         // Проверяем, достаточно ли товара на складе (для продаж и списаний)
//         if (data.type === 'sale' || data.type === 'writeoff') {
//             const requestedQty = parseInt(data.quantity);
//             const availableQty = product.quantity || 0;
            
//             if (requestedQty > availableQty) {
//                 throw new Error(
//                     `Недостаточно товара "${product.name}" на складе. ` +
//                     `Запрошено: ${requestedQty}, доступно: ${availableQty}`
//                 );
//             }
//         }
        
//         const sale = {
//             client_id: data.client_id === 'empty' ? null : parseInt(data.client_id),
//             product_id: parseInt(data.product_id),
//             quantity: parseInt(data.quantity),
//             unit_price: parseFloat(data.unit_price),
//             total_amount: parseFloat(data.quantity) * parseFloat(data.unit_price),
//             transaction_date: data.transaction_date || new Date().toISOString(),
//             comment: data.comment || '',
//             type: data.type || 'sale',
//             is_bulk: false,
//             created_at: new Date().toISOString(),
//             updated_at: new Date().toISOString()
//         };
        
//         // Создаём запись о продаже
//         const id = await addItem('sales', sale);
//         console.log('✅ Sale created with id:', id);
        
//         // Обновляем остаток товара
//         const quantityChange = data.type === 'restock' 
//             ? +sale.quantity
//             : -sale.quantity;
        
//         const stockUpdated = await updateProductStock(
//             parseInt(data.product_id),
//             quantityChange
//         );
        
//         if (!stockUpdated) {
//             // Откатываем продажу, если не удалось обновить остаток
//             await deleteItem('sales', id);
//             throw new Error('Не удалось обновить остаток товара. Продажа отменена.');
//         }
        
//         return id;
        
//     } catch (error) {
//         console.error('❌ Error in createSale:', error);
        
//         if (retry) {
//             // Показываем окно с ошибкой и возможностью повтора
//             // Но не бесконечно — только один раз
//             await showErrorWithRetry(
//                 error.message,
//                 () => createSale(data, false) // Повтор без показа окна
//             );
//         }
        
//         throw error;
//     }
// }

// // Создать пакетную корректировку
// export async function createBulkAdjustment(data, retry = true) {
//     console.log('📦 Creating bulk adjustment:', data);
    
//     try {
//         // Проверяем существование товара
//         const product = await getItemById('products', parseInt(data.product_id));
        
//         if (!product) {
//             throw new Error(`Товар с ID ${data.product_id} не найден в базе.`);
//         }
        
//         // Для списаний проверяем остаток
//         if (data.type === 'writeoff') {
//             const requestedQty = parseInt(data.quantity);
//             const availableQty = product.quantity || 0;
            
//             if (requestedQty > availableQty) {
//                 throw new Error(
//                     `Недостаточно товара "${product.name}" для списания. ` +
//                     `Запрошено: ${requestedQty}, доступно: ${availableQty}`
//                 );
//             }
//         }
        
//         const adjustment = {
//             product_id: parseInt(data.product_id),
//             quantity: parseInt(data.quantity),
//             period_start: data.period_start,
//             period_end: data.period_end,
//             type: data.type,
//             comment: data.comment || '',
//             registered_at: new Date().toISOString()
//         };
        
//         const id = await addItem('bulk_adjustments', adjustment);
//         console.log('✅ Bulk adjustment created with id:', id);
        
//         // Обновляем остаток
//         const quantityChange = data.type === 'restock' 
//             ? +adjustment.quantity 
//             : -adjustment.quantity;
        
//         const stockUpdated = await updateProductStock(
//             parseInt(data.product_id), 
//             quantityChange
//         );        
//         if (!stockUpdated) {
//             await deleteItem('bulk_adjustments', id);
//             throw new Error('Не удалось обновить остаток товара. Корректировка отменена.');
//         }
        
//         return id;
        
//     } catch (error) {
//         console.error('❌ Error in createBulkAdjustment:', error);
        
//         if (retry) {
//             await showErrorWithRetry(
//                 error.message,
//                 () => createBulkAdjustment(data, false)
//             );
//         }
        
//         throw error;
//     }
// }

// // Обновить остаток товара (вспомогательная функция)
// async function updateProductStock(productId, quantityChange) {
//     // 🔥 ВАЖНО: Приводим к числу!
//     const numericId = typeof productId === 'number' ? productId : parseInt(productId);
    
//     console.log(`🔄 Updating stock: product_id=${numericId} (was ${productId}), change=${quantityChange}`);
    
//     if (!db) {
//         console.error('❌ Database not initialized in updateProductStock');
//         return false;
//     }
    
//     try {
//         // Ищем по ЧИСЛУ, не по строке
//         const product = await getItemById('products', numericId);
//         console.log('📦 Current product:', product);
        
//         if (!product) {
//             console.error(`❌ Product with id=${numericId} not found`);
//             return false;
//         }
        
//         const currentQty = product.quantity || 0;
//         const newQuantity = Math.max(0, currentQty + quantityChange);
        
//         console.log(`📊 Quantity: ${currentQty} ${quantityChange >= 0 ? '+' : ''}${quantityChange} = ${newQuantity}`);
        
//         await updateItem('products', numericId, {
//             ...product,
//             quantity: newQuantity,
//             updated_at: new Date().toISOString()
//         });
        
//         console.log('✅ Product stock updated successfully');
//         return true;
        
//     } catch (error) {
//         console.error('❌ Error in updateProductStock:', error);
//         return false;
//     }
// }
// // Получить все продажи с пагинацией
// export async function getSalesPaginated(page = 1, pageSize = 10, filters = {}, sortBy = 'date_desc', recordType = 'sales') {
//     let allSales = [];
//     let allBulk = [];
    
//     // 🔥 Загружаем только нужную таблицу (или обе, если нужно)
//     if (recordType === 'sales' || recordType === 'all') {
//         allSales = await getAllItems('sales');
//     }
//     if (recordType === 'bulk' || recordType === 'all') {
//         allBulk = await getAllItems('bulk_adjustments');
//     }
    
//     // Объединяем с меткой источника
//     let combined = [];
    
//     if (recordType === 'sales' || recordType === 'all') {
//         combined = combined.concat(allSales.map(s => ({ ...s, source: 'single', tag: s.type })));
//     }
    
//     if (recordType === 'bulk' || recordType === 'all') {
//         combined = combined.concat(allBulk.map(b => ({ 
//             ...b, 
//             source: 'bulk', 
//             tag: b.type,
//             transaction_date: b.period_start,
//             total_amount: null,
//             unit_price: null,
//             client_id: null
//         })));
//     }
    
//     // Применяем фильтры (как было раньше)
//     if (filters.type) {
//         combined = combined.filter(item => item.tag === filters.type);
//     }
//     if (filters.product_id) {
//         combined = combined.filter(item => item.product_id === parseInt(filters.product_id));
//     }
//     if (filters.date_from) {
//         combined = combined.filter(item => new Date(item.transaction_date) >= new Date(filters.date_from));
//     }
//     if (filters.date_to) {
//         combined = combined.filter(item => new Date(item.transaction_date) <= new Date(filters.date_to));
//     }
    
//     // Сортировка
//     combined.sort((a, b) => {
//         switch (sortBy) {
//             case 'date_asc':
//                 return new Date(a.transaction_date) - new Date(b.transaction_date);
//             case 'amount_desc':
//                 return (b.total_amount || 0) - (a.total_amount || 0);
//             case 'amount_asc':
//                 return (a.total_amount || 0) - (b.total_amount || 0);
//             case 'date_desc':
//             default:
//                 return new Date(b.transaction_date) - new Date(a.transaction_date);
//         }
//     });
    
//     // Пагинация
//     const total = combined.length;
//     const start = (page - 1) * pageSize;
//     const items = combined.slice(start, start + pageSize);
    
//     return {
//         items,
//         pagination: {
//             current_page: page,
//             page_size: pageSize,
//             total_items: total,
//             total_pages: Math.ceil(total / pageSize)
//         }
//     };
// }
// // Получить товары для выпадающего списка (без описания)
// export async function getProductsForDropdown() {
//     const products = await getAllItems('products');
//     return products.map(p => ({
//         id: p.id,
//         name: p.name,
//         category: p.category,
//         sku: p.sku,
//         price: p.price,
//         quantity: p.quantity,
//         is_active: p.is_active
//     }));
// }
// ///Ошибки:
