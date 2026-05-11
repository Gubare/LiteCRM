// resources/js/logger.js
const LOG_FILE = 'crm_data/logs.json';
const SETTINGS_FILE = 'crm_data/settings.json';
let logQueue = [];
let isWriting = false;
let cleanupInterval = null;

// Инициализация
export async function initLogger() {
    try {
        await Neutralino.filesystem.createDirectory('crm_data');
        
        // Создаём файл логов если нет
        try {
            await Neutralino.filesystem.getStats(LOG_FILE);
        } catch {
            await Neutralino.filesystem.writeFile(LOG_FILE, '[]');
            console.log('✅ Log file created');
        }
        
        // Запускаем планировщик очистки
        startCleanupScheduler();
        
    } catch (error) {
        console.error('❌ Logger init error:', error);
    }
}

// Планировщик очистки (проверяет каждые 5 минут)
function startCleanupScheduler() {
    if (cleanupInterval) clearInterval(cleanupInterval);
    
    cleanupInterval = setInterval(async () => {
        try {
            const settings = await getLogSettings();
            if (!settings || settings.cleanupStrategy === 'none') return;
            
            const now = new Date();
            const shouldCleanup = await checkCleanupTime(settings, now);
            
            if (shouldCleanup) {
                console.log('🗑️ Running scheduled cleanup...');
                await performCleanup(settings);
                // Обновляем время последней очистки
                settings.lastCleanup = now.toISOString();
                await Neutralino.filesystem.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
            }
        } catch (error) {
            console.error('❌ Scheduled cleanup failed:', error);
        }
    }, 5 * 60 * 1000); // Каждые 5 минут
}

// Проверка времени очистки
async function checkCleanupTime(settings, now) {
    if (!settings.cleanupStrategy || settings.cleanupStrategy === 'none') return false;
    
    // Если уже чистили сегодня/на этой неделе
    if (settings.lastCleanup) {
        const last = new Date(settings.lastCleanup);
        const hoursDiff = (now - last) / (1000 * 60 * 60);
        
        if (settings.cleanupStrategy === 'daily' && hoursDiff < 24) return false;
        if (settings.cleanupStrategy === 'weekly') {
            const lastDay = last.getDay(); // 0=Вс
            const currentDay = now.getDay();
            if (currentDay !== 0 || hoursDiff < 24 * 7) return false; // Только воскресенье
        }
    }
    
    // Для daily: проверяем время
    if (settings.cleanupStrategy === 'daily') {
        const cleanupHour = settings.cleanupTime?.hour || 0;
        const cleanupMinute = settings.cleanupTime?.minute || 0;
        if (now.getHours() !== cleanupHour || now.getMinutes() < cleanupMinute) return false;
    }
    
    // Для weekly: проверяем день и время
    if (settings.cleanupStrategy === 'weekly') {
        if (now.getDay() !== 0) return false; // Только воскресенье
        const cleanupHour = settings.cleanupTime?.hour || 23;
        const cleanupMinute = settings.cleanupTime?.minute || 59;
        if (now.getHours() !== cleanupHour || now.getMinutes() < cleanupMinute) return false;
    }
    
    return true;
}

// Выполнение очистки
async function performCleanup(settings) {
    try {
        let logs = [];
        try {
            const data = await Neutralino.filesystem.readFile(LOG_FILE);
            logs = JSON.parse(data);
        } catch {
            return;
        }
        
        const originalCount = logs.length;
        
        if (settings.cleanupStrategy === 'maxEntries' && settings.maxEntries) {
            // Оставляем только последние N записей
            const toDelete = logs.length - settings.maxEntries;
            if (toDelete > 0) {
                logs = logs.slice(-settings.maxEntries);
                console.log(`🗑️ Removed ${toDelete} old log entries (maxEntries limit)`);
            }
        }
        
        if (settings.cleanupStrategy === 'ageBased' && settings.maxAgeDays) {
            // Удаляем старше N дней
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - settings.maxAgeDays);
            
            const filteredLogs = logs.filter(log => {
                const logDate = new Date(log.timestamp);
                return logDate > cutoffDate;
            });
            
            const deleted = logs.length - filteredLogs.length;
            logs = filteredLogs;
            if (deleted > 0) console.log(`🗑️ Removed ${deleted} entries older than ${settings.maxAgeDays} days`);
        }
        
        // Сохраняем
        if (logs.length !== originalCount) {
            await Neutralino.filesystem.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
            console.log(`✅ Cleanup complete: ${originalCount} → ${logs.length} entries`);
        }
    } catch (error) {
        console.error('❌ Cleanup error:', error);
    }
}

