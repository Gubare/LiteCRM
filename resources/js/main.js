// resources/js/main.js
// This is just a sample app. You can structure your Neutralinojs app code as you wish.
// This example app is written with vanilla JavaScript and HTML.
// Feel free to use any frontend framework you like :)
// See more details: https://neutralino.js.org/docs/how-to/use-a-frontend-library

// ВАЖНО: НЕ ИМПОРТИРУЕМ sql-wasm.js - он загружается как глобальный скрипт в HTML
// Импорты из db.js и client.js удалены, так как они используют глобальные функции
// console.log('Neutralino.os methods:', Object.keys(Neutralino.os || {}));
// console.log('Neutralino.filesystem methods:', Object.keys(Neutralino.filesystem || {}));


let db = null;

/*
    Function to display information about the Neutralino app.
    This function updates the content of the 'info' element in the HTML
    with details regarding the running Neutralino application, including
    its ID, port, operating system, and version information.
*/
function showInfo() {
    const infoElement = document.getElementById('info');
    if (infoElement) {
        infoElement.innerHTML = `
            ${NL_APPID} is running on port ${NL_PORT} inside ${NL_OS}
            <br/><br/>
            <span>server: v${NL_VERSION} | client: v${NL_CVERSION}</span>
            `;
    }
}

/*
    Function to open the official Neutralino documentation in the default web browser.
*/
function openDocs() {
    Neutralino.os.open("https://neutralino.js.org/docs");
}

/*
    Function to open a tutorial video on Neutralino's official YouTube channel in the default web browser.
*/
function openTutorial() {
    Neutralino.os.open("https://www.youtube.com/c/CodeZri");
}

/*
    Function to set up a system tray menu with options specific to the window mode.
    This function checks if the application is running in window mode, and if so,
    it defines the tray menu items and sets up the tray accordingly.
*/
function setTray() {
    // Tray menu is only available in window mode
    if(NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    // Define tray menu items
    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            {id: "VERSION", text: "Get version"},
            {id: "SEP", text: "-"},
            {id: "QUIT", text: "Quit"}
        ]
    };

    // Set the tray menu
    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
    This function performs different actions based on the clicked item's ID,
    such as displaying version information or exiting the application.
*/
function onTrayMenuItemClicked(event) {
    switch(event.detail.id) {
        case "VERSION":
            // Display version information
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            // Exit the application
            Neutralino.app.exit();
            break;
    }
}

/*
    Function to handle the window close event by gracefully exiting the Neutralino application.
*/
function onWindowClose() {
    Neutralino.app.exit();
}

/*
    Database initialization function
    Creates or loads the SQLite database and creates tables if needed
*/
async function initDatabase() {
    try {
        if (typeof initSqlJs === 'undefined') {
            throw new Error('initSqlJs is not defined');
        }
        
        const SQL = await initSqlJs({
            locateFile: file => `./js/${file}`
        });
        
        const dbPath = 'crm_data/crm_data.db';
        
        // Пробуем загрузить существующую БД
        try {
            console.log('Loading database from:', dbPath);
            const fileData = await Neutralino.filesystem.readBinaryFile(dbPath);
            db = new SQL.Database(fileData);
            console.log('Database loaded successfully');
                
            // Проверяем, есть ли таблица client
            try {
                const result = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='client'");
                if (result.length === 0 || result[0].values.length === 0) {
                    console.log('Table client not found, creating tables...');
                    await createTables();
                }
            } catch (e) {
                console.log('Error checking table, creating tables...');
                await createTables();
            }
            
        } catch (e) {
            // Файл не существует, создаём новую БД
            console.log('Creating new database...');
            db = new SQL.Database();
            await createTables();
            await saveDatabase();
        }
        
        window.dbInstance = db;
        window.saveDatabase = saveDatabase;
        console.log('Database initialized successfully');
        // После загрузки базы данных
try {
    console.log('Database loaded, checking contents...');
    
    // Проверяем все таблицы
    const tablesResult = db.exec("SELECT name FROM sqlite_master WHERE type='table'");
    console.log('Tables in database:', tablesResult);
    
    if (tablesResult.length > 0) {
        console.log('Table names:', tablesResult[0].values);
    }
    
    // Проверяем конкретно client
    const clientCheck = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name='client'");
    console.log('Client table check:', clientCheck);
    
    // Проверяем, есть ли данные
    const countResult = db.exec("SELECT COUNT(*) as count FROM client");
    console.log('Client count:', countResult);
    
} catch (e) {
    console.error('Error checking database:', e);
}
        return true;
        
    } catch (error) {
        console.error('Error initializing database:', error);
        return false;
    }
}
/*
    Create database tables if they don't exist
*/
async function createTables() {
    if (!db) {
        console.error('Cannot create tables: database not initialized');
        throw new Error('Database not initialized');
    }
    
    try {
        console.log('Creating database tables...');
        
        // Таблица клиентов
        db.run(`
            CREATE TABLE IF NOT EXISTS client (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                phone TEXT,
                email TEXT,
                address TEXT,
                notes TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                is_archived INTEGER DEFAULT 0
            )
        `);
        console.log('Table client created');
        
        // Остальные таблицы...
        // (ваш код для product, sale, sale_item, contact_log)
        
        // Создание индексов
        db.run("CREATE INDEX IF NOT EXISTS idx_client_name ON client(name)");
        db.run("CREATE INDEX IF NOT EXISTS idx_client_phone ON client(phone)");
        
        console.log('All tables created successfully');
        
    } catch (error) {
        console.error('Error creating tables:', error);
        throw error;
    }
}

