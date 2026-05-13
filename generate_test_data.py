#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Генератор тестовых данных для CRM System
Использование: python generate_test_data.py --clients 100 --products 100 --sales 100 --tickets 100 --notes 50 --output crm_data/backup.json
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
    
    base_date = datetime(2026, 1, 1)
    
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
    base_date = datetime(2026, 1, 1)
    
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
    base_date = datetime(2026, 5, 1)
    
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

def generate_sales(clients, products, count, start_id=1):
    """Генерация продаж"""
    sales = []
    base_date = datetime(2026, 1, 1)
    
    for i in range(count):
        created = random_date(base_date, datetime.now())
        product = random.choice(products) if products else None
        client = random.choice(clients) if clients and random.random() > 0.2 else None
        
        sale_type = random.choice(SALE_TYPES)
        quantity = random.randint(1, 20)
        unit_price = product["price"] if product else round(random.uniform(100, 10000), 2)
        
        # Комментарий с периодом (10% случаев)
        comment = ""
        if random.random() > 0.9:
            start_d = random_date(base_date, created)
            end_d = random_date(start_d, created + timedelta(days=30))
            comment = f"📅 Период: с {start_d.strftime('%d.%m.%Y')} по {end_d.strftime('%d.%m.%Y')}"
        elif random.random() > 0.8:
            comment = f"Комментарий #{random.randint(1000, 9999)}"
        
        sale = {
            "client_id": client["id"] if client else None,
            "product_id": product["id"] if product else None,
            "quantity": quantity,
            "unit_price": unit_price,
            "total_amount": round(quantity * unit_price, 2),
            "transaction_date": created.strftime("%Y-%m-%dT%H:%M"),
            "comment": comment,
            "type": sale_type,
            "is_bulk": False,
            "created_at": created.isoformat() + "Z",
            "updated_at": created.isoformat() + "Z",
            "id": start_id + i
        }
        # Убираем None для совместимости
        sale = {k: v for k, v in sale.items() if v is not None}
        sales.append(sale)
    
    return sales

def generate_calendar_notes(count, start_id=1):
    """Генерация заметок календаря"""
    notes = []
    base_date = datetime(2026, 1, 1)
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
    parser = argparse.ArgumentParser(description='Генератор тестовых данных для CRM')
    parser.add_argument('--clients', type=int, default=100, help='Количество клиентов')
    parser.add_argument('--products', type=int, default=100, help='Количество товаров')
    parser.add_argument('--tickets', type=int, default=100, help='Количество обращений')
    parser.add_argument('--sales', type=int, default=100, help='Количество продаж')
    parser.add_argument('--notes', type=int, default=50, help='Количество заметок календаря')
    parser.add_argument('--start-id', type=int, default=1, help='Начальный ID для записей')
    parser.add_argument('--output', type=str, default='crm_data/backup.json', help='Путь к выходному файлу')
    
    args = parser.parse_args()
    
    print(f"🚀 Генерация тестовых данных...")
    print(f"   Клиенты: {args.clients}, Товары: {args.products}, Обращения: {args.tickets}, Продажи: {args.sales}, Заметки: {args.notes}")
    
    # Генерация
    clients = generate_clients(args.clients, args.start_id)
    products = generate_products(args.products, args.start_id + args.clients)
    tickets = generate_tickets(clients, args.tickets, args.start_id + args.clients + args.products)
    sales = generate_sales(clients, products, args.sales, args.start_id + args.clients + args.products + args.tickets)
    notes = generate_calendar_notes(args.notes, args.start_id + args.clients + args.products + args.tickets + args.sales)
    
    # Формирование структуры
    data = {
        "version": 6,
        "exported_at": datetime.now().isoformat() + "Z",
        "stores": [
            {"store": "clients", "items": clients},
            {"store": "products", "items": products},
            {"store": "tickets", "items": tickets},
            {"store": "sales", "items": sales},
            {"store": "bulk_adjustments", "items": []},  # Можно добавить при необходимости
            {"store": "calendar_notes", "items": notes}
        ]
    }
    
    # Создание директории если нет
    os.makedirs(os.path.dirname(args.output) if os.path.dirname(args.output) else '.', exist_ok=True)
    
    # Сохранение
    with open(args.output, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False, indent=2)
    
    print(f"✅ Данные сохранены в {args.output}")
    print(f"📊 Итого записей: {len(clients)} клиентов, {len(products)} товаров, {len(tickets)} обращений, {len(sales)} продаж, {len(notes)} заметок")

if __name__ == "__main__":
    main()