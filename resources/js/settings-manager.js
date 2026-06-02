// resources/js/settings-manager.js

const SETTINGS_FILE = 'crm_data/settings.json';

const DEFAULT_SETTINGS = {
// {
//   "ui.showTooltips": false,
//   "ui.darkMode": false,
//   "ui.showNavText": true,
//   "ui.animateRows": false,
//   "ui.theme": "corporate",
//   "ui.selectionModifier": "ctrl",
//   "calendar.workDays": {
//     "0": false,
//     "1": false,
//     "2": true,
//     "3": false,
//     "4": false,
//     "5": false,
//     "6": false
//   },
//   "calendar.canEditSchedule": false,
//   "logging": {
//     "cleanupStrategy": "none",
//     "cleanupTime": {
//       "hour": 0,
//       "minute": 0
//     },
//     "maxEntries": 100,
//     "maxAgeDays": 7
//   },
//   "charts.period": {
//     "type": "all",
//     "from": null,
//     "to": null,
//     "appliedAt": "2026-05-31T20:46:08.146Z"
//   },
//   "notifications.deadlineAlerts": true
// }
};

console.log('📦 settings-manager.js loaded');
console.log('📦 DEFAULT_SETTINGS:', DEFAULT_SETTINGS);

// Инициализация глобального объекта
if (typeof window !== 'undefined' && !window.settings) {
    window.settings = { ...DEFAULT_SETTINGS };
}

export async function loadSettings() {
    try {
    
        if (typeof window.Neutralino === 'undefined') {
            console.warn('⚠️ Neutralino not available, using defaults');
            window.settings = { ...DEFAULT_SETTINGS };
            return window.settings;
        }
        
        const data = await window.Neutralino.filesystem.readFile(SETTINGS_FILE);
        const parsed = JSON.parse(data);
        window.settings = { ...DEFAULT_SETTINGS, ...parsed };
        console.log('✅ Settings loaded from file:', Object.keys(window.settings).length, 'keys');
    } catch (error) {
        console.log('⚠️ Settings file not found, creating with defaults');
        window.settings = { ...DEFAULT_SETTINGS };
        if (typeof window.Neutralino !== 'undefined') {
            await saveSettings();
        }
    }
    return window.settings;
}

export async function getSetting(key, fallbackToFile = false) {
    if (window.settings && window.settings[key] !== undefined) {
        return window.settings[key];
    }
    
    if (fallbackToFile && typeof window.Neutralino !== 'undefined') {
        try {
            const data = await window.Neutralino.filesystem.readFile(SETTINGS_FILE);
            const parsed = JSON.parse(data);
            if (parsed[key] !== undefined) {
                window.settings = { ...DEFAULT_SETTINGS, ...parsed };
                return parsed[key];
            }
        } catch (e) {
            console.log(`⚠️ Fallback failed for ${key}:`, e.message);
        }
    }
    
    return DEFAULT_SETTINGS[key];
}

export async function updateSetting(key, value) {
    console.log(`🔧 updateSetting called: ${key} = ${value}`);
    
    if (typeof window.Neutralino === 'undefined') {
        console.error('❌ Neutralino not available, cannot save settings');
        window.settings = { ...window.settings, [key]: value };
        return false;
    }
    
    try {
        let settings = {};
        try {
            const data = await window.Neutralino.filesystem.readFile(SETTINGS_FILE);
            settings = JSON.parse(data);
            console.log('📖 Read existing settings:', Object.keys(settings).length, 'keys');
        } catch (e) {
            console.log('⚠️ No existing settings file, creating new');
        }
        
        settings[key] = value;
        console.log('✏️ Updated key:', key, 'to', value);
        
        window.settings = { ...DEFAULT_SETTINGS, ...settings };
        
        try {
            await window.Neutralino.filesystem.createDirectory('crm_data');
            console.log('📁 Created crm_data directory');
        } catch (e) {}
        
        const jsonContent = JSON.stringify(settings, null, 2);
        await window.Neutralino.filesystem.writeFile(SETTINGS_FILE, jsonContent);
        console.log('💾 Settings saved to file');
        console.log('📄 File content preview:', jsonContent.substring(0, 100) + '...');
        
        return true;
        
    } catch (error) {
        console.error('❌ CRITICAL ERROR in updateSetting:', error);
        console.error('Stack:', error.stack);
        return false;
    }
}

async function saveSettings() {
    try {
        if (typeof window.Neutralino === 'undefined') {
            console.warn('⚠️ Neutralino not available, skipping saveSettings');
            return false;
        }
        
        await window.Neutralino.filesystem.createDirectory('crm_data');
        await window.Neutralino.filesystem.writeFile(
            SETTINGS_FILE, 
            JSON.stringify(window.settings, null, 2)
        );
        console.log('✅ saveSettings: file written');
        return true;
    } catch (error) {
        console.error('❌ saveSettings error:', error);
        return false;
    }
}

export async function getSettingFromFile(key) {
    try {
        if (typeof window.Neutralino === 'undefined') {
            console.error('❌ Neutralino not available');
            return undefined;
        }
        
        const data = await window.Neutralino.filesystem.readFile(SETTINGS_FILE);
        const parsed = JSON.parse(data);
        return parsed[key];
    } catch (e) {
        console.error(`❌ Could not read "${key}" from file:`, e);
        return undefined;
    }
}