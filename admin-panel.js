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

    try {
        const { data: { user }, error } = await client.auth.getUser();
        if (error) {
            console.log('Auth error:', error);
            showLoginForm();
            return;
        }
        if (!user) {
            showLoginForm();
            return;
        }
        showAdminPanel();
        await loadAllData();
        setupRealtime();
    } catch (err) {
        console.error('Init admin error:', err);
        showLoginForm();
    }
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
    event.stopPropagation();

    const client = getClient();
    if (!client) {
        alert('Подождите, загрузка Supabase...');
        return;
    }

    const email = document.getElementById('admin-email');
    const password = document.getElementById('admin-password');

    if (!email?.value?.trim() || !password?.value) {
        alert('Введите email и пароль');
        return;
    }

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
        });

        if (error) {
            console.error('Login error:', error);
            alert('Ошибка входа: ' + (error.message || 'Неверные данные'));
            return;
        }

        if (data?.user) {
            console.log('Admin logged in:', data.user.email);
            showAdminPanel();
            await loadAllData();
            setupRealtime();
        } else {
            alert('Не удалось войти');
        }
    } catch (err) {
        console.error('Unexpected login error:', err);
        alert('Ошибка: ' + (err.message || err));
    }
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

    try {
        const { data, error } = await client.from('tables').select('*').order('id');
        if (error) throw error;
        allTables = (data || [])
            .filter(t => t && t.id != null)
            .map(t => ({
                ...t,
                id: Number(t.id),
                seats: Number(t.seats),
                x: Number(t.x),
                y: Number(t.y),
                is_active: !!t.is_active
            }));
        populateTableSelect();
    } catch (err) {
        console.error('Load tables error:', err);
        allTables = [];
        populateTableSelect();
    }
}

async function loadBookings() {
    const client = getClient();
    if (!client) return;

    try {
        const { data, error } = await client.from('bookings').select('*').order('created_at', { ascending: false });
        if (error) throw error;

        console.log('Raw bookings data:', data);

        allBookings = (data || [])
            .filter(b => b && b.id != null)
            .map(b => ({
                ...b,
                id: Number(b.id),
                table_id: Number(b.table_id),
                guests_count: Number(b.guests_count),
                status: (b.status || 'new').toString().toLowerCase()
            }));

        console.log('Normalized bookings:', allBookings);
        renderBookingsTable();
    } catch (err) {
        console.error('Load bookings error:', err);
        allBookings = [];
        renderBookingsTable();
    }
}

function getTableNumber(tableId) {
    const tid = Number(tableId);
    const t = allTables.find(x => Number(x.id) === tid);
    return t ? t.number : '?';
}

function formatDate(dateStr) {
    return new Date(dateStr).toLocaleDateString('ru-RU');
}

function getStatusClass(status) {
    const s = (status || '').toLowerCase();
    return { 'new': 'status-new', 'confirmed': 'status-confirmed', 'completed': 'status-completed', 'cancelled': 'status-cancelled' }[s] || '';
}

function getStatusText(status) {
    const s = (status || '').toLowerCase();
    return { 'new': 'Новая', 'confirmed': 'Подтверждена', 'completed': 'Завершена', 'cancelled': 'Отменена' }[s] || (status || '');
}

function renderBookingsTable() {
    const tbody = document.getElementById('bookings-tbody');
    if (!tbody) return;

    if (allBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="9">Нет бронирований</td></tr>';
        return;
    }

    tbody.innerHTML = allBookings.map(b => {
        const safeId = b.id || '';
        const isEditing = editingBookingId === b.id;
        return `
        <tr${isEditing ? ' style="background:#fffde7"' : ''}>
            <td>${safeId}</td>
            <td>${getTableNumber(b.table_id)}</td>
            <td>${isEditing ? '<input type="text" id="edit-name" value="'+ (b.customer_name || '') +'">' : (b.customer_name || '-')}</td>
            <td>${isEditing ? '<input type="tel" id="edit-phone" value="'+ (b.customer_phone || '') +'">' : (b.customer_phone || '-')}</td>
            <td>${b.date || '-'}</td>
            <td>${b.time_slot || '-'}</td>
            <td>${b.guests_count || '-'}</td>
            <td>
                <select onchange="updateStatus(${safeId}, this.value)" ${isEditing ? 'disabled' : ''}>
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>Новая</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Подтверждена</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Завершена</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
                </select>
            </td>
            <td>
                ${isEditing ?
                    '<button onclick="saveEdit('+safeId+')">Сохранить</button><button onclick="cancelEdit()">Отмена</button>' :
                    '<button onclick="startEdit('+safeId+')">Ред.</button><button onclick="deleteBooking('+safeId+')">Удал.</button>'}
            </td>
        </tr>
    `;
    }).join('');
}

function startEdit(id) {
    if (!id) {
        console.warn('startEdit: invalid id', id);
        return;
    }
    editingBookingId = id;
    renderBookingsTable();
}

function cancelEdit() {
    editingBookingId = null;
    renderBookingsTable();
}

