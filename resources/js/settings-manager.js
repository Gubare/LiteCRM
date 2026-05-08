// resources/js/settings-manager.js

const SETTINGS_FILE = 'crm_data/settings.json';

// Значения по умолчанию (расширяемы)
const DEFAULT_SETTINGS = {
    'ui.showTooltips': true,
    'ui.darkMode': false,
    'ui.showNavText': true,
    'ui.animateRows': true
};

let currentSettings = { ...DEFAULT_SETTINGS };

// 1. Загрузка настроек при старте
export async function loadSettings() {
    try {
        const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
        const parsed = JSON.parse(data);
        // Объединяем с дефолтными, чтобы новые настройки не терялись
        currentSettings = { ...DEFAULT_SETTINGS, ...parsed };
        console.log('✅ Settings loaded');
    } catch (error) {
        console.log('⚠️ Settings file not found, using defaults');
        currentSettings = { ...DEFAULT_SETTINGS };
        // Можно сразу сохранить дефолтные, если хотите
        await saveSettings(); 
    }
    return currentSettings;
}

// 2. Получение конкретного значения
export function getSetting(key) {
    return currentSettings[key] !== undefined ? currentSettings[key] : DEFAULT_SETTINGS[key];
}

// 3. Мгновенное сохранение конкретного флага
export async function updateSetting(key, value) {
    currentSettings[key] = value;
    await saveSettings();
    console.log(`💾 Setting updated: ${key} = ${value}`);
}

// Внутренняя функция записи в файл
async function saveSettings() {
    try {
        // Убедимся, что папка существует (можно вынести в main.js при старте)
        try { await Neutralino.filesystem.createDirectory('crm_data'); } catch(e) {}
        
        await Neutralino.filesystem.writeFile(SETTINGS_FILE, JSON.stringify(currentSettings, null, 2));
    } catch (error) {
        console.error('❌ Error saving settings:', error);
    }
}

export { currentSettings };