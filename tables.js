let tablesData = [];
let bookingsData = [];
let selectedTableId = null;

function getClient() {
    return window.supabaseClient;
}

async function loadTables() {
    const client = getClient();
    if (!client) {
        setTimeout(loadTables, 500);
        return;
    }
    
    const { data, error } = await client
        .from('tables')
        .select('*')
        .order('id');

    if (error) {
        console.error('Error loading tables:', error);
        return;
    }

    tablesData = (data || []).filter(t => t.is_active !== false);
    console.log('Tables loaded:', tablesData.length);
    renderFloorPlan();
}

async function loadBookings() {
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

    bookingsData = data || [];
    renderFloorPlan();
}

function isTableBooked(tableId, date, timeSlot) {
    return bookingsData.some(booking => 
        booking.table_id === tableId && 
        booking.date === date && 
        booking.time_slot === timeSlot &&
        (booking.status === 'new' || booking.status === 'confirmed')
    );
}

function renderFloorPlan() {
    const floorPlan = document.getElementById('floor-plan');
    if (!floorPlan) return;

    floorPlan.innerHTML = '';

    if (tablesData.length === 0) {
        floorPlan.innerHTML = '<p style="color:white;padding:20px;">Загрузка столиков...</p>';
        return;
    }

    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;

    tablesData.forEach(table => {
        const tableEl = document.createElement('div');
        tableEl.className = 'table-marker';
        tableEl.style.left = table.x + 'px';
        tableEl.style.top = table.y + 'px';
        
        const isVIP = table.zone_name === 'VIP' && table.number !== '8';
        const isSpecial = table.number === '8';
        
        if (isVIP) {
            tableEl.classList.add('vip-table');
        } else if (isSpecial) {
            tableEl.style.backgroundColor = '#f9a825';
        }

        const isBooked = selectedDate && selectedTime && isTableBooked(table.id, selectedDate, selectedTime);
        
        if (isBooked) {
            tableEl.classList.add('booked');
        } else {
            tableEl.classList.add('available');
        }

        if (selectedTableId === table.id) {
            tableEl.classList.add('selected');
        }

        const seatsText = table.seats === 1 ? '' : table.seats;
        const displayNumber = table.number.startsWith('B') ? '🍺' : table.number;
        
        tableEl.innerHTML = `<span>${displayNumber}${seatsText}</span>`;
        tableEl.title = `Стол ${table.number}\n${table.seats} мест\n${table.zone_name}`;
        
        tableEl.addEventListener('click', () => selectTable(table));
        
        floorPlan.appendChild(tableEl);
    });

    addLegend();
}

function addLegend() {
    const floorPlan = document.getElementById('floor-plan');
    if (!floorPlan) return;

    let legend = floorPlan.querySelector('.legend');
    if (legend) legend.remove();

    legend = document.createElement('div');
    legend.className = 'legend';
    legend.innerHTML = `
        <div class="legend-item"><span class="legend-color available"></span> Свободно</div>
        <div class="legend-item"><span class="legend-color booked"></span> Занято</div>
        <div class="legend-item"><span class="legend-color selected"></span> Выбрано</div>
    `;
    floorPlan.appendChild(legend);
}

function selectTable(table) {
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    
    if (!dateInput.value || !timeSelect.value) {
        alert('Пожалуйста, выберите дату и время бронирования');
        return;
    }

    if (isTableBooked(table.id, dateInput.value, timeSelect.value)) {
        alert('Этот столик уже забронирован на выбранное время');
        return;
    }

    selectedTableId = table.id;
    
    const tableNumberInput = document.getElementById('table-number');
    if (tableNumberInput) {
        tableNumberInput.value = table.number;
    }

    renderFloorPlan();
    
    document.getElementById('booking-form').scrollIntoView({ behavior: 'smooth' });
}

function setupRealtime() {
    const client = getClient();
    if (!client) return;
    
    client
        .channel('bookings-changes')
        .on('postgres_changes', {
            event: '*',
            schema: 'public',
            table: 'bookings'
        }, (payload) => {
            console.log('Bookings changed:', payload);
            loadBookings();
        })
        .subscribe();
}

function initFloorPlan() {
    loadTables();
    loadBookings();
    setupRealtime();
    
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    
    if (dateInput) {
        dateInput.addEventListener('change', () => {
            selectedTableId = null;
            renderFloorPlan();
        });
    }
    
    if (timeSelect) {
        timeSelect.addEventListener('change', () => {
            selectedTableId = null;
            renderFloorPlan();
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('floor-plan')) {
        initSupabase(function() {
            console.log('Desktop client ready');
            initFloorPlan();
        });
    }
});