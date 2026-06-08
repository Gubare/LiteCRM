/**
 * Утилиты для экспорта данных в CSV
 * Универсальный модуль для экспорта таблиц
 */

/**
 * Экспорт данных в CSV
 * @param {Array} data - Массив объектов для экспорта
 * @param {Object[]} columns - Конфигурация колонок [{key: 'name', label: 'Имя'}]
 * @param {string} filename - Имя файла (без расширения)
 * @param {Object} options - Дополнительные опции { addTotalRow: boolean, tableName: string }
 */
export function exportToCSV(data, columns, filename = 'export', options = {}) {
    const { addTotalRow = false, tableName = '' } = options;
    
    if (!data || data.length === 0) {
        alert('⚠️ Нет данных для экспорта');
        return;
    }

    // Формируем заголовки
    const headers = columns.map(col => col.label).join(';');
    
    // Формируем строки данных
    const rows = data.map(row => {
        return columns.map(col => {
            let value = row[col.key];
            
            // Обработка null/undefined
            if (value === null || value === undefined) {
                value = '';
            } else {
                // Преобразуем к строке, убираем HTML-теги и лишние пробелы
                value = value.toString().replace(/<[^>]*>/g, '').trim();
            }
            
            // Специфичная обработка для корректного открытия в Excel
            
            // Телефоны: добавляем апостроф в начало, чтобы Excel считал это текстом
            if (col.key === 'phone' && value) {
                value = "'" + value;
            }
            
            // Денежные суммы: добавляем пробел и ₽, если валюты нет
            if ((col.key === 'total_spent' || col.key === 'avg_check') && value) {
                if (!value.includes('₽') && !value.includes('руб')) {
                     value = value + ' ₽';
                }
            }

            // Экранируем кавычки и оборачиваем в кавычки если есть разделители
            if (value.includes(';') || value.includes('"') || value.includes('\n')) {
                value = '"' + value.replace(/"/g, '""') + '"';
            }
            
            return value;
        }).join(';');
    });
    
    if (addTotalRow && tableName === 'clients') {
        const totalRow = calculateClientsTotalRow(data);
        if (totalRow) {
            rows.push(totalRow);
        }
    }
    
    const csvContent = '\uFEFF' + [headers, ...rows].join('\n');
    
    // Создаём Blob и скачиваем
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    const timestamp = new Date().toISOString().slice(0, 10);
    link.setAttribute('href', url);
    link.setAttribute('download', `${filename}_${timestamp}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    console.log(`Экспортировано ${data.length} записей в ${filename}_${timestamp}.csv`);
}

/**
 * Расчёт итоговой строки СТРОГО для таблицы клиентов
 * Формат:
 * [ "Итого: N", кол-во с телефоном, кол-во с email, общее кол-во покупок, общая сумма ₽, общий ср. чек ₽, "", "" ]
 */
function calculateClientsTotalRow(data) {
    const totals = {
        totalCount: data.length,
        withPhone: 0,
        withEmail: 0,
        totalPurchases: 0,
        totalSum: 0,
        totalAvgCheck: 0
    };
    
    // Считаем агрегированные данные
    data.forEach(item => {
        // Количество с телефоном (учитываем апостроф для Excel)
        const phone = item.phone?.toString().trim() || '';
        if (phone && phone !== "'" && phone.replace(/^'/, '') !== '') {
            totals.withPhone++;
        }
        
        // Количество с email
        const email = item.email?.toString().trim() || '';
        if (email && email !== '') {
            totals.withEmail++;
        }
        
        // Общее количество покупок
        const purchases = parseFloat(item.purchase_count) || 0;
        totals.totalPurchases += purchases;
        
        // Общая сумма (парсим число, игнорируя "₽" и пробелы)
        let sumValue = item.total_spent;
        if (typeof sumValue === 'string') {
            sumValue = parseFloat(sumValue.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        }
        totals.totalSum += sumValue;
        
        // Средний чек (для расчёта общего среднего)
        let avgValue = item.avg_check;
        if (typeof avgValue === 'string') {
            avgValue = parseFloat(avgValue.replace(/[^\d.,-]/g, '').replace(',', '.')) || 0;
        }
        totals.totalAvgCheck += avgValue;
    });
    
    const overallAvgCheck = totals.totalCount > 0 
        ? (totals.totalAvgCheck / totals.totalCount).toFixed(2)
        : 0;
    
    // Формируем итоговую строку СТРОГО по структуре колонок клиентов:
    // [ID, Имя, Телефон, Email, Покупки, Сумма, Ср. чек, Сегмент]
    const totalRowValues = [
        `Итого: ${totals.totalCount}`,              // ID колонка
        totals.withPhone.toString(),                // Имя колонка  кол-во с телефоном
        totals.withEmail.toString(),                // Телефон колонка  кол-во с почтой
        totals.totalPurchases.toString(),           // Email колонка  общее кол-во покупок
        totals.totalSum.toFixed(2).replace('.', ',') + ' ₽',  // Покупки колонка  общая сумма
        overallAvgCheck.replace('.', ',') + ' ₽',   // Сумма колонка  общий средний чек
        '',                                          // Ср. чек  пусто
        ''                                           // Сегмент  пусто
    ];
    
    return totalRowValues.join(';');
}

/**
 * Получение данных выделенных строк из таблицы (чтение из DOM)
 */
export function getSelectedRowsData(tableSelector, columns) {
    const selectedRows = document.querySelectorAll(`${tableSelector} tbody tr.selected`);
    return extractRowsDataFromDOM(selectedRows, columns);
}

/**
 * Получение данных видимых строк (после фильтров) — чтение из DOM
 */
export function getVisibleRowsData(tableSelector, columns) {
    const visibleRows = document.querySelectorAll(`${tableSelector} tbody tr:not([style*="display: none"])`);
    return extractRowsDataFromDOM(visibleRows, columns);
}

/**
 * Вспомогательная функция: извлечение данных из DOM-ячеек
 * Читает текст как он отображается в таблице — гарантированно тот же формат, что видит пользователь
 */
function extractRowsDataFromDOM(rows, columns) {
    return Array.from(rows).map(row => {
        const cells = row.querySelectorAll('td');
        const item = {};
        
        // Маппим ячейки на колонки по индексу
        cells.forEach((cell, index) => {
            if (columns[index]) {
                const key = columns[index].key;
                // Берём видимый текст из ячейки — тот же формат, что в таблице
                item[key] = cell.innerText.trim();
            }
        });
        return item;
    });
}

/**
 * Показывает диалог выбора режима экспорта
 */
export function showExportDialog(callback) {
    const modes = [
        { value: 'selected', label: 'Только выделенные строки' },
        { value: 'visible', label: 'Только отображённые' }
        // { value: 'all', label: 'Все данные из базы' }
    ];
    
    const html = `
        <div style="padding: 20px;">
            <h3 style="margin-top: 0;">Экспорт данных</h3>
            <p>Выберите режим экспорта:</p>
            <div style="display: flex; flex-direction: column; gap: 10px;">
                ${modes.map(mode => `
                    <label style="display: flex; align-items: center; padding: 10px; border: 1px solid #ddd; border-radius: 6px; cursor: pointer;">
                        <input type="radio" name="exportMode" value="${mode.value}" style="margin-right: 10px;">
                        <span>${mode.label}</span>
                    </label>
                `).join('')}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 20px; justify-content: flex-end;">
                <button id="exportCancel" class="btn-action" style="padding: 8px 16px;">Отмена</button>
                <button id="exportConfirm" class="btn-primary" style="padding: 8px 16px;">Экспортировать</button>
            </div>
        </div>
    `;
    
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        background: rgba(0,0,0,0.5); display: flex; align-items: center;
        justify-content: center; z-index: 10000;
    `;
    
    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
        background: white; border-radius: 8px; max-width: 500px; width: 90%;
        box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    `;
    modalContent.innerHTML = html;
    
    modal.appendChild(modalContent);
    document.body.appendChild(modal);
    
    document.getElementById('exportCancel').onclick = () => document.body.removeChild(modal);
    
    document.getElementById('exportConfirm').onclick = () => {
        const selectedMode = document.querySelector('input[name="exportMode"]:checked')?.value;
        if (selectedMode) {
            document.body.removeChild(modal);
            callback(selectedMode);
        } else {
            alert('Выберите режим экспорта');
        }
    };
    
    modal.onclick = (e) => { if (e.target === modal) document.body.removeChild(modal); };
}