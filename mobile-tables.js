let mobileTablesData = [];
let mobileBookingsData = [];
let selectedMobileTableId = null;
let currentSeatsFilter = 'all';
let mobileZones = [];
let currentZoneFilter = '';

window.mobileTablesData = [];

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
        mobileTablesData = (data || []).map(t => ({
        ...t,
        max_seats: t.max_seats || t.seats
    }));
    window.mobileTablesData = [...mobileTablesData];
    mobileZones = [...new Set(mobileTablesData.map(t => t.zone_name))];
    renderMobileZoneButtons();
    renderMobileTableList();
}


    
    function renderMobileZoneButtons() {
    const container = document.querySelector('.filter-buttons');
    if (!container) return;
    
    const allZones = [...mobileZones];
    const seatsFilters = ['all', '2', '3', '4', '5', '6+'];
    
    container.innerHTML = 
        '<div class="filter-group">' +
            '<span>Зона:</span>' +
            '<select id="zone-select" class="mobile-filter-select">' +
                allZones.map(z => `<option value="${z}" ${currentZoneFilter === z ? 'selected' : ''}>${z}</option>`).join('') +
            '</select>' +
        '</div>' +
        '<div class="filter-group">' +
            '<span>Места:</span>' +
            '<select id="seats-select" class="mobile-filter-select">' +
                    seatsFilters.map(s => {
        const label = s === 'all' ? 'Все' : (s === '6+' ? '6+' : s);
        return `<option value="${s}" ${currentSeatsFilter === s ? 'selected' : ''}>${label}</option>`;
    }).join('') +
            '</select>' +
        '</div>';
    
    // Авто-выбор первой зоны при загрузке
    if (!currentZoneFilter && allZones.length > 0) {
        currentZoneFilter = allZones[0];
        document.getElementById('zone-select').value = currentZoneFilter;
    }
    
    document.getElementById('zone-select').addEventListener('change', function() {
        currentZoneFilter = this.value;
        renderMobileTableList();
    });
    
    document.getElementById('seats-select').addEventListener('change', function() {
        currentSeatsFilter = this.value;
        renderMobileTableList();
    });
}

function filterTables(tables) {
    let filtered = tables;
    
    if (currentZoneFilter && currentZoneFilter !== 'all') {
        filtered = filtered.filter(t => t.zone_name === currentZoneFilter);
    }
    
    if (currentSeatsFilter === 'all' || !currentSeatsFilter) return filtered;
    
    const seatsVal = parseInt(currentSeatsFilter);
    if (currentSeatsFilter === '6+') {
        // Стол подходит, если его максимальная вместимость >= 6
        filtered = filtered.filter(t => (t.max_seats || t.seats) >= 6);
    } else if (!isNaN(seatsVal)) {
        filtered = filtered.filter(t => {
            const maxSeats = t.max_seats || t.seats;
            return t.seats <= seatsVal && maxSeats >= seatsVal;
        });
    }
    return filtered;
}

function getZoneIcon(zoneName) {
    return '';
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
        // All tables appear as available (no booked styling)
        const isSelected = selectedMobileTableId === table.id;
        const zoneIcon = getZoneIcon(table.zone_name);
        
        return `
            <div class="mobile-table-card available ${isSelected ? 'selected' : ''}">
                <div class="table-info">
                    <div class="table-header">
                        <span class="table-number">Стол ${table.number}</span>
                        <span class="table-zone">${table.zone_name}</span>
                    </div>
                    <div class="table-details">
                        <span class="table-seats">${table.seats}${table.max_seats && table.max_seats > table.seats ? '-' + table.max_seats : ''} мест</span>
                        <span class="table-status">Свободен</span>
                    </div>
                </div>
                <button class="book-btn" 
                        onclick="selectMobileTable('${table.number}')">
                    Выбрать
                </button>
            </div>
        `;
    }).join('');
}

function selectMobileTable(tableNumber) {
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;
    
    window.clearBookingInfoMessage();
    
    const tableNumberInput = document.getElementById('table-number');
    if (tableNumberInput) {
        tableNumberInput.value = tableNumber;
    }
    
    // Update guests range for mobile table
    updateGuestsRangeForTable(tableNumber);
    
    // Check availability
    if (selectedDate && selectedTime) {
        const table = mobileTablesData.find(t => t.number === tableNumber);
        if (table) {
            const result = window.checkTableAvailability(mobileBookingsData, table.id, selectedDate, selectedTime);
            if (result.message) {
                window.showBookingInfoInModal(result.message);
            }
        }
    }
    
    window.openBookingModal();
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
    const tableInput = document.getElementById('table-number');
    
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            checkMobileBookingAvailability();
        });
    }
    if (timeSelect) {
        timeSelect.addEventListener('change', () => {
            checkMobileBookingAvailability();
        });
    }
    if (tableInput) {
        tableInput.addEventListener('input', () => {
            checkMobileBookingAvailability();
        });
    }
}

function checkMobileBookingAvailability() {
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const tableInput = document.getElementById('table-number');
    
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;
    const tableNumber = tableInput?.value;
    
    if (!selectedDate || !selectedTime || !tableNumber) {
        window.clearBookingInfoMessage();
        return;
    }
    
    const table = mobileTablesData.find(t => t.number === tableNumber.toString());
    if (!table) {
        window.clearBookingInfoMessage();
        return;
    }
    
    const result = window.checkTableAvailability(mobileBookingsData, table.id, selectedDate, selectedTime);
    if (result.message) {
        window.showBookingInfoInModal(result.message);
    } else {
        window.clearBookingInfoMessage();
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