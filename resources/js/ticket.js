// resources/js/ticket.js
import { getAllItems, addItem, updateItem, deleteItem } from './db_indexeddb.js';

const TICKET_STORE = 'tickets';
const CLIENT_STORE = 'clients';

// Загрузить все обращения
export async function loadTickets() { return await getAllItems(TICKET_STORE); }

// Загрузить клиентов для выпадающего списка
export async function loadClientsForDropdown() { return await getAllItems(CLIENT_STORE); }

// Создать обращение
export async function createTicket(data) {
    const ticket = {
        client_id: data.client_id === 'empty' ? null : (data.client_id === 'new' ? null : parseInt(data.client_id)),
        type: data.type,
        contact: data.contact,
        description: data.description,
        status: data.status || 'open',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
    };
    return await addItem(TICKET_STORE, ticket);
}

// Обновить обращение
export async function updateTicket(id, data) {
    data.updated_at = new Date().toISOString();
    if (data.client_id === 'empty') data.client_id = null;
    else if (data.client_id === 'new') data.client_id = null;
    else data.client_id = parseInt(data.client_id);
    
    return await updateItem(TICKET_STORE, id, data);
}

// Удалить обращение
export async function deleteTicket(id) { return await deleteItem(TICKET_STORE, id); }

// Получить одно обращение
export async function getTicketById(id) {
    const tickets = await getAllItems(TICKET_STORE);
    return tickets.find(t => t.id === id);
}