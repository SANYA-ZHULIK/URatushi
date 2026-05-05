let allTables = [];
let allBookings = [];
let editingBookingId = null;
let selectedBookingIds = new Set();
let filters = { search: '', date: '', status: '' };

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
        showToast('Подождите, загрузка Supabase...', 'warning');
        return;
    }

    const email = document.getElementById('admin-email');
    const password = document.getElementById('admin-password');

    if (!email?.value?.trim() || !password?.value) {
        showToast('Введите email и пароль', 'warning');
        return;
    }

    try {
        const { data, error } = await client.auth.signInWithPassword({
            email: email.value.trim(),
            password: password.value
        });

        if (error) {
            console.error('Login error:', error);
            showToast('Ошибка входа: ' + (error.message || 'Неверные данные'), 'error');
            return;
        }

        if (data?.user) {
            console.log('Admin logged in:', data.user.email);
            showAdminPanel();
            await loadAllData();
            setupRealtime();
        } else {
            showToast('Не удалось войти', 'error');
        }
    } catch (err) {
        console.error('Unexpected login error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    }
}

async function logoutAdmin() {
    const client = getClient();
    if (client) await client.auth.signOut();
    showLoginForm();
    showToast('Вы вышли из системы', 'info');
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
        allTables = (data || []).filter(t => t && t.id != null).map(t => ({
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

        allBookings = (data || []).filter(b => b && b.id != null).map(b => {
            let st = b.status;
            if (typeof st === 'string') st = st.toLowerCase();
            else st = 'new';
            return {
                ...b,
                id: Number(b.id),
                table_id: Number(b.table_id),
                guests_count: Number(b.guests_count),
                status: st
            };
        });

        renderBookingsTable();
    } catch (err) {
        console.error('Load bookings error:', err);
        allBookings = [];
        renderBookingsTable();
    }
}

function getTableNumber(tableId) {
    const t = allTables.find(x => Number(x.id) === Number(tableId));
    return t ? t.number : '?';
}

function getStatusClass(status) {
    const s = String(status || 'new').toLowerCase();
    return { 'new': 'status-new', 'confirmed': 'status-confirmed', 'completed': 'status-completed', 'cancelled': 'status-cancelled' }[s] || '';
}

function renderBookingsTable() {
    const tbody = document.getElementById('bookings-tbody');
    if (!tbody) return;
    
    // Apply filters
    let filteredBookings = allBookings.filter(b => {
        if (filters.search) {
            const search = filters.search.toLowerCase();
            if (!(b.customer_name?.toLowerCase().includes(search) || 
                  b.customer_phone?.toLowerCase().includes(search))) {
                return false;
            }
        }
        if (filters.date && b.date !== filters.date) return false;
        if (filters.status && b.status !== filters.status) return false;
        return true;
    });
    
    if (filteredBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="no-data">Нет бронирований</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredBookings.map(b => {
        const safeId = b.id || '';
        const isEditing = editingBookingId === b.id;
        const isSelected = selectedBookingIds.has(b.id);
        const comment = b.comment ? b.comment.substring(0, 50) + (b.comment.length > 50 ? '...' : '') : '-';
        return `
        <tr class="${isEditing ? 'editing-row' : ''} ${isSelected ? 'selected-row' : ''}">
            <td><input type="checkbox" class="booking-checkbox" data-id="${safeId}" ${isSelected ? 'checked' : ''}></td>
            <td>${safeId}</td>
            <td><strong>Стол ${getTableNumber(b.table_id)}</strong></td>
            <td>${isEditing ? '<input type="text" id="edit-name" value="' + (b.customer_name || '') + '" class="edit-input">' : (b.customer_name || '-')}</td>
            <td>${isEditing ? '<input type="tel" id="edit-phone" value="' + (b.customer_phone || '') + '" class="edit-input">' : (b.customer_phone || '-')}</td>
            <td>${b.date || '-'}</td>
            <td>${b.time_slot || '-'}</td>
            <td>${b.guests_count || '-'}</td>
            <td title="${b.comment || ''}">${comment}</td>
            <td>
                <select onchange="updateStatus(${safeId}, this.value)" class="status-select ${getStatusClass(b.status)}" ${isEditing ? 'disabled' : ''}>
                    <option value="new" ${b.status === 'new' ? 'selected' : ''}>Новая</option>
                    <option value="confirmed" ${b.status === 'confirmed' ? 'selected' : ''}>Подтверждена</option>
                    <option value="completed" ${b.status === 'completed' ? 'selected' : ''}>Завершена</option>
                    <option value="cancelled" ${b.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
                </select>
            </td>
            <td>
                ${isEditing ?
                    '<button onclick="saveEdit(' + safeId + ')" class="btn-action btn-save">Сохранить</button><button onclick="cancelEdit()" class="btn-action btn-cancel">Отмена</button>' :
                    '<button onclick="startEdit(' + safeId + ')" class="btn-action btn-edit">Ред.</button><button onclick="deleteBooking(' + safeId + ')" class="btn-action btn-delete">Удал.</button>'}
            </td>
        </tr>
    `;
    }).join('');
    
    // Add checkbox event listeners
    document.querySelectorAll('.booking-checkbox').forEach(cb => {
        cb.addEventListener('change', (e) => {
            const id = parseInt(e.target.dataset.id);
            const row = e.target.closest('tr');
            
            if (e.target.checked) {
                selectedBookingIds.add(id);
                row.classList.add('selected-row');
            } else {
                selectedBookingIds.delete(id);
                row.classList.remove('selected-row');
            }
        });
    });
}

function startEdit(id) {
    if (!id) return;
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
        showToast('Изменения сохранены', 'success');
    } catch (err) {
        console.error('Save edit error:', err);
        showToast('Ошибка сохранения: ' + (err.message || err), 'error');
    }
}

async function updateStatus(id, status) {
    if (!id) return;
    const client = getClient();
    if (!client) return;

    try {
        const { error } = await client.from('bookings').update({ status: status || 'new' }).eq('id', id);
        if (error) throw error;
        await loadBookings();
        showToast('Статус обновлен', 'success');
    } catch (err) {
        console.error('Status update error:', err);
        showToast('Ошибка обновления статуса: ' + (err.message || err), 'error');
    }
}

async function deleteBooking(id) {
    if (!id) return;
    if (!confirm('Удалить бронь?')) return;

    const client = getClient();
    if (!client) return;

    try {
        const { error } = await client.from('bookings').delete().eq('id', id);
        if (error) throw error;
        showToast('Бронь удалена', 'success');
        await loadBookings();
    } catch (err) {
        console.error('Delete error:', err);
        showToast('Ошибка удаления: ' + (err.message || err), 'error');
    }
}

function populateTableSelect() {
    const select = document.getElementById('add-table');
    if (!select) return;

    const options = allTables.map(t => {
        const id = Number(t.id) || '';
        const number = t.number || '?';
        const seats = Number(t.seats) || 0;
        const blocked = t.is_active === false ? ' - ЗАБЛОКИРОВАН' : '';
        return `<option value="${id}">Стол ${number} (${seats} мест)${blocked}</option>`;
    }).join('');

    select.innerHTML = '<option value="">Выберите столик</option>' + options;
}

function renderTablesList() {
    const container = document.getElementById('tables-list');
    if (!container) return;

    if (allTables.length === 0) {
        container.innerHTML = '<p class="no-data">Загрузка...</p>';
        return;
    }

    container.innerHTML = allTables.map(t => {
        const id = Number(t.id) || '';
        const number = t.number || '?';
        const seats = Number(t.seats) || 0;
        const zone = t.zone_name || '';
        const blocked = t.is_active === false ? ' blocked' : '';
        const btnText = t.is_active === false ? 'Разблокировать' : 'Заблокировать';
        return `
        <div class="table-block${blocked}">
            <div class="table-info">
                <strong>Стол ${number}</strong>
                <span class="table-details">${seats} мест • ${zone}</span>
            </div>
            <button onclick="toggleTable(${id}, ${t.is_active === false})" class="btn-action ${t.is_active === false ? 'btn-unblock' : 'btn-block'}">
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
        showToast(unblock ? 'Стол разблокирован' : 'Стол заблокирован', 'success');
    } catch (err) {
        console.error('Toggle table error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    }
}

function setupRealtime() {
    const client = getClient();
    if (!client) return;

    // Отписываемся от предыдущего канала, если был
    try {
        client.channel('admin-changes')?.unsubscribe();
    } catch (e) {
        console.log('No previous subscription');
    }

    client.channel('admin-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'bookings' }, () => {
            console.log('Realtime: bookings changed');
            loadBookings();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tables' }, () => {
            console.log('Realtime: tables changed');
            loadTables();
        })
        .subscribe(status => {
            console.log('Realtime subscribed, status:', status);
        });
}

// Filter functions
function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const dateFilter = document.getElementById('filter-date');
    const statusFilter = document.getElementById('filter-status');
    
    if (searchInput) filters.search = searchInput.value.trim();
    if (dateFilter) filters.date = dateFilter.value;
    if (statusFilter) filters.status = statusFilter.value;
    
    renderBookingsTable();
}

function clearFilters() {
    filters = { search: '', date: '', status: '' };
    const searchInput = document.getElementById('search-input');
    const dateFilter = document.getElementById('filter-date');
    const statusFilter = document.getElementById('filter-status');
    
    if (searchInput) searchInput.value = '';
    if (dateFilter) dateFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    
    renderBookingsTable();
}

// Bulk actions
async function bulkUpdateStatus(status) {
    if (selectedBookingIds.size === 0) {
        showToast('Выберите бронирования', 'warning');
        return;
    }
    
    const client = getClient();
    if (!client) return;
    
    const ids = Array.from(selectedBookingIds);
    
    try {
        const { error } = await client.from('bookings').update({ status }).in('id', ids);
        if (error) throw error;
        
        selectedBookingIds.clear();
        await loadBookings();
        showToast(`${ids.length} бронирований обновлено`, 'success');
    } catch (err) {
        console.error('Bulk update error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    }
}

function setupFilterEvents() {
    const searchInput = document.getElementById('search-input');
    const dateFilter = document.getElementById('filter-date');
    const statusFilter = document.getElementById('filter-status');
    const clearFiltersBtn = document.getElementById('clear-filters');
    const selectAllBtn = document.getElementById('select-all-btn');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const bulkConfirmBtn = document.getElementById('bulk-confirm-btn');
    const bulkCancelBtn = document.getElementById('bulk-cancel-btn');
    
    if (searchInput) {
        searchInput.addEventListener('input', () => setTimeout(applyFilters, 300));
    }
    if (dateFilter) {
        dateFilter.addEventListener('change', applyFilters);
    }
    if (statusFilter) {
        statusFilter.addEventListener('change', applyFilters);
    }
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearFilters);
    }
    if (selectAllBtn) {
        selectAllBtn.addEventListener('click', () => {
            const checkboxes = document.querySelectorAll('.booking-checkbox');
            const allSelected = Array.from(checkboxes).every(cb => cb.checked);
            checkboxes.forEach(cb => {
                cb.checked = !allSelected;
                const row = cb.closest('tr');
                if (!allSelected) {
                    selectedBookingIds.add(parseInt(cb.dataset.id));
                    row.classList.add('selected-row');
                } else {
                    selectedBookingIds.delete(parseInt(cb.dataset.id));
                    row.classList.remove('selected-row');
                }
            });
        });
    }
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.booking-checkbox');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const id = parseInt(cb.dataset.id);
                const row = cb.closest('tr');
                if (e.target.checked) {
                    selectedBookingIds.add(id);
                    row.classList.add('selected-row');
                } else {
                    selectedBookingIds.delete(id);
                    row.classList.remove('selected-row');
                }
            });
        });
    }
    if (bulkConfirmBtn) {
        bulkConfirmBtn.addEventListener('click', () => bulkUpdateStatus('confirmed'));
    }
    if (bulkCancelBtn) {
        bulkCancelBtn.addEventListener('click', () => bulkUpdateStatus('cancelled'));
    }
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

        // Modal booking form
        const addBookingForm = document.getElementById('add-booking-form');
        if (addBookingForm) {
            addBookingForm.addEventListener('submit', (e) => {
                e.preventDefault();
                addBookingViaModal(e);
            });
        }

        const addBookingBtn = document.getElementById('add-booking-btn');
        if (addBookingBtn) {
            addBookingBtn.addEventListener('click', openAddBookingModal);
        }

        // Close modal handlers
        const closeModal = document.querySelector('#add-booking-modal .close-modal');
        if (closeModal) {
            closeModal.addEventListener('click', closeAddBookingModal);
        }

        const addBookingModal = document.getElementById('add-booking-modal');
        if (addBookingModal) {
            addBookingModal.addEventListener('click', (e) => {
                if (e.target === addBookingModal) {
                    closeAddBookingModal();
                }
            });
        }

        // Используем общие утилиты из utils.js
        populateTimeSelect('add-time');
        populateGuestsSelect('add-guests');
        setupDateValidation('add-date');

        const addDateInput = document.getElementById('add-date');
        if (addDateInput) addDateInput.value = new Date().toISOString().split('T')[0];
        
        setupFilterEvents();
        
        initAdmin();
    });
});

// Modal functions
window.openAddBookingModal = function() {
    populateTableSelect();
    const modal = document.getElementById('add-booking-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.closeAddBookingModal = function() {
    const modal = document.getElementById('add-booking-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

async function addBookingViaModal(event) {
    const client = getClient();
    if (!client) return;

    const tableSelect = document.getElementById('add-table');
    const tableId = parseInt(tableSelect.value, 10);
    if (!tableId || isNaN(tableId)) {
        showToast('Выберите столик', 'warning');
        return;
    }

    const name = document.getElementById('add-name').value.trim();
    const phone = document.getElementById('add-phone').value.trim();
    const date = document.getElementById('add-date').value;
    const time = document.getElementById('add-time').value;
    const guests = parseInt(document.getElementById('add-guests').value, 10);

    if (!name || !phone || !date || !time || !guests) {
        showToast('Заполните все обязательные поля', 'warning');
        return;
    }

    // Валидация даты
    const today = new Date().toISOString().split('T')[0];
    if (date < today) {
        showToast('Нельзя бронировать на прошедшую дату', 'warning');
        return;
    }

    const data = {
        table_id: tableId,
        customer_name: name,
        customer_phone: phone,
        date: date,
        time_slot: time,
        guests_count: guests,
        comment: document.getElementById('add-comment').value.trim() || null,
        status: 'confirmed'
    };

    const btn = document.querySelector('#add-booking-form button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Добавление...';

    try {
        const { error } = await client.from('bookings').insert(data);
        if (error) throw error;
        showToast('Бронь успешно добавлена!', 'success');
        document.getElementById('add-booking-form').reset();
        const dateInput = document.getElementById('add-date');
        if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
        await loadBookings();
        closeAddBookingModal();
    } catch (err) {
        console.error('Add booking error:', err);
        showToast('Ошибка добавления: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Добавить бронь';
    }
}