async function saveEdit(id) {
    if (!id) {
        editingBookingId = null;
        renderBookingsTable();
        return;
    }
    const client = getClient();
    if (!client) return;

    const name = document.getElementById('edit-name').value;
    const phone = document.getElementById('edit-phone').value;

    try {
        const { error } = await client.from('bookings').update({ customer_name: name, customer_phone: phone }).eq('id', id);
        if (error) throw error;
        editingBookingId = null;
        await loadBookings();
    } catch (err) {
        console.error('Save edit error:', err);
        alert('Ошибка сохранения: ' + (err.message || err));
    }
}

async function updateStatus(id, status) {
    if (!id) {
        console.error('Invalid booking ID:', id);
        return;
    }
    const client = getClient();
    if (!client) return;

    try {
        const { error } = await client.from('bookings').update({ status: status || 'new' }).eq('id', id);
        if (error) throw error;
        await loadBookings();
    } catch (err) {
        console.error('Status update error:', err);
        alert('Ошибка обновления статуса: ' + (err.message || err));
    }
}

async function deleteBooking(id) {
    if (!id) {
        console.error('Invalid booking ID for deletion:', id);
        return;
    }
    if (!confirm('Удалить бронь?')) return;

    const client = getClient();
    if (!client) {
        console.error('No Supabase client');
        return;
    }

    try {
        console.log('Deleting booking:', id);
        const { data, error } = await client
            .from('bookings')
            .delete()
            .eq('id', id)
            .select(); // Запрашиваем удалённую запись для проверки

        if (error) {
            console.error('Delete error details:', error);
            alert('Ошибка удаления: ' + (error.message || JSON.stringify(error)));
            return;
        }

        console.log('Delete result:', data);
        alert('Бронь удалена');
        await loadBookings();
    } catch (err) {
        console.error('Unexpected delete error:', err);
        alert('Ошибка: ' + (err.message || err));
    }
}

function populateTableSelect() {
    const select = document.getElementById('manual-table');
    if (!select) return;

    const options = allTables.map(t => {
        const id = Number(t.id) || '';
        const number = t.number || '?';
        const seats = Number(t.seats) || 0;
        const blocked = t.is_active === false ? ' - ЗАБЛОКИРОВАН' : '';
        return `<option value="${id}">Стол ${number} (${seats} мест)${blocked}</option>`;
    }).join('');

    select.innerHTML = '<option value="">Выберите</option>' + options;
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

    const tableSelect = document.getElementById('manual-table');
    const tableId = parseInt(tableSelect.value, 10);
    if (!tableId || isNaN(tableId)) {
        alert('Выберите столик');
        return;
    }

    const name = document.getElementById('manual-name').value.trim();
    const phone = document.getElementById('manual-phone').value.trim();
    const date = document.getElementById('manual-date').value;
    const time = document.getElementById('manual-time').value;
    const guests = parseInt(document.getElementById('manual-guests').value, 10);

    if (!name || !phone || !date || !time || !guests) {
        alert('Заполните все обязательные поля');
        return;
    }

    const data = {
        table_id: tableId,
        customer_name: name,
        customer_phone: phone,
        date: date,
        time_slot: time,
        guests_count: guests,
        comment: document.getElementById('manual-comment').value.trim() || null,
        status: 'confirmed'
    };

    try {
        const { error } = await client.from('bookings').insert(data);
        if (error) throw error;
        alert('Добавлено!');
        document.getElementById('manual-booking-form').reset();
        const dateInput = document.getElementById('manual-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        await loadBookings();
    } catch (err) {
        console.error('Add booking error:', err);
        alert('Ошибка добавления: ' + (err.message || err));
    }
}

function renderTablesList() {
    const container = document.getElementById('tables-list');
    if (!container) return;

    if (allTables.length === 0) {
        container.innerHTML = '<p>Загрузка...</p>';
        return;
    }

    container.innerHTML = allTables.map(t => {
        const id = Number(t.id) || '';
        const number = t.number || '?';
        const seats = Number(t.seats) || 0;
        const zone = t.zone_name || '';
        const blocked = t.is_active === false ? ' blocked' : '';
        const btnText = t.is_active === false ? 'Разблокировать' : 'Заблокировать (ремонт)';
        return `
        <div class="table-block${blocked}">
            <div><strong>Стол ${number}</strong> - ${seats} мест - ${zone}</div>
            <button onclick="toggleTable(${id}, ${t.is_active === false})">
                ${btnText}
            </button>
        </div>
        `;
    }).join('');
}

async function toggleTable(id, unblock) {
    if (!id) return;
    const client = getClient();
    if (!client) return;

    try {
        const { error } = await client.from('tables').update({ is_active: unblock }).eq('id', id);
        if (error) throw error;
        await loadTables();
    } catch (err) {
        console.error('Toggle table error:', err);
        alert('Ошибка: ' + (err.message || err));
    }
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

        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => {
                e.preventDefault();
                e.stopImmediatePropagation();
                loginAdmin(e);
            });
        }

        const logoutBtn = document.getElementById('logout-btn');
        if (logoutBtn) logoutBtn.addEventListener('click', (e) => {
            e.preventDefault();
            logoutAdmin();
        });

        const form = document.getElementById('manual-booking-form');
        if (form) form.addEventListener('submit', (e) => {
            e.preventDefault();
            e.stopImmediatePropagation();
            addManualBooking(e);
        });

        populateTimeSelect();
        populateGuestsSelect();

        const dateInput = document.getElementById('manual-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];

        initAdmin();
    });
});