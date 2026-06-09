import {initDatabase, getAllItems, addItem, updateItem, deleteItem } from './db.js';
import { showToast } from './partials/toast.js'
let tasks = [];
let currentView = 'kanban';

document.addEventListener('DOMContentLoaded', async () => {
    console.log('📋 Tasks page initialized');

    try {
        console.log('🔌 Initializing database...');
        await initDatabase();
        console.log('✅ Database initialized');
        
        // Устанавливаем флаг для совместимости
        window.isDatabaseReady = true;
        document.dispatchEvent(new CustomEvent('dbReady'));
        
    } catch (error) {
        console.error('❌ Database initialization failed:', error);
        showToast('Ошибка инициализации базы данных', 'error');
        return;
    }
    
    await loadTasks();
    setupEventListeners();
    setupDragAndDrop();
});



async function loadTasks() {
    console.log('📥 Loading tasks...');
    tasks = await getAllItems('tasks');
    console.log(`✅ Loaded ${tasks.length} tasks`);
    renderKanbanBoard();
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
function setupEventListeners() {
    console.log('🔗 Setting up event listeners...');
    
    // 1. Переключатель вида (Доска/Таблица)
    const viewToggle = document.querySelector('.view-toggle');
    if (viewToggle) {
        viewToggle.addEventListener('click', e => {
            if (e.target.dataset.view === 'table') {
                currentView = 'table';
                document.getElementById('kanbanBoard').style.display = 'none';
                document.getElementById('tasksTable').style.display = 'block';
                renderTableView();
            } else {
                currentView = 'kanban';
                document.getElementById('kanbanBoard').style.display = 'grid';
                document.getElementById('tasksTable').style.display = 'none';
                renderKanbanBoard();
            }
            
            // Обновляем активную кнопку
            viewToggle.querySelectorAll('button').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.view === currentView);
            });
        });
    }
    
    // 2. Форма создания задачи
    const createForm = document.getElementById('createTaskForm');
    if (createForm) {
        createForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            await handleCreateTask();
        });
    }
    
    // 3. Выбор связанной таблицы (для автозаполнения записей)
    const relatedTableSelect = document.getElementById('relatedTable');
    if (relatedTableSelect) {
        relatedTableSelect.addEventListener('change', async (e) => {
            await loadRelatedRecords(e.target.value);
        });
    }
    
    // 4. Кнопка закрытия модального окна
    const modalClose = document.querySelector('#createTaskModal .modal-close');
    if (modalClose) {
        modalClose.addEventListener('click', () => {
            closeModal('createTaskModal');
        });
    }
    
    // 5. Закрытие по клику вне окна
    const modalOverlay = document.getElementById('createTaskModal');
    if (modalOverlay) {
        modalOverlay.addEventListener('click', (e) => {
            if (e.target === modalOverlay) {
                closeModal('createTaskModal');
            }
        });
    }
    
    console.log('✅ Event listeners attached');
}

// === DRAG AND DROP ===
function setupDragAndDrop() {
    const columns = document.querySelectorAll('.kanban-tasks');
    
    columns.forEach(column => {
        column.addEventListener('dragover', e => {
            e.preventDefault();
            column.classList.add('drag-over');
        });
        
        column.addEventListener('dragleave', () => {
            column.classList.remove('drag-over');
        });
        
        column.addEventListener('drop', async e => {
            e.preventDefault();
            column.classList.remove('drag-over');
            
            const taskId = e.dataTransfer.getData('text/plain');
            const newPriority = column.parentElement.dataset.priority;
            
            if (taskId && newPriority) {
                await updateItem('tasks', parseInt(taskId), { priority: newPriority });
                await loadTasks();
                showToast('Приоритет задачи обновлён');
            }
        });
    });
}

// === СОЗДАНИЕ ЗАДАЧИ ===
async function handleCreateTask() {
    const title = document.getElementById('taskTitle').value;
    const description = document.getElementById('taskDescription').value;
    const deadline = document.getElementById('taskDeadline').value;
    const priority = document.getElementById('taskPriority').value;
    const relatedTable = document.getElementById('relatedTable').value;
    const relatedRecord = document.getElementById('relatedRecord').value;
    
    try {
        const relatedDisplay = relatedRecord ? 
            document.querySelector('#relatedRecord option:checked').text : 
            null;
        
        await addItem('tasks', {
            title,
            description,
            deadline,
            priority,
            status: 'todo',
            related_table: relatedTable || null,
            related_id: relatedRecord ? parseInt(relatedRecord) : null,
            related_display: relatedDisplay,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            completed_at: null,
            is_archived: 0
        });
        
        showToast('Задача создана');
        closeModal('createTaskModal');
        await loadTasks();
        
        // Очистка формы
        document.getElementById('createTaskForm').reset();
        
    } catch (error) {
        console.error('❌ Error creating task:', error);
        showToast('Ошибка при создании задачи');
    }
}

