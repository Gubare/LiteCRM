// resources/js/converter.js
// Конвертер форматов: CSV ↔ JSON ↔ SQLite

import { initDatabase as initSqliteDatabase, getDbInstance as getSqliteInstance } from './db_sqlite.js';
import { logAction } from './logger.js';

// === УТИЛИТЫ ===

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

function parseCSVLine(line, delimiter = ';') {
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
        } else if (char === delimiter && !inQuotes) {
            result.push(current);
            current = '';
        } else {
            current += char;
        }
    }
    result.push(current);
    return result;
}

function parseCSV(csvText, delimiter = ';') {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];
    
    const headers = parseCSVLine(lines[0], delimiter);
    const rows = [];
    
    for (let i = 1; i < lines.length; i++) {
        if (!lines[i].trim()) continue;
        const values = parseCSVLine(lines[i], delimiter);
        const row = {};
        headers.forEach((header, idx) => {
            row[header.trim()] = values[idx]?.trim() || '';
        });
        rows.push(row);
    }
    
    return rows;
}

// Конвертация объекта в CSV с разделителем ;
function toCSV(data, headers = null, delimiter = ';') {
    if (!data || data.length === 0) return '';
    
    const keys = headers || Object.keys(data[0]);
    const lines = [keys.join(delimiter)];
    
    for (const row of data) {
        const values = keys.map(key => {
            let val = row[key] ?? '';
            if (typeof val === 'string' && (val.includes(delimiter) || val.includes('"') || val.includes('\n'))) {
                val = `"${val.replace(/"/g, '""')}"`;
            }
            return val;
        });
        lines.push(values.join(delimiter));
    }
    
    return lines.join('\n');
}

// === КОНВЕРТЕРЫ ===

// 1. CSV → JSON
export async function csv2json(csvText, delimiter = ';') {
    try {
        const data = parseCSV(csvText, delimiter);
        return JSON.stringify(data, null, 2);
    } catch (error) {
        throw new Error(`CSV parsing error: ${error.message}`);
    }
}

// 2. JSON → CSV (возвращает объект: { tableName: csvContent })
export function json2csv(jsonText, storeName = null) {
    console.log('🔄 json2csv called, input type:', typeof jsonText);
    
    try {
        const data = typeof jsonText === 'string' ? JSON.parse(jsonText) : jsonText;
        console.log('📊 Parsed data keys:', Object.keys(data));
        
        // Если это структура с stores (как при экспорте из SQLite)
        if (data.stores && Array.isArray(data.stores)) {
            console.log('📦 Found stores array, count:', data.stores.length);
            const result = {};
            for (const store of data.stores) {
                if (store.items && store.items.length > 0) {
                    console.log(`✅ Table "${store.store}": ${store.items.length} items`);
                    result[store.store] = toCSV(store.items, null, ';');
                } else {
                    console.log(`⚠️ Table "${store.store}" has no items`);
                }
            }
            console.log('📤 Returning object with tables:', Object.keys(result));
            return result;
        }
        
        // Если это массив или объект с items
        const items = Array.isArray(data) ? data : (data.items || []);
        if (!items || !items.length) {
            console.warn('⚠️ No items found in data');
            throw new Error('No data to convert');
        }
        
        // Если указано имя таблицы
        if (storeName) {
            console.log(`📤 Returning single table: ${storeName}`);
            return { [storeName]: toCSV(items, null, ';') };
        }
        
        // Иначе используем 'data' как имя таблицы
        console.log('📤 Returning single table: data');
        return { data: toCSV(items, null, ';') };
        
    } catch (error) {
        console.error('❌ json2csv error:', error);
        throw new Error(`JSON to CSV error: ${error.message}`);
    }
}


