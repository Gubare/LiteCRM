// resources/js/sql-wasm-wrapper.js

// Emscripten sql-wasm.js не поддерживает ES6 импорт напрямую.
// Загружаем его как скрипт и получаем доступ к глобальной переменной.

export async function loadSqlWasm() {
    // Проверяем, уже ли загружен
    if (typeof window.initSqlJs === 'function') {
        console.log('✅ initSqlJs already loaded');
        return window.initSqlJs;
    }
    
    // Проверяем, не загружается ли уже
    if (window.sqlWasmLoading) {
        console.log('⏳ initSqlJs loading in progress...');
        return window.sqlWasmLoading;
    }
    
    // Создаём promise для загрузки
    window.sqlWasmLoading = new Promise((resolve, reject) => {
        console.log('📥 Loading sql-wasm.js...');
        
        const script = document.createElement('script');
        script.src = './js/sql-wasm.js';
        script.type = 'text/javascript';
        
        script.onload = () => {
            console.log('✅ sql-wasm.js loaded');
            if (typeof window.initSqlJs === 'function') {
                resolve(window.initSqlJs);
            } else {
                reject(new Error('initSqlJs not found after script load'));
            }
        };
        
        script.onerror = (err) => {
            console.error('❌ Failed to load sql-wasm.js:', err);
            reject(new Error('Failed to load sql-wasm.js script'));
        };
        
        document.head.appendChild(script);
    });
    
    return window.sqlWasmLoading;
}

// Экспортируем функцию загрузки
export default loadSqlWasm;