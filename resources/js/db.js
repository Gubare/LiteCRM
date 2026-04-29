// resources/js/db.js (аналог models.py)
import { initSqlJs } from './sql-wasm.js';

let db = null;
const DB_FILE_PATH = '/crm_database.sqlite';

export function getDbInstance() {
    return db;
}

// Сохранение БД в файл
export async function saveDatabase() {
    if (!db) return false;
    
    try {
        const data = db.export();
        const uint8Array = new Uint8Array(data);
        
        // Конвертируем в base64 для записи через Neutralino
        let binaryString = '';
        for (let i = 0; i < uint8Array.length; i++) {
            binaryString += String.fromCharCode(uint8Array[i]);
        }
        const base64Data = btoa(binaryString);
        
        await Neutralino.filesystem.writeFile(DB_FILE_PATH, base64Data);
        console.log('База данных сохранена');
        return true;
    } catch (error) {
        console.error('Ошибка сохранения БД:', error);
        return false;
    }
}

// Загрузка БД из файла
async function loadDatabase(SQL) {
    try {
        const data = await Neutralino.filesystem.readFile(DB_FILE_PATH);
        if (data && data.length > 0) {
            // Декодируем из base64
            const binaryString = atob(data);
            const uint8Array = new Uint8Array(binaryString.length);
            for (let i = 0; i < binaryString.length; i++) {
                uint8Array[i] = binaryString.charCodeAt(i);
            }
            
            db = new SQL.Database(uint8Array);
            console.log('База данных загружена из файла');
            return true;
        }
    } catch (error) {
        console.log('Файл БД не найден, будет создана новая база');
    }
    return false;
}

export async function initDatabase() {
    const SQL = await initSqlJs({ locateFile: file => `./sql-wasm.wasm` });
    
    // Пытаемся загрузить существующую БД
    const loaded = await loadDatabase(SQL);
    
    if (!loaded) {
        // Создаём новую БД
        db = new SQL.Database();
        console.log('Создана новая база данных');
    }
    
    // Создание таблиц (IF NOT EXISTS безопасно при повторном запуске)
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
    
    // Сохраняем после инициализации (чтобы создать файл если его не было)
    await saveDatabase();
    
    return db;
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