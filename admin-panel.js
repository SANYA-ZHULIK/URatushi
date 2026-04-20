let allTables = [];
let allBookings = [];
let editingBookingId = null;

function getClient() {
    return window.supabaseClient;
}

async function initAdmin() {
    const client = getClient();
    if (!client) {
        console.log('Waiting for Supabase...');
        return;
    }
    
    const { data: { user } } = await client.auth.getUser();
    if (!user) {
        showLoginForm();
        return;
    }
    showAdminPanel();
    await loadAllData();
    setupRealtime();
}

function showLoginForm() {
    document.getElementById('login-container').style.display = 'block';
    document.getElementById('admin-panel').style.display = 'none';
}

function showAdminPanel() {
    document.getElementById('login-container').style.display = 'none';
    document.getElementById('admin-panel').style.display = 'block';
}

async function loginAdmin(event) {
    event.preventDefault();
    const client = getClient();
    if (!client) {
        alert('Подождите, идёт загрузка...');
        return;
    }
    
    const email = document.getElementById('admin-email').value;
    const password = document.getElementById('admin-password').value;
    
    const { data, error } = await client.auth.signInWithPassword({ email, password });
    if (error) {
        alert('Ошибка входа: ' + error.message);
        return;
    }
    showAdminPanel();
    await loadAllData();
    setupRealtime();
}

async function logoutAdmin() {
    const client = getClient();
    if (client) await client.auth.signOut();
    showLoginForm();
}

async function loadAllData() {
    await Promise.all([loadTables(), loadBookings()]);
    renderTablesList();
    renderBookingsTable();
}

async function loadTables() {
    const client = getClient();
    if (!client) return;
    
    const { data, error } = await client.from('tables').select('*').order('id');
    if (error) console.error('Error:', error);
    allTables = data || [];
    populateTableSelect();
}

async function loadBookings() {
    const client = getClient();
    if (!client) return;
    
    const { data, error } = await client.from('bookings').select('*').order('created_at', { ascending: false });
    if (error) console.error('Error:', error);
    allBookings = data || [];
    renderBookingsTable();
}

function getTableNumber(tableId) {
    const t = allTables.find(x => x.id === tableId);
    return t ? t.number : '?';
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU');
}

function getStatusClass(status) {
    return { 'new': 'status-new', 'confirmed': 'status-confirmed', 'completed': 'status-completed', 'cancelled': 'status-cancelled' }[status] || '';
}

function getStatusText(status) {
    return { 'new': 'Новая', 'confirmed': 'Подтверждена', 'completed': 'Завершена', 'cancelled': 'Отменена' }[status] || status;
}

function renderBookingsTable() {
    const tbody = document.getElementById('bookings-tbody');
    if (!tbody) return;
    
    if (allBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Нет бронирований</td></tr>';
        return;
    }
    
    tbody.innerHTML = allBookings.map(b => `
        <tr${editingBookingId === b.id ? ' style="background:#fffde7"' : ''}>
            <td>${b.id}</td>
            <td>${getTableNumber(b.table_id)}</td>
            <td>${editingBookingId === b.id ? '<input type="text" id="edit-name" value="'+b.customer_name+'">' : b.customer_name}</td>
            <td>${editingBookingId === b.id ? '<input type="tel" id="edit-phone" value="'+b.customer_phone+'">' : b.customer_phone}</td>
            <td>${b.date}</td>
            <td>${b.time_slot}</td>
            <td>${b.guests_count}</td>
            <td>
                <select onchange="updateStatus(${b.id}, this.value)" ${editingBookingId === b.id ? 'disabled' : ''}>
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>Новая</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Подтверждена</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Завершена</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
                </select>
            </td>
            <td>
                ${editingBookingId === b.id ? 
                    '<button onclick="saveEdit('+b.id+')">Сохранить</button><button onclick="cancelEdit()">Отмена</button>' :
                    '<button onclick="startEdit('+b.id+')">Ред.</button><button onclick="deleteBooking('+b.id+')">Удал.</button>'}
            </td>
        </tr>
    `).join('');
}

function startEdit(id) {
    editingBookingId = id;
    renderBookingsTable();
}

function cancelEdit() {
    editingBookingId = null;
    renderBookingsTable();
}

