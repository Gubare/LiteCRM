// resources/js/db_config.js

// Типы поддерживаемых БД
export const DB_TYPES = {
    INDEXEDDB: 'indexeddb',
    SQLITE: 'sqlite'
};

// Конфигурация по умолчанию
export const DB_CONFIG = {
    // Измените здесь для переключения БД
    type: DB_TYPES.SQLITE,  // 'indexeddb' | 'sqlite'
    
    // Настройки IndexedDB
    indexedDB: {
        name: 'CRM_Database',
        version: 6
    },
    
    // Настройки SQLite
    sqlite: {
        wasmPath: './js/sql-wasm.wasm',
        filename: 'crm_data.sqlite' // для сохранения на диск (через Neutralino FS)
    },
    
    // Автоматическая синхронизация (опционально)
    sync: {
        enabled: false,  // Если true — данные дублируются в обе БД
        primary: DB_TYPES.INDEXEDDB  // Какая БД считается основной для чтения
    }
};

// Глобальный экземпляр конфигурации
export let currentConfig = { ...DB_CONFIG };

// Функция для изменения конфигурации на лету
export function configureDB(newConfig) {
    currentConfig = { ...currentConfig, ...newConfig };
    console.log('🔧 DB config updated:', currentConfig.type);
    return currentConfig;
}

// Получить текущий тип БД
export function getDBType() {
    return currentConfig.type;
}