function getClient() {
    return window.supabaseClient;
}

// Header scroll effect
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHeaderScroll);
} else {
    initHeaderScroll();
}

// LocalStorage helpers
const COOKIE_KEYS = {
    name: 'booking_name', phone: 'booking_phone', date: 'booking_date',
    time: 'booking_time', guests: 'booking_guests', table: 'booking_table', zone: 'booking_zone'
};

function saveToStorage(key, value) { try { localStorage.setItem(key, value); } catch (e) {} }
function loadFromStorage(key) { try { return localStorage.getItem(key) || ''; } catch (e) { return ''; } }

function saveBookingData() {
    const fields = ['customer-name', 'customer-phone', 'booking-date', 'booking-time', 'guests-count', 'table-number', 'comment'];
    const keys = [COOKIE_KEYS.name, COOKIE_KEYS.phone, COOKIE_KEYS.date, COOKIE_KEYS.time, COOKIE_KEYS.guests, COOKIE_KEYS.table, ''];
    fields.forEach((field, i) => {
        const el = document.getElementById(field);
        if (el && el.value) {
            i === 6 ? saveToStorage(COOKIE_KEYS.table + '_comment', el.value) : saveToStorage(keys[i], el.value);
        }
    });
    const cc = document.getElementById('country-code');
    if (cc) saveToStorage('booking_country_code', cc.value);
}

function loadBookingData() {
    const name = loadFromStorage(COOKIE_KEYS.name);
    const phone = loadFromStorage(COOKIE_KEYS.phone);
    const date = loadFromStorage(COOKIE_KEYS.date);
    const time = loadFromStorage(COOKIE_KEYS.time);
    const guests = loadFromStorage(COOKIE_KEYS.guests);
    const table = loadFromStorage(COOKIE_KEYS.table);
    const countryCode = loadFromStorage('booking_country_code');

    if (name) document.getElementById('customer-name').value = name;
    if (date) document.getElementById('booking-date').value = date;
    if (time) document.getElementById('booking-time').value = time;
    if (guests) document.getElementById('guests-count').value = guests;
    if (table) document.getElementById('table-number').value = table;
    if (countryCode) {
        document.getElementById('country-code').value = countryCode;
        currentCountryCode = countryCode;
    }
    if (phone) {
        const pi = document.getElementById('customer-phone');
        if (pi) pi.value = formatPhoneWithMask(extractDigitsFromPhone(phone), currentCountryCode);
    }
    return loadFromStorage(COOKIE_KEYS.zone);
}

function clearBookingData() {
    Object.values(COOKIE_KEYS).forEach(k => localStorage.removeItem(k));
    localStorage.removeItem(COOKIE_KEYS.table + '_comment');
}

// Phone mask setup - uses shared functions from utils.js
// currentCountryCode and format/extract functions are global from utils.js

function setCursorToEnd(input) {
    setTimeout(() => {
        if (document.activeElement === input) {
            const len = input.value.length;
            input.setSelectionRange(len, len);
        }
    }, 0);
}

function setupPhoneMask() {
    const phoneInput = document.getElementById('customer-phone');
    const ccSelect = document.getElementById('country-code');
    if (!phoneInput || !ccSelect) return;

    let ignore = false;
    function updateValue(digits) {
        phoneInput.value = formatPhoneWithMask(digits, currentCountryCode);
    }

    ccSelect.addEventListener('change', (e) => {
        currentCountryCode = e.target.value;
        let digits = extractDigitsFromPhone(phoneInput.value);
        updateValue(digits);
        setCursorToEnd(phoneInput);
        saveToStorage('booking_country_code', currentCountryCode);
        saveBookingData();
    });

    phoneInput.addEventListener('input', (e) => {
        if (ignore) return;
        const digits = extractDigitsFromPhone(phoneInput.value);
        const formatted = formatPhoneWithMask(digits, currentCountryCode);
        if (formatted !== phoneInput.value) {
            ignore = true;
            phoneInput.value = formatted;
            ignore = false;
        }
        setCursorToEnd(phoneInput);
        saveBookingData();
    });

    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const d = extractDigitsFromPhone(phoneInput.value);
            if (d.length > 0) {
                e.preventDefault();
                phoneInput.value = formatPhoneWithMask(d.slice(0, -1), currentCountryCode);
                setCursorToEnd(phoneInput);
                saveBookingData();
            }
        }
        if (e.key === 'Delete') e.preventDefault();
    });

    phoneInput.addEventListener('focus', () => {
        if (!extractDigitsFromPhone(phoneInput.value)) {
            phoneInput.value = getMaskForCode(currentCountryCode).mask;
        }
        setCursorToEnd(phoneInput);
    });

    phoneInput.addEventListener('blur', () => {
        if (!extractDigitsFromPhone(phoneInput.value)) phoneInput.value = '';
        saveBookingData();
    });
}

