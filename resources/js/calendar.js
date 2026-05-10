// resources/js/calendar.js
import { getAllItems } from './db_indexeddb.js';

let currentDate = new Date();
let activeModes = new Set(['notes']); // По умолчанию активны заметки
let selectedDate = null;
let currentNote = null;
let selectedColor = '#3b82f6';

const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
const weekdays = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const modeColors = { notes: '#3b82f6', clients: '#10b981', sales: '#f59e0b', tickets: '#8b5cf6' };

document.addEventListener('DOMContentLoaded', async () => {
    if (typeof Neutralino !== 'undefined') Neutralino.init();
    await waitForDatabase();
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

function renderCalendar() {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    document.getElementById('calendarTitle').textContent = `${monthNames[month]} ${year}`;

    const grid = document.getElementById('calendarGrid');
    grid.innerHTML = '';

    weekdays.forEach(day => {
        const h = document.createElement('div');
        h.className = 'weekday-header'; h.textContent = day;
        grid.appendChild(h);
    });

    const firstDay = new Date(year, month, 1);
    const startingDay = firstDay.getDay() || 7;
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const prevMonthDays = new Date(year, month, 0).getDate();
    const today = new Date();

    for (let i = startingDay - 1; i > 0; i--) grid.appendChild(createDayElement(prevMonthDays - i + 1, true));
    for (let day = 1; day <= daysInMonth; day++) {
        const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        const isToday = today.getDate() === day && today.getMonth() === month && today.getFullYear() === year;
        grid.appendChild(createDayElement(day, false, dateStr, isToday));
    }
    for (let day = 1; day <= 42 - (startingDay - 1 + daysInMonth); day++) grid.appendChild(createDayElement(day, true));

    loadCalendarData();
}

function createDayElement(dayNum, isOtherMonth, dateStr = null, isToday = false) {
    const dayEl = document.createElement('div');
    dayEl.className = `calendar-day ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;
    dayEl.innerHTML = `<div class="day-number">${dayNum}</div>`;
    if (!isOtherMonth && dateStr) {
        dayEl.dataset.date = dateStr;
        dayEl.onclick = () => handleDayClick(dateStr);
    }
    return dayEl;
}

// === ЗАГРУЗКА И РЕНДЕР ДАННЫХ ===
async function loadCalendarData() {
    document.querySelectorAll('.day-note, .day-indicators').forEach(el => el.remove());
    
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const isNotesActive = activeModes.has('notes');

    // Параллельная загрузка только нужных данных
    const data = {};
    const promises = [];
    if (isNotesActive) promises.push(getAllItems('calendar_notes').then(d => data.notes = d));
    if (activeModes.has('clients')) promises.push(getAllItems('clients').then(d => data.clients = d));
    if (activeModes.has('sales')) promises.push(getAllItems('sales').then(d => data.sales = d));
    if (activeModes.has('tickets')) promises.push(getAllItems('tickets').then(d => data.tickets = d));
    await Promise.all(promises);

    // Рендер по дням
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
                    indicators.innerHTML += `
                        <span class="indicator" style="background: ${modeColors[mode]};"></span>
                        <span class="indicator-count">${count}</span>`;
                }
            });
            if (hasData) dayEl.appendChild(indicators);
        }
    });
}

// === УПРАВЛЕНИЕ РЕЖИМАМИ ===
window.toggleMode = function(mode) {
    if (mode === 'notes') {
        // Заметки взаимоисключающие
        if (activeModes.has('notes')) {
            activeModes.delete('notes');
        } else {
            activeModes.clear();
            activeModes.add('notes');
        }
    } else {
        // Статистика: скрываем заметки, переключаем категорию
        activeModes.delete('notes');
        activeModes.has(mode) ? activeModes.delete(mode) : activeModes.add(mode);
    }

    // Обновляем классы кнопок
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
const getDb = () => new Promise((res, rej) => { const r = indexedDB.open('CRM_Database', 4); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.addItem = async (store, item) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).add(item); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
window.updateItem = async (store, id, data) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).put({...data, id}); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); };
window.deleteItem = async (store, id) => { const db = await getDb(); return new Promise((res, rej) => { const t = db.transaction([store], 'readwrite'); const r = t.objectStore(store).delete(id); r.onsuccess = () => res(); r.onerror = () => rej(r.error); }); };