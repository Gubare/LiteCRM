// resources/js/main.js

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
// import { verifyPassword, createLockScreen } from './security.js';

let isLocked = false;


async function checkAndLock() {
    const savedHash = await getSetting('auth.passwordHash', true);
    
    console.log('🔒 Password hash:', savedHash ? 'EXISTS' : 'NOT SET');
    
    // Проверяем: есть ли пароль И не разблокирована ли сессия
    if (savedHash && savedHash.length > 0) {
        const isUnlocked = sessionStorage.getItem('app_unlocked') === 'true';
        
        console.log('🔐 Session unlocked:', isUnlocked);
        
        if (!isUnlocked) {
            console.log('🔒 Creating lock screen...');
            createLockScreen();
            return true;
        } else {
            console.log('✅ Session already unlocked, skipping lock screen');
        }
    }
    
    return false;
}

// Функция, которая запускает приложение ТОЛЬКО после разблокировки
async function initApplicationLogic() {
    resetInactivityTimer();
    await initCustomTitlebar();
    console.log('✅ App unlocked. Loading data...');
    // Загрузка настроек
    await loadSettings();
    const animateRows = await getSetting('ui.animateRows', true);
    document.body.setAttribute('data-animate-rows', animateRows);
    applyUIPreferences();
    // Применяем тему
    const theme = await getSetting('ui.theme');
    if (theme) {
        document.documentElement.setAttribute('data-theme', theme);
    }
    
    // Инициализация навбара 
    initializeNavigation();
    initTooltips();
    try {
        // Инициализация БД
        await initDatabase();
        await initLogger();
        window.isDatabaseReady = true;
        console.log('✅ SQLite initialized successfully');
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
}



export async function hashPassword(password) {
    if (!password) return null;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

async function applyUIPreferences() {
    try {
        const showHelpTooltips = await getSetting('ui.showHelpTooltips', true);
        if (!showHelpTooltips) {
            document.body.classList.add('help-tooltips-hidden');
        } else {
            document.body.classList.remove('help-tooltips-hidden');
        }
    } catch (e) {
        console.warn('️ Could not load tooltip preference:', e);
    }
}

// Проверка пароля
export async function verifyPassword(inputPassword, storedHash) {
    if (!storedHash) return false; // Если хеша нет, пароль не задан
    const inputHash = await hashPassword(inputPassword);
    return inputHash === storedHash;
}

// Функция создания экрана блокировки
export function createLockScreen() {
    // Проверяем, есть ли уже оверлей
    if (document.getElementById('lockOverlay')) return;

    const overlay = document.createElement('div');
    overlay.id = 'lockOverlay';
    overlay.innerHTML = `
        <div class="lock-content">
            <div class="lock-icon"><img src="icons/lock.svg" alt="Главная" class="icon" width="150" height="150"></div>
            <h2>CRM System</h2>
            <p>Введите пароль для доступа</p>
            <input type="password" id="lockPasswordInput" class="lock-input" placeholder="Пароль" autofocus>
            <button id="btnUnlock" class="btn-primary" style="margin-top: 15px;">Войти</button>
            <p id="lockError" class="lock-error"></p>
        </div>
    `;
    
    // Стили прямо в JS для простоты 
    overlay.style.cssText = `
        position: fixed; opacity: 97%; top: 0; left: 0; width: 100vw; height: 100vh;
        background: #0f172a; z-index: 99999; display: flex; 
        align-items: center; justify-content: center;
        backdrop-filter: blur(10px);
    `;
    
    const content = overlay.querySelector('.lock-content');
    content.style.cssText = `
        background: #1e293b; padding: 40px; border-radius: 16px; 
        text-align: center; width: 350px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;
    
    // Стили элементов
    overlay.querySelector('.lock-icon').style.cssText = 'font-size: 64px; margin-bottom: 20px; display: block;';
    overlay.querySelector('h2').style.cssText = 'color: #fff; margin: 0 0 10px 0;';
    overlay.querySelector('p').style.cssText = 'color: #94a3b8; margin: 0 0 20px 0;';
    overlay.querySelector('.lock-input').style.cssText = `
        width: 100%; padding: 12px; border-radius: 8px; border: 1px solid #334155; 
        background: #0f172a; color: #fff; font-size: 16px; outline: none;
    `;
    overlay.querySelector('.lock-error').style.cssText = 'color: #ef4444; margin-top: 10px; min-height: 20px; font-size: 14px;';

    document.body.appendChild(overlay);
    
    // Обработчики
    const input = overlay.querySelector('#lockPasswordInput');
    const btn = overlay.querySelector('#btnUnlock');
    
    const tryUnlock = async () => {
        const pass = input.value;
        const savedHash = await getSetting('auth.passwordHash');
        
        if (await verifyPassword(pass, savedHash)) {
            overlay.remove();
            isLocked = false;
            // Разрешаем навигацию и загрузку данных
            sessionStorage.setItem('app_unlocked', 'true');
            initApplicationLogic(); 
        } else {
            overlay.querySelector('#lockError').textContent = '❌ Неверный пароль';
            input.value = '';
            input.focus();
        }
    };
    
    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });
}

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
        console.log('✅ The client has been removed from SQLite');
        
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

// resources/js/main.js

export async function initCustomTitlebar() {
  if (typeof Neutralino === 'undefined') return;

  const btnMin = document.getElementById('btn-minimize');
  const btnMax = document.getElementById('btn-maximize');
  const btnClose = document.getElementById('btn-close');

  // Свернуть: window.minimize
  btnMin?.addEventListener('click', () => {
    console.log('Minimize clicked');
    Neutralino.window.minimize();
  });

  // Развернуть: window.isMaximized, window.maximize, window.unmaximize
  btnMax?.addEventListener('click', async () => {
    try {
      console.log('Maximize clicked');
      const isMax = await Neutralino.window.isMaximized();
      
      if (isMax) {
        await Neutralino.window.unmaximize();
        btnMax.textContent = '□';
      } else {
        await Neutralino.window.maximize();
        btnMax.textContent = '❐';
      }
    } catch (error) {
      console.error('Maximize error:', error);
    }
  });

  // Закрыть: window.close или app.exit
  btnClose?.addEventListener('click', () => {
    console.log('Close clicked');
    Neutralino.app.exit(); 
  });

  console.log('✅ Titlebar initialized with permissions');
}

function initTooltips() {
    console.log('🔍 Initializing tooltips...');
    
    const tooltipElements = document.querySelectorAll('.tooltip-icon');
    
    tooltipElements.forEach(element => {
        const tooltipText = element.getAttribute('data-tooltip');
        if (!tooltipText) return;
        
        // Очищаем все классы позиций
        element.classList.remove('position-top', 'position-bottom', 'position-left', 'position-right');
        
        // Проверяем наличие ручной позиции
        const manualPosition = element.getAttribute('data-position');
        
        if (manualPosition) {
            // Применяем ручную позицию
            switch (manualPosition.toLowerCase()) {
                case 'top':
                case 'up':
                    element.classList.add('position-top');
                    break;
                case 'bottom':
                case 'down':
                    element.classList.add('position-bottom');
                    break;
                case 'left':
                    element.classList.add('position-left');
                    break;
                case 'right':
                    element.classList.add('position-right');
                    break;
                default:
                    // Если неизвестное значение, используем автоопределение
                    applyAutoPosition(element);
            }
            console.log(`📍 Manual position "${manualPosition}" applied`);
        } else {
            // Автоопределение позиции
            applyAutoPosition(element);
        }
        
/**
 * Автоматическое определение позиции на основе расположения элемента
 */
function applyAutoPosition(element) {
    const rect = element.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    // Расстояние до краёв
    const distToRight = viewportWidth - rect.right;
    const distToLeft = rect.left;
    const distToBottom = viewportHeight - rect.bottom;
    const distToTop = rect.top;
    
    // Определяем лучшее направление
    if (distToRight < 300 && distToLeft > distToRight) {
        // Мало места справа → влево
        element.classList.add('position-left');
    } else if (distToLeft < 100 && distToRight > distToLeft) {
        // Мало места слева → вправо
        element.classList.add('position-right');
    } else if (distToBottom < 120 && distToTop > distToBottom) {
        // Мало места снизу → сверху
        element.classList.add('position-top');
    } else if (distToTop < 120 && distToBottom > distToTop) {
        // Мало места сверху → снизу
        element.classList.add('position-bottom');
    }
    // Иначе остаётся стандартное (снизу)
}

        // Доступность
        element.setAttribute('tabindex', '0');
        element.setAttribute('role', 'tooltip');
        element.setAttribute('aria-label', tooltipText);
        
        // Клик для мобильных
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelectorAll('.tooltip-icon.active').forEach(el => {
                if (el !== element) el.classList.remove('active');
            });
            element.classList.toggle('active');
        });
    });
    
    console.log(`✅ Tooltips initialized: ${tooltipElements.length} elements`);
}

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
console.log('🔌 Neutralino initialized in main.js');
    
// Делаем доступным глобально
window.NeutralinoReady = new Promise(resolve => {
    document.addEventListener('neutralino.ready', resolve);
});

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
    console.log('📄 DOMContentLoaded in main.js');
    await loadSettings();
    await syncThemeToLocalStorage();
    const theme = localStorage.getItem('crm_theme') || 'blue';
    document.documentElement.setAttribute('data-theme', theme);

    const hasPassword = await checkAndLock();
    
    if (!hasPassword) {
        // Запускаем приложение сразу
        await initApplicationLogic();
    }
});

// Вызов после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
    setTimeout(initTooltips, 100);
});

// Экспорт
window.initTooltips = initTooltips;

//  Инициализация навигации (обработчики для кнопок)
function initializeNavigation() {
    const navButtons = document.querySelectorAll('.nav-item[data-url]');
    
    console.log(`🔍 Found ${navButtons.length} navigation buttons`);
    
    navButtons.forEach(btn => {
        // Обработчик клика
        btn.addEventListener('click', (e) => {
            // ПРОВЕРКА БЛОКИРОВКИ
            if (isLocked) {
                e.preventDefault();
                e.stopPropagation();
                showToast('Приложение заблокировано', 'warning');
                return; // Прерываем переход
            }

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

let inactivityTimer;

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        console.log('⏰ Session timeout, locking...');
        sessionStorage.removeItem('app_unlocked');
        window.location.reload(); // Перезагружаем для показа блокировки
    }, 15 * 60 * 1000); // 15 минут
}

async function syncThemeToLocalStorage() {
    try {
        // Читаем тему из файла настроек
        const fileTheme = await getSetting('ui.theme', true);
        
        if (fileTheme) {
            const localTheme = localStorage.getItem('crm_theme');
            
            // Если в localStorage другое значение — обновляем
            if (localTheme !== fileTheme) {
                console.log(`🔄 Syncing theme: localStorage="${localTheme}" → file="${fileTheme}"`);
                localStorage.setItem('crm_theme', fileTheme);
            }
        }
    } catch (error) {
        console.warn('⚠️ Could not sync theme:', error);
    }
}
// Экспортируем функцию для использования в других модулях
if (typeof window !== 'undefined') {
    window.initTooltips = initTooltips;
}
// Сбрасываем таймер при любом действии
document.addEventListener('mousemove', resetInactivityTimer);
document.addEventListener('keypress', resetInactivityTimer);
document.addEventListener('click', resetInactivityTimer);