import { getAllItems } from './db.js';
import { getSetting } from './settings-manager.js';

export async function checkDeadlinesAndNotify() {
    try {
        // Проверяем, включены ли уведомления
        const notificationsEnabled = await getSetting('notifications.deadlineAlerts', true);
        
        if (!notificationsEnabled) {
            console.log('🔕 Deadline notifications disabled');
            return;
        }
        
        const tasks = await getAllItems('tasks');
        console.log('📋 Total tasks:', tasks.length);
        
        // Фильтруем активные задачи с дедлайнами
        const tasksWithDeadlines = tasks.filter(t => 
            t.deadline && 
            !t.is_archived && 
            t.status !== 'done'
        );
        
        console.log('📅 Tasks with deadlines:', tasksWithDeadlines.length);
        
        // Получаем сегодняшнюю дату БЕЗ времени
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        
        console.log('📆 Today:', today.toISOString().split('T')[0]);
        console.log('📆 Tomorrow:', tomorrow.toISOString().split('T')[0]);
        
        // Задачи на сегодня
        const todayTasks = tasksWithDeadlines.filter(t => {
            const deadline = new Date(t.deadline);
            deadline.setHours(0, 0, 0, 0); // Обнуляем время
            const isToday = deadline.getTime() === today.getTime();
            
            if (isToday) {
                console.log(`  ✅ TODAY: "${t.title}" - ${t.deadline}`);
            }
            return isToday;
        });
        
        // Задачи на завтра
        const tomorrowTasks = tasksWithDeadlines.filter(t => {
            const deadline = new Date(t.deadline);
            deadline.setHours(0, 0, 0, 0); // Обнуляем время
            const isTomorrow = deadline.getTime() === tomorrow.getTime();
            
            if (isTomorrow) {
                console.log(`  📅 TOMORROW: "${t.title}" - ${t.deadline}`);
            }
            return isTomorrow;
        });
        
        // Просроченные задачи (строго меньше сегодня)
        const overdueTasks = tasksWithDeadlines.filter(t => {
            const deadline = new Date(t.deadline);
            deadline.setHours(0, 0, 0, 0);
            const isOverdue = deadline < today;
            
            if (isOverdue) {
                console.log(`  ⚠️ OVERDUE: "${t.title}" - ${t.deadline}`);
            }
            return isOverdue;
        });
        
        console.log('📊 Summary:');
        console.log('  Overdue:', overdueTasks.length);
        console.log('  Today:', todayTasks.length);
        console.log('  Tomorrow:', tomorrowTasks.length);
        
        // Формируем сообщение
        let message = '';
        let type = 'info';
        
        if (overdueTasks.length > 0) {
            message = `Срок истёк: ${overdueTasks.length} | `;
            type = 'error';
        }
        
        if (todayTasks.length > 0) {
            message += `Сегодня: ${todayTasks.length} | `;
            if (type === 'info') type = 'warning';
        }
        
        if (tomorrowTasks.length > 0) {
            message += `Завтра: ${tomorrowTasks.length}`;
            if (type === 'info') type = 'info';
        }
        
        // Убираем последний разделитель
        message = message.replace(/ \| $/, '');
        
        // Показываем уведомление если есть что показать
        if (message) {
            console.log('🔔 Showing notification:', message);
            showDeadlineToast(message, type);
        } else {
            console.log('✅ No deadline notifications needed');
        }
        
    } catch (error) {
        console.error('❌ Error checking deadlines:', error);
    }
}

function showDeadlineToast(message, type = 'info') {
    const toast = document.createElement('div');
    
    const colors = {
        info: '#3b82f6',
        warning: '#f59e0b',
        error: '#e56c10'
    };
    
    toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${colors[type]};
        color: white;
        padding: 16px 24px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        z-index: 100000;
        animation: slideInRight 0.4s ease;
        max-width: 400px;
        font-size: 14px;
        line-height: 1.5;
    `;
    
    toast.innerHTML = `
        <div style="display: flex; align-items: start; gap: 12px;">
            <div style="flex: 1;">
                <div style="font-weight: 600; margin-bottom: 4px;">Сроки по задачам:</div>
                <div>${message}</div>
            </div>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="background: none; border: none; color: white; cursor: pointer; font-size: 18px; opacity: 0.8;">
                &times;
            </button>
        </div>
    `;
    
    document.body.appendChild(toast);
    
    // Автоудаление через 8 секунд
    setTimeout(() => {
        toast.style.animation = 'slideOutRight 0.4s ease';
        setTimeout(() => toast.remove(), 400);
    }, 8000);
}

// Добавляем CSS анимации
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOutRight {
        from { transform: translateX(0); opacity: 1; }
        to { transform: translateX(100%); opacity: 0; }
    }
`;
document.head.appendChild(style);