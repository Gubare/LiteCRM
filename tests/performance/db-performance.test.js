// tests/performance/db-performance.test.js
import { describe, it, expect, beforeEach, beforeAll, afterAll } from 'vitest';
import { 
    getAllItems,
    addItem,
    updateItem,
    deleteItem,
    getDbInstance
} from '../../resources/js/db_sqlite.js';

const TEST_SCALES = [100, 1000, 2000];
const TEST_STORE = 'clients';

// Генератор с УНИКАЛЬНЫМ суффиксом для изоляции тестов
function generateTestData(count, prefix = 'test') {
    const uniqueSuffix = `_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    return Array.from({ length: count }, (_, i) => ({
        name: `${prefix}_${count}${uniqueSuffix}_item_${i + 1}`,
        phone: `+7900000${String(i).padStart(4, '0')}`,
        email: `${prefix}${i + 1}@test.local`,
        created_at: new Date().toISOString(),
        total_spent: Math.floor(Math.random() * 100000),
        purchase_count: Math.floor(Math.random() * 50)
    }));
}

// Утилита очистки
async function clearStore(storeName) {
    const db = await getDbInstance();
    if (db.objectStoreNames.contains(storeName)) {
        return new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, 'readwrite');
            const request = tx.objectStore(storeName).clear();
            request.onsuccess = () => resolve();
            request.onerror = () => reject(request.error);
        });
    }
}

describe('🚀 Performance Tests: Database Operations', () => {
    
    // ✅ Очищаем перед КАЖДЫМ тестом
    beforeEach(async () => {
        await clearStore(TEST_STORE);
    });
    
    describe('➕ addItem Performance', () => {
        TEST_SCALES.forEach(count => {
            it(`should add ${count} items`, async () => {
                const data = generateTestData(count, `bulk`);
                
                console.time(`⏱️ Add ${count} items`);
                const start = performance.now();
                
                const ids = [];
                for (const item of data) {
                    const id = await addItem(TEST_STORE, item);
                    ids.push(id);
                }
                
                const end = performance.now();
                console.timeEnd(`⏱️ Add ${count} items`);
                
                const duration = end - start;
                console.table([{
                    'Записей': count,
                    'Время (мс)': duration.toFixed(2),
                    'Среднее на запись (мс)': (duration / count).toFixed(3),
                    'Записей/сек': (count / duration * 1000).toFixed(2)
                }]);
                
                // Проверка: используем уникальный префикс из данных
                const allItems = await getAllItems(TEST_STORE);
                const uniquePrefix = data[0].name.split('_item_')[0];
                const addedItems = allItems.filter(i => i.name.startsWith(uniquePrefix));
                expect(addedItems).toHaveLength(count);
            });
        });
    });
    
    describe('📖 getAllItems Performance', () => {
        TEST_SCALES.forEach(count => {
            it(`should read ${count} items`, async () => {
                // Создаём данные с уникальным префиксом
                const data = generateTestData(count, `read_test`);
                for (const item of data) {
                    await addItem(TEST_STORE, item);
                }
                
                const uniquePrefix = data[0].name.split('_item_')[0];
                
                console.time(`⏱️ Read ${count} items`);
                const start = performance.now();
                
                const result = await getAllItems(TEST_STORE);
                const filtered = result.filter(i => i.name.startsWith(uniquePrefix));
                
                const end = performance.now();
                console.timeEnd(`⏱️ Read ${count} items`);
                
                const duration = end - start;
                console.table([{
                    'Записей': filtered.length,
                    'Время (мс)': duration.toFixed(2),
                    'Среднее на чтение (мс)': (duration / filtered.length).toFixed(3)
                }]);
                
                expect(filtered).toHaveLength(count);
            });
        });
    });
    
    describe('✏️ updateItem Performance', () => {
        TEST_SCALES.forEach(count => {
            it(`should update ${count} items`, async () => {
                const data = generateTestData(count, `update_test`);
                const ids = [];
                for (const item of data) {
                    const id = await addItem(TEST_STORE, item);
                    ids.push(id);
                }
                
                console.time(`⏱️ Update ${count} items`);
                const start = performance.now();
                
                for (let i = 0; i < count; i++) {
                    await updateItem(TEST_STORE, ids[i], {
                        name: data[i].name + '_updated',
                        updated_at: new Date().toISOString()
                    });
                }
                
                const end = performance.now();
                console.timeEnd(`⏱️ Update ${count} items`);
                
                const duration = end - start;
                console.table([{
                    'Записей': count,
                    'Время (мс)': duration.toFixed(2),
                    'Среднее на обновление (мс)': (duration / count).toFixed(3)
                }]);
            });
        });
    });
    
    describe('deleteItem Performance', () => {
        TEST_SCALES.forEach(count => {
            it(`should delete ${count} items`, async () => {
                const data = generateTestData(count, `delete_test`);
                const ids = [];
                for (const item of data) {
                    const id = await addItem(TEST_STORE, item);
                    ids.push(id);
                }
                
                console.time(`⏱️ Delete ${count} items`);
                const start = performance.now();
                
                for (const id of ids) {
                    await deleteItem(TEST_STORE, id);
                }
                
                const end = performance.now();
                console.timeEnd(`⏱️ Delete ${count} items`);
                
                const duration = end - start;
                console.table([{
                    'Записей': count,
                    'Время (мс)': duration.toFixed(2),
                    'Среднее на удаление (мс)': (duration / count).toFixed(3)
                }]);
                
                // Проверка: всё удалено
                const remaining = await getAllItems(TEST_STORE);
                const uniquePrefix = data[0].name.split('_item_')[0];
                const stillThere = remaining.filter(i => i.name.startsWith(uniquePrefix));
                expect(stillThere).toHaveLength(0);
            });
        });
    });
    
    // ✅ Увеличенный таймаут для полного цикла
    describe('🔄 Full CRUD Cycle Performance', () => {
        it('should handle 1000 items', { timeout: 60000 }, async () => {
            const COUNT = 1000;
            const prefix = `cycle_test_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            
            console.log(`\n🔄 Starting full cycle test with ${COUNT} items...`);
            
            // CREATE
            console.time('📦 CREATE');
            const ids = [];
            for (let i = 0; i < COUNT; i++) {
                const id = await addItem(TEST_STORE, {
                    name: `${prefix}_item_${i}`,
                    phone: `+7900${String(i).padStart(6, '0')}`,
                    email: `${prefix}${i}@test.local`
                });
                ids.push(id);
            }
            console.timeEnd('📦 CREATE');
            
            // READ
            console.time('📖 READ');
            const items = await getAllItems(TEST_STORE);
            const testItems = items.filter(i => i.name.startsWith(prefix));
            console.timeEnd('📖 READ');
            expect(testItems).toHaveLength(COUNT);
            
            // UPDATE
            console.time('✏️ UPDATE');
            for (const item of testItems) {
                await updateItem(TEST_STORE, item.id, {
                    ...item,
                    updated_at: new Date().toISOString()
                });
            }
            console.timeEnd('✏️ UPDATE');
            
            // DELETE
            console.time('DELETE');
            for (const id of ids) {
                await deleteItem(TEST_STORE, id);
            }
            console.timeEnd('DELETE');
            
            // Проверка
            const remaining = await getAllItems(TEST_STORE);
            const stillThere = remaining.filter(i => i.name.startsWith(prefix));
            expect(stillThere).toHaveLength(0);
            
            console.log('✅ Full cycle completed successfully\n');
        }, { timeout: 60000 }); // ← 60 секунд для полного цикла
    });
});