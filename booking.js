function getClient() {
    return window.supabaseClient;
}

const COOKIE_KEYS = {
    name: 'booking_name',
    phone: 'booking_phone',
    date: 'booking_date',
    time: 'booking_time',
    guests: 'booking_guests',
    table: 'booking_table',
    zone: 'booking_zone'
};

function saveToStorage(key, value) {
    try {
        localStorage.setItem(key, value);
    } catch (e) {}
}

function loadFromStorage(key) {
    try {
        return localStorage.getItem(key) || '';
    } catch (e) {
        return '';
    }
}

function saveBookingData() {
    const fields = ['customer-name', 'customer-phone', 'booking-date', 'booking-time', 'guests-count', 'table-number', 'comment'];
    const keys = [COOKIE_KEYS.name, COOKIE_KEYS.phone, COOKIE_KEYS.date, COOKIE_KEYS.time, COOKIE_KEYS.guests, COOKIE_KEYS.table, ''];
    
    fields.forEach((field, i) => {
        const el = document.getElementById(field);
        if (el && el.value) {
            if (i === 6) {
                saveToStorage(COOKIE_KEYS.table + '_comment', el.value);
            } else {
                saveToStorage(keys[i], el.value);
            }
        }
    });
}

function loadBookingData() {
    const name = loadFromStorage(COOKIE_KEYS.name);
    const phone = loadFromStorage(COOKIE_KEYS.phone);
    const date = loadFromStorage(COOKIE_KEYS.date);
    const time = loadFromStorage(COOKIE_KEYS.time);
    const guests = loadFromStorage(COOKIE_KEYS.guests);
    const table = loadFromStorage(COOKIE_KEYS.table);
    
    if (name) document.getElementById('customer-name').value = name;
    if (phone) document.getElementById('customer-phone').value = phone;
    if (date) document.getElementById('booking-date').value = date;
    if (time) document.getElementById('booking-time').value = time;
    if (guests) document.getElementById('guests-count').value = guests;
    if (table) document.getElementById('table-number').value = table;
    
    return loadFromStorage(COOKIE_KEYS.zone);
}

