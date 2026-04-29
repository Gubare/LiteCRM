// resources/js/main.js
// Работа с IndexedDB через db.js

// Импортируем функции из db.js
import { 
    initDatabase, 
    getDbInstance, 
    createClient, 
    getAllClients, 
    deleteClient,
    clearAllClients,
    exportToJSON,
    importFromJSON, 
    exportDatabase,
    updateClient,
    importDatabase
} from './db_indexeddb.js';

/*
    Function to display information about the Neutralino app.
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
    Function to open the official Neutralino documentation.
*/
function openDocs() {
    Neutralino.os.open("https://neutralino.js.org/docs");
}

/*
    Function to open a tutorial video.
*/
function openTutorial() {
    Neutralino.os.open("https://www.youtube.com/c/CodeZri");
}

/*
    Function to set up a system tray menu.
*/
function setTray() {
    if(NL_MODE != "window") {
        console.log("INFO: Tray menu is only available in the window mode.");
        return;
    }

    let tray = {
        icon: "/resources/icons/trayIcon.png",
        menuItems: [
            {id: "VERSION", text: "Get version"},
            {id: "SEP", text: "-"},
            {id: "QUIT", text: "Quit"}
        ]
    };

    Neutralino.os.setTray(tray);
}

/*
    Function to handle click events on the tray menu items.
*/
function onTrayMenuItemClicked(event) {
    switch(event.detail.id) {
        case "VERSION":
            Neutralino.os.showMessageBox("Version information",
                `Neutralinojs server: v${NL_VERSION} | Neutralinojs client: v${NL_CVERSION}`);
            break;
        case "QUIT":
            Neutralino.app.exit();
            break;
    }
}


/*
    Helper: Render client table (available globally for other pages)
*/
function renderClientTable(clients) {
    const tbody = document.querySelector('#clientList tbody');
    if (!tbody) return;
    
    if (clients.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5">Нет клиентов</td></tr>';
        return;
    }
    
    tbody.innerHTML = clients.map(client => `
        <tr>
            <td>${client.index+1}</td>
            <td>${client.name || ''}</td>
            <td>${client.phone || ''}</td>
            <td>${client.email || ''}</td>
            <td>
                <button onclick="window.handleDeleteClient(${client.id})" 
                        style="color: #ef4444; cursor: pointer; border: 1px solid #ef4444; 
                               border-radius: 4px; padding: 4px 8px; background: #fff;">
                    🗑️ Удалить
                </button>
            </td>
        </tr>
    `).join('');
}

// Глобальная функция удаления (доступна из HTML)
window.handleDeleteClient = async function(id) {
    if (!confirm('Вы уверены, что хотите удалить этого клиента?')) return;
    
    try {
        await deleteClient(id);
        console.log('✅ Клиент удалён из IndexedDB');
        
        // Сохраняем бэкап сразу после удаления
        await saveDataToFile();
        
        // Обновляем таблицу
        const clients = await getAllClients();
        window.renderClientTable(clients);
    } catch (error) {
        console.error('❌ Ошибка удаления:', error);
        alert('Не удалось удалить клиента: ' + error.message);
    }
};

// Сохранение данных в файл при закрытии
async function saveDataToFile() {
    try {
        console.log('💾 Starting data export...');
        const jsonData = await window.exportToJSON();
        
        console.log('📁 Preparing to write file...');
        const filePath = 'crm_data/backup.json';
        
        // Создаём папку
        try {
            await Neutralino.filesystem.createDirectory('crm_data');
            console.log('📂 Directory created/exists');
        } catch (e) {
            console.log('📂 Directory already exists');
        }
        
        // Записываем файл
        console.log('✍️ Writing file:', filePath);
        await Neutralino.filesystem.writeFile(filePath, jsonData);
        console.log('✅ Data saved to file:', filePath);
        
        // Проверяем, что файл создан
        try {
            const stats = await Neutralino.filesystem.getStats(filePath);
            console.log('📊 File stats:', stats);
        } catch (e) {
            console.warn('⚠️ Could not get file stats:', e);
        }
        
    } catch (error) {
        console.error('❌ Error saving to file:', error);
        throw error;
    }
}

// Загрузка данных из файла при старте
async function loadDataFromFile() {
    try {
        const filePath = 'crm_data/backup.json';
        const jsonData = await Neutralino.filesystem.readFile(filePath);
        await importFromJSON(jsonData);
        console.log('✅ Данные загружены из файла');
        
    } catch (error) {
        console.log('📁 Файл резервной копии не найден (это нормально при первом запуске)');
    }
}

// Обработчик закрытия окна
async function onWindowClose() {
    console.log('🔄 Application closing, saving data...');
    
    try {
        // Сохраняем данные перед закрытием
        await saveDataToFile();
        console.log('✅ Data saved successfully');
        
        // Даём время на завершение всех операций
        await new Promise(resolve => setTimeout(resolve, 500));
        
    } catch (error) {
        console.error('❌ Error during save:', error);
    }
    
    // Теперь закрываем приложение
    Neutralino.app.exit();
}

// Initialize Neutralino
Neutralino.init();

// Register event listeners
Neutralino.events.on("trayMenuItemClicked", onTrayMenuItemClicked);
Neutralino.events.on("windowClose", onWindowClose);

// Set up system tray if not running on macOS
if(NL_OS != "Darwin") {
    setTray();
}

// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('main.js: DOMContentLoaded');
    
    try {
        // 1. Инициализация IndexedDB
        await initDatabase();
        console.log('✅ IndexedDB initialized successfully');
        await initDatabase();
        await loadDataFromFile();
        // 2. Делаем функции доступными глобально для других страниц
        window.renderClientTable = renderClientTable;
        window.exportDatabase = exportDatabase;
        window.importDatabase = importDatabase;
        
        // 3. Обработка формы клиентов (если есть на странице)
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
                    
                    // Добавляем клиента через IndexedDB
                    const clientId = await createClient(name, phone, email);
                    
                    // Показываем сообщение
                    const messageEl = document.getElementById('message');
                    if (messageEl) {
                        messageEl.textContent = `Клиент создан с ID: ${clientId}`;
                        messageEl.style.color = 'green';
                    }
                    
                    // Очищаем форму
                    e.target.reset();
                    
                    // Перезагружаем список клиентов
                    const clients = await getAllClients();
                    if (typeof window.renderClientTable === 'function') {
                        window.renderClientTable(clients);
                    }
                    
                    console.log('Client created:', clientId);
                    
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
        
        // 4. Загрузка списка клиентов (если таблица есть на странице)
        const clientListTable = document.getElementById('clientList');
        if (clientListTable) {
            try {
                const clients = await getAllClients();
                
                if (typeof window.renderClientTable === 'function') {
                    window.renderClientTable(clients);
                }
                
                console.log(`Loaded ${clients.length} clients`);
            } catch (error) {
                console.error('Error loading clients:', error);
            }
        }
        
        console.log("✅ Приложение запущено успешно!");
        
    } catch (error) {
        console.error("❌ Ошибка инициализации приложения:", error);
        if (typeof Neutralino !== 'undefined' && Neutralino.os) {
            Neutralino.os.showMessageBox('Ошибка запуска', 
                'Не удалось инициализировать приложение: ' + error.message);
        }
    }
    
    // Display app information
    showInfo();
});

// Делаем функции доступными глобально
window.exportToJSON = exportToJSON;
window.importFromJSON = importFromJSON;
window.saveDataToFile = saveDataToFile;
// Export functions for use in other modules
export { renderClientTable };