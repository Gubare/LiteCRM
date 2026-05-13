// resources/js/partials/modalManager.js

/**
 * Менеджер модальных окон
 * Универсальные функции для работы с модальными окнами
 */

// Хранилище открытых модальных окон
const openModals = new Set();

/**
 * Открыть модальное окно
 * @param {string} modalId - ID элемента модального окна
 * @param {Object} options - Дополнительные опции
 * @param {boolean} options.closeOnOverlay - Закрывать при клике на оверлей (default: true)
 * @param {boolean} options.closeOnEscape - Закрывать по Escape (default: true)
 * @param {Function} options.onOpen - Callback после открытия
 * @param {Function} options.onClose - Callback после закрытия
 */
export function openModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.error(`❌ Modal "${modalId}" not found`);
        return false;
    }

    const settings = {
        closeOnOverlay: true,
        closeOnEscape: true,
        onOpen: null,
        onClose: null,
        ...options
    };

    // Показываем модальное окно
    modal.classList.add('active');
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden'; // Блокируем прокрутку фона
    
    openModals.add(modalId);

    // Обработчик клика на оверлей
    if (settings.closeOnOverlay) {
        const overlayHandler = (e) => {
            if (e.target === modal) {
                closeModal(modalId, { runCallback: false });
                modal.removeEventListener('click', overlayHandler);
            }
        };
        modal.addEventListener('click', overlayHandler);
    }

    // Обработчик Escape
    if (settings.closeOnEscape && !modal.dataset.escapeHandler) {
        const escapeHandler = (e) => {
            if (e.key === 'Escape' && openModals.has(modalId)) {
                closeModal(modalId);
                document.removeEventListener('keydown', escapeHandler);
                modal.dataset.escapeHandler = 'false';
            }
        };
        document.addEventListener('keydown', escapeHandler);
        modal.dataset.escapeHandler = 'true';
    }

    // Callback
    if (typeof settings.onOpen === 'function') {
        settings.onOpen(modal);
    }

    console.log(`✅ Modal "${modalId}" opened`);
    return true;
}

/**
 * Закрыть модальное окно
 * @param {string} modalId - ID элемента модального окна
 * @param {Object} options - Дополнительные опции
 * @param {boolean} options.runCallback - Выполнить callback (default: true)
 */
export function closeModal(modalId, options = {}) {
    const modal = document.getElementById(modalId);
    if (!modal) {
        console.warn(`⚠️ Modal "${modalId}" not found or already closed`);
        return false;
    }

    const settings = {
        runCallback: true,
        ...options
    };

    // Скрываем модальное окно
    modal.classList.remove('active');
    modal.style.display = 'none';
    
    // Восстанавливаем прокрутку, если нет других открытых модалок
    if (openModals.size <= 1) {
        document.body.style.overflow = '';
    }
    
    openModals.delete(modalId);

    // Callback
    if (settings.runCallback) {
        const onClose = modal.dataset.onClose;
        if (onClose && typeof window[onClose] === 'function') {
            window[onClose](modalId);
        }
    }

    console.log(`✅ Modal "${modalId}" closed`);
    return true;
}

/**
 * Закрыть все открытые модальные окна
 */
export function closeAllModals() {
    openModals.forEach(modalId => {
        closeModal(modalId, { runCallback: false });
    });
    console.log('✅ All modals closed');
}

/**
 * Показать модальное окно подтверждения
 * @param {string} title - Заголовок
 * @param {string} message - Сообщение
 * @param {Object} options - Опции
 * @returns {Promise<boolean>} - true если подтверждено, false если отменено
 */
export function confirmModal(title, message, options = {}) {
    return new Promise((resolve) => {
        const settings = {
            confirmText: 'Подтвердить',
            cancelText: 'Отмена',
            confirmClass: 'btn-primary',
            cancelClass: 'btn-action',
            type: 'warning', // 'warning', 'danger', 'info'
            ...options
        };

        // Создаем модальное окно
        const modalId = 'confirmModal_' + Date.now();
        const modalHtml = createConfirmModalHtml(modalId, title, message, settings);
        
        // Добавляем в DOM
        const tempContainer = document.createElement('div');
        tempContainer.innerHTML = modalHtml;
        const modalElement = tempContainer.firstElementChild;
        document.body.appendChild(modalElement);

        // Показываем
        openModal(modalId, {
            closeOnEscape: true,
            closeOnOverlay: false,
            onOpen: () => {
                // Навешиваем обработчики
                document.getElementById(`${modalId}_confirm`).addEventListener('click', () => {
                    closeModal(modalId);
                    setTimeout(() => {
                        document.body.removeChild(modalElement);
                        resolve(true);
                    }, 200);
                });

                document.getElementById(`${modalId}_cancel`).addEventListener('click', () => {
                    closeModal(modalId);
                    setTimeout(() => {
                        document.body.removeChild(modalElement);
                        resolve(false);
                    }, 200);
                });
            }
        });
    });
}

