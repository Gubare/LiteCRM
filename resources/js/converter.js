// resources/js/converter.js
// Конвертер форматов: CSV ↔ JSON ↔ SQLite

import { initDatabase as initSqliteDatabase, getDbInstance as getSqliteInstance } from './db_sqlite.js';
import { logAction } from './logger.js';

// === УТИЛИТЫ ===

// Показать уведомление
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
        position: fixed; bottom: 20px; right: 20px; 
        background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'};
        color: white; padding: 12px 20px; border-radius: 8px; 
        z-index: 9999; animation: fadeIn 0.3s;
    `;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Показать модальное окно
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

// === CSV УТИЛИТЫ ===

// Простой парсер CSV (поддерживает кавычки и запятые в полях)
function parseCSV(csvText) {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0]);
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i]);
        const row = {};
        headers.forEach((header, idx) => {
            row[header.trim()] = values[idx]?.trim() || '';
        });
        rows.push(row);
    }
    
    return rows;
}

function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const next = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && next === '"') {
                current += '"';
                i++;
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

// Конвертация объекта в CSV
function toCSV(data, headers = null) {
    if (!data || data.length === 0) return '';
    
    const keys = headers || Object.keys(data[0]);
    const lines = [keys.join(',')];
    
    for (const row of data) {
        const values = keys.map(key => {
            let val = row[key] ?? '';
            if (typeof val === 'string' && (val.includes(',') || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        lines.push(values.join(','));
    }
    
    return lines.join('\n');
}

// === КОНВЕРТЕРЫ ===

// 1. CSV → JSON
export async function csv2json(csvText) {
    try {
        const data = parseCSV(csvText);
        return JSON.stringify(data, null, 2);
    } catch (error) {
        throw new Error(`CSV parsing error: ${error.message}`);
    }
}

// 2. JSON → CSV
export function json2csv(jsonText, storeName = 'data') {
    try {
        const data = JSON.parse(jsonText);
        const items = Array.isArray(data) ? data : (data.items || data.stores?.find(s => s.store === storeName)?.items || []);
        if (!items || !items.length) throw new Error('No data to convert');
        return toCSV(items);
    } catch (error) {
        throw new Error(`JSON to CSV error: ${error.message}`);
    }
}

// 3. JSON → SQLite
export async function json2sql(jsonText, targetFile = 'crm_data.sqlite') {
    try {
        const { initDatabase, saveDatabaseToFile } = await import('./db_sqlite.js');
        
        // Инициализируем БД
        await initDatabase();
        const db = getSqliteInstance();
        if (!db) throw new Error('SQLite not initialized');
        
        const backup = JSON.parse(jsonText);
        const stores = backup.stores || [{ store: 'data', items: Array.isArray(backup) ? backup : [backup] }];
        
        for (const { store, items } of stores) {
            if (!items?.length) continue;
            
            // Создаём таблицу если нет
            const columns = Object.keys(items[0]);
            const colDefs = columns.map(col => {
                const type = typeof items[0][col];
                return `${col} ${type === 'number' ? (Number.isInteger(items[0][col]) ? 'INTEGER' : 'REAL') : 'TEXT'}`;
            }).join(', ');
            
            db.run(`CREATE TABLE IF NOT EXISTS ${store} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
            
            // Вставляем данные
            for (const item of items) {
                const cols = Object.keys(item).filter(k => k !== 'id');
                const vals = cols.map(k => item[k]);
                const placeholders = cols.map(() => '?').join(', ');
                
                const stmt = db.prepare(`INSERT INTO ${store} (${cols.join(', ')}) VALUES (${placeholders})`);
                stmt.bind(vals);
                stmt.step();
                stmt.free();
            }
        }
        
        // Сохраняем на диск
        if (typeof Neutralino !== 'undefined' && saveDatabaseToFile) {
            await saveDatabaseToFile();
        }
        
        return true;
    } catch (error) {
        throw new Error(`JSON to SQLite error: ${error.message}`);
    }
}