async function saveEdit(id) {
    const client = getClient();
    if (!client) return;
    
    const name = document.getElementById('edit-name').value;
    const phone = document.getElementById('edit-phone').value;
    
    const { error } = await client.from('bookings').update({ customer_name: name, customer_phone: phone }).eq('id', id);
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    editingBookingId = null;
    await loadBookings();
}

async function updateStatus(id, status) {
    const client = getClient();
    if (!client) return;
    
    const { error } = await client.from('bookings').update({ status }).eq('id', id);
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    await loadBookings();
}

async function deleteBooking(id) {
    if (!confirm('Удалить бронь?')) return;
    
    const client = getClient();
    if (!client) return;
    
    const { error } = await client.from('bookings').delete().eq('id', id);
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    await loadBookings();
}

function populateTableSelect() {
    const select = document.getElementById('manual-table');
    if (!select) return;
    
    select.innerHTML = '<option value="">Выберите</option>' + 
        allTables.map(t => `<option value="${t.id}">Стол ${t.number} (${t.seats} мест)${t.is_active === false ? ' - ЗАБЛОКИРОВАН' : ''}</option>`).join('');
}

function populateTimeSelect() {
    const select = document.getElementById('manual-time');
    if (!select) return;
    
    let times = '';
    for (let h = 18; h <= 23; h++) {
        times += `<option value="${h}:00">${h}:00</option>`;
        times += `<option value="${h}:30">${h}:30</option>`;
    }
    select.innerHTML = '<option value="">Выберите</option>' + times;
}

function populateGuestsSelect() {
    const select = document.getElementById('manual-guests');
    if (!select) return;
    
    let opts = '<option value="">Выберите</option>';
    for (let i = 1; i <= 12; i++) {
        let label = i === 1 ? 'гость' : (i <= 4 ? 'гостя' : 'гостей');
        opts += `<option value="${i}">${i} ${label}</option>`;
    }
    select.innerHTML = opts;
}

async function addManualBooking(event) {
    event.preventDefault();
    
    const client = getClient();
    if (!client) return;
    
    const data = {
        table_id: parseInt(document.getElementById('manual-table').value),
        customer_name: document.getElementById('manual-name').value,
        customer_phone: document.getElementById('manual-phone').value,
        date: document.getElementById('manual-date').value,
        time_slot: document.getElementById('manual-time').value,
        guests_count: parseInt(document.getElementById('manual-guests').value),
        comment: document.getElementById('manual-comment').value || null,
        status: 'confirmed'
    };
    
    const { error } = await client.from('bookings').insert(data);
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    
    alert('Добавлено!');
    document.getElementById('manual-booking-form').reset();
    await loadBookings();
}

function renderTablesList() {
    const container = document.getElementById('tables-list');
    if (!container) return;
    
    if (allTables.length === 0) {
        container.innerHTML = '<p>Загрузка...</p>';
        return;
    }
    
    container.innerHTML = allTables.map(t => `
        <div class="table-block ${t.is_active === false ? 'blocked' : ''}">
            <div><strong>Стол ${t.number}</strong> - ${t.seats} мест - ${t.zone_name}</div>
            <button onclick="toggleTable(${t.id}, ${t.is_active === false})">
                ${t.is_active === false ? 'Разблокировать' : 'Заблокировать (ремонт)'}
            </button>
        </div>
    `).join('');
}

async function toggleTable(id, unblock) {
    const client = getClient();
    if (!client) return;
    
    const { error } = await client.from('tables').update({ is_active: unblock }).eq('id', id);
    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }
    await loadTables();
}

function setupRealtime() {
    const client = getClient();
    if (!client) return;
    
    client.channel('admin-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => loadBookings())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => loadTables())
        .subscribe();
}

document.addEventListener('DOMContentLoaded', () => {
    initSupabase(function() {
        console.log('Admin panel ready');
        
        document.getElementById('login-form').addEventListener('submit', loginAdmin);
        
        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', logoutAdmin);
        
        const form = document.getElementById('manual-booking-form');
        if (form) form.addEventListener('submit', addManualBooking);
        
        populateTimeSelect();
        populateGuestsSelect();
        
        const dateInput = document.getElementById('manual-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        
        initAdmin();
    });
});