// === ЗАГРУЗКА СВЯЗАННЫХ ЗАПИСЕЙ ===
async function loadRelatedRecords(tableName) {
    const select = document.getElementById('relatedRecord');
    if (!tableName) {
        select.disabled = true;
        select.innerHTML = '<option value="">Выберите запись</option>';
        return;
    }
    
    try {
        console.log(`📥 Loading records from "${tableName}"...`);
        select.disabled = true;
        select.innerHTML = '<option value="">Загрузка...</option>';
        
        const records = await getAllItems(tableName);
        
        console.log(`✅ Loaded ${records.length} records from ${tableName}`);
        console.log('Records:', records);
        
        if (records.length === 0) {
            select.innerHTML = '<option value="">Нет записей</option>';
            select.disabled = true;
            return;
        }
        
        select.innerHTML = '<option value="">Не выбрано</option>' + 
            records.map(record => {
                let displayText = '';
                if (tableName === 'clients') {
                    displayText = `${record.name} ${record.phone ? `(${record.phone})` : ''}`;
                } else if (tableName === 'products') {
                    displayText = `${record.name} (${record.sku})`;
                } else if (tableName === 'sales') {
                    displayText = `Продажа #${record.id}`;
                } else {
                    displayText = record.name || `Запись #${record.id}`;
                }
                
                return `<option value="${record.id}">${displayText}</option>`;
            }).join('');
        
        select.disabled = false;
        
    } catch (error) {
        console.error('❌ Error loading records:', error);
        select.innerHTML = '<option value="">Ошибка загрузки</option>';
    }
}

// === РЕНДЕРИНГ KANBAN ===
function renderKanbanBoard() {
    console.log('🎨 Rendering Kanban board...');
    
    const columns = {
        'urgent-important': document.getElementById('tasks-urgent-important'),
        'not-urgent-important': document.getElementById('tasks-not-urgent-important'),
        'urgent-not-important': document.getElementById('tasks-urgent-not-important'),
        'not-urgent-not-important': document.getElementById('tasks-not-urgent-not-important'),
        'done': document.getElementById('tasks-done'),
        'archived': document.getElementById('tasks-archived')
    };
    
    // Очистка
    Object.values(columns).forEach(col => {
        if (col) col.innerHTML = '';
    });
    
    // Распределение задач
    tasks.forEach(task => {
        const card = createTaskCard(task);
        
        // Определяем колонку
        let columnKey;
        if (task.is_archived) {
            columnKey = 'archived';
        } else if (task.status === 'done') {
            columnKey = 'done';
        } else {
            columnKey = task.priority;
        }
        
        if (columns[columnKey]) {
            columns[columnKey].appendChild(card);
        }
    });
}

function createTaskCard(task) {
    const div = document.createElement('div');
    div.className = 'task-card' + 
        (task.status === 'done' ? ' task-completed' : '') +
        (task.is_archived ? ' task-archived' : '');
    
    div.draggable = task.status !== 'done' && !task.is_archived;
    div.dataset.taskId = task.id;
    
    const deadlineStr = task.deadline ? formatDate(task.deadline) : 'Нет срока';
    const isOverdue = task.deadline && new Date(task.deadline) < new Date() && task.status !== 'done';
    
    div.innerHTML = `
        <div class="task-title">${escapeHtml(task.title)}</div>
        <div class="task-description">${escapeHtml(task.description || '')}</div>
        <div class="task-meta">
            ${task.related_display ? `<span class="task-link"> ${escapeHtml(task.related_display)}</span>` : ''}
            <span class="task-deadline ${isOverdue ? 'overdue' : ''}"> ${deadlineStr}</span>
        </div>
        <div class="task-actions">
            ${!task.is_archived ? `
                <button class="btn-sm ${task.status === 'done' ? 'btn-warning' : 'btn-success'}" 
                        onclick="completeTask(${task.id})" 
                        title="${task.status === 'done' ? 'Отменить выполнение' : 'Выполнить'}">
                    ${task.status === 'done' ? '✓' : '✓'}
                </button>
                <button class="btn-sm btn-danger" 
                        onclick="archiveTask(${task.id})" 
                        title="${task.is_archived ? 'Удалить навсегда' : 'В архив'}">
                    ${task.is_archived ? 'X' : 'X'}
                </button>
            ` : `
                <button class="btn-sm btn-danger" 
                        onclick="archiveTask(${task.id})" 
                        title="Удалить навсегда">
                    X
                </button>
            `}
        </div>
    `;
    
    // Drag events
    if (task.status !== 'done' && !task.is_archived) {
        div.addEventListener('dragstart', e => {
            e.dataTransfer.setData('text/plain', task.id);
            div.classList.add('dragging');
        });
        
        div.addEventListener('dragend', () => {
            div.classList.remove('dragging');
        });
    }
    
    return div;
}

