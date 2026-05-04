// Общие утилиты для проекта

// Генерация временных слотов 18:00-23:30
function getTimeSlots() {
    const slots = [];
    for (let h = 18; h <= 23; h++) {
        slots.push(`${h.toString().padStart(2, '0')}:00`);
        slots.push(`${h.toString().padStart(2, '0')}:30`);
    }
    return slots;
}

// Заполнение select со временем
function populateTimeSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    const slots = getTimeSlots();
    const options = slots.map(time => `<option value="${time}">${time}</option>`).join('');
    select.innerHTML = '<option value="">Выберите время</option>' + options;
}

// Заполнение select с количеством гостей (1-12)
function populateGuestsSelect(selectId) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let opts = '<option value="">Выберите</option>';
    for (let i = 1; i <= 12; i++) {
        let label = i === 1 ? 'гость' : (i <= 4 ? 'гостя' : 'гостей');
        opts += `<option value="${i}">${i} ${label}</option>`;
    }
    select.innerHTML = opts;
}

// Заполнение select с количеством гостей в диапазоне
function populateGuestsSelectWithRange(selectId, minSeats, maxSeats) {
    const select = document.getElementById(selectId);
    if (!select) return;
    let opts = '<option value="">Выберите</option>';
    for (let i = minSeats; i <= maxSeats; i++) {
        let label = i === 1 ? 'гость' : (i <= 4 ? 'гостя' : 'гостей');
        opts += `<option value="${i}">${i} ${label}</option>`;
    }
    select.innerHTML = opts;
}

// Установка минимальной даты (сегодня)
function setupDateValidation(inputId) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const today = new Date().toISOString().split('T')[0];
    input.setAttribute('min', today);
}

// Форматы телефонов
const phoneFormats = {
    '+7': { code: '+7', codeDigits: '7', length: 10, mask: '+7 (___) ___-__-__' },
    '+375': { code: '+375', codeDigits: '375', length: 9, mask: '+375 (__) ___ __-__' }
};

let currentCountryCode = '+7';

function getMaskForCode(code) {
    return phoneFormats[code] || phoneFormats['+7'];
}

function formatPhoneWithMask(digits, countryCode) {
    const format = getMaskForCode(countryCode);
    const limitedDigits = digits.slice(0, format.length);
    let result = '', digitIndex = 0;
    for (let i = 0; i < format.mask.length; i++) {
        const char = format.mask[i];
        result += char === '_' ? (digitIndex < limitedDigits.length ? limitedDigits[digitIndex++] : '_') : char;
    }
    return result;
}

function extractDigitsFromPhone(value) {
    if (!value) return '';
    const digits = value.replace(/\D/g, '');
    const countryCodeDigits = getMaskForCode(currentCountryCode).codeDigits;
    return digits.startsWith(countryCodeDigits) ? digits.slice(countryCodeDigits.length) : digits;
}

function validatePhone(value) {
    const digits = extractDigitsFromPhone(value);
    return digits.length === getMaskForCode(currentCountryCode).length;
}

// Toast уведомления
function showToast(message, type = 'info') {
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        container.style.cssText = 'position: fixed; top: 20px; right: 20px; z-index: 10000; display: flex; flex-direction: column; gap: 10px;';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    const colors = {
        success: 'linear-gradient(135deg, #27ae60, #2ecc71)',
        error: 'linear-gradient(135deg, #e74c3c, #c0392b)',
        warning: 'linear-gradient(135deg, #f39c12, #e67e22)',
        info: 'linear-gradient(135deg, #3498db, #2980b9)'
    };
    toast.style.cssText = `
        padding: 12px 20px;
        border-radius: 8px;
        color: white;
        font-family: 'Montserrat', sans-serif;
        font-size: 0.9rem;
        font-weight: 500;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        animation: slideIn 0.3s ease;
        max-width: 350px;
        word-wrap: break-word;
        background: ${colors[type] || colors.info};
    `;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = 'slideOut 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== МОДАЛЬНОЕ ОКНО ==========
if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
        @keyframes slideIn { from { transform: translateX(400px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        @keyframes slideOut { from { transform: translateX(0); opacity: 1; } to { transform: translateX(400px); opacity: 0; } }
    `;
    document.head.appendChild(style);
}

// ========== МОДАЛЬНОЕ ОКНО ==========
window.openBookingModal = function() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

window.closeBookingModal = function() {
    const modal = document.getElementById('booking-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
    }
    window.clearBookingInfoMessage();
};

// Close modal on click outside or ESC
window.addEventListener('click', function(event) {
    const modal = document.getElementById('booking-modal');
    if (modal && event.target === modal) {
        window.closeBookingModal();
    }
});

document.addEventListener('DOMContentLoaded', function() {
    const closeBtn = document.querySelector('.close-modal');
    if (closeBtn) {
        closeBtn.addEventListener('click', window.closeBookingModal);
    }
    document.addEventListener('keydown', function(event) {
        if (event.key === 'Escape') {
            const modal = document.getElementById('booking-modal');
            if (modal && modal.style.display === 'block') {
                window.closeBookingModal();
            }
        }
    });
});

// ========== BOOKING INFO MESSAGE ==========
window.clearBookingInfoMessage = function() {
    const existingMessage = document.querySelector('.booking-info-message');
    if (existingMessage) {
        existingMessage.remove();
    }
};

window.showBookingInfoInModal = function(message) {
    window.clearBookingInfoMessage();
    const messageDiv = document.createElement('div');
    messageDiv.className = 'booking-info-message';
    messageDiv.style.cssText = 'background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; padding: 10px; margin-bottom: 1rem; color: #856404; font-size: 0.9rem;';
    messageDiv.textContent = message;
    const form = document.getElementById('booking-form');
    if (form) {
        form.insertBefore(messageDiv, form.firstChild);
    }
};

// ========== TIME UTILITIES ==========
function timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
}

window.timeToMinutes = function(timeStr) {
    if (!timeStr) return 0;
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + (m || 0);
};

// Check if table is booked on given date/time with 3-hour window
// Guest can only book if time is <= (existing booking time - 3 hours)
window.checkTableAvailability = function(bookingsData, tableId, date, timeSlot) {
    if (!date || !timeSlot) return { available: true, message: '' };
    
    const selectedMinutes = timeToMinutes(timeSlot);
    const bookingsOnDate = bookingsData.filter(b => 
        b.table_id === tableId && 
        b.date === date && 
        (b.status === 'new' || b.status === 'confirmed')
    );
    
    for (const booking of bookingsOnDate) {
        const bookingMinutes = timeToMinutes(booking.time_slot);
        const diff = selectedMinutes - bookingMinutes;
        
        // Exact match or later than existing booking - not allowed
        if (diff >= 0) {
            return {
                available: false,
                message: `Столик занят на ${booking.time_slot} (${booking.date}). Бронь на это время невозможна.`,
                existingBooking: booking
            };
        }
        
        // Within 3 hours before existing booking - allow with warning
        if (diff >= -180 && diff < 0) {
            return {
                available: true,
                warning: true,
                message: `Столик будет с ограничением по времени. Есть бронь на ${booking.time_slot}.`,
                existingBooking: booking
            };
        }
    }
    
    return { available: true, message: '' };
};
