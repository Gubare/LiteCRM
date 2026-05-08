// resources/js/product.js

import { 
    getAllItems, 
    addItem, 
    updateItem, 
    deleteItem,
    createProduct,
    generateSKU
} from './db_indexeddb.js';
import { getSetting } from './settings-manager.js';
const STORE_NAME = 'products';

// Загрузить все товары
export async function loadProductList() {
    return await getAllItems(STORE_NAME);
}

// Создать товар (обёртка)
export async function handleProductFormSubmit(formData) {
    try {
        const id = await createProduct({
            category: formData.category,
            name: formData.name,
            description: formData.description,
            price: formData.price,
            quantity: formData.quantity,
            is_active: formData.is_active !== 'false'
        });
        
        console.log('✅ Product created with ID:', id);
        return id;
    } catch (error) {
        console.error('❌ Error creating product:', error);
        throw error;
    }
}

// Обновить товар
export async function updateProduct(id, data) {
    try {
        // Если меняется категория — перегенерируем SKU
        if (data.category) {
            data.sku = generateSKU(data.category, id);
        }
        data.updated_at = new Date().toISOString();
        
        await updateItem(STORE_NAME, id, data);
        console.log('✅ Product updated:', id);
        return true;
    } catch (error) {
        console.error('❌ Error updating product:', error);
        throw error;
    }
}

// Удалить товар
export async function deleteProduct(id) {
    try {
        await deleteItem(STORE_NAME, id);
        console.log('✅ Product deleted:', id);
        return true;
    } catch (error) {
        console.error('❌ Error deleting product:', error);
        throw error;
    }
}

// Получить товар по ID
export async function getProductById(id) {
    return await getItemById(STORE_NAME, id);
}

// Фильтр: только активные товары
export async function getActiveProductsOnly() {
    const products = await getAllItems(STORE_NAME);
    return products.filter(p => p.is_active);
}

export { generateSKU };