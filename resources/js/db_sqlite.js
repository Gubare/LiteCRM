// resources/js/db_sqlite.js

import loadSqlWasm from './sql-wasm-wrapper.js';
import { logAction } from './logger.js';
import { DB_CONFIG } from './db_config.js';

let db = null;
let SQL = null;
let shouldSaveToFile = true; // Флаг сохранения

// Отключить сохранение (для быстрой загрузки)
export function disableAutoSave() {
    shouldSaveToFile = false;
    console.log('💾 Auto-save disabled');
}

// Включить сохранение
export function enableAutoSave() {
    shouldSaveToFile = true;
    console.log('💾 Auto-save enabled');
}

export async function initDatabase() {
    if (db) return db;
    
    console.log('🔌 Loading SQLite WASM module...');
    
    try {
        const initSqlJs = await loadSqlWasm();
        
        SQL = await initSqlJs({
            locateFile: file => './js/' + file
        });
        
        console.log('✅ SQLite WASM initialized');
        
        // Пробуем загрузить существующую БД
        if (typeof Neutralino !== 'undefined') {
            try {
                const fileData = await Neutralino.filesystem.readFile(DB_CONFIG.sqlite.filename);
                const u8 = new Uint8Array(fileData.length);
                for (let i = 0; i < fileData.length; i++) {
                    u8[i] = fileData.charCodeAt(i);
                }
                db = new SQL.Database(u8);
                console.log('✅ SQLite database loaded from file');
                
                // Проверяем существование таблиц
                const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
                console.log('📋 Existing tables:', tables[0]?.values.map(t => t[0]).join(', '));
                
            } catch (e) {
                console.log('📄 No existing SQLite file, creating new');
            }
        }
        
        if (!db) {
            db = new SQL.Database();
            console.log(' Creating new in-memory database');
        }
        
        // Создаём таблицы (если ещё не созданы)
        await createTables();
        
        // Проверяем результат
        const tables = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
        console.log('📋 Tables after init:', tables[0]?.values.map(t => t[0]).join(', '));
        
        return db;
        
    } catch (error) {
        console.error('❌ SQLite initialization failed:', error);
        throw error;
    }
}


async function createTables() {
    console.log('Creating SQLite tables...');
    
    // Клиенты
    db.run(`CREATE TABLE IF NOT EXISTS clients (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        phone TEXT DEFAULT '',
        email TEXT DEFAULT '',
        total_spent REAL DEFAULT 0,
        purchase_count INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);
    
    // Товары
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sku TEXT UNIQUE,
        category TEXT DEFAULT '',
        name TEXT NOT NULL,
        description TEXT DEFAULT '',
        price REAL DEFAULT 0,
        quantity INTEGER DEFAULT 0,
        is_active INTEGER DEFAULT 1,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);
    
    // Продажи
    db.run(`CREATE TABLE IF NOT EXISTS sales (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        unit_price REAL NOT NULL,
        total_amount REAL NOT NULL,
        transaction_date TEXT DEFAULT (datetime('now')),
        comment TEXT DEFAULT '',
        type TEXT DEFAULT 'sale',
        is_bulk INTEGER DEFAULT 0,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (client_id) REFERENCES clients(id),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);
    
    // Обращения (tickets)
    db.run(`CREATE TABLE IF NOT EXISTS tickets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        client_id INTEGER,
        client_name TEXT DEFAULT '',
        type TEXT DEFAULT '',
        contact TEXT DEFAULT '',
        status TEXT DEFAULT 'Открыта',
        description TEXT DEFAULT '',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);
    
    // Пакетные корректировки
    db.run(`CREATE TABLE IF NOT EXISTS bulk_adjustments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL,
        period_start TEXT,
        period_end TEXT,
        type TEXT DEFAULT '',
        comment TEXT DEFAULT '',
        registered_at TEXT DEFAULT (datetime('now')),
        FOREIGN KEY (product_id) REFERENCES products(id)
    )`);
    
    // Заметки календаря
    db.run(`CREATE TABLE IF NOT EXISTS calendar_notes (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        date TEXT NOT NULL,
        text TEXT DEFAULT '',
        color TEXT DEFAULT '#3b82f6',
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
    )`);
    
    // Создаём индексы для производительности
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(transaction_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notes_date ON calendar_notes(date)`);
    
    console.log('✅ All tables created successfully');
}