// Внутренняя запись в лог
async function processQueue() {
    if (isWriting || logQueue.length === 0) return;
    isWriting = true;

    const entry = logQueue.shift();
    try {
        let logs = [];
        try {
            const data = await Neutralino.filesystem.readFile(LOG_FILE);
            logs = JSON.parse(data);
        } catch {
            logs = [];
        }

        logs.push({
            id: logs.length + 1,
            timestamp: new Date().toISOString(),
            action: entry.action,
            store: entry.store,
            recordId: entry.recordId,
            data: entry.data, // 🔥 Теперь всегда содержит данные (даже при удалении)
            metadata: entry.metadata || {}
        });

        await Neutralino.filesystem.writeFile(LOG_FILE, JSON.stringify(logs, null, 2));
        
        // Сразу проверяем нужно ли чистить (для maxEntries)
        const settings = await getLogSettings();
        if (settings.cleanupStrategy === 'maxEntries' && logs.length > settings.maxEntries) {
            await performCleanup(settings);
        }
        
    } catch (error) {
        console.error('❌ Log write failed:', error);
    } finally {
        isWriting = false;
        if (logQueue.length > 0) processQueue();
    }
}

// Публичная функция логирования
export function logAction(action, store, recordId, data = null, metadata = {}) {
    logQueue.push({ action, store, recordId, data, metadata });
    processQueue();
}

// Получение настроек логирования
async function getLogSettings() {
    try {
        const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
        const settings = JSON.parse(data);
        return settings.logging || {
            cleanupStrategy: 'none',
            lastCleanup: null
        };
    } catch {
        return { cleanupStrategy: 'none', lastCleanup: null };
    }
}

// Сохранение настроек логирования
export async function saveLogSettings(settings) {
    try {
        const data = await Neutralino.filesystem.readFile(SETTINGS_FILE);
        const current = JSON.parse(data);
        current.logging = settings;
        await Neutralino.filesystem.writeFile(SETTINGS_FILE, JSON.stringify(current, null, 2));
        
        // Перезапускаем планировщик
        startCleanupScheduler();
        return true;
    } catch (error) {
        console.error('❌ Failed to save log settings:', error);
        return false;
    }
}

// Ручная очистка
export async function manualCleanup() {
    const settings = await getLogSettings();
    await performCleanup(settings);
    return true;
}

// Получение статистики логов
export async function getLogStats() {
    try {
        const data = await Neutralino.filesystem.readFile(LOG_FILE);
        const logs = JSON.parse(data);
        
        const stats = {
            total: logs.length,
            byAction: { create: 0, update: 0, delete: 0 },
            byStore: {},
            oldest: logs[0]?.timestamp || null,
            newest: logs[logs.length - 1]?.timestamp || null
        };
        
        logs.forEach(log => {
            stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
            stats.byStore[log.store] = (stats.byStore[log.store] || 0) + 1;
        });
        
        return stats;
    } catch {
        return { total: 0, byAction: {}, byStore: {} };
    }
}

// Экспорт логов в CSV
export async function exportLogsToCSV() {
    try {
        const data = await Neutralino.filesystem.readFile(LOG_FILE);
        const logs = JSON.parse(data);
        
        let csv = 'ID,Дата,Действие,Таблица,ID записи,Данные\n';
        logs.forEach(log => {
            const escapedData = JSON.stringify(log.data).replace(/"/g, '""');
            csv += `${log.id},"${log.timestamp}",${log.action},${log.store},${log.recordId},"${escapedData}"\n`;
        });
        
        const filePath = `crm_data/logs_${new Date().toISOString().split('T')[0]}.csv`;
        await Neutralino.filesystem.writeFile(filePath, csv);
        return filePath;
    } catch (error) {
        console.error('❌ CSV export failed:', error);
        return null;
    }
}

// Очистка всех логов
export async function clearAllLogs() {
    try {
        await Neutralino.filesystem.writeFile(LOG_FILE, '[]');
        return true;
    } catch (error) {
        console.error('❌ Failed to clear logs:', error);
        return false;
    }
}