async function checkPhoneBookingLimit(phone, date) {
    const client = getClient();
    if (!client) return false;
    const { data } = await client.from('bookings').select('id').eq('customer_phone', phone).eq('date', date).in('status', ['new', 'confirmed']);
    return (data || []).length >= 2;
}

async function validateBooking() {
    const name = document.getElementById('customer-name');
    const phone = document.getElementById('customer-phone');
    const date = document.getElementById('booking-date');
    const time = document.getElementById('booking-time');
    const guests = document.getElementById('guests-count');
    const table = document.getElementById('table-number');

    const errors = [];
    if (!name.value.trim() || name.value.trim().length < 2) errors.push('Введите имя (мин 2 символа)');
    if (!validatePhone(phone.value)) errors.push('Введите корректный номер телефона');
    if (!guests.value) errors.push('Выберите количество гостей');
    if (!table.value) errors.push('Выберите столик');
    if (!time.value) errors.push('Выберите время');

    if (errors.length > 0) {
        showToast(errors.join(', '), 'warning');
        return false;
    }

    const today = new Date().toISOString().split('T')[0];
    if (date.value < today) {
        showToast('Нельзя бронировать на прошедшую дату', 'warning');
        return false;
    }

    const phoneDigits = extractDigitsFromPhone(phone.value);
    const fullPhone = currentCountryCode.replace(/\D/g, '') + phoneDigits;
    if (await checkPhoneBookingLimit(fullPhone, date.value)) {
        showToast('С этого номера уже есть 2 брони на эту дату', 'warning');
        return false;
    }
    return true;
}

async function getTableIdByNumber(tableNumber) {
    const client = getClient();
    if (!client) return null;
    const { data } = await client.from('tables').select('id').eq('number', tableNumber.toString()).single();
    return data?.id;
}

async function getTableSeatsInfo(tableNumber) {
    const client = getClient();
    if (!client) return null;
    const { data } = await client.from('tables').select('seats, max_seats').eq('number', tableNumber.toString()).single();
    return data;
}

function updateGuestsRangeForTable(tableNumber) {
    if (!tableNumber) {
        populateGuestsSelect('guests-count');
        return;
    }
    
    // Check global tables data (desktop)
    if (window.allTablesData && window.allTablesData.length > 0) {
        const table = window.allTablesData.find(t => t.number === tableNumber.toString() || t.number.startsWith('B') && tableNumber.toString().startsWith('🍺'));
        if (table && table.seats != null) {
            const minSeats = table.seats;
            const maxSeats = table.max_seats || table.seats;
            populateGuestsSelectWithRange('guests-count', minSeats, maxSeats);
            return;
        }
    }
    
    // Check global tables data (mobile)
    if (window.mobileTablesData && window.mobileTablesData.length > 0) {
        const table = window.mobileTablesData.find(t => t.number === tableNumber.toString() || t.number.startsWith('B') && tableNumber.toString().startsWith('🍺'));
        if (table && table.seats != null) {
            const minSeats = table.seats;
            const maxSeats = table.max_seats || table.seats;
            populateGuestsSelectWithRange('guests-count', minSeats, maxSeats);
            return;
        }
    }
    
    // Fallback to default range
    populateGuestsSelect('guests-count');
}