function clearBookingData() {
    Object.values(COOKIE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem(COOKIE_KEYS.table + '_comment');
}

const phoneMask = '+7 (___) ___-__-__';

function formatPhone(value) {
    const cleaned = value.replace(/\D/g, '');
    let result = '+7 (';
    if (cleaned.length > 0) {
        result += cleaned.substring(0, 3);
    } else {
        result += '___';
    }
    if (cleaned.length >= 3) {
        result += ') ';
        result += cleaned.substring(3, 6);
        if (cleaned.length >= 6) {
            result += '-';
            result += cleaned.substring(6, 8);
            if (cleaned.length >= 8) {
                result += '-';
                result += cleaned.substring(8, 10);
            }
        }
    }
    return result;
}

function setupPhoneMask() {
    const phoneInput = document.getElementById('customer-phone');
    if (!phoneInput) return;

    phoneInput.addEventListener('input', (e) => {
        const cursorPos = e.target.selectionStart;
        const oldValue = e.target.value;
        const formatted = formatPhone(e.target.value);
        e.target.value = formatted;
        const newCursorPos = cursorPos + (formatted.length - oldValue.length);
        e.target.setSelectionRange(newCursorPos, newCursorPos);
    });

    phoneInput.addEventListener('focus', () => {
        if (!phoneInput.value) phoneInput.value = phoneMask;
    });

    phoneInput.addEventListener('blur', () => {
        if (phoneInput.value === phoneMask) phoneInput.value = '';
    });
}

function setupDateValidation() {
    const dateInput = document.getElementById('booking-date');
    if (!dateInput) return;

    const today = new Date().toISOString().split('T')[0];
    dateInput.setAttribute('min', today);
}

function setupTimeSlots() {
    const timeSelect = document.getElementById('booking-time');
    if (!timeSelect) return;

    const timeSlots = [];
    for (let hour = 18; hour <= 23; hour++) {
        timeSlots.push(`${hour.toString().padStart(2, '0')}:00`);
        timeSlots.push(`${hour.toString().padStart(2, '0')}:30`);
    }

    timeSelect.innerHTML = '<option value="">Выберите время</option>' +
        timeSlots.map(time => `<option value="${time}">${time}</option>`).join('');
}

function setupGuestsCount() {
    const guestsSelect = document.getElementById('guests-count');
    if (!guestsSelect) return;

    let options = '<option value="">Выберите количество гостей</option>';
    for (let i = 1; i <= 12; i++) {
        let label = i === 1 ? 'гость' : (i <= 4 ? 'гостя' : 'гостей');
        options += `<option value="${i}">${i} ${label}</option>`;
    }
    guestsSelect.innerHTML = options;
}

async function checkPhoneBookingLimit(phone, date) {
    const client = getClient();
    if (!client) return false;
    
    const { data } = await client
        .from('bookings')
        .select('id')
        .eq('customer_phone', phone)
        .eq('date', date)
        .in('status', ['new', 'confirmed']);

    return (data || []).length >= 2;
}

async function validateBooking() {
    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const guestsSelect = document.getElementById('guests-count');
    const tableInput = document.getElementById('table-number');

    const errors = [];

    if (!nameInput.value.trim() || nameInput.value.trim().length < 2) {
        errors.push('Введите имя (мин 2 символа)');
    }

    const phoneDigits = phoneInput.value.replace(/\D/g, '');
    if (phoneDigits.length !== 11) {
        errors.push('Введите корректный телефон');
    }

    if (!guestsSelect.value) errors.push('Выберите количество гостей');
    if (!tableInput.value) errors.push('Выберите столик');

    if (errors.length > 0) {
        alert(errors.join('\n'));
        return false;
    }

    const today = new Date().toISOString().split('T')[0];
    if (dateInput.value < today) {
        alert('Нельзя бронировать на прошедшую дату');
        return false;
    }

    const phoneBookings = await checkPhoneBookingLimit(phoneInput.value, dateInput.value);
    if (phoneBookings) {
        alert('Максимум 2 брони в день');
        return false;
    }

    return true;
}

async function getTableIdByNumber(tableNumber) {
    const client = getClient();
    if (!client) return null;
    
    const { data } = await client
        .from('tables')
        .select('id')
        .eq('number', tableNumber.toString())
        .single();

    return data?.id;
}

async function isTableAlreadyBooked(tableId, date, timeSlot) {
    const client = getClient();
    if (!client) return false;
    
    const { data } = await client
        .from('bookings')
        .select('id')
        .eq('table_id', tableId)
        .eq('date', date)
        .eq('time_slot', timeSlot)
        .in('status', ['new', 'confirmed']);

    return (data || []).length > 0;
}

async function submitBooking(event) {
    event.preventDefault();

    if (!await validateBooking()) return;

    const nameInput = document.getElementById('customer-name');
    const phoneInput = document.getElementById('customer-phone');
    const dateInput = document.getElementById('booking-date');
    const timeSelect = document.getElementById('booking-time');
    const guestsSelect = document.getElementById('guests-count');
    const tableInput = document.getElementById('table-number');
    const commentInput = document.getElementById('comment');

    const tableId = await getTableIdByNumber(tableInput.value);
    if (!tableId) {
        alert('Ошибка: столик не найден');
        return;
    }

    const alreadyBooked = await isTableAlreadyBooked(tableId, dateInput.value, timeSelect.value);
    if (alreadyBooked) {
        alert('Столик уже забронирован');
        return;
    }

    const bookingData = {
        table_id: tableId,
        customer_name: nameInput.value.trim(),
        customer_phone: phoneInput.value,
        date: dateInput.value,
        time_slot: timeSelect.value,
        guests_count: parseInt(guestsSelect.value),
        comment: commentInput.value.trim() || null,
        status: 'new'
    };

    const submitBtn = document.querySelector('#booking-form button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Бронирование...';

    const client = getClient();
    const { error } = await client.from('bookings').insert(bookingData);

    submitBtn.disabled = false;
    submitBtn.textContent = 'Забронировать';

    if (error) {
        alert('Ошибка: ' + error.message);
        return;
    }

    alert('Бронирование успешно!');
    clearBookingData();
    document.getElementById('booking-form').reset();
    document.getElementById('table-number').value = '';
}

function initBookingForm() {
    setupPhoneMask();
    setupDateValidation();
    setupTimeSlots();
    setupGuestsCount();
    
    const savedZone = loadBookingData();
    if (savedZone) {
        window.savedFloorPlanZone = savedZone;
    }
    
    const form = document.getElementById('booking-form');
    if (form) {
        form.addEventListener('submit', submitBooking);
    }
    
    ['customer-name', 'customer-phone', 'booking-date', 'booking-time', 'guests-count', 'table-number', 'comment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveBookingData);
            el.addEventListener('input', saveBookingData);
        }
    });
}

document.addEventListener('DOMContentLoaded', initBookingForm);