// 3. JSON → SQLite
export async function json2sql(jsonText, targetFile = 'crm_data.sqlite') {
    try {
        const { initDatabase, saveDatabaseToFile } = await import('./db_sqlite.js');
        
        await initDatabase();
        const db = getSqliteInstance();
        if (!db) throw new Error('SQLite not initialized');
        
        const backup = JSON.parse(jsonText);
        const stores = backup.stores || [{ store: 'data', items: Array.isArray(backup) ? backup : [backup] }];
        
        for (const { store, items } of stores) {
            if (!items?.length) continue;
            
            const columns = Object.keys(items[0]);
            const colDefs = columns.map(col => {
                const type = typeof items[0][col];
                return `${col} ${type === 'number' ? (Number.isInteger(items[0][col]) ? 'INTEGER' : 'REAL') : 'TEXT'}`;
            }).join(', ');
            
            db.run(`CREATE TABLE IF NOT EXISTS ${store} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
            
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

// 5. CSV → SQLite
export async function csv2sql(csvText, targetFile = 'crm_data.sqlite', tableName = 'imported_data', delimiter = ';') {
    try {
        const { initDatabase, saveDatabaseToFile } = await import('./db_sqlite.js');
        
        // Сначала конвертируем CSV в JSON
        const jsonData = await csv2json(csvText, delimiter);
        const data = JSON.parse(jsonData);
        
        if (!data || data.length === 0) {
            throw new Error('CSV файл пуст или некорректен');
        }
        
        // Инициализируем БД
        await initDatabase();
        const db = getSqliteInstance();
        if (!db) throw new Error('SQLite not initialized');
        
        // Определяем колонки из первой записи
        const columns = Object.keys(data[0]);
        
        // Определяем типы колонок
        const colTypes = columns.map(col => {
            const sampleValue = data[0][col];
            if (sampleValue === null || sampleValue === '') return `${col} TEXT`;
            if (!isNaN(sampleValue) && sampleValue !== '') {
                return Number.isInteger(parseFloat(sampleValue)) ? `${col} INTEGER` : `${col} REAL`;
            }
            return `${col} TEXT`;
        });
        
        // Создаём таблицу
        const colDefs = colTypes.join(', ');
        db.run(`DROP TABLE IF EXISTS ${tableName}`);
        db.run(`CREATE TABLE ${tableName} (id INTEGER PRIMARY KEY AUTOINCREMENT, ${colDefs})`);
        
        // Вставляем данные
        for (const row of data) {
            const cols = columns;
            const vals = cols.map(k => {
                const val = row[k];
                // Пытаемся конвертировать в число если возможно
                if (val === '' || val === null) return null;
                if (!isNaN(val) && val !== '') {
                    return parseFloat(val);
                }
                return val;
            });
            const placeholders = cols.map(() => '?').join(', ');
            
            const stmt = db.prepare(`INSERT INTO ${tableName} (${cols.join(', ')}) VALUES (${placeholders})`);
            stmt.bind(vals);
            stmt.step();
            stmt.free();
        }
        
        // Сохраняем на диск
        if (typeof Neutralino !== 'undefined' && saveDatabaseToFile) {
            await saveDatabaseToFile();
        }
        
        logAction('import', 'converter', null, { 
            source: 'CSV', 
            target: tableName, 
            type: 'csv2sql',
            records: data.length 
        });
        
        return { tableName, records: data.length };
        
    } catch (error) {
        throw new Error(`CSV to SQLite error: ${error.message}`);
    }
}

// === ИМПОРТ/ЭКСПОРТ ФАЙЛОВ ===

// Импорт: внешний файл → crm_data.{type}
export async function importFile(sourcePath, sourceType, targetType) {
    try {
        let data;
        
        if (typeof Neutralino !== 'undefined') {
            const content = await Neutralino.filesystem.readFile(sourcePath);
            data = content;
        } else {
            throw new Error('Neutralino required for file operations');
        }
        
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
            case 'csv2sql':
                await csv2sql(data, 'crm_data.sqlite', 'imported_data');
                converted = 'success';
                break;
            default:
                throw new Error(`Unsupported conversion: ${sourceType} → ${targetType}`);
        }
        
        if (converted !== 'success' && targetType !== 'sql') {
            const outputPath = `crm_data/crm_data.${targetType}`;
            // await Neutralino.filesystem.createDirectory('crm_data');
            await Neutralino.filesystem.writeFile(outputPath, typeof converted === 'object' ? JSON.stringify(converted, null, 2) : converted);
            logAction('import', 'converter', null, { source: sourcePath, target: outputPath, type: `${sourceType}2${targetType}` });
        }

        if (targetType === 'sql' && converted === 'success') {
            logAction('import', 'converter', null, { source: sourcePath, target: 'crm_data.sqlite', type: `${sourceType}2${targetType}` });
        }
        
        showToast(`Конвертация завершена: ${sourceType} → ${targetType}`, 'success');
        return true;
        
    } catch (error) {
        console.error('❌ Import error:', error);
        showToast(`Ошибка: ${error.message}`, 'error');
        throw error;
    }
}

// Экспорт: crm_data.{type} → пользовательский путь (ТЕПЕРЬ СОЗДАЁТ ОТДЕЛЬНЫЕ ФАЙЛЫ)
// Экспорт: crm_data.{type} → пользовательский путь
// Экспорт: crm_data.{type} → пользовательский путь
export async function exportFile(sourceType, targetType, dirPath) {
    console.log(`📤 exportFile: ${sourceType} → ${targetType}, dir: ${dirPath}`);
    
    try {
        let data;
        
        // Читаем исходные данные
        if (sourceType === 'sql') {
            console.log('🔍 Reading from SQLite...');
            data = await sql2json();
            console.log('✅ SQLite data loaded, type:', typeof data);
        } else {
            const sourcePath = `crm_data/crm_data.${sourceType}`;
            console.log(`🔍 Reading from ${sourcePath}`);
            data = await Neutralino.filesystem.readFile(sourcePath);
        }
        
        // Конвертируем
        let converted;
        const conversionKey = `${sourceType}2${targetType}`;
        console.log(`🔄 Conversion: ${conversionKey}`);
        
        switch (conversionKey) {
            case 'json2csv':
                console.log('🔄 Calling json2csv...');
                converted = json2csv(data);
                console.log('✅ json2csv result type:', typeof converted, 'keys:', converted ? Object.keys(converted) : 'null');
                break;
                
            case 'sql2csv':
                console.log('🔄 Converting SQL to CSV...');
                converted = json2csv(data);
                console.log('✅ sql2csv result type:', typeof converted, 'tables:', converted ? Object.keys(converted) : 'null');
                break;
                
            case 'csv2json':
                converted = await csv2json(data);
                break;
            case 'json2sql':
                await json2sql(data, `${dirPath}/crm_data.sqlite`);
                converted = 'success';
                break;
            case 'sql2json':
                converted = data;
                break;
            default:
                console.warn(`⚠️ Unknown conversion: ${conversionKey}`);
                converted = data;
        }
        
        // Если это CSV (объект с таблицами), создаём отдельные файлы
        if (targetType === 'csv' && converted && typeof converted === 'object' && !Array.isArray(converted)) {
            console.log('🎯 Creating separate CSV files for each table...');
            
            const tables = Object.entries(converted);
            console.log(`📋 Tables to export: ${tables.map(([k]) => k).join(', ')}`);
            
            let filesCreated = 0;
            for (const [tableName, csvContent] of tables) {
                const fileName = `${tableName}.csv`;
                const filePath = `${dirPath}/${fileName}`;
                console.log(`💾 Writing ${filePath} (${csvContent.length} bytes)`);
                
                try {
                    await Neutralino.filesystem.writeFile(filePath, csvContent);
                    filesCreated++;
                    console.log(`✅ Created: ${fileName}`);
                } catch (fileError) {
                    console.error(`❌ Failed to write ${fileName}:`, fileError);
                    showToast(`⚠️ Не удалось создать файл ${fileName}`, 'warning');
                }
            }
            
            if (filesCreated > 0) {
                showToast(`✅ Экспорт завершён: создано ${filesCreated} файлов в ${dirPath}`, 'success');
                logAction('export', 'converter', null, { 
                    source: `crm_data.${sourceType}`, 
                    target: dirPath, 
                    type: conversionKey,
                    files: tables.map(([k]) => k),
                    filesCreated
                });
            } else {
                showToast(' Не удалось создать ни одного файла', 'error');
            }
            
            return filesCreated > 0;
        }
        
        // Для других форматов - один файл
        console.log('📄 Creating single file export...');
        if (converted !== 'success' && targetType !== 'sql') {
            const fileName = `crm_export_${Date.now()}.${targetType}`;
            const outputPath = `${dirPath}/${fileName}`;
            const content = typeof converted === 'object' ? JSON.stringify(converted, null, 2) : converted;
            await Neutralino.filesystem.writeFile(outputPath, content);
            
            logAction('export', 'converter', null, { 
                source: `crm_data.${sourceType}`, 
                target: outputPath, 
                type: conversionKey 
            });
            showToast(`✅ Экспорт завершён: ${outputPath}`, 'success');
            return true;
        }
        
    } catch (error) {
        console.error('❌ Export error:', error);
        showToast(`❌ Ошибка: ${error.message}`, 'error');
        throw error;
    }
}
// === ИНИЦИАЛИЗАЦИЯ ИНТЕРФЕЙСА ===

export function initConverter() {
    console.log('🔄 Initializing converter...');
    
    setupImportModal();
    setupExportModal();
    
    document.getElementById('btnImportData')?.addEventListener('click', () => openModal('importModal'));
    document.getElementById('btnExportData')?.addEventListener('click', () => openModal('exportModal'));
}

function setupImportModal() {
    const modal = document.getElementById('importModal');
    if (!modal) return;
    
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal('importModal'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('importModal');
    });
    
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
                showToast(' Ошибка выбора файла', 'error');
            }
        });
    }
    
    document.getElementById('btnDoImport')?.addEventListener('click', async () => {
        const sourcePath = document.getElementById('importFilePath').value;
        const sourceType = document.getElementById('importSourceType').value;
        const targetType = document.getElementById('importTargetType').value;
        
        if (!sourcePath) {
            showToast(' Выберите файл', 'error');
            return;
        }
        
        try {
            document.getElementById('btnDoImport').disabled = true;
            document.getElementById('btnDoImport').textContent = '⏳ Конвертация...';
            
            await importFile(sourcePath, sourceType, targetType);
            closeModal('importModal');
            
            if (targetType === 'json' || targetType === 'sql') {
                setTimeout(() => window.location.reload(), 1000);
            }
            
        } catch (error) {
            // Ошибка уже показана
        } finally {
            document.getElementById('btnDoImport').disabled = false;
            document.getElementById('btnDoImport').textContent = 'Импортировать';
        }
    });
}

function setupExportModal() {
    const modal = document.getElementById('exportModal');
    if (!modal) return;
    
    modal.querySelector('.modal-close')?.addEventListener('click', () => closeModal('exportModal'));
    modal.addEventListener('click', (e) => {
        if (e.target === modal) closeModal('exportModal');
    });
    
    const btnBrowse = document.getElementById('exportBrowse');
    if (btnBrowse) {
        btnBrowse.addEventListener('click', async () => {
            try {
                const result = await Neutralino.os.showFolderDialog('Выберите папку для сохранения');
                if (result) {
                    document.getElementById('exportDirPath').value = result;
                }
            } catch (error) {
                showToast(' Ошибка выбора папки', 'error');
            }
        });
    }
    
    document.getElementById('btnDoExport')?.addEventListener('click', async () => {
        const sourceType = document.getElementById('exportSourceType').value;
        const targetType = document.getElementById('exportTargetType').value;
        const dirPath = document.getElementById('exportDirPath').value;
        
        if (!dirPath) {
            showToast(' Выберите папку', 'error');
            return;
        }
        
        try {
            document.getElementById('btnDoExport').disabled = true;
            document.getElementById('btnDoExport').textContent = '⏳ Экспорт...';
            
            await exportFile(sourceType, targetType, dirPath);
            closeModal('exportModal');
            
        } catch (error) {
            // Ошибка уже показана
        } finally {
            document.getElementById('btnDoExport').disabled = false;
            document.getElementById('btnDoExport').textContent = 'Экспортировать';
        }
    });
}

// Глобальный экспорт
window.converter = {
    importFile,
    exportFile,
    csv2json,
    json2csv,
    json2sql,
    sql2json,
    csv2sql,
    initConverter,
    showToast,
    openModal,
    closeModal
};