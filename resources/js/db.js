// resources/js/db.js (аналог models.py)
import { initSqlJs } from './sql-wasm.js';

let db = null;

export async function initDatabase() {
    const SQL = await initSqlJs({ locateFile: file => `./sql-wasm.wasm` });
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