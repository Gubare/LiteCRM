/**
 * Утилиты для улучшения UX модальных окон
 */

/**
 * Устанавливает фокус на первое видимое поле ввода в модальном окне.
 * Игнорирует hidden поля и disabled элементы.
 */
export function focusFirstInput(modalSelector) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return;

    const inputs = modal.querySelectorAll('input:not([type="hidden"]), select, textarea');
    
    for (const input of inputs) {
        // Надёжная проверка видимости + доступности
        const rect = input.getBoundingClientRect();
        const isVisible = rect.height > 0 && rect.width > 0;
        const isUsable = !input.disabled && input.getAttribute('readonly') === null;
        
        if (isVisible && isUsable) {
            input.focus();
            // Для полей ввода сразу выделяем текст (удобнее для замены)
            if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                input.select();
            }
            break;
        }
    }
}
/**
 * Настраивает навигацию по полям формы стрелками (Вверх/Вниз).
 */
export function setupModalArrows(modalSelector) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return;

    modal.addEventListener('keydown', (e) => {
        const target = e.target;
        // Работаем только если фокус на поле ввода
        if (!target.matches('input, select, textarea')) return;

        let nextElement = null;
        
        // Получаем все видимые поля формы в порядке DOM
        const inputs = Array.from(modal.querySelectorAll('input:not([type="hidden"]), select, textarea'))
                            .filter(el => el.offsetParent !== null);
        
        const currentIndex = inputs.indexOf(target);

        if (e.key === 'ArrowDown') {
            e.preventDefault(); // Блокируем стандартное поведение (например, в select)
            if (currentIndex < inputs.length - 1) {
                nextElement = inputs[currentIndex + 1];
            }
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            if (currentIndex > 0) {
                nextElement = inputs[currentIndex - 1];
            }
        }

        if (nextElement) {
            nextElement.focus();
            // Для text/textarea можно выделять текст при переходе, но это опционально
        }
    });
}

/**
 * Настраивает обработку Enter и Shift+Enter для сохранения.
 */
export function setupModalHotkeys(modalSelector, formSelector, submitHandler, saveAndNewHandler) {
    const modal = document.querySelector(modalSelector);
    const form = document.querySelector(formSelector);
    
    if (!modal || !form) return;

    // Флаг, чтобы отличить простое сохранение от сохранения+нового
    let isSaveAndNewTriggered = false;

    modal.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            // Если фокус на кнопке, пусть кнопка сама обрабатывает клик
            if (e.target.tagName === 'BUTTON') return;

            e.preventDefault();

            if (e.shiftKey) {
                // Shift + Enter: Сохранить и создать новый
                isSaveAndNewTriggered = true;
                // Имитируем отправку формы, чтобы сработали валидаторы браузера
                form.requestSubmit();
            } else {
                // Enter: Просто сохранить
                isSaveAndNewTriggered = false;
                form.requestSubmit();
            }
        }
    });

    // Перехватываем отправку формы для обработки флага
    form.addEventListener('submit', async (e) => {
        // Мы не предотвращаем дефолт здесь, так как submitHandler должен быть привязан к форме отдельно.
        // Но нам нужно сообщить обработчику, что это Shift+Enter.
        
        // Мы используем глобальный (или оконный) флаг, так как событие submit не передает модификаторы клавиш напрямую
        window._modalSaveAction = isSaveAndNewTriggered ? 'saveAndNew' : 'save';
        
        // Сбрасываем флаг
        isSaveAndNewTriggered = false;
    });
}

/**
 * Показывает панель горячих клавиш для модального окна
 * @param {string} modalSelector - Селектор модального окна
 * @param {Object} customShortcuts - Кастомные комбинации (опционально)
 */
export function showShortcutsPanel(modalSelector, customShortcuts = null) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return;
    
    // Проверяем, не добавлена ли уже панель
    if (modal.querySelector('.modal-shortcuts-panel')) return;
    
// Стандартные комбинации
const shortcuts = customShortcuts || {
    navigation: { 
        desc: 'Переход между полями', 
        keys: ['↑', '↓'],
        alt: 'Tab / Shift+Tab'
    },
    dropdown: {
        desc: 'Открыть список / Выбор в списке',
        keys: ['␣', '←', '→'],
        alt: 'Пробел / Горизонтальные стрелки'
    },
    saveAndNew: { 
        desc: 'Сохранить и добавить нового', 
        keys: ['Shift', 'Enter'] 
    },
    saveAndClose: { 
        desc: 'Сохранить и закрыть', 
        keys: ['Enter'] 
    },
    close: { 
        desc: 'Закрыть без сохранения', 
        keys: ['Esc'] 
    }
};
    
    // Создаём HTML панели
    const panelHTML = `
        <div class="modal-shortcuts-panel" style="opacity: 0; animation: fadeInShortcuts 0.3s ease-out 2s forwards;">
            <h4>Горячие клавиши</h4>
            ${shortcuts.navigation ? `
            <div class="shortcut-item">
                <div>
                    <span class="shortcut-desc">${shortcuts.navigation.desc}</span>
                    ${shortcuts.navigation.alt ? `<span class="shortcut-alt">${shortcuts.navigation.alt}</span>` : ''}
                </div>
                <div class="shortcut-keys">
                    ${shortcuts.navigation.keys.map(k => `<kbd>${k}</kbd>`).join('')}
                </div>
            </div>` : ''}
            ${shortcuts.saveAndNew ? `
            <div class="shortcut-item">
                <span class="shortcut-desc">${shortcuts.saveAndNew.desc}</span>
                <div class="shortcut-keys">
                    ${shortcuts.saveAndNew.keys.map(k => `<kbd>${k}</kbd>`).join('+')}
                </div>
            </div>` : ''}
            ${shortcuts.saveAndClose ? `
            <div class="shortcut-item">
                <span class="shortcut-desc">${shortcuts.saveAndClose.desc}</span>
                <div class="shortcut-keys">
                    ${shortcuts.saveAndClose.keys.map(k => `<kbd>${k}</kbd>`).join('+')}
                </div>
            </div>` : ''}
            ${shortcuts.close ? `
            <div class="shortcut-item">
                <span class="shortcut-desc">${shortcuts.close.desc}</span>
                <div class="shortcut-keys">
                    <kbd>Esc</kbd>
                </div>
            </div>` : ''}
        </div>
    `;
    
    // Добавляем панель в модалку
    const panelContainer = document.createElement('div');
    panelContainer.innerHTML = panelHTML;
    modal.querySelector('.modal-window').appendChild(panelContainer.firstElementChild);
}

/**
 * Скрывает панель горячих клавиш
 */
export function hideShortcutsPanel(modalSelector) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return;
    
    const panel = modal.querySelector('.modal-shortcuts-panel');
    const hint = modal.querySelector('.form-footer-hint');
    
    if (panel) panel.remove();
    if (hint) hint.remove();
}

/**
 * Автоматически показывает панель при открытии модалки
 * (вызывается из openModal)
 */
export function initShortcutsForModal(modalSelector, customShortcuts = null) {
    const modal = document.querySelector(modalSelector);
    if (!modal) return;
    
    // Показываем панель
    showShortcutsPanel(modalSelector, customShortcuts);
}