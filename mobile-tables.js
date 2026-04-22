let mobileTablesData = [];
let mobileBookingsData = [];
let selectedMobileTableId = null;
let currentSeatsFilter = 'all';
let mobileZones = [];
let currentZoneFilter = 'all';

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
    mobileZones = [...new Set(mobileTablesData.map(t => t.zone_name))];
    renderMobileZoneButtons();
    renderMobileTableList();
}

function renderMobileZoneButtons() {
    const container = document.querySelector('.filter-buttons');
    if (!container) return;
    
    const allZones = ['all', ...mobileZones];
    const seatsFilters = ['all', '2', '4', '6+'];
    
    container.innerHTML = '<div class="filter-group"><span>Зона:</span>' + 
        allZones.map(z => {
            const label = z === 'all' ? 'Все' : z;
            return `<button class="filter-btn ${currentZoneFilter === z ? 'active' : ''}" data-zone="${z}">${label}</button>`;
        }).join('') + 
        '</div><div class="filter-group"><span>Места:</span>' +
        seatsFilters.map(s => {
            const label = s === 'all' ? 'Все' : (s === '6+' ? '6+' : s);
            return `<button class="filter-btn seats-filter ${currentSeatsFilter === s ? 'active' : ''}" data-seats="${s}">${label}</button>`;
        }).join('') + '</div>';
    
    container.querySelectorAll('.filter-btn[data-zone]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentZoneFilter = btn.dataset.zone;
            renderMobileTableList();
        });
    });
    
    container.querySelectorAll('.filter-btn[data-seats]').forEach(btn => {
        btn.addEventListener('click', () => {
            container.querySelectorAll('.seats-filter').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            currentSeatsFilter = btn.dataset.seats;
            renderMobileTableList();
        });
    });
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
    let filtered = tables;
    
    if (currentZoneFilter !== 'all') {
        filtered = filtered.filter(t => t.zone_name === currentZoneFilter);
    }
    
    if (currentSeatsFilter === 'all') return filtered;
    if (currentSeatsFilter === '2') return filtered.filter(t => t.seats === 2);
    if (currentSeatsFilter === '4') return filtered.filter(t => t.seats === 4);
    if (currentSeatsFilter === '6+') return filtered.filter(t => t.seats >= 6);
    return filtered;
}

function getZoneIcon(zoneName) {
    const icons = {
        'первая позиция': '1️⃣',
        'вторая позиция': '2️⃣',
        'средний зал': '🍽️',
        'танцпол': '💃',
        'подвал': '🔻'
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

function initMobileTables() {
    loadMobileTables();
    loadMobileBookings();
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