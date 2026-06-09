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

        // Проверяем, существует ли таблица sales и имеет ли она старую структуру
    try {
        const checkResult = db.exec("PRAGMA table_info(sales)");
        if (checkResult.length > 0) {
            const columns = checkResult[0].values.map(row => row[1]);
            if (columns.includes('product_id')) {
                console.log('⚠️ Detected old sales table structure, migrating...');
                
                // Сохраняем старые данные
                const oldSales = db.exec("SELECT * FROM sales");
                
                // Пересоздаём таблицу sales без product_id
                db.run("DROP TABLE sales");
                db.run(`CREATE TABLE sales (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    client_id INTEGER,
                    transaction_date TEXT NOT NULL,
                    type TEXT CHECK(type IN ('sale', 'writeoff', 'restock')) NOT NULL,
                    comment TEXT,
                    total_amount REAL DEFAULT 0,
                    FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
                )`);
                
                // Создаём sale_items, если не существует
                db.run(`CREATE TABLE IF NOT EXISTS sale_items (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    sale_id INTEGER NOT NULL,
                    product_id INTEGER NOT NULL,
                    quantity INTEGER NOT NULL DEFAULT 1,
                    unit_price REAL NOT NULL,
                    line_total REAL NOT NULL,
                    FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
                    FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
                )`);
                
                // Мигрируем данные
                if (oldSales.length > 0 && oldSales[0].values.length > 0) {
                    const oldColumns = oldSales[0].columns;
                    const productIdIndex = oldColumns.indexOf('product_id');
                    const quantityIndex = oldColumns.indexOf('quantity');
                    const unitPriceIndex = oldColumns.indexOf('unit_price');
                    
                    const insertSale = db.prepare("INSERT INTO sales (id, client_id, transaction_date, type, comment, total_amount) VALUES (?, ?, ?, ?, ?, ?)");
                    const insertItem = db.prepare("INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total) VALUES (?, ?, ?, ?, ?)");
                    
                    for (const row of oldSales[0].values) {
                        const saleId = row[0]; // id
                        const clientId = row[oldColumns.indexOf('client_id')];
                        const transDate = row[oldColumns.indexOf('transaction_date')];
                        const type = row[oldColumns.indexOf('type')];
                        const comment = row[oldColumns.indexOf('comment')] || null;
                        const totalAmount = row[oldColumns.indexOf('total_amount')] || 0;
                        
                        // Вставляем sale
                        insertSale.bind([saleId, clientId, transDate, type, comment, totalAmount]);
                        insertSale.step();
                        insertSale.reset();
                        
                        // Вставляем sale_item, если есть product_id
                        if (productIdIndex >= 0 && row[productIdIndex]) {
                            const productId = row[productIdIndex];
                            const qty = quantityIndex >= 0 ? row[quantityIndex] : 1;
                            const price = unitPriceIndex >= 0 ? row[unitPriceIndex] : 0;
                            const lineTotal = qty * price;
                            
                            insertItem.bind([saleId, productId, qty, price, lineTotal]);
                            insertItem.step();
                            insertItem.reset();
                        }
                    }
                    
                    insertSale.free();
                    insertItem.free();
                    
                    console.log('✅ Migration completed');
                }
            }
        }
    } catch (e) {
        console.log('📄 Table sales does not exist yet, creating...');
    }
    
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
        transaction_date TEXT NOT NULL,
        type TEXT CHECK(type IN ('sale', 'writeoff', 'restock')) NOT NULL,
        comment TEXT,
        payment_type TEXT DEFAULT 'Наличные',
        total_amount REAL DEFAULT 0,
        FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE SET NULL
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS sale_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sale_id INTEGER NOT NULL,
        product_id INTEGER NOT NULL,
        quantity INTEGER NOT NULL DEFAULT 1,
        unit_price REAL NOT NULL,
        line_total REAL NOT NULL,
        FOREIGN KEY (sale_id) REFERENCES sales(id) ON DELETE CASCADE,
        FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE
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

    // Задачи (новая таблица)
    db.run(`CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        description TEXT,
        deadline TEXT,
        priority TEXT DEFAULT 'not-urgent-important',
        status TEXT DEFAULT 'todo',
        
        -- Связи с другими таблицами
        related_table TEXT,
        related_id INTEGER,
        related_display TEXT,
        
        -- Мета-данные
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now')),
        completed_at TEXT,
        
        -- Флаги
        is_archived INTEGER DEFAULT 0
    )`);

   
    // Создаём индексы для производительности
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_name ON clients(name)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients(phone)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_products_sku ON products(sku)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_client ON sales(client_id)`);
    // db.run(`CREATE INDEX IF NOT EXISTS idx_sales_product ON sales(product_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sales_date ON sales(transaction_date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_client ON tickets(client_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_notes_date ON calendar_notes(date)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_deadline ON tasks(deadline)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_related ON tasks(related_table, related_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_tasks_archived ON tasks(is_archived)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_sale_id ON sale_items(sale_id)`);
    db.run(`CREATE INDEX IF NOT EXISTS idx_sale_items_product_id ON sale_items(product_id)`);

    console.log('✅ All tables created successfully');
}

// Экспорт функции для прямых SQL-запросов
// === ДОБАВЬТЕ ЭТУ ФУНКЦИЮ ===
export async function db_all(sql, params = []) {
    console.log('🔍 Executing SQL:', sql, 'params:', params);
    
    return new Promise((resolve, reject) => {
        if (!db) {
            console.error('❌ Database not initialized!');
            reject(new Error('Database not initialized. Call initDatabase() first.'));
            return;
        }
        
        try {
            db.run(sql, params, (err, rows) => {
                if (err) {
                    console.error('❌ SQL error:', err);
                    reject(err);
                } else {
                    console.log('✅ SQL result:', rows?.length || 0, 'rows');
                    resolve(rows);
                }
            });
        } catch (error) {
            console.error('❌ SQL exception:', error);
            reject(error);
        }
    });
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
    
        const stores = ['clients', 'products', 'sales', 'sale_items', 'tickets', 'bulk_adjustments', 'calendar_notes'];    const result = {
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
export function updateClient(id, data) { return updateItem('clients', id, { ...data, updated_at: new Date().toISOString() }); }
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
export async function createSale(saleData) {
    const db = await getDbInstance();
    
    db.run('BEGIN TRANSACTION');
    
    try {
        // 1. Создаём заголовок чека
        const saleStmt = db.prepare(`
            INSERT INTO sales (client_id, transaction_date, type, comment, total_amount, payment_type)
            VALUES (?, ?, ?, ?, ?, ?)
        `);
        saleStmt.bind([
            saleData.client_id || null,
            saleData.transaction_date || new Date().toISOString(),
            saleData.type || 'sale',
            saleData.comment || '',
            saleData.total_amount || 0,
            saleData.payment_type || null
        ]);
        saleStmt.step();
        const saleId = db.exec('SELECT last_insert_rowid()')[0].values[0][0];
        saleStmt.free();

        // 2. Создаём строки чека
        if (saleData.items && Array.isArray(saleData.items)) {
            const itemStmt = db.prepare(`
                INSERT INTO sale_items (sale_id, product_id, quantity, unit_price, line_total)
                VALUES (?, ?, ?, ?, ?)
            `);
            
            for (const item of saleData.items) {
                const lineTotal = (item.quantity || 1) * (item.unit_price || 0);
                itemStmt.bind([saleId, item.product_id, item.quantity, item.unit_price, lineTotal]);
                itemStmt.step();
                itemStmt.reset();
                
                // Списываем остаток товара (для типа 'sale')
                if (saleData.type === 'sale') {
                    await updateProductStock(db, item.product_id, -item.quantity);
                }
            }
            itemStmt.free();
        }
        
        db.run('COMMIT');
        
        if (typeof Neutralino !== 'undefined' && shouldSaveToFile) {
            await saveDatabaseToFile();
        }
        
        // Обновляем метрики клиента
        if (saleData.client_id && saleData.type === 'sale') {
            await updateClientMetrics(db, saleData.client_id);
        }
        
        return saleId;
        
    } catch (error) {
        db.run('ROLLBACK');
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
    //  Приводим к числу
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
        let sql = `
            SELECT 
                s.*,
                si.product_id,
                si.quantity,
                si.unit_price,
                si.line_total,
                "single" as source,
                s.type as tag
            FROM sales s
            LEFT JOIN sale_items si ON s.id = si.sale_id
            WHERE 1=1
        `;
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
        console.log('💾 Save skipped:', { shouldSaveToFile, db: !!db, Neutralino: typeof Neutralino });
        return false;
    }
    
    try {
        const data = db.export();
        let binary = '';
        const len = data.byteLength;
        for (let i = 0; i < len; i++) {
            binary += String.fromCharCode(data[i]);
        }
        
        try {
            await Neutralino.filesystem.createDirectory('crm_data');
        } catch (e) {
            // Директория уже существует
        }
        
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

// === ФУНКЦИИ ДЛЯ ЗАДАЧ ===

// Получить все активные задачи
export async function getAllTasks() {
    const tasks = await getAllItems('tasks');
    return tasks.filter(t => !t.is_archived);
}

// Создать задачу
export async function createTask(data) {
    const task = {
        title: data.title,
        description: data.description || '',
        deadline: data.deadline || null,
        priority: data.priority || 'not-urgent-important',
        status: data.status || 'todo',
        related_table: data.related_table || null,
        related_id: data.related_id || null,
        related_display: data.related_display || null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        completed_at: null,
        is_archived: 0
    };
    
    const id = await addItem('tasks', task);
    return id;
}

// Обновить задачу
export async function updateTask(id, updates) {
    return await updateItem('tasks', id, {
        ...updates,
        updated_at: new Date().toISOString()
    });
}

// Пометить задачу как выполненную
export async function completeTask(id) {
    return await updateItem('tasks', id, {
        status: 'done',
        completed_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    });
}

// Архивировать задачу
export async function archiveTask(id) {
    return await updateItem('tasks', id, {
        is_archived: 1,
        updated_at: new Date().toISOString()
    });
}

// Получить задачи по приоритету
export async function getTasksByPriority(priority) {
    const tasks = await getAllItems('tasks');
    return tasks.filter(t => t.priority === priority && !t.is_archived);
}

// Получить задачи, связанные с записью
export async function getTasksForRecord(tableName, recordId) {
    const tasks = await getAllItems('tasks');
    return tasks.filter(t => 
        t.related_table === tableName && 
        t.related_id === parseInt(recordId) && 
        !t.is_archived
    );
}

// Получить все продажи с товарами (группированные)
export async function getSalesWithItems(filters = {}) {
    if (!db) await initDatabase();
    
    let sql = `
        SELECT 
            s.*,
            si.id as item_id,
            si.product_id,
            si.quantity,
            si.unit_price,
            si.line_total,
            p.name as product_name,
            p.sku as product_sku,
            c.name as client_name
        FROM sales s
        LEFT JOIN sale_items si ON s.id = si.sale_id
        LEFT JOIN products p ON si.product_id = p.id
        LEFT JOIN clients c ON s.client_id = c.id
        WHERE 1=1
    `;
    
    const params = [];
    
    if (filters.type) {
        sql += ' AND s.type = ?';
        params.push(filters.type);
    }
    
    if (filters.client_id) {
        sql += ' AND s.client_id = ?';
        params.push(filters.client_id);
    }
    
    const result = db.exec(sql, params);
    
    if (!result.length) return [];
    
    const columns = result[0].columns;
    const rows = result[0].values;
    
    // Группируем по sale_id
    const salesMap = new Map();
    
    for (const row of rows) {
        const sale = {};
        const items = [];
        
        columns.forEach((col, i) => {
            const val = row[i];
            
            // Поля из sale_items
            if (col === 'item_id' || col === 'product_id' || 
                col === 'quantity' || col === 'unit_price' || col === 'line_total') {
                items[col] = val;
            } 
            // Поля из products
            else if (col === 'product_name' || col === 'product_sku') {
                items[col] = val || '';
            }
            // Поля из sales и clients
            else {
                sale[col] = col === 'is_bulk' ? val === 1 : (val === null ? '' : val);
            }
        });
        
        const saleId = sale.id;
        
        if (!salesMap.has(saleId)) {
            salesMap.set(saleId, {
                ...sale,
                items: []
            });
        }
        
        // Добавляем item, если он есть
        if (items.product_id) {
            salesMap.get(saleId).items.push({
                product_id: items.product_id,
                quantity: items.quantity,
                unit_price: items.unit_price,
                line_total: items.line_total,
                product_name: items.product_name,
                product_sku: items.product_sku
            });
        }
    }
    
    return Array.from(salesMap.values());
}