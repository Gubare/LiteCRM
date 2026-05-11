// resources/js/calendar.js
import { getAllItems } from './db_indexeddb.js';
import { getSetting, updateSetting } from './settings-manager.js';

// === СОСТОЯНИЕ ===
let currentDate = new Date();
let activeModes = new Set(['notes']);
let selectedDate = null;
let currentNote = null;
let selectedColor = '#3b82f6';
let isEditingSchedule = true; // По умолчанию редактирование включено

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
// Индексы: 0=Пн, 6=Вс (JS: 0=Вс, 1=Пн... 6=Сб)
const modeColors = { notes: '#3b82f6', clients: '#10b981', sales: '#f59e0b', tickets: '#8b5cf6' };

// Настройки рабочих дней по умолчанию (true=рабочий, false=выходной)
const DEFAULT_WORKDAYS = {
    0: true,  // Пн
    1: true,  // Вт
    2: true,  // Ср
    3: true,  // Чт
    4: true,  // Пт
    5: false, // Сб
    6: false  // Вс
};

// Текущие настройки рабочих дней
let workDays = { ...DEFAULT_WORKDAYS };

// === ИНИЦИАЛИЗАЦИЯ ===
document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    
    await waitForDatabase();
    await loadScheduleSettings();
    initMonthSelect();
    renderCalendar();
    setupEventListeners();
});

async function waitForDatabase() {
    if (window.isDatabaseReady) return;
    return new Promise(resolve => {
        const check = () => window.isDatabaseReady ? resolve() : setTimeout(check, 50);
        check();
    });
}

// === ЗАГРУЗКА НАСТРОЕК РАСПИСАНИЯ ===
async function loadScheduleSettings() {
    try {
        // Загружаем из файла настроек
        const savedWorkDays = await getSetting('calendar.workDays');
        const canEdit = await getSetting('calendar.canEditSchedule');
        
        if (savedWorkDays) workDays = savedWorkDays;
        if (canEdit !== undefined) isEditingSchedule = canEdit;
        
        console.log('📅 Schedule settings loaded:', { workDays, canEdit: isEditingSchedule });
    } catch (error) {
        console.log('⚠️ Using default schedule settings');
        workDays = { ...DEFAULT_WORKDAYS };
    }
}

// === РЕНДЕР КАЛЕНДАРЯ ===
function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    
    document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;
    
    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = ''; // Очищаем сетку
    
    // === ЗАГОЛОВКИ ДНЕЙ НЕДЕЛИ (ОДИН КЛИК) ===
    weekdays.forEach((day, index) => {
        const header = document.createElement('div');
        const isWorkday = workDays[index];
        header.className = `weekday-header ${isWorkday ? 'workday' : 'weekend'} ${!isEditingSchedule ? 'readonly' : ''}`;
        header.innerHTML = `${day} ${!isEditingSchedule ? '' : ''}`;
        header.title = isEditingSchedule ? 'Нажмите, чтобы изменить тип дня' : 'Редактирование заблокировано';

        if (isEditingSchedule) {
            header.onclick = async () => {
                // 1. Мгновенно меняем данные в памяти
                workDays[index] = !workDays[index];
                
                // 2. Сохраняем в файл настроек
                await updateSetting('calendar.workDays', workDays);
                
                // 3. Перерисовываем календарь (это мгновенно и гарантирует ровные столбцы)
                renderCalendar();
                
                // 4. Показываем уведомление
                showToast(`✅ ${day} → ${workDays[index] ? 'рабочий' : 'выходной'}`);
            };
        }
        grid.appendChild(header);
    });
    
    // === ДНИ МЕСЯЦА ===
    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay() || 7; // Пн=1, Вс=7
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const today = new Date();
    
    // Предыдущий месяц
    for (let i = startingDay - 1; i > 0; i--) {
        grid.appendChild(createDayElement(prevMonthDays - i + 1, true));
    }
    
    // Текущий месяц
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        // Определяем день недели для этой даты (JS: 0=Вс, 1=Пн... 6=Сб)
        const jsDayOfWeek = new Date(year, month, day).getDay();
        // Преобразуем в наш формат массива (0=Пн... 6=Вс)
        const workDayIndex = jsDayOfWeek === 0 ? 6 : jsDayOfWeek - 1;
        
        const isWorkday = workDays[workDayIndex];
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        
        // Передаем !isWorkday, чтобы функция знала, что это выходной
        grid.appendChild(createDayElement(day, false, dateStr, isToday, !isWorkday));
    }
    
    // Следующий месяц
    const totalCells = startingDay - 1 + daysInMonth;
    const remainingCells = 42 - totalCells;
    for (let day = 1; day <= remainingCells; day++) {
        grid.appendChild(createDayElement(day, true));
    }
    
    // Загружаем данные (заметки/статистику)
    loadCalendarData();
}


