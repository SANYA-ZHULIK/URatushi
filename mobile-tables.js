let mobileTablesData = [];
let mobileBookingsData = [];
let selectedMobileTableId = null;
let currentFilter = 'all';

function getClient() {
    return window.supabaseClient;
}

async function loadMobileTables() {
    const client = getClient();
    if (!client) {
        setTimeout(loadMobileTables, 500);
        return;
    }
    
    const { data, error } = await client
        .from('tables')
        .select('*')
        .eq('is_active', true)
        .order('id');

    if (error) {
        console.error('Error loading tables:', error);
        return;
    }

    mobileTablesData = data || [];
    renderMobileTableList();
}

async function loadMobileBookings() {
    const client = getClient();
    if (!client) return;
    
    const { data, error } = await client
        .from('bookings')
        .select('*')
        .in('status', ['new', 'confirmed']);

    if (error) {
        console.error('Error loading bookings:', error);
        return;
    }

    mobileBookingsData = data || [];
    renderMobileTableList();
}

function isMobileTableBooked(tableId, date, timeSlot) {
    return mobileBookingsData.some(booking => 
        booking.table_id === tableId && 
        booking.date === date && 
        booking.time_slot === timeSlot &&
        (booking.status === 'new' || booking.status === 'confirmed')
    );
}

function filterTables(tables) {
    if (currentFilter === 'all') return tables;
    if (currentFilter === '2') return tables.filter(t => t.seats === 2);
    if (currentFilter === '4') return tables.filter(t => t.seats === 4);
    if (currentFilter === '6+') return tables.filter(t => t.seats >= 6);
    return tables;
}

function getZoneIcon(zoneName) {
    const icons = {
        'у окна': '🪟',
        'у стены': '🧱',
        'VIP': '👑',
        'бар': '🍺',
        'центр': '🍽️'
    };
    return icons[zoneName] || '🍽️';
}

function renderMobileTableList() {
    const container = document.getElementById('mobile-tables-container');
    if (!container) return;

    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;

    const filteredTables = filterTables(mobileTablesData);
    
    if (filteredTables.length === 0) {
        container.innerHTML = '<p class="no-tables">Нет столиков</p>';
        return;
    }

    container.innerHTML = filteredTables.map(table => {
        const isBooked = selectedDate && selectedTime && isMobileTableBooked(table.id, selectedDate, selectedTime);
        const isSelected = selectedMobileTableId === table.id;
        const zoneIcon = getZoneIcon(table.zone_name);
        
        return `
            <div class="mobile-table-card ${isBooked ? 'booked' : 'available'} ${isSelected ? 'selected' : ''}">
                <div class="table-info">
                    <div class="table-header">
                        <span class="table-number">Стол ${table.number}</span>
                        <span class="table-zone">${zoneIcon} ${table.zone_name}</span>
                    </div>
                    <div class="table-details">
                        <span class="table-seats">${table.seats} мест</span>
                        <span class="table-status">${isBooked ? 'Занято' : 'Свободен'}</span>
                    </div>
                </div>
                <button class="book-btn" ${isBooked ? 'disabled' : ''} 
                        onclick="selectMobileTable('${table.number}')">
                    ${isBooked ? 'Занят' : 'Выбрать'}
                </button>
            </div>
        `;
    }).join('');
}

function selectMobileTable(tableNumber) {
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    
    if (!dateInput.value || !timeSelect.value) {
        alert('Выберите дату и время');
        return;
    }

    const tableNumberInput = document.getElementById('table-number');
    if (tableNumberInput) {
        tableNumberInput.value = tableNumber;
    }

    renderMobileTableList();
    document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
}

function setupMobileFilters() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    
    filterButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            filterButtons.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentFilter = btn.dataset.filter;
            renderMobileTableList();
        });
    });
}

function setupMobileRealtime() {
    const client = getClient();
    if (!client) return;
    
    client
        .channel('mobile-bookings')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'bookings'
        }, () => {
            loadMobileBookings();
        })
        .subscribe();
}

function initMobileTables() {
    loadMobileTables();
    loadMobileBookings();
    setupMobileFilters();
    setupMobileRealtime();
    
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    
    if (dateInput) {
        dateInput.addEventListener('change', () => renderMobileTableList());
    }
    if (timeSelect) {
        timeSelect.addEventListener('change', () => renderMobileTableList());
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('mobile-tables-container')) {
        initSupabase(function() {
            console.log('Mobile client ready');
            initMobileTables();
        });
    }
});