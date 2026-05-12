// resources/js/icons.js
// Для системных иконок
export const ICONS = {
    home: '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 5L5 20h6v12h18V20h6L20 5z"/></svg>',
    clients: '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M20 10c-4 0-7 3-7 7s3 7 7 7 7-3 7-7-3-7-7-7zm0 18c-6 0-11 3-11 7v2h22v-2c0-4-5-7-11-7z"/></svg>',
    sales: '<svg viewBox="0 0 40 40" fill="currentColor"><path d="M10 25l10-10 10 10H10z"/></svg>'
};

export function getIcon(name) {
    return ICONS[name] || '';
}
