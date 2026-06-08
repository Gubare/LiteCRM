#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор тестовых данных для CRM System (нормализованная БД)
Использование:
  py tests/stress/generate_test_data.py --clients 1000 --products 1000 --sales 500 --tickets 1000 --notes 500 --output tests/stress/backup.json

Изменения:
- Таблица sales теперь содержит только заголовки чеков
- Позиции товаров хранятся в новой таблице sale_items
- Одна продажа может содержать несколько товаров
"""

import json
import random
import argparse
from datetime import datetime, timedelta
import os

# === НАСТРОЙКИ ГЕНЕРАЦИИ ===
CATEGORIES = ['Телефон', 'Планшет', 'Ноутбук', 'Наушники', 'Часы', 'Аксессуары', 'Компьютер', 'Монитор', 'Клавиатура', 'Мышь']
PRODUCT_NAMES = {
    'Телефон': ['A61', 'A62', 'A33', 'X-Pro', 'MaxPlus', 'Lite', 'Ultra', 'Mini'],
    'Планшет': ['Tab-10', 'Pad-X', 'Slate-8', 'Air-11'],
    'Ноутбук': ['Book-15', 'Pro-14', 'Air-13', 'Gamer-17'],
    'Наушники': ['Sound-Buds', 'Air-Pro', 'Bass-Max', 'Quiet-300'],
    'Часы': ['Watch-S', 'Fit-Pro', 'Classic-42', 'Sport-46'],
    'Аксессуары': ['Чехол', 'Защитное стекло', 'Кабель USB-C', 'Блок питания', 'Подставка'],
    'Компьютер': ['Desktop-Basic', 'Gaming-PC', 'WorkStation'],
    'Монитор': ['GE-213981', 'View-24', 'Ultra-27', 'Curved-32'],
    'Клавиатура': ['Mech-Key', 'Wireless-Compact', 'Gaming-RGB'],
    'Мышь': ['Ergo-Mouse', 'Gaming-6K', 'Silent-Click']
}
TICKET_TYPES = ['Вопрос', 'Жалоба', 'Заказ', 'Предложение', 'Претензия', 'Благодарность']
TICKET_STATUSES = ['Открыта', 'Выполнена', 'Архив']
SALE_TYPES = ['sale', 'writeoff', 'restock']
NOTE_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899']
LONG_TEXT = """вчфслыяюмшдрфидрфышгпарыфот.зампфыяриосшыщпшднврл
пышвимшдфигшмиыф
ырпавываявчпаспршощжжшдглноавсп
длинный текст для проверки обрезки и прокрутки в модальном окне"""
START_DATE = datetime(2026, 5, 1)

def random_date(start_date, end_date):
    """Генерация случайной даты в диапазоне"""
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    random_seconds = random.randint(0, 86399)
    return start_date + timedelta(days=random_days, seconds=random_seconds)

def generate_clients(count, start_id=1):
    """Генерация клиентов"""
    clients = []
    first_names = ['Александр', 'Мария', 'Дмитрий', 'Анна', 'Сергей', 'Елена', 'Андрей', 'Ольга', 'Михаил', 'Татьяна', 'Иван', 'Наталья', 'Петр', 'Ирина', 'Алексей', 'Светлана']
    last_names = ['Иванов', 'Смирнов', 'Кузнецов', 'Попов', 'Соколов', 'Лебедев', 'Козлов', 'Новиков', 'Морозов', 'Петров', 'Волков', 'Соловьев', 'Васильев', 'Зайцев', 'Павлов', 'Семенов']
    
    base_date = START_DATE
    
    for i in range(count):
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        created = random_date(base_date, datetime.now())
        
        client = {
            "name": name,
            "phone": f"+7{random.randint(9000000000, 9999999999)}" if random.random() > 0.2 else "",
            "email": f"{name.split()[0].lower()}.{i}@example.com" if random.random() > 0.3 else "",
            "created_at": created.isoformat() + "Z",
            "id": start_id + i,
            "total_spent": random.randint(0, 200000),
            "purchase_count": random.randint(0, 25),
            "updated_at": created.isoformat() + "Z"
        }
        clients.append(client)
    
    return clients

def generate_products(count, start_id=1):
    """Генерация товаров"""
    products = []
    base_date = START_DATE
    
    for i in range(count):
        category = random.choice(CATEGORIES)
        name = random.choice(PRODUCT_NAMES[category])
        sku_prefix = category[:2].upper()
        
        product = {
            "sku": f"{sku_prefix}-{start_id + i}",
            "category": category,
            "name": f"{name}-{random.randint(100, 999)}",
            "description": LONG_TEXT if random.random() > 0.7 else "",
            "price": round(random.uniform(100, 50000), 2),
            "quantity": random.randint(0, 100),
            "is_active": random.random() > 0.15,
            "created_at": random_date(base_date, datetime.now()).isoformat() + "Z",
            "id": start_id + i,
            "updated_at": random_date(base_date, datetime.now()).isoformat() + "Z"
        }
        products.append(product)
    
    return products

def generate_tickets(clients, count, start_id=1):
    """Генерация обращений"""
    tickets = []
    base_date = START_DATE
    
    for i in range(count):
        # 70% привязываем к клиенту, 30% — без
        if clients and random.random() > 0.3:
            client = random.choice(clients)
            ticket = {
                "client_id": str(client["id"]),
                "client_name": client["name"],
            }
        else:
            ticket = {"client_name": f"Анонимный-{random.randint(1000,9999)}"}
        
        created = random_date(base_date, datetime.now())
        
        ticket.update({
            "type": random.choice(TICKET_TYPES),
            "contact": f"+7{random.randint(9000000000, 9999999999)}" if random.random() > 0.4 else "",
            "status": random.choice(TICKET_STATUSES),
            "description": LONG_TEXT if random.random() > 0.6 else ("" if random.random() > 0.5 else "Краткое описание"),
            "created_at": created.isoformat() + "Z",
            "id": start_id + i,
            "updated_at": created.isoformat() + "Z" if random.random() > 0.5 else None
        })
        # Убираем None значения
        ticket = {k: v for k, v in ticket.items() if v is not None}
        tickets.append(ticket)
    
    return tickets

def generate_sales_and_items(clients, products, count, sale_start_id=1, item_start_id=1):
    """
    Генерация продаж и позиций чеков (нормализованная структура)
    
    Возвращает кортеж: (sales_list, sale_items_list, next_sale_id, next_item_id)
    """
    sales = []
    sale_items = []
    base_date = START_DATE
    
    current_sale_id = sale_start_id
    current_item_id = item_start_id
    
    for _ in range(count):
        created = random_date(base_date, datetime.now())
        client = random.choice(clients) if clients and random.random() > 0.2 else None
        
        sale_type = random.choice(SALE_TYPES)
        
        # Комментарий с периодом (10% случаев)
        comment = ""
        if random.random() > 0.9:
            start_d = random_date(base_date, created)
            end_d = random_date(start_d, created + timedelta(days=30))
            comment = f"📅 Период: с {start_d.strftime('%d.%m.%Y')} по {end_d.strftime('%d.%m.%Y')}"
        elif random.random() > 0.8:
            comment = f"Комментарий #{random.randint(1000, 9999)}"
        
        # Генерируем 1-3 позиции в чеке (для продажи/списания)
        # Для поступления (restock) — обычно 1 товар
        num_items = 1 if sale_type == 'restock' else random.randint(1, 3)
        total_amount = 0
        
        for _ in range(num_items):
            product = random.choice(products) if products else None
            if not product:
                continue
                
            quantity = random.randint(1, 20)
            unit_price = product["price"]
            line_total = round(quantity * unit_price, 2)
            total_amount += line_total
            
            item = {
                "id": current_item_id,
                "sale_id": current_sale_id,
                "product_id": product["id"],
                "quantity": quantity,
                "unit_price": unit_price,
                "line_total": line_total
            }
            sale_items.append(item)
            current_item_id += 1
        
        # Создаём заголовок чека
        sale = {
            "id": current_sale_id,
            "client_id": client["id"] if client else None,
            "transaction_date": created.strftime("%Y-%m-%dT%H:%M"),
            "type": sale_type,
            "comment": comment,
            "total_amount": round(total_amount, 2),
            # "created_at": created.isoformat() + "Z",
            # "updated_at": created.isoformat() + "Z"
        }
        # Убираем None для совместимости
        sale = {k: v for k, v in sale.items() if v is not None}
        sales.append(sale)
        
        current_sale_id += 1
    
    return sales, sale_items, current_sale_id, current_item_id

def generate_calendar_notes(count, start_id=1):
    """Генерация заметок календаря"""
    notes = []
    base_date = START_DATE
    end_date = datetime(2026, 12, 31)
    
    texts = ["Позвонить клиенту", "Встреча в офисе", "Оплата счета", "Подготовить отчет", "Заказать товар", "312", "yu,,y,", "h.t.t", LONG_TEXT]
    
    for i in range(count):
        date = random_date(base_date, end_date).date()
        created = random_date(base_date, datetime.now())
        
        note = {
            "date": date.isoformat(),
            "text": random.choice(texts),
            "color": random.choice(NOTE_COLORS),
            "created_at": created.isoformat() + "Z",
            "id": start_id + i,
            "updated_at": created.isoformat() + "Z"
        }
        notes.append(note)
    
    return notes

def main():
    parser = argparse.ArgumentParser(description='Генератор тестовых данных для CRM (нормализованная БД)')
    parser.add_argument('--clients', type=int, default=100, help='Количество клиентов')
    parser.add_argument('--products', type=int, default=100, help='Количество товаров')
    parser.add_argument('--tickets', type=int, default=100, help='Количество обращений')
    parser.add_argument('--sales', type=int, default=100, help='Количество продаж (чеков)')
    parser.add_argument('--notes', type=int, default=50, help='Количество заметок календаря')
    parser.add_argument('--start-id', type=int, default=1, help='Начальный ID для записей')
    parser.add_argument('--output', type=str, default='tests/stress/backup.json', help='Путь к выходному файлу')
    
    args = parser.parse_args()
    
    print(f"🚀 Генерация тестовых данных (нормализованная структура)...")
    print(f"   Клиенты: {args.clients}, Товары: {args.products}, Чеки: {args.sales}, Обращения: {args.tickets}, Заметки: {args.notes}")
    
    # Генерация с учётом нормализации
    clients = generate_clients(args.clients, args.start_id)
    products = generate_products(args.products, args.start_id + args.clients)
    tickets = generate_tickets(clients, args.tickets, args.start_id + args.clients + args.products)
    
    # Генерация продаж и позиций чеков
    sales, sale_items, next_sale_id, next_item_id = generate_sales_and_items(
        clients, products, args.sales,
        sale_start_id=args.start_id + args.clients + args.products + args.tickets,
        item_start_id=args.start_id + args.clients + args.products + args.tickets + args.sales
    )
    
    notes = generate_calendar_notes(args.notes, next_item_id)
    
    # Формирование структуры с новой таблицей sale_items
    data = {
        "version": 6,  # Обновляем версию из-за изменения структуры
        "exported_at": datetime.now().isoformat() + "Z",
        "stores": [
            {"store": "clients", "items": clients},
            {"store": "products", "items": products},
            {"store": "sales", "items": sales},
            {"store": "sale_items", "items": sale_items},
            {"store": "tickets", "items": tickets},
            {"store": "bulk_adjustments", "items": []},
            {"store": "calendar_notes", "items": notes}
        ]
    }
    
    # Создание директории если нет
    output_dir = os.path.dirname(args.output)
    if output_dir:
        os.makedirs(output_dir, exist_ok=True)
    
    # Сохранение
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Данные сохранены в {args.output}")
    print(f"📊 Итого записей:")
    print(f"   • Клиенты: {len(clients)}")
    print(f"   • Товары: {len(products)}")
    print(f"   • Чеки (sales): {len(sales)}")
    print(f"   • Позиции чеков (sale_items): {len(sale_items)}")
    print(f"   • Обращения: {len(tickets)}")
    print(f"   • Заметки: {len(notes)}")
    print(f"\n💡 Среднее количество товаров в чеке: {len(sale_items) / len(sales) if sales else 0:.2f}")

if __name__ == "__main__":
    main()