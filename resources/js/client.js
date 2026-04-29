// resources/js/client.js (аналог views.py для клиентов)
import { getClientById, createClient, initDatabase } from './db.js';

export async function handleClientFormSubmit(formData) {
    try {
        const clientId = createClient(
            formData.name,
            formData.phone,
            formData.email
        );
        
        // Обновление UI
        document.getElementById('message').textContent = 
            `Клиент создан с ID: ${clientId}`;
        
        return clientId;
    } catch (error) {
        console.error('Ошибка создания клиента:', error);
        Neutralino.os.showMessageBox('Ошибка', 
            'Не удалось создать клиента: ' + error.message);
        return null;
    }
}

export async function loadClientList() {
    const result = db.exec("SELECT * FROM client WHERE is_archived = 0");
    // Преобразование в массив объектов и рендеринг
    return result[0]?.values.map(row => ({
        id: row[0],
        name: row[1],
        phone: row[2],
        email: row[3]
    })) || [];
}