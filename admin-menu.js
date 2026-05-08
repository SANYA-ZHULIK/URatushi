// ========== MENU MANAGEMENT MODULE ==========

// Wrap in IIFE to avoid global conflicts
(() => {
    let allMenuItems = [];
    let editingDishId = null;

    // Export to window for HTML onclick handlers
    window.allMenuItems = allMenuItems;

    // Transform relative path to full URL (encode for safety)
    function getPhotoUrl(relativePath) {
        if (!relativePath) return null;
        const baseUrl = 'https://wftycbttpwxzizqgwatu.supabase.co';
        const encodedPath = encodeURIComponent(relativePath).replace(/%2F/g, '/');
        return `${baseUrl}/storage/v1/object/public/menu-images/${encodedPath}`;
    }

    // Generate safe filename (ASCII only) for storage
    function generateSafeFileName(dishName, category, ext) {
        const timestamp = Date.now();

        // Transliteration map Russian -> Latin
        const map = {
            'а':'a','б':'b','в':'v','г':'g','д':'d','е':'e','ё':'yo','ж':'zh','з':'z','и':'i','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ъ':'','ы':'y','ь':'','э':'e','ю':'yu','я':'ya',
            'А':'a','Б':'b','В':'v','Г':'g','Д':'d','Е':'e','Ё':'yo','Ж':'zh','З':'z','И':'i','Й':'y','К':'k','Л':'l','М':'m','Н':'n','О':'o','П':'p','Р':'r','С':'s','Т':'t','У':'u','Ф':'f','Х':'kh','Ц':'ts','Ч':'ch','Ш':'sh','Щ':'shch','Ъ':'','Ы':'y','Ь':'','Э':'e','Ю':'yu','Я':'ya'
        };

        const translit = (s) => s.toLowerCase().split('').map(ch => map[ch] || ch).join('').replace(/[^a-z0-9]/g, '_');

        const safeCategory = translit(category) || 'uncategorized';
        const safeName = translit(dishName);

        return `${safeCategory}/${safeName}_${timestamp}.${ext}`;
    }

    // Upload image to Supabase Storage
    async function uploadDishImage(file, dishName, category) {
        const client = window.supabaseClient;
        if (!client) throw new Error('Supabase not initialized');

        const fileExt = file.name.split('.').pop();
        const fileName = generateSafeFileName(dishName, category, fileExt);

        const { data, error } = await client.storage
            .from('menu-images')
            .upload(fileName, file, { upsert: true });

        if (error) {
            console.error('Upload error:', error);
            throw error;
        }

        return fileName; // relative path stored in DB (ASCII-safe)
    }

// Load all menu items from DB
async function loadMenuItems() {
    const client = window.supabaseClient;
    if (!client) return;

    try {
        const { data, error } = await client
            .from('menu_items')
            .select('*')
            .order('category')
            .order('name');

        if (error) throw error;

        allMenuItems = (data || []).map(item => ({
            ...item,
            id: Number(item.id),
            price: Number(item.price),
            is_active: !!item.is_active
        }));

        // Sync to window for cross-script access
        window.allMenuItems = allMenuItems;

        renderMenuList(allMenuItems);
    } catch (err) {
        console.error('Error loading menu:', err);
        showToast('Ошибка загрузки меню', 'error');
    }
}

// Render menu list in admin
function renderMenuList(items) {
    const container = document.getElementById('menu-list');
    if (!container) return;

    if (items.length === 0) {
        container.innerHTML = '<p class="no-data">Нет блюд в меню</p>';
        return;
    }

    container.innerHTML = items.map(dish => {
        const photoUrl = getPhotoUrl(dish.photo_url);
        const isEditing = editingDishId === dish.id;

        return `
        <div class="menu-item-card ${isEditing ? 'editing' : ''}" data-id="${dish.id}">
            <div class="dish-photo">
                ${photoUrl 
                    ? `<img src="${photoUrl}" alt="${dish.name}" onerror="this.parentElement.innerHTML='<span class=\"no-photo\">📷</span>';">`
                    : '<span class="no-photo">📷</span>'
                }
            </div>
            <div class="dish-info">
                <h4>${dish.name}</h4>
                <p class="dish-category">${dish.category}</p>
                <p class="dish-description">${dish.description || ''}</p>
                <p class="dish-price">${dish.price} руб.</p>
                <p class="dish-status">${dish.is_active ? '✅ Активно' : '❌ Скрыто'}</p>
            </div>
            <div class="dish-actions">
                <button onclick="editDish(${dish.id})" class="btn-action btn-edit" title="Редактировать">
                    ✏️
                </button>
                <button onclick="deleteDish(${dish.id})" class="btn-action btn-delete" title="Удалить">
                    🗑️
                </button>
                <button onclick="toggleDishStatus(${dish.id}, ${dish.is_active})" class="btn-action ${dish.is_active ? 'btn-hide' : 'btn-show'}" title="${dish.is_active ? 'Скрыть' : 'Показать'}">
                    ${dish.is_active ? '👁️‍🗨️' : '👁️'}
                </button>
            </div>
        </div>
        `;
    }).join('');

    // Add event listeners for file inputs if they exist
    document.querySelectorAll('.dish-photo-input').forEach(input => {
        input.addEventListener('change', function(e) {
            const fileNameDisplay = this.parentNode.querySelector('.file-name-display');
            if (fileNameDisplay) {
                fileNameDisplay.textContent = e.target.files[0]?.name || 'Файл выбран';
            }
        });
    });
}

// Show add dish form
window.showAddDishForm = function() {
    const modal = document.getElementById('add-dish-modal');
    if (modal) {
        editingDishId = null;
        document.getElementById('add-dish-form').reset();
        document.querySelector('.modal-title').textContent = 'Добавить блюдо';
        // Reset photo preview
        const photoPreview = document.getElementById('photo-preview');
        if (photoPreview) {
            photoPreview.innerHTML = '<span class="no-photo">📷</span>';
        }
        modal.style.display = 'block';
        document.body.style.overflow = 'hidden';
    }
};

// Show edit dish form (opens modal with data)
window.editDish = function(id) {
    const dish = allMenuItems.find(d => d.id === id);
    if (!dish) return;

    editingDishId = id;
    const modal = document.getElementById('add-dish-modal');
    
    document.getElementById('dish-name').value = dish.name;
    document.getElementById('dish-category').value = dish.category || '';
    document.getElementById('dish-description').value = dish.description || '';
    document.getElementById('dish-price').value = dish.price || '';
    document.getElementById('dish-is-active').checked = dish.is_active;

    // Show existing photo
    const photoPreview = document.getElementById('photo-preview');
    if (dish.photo_url) {
        photoPreview.innerHTML = `<img src="${getPhotoUrl(dish.photo_url)}" alt="Preview">`;
        photoPreview.dataset.existingPhoto = dish.photo_url;
    } else {
        photoPreview.innerHTML = '<span class="no-photo">📷</span>';
        delete photoPreview.dataset.existingPhoto;
    }

    document.querySelector('.modal-title').textContent = 'Редактировать блюдо';
    modal.style.display = 'block';
    document.body.style.overflow = 'hidden';
};

// Cancel form
window.cancelDishForm = function() {
    const modal = document.getElementById('add-dish-modal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = '';
        editingDishId = null;
    }
};

    // Save dish (insert or update)
    async function saveDish(event) {
        event.preventDefault();
        const client = window.supabaseClient;
        if (!client) return;

        const name = document.getElementById('dish-name').value.trim();
        const category = document.getElementById('dish-category').value;
        const description = document.getElementById('dish-description').value.trim();
        const price = parseFloat(document.getElementById('dish-price').value);
        const isActive = document.getElementById('dish-is-active').checked;

        if (!name || !category || isNaN(price) || price < 0) {
            showToast('Заполните название, категорию и корректную цену', 'warning');
            return;
        }

    const btn = document.querySelector('#add-dish-form button[type="submit"]');
    btn.disabled = true;
    btn.textContent = 'Сохранение...';

    try {
        let photo_url = editingDishId ? allMenuItems.find(d => d.id === editingDishId)?.photo_url : null;

        // Upload new photo if provided
        const photoInput = document.getElementById('dish-photo');
        if (photoInput.files[0]) {
            try {
                photo_url = await uploadDishImage(photoInput.files[0], name, category);
            } catch (err) {
                showToast('Ошибка загрузки фото', 'error');
                btn.disabled = false;
                btn.textContent = 'Сохранить';
                return;
            }
        }

        const dishData = {
            name,
            category,
            description: description || null,
            price,
            is_active: isActive,
            photo_url: photo_url || null
        };

        if (editingDishId) {
            const { error } = await client
                .from('menu_items')
                .update(dishData)
                .eq('id', editingDishId);
            if (error) throw error;
            showToast('Блюдо обновлено', 'success');
        } else {
            const { error } = await client
                .from('menu_items')
                .insert([dishData]);
            if (error) throw error;
            showToast('Блюдо добавлено', 'success');
        }

        cancelDishForm();
        await loadMenuItems();
    } catch (err) {
        console.error('Save dish error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    } finally {
        btn.disabled = false;
        btn.textContent = 'Сохранить';
    }
}

// Edit dish trigger
window.editDishById = function(id) {
    editDish(id);
};

// Delete dish with confirmation
async function deleteDish(id) {
    if (!confirm('Удалить это блюдо?')) return;

    const client = window.supabaseClient;
    if (!client) return;

    try {
        const { error } = await client
            .from('menu_items')
            .delete()
            .eq('id', id);
        if (error) throw error;

        showToast('Блюдо удалено', 'success');
        await loadMenuItems();
    } catch (err) {
        console.error('Delete dish error:', err);
        showToast('Ошибка удаления: ' + (err.message || err), 'error');
    }
}

// Toggle dish active status
async function toggleDishStatus(id, currentStatus) {
    const client = window.supabaseClient;
    if (!client) return;

    try {
        const { error } = await client
            .from('menu_items')
            .update({ is_active: !currentStatus })
            .eq('id', id);
        if (error) throw error;

        showToast(currentStatus ? 'Блюдо скрыто' : 'Блюдо показано', 'success');
        await loadMenuItems();
    } catch (err) {
        console.error('Toggle status error:', err);
        showToast('Ошибка: ' + (err.message || err), 'error');
    }
}

// Setup photo preview for new dish
(function setupPhotoPreview() {
    const photoInput = document.getElementById('dish-photo');
    if (!photoInput) return;
    photoInput.addEventListener('change', function() {
        const file = this.files[0];
        const preview = document.getElementById('photo-preview');
        const fileNameDisplay = document.getElementById('file-name-display');
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
            };
            reader.readAsDataURL(file);
            if (fileNameDisplay) fileNameDisplay.textContent = file.name;
        } else {
            preview.innerHTML = '<span class="no-photo">📷</span>';
            if (fileNameDisplay) fileNameDisplay.textContent = '';
        }
    });
})();

// Expose functions to window for HTML/other scripts
window.loadMenuItems = loadMenuItems;
window.renderMenuList = renderMenuList;
window.saveDish = saveDish;
window.editDish = editDish;
window.deleteDish = deleteDish;
window.toggleDishStatus = toggleDishStatus;

// Setup photo preview after DOM loads
document.addEventListener('DOMContentLoaded', function() {
    const photoInput = document.getElementById('dish-photo');
    if (photoInput) {
        photoInput.addEventListener('change', function() {
            const file = this.files[0];
            const preview = document.getElementById('photo-preview');
            const fileNameDisplay = document.getElementById('file-name-display');
            if (file) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    preview.innerHTML = `<img src="${e.target.result}" alt="Preview">`;
                };
                reader.readAsDataURL(file);
                if (fileNameDisplay) fileNameDisplay.textContent = file.name;
            } else {
                preview.innerHTML = '<span class="no-photo">📷</span>';
                if (fileNameDisplay) fileNameDisplay.textContent = '';
            }
        });
    }
});

})(); // End IIFE
