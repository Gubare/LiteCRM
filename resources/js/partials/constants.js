// resources\js\partials\constants.js

// ============================================
// КОНФИГУРАЦИЯ ПРИЛОЖЕНИЯ
// ============================================
export const APP_CONFIG = {
    NAME: 'CRM System',
    VERSION: '1.1.0',
    DB_NAME: 'CRM_Database',
    DB_VERSION: 6,
    DEFAULT_PAGE_SIZE: 10,
    BACKUP_FILE: 'crm_data/backup.json',
    LOGS_FILE: 'crm_data/logs.json',
    SETTINGS_FILE: 'crm_data/settings.json'
};


export const THEMES = {
    BLUE: {
        name: 'Синяя (по умолчанию)',
        id: 'blue'
    },
    EXCEL: {
        name: 'Зелёная (Excel)',
        id: 'excel'
    },
    ONEC: {
        name: '1С:Предприятие',
        id: '1c'
    }
};