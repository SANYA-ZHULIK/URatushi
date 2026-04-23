let tablesData = [];
let bookingsData = [];
let selectedTableId = null;
let currentZoneIndex = 0;
let zones = [];

const ZONE_COOKIE_KEY = 'booking_zone';

function getClient() {
    return window.supabaseClient;
}

function saveZoneToStorage(zone) {
    try {
        localStorage.setItem(ZONE_COOKIE_KEY, zone);
    } catch (e) {}
}

function loadZoneFromStorage() {
    try {
        return localStorage.getItem(ZONE_COOKIE_KEY) || '';
    } catch (e) {
        return '';
    }
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
        .eq('is_active', true)
        .order('id');

    if (error) {
        console.error('Error loading tables:', error);
        return;
    }

    tablesData = data || [];
    
    zones = [...new Set(tablesData.map(t => t.zone_name))];
    console.log('Tables loaded:', tablesData.length, 'Zones:', zones);
    
    const savedZone = loadZoneFromStorage();
    if (savedZone && zones.includes(savedZone)) {
        currentZoneIndex = zones.indexOf(savedZone);
    }
    
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

    const currentZone = zones[currentZoneIndex];
    const zoneTables = tablesData.filter(t => t.zone_name === currentZone);
    
    // Устанавливаем фон для позиций
    if (currentZone === 'первая позиция') {
        floorPlan.style.background = `url('positions_photo/первая.jpg') center/cover no-repeat`;
    } else if (currentZone === 'вторая позиция') {
        floorPlan.style.background = `url('positions_photo/вторая.jpg') center/cover no-repeat`;
    } else if (currentZone === 'третья позиция') {
        floorPlan.style.background = `url('positions_photo/третья.jpg') center/cover no-repeat`;
    } else if (currentZone === 'средний зал') {
        floorPlan.style.background = `url('positions_photo/средний.jpg') center/cover no-repeat`;
    } else if (currentZone === 'танцпол') {
        floorPlan.style.background = `url('positions_photo/танцпол.jpg') center/cover no-repeat`;
    } else {
        floorPlan.style.background = 'linear-gradient(135deg, #2c3e50 0%, #34495e 100%)';
    }
    
    // Добавляем label зоны
    const zoneLabel = document.createElement('div');
    zoneLabel.className = 'zone-label';
    zoneLabel.textContent = currentZone;
    floorPlan.appendChild(zoneLabel);
    
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;

    zoneTables.forEach(table => {
        const tableEl = document.createElement('div');
        tableEl.className = 'table-marker';
        tableEl.style.left = table.x + 'px';
        tableEl.style.top = table.y + 'px';
        
        // All tables appear as available (no booked styling)
        tableEl.classList.add('available');
        
        if (selectedTableId === table.id) {
            tableEl.classList.add('selected');
        }
        
        const displayNumber = table.number.startsWith('B') ? '🍺' : table.number;
        
        tableEl.innerHTML = `<span>${displayNumber}</span>`;
        tableEl.title = `Стол ${table.number}\n${table.seats} мест\n${table.zone_name}`;
        
        tableEl.addEventListener('click', () => selectTable(table));
        
        floorPlan.appendChild(tableEl);
    });

    addLegend();
    updateNavButtons();
}

function updateNavButtons() {
    const navLeft = document.getElementById('nav-left');
    const navRight = document.getElementById('nav-right');
    const isFirst = currentZoneIndex === 0;
    const isLast = currentZoneIndex === zones.length - 1;
    
    if (navLeft) navLeft.disabled = isFirst;
    if (navRight) navRight.disabled = isLast;
}

function prevZone() {
    if (currentZoneIndex > 0) {
        currentZoneIndex--;
        selectedTableId = null;
        saveZoneToStorage(zones[currentZoneIndex]);
        renderFloorPlan();
        updateNavButtons();
    }
}

function nextZone() {
    if (currentZoneIndex < zones.length - 1) {
        currentZoneIndex++;
        selectedTableId = null;
        saveZoneToStorage(zones[currentZoneIndex]);
        renderFloorPlan();
        updateNavButtons();
    }
}

window.prevZone = prevZone;
window.nextZone = nextZone;

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
    const selectedDate = dateInput?.value;
    const selectedTime = timeSelect?.value;
    
    // Clear any existing booking info message
    clearBookingInfoMessage();
    
    // Set form values but don't validate date/time here
    const tableNumberInput = document.getElementById('table-number');
    if (tableNumberInput) {
        tableNumberInput.value = table.number;
    }
    
    // Check if table is booked for selected date/time
    if (selectedDate && selectedTime && isTableBooked(table.id, selectedDate, selectedTime)) {
        // Find the booking to show details
        const booking = bookingsData.find(b => 
            b.table_id === table.id && 
            b.date === selectedDate && 
            b.time_slot === selectedTime &&
            (b.status === 'new' || b.status === 'confirmed')
        );
        
        if (booking) {
            // Show booking info message inside the modal
            showBookingInfoInModal(`Этот столик уже забронирован на ${booking.time_slot} ${booking.date}`);
        }
    }
    
    // Open modal instead of scrolling
    openBookingModal();
    
    renderFloorPlan();
}

// Helper function to show booking info in modal
function showBookingInfoInModal(message) {
    // Remove any existing message
    const existingMessage = document.querySelector('.booking-info-message');
    if (existingMessage) {
        existingMessage.remove();
    }
    
    // Create message element
    const messageDiv = document.createElement('div');
    messageDiv.className = 'booking-info-message';
    messageDiv.textContent = message;
    
    // Add message to the form (at the beginning)
    const form = document.getElementById('booking-form');
    if (form) {
        form.insertBefore(messageDiv, form.firstChild);
    }
    
    // Message remains visible until cleared by another selection or modal close
}

// Helper function to clear booking info message
function clearBookingInfoMessage() {
    const existingMessage = document.querySelector('.booking-info-message');
    if (existingMessage) {
        existingMessage.remove();
    }
}

// Modal functions
function openBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'block';
        // Prevent scrolling when modal is open
        document.body.style.overflow = 'hidden';
    }
}

function closeBookingModal() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'none';
        // Re-enable scrolling when modal is closed
        document.body.style.overflow = '';
    }
}

// Close modal when clicking outside content or on close button
window.onclick = function(event) {
    const modal = document.getElementById('booking-modal');
    if (modal && event.target === modal) {
        closeBookingModal();
    }
}

// Add close button event listener
document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeBookingModal);
    }
    
    // Add ESC key listener
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('booking-modal');
            if (modal && modal.style.display === 'block') {
                closeBookingModal();
            }
        }
    });
});

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