export function getDbInstance() {
    return db;
}

// === CRUD ===


export async function getAllItems(storeName) {
    if (!db) await initDatabase();
    
    try {
        const result = db.exec(`SELECT * FROM ${storeName}`);
        
        if (!result.length) {
            console.log(`📥 getAllItems("${storeName}"): 0 items (table empty)`);
            return [];
        }
        
        const columns = result[0].columns;
        const items = result[0].values.map(row => {
            const item = {};
            columns.forEach((col, i) => {
                const value = row[i];
                // Преобразуем INTEGER 0/1 в boolean для is_active
                if (col === 'is_active') {
                    item[col] = value === 1;
                } else if (value === null) {
                    // Заменяем NULL на значения по умолчанию
                    if (col === 'total_spent' || col === 'price' || col === 'quantity') {
                        item[col] = 0;
                    } else if (col === 'is_bulk' || col === 'is_active') {
                        item[col] = false;
                    } else {
                        item[col] = '';
                    }
                } else {
                    item[col] = value;
                }
            });
            return item;
        });
        
        console.log(`📥 getAllItems("${storeName}"): ${items.length} items`);
        return items;
        
    } catch (error) {
        console.error(`❌ Error in getAllItems("${storeName}"):`, error);
        return [];
    }
}

export async function getItemById(storeName, id) {
    if (!db) await initDatabase();
    
    const stmt = db.prepare(`SELECT * FROM ${storeName} WHERE id = ?`);
    stmt.bind([id]);
    
    if (!stmt.step()) {
        stmt.free();
        return null;
    }
    
    const columns = stmt.getColumnNames();
    const values = stmt.get();
    stmt.free();
    
    const item = {};
    columns.forEach((col, i) => {
        item[col] = values[i];
        if (col === 'is_active') item[col] = values[i] === 1;
    });
    return item;
}

export async function addItem(storeName, itemData) {
    if (!db) await initDatabase();
    
    const columns = Object.keys(itemData).filter(k => k !== 'id');
    const values = columns.map(k => itemData[k]);
    const placeholders = columns.map(() => '?').join(', ');
    
    const stmt = db.prepare(
        `INSERT INTO ${storeName} (${columns.join(', ')}) VALUES (${placeholders})`
    );
    stmt.bind(values);
    stmt.step();
    stmt.free();
    
    const result = db.exec(`SELECT last_insert_rowid()`);
    const newId = result[0]?.values[0]?.[0];
    
    logAction('create', storeName, newId, itemData);
    
    if (shouldSaveToFile) {
        await saveDatabaseToFile();
    }
    return newId;
}

export async function updateItem(storeName, id, updates) {
    if (!db) await initDatabase();
    
    const oldData = await getItemById(storeName, id);
    
    const columns = Object.keys(updates).filter(k => k !== 'id');
    const setClause = columns.map(col => `${col} = ?`).join(', ');
    const values = [...columns.map(col => updates[col]), id];
    
    const stmt = db.prepare(
        `UPDATE ${storeName} SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`
    );
    stmt.bind(values);
    stmt.step();
    stmt.free();
    
    logAction('update', storeName, id, { ...oldData, ...updates });
    
    if (shouldSaveToFile) {
        await saveDatabaseToFile();
    }
}

export async function deleteItem(storeName, id) {
    if (!db) await initDatabase();
    
    const oldData = await getItemById(storeName, id);
    
    const stmt = db.prepare(`DELETE FROM ${storeName} WHERE id = ?`);
    stmt.bind([id]);
    stmt.step();
    stmt.free();
    
    logAction('delete', storeName, id, oldData);
    
    if (shouldSaveToFile) {
        await saveDatabaseToFile();
    }
}

export async function clearStore(storeName) {
    if (!db) await initDatabase();
    db.run(`DELETE FROM ${storeName}`);
}

// === ЭКСПОРТ/ИМПОРТ ===

