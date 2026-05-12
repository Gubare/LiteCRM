// resources/partials/pagination.js

/**
 * Универсальная функция отрисовки пагинации
 * @param {HTMLElement} container - Контейнер для кнопок (div#pagination)
 * @param {HTMLElement} infoElement - Элемент для текста (span#paginationInfo)
 * @param {number} currentPage - Текущая страница
 * @param {number} totalPages - Всего страниц
 * @param {number} totalItems - Всего записей
 * @param {number} pageSize - Записей на страницу
 * @param {Function} onPageChange - Функция, которая вызывается при клике (принимает номер страницы)
 */
// resources/js/pagination.js

export function renderPagination(container, infoElement, currentPage, totalPages, totalItems, pageSize, onPageChange) {
    if (!container) return;

    // Обновляем текст информации
    if (infoElement) {
        infoElement.textContent = `Показано ${((currentPage - 1) * pageSize) + 1}–${Math.min(currentPage * pageSize, totalItems)} из ${totalItems}`;
    }

    let html = '';

    // Кнопки стрелок (<<, <, >, >>)
    html += createArrowButton(1, currentPage === 1, '«');
    html += createArrowButton(currentPage - 1, currentPage === 1, '‹');

    // Номера страниц
    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        // Используем классы вместо inline стилей
        html += `<button class="page-btn ${isActive ? 'active' : ''}" data-page="${i}">${i}</button>`;
    }

    html += createArrowButton(currentPage + 1, currentPage === totalPages, '›');
    html += createArrowButton(totalPages, currentPage === totalPages, '»');

    container.innerHTML = html;

    // Обработчик клика
    container.querySelectorAll('.page-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const page = parseInt(btn.dataset.page);
            if (!isNaN(page) && page !== currentPage && !btn.disabled) {
                onPageChange(page);
            }
        });
    });
}

function createArrowButton(page, disabled, text) {
    const disabledAttr = disabled ? 'disabled' : '';
    return `<button class="page-btn arrow" ${disabledAttr} data-page="${page}">${text}</button>`;
}