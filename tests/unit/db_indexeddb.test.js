// tests/unit/db_indexeddb.test.js
import { describe, it, expect } from 'vitest';
import { 
    getAllItems,
    addItem,
    updateItem,
    deleteItem
} from '../../resources/js/db_indexeddb.js';

describe('Database Operations', () => {
    
    describe('addItem', () => {
        it('should add item to store', async () => {
            const client = {
                name: 'Test Client',
                phone: '+79999999999',
                email: 'test@example.com'
            };
            
            const id = await addItem('clients', client);
            
            expect(id).toBeDefined();
            expect(typeof id).toBe('number');
            
            const items = await getAllItems('clients');
            expect(items).toHaveLength(1);
            expect(items[0].name).toBe('Test Client');
        });
    });
    
    describe('updateItem', () => {
        it('should update existing item', async () => {
            const id = await addItem('clients', { name: 'Original' });
            await updateItem('clients', id, { name: 'Updated' });
            
            const items = await getAllItems('clients');
            const updated = items.find(i => i.id === id);
            expect(updated?.name).toBe('Updated');
        });
        
        it('should preserve unchanged fields', async () => {
            const id = await addItem('clients', { 
                name: 'Client',
                phone: '+79999999999'
            });
            
            await updateItem('clients', id, { name: 'New Name' });
            
            const items = await getAllItems('clients');
            const updated = items.find(i => i.id === id);
            expect(updated?.name).toBe('New Name');
            expect(updated?.phone).toBe('+79999999999'); // ← Сохранилось!
        });
    });
    
    describe('deleteItem', () => {
        it('should delete item by id', async () => {
            const id = await addItem('clients', { name: 'To Delete' });
            await deleteItem('clients', id);
            
            const items = await getAllItems('clients');
            const found = items.find(i => i.id === id);
            expect(found).toBeUndefined();
        });
        
    });
});