export async function exportAllData() {
    if (!db) await initDatabase();
    
    const stores = ['clients', 'products', 'sales', 'tickets', 'bulk_adjustments', 'calendar_notes'];
    const result = {
        version: 6,
        exported_at: new Date().toISOString(),
        stores: []
    };
    
    for (const storeName of stores) {
        try {
            const items = await getAllItems(storeName);
            result.stores.push({ store: storeName, items });
        } catch (e) {
            console.warn(`⚠️ Could not export ${storeName}:`, e);
        }
    }
    
    return JSON.stringify(result, null, 2);
}

export async function importAllData(jsonData) {
    if (!db) await initDatabase();
    
    const data = JSON.parse(jsonData);
    
    // Отключаем внешние ключи для импорта
    db.run('PRAGMA foreign_keys = OFF');
    
    for (const { store, items } of data.stores) {
        await clearStore(store);
        for (const item of items) {
            const { id, ...itemData } = item; // Удаляем id для AUTOINCREMENT
            await addItem(store, itemData);
        }
    }
    
    db.run('PRAGMA foreign_keys = ON');
}

export async function exportStoreToJSON(storeName) {
    const items = await getAllItems(storeName);
    return JSON.stringify({
        store: storeName,
        timestamp: new Date().toISOString(),
        items
    });
}

export async function importStoreFromJSON(storeName, jsonData) {
    const data = JSON.parse(jsonData);
    await clearStore(storeName);
    for (const item of data.items) {
        const { id, ...itemData } = item;
        await addItem(storeName, itemData);
    }
}

// Сохранение БД в файл (для Neutralino)
export async function saveToFile() {
    if (!db) return;
    
    const data = db.export();
    let binary = '';
    const len = data.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(data[i]);
    }
    
    await Neutralino.filesystem.writeFile(
        DB_CONFIG.sqlite.filename,
        binary
    );
    console.log('💾 SQLite saved to file');
}

// === СПЕЦИФИЧНЫЕ ФУНКЦИИ ===
// (Оставляем те же сигнатуры, что и в IndexedDB версии)

export function getAllClients() { return getAllItems('clients'); }

