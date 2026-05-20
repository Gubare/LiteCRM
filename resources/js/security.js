// resources/js/security.js
// import { getSetting } from "./settings-manager";
// Хеширование пароля (SHA-256)
export async function hashPassword(password) {
    if (!password) return null;
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Проверка пароля
export async function verifyPassword(inputPassword, storedHash) {
    if (!storedHash) return false; // Если хеша нет, пароль не задан
    const inputHash = await hashPassword(inputPassword);
    return inputHash === storedHash;
}

// Функция создания экрана блокировки
export function createLockScreen() {
    if (document.getElementById('lockOverlay')) return;
    
    const overlay = document.createElement('div');
    overlay.id = 'lockOverlay';
    overlay.innerHTML = `
        <div class="lock-content">
            <div class="lock-icon-wrapper" id="lockIconWrapper">
                <!-- SVG иконка замка -->
                <svg class="lock-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"></path>
                </svg>
            </div>
            <h2>CRM System</h2>
            <p>Введите пароль для доступа</p>
            <input type="password" id="lockPasswordInput" class="lock-input" placeholder="Пароль" autofocus>
            <button id="btnUnlock" class="btn-primary" style="margin-top: 15px;">Войти</button>
            <p id="lockError" class="lock-error"></p>
        </div>
    `;
    
    // Стили
    overlay.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(15, 23, 42, 0.95); z-index: 99999; 
        display: flex; align-items: center; justify-content: center;
    `;
    
    const content = overlay.querySelector('.lock-content');
    content.style.cssText = `
        background: #1e293b; padding: 40px; border-radius: 16px; 
        text-align: center; width: 350px; box-shadow: 0 20px 50px rgba(0,0,0,0.5);
    `;
    
    document.body.appendChild(overlay);
    
    // === АНИМАЦИЯ ТРЯСКИ ===
    function shakeIcon() {
        const iconWrapper = document.getElementById('lockIconWrapper');
        if (!iconWrapper) return;
        
        // Добавляем класс анимации
        iconWrapper.classList.add('shake');
        
        // Меняем цвет на красный
        iconWrapper.style.color = '#ef4444';
        
        // Убираем анимацию через 500мс
        setTimeout(() => {
            iconWrapper.classList.remove('shake');
            iconWrapper.style.color = ''; // Возвращаем исходный цвет
        }, 500);
    }
    
    // === ОБРАБОТЧИКИ ===
    const input = overlay.querySelector('#lockPasswordInput');
    const btn = overlay.querySelector('#btnUnlock');
    
    const tryUnlock = async () => {
        const pass = input.value;
        let savedHash = null;
        try {
            const data = await Neutralino.filesystem.readFile('crm_data/settings.json');
            const settings = JSON.parse(data);
            savedHash = settings['auth.passwordHash'];
            window.settings = settings; // Обновляем глобально
        } catch (e) {
            console.log('⚠️ Could not read settings file');
        }
        
        if (await verifyPassword(pass, savedHash)) {
            overlay.remove();
            isLocked = false;
            // Разрешаем навигацию и загрузку данных
            sessionStorage.setItem('app_unlocked', 'true');
            initApplicationLogic(); 
        } else {
            // Показываем ошибку и трясём иконку
            overlay.querySelector('#lockError').textContent = '❌ Неверный пароль';
            shakeIcon();
            input.value = '';
            input.focus();
        }
    };
    
    btn.addEventListener('click', tryUnlock);
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') tryUnlock();
    });
}


// const DEFAULT_SETTINGS = {
//     'ui.showTooltips': false,
//     "ui.theme": "",
//     // 'ui.darkMode': false,
//     // 'ui.showNavText': true,
//     // 'ui.animateRows': true
// };

// let currentSettings = { ...DEFAULT_SETTINGS };
// export function getSetting(key) {
//     return currentSettings[key] !== undefined ? currentSettings[key] : DEFAULT_SETTINGS[key];
// }

let savedHash = null;
    try {
        const data = await Neutralino.filesystem.readFile('crm_data/settings.json');
        const settings = JSON.parse(data);
        savedHash = settings['auth.passwordHash'];
        window.settings = settings; // Обновляем глобально
    } catch (e) {
        console.log('⚠️ Could not read settings file');
}
        