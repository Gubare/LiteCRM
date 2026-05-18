// resources/js/main.js
// Работа с IndexedDB через db.js

// Импортируем функции из db.js
import { 
    initDatabase, 
    getDbInstance, 
    createClient, 
    exportAllData,
    getAllClients, 
    deleteClient,
    clearAllClients,
    updateClient,
    getAllItems,
    
} from './db_sqlite.js';

import {
    importFromJSON,
    exportToJSON,
    exportDatabase,
    importStoreFromJSON,
    importDatabase
} from './db.js'
import { loadSettings, getSetting } from './settings-manager.js';
import { initLogger } from './logger.js'; 
import { getDBType } from './db_config.js';
// import { startVoiceInput } from './voice-input.js'
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
                    Удалить
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
        console.log('✅ The client has been removed from IndexedDB');
        
        // Сохраняем бэкап сразу после удаления
        await saveDataToFile();
        
        // Обновляем таблицу
        const clients = await getAllClients();
        window.renderClientTable(clients);
    } catch (error) {
        console.error('❌ Deletion error:', error);
        alert('Не удалось удалить клиента: ' + error.message);
    }
};

window.saveDataToFile = async function() {
    try {
        const backup = await exportAllData(); // Уже включает sales и bulk_adjustments
        const filePath = 'crm_data/backup.json';
        try { await Neutralino.filesystem.createDirectory('crm_data'); } catch(e){}
        await Neutralino.filesystem.writeFile(filePath, backup);
        console.log('Full backup saved');
        return true;
    } catch (error) {
        console.error('Backup error:', error);
        return false;
    }
};


// Загрузка данных из файла при старте
// В main.js

window.loadDataFromFile = async function() {
    try {
        // Определяем тип активной БД
        const dbType = getDBType?.() || 'indexeddb';
        console.log(`📦 Loading data from ${dbType}...`);
        
        if (dbType === 'sqlite') {
            // === SQLite: данные уже в файле .sqlite ===
            // Просто проверяем, что БД инициализирована
            await initDatabase();
            
            // Для SQLite НЕ импортируем из backup.json!
            // Данные уже сохранены в crm_data.sqlite
            console.log('✅ SQLite: data already persisted in file');
            
        } else {
            // === IndexedDB: загружаем из резервной копии ===
            const filePath = 'crm_data/backup.json';
            
            try {
                // Проверяем существование файла
                await Neutralino.filesystem.getStats(filePath);
            } catch(e) {
                console.log('⚠️ No backup file found, using empty database');
                window.isDatabaseReady = true;
                document.dispatchEvent(new CustomEvent('dbReady'));
                return;
            }
            
            const jsonData = await Neutralino.filesystem.readFile(filePath);
            const backup = JSON.parse(jsonData);
            
            // Импорт данных в каждое хранилище
            for (const storeData of backup.stores) {
                try {
                    await importStoreFromJSON(storeData.store, JSON.stringify(storeData));
                    console.log(`✅ Restored "${storeData.store}" (${storeData.items?.length || 0} items)`);
                } catch (err) {
                    console.warn(`⚠️ Could not restore "${storeData.store}":`, err.message);
                }
            }
        }
        
        window.isDatabaseReady = true;
        document.dispatchEvent(new CustomEvent('dbReady'));
        console.log('✅ Database ready, data loaded');
        
    } catch (error) {
        console.error('❌ Restore error:', error);
        // Не блокируем запуск приложения при ошибке загрузки
        window.isDatabaseReady = true;
        document.dispatchEvent(new CustomEvent('dbReady'));
    }
};

// Обработчик закрытия окна
async function onWindowClose() {
    console.log('Application closing, saving data...');
    
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

function initProximityNav() {
  const nav = document.querySelector('.main-nav');
  if (!nav) return;
  
  const items = Array.from(nav.querySelectorAll('.nav-item'));
  let mouseX = 0, mouseY = 0;
  let isTracking = false;
  const MAX_DISTANCE = 140; // Радиус эффекта в пикселях

  function updateProximity() {
    // Если мышь ушла далеко от сайдбара, сбрасываем всё
    const navRect = nav.getBoundingClientRect();
    if (mouseX > navRect.right + 50) {
      items.forEach(item => item.style.setProperty('--proximity', 0));
      isTracking = false;
      return;
    }

    items.forEach(item => {
      // Если кнопка активна, пропускаем расчёт
      if (item.classList.contains('active')) {
        item.style.setProperty('--proximity', 0);
        return;
      }

      const rect = item.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      // Расстояние от курсора до центра кнопки
      const dist = Math.hypot(mouseX - centerX, mouseY - centerY);

      // Преобразуем дистанцию в значение 0..1
      let proximity = 1 - (dist / MAX_DISTANCE);
      proximity = Math.max(0, Math.min(1, proximity));

      // Квадратичное затухание для более естественного "свечения"
      proximity = Math.pow(proximity, 3);

      item.style.setProperty('--proximity', proximity);
    });

    // Продолжаем анимацию, пока мышь двигается
    if (isTracking) {
      requestAnimationFrame(updateProximity);
    }
  }

  nav.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if (!isTracking) {
      isTracking = true;
      requestAnimationFrame(updateProximity);
    }
  });

  nav.addEventListener('mouseleave', () => {
    items.forEach(item => item.style.setProperty('--proximity', 0));
    isTracking = false;
  });
}


