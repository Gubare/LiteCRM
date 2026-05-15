// tests/setup.js

// ✅ Правильный импорт для fake-indexeddb v4+
import 'fake-indexeddb/auto';

// Для совместимости с некоторыми библиотеками
if (typeof global.IDBKeyRange === 'undefined') {
    global.IDBKeyRange = require('fake-indexeddb/lib/FDBKeyRange').default;
}