// === РЕНДЕРИНГ ТАБЛИЦЫ ===
function renderTableView() {
    const tbody = document.querySelector('#tasksTable tbody');
    if (!tbody) return;
    
    tbody.innerHTML = tasks.filter(t => !t.is_archived).map(task => `
        <tr>
            <td>${escapeHtml(task.title)}</td>
            <td>${getPriorityLabel(task.priority)}</td>
            <td>${getStatusLabel(task.status)}</td>
            <td>${formatDate(task.deadline)}</td>
            <td>${task.related_display || '—'}</td>
            <td>
                <button class="btn-sm" onclick="editTask(${task.id})">✏️</button>
                <button class="btn-sm btn-success" onclick="completeTask(${task.id})">✓</button>
                <button class="btn-sm btn-danger" onclick="archiveTask(${task.id})">🗑</button>
            </td>
        </tr>
    `).join('');
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function formatDate(dateStr) {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ru-RU');
}

function getPriorityLabel(priority) {
    const labels = {
        'urgent-important': 'Срочно и важно',
        'not-urgent-important': 'Несрочно и важно',
        'urgent-not-important': 'Срочно и неважно',
        'not-urgent-not-important': 'Несрочно и неважно'
    };
    return labels[priority] || priority;
}

function getStatusLabel(status) {
    const labels = {
        'todo': 'К выполнению',
        'in-progress': ' В работе',
        'done': ' Готово'
    };
    return labels[status] || status;
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
}

window.openModal = function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

// Глобальные функции для кнопок в карточках
window.completeTask = async function(id) {
    try {
        // Находим задачу
        const task = tasks.find(t => t.id === id);
        if (!task) {
            showToast('Задача не найдена', 'error');
            return;
        }
        
        // Если уже выполнена — отменяем выполнение
        if (task.status === 'done') {
            await updateItem('tasks', id, { 
                status: 'todo', 
                completed_at: null 
            });
            showToast('↩Задача возвращена в работу');
        } else {
            // Выполняем задачу
            await updateItem('tasks', id, { 
                status: 'done', 
                completed_at: new Date().toISOString() 
            });
            showToast('Задача выполнена');
        }
        
        // Перерисовываем доску
        await loadTasks();
        
    } catch (error) {
        console.error('❌ Error completing task:', error);
        showToast('Ошибка при обновлении задачи', 'error');
    }
}

window.archiveTask = async function(id) {
    try {
        const task = tasks.find(t => t.id === id);
        if (!task) {
            showToast('Задача не найдена', 'error');
            return;
        }
        
        // Если уже в архиве — удаляем навсегда
        if (task.is_archived) {
            if (confirm('Удалить задачу? Это действие нельзя отменить.')) {
                await deleteItem('tasks', id);
                showToast('Задача удалена');
                await loadTasks();
            }
        } else {
            // Перемещаем в архив
            await updateItem('tasks', id, { 
                is_archived: 1,
                updated_at: new Date().toISOString()
            });
            showToast('Задача перемещена в архив');
            await loadTasks();
        }
        
    } catch (error) {
        console.error('❌ Error archiving task:', error);
        showToast('Ошибка', 'error');
    }
}

window.editTask = function(id) {
    // TODO: Реализовать редактирование
    showToast(' Редактирование скоро будет доступно');
}
