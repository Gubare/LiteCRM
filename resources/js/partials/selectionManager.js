// resources/js/partials/selectionManager.js
import { getSetting } from '../settings-manager.js';
export class SelectionManager {
    constructor(options) {
        this.tableBody = document.querySelector(options.tableBodySelector);
        this.actionBar = document.getElementById(options.actionBarId);
        this.ctxMenu = document.getElementById(options.ctxMenuId);
        this.selectedRows = new Map(); // id -> DOM Element
        this.ctxTargetId = null;
        
        this.callbacks = options.callbacks || {}; // onDelete, onEdit, etc.
        
        this.init();
    }

    init() {
        // Глобальные обработчики (вешаем один раз на document или tableBody)
        this.tableBody.addEventListener('click', (e) => this.handleClick(e));
        this.tableBody.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.ctx-menu') && this.ctxMenu) {
                this.ctxMenu.style.display = 'none';
            }
        });
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