function createDayElement(dayNum, isOtherMonth, dateStr = null, isToday = false, isWeekend = false) {
    const dayEl = document.createElement('div');
    dayEl.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isWeekend && !isOtherMonth ? 'weekend-col' : ''}`;
    
    const dayNumber = document.createElement('div');
    dayNumber.className = 'day-number';
    dayNumber.textContent = dayNum;
    dayEl.appendChild(dayNumber);
    
    if (!isOtherMonth && dateStr) {
        dayEl.dataset.date = dateStr;
        dayEl.onclick = () => handleDayClick(dateStr);
    }
    
    return dayEl;
}

// === ЗАГРУЗКА ДАННЫХ ===
async function loadCalendarData() {
    document.querySelectorAll('.day-note, .day-indicators').forEach(el => el.remove());
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const isNotesActive = activeModes.has('notes');
    
    const data = {};
    const promises = [];
    if (isNotesActive) promises.push(getAllItems('calendar_notes').then(d => data.notes = d));
    if (activeModes.has('clients')) promises.push(getAllItems('clients').then(d => data.clients = d));
    if (activeModes.has('sales')) promises.push(getAllItems('sales').then(d => data.sales = d));
    if (activeModes.has('tickets')) promises.push(getAllItems('tickets').then(d => data.tickets = d));
    await Promise.all(promises);
    
    document.querySelectorAll('.calendar-day[data-date]').forEach(dayEl => {
        const [y, m, d] = dayEl.dataset.date.split('-').map(Number);
        if (y !== year || m - 1 !== month) return;
        
        if (isNotesActive) {
            (data.notes || []).filter(n => n.date === dayEl.dataset.date).forEach(note => {
                const el = document.createElement('div');
                el.className = 'day-note';
                el.style.background = note.color;
                el.textContent = note.text || '📝';
                el.onclick = (e) => { e.stopPropagation(); openNoteModal(dayEl.dataset.date, note); };
                dayEl.appendChild(el);
            });
        } else {
            const indicators = document.createElement('div');
            indicators.className = 'day-indicators';
            let hasData = false;
            
            ['clients', 'sales', 'tickets'].forEach(mode => {
                if (!activeModes.has(mode)) return;
                const count = (data[mode] || []).filter(item => {
                    const itemDate = new Date(item.created_at || item.transaction_date);
                    return itemDate.getFullYear() === y && itemDate.getMonth() === m - 1 && itemDate.getDate() === d;
                }).length;
                
                if (count > 0) {
                    hasData = true;
                    indicators.innerHTML += `<span class="indicator" style="background: ${modeColors[mode]};"></span><span class="indicator-count">${count}</span>`;
                }
            });
            if (hasData) dayEl.appendChild(indicators);
        }
    });
}

// === УПРАВЛЕНИЕ РЕЖИМАМИ ===
window.toggleMode = function(mode) {
    if (mode === 'notes') {
        if (activeModes.has('notes')) activeModes.delete('notes');
        else { activeModes.clear(); activeModes.add('notes'); }
    } else {
        activeModes.delete('notes');
        activeModes.has(mode) ? activeModes.delete(mode) : activeModes.add(mode);
    }
    
    document.querySelectorAll('.mode-btn').forEach(btn => {
        btn.classList.toggle('active', activeModes.has(btn.dataset.mode));
    });
    
    loadCalendarData();
};


// === НАВИГАЦИЯ ===
window.changeMonth = function(delta) { currentDate.setMonth(currentDate.getMonth() + delta); renderCalendar(); };
window.toggleMonthSelect = function() {
    const t = document.getElementById('calendarTitle'), s = document.getElementById('monthSelect');
    const show = s.style.display === 'none';
    s.style.display = show ? 'block' : 'none';
    t.style.display = show ? 'none' : 'block';
    if (show) s.value = `${currentDate.getFullYear()}-${currentDate.getMonth()}`;
};
window.jumpToMonth = function(val) {
    const [y, m] = val.split('-').map(Number);
    currentDate = new Date(y, m, 1);
    toggleMonthSelect(); renderCalendar();
};
function initMonthSelect() {
    const s = document.getElementById('monthSelect'), cy = new Date().getFullYear();
    for (let y = cy - 2; y <= cy + 2; y++) for (let m = 0; m < 12; m++) {
        const o = document.createElement('option'); o.value = `${y}-${m}`; o.textContent = `${monthNames[m]} ${y}`; s.appendChild(o);
    }
}

// === ЗАМЕТКИ ===
function handleDayClick(dateStr) { selectedDate = dateStr; openNoteModal(dateStr); }
async function openNoteModal(dateStr, note = null) {
    currentNote = note;
    document.getElementById('noteModalTitle').textContent = `Заметка на ${new Date(dateStr).toLocaleDateString('ru-RU')}`;
    document.getElementById('noteText').value = note?.text || '';
    selectedColor = note?.color || '#3b82f6';
    document.getElementById('btnDeleteNote').style.display = note ? 'block' : 'none';
    updateColorPicker(); document.getElementById('noteModal').classList.add('active');
}
function updateColorPicker() {
    document.querySelectorAll('.color-option').forEach(o => o.classList.toggle('selected', o.dataset.color === selectedColor));
}
window.saveNote = async function() {
    if (!selectedDate) return;
    const text = document.getElementById('noteText').value;
    const data = { date: selectedDate, text, color: selectedColor, created_at: new Date().toISOString() };
    try {
        if (currentNote) { data.id = currentNote.id; data.updated_at = new Date().toISOString(); await window.updateItem('calendar_notes', currentNote.id, data); }
        else await window.addItem('calendar_notes', data);
        if (window.saveDataToFile) await window.saveDataToFile();
        closeModal('noteModal'); renderCalendar();
    } catch(e) { alert('Ошибка сохранения'); }
};
window.deleteNote = async function() {
    if (!currentNote || !confirm('Удалить заметку?')) return;
    try {
        await window.deleteItem('calendar_notes', currentNote.id);
        if (window.saveDataToFile) await window.saveDataToFile();
        closeModal('noteModal'); renderCalendar();
    } catch(e) { alert('Ошибка удаления'); }
};
function setupEventListeners() {
    document.getElementById('colorPicker').addEventListener('click', e => {
        if (e.target.classList.contains('color-option')) { selectedColor = e.target.dataset.color; updateColorPicker(); }
    });
}
window.closeModal = id => document.getElementById(id).classList.remove('active');
window.closeModalOnOverlay = (e, id) => { if (e.target.id === id) closeModal(id); };

// Хелперы БД
const getDb = () => new Promise((res, rej) => { const r = indexedDB.open('CRM_Database', 6); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.addItem = async (store, item) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).add(item); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
window.updateItem = async (store, id, data) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).put({...data, id}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
window.deleteItem = async (store, id) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); };