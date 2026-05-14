// resources/js/partials/ui.js

export function showLoadingIndicator(message = 'Загрузка данных...') {
    let overlay = document.querySelector('.loading-overlay');
    
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = `
            <div class="loading-spinner">
                <div class="spinner-icon"></div>
                <p>${message}</p>
            </div>
        `;
        document.body.appendChild(overlay);
    }
    
    overlay.classList.remove('hidden');
}

export function hideLoadingIndicator() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.classList.add('hidden');
        setTimeout(() => overlay.remove(), 300);
    }
}

export function showProgressIndicator(percent, message = '') {
    // Для отображения прогресса загрузки
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        const spinner = overlay.querySelector('.loading-spinner');
        spinner.innerHTML = `
            <div style="width: 200px;">
                <div style="background: #e2e8f0; border-radius: 8px; height: 8px; margin-bottom: 12px;">
                    <div style="background: #3b82f6; height: 100%; border-radius: 8px; width: ${percent}%; transition: width 0.3s;"></div>
                </div>
                <p style="font-size: 13px; color: #64748b;">${message} (${Math.round(percent)}%)</p>
            </div>
        `;
    }
}