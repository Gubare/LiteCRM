// resources/js/error-handler.js
// Универсальная система обработки ошибок с повторными попытками

let errorModalCallback = null;

// Создание HTML для модального окна ошибок
export function createErrorModal() {
    const modal = document.createElement('div');
    modal.id = 'errorModal';
    modal.className = 'modal';
    modal.style.display = 'none';
    modal.innerHTML = `
        <div class="modal-content" style="max-width: 500px;">
            <h3 style="color: #ef4444; margin-top: 0;">⚠️ Ошибка операции</h3>
            <div id="errorModalMessage" style="margin: 15px 0; line-height: 1.6;"></div>
            <div style="background: #fef2f2; padding: 12px; border-radius: 6px; margin: 15px 0; font-size: 13px;">
                <strong>Рекомендации:</strong>
                <ol style="margin: 8px 0; padding-left: 20px;">
                    <li>Проверьте подключение к данным</li>
                    <li>Попробуйте повторить операцию</li>
                    <li>Если ошибка повторяется — обратитесь в поддержку</li>
                </ol>
            </div>
            <div class="modal-actions" style="display: flex; gap: 10px; justify-content: flex-end;">
                <button id="errorModalSupport" class="btn-action" style="padding: 8px 16px;">
                    📧 Сообщить об ошибке
                </button>
                <button id="errorModalRetry" class="btn-primary" style="width: auto; padding: 8px 20px;">
                    🔄 Повторить
                </button>
                <button id="errorModalCancel" class="btn-action" style="padding: 8px 16px;">
                    Отмена
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Обработчики кнопок
    document.getElementById('errorModalRetry').addEventListener('click', () => {
        hideErrorModal();
        if (errorModalCallback) {
            errorModalCallback();
        }
    });
    
    document.getElementById('errorModalCancel').addEventListener('click', hideErrorModal);
    
    document.getElementById('errorModalSupport').addEventListener('click', () => {
        reportErrorToSupport();
    });
    
    // Закрытие по клику вне окна
    modal.addEventListener('click', (e) => {
        if (e.target === modal) hideErrorModal();
    });
}

// Показать окно ошибки
export async function showErrorWithRetry(message, retryCallback = null) {
    // Создаём модалку, если ещё нет
    if (!document.getElementById('errorModal')) {
        createErrorModal();
    }
    
    errorModalCallback = retryCallback;
    
    const modal = document.getElementById('errorModal');
    const messageEl = document.getElementById('errorModalMessage');
    
    messageEl.innerHTML = `
        <p><strong>Произошла ошибка:</strong></p>
        <p style="background: #f1f5f9; padding: 10px; border-radius: 4px; font-family: monospace; font-size: 12px;">
            ${escapeHtml(message)}
        </p>
        <p>Пожалуйста, попробуйте ещё раз.</p>
    `;
    
    modal.style.display = 'block';
    
    // Логирование для отладки
    console.error('❌ Error shown to user:', message);
}

// Скрыть окно ошибки
export function hideErrorModal() {
    const modal = document.getElementById('errorModal');
    if (modal) {
        modal.style.display = 'none';
    }
    errorModalCallback = null;
}

// Сообщить об ошибке (генерация отчёта)
export function reportErrorToSupport() {
    const errorReport = {
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
        url: window.location.href,
        error: document.getElementById('errorModalMessage')?.textContent || 'Unknown error',
        appVersion: '1.0.0', // Можно брать из neutralino.config.json
        localStorage: {
            isDatabaseReady: window.isDatabaseReady || false
        }
    };
    
    // Вариант 1: Копирование в буфер обмена
    const reportText = `
ОТЧЁТ ОБ ОШИБКЕ
===============
Время: ${errorReport.timestamp}
Страница: ${errorReport.url}
Ошибка: ${errorReport.error}
===============
    `.trim();
    
    navigator.clipboard.writeText(reportText).then(() => {
        alert('✅ Отчёт об ошибке скопирован в буфер обмена.\n\nПожалуйста, отправьте его в техническую поддержку.');
        hideErrorModal();
    }).catch(() => {
        // Фолбэк: показать alert с текстом
        alert('Скопируйте этот текст и отправьте в поддержку:\n\n' + reportText);
        hideErrorModal();
    });
}

// Вспомогательная функция для экранирования HTML
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Универсальная функция с retry-логикой (для критических операций)
export async function executeWithRetry(operation, maxRetries = 2, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
        try {
            console.log(`🔄 Attempt ${attempt}/${maxRetries + 1}`);
            return await operation();
        } catch (error) {
            lastError = error;
            console.error(`❌ Attempt ${attempt} failed:`, error);
            
            if (attempt <= maxRetries) {
                console.log(`⏳ Waiting ${delay}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }
    
    // Все попытки исчерпаны
    throw lastError;
}

// Инициализация при загрузке
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', () => {
        createErrorModal();
    });
}