async function isTableAlreadyBooked(tableId, date, timeSlot) {
    const client = getClient();
    if (!client) return false;
    const { data } = await client.from('bookings').select('id').eq('table_id', tableId).eq('date', date).eq('time_slot', timeSlot).in('status', ['new', 'confirmed']);
    return (data || []).length > 0;
}

async function checkTimeConflict(tableId, date, timeSlot) {
    const client = getClient();
    if (!client) return false;
    const { data } = await client.from('bookings').select('time_slot').eq('table_id', tableId).eq('date', date).in('status', ['new', 'confirmed']);
    if (!data || data.length === 0) return false;
    
    const selectedMinutes = window.timeToMinutes(timeSlot);
    for (const booking of data) {
        const bookingMinutes = window.timeToMinutes(booking.time_slot);
        if (selectedMinutes >= bookingMinutes) {
            return true;
        }
    }
    return false;
}

async function submitBooking(event) {
    event.preventDefault();
    if (!await validateBooking()) return;

    const name = document.getElementById('customer-name');
    const phone = document.getElementById('customer-phone');
    const date = document.getElementById('booking-date');
    const time = document.getElementById('booking-time');
    const guests = document.getElementById('guests-count');
    const table = document.getElementById('table-number');
    const comment = document.getElementById('comment');

    const tableId = await getTableIdByNumber(table.value);
    if (!tableId) {
        showToast('Ошибка: столик не найден', 'error');
        return;
    }

    if (await isTableAlreadyBooked(tableId, date.value, time.value)) {
        showToast('Столик уже забронирован на это время', 'warning');
        return;
    }
    
    // Check for time conflicts (new booking time must not be >= existing booking times)
    if (await checkTimeConflict(tableId, date.value, time.value)) {
        showToast('Нельзя забронировать столик на более позднее время, чем у существующей брони', 'warning');
        return;
    }

    const phoneDigits = extractDigitsFromPhone(phone.value);
    const fullPhone = currentCountryCode.replace(/\D/g, '') + phoneDigits;

    const bookingData = {
        table_id: tableId,
        customer_name: name.value.trim(),
        customer_phone: fullPhone,
        date: date.value,
        time_slot: time.value,
        guests_count: parseInt(guests.value),
        comment: comment.value.trim() || null,
        status: 'new'
    };

    const btn = document.querySelector('#booking-form button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Бронирование...';

    const client = getClient();
    const { error } = await client.from('bookings').insert(bookingData);

    btn.disabled = false;
    btn.textContent = 'Забронировать';

    if (error) {
        showToast('Ошибка: ' + error.message, 'error');
        return;
    }

    showToast('Бронирование успешно отправлено! Администратор подтвердит его в ближайшее время.', 'success');
    clearBookingData();
    document.getElementById('booking-form').reset();
    table.value = '';
}

function initBookingForm() {
    setupPhoneMask();
    // Используем общие утилиты
    populateTimeSelect('booking-time');
    populateGuestsSelect('guests-count');
    setupDateValidation('booking-date');

    const savedZone = loadBookingData();
    if (savedZone) window.savedFloorPlanZone = savedZone;

    const form = document.getElementById('booking-form');
    if (form) form.addEventListener('submit', submitBooking);

    ['customer-name', 'customer-phone', 'booking-date', 'booking-time', 'guests-count', 'table-number', 'comment'].forEach(id => {
        const el = document.getElementById(id);
        if (el) {
            el.addEventListener('change', saveBookingData);
            el.addEventListener('input', saveBookingData);
        }
    });
    
    // Update guests range when table number changes
    const tableInput = document.getElementById('table-number');
    if (tableInput) {
        tableInput.addEventListener('input', () => {
            updateGuestsRangeForTable(tableInput.value);
        });
        tableInput.addEventListener('change', () => {
            updateGuestsRangeForTable(tableInput.value);
        });
    }
}

document.addEventListener('DOMContentLoaded', initBookingForm);
