// resources/js/settings-manager.js
const SETTINGS_FILE = 'crm_data/settings.json';

const DEFAULT_SETTINGS = {
    'ui.showTooltips': true,
    'ui.darkMode': false,
    'ui.showNavText': true,
    'ui.animateRows': true
};

// 🔥 Единый источник правды — глобальный объект
if (typeof window !== 'undefined' && !window.settings) {
    window.settings = { ...DEFAULT_SETTINGS };
}

// Загрузка настроек при старте
export async function loadSettings() {
    try {
        const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
        const parsed = JSON.parse(data);
        // 🔥 Обновляем глобальный кэш
        window.settings = { ...DEFAULT_SETTINGS, ...parsed };
        console.log('✅ Settings loaded:', Object.keys(window.settings).length, 'keys');
    } catch (error) {
        console.log('⚠️ Settings file not found, using defaults');
        window.settings = { ...DEFAULT_SETTINGS };
        await saveSettings(); // Создаём файл с дефолтами
    }
    return window.settings;
}

// Получение настройки (с опциональным фолбэком на файл)
// 🔥 fallbackToFile = true для критичных проверок (пароль, лицензии)
export async function getSetting(key, fallbackToFile = false) {
    // 1. Быстрая проверка в памяти
    if (window.settings && window.settings[key] !== undefined) {
        return window.settings[key];
    }
    
    // 2. 🔥 Фолбэк: читаем из файла напрямую (только если запрошено)
    if (fallbackToFile && typeof Neutralino !== 'undefined') {
        try {
            const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
            const parsed = JSON.parse(data);
            if (parsed[key] !== undefined) {
                // 🔥 Обновляем кэш на будущее
                window.settings = { ...DEFAULT_SETTINGS, ...parsed };
                console.log(`🔄 Setting "${key}" restored from file fallback`);
                return parsed[key];
            }
        } catch (e) {
            console.log(`⚠️ Fallback read failed for "${key}":`, e.message);
        }
    }
    
    // 3. Возвращаем дефолтное значение
    return DEFAULT_SETTINGS[key];
}

// 🔥 Экстренное чтение из файла (для отладки или аварийных случаев)
export async function getSettingFromFile(key) {
    try {
        const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
        const parsed = JSON.parse(data);
        return parsed[key];
    } catch (e) {
        console.error(`❌ Could not read "${key}" from file:`, e);
        return undefined;
    }
}

// Обновление настройки
export async function updateSetting(key, value) {
    try {
        // 1. Читаем актуальные данные из файла (чтобы не потерять другие настройки)
        let settings = {};
        try {
            const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
            settings = JSON.parse(data);
        } catch (e) {
            console.log('⚠️ Settings file not found, creating new');
        }
        
        // 2. Обновляем нужное поле
        settings[key] = value;
        
        // 3. 🔥 Синхронизируем глобальный кэш
        window.settings = { ...DEFAULT_SETTINGS, ...settings };
        
        // 4. Создаём директорию если нет
        try {
            await Neutralino.filesystem.createDirectory('crm_data');
        } catch (e) {}
        
        // 5. Записываем файл
        await Neutralino.filesystem.writeFile(
            SETTINGS_FILE,
            JSON.stringify(settings, null, 2)
        );
        
        console.log(`✅ Setting updated: ${key} = ${value}`);
        return true;
        
    } catch (error) {
        console.error('❌ Error updating setting:', error);
        return false;
    }
}

// Внутренняя функция сохранения (использует window.settings)
async function saveSettings() {
    try {
        try { await Neutralino.filesystem.createDirectory('crm_data'); } catch(e) {}
        
        await Neutralino.filesystem.writeFile(
            SETTINGS_FILE, 
            JSON.stringify(window.settings, null, 2)
        );
        console.log('✅ Settings saved to file');
    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }
}