/*
    Save database to disk
*/
// resources/js/main.js

async function saveDatabase() {
    if (!db) {
        console.warn('Cannot save database: not initialized');
        return false;
    }
    
    try {
        const data = db.export();
        const dbPath = 'crm_data/crm_data.db';
        const dirPath = 'crm_data';
        
        // Создаём папку, если не существует
        try {
            await Neutralino.filesystem.createDirectory(dirPath);
        } catch (e) {
            // Уже существует
        }
        
        // Записываем файл
        await Neutralino.filesystem.writeBinaryFile(dbPath, data);
        console.log('Database saved to:', dbPath);
        return true;
    } catch (error) {
        console.error('Error saving database:', error);
        return false;
    }
}

/*
    Helper function to execute database queries
*/
function dbQuery(sql, params = {}) {
    if (!db) {
        throw new Error('Database not initialized');
    }
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
        results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
}

/*
    Helper function to execute database commands (INSERT, UPDATE, DELETE)
*/
function dbExecute(sql, params = {}) {
    if (!db) {
        throw new Error('Database not initialized');
    }
    db.run(sql, params);
    saveDatabase(); // Автосохранение после изменения
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Conditional initialization: Set up system tray if not running on macOS
if(NL_OS != "Darwin") { // TODO: Fix https://github.com/neutralinojs/neutralinojs/issues/615
    setTray();
}

document.addEventListener('DOMContentLoaded', async () => {
    console.log('DOM Content Loaded - Initializing application...');
    
    // Инициализация БД при старте
    const dbInitialized = await initDatabase();
    
    if (dbInitialized) {
        console.log("✅ Приложение запущено успешно!");
        
        // Делаем функции доступными глобально для других страниц
        window.dbInstance = db;
        window.saveDatabase = saveDatabase;
        window.dbQuery = dbQuery;
        window.dbExecute = dbExecute;
        
        // Обработка формы клиентов (если есть на странице)
        const clientForm = document.getElementById('clientForm');
        if (clientForm) {
            clientForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                
                try {
                    const formData = new FormData(e.target);
                    const name = formData.get('name');
                    const phone = formData.get('phone');
                    const email = formData.get('email');
                    
                    if (!name) {
                        alert('Имя клиента обязательно');
                        return;
                    }
                    
                    // Добавляем клиента в БД
                    dbExecute(
                        "INSERT INTO client (name, phone, email) VALUES (?, ?, ?)",
                        [name, phone, email]
                    );
                    
                    // Получаем ID последнего вставленного клиента
                    const result = dbQuery("SELECT last_insert_rowid() as id");
                    const clientId = result[0]?.id;
                    
                    // Показываем сообщение
                    const messageEl = document.getElementById('message');
                    if (messageEl) {
                        messageEl.textContent = `Клиент создан с ID: ${clientId}`;
                        messageEl.style.color = 'green';
                    }
                    
                    // Очищаем форму
                    e.target.reset();
                    
                    // Перезагружаем список клиентов (если функция существует)
                    if (typeof window.loadClientList === 'function' && 
                        typeof window.renderClientTable === 'function') {
                        const clients = await window.loadClientList();
                        window.renderClientTable(clients);
                    }
                    
                } catch (error) {
                    console.error('Error creating client:', error);
                    const messageEl = document.getElementById('message');
                    if (messageEl) {
                        messageEl.textContent = 'Ошибка: ' + error.message;
                        messageEl.style.color = 'red';
                    }
                }
            });
        }
        
        // Загрузка списка клиентов (если таблица есть на странице)
        const clientListTable = document.getElementById('clientList');
        if (clientListTable) {
            try {
                const clients = dbQuery("SELECT * FROM client WHERE is_archived = 0");
                
                if (typeof window.renderClientTable === 'function') {
                    window.renderClientTable(clients);
                } else {
                    // Рендерим таблицу напрямую, если функции нет
                    const tbody = clientListTable.querySelector('tbody');
                    if (tbody) {
                        if (clients.length === 0) {
                            tbody.innerHTML = '<tr><td colspan="4">Нет клиентов</td></tr>';
                        } else {
                            tbody.innerHTML = clients.map(client => `
                                <tr>
                                    <td>${client.id}</td>
                                    <td>${client.name || ''}</td>
                                    <td>${client.phone || ''}</td>
                                    <td>${client.email || ''}</td>
                                </tr>
                            `).join('');
                        }
                    }
                }
                
                console.log(`Loaded ${clients.length} clients`);
            } catch (error) {
                console.error('Error loading clients:', error);
            }
        }
    } else {
        console.error("❌ Ошибка инициализации приложения");
    }
    
    // Display app information
    showInfo();
});

// Export functions for use in other modules (if needed)
export { initDatabase, saveDatabase, dbQuery, dbExecute };