// 4. SQLite → JSON
export async function sql2json(sourceFile = 'crm_data.sqlite', stores = null) {
    try {
        const { initDatabase } = await import('./db_sqlite.js');
        await initDatabase();
        const db = getSqliteInstance();
        if (!db) throw new Error('SQLite not initialized');
        
        // Получаем список таблиц
        const tables = stores || db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")[0]?.values.map(r => r[0]) || [];
        
        const result = {
            version: 6,
            exported_at: new Date().toISOString(),
            stores: []
        };
        
        for (const tableName of tables) {
            try {
                const query = db.exec(`SELECT * FROM ${tableName}`);
                if (!query.length) continue;
                
                const columns = query[0].columns;
                const items = query[0].values.map(row => {
                    const item = {};
                    columns.forEach((col, i) => {
                        item[col] = row[i];
                    });
                    return item;
                });
                
                result.stores.push({ store: tableName, items });
            } catch (e) {
                console.warn(`⚠️ Could not export table ${tableName}:`, e);
            }
        }
        
        return JSON.stringify(result, null, 2);
    } catch (error) {
        throw new Error(`SQLite to JSON error: ${error.message}`);
    }
}

// === ИМПОРТ/ЭКСПОРТ ФАЙЛОВ ===

// Импорт: внешний файл → crm_data.{type}
export async function importFile(sourcePath, sourceType, targetType) {
    try {
        let data;
        
        // Читаем исходный файл
        if (typeof Neutralino !== 'undefined') {
            const content = await Neutralino.filesystem.readFile(sourcePath);
            data = content;
        } else {
            throw new Error('Neutralino required for file operations');
        }
        
        // Конвертируем
        let converted;
        switch (`${sourceType}2${targetType}`) {
            case 'csv2json':
                converted = await csv2json(data);
                break;
            case 'json2csv':
                converted = json2csv(data);
                break;
            case 'json2sql':
                await json2sql(data);
                converted = 'success';
                break;
            case 'sql2json':
                converted = await sql2json();
                break;
            default:
                throw new Error(`Unsupported conversion: ${sourceType} → ${targetType}`);
        }
        
        // Сохраняем результат
        if (converted !== 'success' && targetType !== 'sql') {
            const outputPath = `crm_data/crm_data.${targetType}`;
            await Neutralino.filesystem.createDirectory('crm_data');
            await Neutralino.filesystem.writeFile(outputPath, converted);
            logAction('import', 'converter', null, { source: sourcePath, target: outputPath, type: `${sourceType}2${targetType}` });
        }
        
        showToast(`✅ Конвертация завершена: ${sourceType} → ${targetType}`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Import error:', error);
        showToast(`❌ Ошибка: ${error.message}`, 'error');
        throw error;
    }
}

// Экспорт: crm_data.{type} → пользовательский путь
export async function exportFile(sourceType, targetType, outputPath) {
    try {
        let data;
        
        // Читаем исходные данные
        if (sourceType === 'sql') {
            data = await sql2json();
        } else {
            const sourcePath = `crm_data/crm_data.${sourceType}`;
            data = await Neutralino.filesystem.readFile(sourcePath);
        }
        
        // Конвертируем
        let converted;
        switch (`${sourceType}2${targetType}`) {
            case 'json2csv':
                converted = json2csv(data);
                break;
            case 'csv2json':
                converted = await csv2json(data);
                break;
            case 'json2sql':
                await json2sql(data, outputPath);
                converted = 'success';
                break;
            case 'sql2json':
                converted = data; // уже JSON
                break;
            default:
                converted = data; // без конвертации
        }
        
        // Сохраняем
        if (converted !== 'success' && targetType !== 'sql') {
            await Neutralino.filesystem.writeFile(outputPath, converted);
        }
        
        logAction('export', 'converter', null, { source: `crm_data.${sourceType}`, target: outputPath, type: `${sourceType}2${targetType}` });
        showToast(`✅ Экспорт завершён: ${outputPath}`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Export error:', error);
        showToast(`❌ Ошибка: ${error.message}`, 'error');
        throw error;
    }
}

// === ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ===

export function initConverter() {
    console.log('🔄 Initializing converter...');
    
    // Модальные окна
    setupImportModal();
    setupExportModal();
    
    // Кнопки
    document.getElementById('btnImportData')?.addEventListener('click', () => openModal('importModal'));
    document.getElementById('btnExportData')?.addEventListener('click', () => openModal('exportModal'));
}

function setupImportModal() {
    const modal = document.getElementById('importModal');
    if (!modal) return;
    
    // Закрытие
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal('importModal'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('importModal');
    });
    
    // Выбор файла через проводник
    const btnBrowse = document.getElementById('importBrowse');
    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            try {
                const filters = [
                    { name: 'CSV files', extensions: ['csv'] },
                    { name: 'JSON files', extensions: ['json'] },
                    { name: 'SQLite files', extensions: ['sqlite', 'db'] },
                    { name: 'All files', extensions: ['*'] }
                ];
                
                const result = await Neutralino.os.showOpenDialog('Выберите файл для импорта', {
                    filters: filters,
                    multiSelections: false
                });
                
                if (result?.[0]) {
                    document.getElementById('importFilePath').value = result[0];
                }
            } catch (error) {
                showToast('❌ Ошибка выбора файла', 'error');
            }
        });
    }
    
    // Кнопка импорта
    document.getElementById('btnDoImport')?.addEventListener('click', async () => {
        const sourcePath = document.getElementById('importFilePath').value;
        const sourceType = document.getElementById('importSourceType').value;
        const targetType = document.getElementById('importTargetType').value;
        
        if (!sourcePath) {
            showToast('⚠️ Выберите файл', 'error');
            return;
        }
        
        try {
            document.getElementById('btnDoImport').disabled = true;
            document.getElementById('btnDoImport').textContent = '⏳ Конвертация...';
            
            await importFile(sourcePath, sourceType, targetType);
            closeModal('importModal');
            
            // Обновляем страницу если нужно
            if (targetType === 'json' || targetType === 'sql') {
                setTimeout(() => window.location.reload(), 1000);
            }
            
        } catch (error) {
            // Ошибка уже показана в importFile
        } finally {
            document.getElementById('btnDoImport').disabled = false;
            document.getElementById('btnDoImport').textContent = 'Импортировать';
        }
    });
}

