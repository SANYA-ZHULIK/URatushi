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
    
    const countryCodeSelect = document.getElementById('country-code');
    if (countryCodeSelect) {
        saveToStorage('booking_country_code', countryCodeSelect.value);
    }
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
        const phoneInput = document.getElementById('customer-phone');
        if (phoneInput) {
            const digits = extractDigitsFromPhone(phone);
            phoneInput.value = formatPhoneWithMask(digits, currentCountryCode);
        }
    }
    
    return loadFromStorage(COOKIE_KEYS.zone);
}

function clearBookingData() {
    Object.values(COOKIE_KEYS).forEach(key => {
        localStorage.removeItem(key);
    });
    localStorage.removeItem(COOKIE_KEYS.table + '_comment');
}

// Phone formats
const phoneFormats = {
    '+7': { code: '+7', codeDigits: '7', length: 10, mask: '+7 (___) ___-__-__', prefixLength: 5 },
    '+375': { code: '+375', codeDigits: '375', length: 9, mask: '+375 (__) ___ __-__', prefixLength: 6 }
};

let currentCountryCode = '+7';

function getMaskForCode(code) {
    return phoneFormats[code] || phoneFormats['+7'];
}

function formatPhoneWithMask(digits, countryCode) {
    const format = getMaskForCode(countryCode);
    const maxLength = format.length;
    const limitedDigits = digits.slice(0, maxLength);
    
    let result = '';
    let digitIndex = 0;
    
    for (let i = 0; i < format.mask.length; i++) {
        const char = format.mask[i];
        if (char === '_') {
            if (digitIndex < limitedDigits.length) {
                result += limitedDigits[digitIndex];
                digitIndex++;
            } else {
                result += '_';
            }
        } else {
            result += char;
        }
    }
    
    return result;
}

function extractDigitsFromPhone(value) {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const format = getMaskForCode(currentCountryCode);
    const countryCodeDigits = format.codeDigits;
    
    if (digits.startsWith(countryCodeDigits)) {
        return digits.slice(countryCodeDigits.length);
    }
    return digits;
}

function validatePhone(value) {
    const digits = extractDigitsFromPhone(value);
    const format = getMaskForCode(currentCountryCode);
    return digits.length === format.length;
}

function setCursorToEnd(input) {
    setTimeout(() => {
        if (document.activeElement === input) {
            const length = input.value.length;
            input.setSelectionRange(length, length);
        }
    }, 0);
}

function setupPhoneMask() {
    const phoneInput = document.getElementById('customer-phone');
    const countryCodeSelect = document.getElementById('country-code');
    
    if (!phoneInput || !countryCodeSelect) return;
    
    let ignoreEvent = false;
    
    function updatePhoneValue(digits) {
        const formatted = formatPhoneWithMask(digits, currentCountryCode);
        phoneInput.value = formatted;
        return formatted;
    }
    
    countryCodeSelect.addEventListener('change', (e) => {
        currentCountryCode = e.target.value;
        
        let currentDigits = '';
        const currentValue = phoneInput.value;
        if (currentValue) {
            currentDigits = extractDigitsFromPhone(currentValue);
        }
        
        updatePhoneValue(currentDigits);
        setCursorToEnd(phoneInput);
        
        saveToStorage('booking_country_code', currentCountryCode);
        saveBookingData();
    });
    
    phoneInput.addEventListener('input', (e) => {
        if (ignoreEvent) return;
        
        const rawValue = phoneInput.value;
        const digits = extractDigitsFromPhone(rawValue);
        const format = getMaskForCode(currentCountryCode);
        
        let limitedDigits = digits.slice(0, format.length);
        
        const newFormatted = formatPhoneWithMask(limitedDigits, currentCountryCode);
        
        if (newFormatted !== rawValue) {
            ignoreEvent = true;
            phoneInput.value = newFormatted;
            ignoreEvent = false;
        }
        
        setCursorToEnd(phoneInput);
        saveBookingData();
    });
    
    phoneInput.addEventListener('keydown', (e) => {
        if (e.key === 'Backspace') {
            const currentDigits = extractDigitsFromPhone(phoneInput.value);
            
            if (currentDigits.length > 0) {
                e.preventDefault();
                
                const newDigits = currentDigits.slice(0, -1);
                const newFormatted = formatPhoneWithMask(newDigits, currentCountryCode);
                phoneInput.value = newFormatted;
                setCursorToEnd(phoneInput);
                saveBookingData();
            }
        }
        
        if (e.key === 'Delete') {
            e.preventDefault();
        }
    });
    
    phoneInput.addEventListener('focus', () => {
        const currentDigits = extractDigitsFromPhone(phoneInput.value);
        if (currentDigits.length === 0) {
            const format = getMaskForCode(currentCountryCode);
            phoneInput.value = format.mask;
        }
        setCursorToEnd(phoneInput);
    });
    
    phoneInput.addEventListener('blur', () => {
        const digits = extractDigitsFromPhone(phoneInput.value);
        if (digits.length === 0) {
            phoneInput.value = '';
        }
        saveBookingData();
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

    if (!validatePhone(phoneInput.value)) {
        errors.push('Введите корректный номер телефона');
    }

    if (!guestsSelect.value) errors.push('Выберите количество гостей');
    if (!tableInput.value) errors.push('Выберите столик');
    if (!timeSelect.value) errors.push('Выберите время');

    if (errors.length > 0) {
        alert(errors.join('\n'));
        return false;
    }

    const today = new Date().toISOString().split('T')[0];
    if (dateInput.value < today) {
        alert('Нельзя бронировать на прошедшую дату');
        return false;
    }

    const phoneDigits = extractDigitsFromPhone(phoneInput.value);
    const fullPhone = currentCountryCode.replace(/\D/g, '') + phoneDigits;
    
    const phoneBookings = await checkPhoneBookingLimit(fullPhone, dateInput.value);
    if (phoneBookings) {
        alert('С этого номера уже есть 2 брони на эту дату');
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
        alert('Столик уже забронирован на это время');
        return;
    }

    const phoneDigits = extractDigitsFromPhone(phoneInput.value);
    const fullPhone = currentCountryCode.replace(/\D/g, '') + phoneDigits;

    const bookingData = {
        table_id: tableId,
        customer_name: nameInput.value.trim(),
        customer_phone: fullPhone,
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

    alert('Бронирование успешно отправлено! Администратор подтвердит его в ближайшее время.');
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