export async function createClient(name, phone, email) {
    return await addItem('clients', {
        name,
        phone: phone || '',
        email: email || '',
        total_spent: 0,
        purchase_count: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

export async function updateClientMetrics(clientId, saleAmount, countChange = 1) {
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

export function deleteClient(id) { return deleteItem('clients', id); }
export function updateClient(id, data) { return updateItem('clients', { ...data, updated_at: new Date().toISOString() }); }
export function getClientById(id) { return getItemById('clients', id); }
export function clearAllClients() { return clearStore('clients'); }

// generateSKU — чистая функция, копируем из db_indexeddb.js
export function generateSKU(category, id = null) {
    const prefix = (category || '').trim().substring(0, 2).toUpperCase();
    return id ? `${prefix}-${id}` : `${prefix}-NEW`;
}

export async function createProduct(data) {
    const tempSKU = generateSKU(data.category);
    
    const product = {
        category: data.category || '',
        name: data.name || '',
        description: data.description || '',
        price: parseFloat(data.price) || 0,
        quantity: parseInt(data.quantity) || 0,
        is_active: data.is_active !== false,
        sku: tempSKU,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    
    const id = await addItem('products', product);
    const finalSKU = generateSKU(data.category, id);
    await updateItem('products', id, { sku: finalSKU });
    
    return id;
}

export async function getActiveProducts() {
    const products = await getAllItems('products');
    return products.filter(p => p.is_active);
}

// ... createSale, createBulkAdjustment, getSalesPaginated, getProductsForDropdown
// — копируем из db_indexeddb.js, они используют универсальные функции и будут работать

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
    if (!db) await initDatabase();
    
    let combined = [];
    
    // Получаем единичные продажи
    if (recordType === 'sales' || recordType === 'all') {
        let sql = 'SELECT *, "single" as source, type as tag FROM sales WHERE 1=1';
        const params = [];
        
        if (filters.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.product_id) {
            sql += ' AND product_id = ?';
            params.push(parseInt(filters.product_id));
        }
        if (filters.date_from) {
            sql += ' AND transaction_date >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            sql += ' AND transaction_date <= ?';
            params.push(filters.date_to);
        }
        
        // Сортировка
        switch (sortBy) {
            case 'date_asc':
                sql += ' ORDER BY transaction_date ASC';
                break;
            case 'amount_desc':
                sql += ' ORDER BY total_amount DESC';
                break;
            case 'amount_asc':
                sql += ' ORDER BY total_amount ASC';
                break;
            case 'date_desc':
            default:
                sql += ' ORDER BY transaction_date DESC';
        }
        
        try {
            const result = db.exec(sql, params);
            if (result.length) {
                const columns = result[0].columns;
                combined = result[0].values.map(row => {
                    const item = {};
                    columns.forEach((col, i) => {
                        const val = row[i];
                        item[col] = col === 'is_bulk' ? val === 1 : (val === null ? '' : val);
                    });
                    return item;
                });
            }
        } catch (e) {
            console.error('❌ Error fetching sales:', e);
        }
    }
    
    // Получаем пакетные корректировки
    if (recordType === 'bulk' || recordType === 'all') {
        let sql = `SELECT *, "bulk" as source, type as tag, 
                   period_start as transaction_date, 
                   NULL as total_amount, 
                   NULL as unit_price, 
                   NULL as client_id 
                   FROM bulk_adjustments WHERE 1=1`;
        const params = [];
        
        if (filters.type) {
            sql += ' AND type = ?';
            params.push(filters.type);
        }
        if (filters.product_id) {
            sql += ' AND product_id = ?';
            params.push(parseInt(filters.product_id));
        }
        if (filters.date_from) {
            sql += ' AND period_start >= ?';
            params.push(filters.date_from);
        }
        if (filters.date_to) {
            sql += ' AND period_start <= ?';
            params.push(filters.date_to);
        }
        
        sql += ' ORDER BY period_start DESC';
        
        try {
            const result = db.exec(sql, params);
            if (result.length) {
                const columns = result[0].columns;
                const bulkItems = result[0].values.map(row => {
                    const item = {};
                    columns.forEach((col, i) => {
                        item[col] = row[i] === null ? '' : row[i];
                    });
                    return item;
                });
                combined = combined.concat(bulkItems);
            }
        } catch (e) {
            console.error('❌ Error fetching bulk adjustments:', e);
        }
    }
    
    // Сортировка уже полученных данных (если нужно)
    if (sortBy && recordType === 'all') {
        combined.sort((a, b) => {
            const dateA = new Date(a.transaction_date || 0);
            const dateB = new Date(b.transaction_date || 0);
            return sortBy === 'date_asc' ? dateA - dateB : dateB - dateA;
        });
    }
    
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
    if (!db) await initDatabase();
    
    try {
        const result = db.exec(`
            SELECT id, name, category, sku, price, quantity, is_active 
            FROM products 
            WHERE is_active = 1 OR is_active IS NULL
            ORDER BY name
        `);
        
        if (!result.length) return [];
        
        const columns = result[0].columns;
        return result[0].values.map(row => {
            const product = {};
            columns.forEach((col, i) => {
                product[col] = col === 'is_active' ? row[i] === 1 : row[i];
            });
            return product;
        });
    } catch (e) {
        console.error('❌ Error in getProductsForDropdown:', e);
        return [];
    }
}

// === ФУНКЦИЯ СОХРАНЕНИЯ НА ДИСК ===
export async function saveDatabaseToFile() {
    if (!shouldSaveToFile || !db || typeof Neutralino === 'undefined') {
        return false;
    }
    
    try {
        // Экспортируем БД в бинарный формат
        const data = db.export();
        
        // Конвертируем Uint8Array в строку для Neutralino
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }
        
        // Создаём директорию если нет
        try {
            await Neutralino.filesystem.createDirectory('crm_data');
        } catch (e) {
            // Директория уже существует
        }
        
        // Записываем файл
        await Neutralino.filesystem.writeFile(
            DB_CONFIG.sqlite.filename,
            binary
        );
        
        console.log('💾 SQLite saved to file:', DB_CONFIG.sqlite.filename);
        return true;
        
    } catch (error) {
        console.error('❌ Failed to save SQLite:', error);
        return false;
    }
}