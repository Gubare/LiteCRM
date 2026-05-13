// resources/js/partials/toast.js

/**
 * Показать уведомление
 * @param {string} message - Текст сообщения
 * @param {string} type - Тип: 'success', 'error', 'warning', 'info'
 * @param {number} duration - Время показа в мс (0 = не закрывать)
 */
export function showToast(message, type = 'info', duration = 3000) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    
    // Иконки для разных типов
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };
    
    // Стили для разных типов
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        warning: '#f59e0b',
        info: '#3b82f6'
    };
    
    toast.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: ${colors[type] || colors.info};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 9999;
        font-size: 14px;
        font-weight: 500;
        animation: slideInRight 0.3s ease;
        max-width: 400px;
        line-height: 1.4;
    `;
    
    document.body.appendChild(toast);
    
    // Автозакрытие
    if (duration > 0) {
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    return toast;
}

// Утилиты для разных типов
export function showSuccess(message) { return showToast(message, 'success'); }
export function showError(message) { return showToast(message, 'error'); }
export function showWarning(message) { return showToast(message, 'warning'); }
export function showInfo(message) { return showToast(message, 'info'); }

// Закрыть все уведомления
export function dismissAllToasts() {
    document.querySelectorAll('.toast').forEach(toast => toast.remove());
}

// Добавить CSS анимации (один раз при загрузке)
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideInRight {
            from { transform: translateX(400px); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
        }
        @keyframes slideOutRight {
            from { transform: translateX(0); opacity: 1; }
            to { transform: translateX(400px); opacity: 0; }
        }
    `;
    document.head.appendChild(style);
}