/**
 * Показать модальное окно с сообщением (alert)
 * @param {string} title - Заголовок
 * @param {string} message - Сообщение
 * @param {string} type - Тип: 'info', 'success', 'warning', 'error'
 * @returns {Promise<void>}
 */
export function alertModal(title, message, type = 'info') {
    return new Promise((resolve) => {
        const modalId = 'alertModal_' + Date.now();
        const icons = {
            info: 'ℹ️',
            success: '✅',
            warning: '⚠️',
            error: '❌'
        };

        const modalHtml = `
        <div id="${modalId}" class="modal-overlay" style="display: none;">
            <div class="modal-window" style="max-width: 450px; text-align: center;" onclick="event.stopPropagation()">
                <div style="font-size: 48px; margin-bottom: 15px;">${icons[type] || icons.info}</div>
                <h3 style="margin: 0 0 15px 0; color: #1e293b;">${title}</h3>
                <div style="color: #64748b; margin-bottom: 25px; line-height: 1.6;">${message}</div>
                <button class="btn-primary" onclick="closeModal('${modalId}')" style="width: 100%; padding: 10px;">
                    Понятно
                </button>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHtml);

        openModal(modalId, {
            closeOnEscape: true,
            closeOnOverlay: false,
            onOpen: () => {
                // Автозакрытие через 5 секунд для info
                if (type === 'info') {
                    setTimeout(() => {
                        if (document.getElementById(modalId)) {
                            closeModal(modalId);
                        }
                    }, 5000);
                }
            },
            onClose: () => {
                const modal = document.getElementById(modalId);
                if (modal) {
                    document.body.removeChild(modal);
                }
                resolve();
            }
        });
    });
}

/**
 * Создать HTML для модального окна подтверждения
 */
function createConfirmModalHtml(modalId, title, message, settings) {
    const typeColors = {
        warning: '#f59e0b',
        danger: '#ef4444',
        info: '#3b82f6'
    };

    const color = typeColors[settings.type] || typeColors.info;

    return `
    <div id="${modalId}" class="modal-overlay" style="display: none;">
        <div class="modal-window" style="max-width: 450px;" onclick="event.stopPropagation()">
            <div style="border-left: 4px solid ${color}; padding-left: 15px; margin-bottom: 20px;">
                <h3 style="margin: 0; color: #1e293b;">${title}</h3>
            </div>
            <div style="color: #475569; margin-bottom: 25px; line-height: 1.6;">${message}</div>
            <div style="display: flex; gap: 10px;">
                <button id="${modalId}_cancel" class="${settings.cancelClass}" style="flex: 1; padding: 10px;">
                    ${settings.cancelText}
                </button>
                <button id="${modalId}_confirm" class="${settings.confirmClass}" style="flex: 1; padding: 10px;">
                    ${settings.confirmText}
                </button>
            </div>
        </div>
    </div>`;
}

/**
 * Создать произвольное модальное окно из конфигурации
 * @param {Object} config - Конфигурация модального окна
 * @returns {string} modalId
 */
export function createModal(config) {
    const modalId = config.id || 'modal_' + Date.now();
    
    const modalHtml = `
    <div id="${modalId}" class="modal-overlay" style="display: none;">
        <div class="modal-window" style="${config.width ? 'max-width: ' + config.width : ''}" onclick="event.stopPropagation()">
            ${config.header ? `<div class="modal-header">${config.header}</div>` : ''}
            <div class="modal-body">${config.body || ''}</div>
            ${config.footer ? `<div class="modal-footer">${config.footer}</div>` : ''}
        </div>
    </div>`;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    return modalId;
}

/**
 * Получить список открытых модальных окон
 */
export function getOpenModals() {
    return Array.from(openModals);
}



// Экспорт для глобального доступа
window.openModal = openModal;
window.closeModal = closeModal;
window.confirmModal = confirmModal;
window.alertModal = alertModal;