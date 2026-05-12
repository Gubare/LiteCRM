// resources/js/textViewer.js

/**
 * Создает HTML для обрезанного текста с возможностью просмотра полного
 * @param {string} text - Текст для отображения
 * @param {number} maxLen - Максимальная длина до обрезки
 * @param {string} columnName - Название колонки (для статистики/отладки)
 * @returns {string} HTML строка
 */
export function createTruncatableHtml(text, maxLen = 20, columnName = '') {
    if (!text || text === '—' || text.trim() === '') {
        return '<span class="text-empty">—</span>';
    }
    
    const displayText = text.length > maxLen ? text.substring(0, maxLen) + '...' : text;
    const safeText = escapeHtml(text);
    
    return `<span class="truncatable-text" 
                   data-fulltext="${safeText}" 
                   data-column="${columnName}"
                   onclick="handleTextViewClick(this)"
                   title="${text}">${displayText}</span>`;
}

/**
 * Обработчик клика (должен быть глобальным для работы из HTML)
 */
window.handleTextViewClick = function(element) {
    const fullText = element.getAttribute('data-fulltext');
    const columnName = element.getAttribute('data-column') || 'Текст';
    
    if (fullText) {
        openFullTextView(fullText, columnName);
    }
};

/**
 * Открывает модальное окно с полным текстом
 */
function openFullTextView(text, title = 'Полный текст') {
    const modal = document.getElementById('fullTextModal');
    const modalTitle = document.getElementById('fullTextModalTitle');
    const modalContent = document.getElementById('fullTextContent');
    
    if (!modal || !modalContent) {
        console.error('❌ Modal elements not found. Add fullTextModal to HTML.');
        return;
    }
    
    // Устанавливаем заголовок (если есть элемент)
    if (modalTitle) {
        modalTitle.textContent = title;
    }
    
    // Устанавливаем текст с сохранением переносов строк
    modalContent.textContent = text;
    modalContent.style.whiteSpace = 'pre-wrap';
    
    // Показываем модальное окно
    if (window.openModal) {
        window.openModal('fullTextModal');
    } else {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
}

/**
 * Экранирование HTML-символов для безопасности
 */
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Инициализация модального окна (вызывать один раз при загрузке страницы)
 */
export function initTextViewer() {
    // Проверяем наличие модального окна
    if (!document.getElementById('fullTextModal')) {
        console.warn('⚠️ fullTextModal not found. Creating automatically...');
        createTextViewerModal();
    }
}

/**
 * Создает модальное окно программно (если его нет в HTML)
 */
function createTextViewerModal() {
    const modalHtml = `
    <div id="fullTextModal" class="modal-overlay" onclick="closeModalOnOverlay(event, 'fullTextModal')">
        <div class="text-viewer-modal" onclick="event.stopPropagation()">
            <div class="modal-header">
                <h3 id="fullTextModalTitle" style="margin: 0;">📋 Полный текст</h3>
            </div>
            <div class="modal-body">
                <div id="fullTextContent" class="full-text-content"></div>
            </div>
            <div class="modal-footer">
                <button class="btn-primary" onclick="closeModal('fullTextModal')" style="width: 100%;">
                    Понятно
                </button>
            </div>
        </div>
    </div>`;
    
    document.body.insertAdjacentHTML('beforeend', modalHtml);
}

/**
 * Утилита для закрытия модалки (если не определена глобально)
 */
window.closeModalOnOverlay = window.closeModalOnOverlay || function(event, modalId) {
    if (event.target.id === modalId) {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    }
};

window.closeModal = window.closeModal || function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
    }
};

window.openModal = window.openModal || function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
    }
};