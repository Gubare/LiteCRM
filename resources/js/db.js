// resources/js/db.js (аналог models.py)
// import  initSqlJs  from './sql-wasm.js';

let db = null;


export function getDbInstance() {
    return db;
}

export async function initDatabase() {
    const SQL = await initSqlJs({
        locateFile: file => `./js/sql-wasm.wasm`
    });
    db = new SQL.Database();
    
    // Создание таблиц
    db.run(`
        CREATE TABLE IF NOT EXISTS client (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            phone TEXT,
            email TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            is_archived BOOLEAN DEFAULT 0
        )
    `);
    
    db.run(`
        CREATE TABLE IF NOT EXISTS sale (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            client_id INTEGER,
            total_amount REAL,
            sale_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (client_id) REFERENCES client(id)
        )
    `);
    
    return db
}

export function getClientById(id) {
    const stmt = db.prepare("SELECT * FROM client WHERE id = :id");
    stmt.bind({ ':id': id });
    const result = stmt.getAsObject();
    stmt.free();
    return result;
}

export function createClient(name, phone, email) {
    db.run(
        "INSERT INTO client (name, phone, email) VALUES (:name, :phone, :email)",
        { ':name': name, ':phone': phone, ':email': email }
    );
    return db.exec("SELECT last_insert_rowid()")[0].values[0][0];
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

// В db.js добавьте автосохранение в localStorage
function autoSaveToLocalStorage() {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = function(event) {
        localStorage.setItem('crm_clients_backup', JSON.stringify(event.target.result));
        console.log('💾 Данные сохранены в localStorage');
    };
}

// При инициализации загружаем из localStorage
function loadFromLocalStorage() {
    const data = localStorage.getItem('crm_clients_backup');
    if (data) {
        const clients = JSON.parse(data);
        // Вставляем в IndexedDB
        const transaction = db.transaction([STORE_NAME], 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        clients.forEach(client => store.add(client));
        console.log('✅ Данные загружены из localStorage');
    }
}