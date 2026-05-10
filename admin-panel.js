// Wrap in IIFE to avoid global conflicts when script loads twice

(() => {
    let allTables = [];
    let allBookings = [];
    let editingBookingId = null;
    let selectedBookingIds = new Set();
    let filters = { search: '', date: '', status: '' };

function getClient() {
    return window.supabaseClient;
}

// Header scroll effect (identical to main site)
function initHeaderScroll() {
    const header = document.querySelector('header');
    if (!header) return;

    let ticking = false, isScrolled = false;

    function updateHeaderOnScroll() {
        const scrollY = window.scrollY;
        if (scrollY < 100) {
            if (isScrolled) {
                isScrolled = false;
                header.style.background = 'linear-gradient(to bottom, rgba(0,0,0,1) 0%, rgba(0,0,0,0) 100%)';
                header.style.boxShadow = 'none';
            }
        } else if (!isScrolled) {
            isScrolled = true;
            header.style.background = 'linear-gradient(to bottom, rgba(212, 165, 116, 0.9))';
            header.style.boxShadow = '0 4px 20px rgba(0,0,0,0.15)';
        }
        ticking = false;
    }

    window.addEventListener('scroll', () => {
        if (!ticking) {
            requestAnimationFrame(updateHeaderOnScroll);
            ticking = true;
        }
    }, { passive: true });
    updateHeaderOnScroll();
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

    // ✅ ВЫЗОВ МОБИЛЬНОГО РЕНДЕРА — добавлен здесь
    renderMobileBookingsList(filteredBookings);
    
    if (!tbody) return;

    if (filteredBookings.length === 0) {
        tbody.innerHTML = '<tr><td colspan="11" class="no-data">Нет бронирований</td></tr>';
        return;
    }
    
    tbody.innerHTML = filteredBookings.map(b => {
        const safeId = b.id || '';
        const isEditing = editingBookingId === b.id;
        const isSelected = selectedBookingIds.has(b.id);
        const hasComment = b.comment && b.comment.trim();
        return `
        <tr class="${isEditing ? 'editing-row' : ''} ${isSelected ? 'selected-row' : ''}">
            <td><input type="checkbox" class="booking-checkbox" data-id="${safeId}" ${isSelected ? 'checked' : ''}></td>
            <td>${safeId}</td>
            <td><strong>Стол ${getTableNumber(b.table_id)}</strong></td>
            <td>${isEditing ? '<input type="text" id="edit-name" value="' + (b.customer_name || '') + '" class="edit-input">' : '<span title="' + (b.customer_name || '') + '">' + (b.customer_name || '-') + '</span>'}</td>
            <td>${isEditing ? '<input type="tel" id="edit-phone" value="' + (b.customer_phone || '') + '" class="edit-input">' : (b.customer_phone || '-')}</td>
            <td>${b.date || '-'}</td>
            <td>${b.time_slot || '-'}</td>
            <td>${b.guests_count || '-'}</td>
            <td>${hasComment ? '<button onclick="showCommentModal(\'' + b.comment.replace(/'/g, '\\\'') + '\')" class="btn-action btn-comment" title="' + b.comment.replace(/"/g, '&quot;') + '">💬</button>' : '-'}</td>
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
                    '<button onclick="saveEdit(' + safeId + ')" class="btn-action btn-save" title="Сохранить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polyline points="20 6 9 17 4 12"></polyline></svg></button><button onclick="cancelEdit()" class="btn-action btn-cancel" title="Отмена"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg></button>' :
                    '<button onclick="startEdit(' + safeId + ')" class="btn-action btn-edit" title="Редактировать"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg></button><button onclick="deleteBooking(' + safeId + ')" class="btn-action btn-delete" title="Удалить"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="btn-icon"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg></button>'}
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

// ========== МОБИЛЬНЫЙ РЕНДЕР ==========
function renderMobileBookingsList(bookings) {
    const container = document.getElementById('mobile-bookings-cards');
    const countEl = document.getElementById('mobile-bookings-count');
    if (!container) return;

    if (!bookings || bookings.length === 0) {
        container.innerHTML = '<div class="mobile-no-data">Нет бронирований</div>';
        if (countEl) countEl.textContent = '0 бронирований';
        return;
    }

    if (countEl) {
        const n = bookings.length;
        const ending = getWordEnding(n);
        countEl.textContent = `${n} бронировани${ending}`;
    }

    container.innerHTML = bookings.map(b => {
        const statusClass = b.status || 'new';
        return `
        <div class="mobile-booking-card ${statusClass}">
            <div class="mobile-booking-summary">
                <div class="mobile-booking-name">${escapeHtml(b.customer_name || '—')}</div>
                <div class="mobile-booking-meta">
                    <span>${formatDate(b.date)}</span>
                    <span>${b.time_slot || '—'}</span>
                </div>
            </div>
            <button class="mobile-booking-expand-btn" onclick="openBookingDetail(${b.id})" title="Подробнее">›</button>
        </div>
        `;
    }).join('');
}

function openBookingDetail(id) {
    const booking = allBookings.find(b => b.id === id);
    if (!booking) return;

    const statusLabel = getStatusLabel(booking.status);
    const statusClass = getStatusClass(booking.status);
    const hasComment = booking.comment && booking.comment.trim();

    const detailHtml = `
        <div class="booking-detail-row">
            <span class="booking-detail-label">Стол:</span>
            <span class="booking-detail-value"><strong>Стол ${getTableNumber(booking.table_id)}</strong></span>
        </div>
        <div class="booking-detail-row">
            <span class="booking-detail-label">Имя:</span>
            <span class="booking-detail-value" id="detail-name-text">${escapeHtml(booking.customer_name || '—')}</span>
            <input type="text" id="detail-name-input" class="edit-input" value="${escapeHtml(booking.customer_name || '')}" style="display:none; flex:1;">
        </div>
        <div class="booking-detail-row">
            <span class="booking-detail-label">Телефон:</span>
            <span class="booking-detail-value" id="detail-phone-text">${escapeHtml(booking.customer_phone || '—')}</span>
            <input type="tel" id="detail-phone-input" class="edit-input" value="${escapeHtml(booking.customer_phone || '')}" style="display:none; flex:1;">
        </div>
        <div class="booking-detail-row">
            <span class="booking-detail-label">Дата:</span>
            <span class="booking-detail-value">${formatDate(booking.date)}</span>
        </div>
        <div class="booking-detail-row">
            <span class="booking-detail-label">Время:</span>
            <span class="booking-detail-value">${booking.time_slot || '—'}</span>
        </div>
        <div class="booking-detail-row">
            <span class="booking-detail-label">Гости:</span>
            <span class="booking-detail-value">${booking.guests_count || '—'}</span>
        </div>
                        <div class="booking-detail-row">
            <span class="booking-detail-label">Статус:</span>
            <span class="booking-detail-value" id="detail-status-text" style="display: flex; align-items: center;">
                <span class="booking-detail-status ${statusClass}">${statusLabel}</span>
            </span>
            <select id="detail-status-select" class="status-select" style="display:none; flex:1;">
                <option value="new" ${booking.status === 'new' ? 'selected' : ''}>Новая</option>
                <option value="confirmed" ${booking.status === 'confirmed' ? 'selected' : ''}>Подтверждена</option>
                <option value="completed" ${booking.status === 'completed' ? 'selected' : ''}>Завершена</option>
                <option value="cancelled" ${booking.status === 'cancelled' ? 'selected' : ''}>Отменена</option>
            </select>
        </div>
        ${hasComment ? `
        <div class="booking-detail-row">
            <span class="booking-detail-label">Комментарий:</span>
            <span class="booking-detail-value">${escapeHtml(booking.comment)}</span>
        </div>
        ` : ''}
        <div class="booking-detail-actions" id="detail-actions-view">
            <button onclick="startDetailEdit(${booking.id})" class="btn-action btn-edit">Редактировать</button>
            <button onclick="closeBookingDetail(); deleteBooking(${booking.id});" class="btn-action btn-delete">Удалить</button>
        </div>
        <div class="booking-detail-actions" id="detail-actions-edit" style="display:none;">
            <button onclick="saveDetailEdit(${booking.id})" class="btn-action btn-save">Сохранить</button>
            <button onclick="cancelDetailEdit(${booking.id})" class="btn-action btn-cancel">Отмена</button>
        </div>
    `;

    document.getElementById('detail-id').textContent = booking.id;
    document.getElementById('booking-detail-content').innerHTML = detailHtml;

    // Сохраняем исходные данные для отмены
    document.getElementById('booking-detail-content').dataset.originalName = booking.customer_name || '';
    document.getElementById('booking-detail-content').dataset.originalPhone = booking.customer_phone || '';
        document.getElementById('booking-detail-content').dataset.originalStatus = booking.status || 'new';

    const modal = document.getElementById('booking-detail-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
}

function closeBookingDetail() {
    const modal = document.getElementById('booking-detail-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
}
function startDetailEdit(id) {
    // Показываем поля ввода, скрываем текст
    const nameText = document.getElementById('detail-name-text');
    const nameInput = document.getElementById('detail-name-input');
    const phoneText = document.getElementById('detail-phone-text');
    const phoneInput = document.getElementById('detail-phone-input');
    const statusText = document.getElementById('detail-status-text');
    const statusSelect = document.getElementById('detail-status-select');
    const viewActions = document.getElementById('detail-actions-view');
    const editActions = document.getElementById('detail-actions-edit');

    if (nameText) nameText.style.display = 'none';
    if (nameInput) nameInput.style.display = 'block';
    if (phoneText) phoneText.style.display = 'none';
    if (phoneInput) phoneInput.style.display = 'block';
    if (statusText) statusText.style.display = 'none';
    if (statusSelect) statusSelect.style.display = 'block';
    if (viewActions) viewActions.style.display = 'none';
    if (editActions) editActions.style.display = 'flex';
}

function cancelDetailEdit(id) {
    const booking = allBookings.find(b => b.id === id);
    if (!booking) return;

    // Возвращаем исходные значения
    const nameText = document.getElementById('detail-name-text');
    const nameInput = document.getElementById('detail-name-input');
    const phoneText = document.getElementById('detail-phone-text');
    const phoneInput = document.getElementById('detail-phone-input');
    const statusText = document.getElementById('detail-status-text');
    const statusSelect = document.getElementById('detail-status-select');
    const viewActions = document.getElementById('detail-actions-view');
    const editActions = document.getElementById('detail-actions-edit');

    if (nameText) nameText.style.display = '';
    if (nameInput) nameInput.style.display = 'none';
    if (phoneText) phoneText.style.display = '';
    if (phoneInput) phoneInput.style.display = 'none';
    if (statusText) statusText.style.display = '';
    if (statusSelect) statusSelect.style.display = 'none';
    if (viewActions) viewActions.style.display = 'flex';
    if (editActions) editActions.style.display = 'none';

    // Восстанавливаем исходные значения
    const originalName = document.getElementById('booking-detail-content').dataset.originalName;
    const originalPhone = document.getElementById('booking-detail-content').dataset.originalPhone;
    const originalStatus = document.getElementById('booking-detail-content').dataset.originalStatus;
    
    if (nameInput) nameInput.value = originalName;
    if (phoneInput) phoneInput.value = originalPhone;
    if (statusSelect) statusSelect.value = originalStatus;
    if (nameText) nameText.textContent = originalName || '—';
    if (phoneText) phoneText.textContent = originalPhone || '—';
    
    // Возвращаем статус
    if (statusText && originalStatus) {
        const statusLabel = getStatusLabel(originalStatus);
        const statusClass = getStatusClass(originalStatus);
        statusText.innerHTML = `<span class="booking-detail-status ${statusClass}">${statusLabel}</span>`;
    }
}

async function saveDetailEdit(id) {
    const client = getClient();
    if (!client) return;

    const nameInput = document.getElementById('detail-name-input');
    const phoneInput = document.getElementById('detail-phone-input');
    const statusSelect = document.getElementById('detail-status-select');
    const name = nameInput ? nameInput.value.trim() : '';
    const phone = phoneInput ? phoneInput.value.trim() : '';
    const status = statusSelect ? statusSelect.value : 'new';

    try {
        const { error } = await client.from('bookings')
            .update({ customer_name: name, customer_phone: phone, status: status })
            .eq('id', id);
        if (error) throw error;

        // Обновляем текст
        const nameText = document.getElementById('detail-name-text');
        const phoneText = document.getElementById('detail-phone-text');
        const statusText = document.getElementById('detail-status-text');
        
        if (nameText) nameText.textContent = name || '—';
        if (phoneText) phoneText.textContent = phone || '—';
        
        // Обновляем статус
        if (statusText) {
            const statusLabel = getStatusLabel(status);
            const statusClass = getStatusClass(status);
            statusText.style.display = 'flex';
            statusText.style.alignItems = 'center';
            statusText.innerHTML = `<span class="booking-detail-status ${statusClass}">${statusLabel}</span>`;
        }

        // Обновляем исходные данные
        const content = document.getElementById('booking-detail-content');
        if (content) {
            content.dataset.originalName = name;
            content.dataset.originalPhone = phone;
            content.dataset.originalStatus = status;
        }

        // Переключаемся обратно в режим просмотра
        const viewActions = document.getElementById('detail-actions-view');
        const editActions = document.getElementById('detail-actions-edit');
        
        if (nameInput) nameInput.style.display = 'none';
        if (phoneInput) phoneInput.style.display = 'none';
        if (statusSelect) statusSelect.style.display = 'none';
        if (nameText) nameText.style.display = '';
        if (phoneText) phoneText.style.display = '';
        if (statusText) statusText.style.display = '';
        if (viewActions) viewActions.style.display = 'flex';
        if (editActions) editActions.style.display = 'none';

        // Обновляем данные в фоне
        await loadBookings();
        showToast('Изменения сохранены', 'success');
    } catch (err) {
        console.error('Save detail edit error:', err);
        showToast('Ошибка сохранения: ' + (err.message || err), 'error');
    }
}

function getStatusLabel(status) {
    const labels = {
        'new': 'Новая',
        'confirmed': 'Подтверждена',
        'completed': 'Завершена',
        'cancelled': 'Отменена'
    };
    return labels[status] || 'Новая';
}

function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

function formatDate(dateStr) {
    if (!dateStr) return '—';
    const parts = dateStr.split('-');
    if (parts.length === 3) return parts[2] + '.' + parts[1] + '.' + parts[0];
    return dateStr;
}

function getWordEnding(n) {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod100 >= 11 && mod100 <= 19) return 'й';
    if (mod10 === 1) return 'е';
    if (mod10 >= 2 && mod10 <= 4) return 'я';
    return 'й';
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

    const zones = {};
    allTables.forEach(t => {
        const zone = t.zone_name || 'Без зоны';
        if (!zones[zone]) zones[zone] = [];
        zones[zone].push(t);
    });

    // Объединяем зоны в пары для колонок
    const zoneEntries = Object.entries(zones);
    const columns = [[], [], [], []];
    
    // Распределяем зоны: 0-первая, 1-вторая, 2-третья, 3-четвёртая → потом 0-танцпол, 1-подвал
    zoneEntries.forEach(([zone, tables], index) => {
        const colIndex = index % 4;
        columns[colIndex].push({ zone, tables });
    });

    container.innerHTML = `
        <div class="tables-grid">
            ${columns.map(col => `
                <div class="table-column">
                    ${col.map(({ zone, tables }) => `
                        <div class="table-zone-group">
                            <h4 class="table-zone-title">${zone}</h4>
                            <div class="table-zone-tables">
                                ${tables.map(t => {
                                    const id = Number(t.id) || '';
                                    const number = t.number || '?';
                                    const seats = Number(t.seats) || 0;
                                    const blocked = t.is_active === false;
                                    const btnText = blocked ? 'Разблокировать' : 'Заблокировать';
                                    return `
                                    <div class="table-block ${blocked ? 'blocked' : ''}">
                                        <div class="table-info">
                                            <strong>Стол ${number}</strong>
                                            <span class="table-details">${seats} мест</span>
                                        </div>
                                        <button onclick="toggleTable(${id}, ${blocked})" class="btn-action ${blocked ? 'btn-unblock' : 'btn-block'}">${btnText}</button>
                                    </div>
                                    `;
                                }).join('')}
                            </div>
                        </div>
                    `).join('')}
                </div>
            `).join('')}
        </div>
    `;
}

async function toggleTable(id, unblock) {
    if (!id) return;
    const client = getClient();
    if (!client) return;

    try {
        const { error } = await client.from('tables').update({ is_active: unblock }).eq('id', id);
        if (error) throw error;
        
        // Обновляем данные и перерисовываем
        await loadTables();
        renderTablesList();
        showToast(unblock ? 'Стол разблокирован' : 'Стол заблокирован', 'success');
    } catch (err) {
        console.error('Toggle table error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    }
}

function setupRealtime() {
    const client = getClient();
    if (!client) return;

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
        .subscribe((status) => {
            // Логируем только важные статусы
            if (status === 'SUBSCRIBED') {
                console.log('Realtime connected');
            } else if (status === 'CHANNEL_ERROR') {
                console.warn('Realtime connection error, retrying...');
            } else if (status === 'CLOSED' || status === 'TIMED_OUT') {
                console.warn('Realtime disconnected');
            }
        });
}

function applyFilters() {
    const searchInput = document.getElementById('search-input');
    const dateFilter = document.getElementById('filter-date');
    const statusFilter = document.getElementById('filter-status');
    
    if (searchInput) filters.search = searchInput.value.trim();
    if (dateFilter) filters.date = dateFilter.value;
    if (statusFilter) filters.status = statusFilter.value;
    
    if (statusFilter) {
        statusFilter.classList.remove('status-new', 'status-confirmed', 'status-completed', 'status-cancelled');
        if (statusFilter.value) {
            statusFilter.classList.add('status-' + statusFilter.value);
        }
    }
    
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

    // ========== МОБИЛЬНЫЕ ФИЛЬТРЫ ==========
    const mobileFilterToggle = document.getElementById('mobile-filter-toggle');
    const mobileFiltersPanel = document.getElementById('mobile-bookings-filters');
    const mobileSearchInput = document.getElementById('mobile-search-input');
    const mobileFilterDate = document.getElementById('mobile-filter-date');
    const mobileFilterStatus = document.getElementById('mobile-filter-status');
    const mobileClearFilters = document.getElementById('mobile-clear-filters');

    if (mobileFilterToggle && mobileFiltersPanel) {
        mobileFilterToggle.addEventListener('click', () => {
            const isHidden = mobileFiltersPanel.style.display === 'none';
            mobileFiltersPanel.style.display = isHidden ? 'flex' : 'none';
        });
    }

    if (mobileSearchInput) {
        mobileSearchInput.addEventListener('input', () => {
            filters.search = mobileSearchInput.value.trim();
            if (searchInput) searchInput.value = mobileSearchInput.value;
            renderBookingsTable();
        });
    }

    if (mobileFilterDate) {
        mobileFilterDate.addEventListener('change', () => {
            filters.date = mobileFilterDate.value;
            if (dateFilter) dateFilter.value = mobileFilterDate.value;
            renderBookingsTable();
        });
    }

    if (mobileFilterStatus) {
        mobileFilterStatus.addEventListener('change', () => {
            filters.status = mobileFilterStatus.value;
            if (statusFilter) statusFilter.value = mobileFilterStatus.value;
            renderBookingsTable();
        });
    }

    if (mobileClearFilters) {
        mobileClearFilters.addEventListener('click', () => {
            clearFilters();
            if (mobileSearchInput) mobileSearchInput.value = '';
            if (mobileFilterDate) mobileFilterDate.value = '';
            if (mobileFilterStatus) mobileFilterStatus.value = '';
            renderBookingsTable();
        });
    }

    // Закрытие модалки деталей по клику вне
    const detailModal = document.getElementById('booking-detail-modal');
    if (detailModal) {
        detailModal.addEventListener('click', (e) => {
            if (e.target === detailModal) closeBookingDetail();
        });
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

        populateTimeSelect('add-time');
        populateGuestsSelect('add-guests');
        setupDateValidation('add-date');

        const addDateInput = document.getElementById('add-date');
        if (addDateInput) addDateInput.value = new Date().toISOString().split('T')[0];

        setupFilterEvents();

        setupAdminTabs();

        const addDishBtn = document.getElementById('add-dish-btn');
        if (addDishBtn) {
            addDishBtn.addEventListener('click', window.showAddDishForm);
        }

        const addDishModal = document.getElementById('add-dish-modal');
        if (addDishModal) {
            const closeBtn = addDishModal.querySelector('.close-modal');
            if (closeBtn) {
                closeBtn.addEventListener('click', window.cancelDishForm);
            }
            addDishModal.addEventListener('click', (e) => {
                if (e.target === addDishModal) {
                    window.cancelDishForm();
                }
            });
        }

        const addDishForm = document.getElementById('add-dish-form');
        if (addDishForm) {
            addDishForm.addEventListener('submit', (e) => {
                e.preventDefault();
                saveDish(e);
            });
        }

        const searchInput = document.getElementById('menu-search');
        if (searchInput) {
            searchInput.addEventListener('input', () => {
                filterMenuList();
            });
        }

        const categoryFilter = document.getElementById('category-filter');
        if (categoryFilter) {
            categoryFilter.addEventListener('change', () => {
                filterMenuList();
            });
        }

        initAdmin();
        initHeaderScroll();
    });
});

function setupAdminTabs() {
    const navLinks = document.querySelectorAll('.admin-nav-link');
    const tabContents = document.querySelectorAll('.tab-content');

    navLinks.forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const tabName = this.dataset.tab;

            navLinks.forEach(l => l.classList.remove('active'));
            this.classList.add('active');

            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === tabName) {
                    content.classList.add('active');
                }
            });

            // Синхронизация мобильного селекта
            const mobileSelect = document.getElementById('mobile-nav-select');
            if (mobileSelect) {
                mobileSelect.value = tabName;
            }

            if (tabName === 'menu-tab') {
                const categoryFilter = document.getElementById('category-filter');
                const searchInput = document.getElementById('menu-search');
                if (categoryFilter) {
                    categoryFilter.value = 'Салаты';
                }
                if (searchInput) {
                    searchInput.value = '';
                }
                window.loadMenuItems('Салаты');
            }
        });
    });
}
// Обработчик мобильной навигации
window.handleMobileNav = function(value) {
    if (value === 'logout') {
        logoutAdmin();
        // Сбросить селект на текущую вкладку
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            document.getElementById('mobile-nav-select').value = activeTab.id;
        }
        return;
    }
    // Переключить таб
    const tabLink = document.querySelector(`[data-tab="${value}"]`);
    if (tabLink) tabLink.click();
};
function showTab(tabName) {
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.click();
}

function filterMenuList() {
    const searchInput = document.getElementById('menu-search');
    const categoryFilter = document.getElementById('category-filter');
    if (!searchInput || !categoryFilter) return;

    const search = (searchInput.value || '').toLowerCase();
    const category = categoryFilter.value || '';

    const items = (window.allMenuItems || []).filter(item => {
        const itemName = (item.name || '').toLowerCase();
        const itemDesc = (item.description || '').toLowerCase();
        const matchesSearch = itemName.includes(search) || itemDesc.includes(search);
        const matchesCategory = !category || (item.category || '') === category;
        return matchesSearch && matchesCategory;
    });

    window.renderMenuList(items);
}

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

window.showCommentModal = function(comment) {
    let modal = document.getElementById('comment-modal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'comment-modal';
        modal.className = 'modal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <span class="close-modal" onclick="closeCommentModal()">&times;</span>
                <h3 style="margin-bottom: 1rem; color: var(--primary);">Комментарий</h3>
                <p id="comment-text" style="white-space: pre-wrap; line-height: 1.6; word-break: break-word;"></p>
            </div>
        `;
        document.body.appendChild(modal);
    }
    document.getElementById('comment-text').textContent = comment;
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

window.closeCommentModal = function() {
    const modal = document.getElementById('comment-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
};

window.addEventListener('click', function(event) {
    const modal = document.getElementById('comment-modal');
    if (modal && event.target === modal) {
        closeCommentModal();
    }
});
// Expose functions to window
window.startEdit = startEdit;
window.cancelEdit = cancelEdit;
window.saveEdit = saveEdit;
window.deleteBooking = deleteBooking;
window.updateStatus = updateStatus;
window.toggleTable = toggleTable;
window.showCommentModal = showCommentModal;
window.closeCommentModal = closeCommentModal;
window.openBookingDetail = openBookingDetail;
window.closeBookingDetail = closeBookingDetail;
window.startDetailEdit = startDetailEdit;   // ✅ Теперь внутри IIFE
window.cancelDetailEdit = cancelDetailEdit; // ✅
window.saveDetailEdit = saveDetailEdit;     // ✅
window.prevZone = prevZone;
window.nextZone = nextZone;
window.populateTimeSelect = populateTimeSelect;
window.populateGuestsSelect = populateGuestsSelect;
window.setupDateValidation = setupDateValidation;
window.timeToMinutes = timeToMinutes;
window.checkTableAvailability = checkTableAvailability;
window.filterMenuList = filterMenuList;
window.showTab = showTab;


})(); // End IIFE

