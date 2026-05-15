// tests/unit/charts.test.js
import { describe, it, expect, beforeEach } from 'vitest';
import { 
    prepareRevenueTrend,
    prepareSalesByType,
    prepareTopProducts,
    prepareClientSegments
} from '../../resources/js/charts.js';

describe('Charts Data Preparation', () => {
    describe('prepareRevenueTrend', () => {
        it('should group sales by date', () => {
            const sales = [
                { transaction_date: '2026-05-01T10:00:00Z', total_amount: 1000, type: 'sale' },
                { transaction_date: '2026-05-01T15:00:00Z', total_amount: 2000, type: 'sale' },
                { transaction_date: '2026-05-02T10:00:00Z', total_amount: 1500, type: 'sale' }
            ];
            
            const result = prepareRevenueTrend(sales, 'line');
            
            expect(result.datasets[0].data).toHaveLength(2);
            expect(result.datasets[0].data[0]).toBe(3000); // 1000 + 2000
            expect(result.datasets[0].data[1]).toBe(1500);
        });
        
        it('should filter out non-sale transactions', () => {
            const sales = [
                { transaction_date: '2026-05-01T10:00:00Z', total_amount: 1000, type: 'sale' },
                { transaction_date: '2026-05-01T15:00:00Z', total_amount: 5000, type: 'writeoff' }
            ];
            
            const result = prepareRevenueTrend(sales, 'line');
            expect(result.datasets[0].data[0]).toBe(1000);
        });
        
        it('should handle empty sales array', () => {
            const result = prepareRevenueTrend([], 'line');
            expect(result.labels).toHaveLength(0);
            expect(result.datasets[0].data).toHaveLength(0);
        });
    });
    
    describe('prepareSalesByType', () => {
        it('should group sales by type', () => {
            const sales = [
                { type: 'sale', total_amount: 1000 },
                { type: 'sale', total_amount: 2000 },
                { type: 'writeoff', total_amount: 500 },
                { type: 'restock', total_amount: 3000 }
            ];
            
            const result = prepareSalesByType(sales);
            
            expect(result.datasets[0].data).toEqual([3000, 500, 3000]);
            expect(result.labels).toEqual(['Продажа', 'Списание', 'Поступление']);
        });
        
        it('should handle missing types', () => {
            const sales = [
                { type: 'sale', total_amount: 1000 }
            ];
            
            const result = prepareSalesByType(sales);
            expect(result.datasets[0].data[0]).toBe(1000); // sale
            expect(result.datasets[0].data[1]).toBe(0);    // writeoff
            expect(result.datasets[0].data[2]).toBe(0);    // restock
        });
    });
    
    describe('prepareTopProducts', () => {
        it('should return top 10 products by revenue', () => {
            const sales = [
                { product_id: 1, total_amount: 5000, type: 'sale' },
                { product_id: 2, total_amount: 8000, type: 'sale' },
                { product_id: 1, total_amount: 3000, type: 'sale' },
                { product_id: 3, total_amount: 10000, type: 'sale' }
            ];
            
            const products = [
                { id: 1, sku: 'T-1', name: 'Product 1' },
                { id: 2, sku: 'T-2', name: 'Product 2' },
                { id: 3, sku: 'T-3', name: 'Product 3' }
            ];
            
            const result = prepareTopProducts(sales, products);
            
            expect(result.labels).toHaveLength(3);
            expect(result.datasets[0].data[0]).toBe(10000); // Product 3
            expect(result.datasets[0].data[1]).toBe(8000);  // Product 2
        });
        
        it('should limit to 10 products', () => {
            const sales = Array.from({ length: 15 }, (_, i) => ({
                product_id: i + 1,
                total_amount: 1000,
                type: 'sale'
            }));
            
            const products = Array.from({ length: 15 }, (_, i) => ({
                id: i + 1,
                sku: `T-${i + 1}`,
                name: `Product ${i + 1}`
            }));
            
            const result = prepareTopProducts(sales, products);
            expect(result.labels).toHaveLength(10);
        });
    });
});