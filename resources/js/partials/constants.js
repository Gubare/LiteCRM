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
        id: 'blue',
        colors: {
            primary: '#3b82f6',
            primaryHover: '#2563eb',
            success: '#10b981',
            danger: '#ef4444',
            warning: '#f59e0b',
            info: '#06b6d4',
            background: '#f8fafc',
            border: '#e2e8f0'
        }
    },
    EXCEL: {
        name: 'Зелёная (Excel)',
        id: 'excel',
        colors: {
            primary: '#217346',
            primaryHover: '#1a5c38',
            success: '#10b981',
            danger: '#dc2626',
            warning: '#f59e0b',
            info: '#0891b2',
            background: '#f0f4f1',
            border: '#c8d6ce'
        }
    }
};