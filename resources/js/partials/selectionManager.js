// resources/js/partials/selectionManager.js
import { getSetting } from '../settings-manager.js';
import { deleteItem } from '../db_sqlite.js';
export class SelectionManager {
    constructor(options) {
        this.tableBodySelector = options.tableBodySelector;
        this.actionBar = document.getElementById(options.actionBarId);
        this.ctxMenu = document.getElementById(options.ctxMenuId);
        this.selectedRows = new Map();
        this.ctxTargetId = null;
        this.callbacks = options.callbacks || {};
        
        // Ждём появления таблицы перед инициализацией
        this.init();
    }

    init() {
        // Проверяем существование элементов
        const tableBody = document.querySelector(this.tableBodySelector);
        
        if (!tableBody) {
            // console.warn(`⚠️ Table body "${this.tableBodySelector}" not found. Retrying in 100ms...`);
            setTimeout(() => this.init(), 100);
            return;
        }
        
        this.tableBody = tableBody;
        
        // Навешиваем обработчики
        this.tableBody.addEventListener('click', (e) => this.handleClick(e));
        this.tableBody.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        
        // Глобальный обработчик для закрытия меню
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ctx-menu') && this.ctxMenu) {
                this.ctxMenu.style.display = 'none';
            }
        });
        
        console.log('✅ SelectionManager initialized');
    }

    handleClick(event) {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.id) return;
        
        const id = parseInt(row.dataset.id);
        
        
        const modifier = getSetting('ui.selectionModifier') || 'shift';
        const isModifier = modifier === 'shift' ? event.shiftKey : (event.ctrlKey || event.metaKey);

        if (isModifier) {
            if (this.selectedRows.has(id)) this.selectedRows.delete(id);
            else this.selectedRows.set(id, row);
        } else {
            this.selectedRows.clear();
            this.selectedRows.set(id, row);
        }
        this.updateUI();
    }

    handleRightClick(event) {
        const row = event.target.closest('tr');
        if (!row || !row.dataset.id) return;
        event.preventDefault();
        
        this.ctxTargetId = parseInt(row.dataset.id);
        this.ctxMenu.style.left = `${Math.min(event.pageX, window.innerWidth - 190)}px`;
        this.ctxMenu.style.top = `${Math.min(event.pageY, window.innerHeight - 130)}px`;
        this.ctxMenu.style.display = 'block';
    }

    updateUI() {
        // Обновляем классы строк
        document.querySelectorAll(`${this.tableBody.id || 'tbody'} tr`).forEach(tr => tr.classList.remove('selected'));
        this.selectedRows.forEach(row => row.classList.add('selected'));

        // Панель действий
        if (this.selectedRows.size > 0 && this.actionBar) {
            this.actionBar.classList.add('visible');
            const badge = this.actionBar.querySelector('.count-badge');
            if (badge) badge.textContent = this.selectedRows.size;
            
            // Кнопка "Изменить" активна только если выбрана 1
            const btnEdit = this.actionBar.querySelector('#btnBulkEdit');
            if (btnEdit) btnEdit.disabled = this.selectedRows.size !== 1;
        } else if (this.actionBar) {
            this.actionBar.classList.remove('visible');
        }
    }

        /**
     * Массовое удаление записей
     * @param {string} storeName - имя хранилища (например, 'sales')
     * @param {Function} onSuccess - callback после успешного удаления
     * @param {Function} onError - callback при ошибке
     */
    async bulkDelete(storeName, onSuccess, onError) {
        const ids = this.getSelectedIds();
        if (ids.length === 0) return;
        
        if (!confirm(`Удалить ${ids.length} записей?`)) return;

        try {
            for (const id of ids) {
                await deleteItem(storeName, id);
            }
            if (window.saveDataToFile) await window.saveDataToFile();
            
            this.clear();
            if (onSuccess) onSuccess(ids.length);
        } catch (err) {
            console.error('Bulk delete error:', err);
            if (onError) onError(err);
        }
    }

    getSelectedIds() {
        return Array.from(this.selectedRows.keys());
    }

    clear() {
        this.selectedRows.clear();
        this.updateUI();
    }

    getCtxTargetId() {
        return this.ctxTargetId;
    }
}