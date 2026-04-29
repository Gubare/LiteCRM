// resources/js/client.js

let db = null;

// Функция для установки экземпляра БД
export function setDbInstance(dbInstance) {
    db = dbInstance;
    console.log('client.js: Database instance set');
}

// Получаем БД из window.dbInstance
function getDb() {
    if (!db) {
        db = window.dbInstance;
    }
    return db;
}

export async function handleClientFormSubmit(formData) {
    try {
        const database = getDb();
        if (!database) {
            throw new Error('База данных не инициализирована');
        }
        
        // 1. Вставляем данные
        database.run(
            "INSERT INTO client (name, phone, email) VALUES (?, ?, ?)",
            [formData.name, formData.phone, formData.email]
        );
        
        // 2. Получаем ID
        const result = database.exec("SELECT last_insert_rowid() as id");
        const clientId = result[0]?.values[0][0];
        
        // 3. ВАЖНО: Сохраняем на диск сразу после изменения!
        if (window.saveDatabase) {
            await window.saveDatabase();
            console.log('client.js: Database saved to disk after insert');
        } else {
            console.error('client.js: saveDatabase function not available');
        }
        
        // 4. Показываем сообщение
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = `Клиент создан с ID: ${clientId}`;
            messageEl.style.color = 'green';
        }
        
        console.log('client.js: Client created with ID:', clientId);
        return clientId;
    } catch (error) {
        console.error('client.js: Error creating client:', error);
        const messageEl = document.getElementById('message');
        if (messageEl) {
            messageEl.textContent = 'Ошибка: ' + error.message;
            messageEl.style.color = 'red';
        }
        return null;
    }
}
export async function loadClientList() {
    const database = getDb();
    
    if (!database) {
        console.error('client.js: Database not initialized');
        throw new Error('База данных не инициализирована');
    }
    
    try {
        const result = database.exec("SELECT * FROM client WHERE is_archived = 0");
        
        if (!result || result.length === 0) {
            console.log('client.js: No clients found');
            return [];
        }
        
        const clients = result[0].values.map(row => ({
            id: row[0],
            name: row[1],
            phone: row[2],
            email: row[3]
        }));
        
        console.log('client.js: Loaded', clients.length, 'clients');
        return clients;
    } catch (error) {
        console.error('client.js: Error loading clients:', error);
        throw error;
    }
}

export function getClientById(id) {
    const database = getDb();
    if (!database) throw new Error('База данных не инициализирована');
    
    const result = database.exec(
        "SELECT * FROM client WHERE id = ?",
        [id]
    );
    
    if (result && result.length > 0 && result[0].values.length > 0) {
        const row = result[0].values[0];
        return {
            id: row[0],
            name: row[1],
            phone: row[2],
            email: row[3]
        };
    }
    
    return null;
}