// Main initialization
document.addEventListener('DOMContentLoaded', async () => {
    console.log('main.js: DOMContentLoaded');
    
    // Загрузка настроек
    await loadSettings();
    
    // Применяем тему
    const theme = await getSetting('ui.theme');
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // Инициализация навбара 
    initializeNavigation();
    
    try {
        // Инициализация БД
        await initDatabase();
        await initLogger();
        window.isDatabaseReady = true;
        console.log('✅ IndexedDB initialized successfully');
        document.dispatchEvent(new CustomEvent('dbReady'));
        // Загрузка данных
        await loadDataFromFile();
        
        // Глобальные функции
        window.renderClientTable = renderClientTable;
        window.exportDatabase = exportDatabase;
        window.importDatabase = importDatabase;
        window.getAllItems = (await import('./db.js')).getAllItems;
        window.addItem = (await import('./db.js')).addItem;
        window.updateItem = (await import('./db.js')).updateItem;
        window.deleteItem = (await import('./db.js')).deleteItem;
        
        console.log("✅ The application has been launched successfully!");
        
    } catch (error) {
        console.error("❌ Application initialization error:", error);
        if (typeof Neutralino !== 'undefined' && Neutralino.os) {
            Neutralino.os.showMessageBox('Ошибка запуска', 
                'Не удалось инициализировать приложение: ' + error.message);
        }
    }
    
    // Показ информации
    showInfo();
});


//  Инициализация навигации (обработчики для кнопок)
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-item[data-url]');
    
    console.log(`🔍 Found ${navButtons.length} navigation buttons`);
    
    navButtons.forEach(btn => {
        // Обработчик клика
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            const targetUrl = btn.dataset.url;
            
            console.log(`🔘 Navigation clicked: ${targetUrl}`);
            
            if (targetUrl) {
                // Убираем активный класс со всех кнопок
                navButtons.forEach(b => b.classList.remove('active'));
                
                // Добавляем активный класс нажатой кнопке
                btn.classList.add('active');
                
                // Переход на страницу
                window.location.href = targetUrl;
            }
        });
    });
    
    // Подсветка активной страницы при загрузке
    highlightActiveLink();
}


//  Подсветка активной ссылки
function highlightActiveLink() {
    const currentPage = window.location.pathname.split('/').pop() || 'index.html';
    const navButtons = document.querySelectorAll('.nav-item[data-url]');
    
    navButtons.forEach(btn => {
        if (btn.dataset.url === currentPage) {
            btn.classList.add('active');
            console.log(`✅ Active page highlighted: ${currentPage}`);
        }
    });
}


export async function loadNavigation(selector = '#nav-container') {
    try {
        const response = await fetch('partials/nav.html');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const html = await response.text();
        const container = document.querySelector(selector);
        
        if (container) {
            container.innerHTML = html;
            initializeNavigation(); // Инициализируем кнопки после загрузки
        }
    } catch (error) {
        console.error('Failed to load navigation:', error);
        // Навбар уже в HTML, просто игнорируем ошибку
    }
}


function getStoresForPage(pageName) {
    const pageStores = {
        'clients.html': ['clients'],
        'products.html': ['products'],
        'sales.html': ['sales', 'products', 'clients'],
        'tickets.html': ['tickets', 'clients'],
        'calendar.html': ['calendar_notes'],
        'charts.html': ['sales', 'clients', 'products', 'tickets'],
        'reports.html': ['clients', 'products', 'sales'] 
    };
    
    return pageStores[pageName] || [];
}

export function applyNavSettings() {
    const showText = localStorage.getItem('crm_showNavText') !== 'false';
    if (!showText) {
        document.body.classList.add('nav-icons-only');
    } else {
        document.body.classList.remove('nav-icons-only');
    }
}


document.addEventListener('DOMContentLoaded', initProximityNav);
// Делаем функции доступными глобально
window.exportToJSON = exportToJSON;
window.importFromJSON = importFromJSON;
window.saveDataToFile = saveDataToFile;
// Export functions for use in other modules
export { renderClientTable };