function setupExportModal() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    
    // Закрытие
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal('exportModal'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('exportModal');
    });
    
    // Выбор директории
    const btnBrowse = document.getElementById('exportBrowse');
    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            try {
                const result = await Neutralino.os.showFolderDialog('Выберите папку для сохранения');
                if (result) {
                    document.getElementById('exportDirPath').value = result;
                }
            } catch (error) {
                showToast('❌ Ошибка выбора папки', 'error');
            }
        });
    }
    
    // Кнопка экспорта
    document.getElementById('btnDoExport')?.addEventListener('click', async () => {
        const sourceType = document.getElementById('exportSourceType').value;
        const targetType = document.getElementById('exportTargetType').value;
        const dirPath = document.getElementById('exportDirPath').value;
        const fileName = document.getElementById('exportFileName').value || `crm_export_${Date.now()}`;
        
        if (!dirPath) {
            showToast('⚠️ Выберите папку', 'error');
            return;
        }
        
        const outputPath = `${dirPath}/${fileName}.${targetType}`;
        
        try {
            document.getElementById('btnDoExport').disabled = true;
            document.getElementById('btnDoExport').textContent = '⏳ Экспорт...';
            
            await exportFile(sourceType, targetType, outputPath);
            closeModal('exportModal');
            
        } catch (error) {
            // Ошибка уже показана
        } finally {
            document.getElementById('btnDoExport').disabled = false;
            document.getElementById('btnDoExport').textContent = 'Экспортировать';
        }
    });
}

// Глобальный экспорт для HTML
window.converter = {
    importFile,
    exportFile,
    csv2json,
    json2csv,
    json2sql,
    sql2json,
    initConverter,
    showToast,
    openModal,
    closeModal
};