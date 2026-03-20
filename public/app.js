// Global State
let items = [];
let transactions = [];
let txCart = [];

// DOM Elements
const views = document.querySelectorAll('.view');
const navLinks = document.querySelectorAll('.nav-links li');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    loadDashboard();
    loadItems();
    
    // Navigation
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            const target = e.currentTarget.dataset.target;
            navLinks.forEach(l => l.classList.remove('active'));
            e.currentTarget.classList.add('active');
            
            views.forEach(v => v.classList.remove('active-view'));
            document.getElementById(target).classList.add('active-view');
        });
    });

    document.getElementById('btn-search').addEventListener('click', () => {
        const query = document.getElementById('global-search').value;
        const itemsTab = document.querySelector('li[data-target="items"]');
        itemsTab.click();
        const filteredList = items.filter(i => i.nama_produk.toLowerCase().includes(query.toLowerCase()));
        renderItems(filteredList); 
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
        });
    });

    // Items
    document.getElementById('btn-toggle-kategori').addEventListener('click', (e) => {
        const selCat = document.getElementById('item-kategori');
        const inpCat = document.getElementById('item-kategori-baru');
        const btn = e.target;
        if(inpCat.style.display === 'none') {
            selCat.style.display = 'none';
            inpCat.style.display = 'block';
            inpCat.required = true;
            selCat.required = false;
            btn.textContent = 'Kembali';
            inpCat.focus();
        } else {
            selCat.style.display = 'block';
            inpCat.style.display = 'none';
            inpCat.required = false;
            selCat.required = true;
            btn.textContent = '+ Bebas';
        }
    });

    document.getElementById('btn-add-item').addEventListener('click', () => {
        document.getElementById('item-form').reset();
        document.getElementById('item-id').value = '';
        document.getElementById('item-modal').dataset.specs = '{}';
        
        // Reset to dropdown view if text view is active
        if(document.getElementById('item-kategori-baru').style.display === 'block') {
            document.getElementById('btn-toggle-kategori').click();
        }

        document.getElementById('item-kategori').dispatchEvent(new Event('change'));
        document.getElementById('item-modal-title').textContent = 'Tambah Barang Baru';
        document.getElementById('item-modal').classList.add('active');
    });

    document.getElementById('import-file').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            const data = new Uint8Array(e.target.result);
            const workbook = XLSX.read(data, {type: 'array'});
            
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            
            // Smart Header Detection: Skip empty rows at the top
            let jsonRaw = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
            let startRow = 0;
            for(let i=0; i < jsonRaw.length; i++) {
                let rowStr = jsonRaw[i].join('').toLowerCase();
                if(rowStr.includes('nama') || rowStr.includes('produk') || rowStr.includes('merek')) {
                    startRow = i;
                    break;
                }
            }
            
            if (worksheet['!ref']) {
                const range = XLSX.utils.decode_range(worksheet['!ref']);
                if (startRow > 0 && startRow <= range.e.r) {
                    range.s.r = startRow;
                    worksheet['!ref'] = XLSX.utils.encode_range(range);
                }
            }
            
            const jsonParams = XLSX.utils.sheet_to_json(worksheet);
            if(jsonParams.length === 0) {
                alert("File kosong atau format salah!");
                return;
            }

            if (confirm(`Ditemukan ${jsonParams.length} baris data. Lanjutkan mengimpor?`)) {
                fetch('/api/items/bulk', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(jsonParams)
                })
                .then(res => res.json())
                .then(data => {
                    if(data.success) {
                        alert(`Berhasil mengimpor ${data.count} barang!`);
                        loadItems();
                        loadDashboard();
                    } else alert("Gagal mengimpor data.");
                }).catch(err => console.error(err));
            }
            document.getElementById('import-file').value = '';
        };
        reader.readAsArrayBuffer(file);
    });

    document.getElementById('item-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const btnSubmit = e.target.querySelector('button[type="submit"]');
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = 'Menyimpan...';
        btnSubmit.disabled = true;

        const catVal = document.getElementById('item-kategori-baru').style.display === 'block' 
            ? document.getElementById('item-kategori-baru').value 
            : document.getElementById('item-kategori').value;

        const id = document.getElementById('item-id').value;
        const formData = new FormData();
        formData.append('nama_produk', document.getElementById('item-nama').value);
        formData.append('jenis_produk', catVal);
        formData.append('merek', document.getElementById('item-merk').value);
        formData.append('harga_dasar', document.getElementById('item-harga-beli').value);
        formData.append('harga_jual', document.getElementById('item-harga-jual').value);
        formData.append('stok', document.getElementById('item-stok').value);
        
        let specs = {};
        document.querySelectorAll('.dynamic-spec-input').forEach(input => {
            if(input.value.trim() !== '') specs[input.dataset.key] = input.value.trim();
        });
        formData.append('spesifikasi', JSON.stringify(specs));

        const fileInput = document.getElementById('item-image');
        if (fileInput.files.length > 0) {
            try {
                const compressedFile = await compressImage(fileInput.files[0]);
                formData.append('image', compressedFile);
            } catch (err) {
                console.error("Gagal kompresi, menggunakan file asli", err);
                formData.append('image', fileInput.files[0]);
            }
        }

        const url = id ? `/api/items/${id}` : '/api/items';
        const method = id ? 'PUT' : 'POST';

        try {
            const res = await fetch(url, { method, body: formData });
            if (res.ok) {
                document.getElementById('item-modal').classList.remove('active');
                loadItems();
                loadDashboard();
                alert("Barang berhasil disimpan!");
            } else {
                alert("Gagal menyimpan barang");
            }
        } catch(err) { 
            console.error(err);
            alert("Kesalahan jaringan: Terjadi masalah koneksi atau file foto terlalu besar.");
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });

    function applyItemFilters() {
        const cat = document.getElementById('filter-category').value;
        const sort = document.getElementById('sort-items').value;
        let filtered = cat ? items.filter(i => i.jenis_produk === cat) : [...items];
        
        if (sort === 'stock-asc') {
            filtered.sort((a,b) => a.stok - b.stok);
        } else if (sort === 'stock-desc') {
            filtered.sort((a,b) => b.stok - a.stok);
        } else {
            filtered.sort((a,b) => b.id - a.id);
        }
        renderItems(filtered);
    }
    document.getElementById('filter-category').addEventListener('change', applyItemFilters);
    document.getElementById('sort-items').addEventListener('change', applyItemFilters);

    // Transactions Modals
    document.getElementById('btn-new-sale').addEventListener('click', () => openTxModal('PENJUALAN'));
    document.getElementById('btn-new-purchase').addEventListener('click', () => openTxModal('PEMBELIAN'));

    document.getElementById('tx-item-search').addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) {
            document.getElementById('tx-search-results').innerHTML = ''; return;
        }
        const results = items.filter(i => i.nama_produk.toLowerCase().includes(query) || (i.merek && i.merek.toLowerCase().includes(query)));
        renderTxSearchResults(results);
    });

    document.getElementById('btn-submit-tx').addEventListener('click', async (e) => {
        if (txCart.length === 0) return alert('Keranjang kosong!');
        
        const btnSubmit = e.target;
        const originalText = btnSubmit.textContent;
        btnSubmit.textContent = 'Memproses...';
        btnSubmit.disabled = true;

        const tipe = document.getElementById('tx-type').value;
        const tanggal = document.getElementById('tx-date').value;
        const total = txCart.reduce((sum, item) => sum + (item.qty * item.harga_input), 0);

        const payload = {
            tipe_transaksi: tipe,
            total_transaksi: total,
            tanggal: tanggal,
            items: txCart.map(i => ({
                item_id: i.id,
                jumlah: i.qty,
                harga_satuan: i.harga_input,
                harga_dasar_saat_ini: i.original.harga_dasar
            }))
        };

        try {
            const res = await fetch('/api/transactions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });
            if (res.ok) {
                document.getElementById('tx-modal').classList.remove('active');
                document.getElementById('btn-filter-txlist').click(); 
                loadDashboard();
                loadItems();
                alert('Transaksi berhasil disimpan!');
            } else {
                alert('Gagal menyimpan transaksi');
            }
        } catch (e) { 
            console.error(e);
            alert('Kesalahan jaringan saat memproses transaksi.');
        } finally {
            btnSubmit.textContent = originalText;
            btnSubmit.disabled = false;
        }
    });

    // Dashboard Filter
    document.getElementById('btn-filter-dash').addEventListener('click', () => {
        const start = document.getElementById('dash-start').value;
        const end = document.getElementById('dash-end').value;
        loadDashboard(start, end);
    });

    // Transaction History Filters 
    const todayObj = new Date();
    todayObj.setMinutes(todayObj.getMinutes() - todayObj.getTimezoneOffset());
    const localStr = todayObj.toISOString().split('T')[0];
    
    document.getElementById('txlist-start').value = localStr;
    document.getElementById('txlist-end').value = localStr;
    
    document.getElementById('btn-filter-txlist').addEventListener('click', () => {
        const start = document.getElementById('txlist-start').value;
        const end = document.getElementById('txlist-end').value;
        loadTransactions(start, end);
    });
    
    // Load default history
    document.getElementById('btn-filter-txlist').click();
});

// API Calls
async function loadDashboard(start='', end='') {
    try {
        let url = '/api/dashboard';
        if(start && end) url += `?start=${start}&end=${end}`;
        
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
            console.error("Dashboard Error:", data.error);
            return;
        }
        
        document.getElementById('dash-income-today').textContent = formatRp(data.pemasukanHariIni);
        document.getElementById('dash-profit-today').textContent = formatRp(data.profitHariIni);
        document.getElementById('dash-income-month').textContent = formatRp(data.pemasukanBulanIni);
        document.getElementById('dash-profit-month').textContent = formatRp(data.profitBulanIni);

        if(start && end) {
            document.getElementById('custom-filter-results').style.display = 'grid';
            document.getElementById('dash-income-filter').textContent = formatRp(data.pemasukanFilter);
            document.getElementById('dash-profit-filter').textContent = formatRp(data.profitFilter);
        } else {
            document.getElementById('custom-filter-results').style.display = 'none';
        }
        
        const lowRes = await fetch('/api/items/lowstock');
        const lowData = await lowRes.json();
        const tbody = document.getElementById('low-stock-body');
        if (!lowRes.ok) {
            tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:red;">Error: DB/Vercel ${lowData.error || 'Server error'}</td></tr>`;
            return;
        }
        tbody.innerHTML = '';
        if(lowData.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;">Stok semua barang aman!</td></tr>';
        } else {
            lowData.forEach(item => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.nama_produk}</td>
                    <td>${item.merek || '-'}</td>
                    <td>${formatRp(item.harga_dasar)}</td>
                    <td><strong style="color:var(--danger);">${item.stok}</strong></td>
                `;
                tbody.appendChild(tr);
            });
        }
    } catch(e) { console.error(e); }
}

async function loadItems() {
    try {
        const res = await fetch('/api/items');
        const data = await res.json();
        if (!res.ok) {
            alert(`Gagal memuat barang dari server. Jika di Vercel, pastikan DATABASE_URL sudah di-setting. Pesan error: ${data.error}`);
            items = [];
            document.getElementById('sort-items').dispatchEvent(new Event('change'));
            return;
        }
        items = data;
        updateCategoryDropdowns();
        document.getElementById('sort-items').dispatchEvent(new Event('change'));
    } catch(e) { console.error(e); items = []; }
}

function updateCategoryDropdowns() {
    const defaultCats = ['Lampu', 'Stop Kontak', 'Steker', 'Kabel', 'Lainnya'];
    const dbCats = items.map(i => i.jenis_produk);
    const allCats = [...new Set([...defaultCats, ...dbCats])].filter(Boolean);

    // Update Filter Select
    const filterSelect = document.getElementById('filter-category');
    const currentFilter = filterSelect.value;
    filterSelect.innerHTML = '<option value="">Semua Jenis Produk</option>';
    allCats.forEach(c => filterSelect.innerHTML += `<option value="${c}">${c}</option>`);
    filterSelect.value = currentFilter;

    // Update Form Select
    const formSelect = document.getElementById('item-kategori');
    const currentSelected = formSelect.value;
    formSelect.innerHTML = '';
    allCats.forEach(c => formSelect.innerHTML += `<option value="${c}">${c}</option>`);
    if(currentSelected && allCats.includes(currentSelected)) formSelect.value = currentSelected;
}

async function loadTransactions(start='', end='') {
    try {
        let url = '/api/transactions';
        if(start && end) url += `?start=${start}&end=${end}`;
        const res = await fetch(url);
        const data = await res.json();
        if (!res.ok) {
            console.error("Tx Error:", data.error);
            transactions = [];
            return renderTransactions(transactions);
        }
        transactions = data;
        renderTransactions(transactions);
    } catch(e) { console.error(e); transactions = []; }
}

// Render Functions
function renderItems(data) {
    const tbody = document.getElementById('items-table-body');
    tbody.innerHTML = '';
    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><img src="${item.image_url || 'https://via.placeholder.com/50'}" class="item-img" alt="Gambar"></td>
            <td>${item.nama_produk}</td>
            <td>${item.jenis_produk}</td>
            <td>${item.merek || '-'}</td>
            <td><strong>${item.stok}</strong></td>
            <td>${formatRp(item.harga_dasar)}</td>
            <td>${formatRp(item.harga_jual)}</td>
            <td>
                <button class="btn-icon text-primary" title="Edit Item" onclick='editItem(${JSON.stringify(item)})'>✏️</button>
                <button class="btn-icon text-secondary" title="Histori Pembelian" onclick='openItemHistory(${item.id})'>🕒</button>
                <button class="btn-icon text-danger" title="Hapus Item" onclick='deleteItem(${item.id})'>🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function renderTransactions(data) {
    const tbody = document.getElementById('transactions-table-body');
    tbody.innerHTML = '';
    data.forEach(tx => {
        const tr = document.createElement('tr');
        const isSales = tx.tipe_transaksi === 'PENJUALAN';
        tr.innerHTML = `
            <td>#TX-${tx.id.toString().padStart(4, '0')}</td>
            <td>${new Date(tx.tanggal).toLocaleString('id-ID')}</td>
            <td><strong style="color: ${isSales ? 'var(--success)' : 'var(--primary)'}">${tx.tipe_transaksi}</strong></td>
            <td><strong>${formatRp(tx.total_transaksi)}</strong></td>
            <td>
                <button class="btn-secondary" style="padding:4px 8px; font-size:0.8rem;" onclick="openTxDetail(${tx.id})">Detail</button>
                <button class="btn-danger" style="padding:4px 8px; font-size:0.8rem; margin-left:4px;" onclick="deleteTransaction(${tx.id})">Batal</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Actions
window.editItem = function(item) {
    document.getElementById('item-id').value = item.id;
    document.getElementById('item-nama').value = item.nama_produk;
    document.getElementById('item-kategori').value = item.jenis_produk;
    document.getElementById('item-merk').value = item.merek || '';
    document.getElementById('item-harga-beli').value = item.harga_dasar;
    document.getElementById('item-harga-jual').value = item.harga_jual;
    document.getElementById('item-stok').value = item.stok;
    document.getElementById('item-modal').dataset.specs = item.spesifikasi || '{}';
    document.getElementById('item-kategori').dispatchEvent(new Event('change'));
    document.getElementById('item-modal-title').textContent = 'Edit Barang';
    document.getElementById('item-modal').classList.add('active');
}

window.deleteItem = async function(id) {
    if(confirm('Apakah Anda yakin ingin menghapus barang ini?')) {
        await fetch(`/api/items/${id}`, { method: 'DELETE' });
        loadItems();
        loadDashboard();
    }
}

window.openItemHistory = async function(id) {
    try {
        const res = await fetch(`/api/items/${id}/history`);
        const history = await res.json();
        const tbody = document.getElementById('item-history-body');
        tbody.innerHTML = '';
        if(history.length === 0) tbody.innerHTML = '<tr><td colspan="3">Belum ada histori pembelian untuk barang ini.</td></tr>';
        
        history.forEach(h => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${new Date(h.tanggal).toLocaleString('id-ID')}</td>
                <td>${h.jumlah}</td>
                <td>${formatRp(h.harga_beli)}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('item-history-modal').classList.add('active');
    } catch(e) { console.error(e); }
}

window.openTxDetail = async function(txId) {
    try {
        const res = await fetch(`/api/transactions/${txId}`);
        const details = await res.json();
        const tbody = document.getElementById('tx-detail-body');
        tbody.innerHTML = '';
        document.getElementById('tx-detail-title').textContent = `Detail Transaksi #TX-${txId.toString().padStart(4, '0')}`;
        
        details.forEach(d => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${d.nama_produk}</td>
                <td>${d.merek || '-'}</td>
                <td>${d.jumlah}</td>
                <td>${formatRp(d.harga_satuan)}</td>
                <td class="${d.keuntungan > 0 ? 'text-success' : ''}">${formatRp(d.keuntungan)}</td>
            `;
            tbody.appendChild(tr);
        });
        document.getElementById('tx-detail-modal').classList.add('active');
    } catch(e) { console.error(e); }
}

window.deleteTransaction = async function(id) {
    if(!confirm(`PERINGATAN! Anda yakin ingin MEMBATALKAN transaksi #TX-${id.toString().padStart(4, '0')}?\n\nStok barang akan otomatis dikembalikan ke status semula.`)) return;
    
    try {
        const res = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
        const data = await res.json();
        
        if (res.ok && data.success) {
            alert('Transaksi berhasil dibatalkan dan stok telah disesuaikan.');
            const start = document.getElementById('txlist-start').value;
            const end = document.getElementById('txlist-end').value;
            loadTransactions(start, end);
            loadDashboard(start, end);
            loadItems(); 
        } else {
            alert('Gagal membatalkan transaksi: ' + (data.error || 'Server error'));
        }
    } catch (e) {
        console.error(e);
        alert('Kesalahan jaringan saat membatalkan transaksi.');
    }
}

// Transaction Cart
function openTxModal(type) {
    txCart = [];
    document.getElementById('tx-type').value = type;
    
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    document.getElementById('tx-date').value = now.toISOString().slice(0, 16);
    
    document.getElementById('tx-modal-title').textContent = type === 'PENJUALAN' ? 'Catat Penjualan' : 'Restock / Beli Barang';
    document.getElementById('tx-item-search').value = '';
    document.getElementById('tx-search-results').innerHTML = '';
    renderCart();
    document.getElementById('tx-modal').classList.add('active');
}

function renderTxSearchResults(results) {
    const container = document.getElementById('tx-search-results');
    container.innerHTML = '';
    
    results.forEach(item => {
        const div = document.createElement('div');
        div.className = 'tx-item-card';
        const merekText = (item.merek && item.merek !== '-') ? `${item.merek} - ` : '';
        div.innerHTML = `
            <div>
                <strong>${merekText}${item.nama_produk}</strong><br>
                <small>Stok: ${item.stok} | Harga Beli: ${formatRp(item.harga_dasar)} | Harga Jual: ${formatRp(item.harga_jual)}</small>
            </div>
            <button class="btn-primary" style="padding: 5px 10px;" onclick='addToCart(${item.id})'>+</button>
        `;
        container.appendChild(div);
    });
}

window.addToCart = function(id) {
    const item = items.find(i => i.id === id);
    const tipe = document.getElementById('tx-type').value;
    const existing = txCart.find(c => c.id === id);
    const defaultPrice = tipe === 'PENJUALAN' ? item.harga_jual : item.harga_dasar;
    
    if (existing) {
        existing.qty++;
    } else {
        const merekText = (item.merek && item.merek !== '-') ? `${item.merek} - ` : '';
        txCart.push({
            id: item.id,
            nama_produk: merekText + item.nama_produk,
            harga_dasar: item.harga_dasar,
            harga_jual: item.harga_jual,
            harga_input: defaultPrice,
            qty: 1,
            original: item
        });
    }
    renderCart();
}

window.updateQty = function(id, qty) {
    const item = txCart.find(c => c.id === id);
    if (item) {
        item.qty = parseInt(qty) || 1;
        renderCart();
    }
}

window.updatePrice = function(id, price) {
    const item = txCart.find(c => c.id === id);
    if (item) {
        item.harga_input = parseInt(price) || 0;
        renderCart();
    }
}

window.removeFromCart = function(id) {
    txCart = txCart.filter(c => c.id !== id);
    renderCart();
}

function renderCart() {
    const tbody = document.getElementById('tx-cart-body');
    tbody.innerHTML = '';
    let total = 0;
    
    txCart.forEach(item => {
        const subtotal = item.harga_input * item.qty;
        total += subtotal;
        
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.nama_produk} <div style="font-size:0.75rem; color:#64748b; margin-top:3px;">Ref: Beli ${formatRp(item.harga_dasar)} | Jual ${formatRp(item.harga_jual)}</div></td>
            <td><input type="number" value="${item.harga_input}" onchange="updatePrice(${item.id}, this.value)" style="width:100px; padding:5px;"></td>
            <td><input type="number" min="1" value="${item.qty}" onchange="updateQty(${item.id}, this.value)" style="width:60px; padding:5px;"></td>
            <td>${formatRp(subtotal)}</td>
            <td><button class="btn-danger" style="padding:4px 8px;" onclick="removeFromCart(${item.id})">x</button></td>
        `;
        tbody.appendChild(tr);
    });
    
    document.getElementById('tx-total').textContent = formatRp(total);
}

// Utils
function formatRp(num) {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(num || 0);
}

function renderSpecs(specString) {
    if(!specString || specString === '{}') return '-';
    try {
        const specs = JSON.parse(specString);
        let tags = '';
        for(let key in specs) {
            tags += `<span style="background:#e2e8f0; font-size:0.75rem; padding:3px 6px; border-radius:4px; margin-right:4px;">${key}: ${specs[key]}</span>`;
        }
        return tags;
    } catch(e) { return specString; }
}

const specTemplates = {
    'Lampu': ['Watt', 'Warna Lampu'],
    'Kabel': ['Panjang (Meter)', 'Ukuran Kawat'],
    'Stop Kontak': ['Jumlah Lubang', 'Tipe Pemasangan'],
    'Steker': ['Model', 'Ampere'],
    'Lainnya': []
};

document.getElementById('item-kategori').addEventListener('change', (e) => {
    const modal = document.getElementById('item-modal');
    const defaultSpecs = modal.dataset.specs ? JSON.parse(modal.dataset.specs) : {};
    buildDynamicForm(e.target.value, defaultSpecs);
});

function buildDynamicForm(kategori, existingData = {}) {
    const container = document.getElementById('dynamic-specs-fields');
    const fields = specTemplates[kategori] || [];
    container.innerHTML = '';
    
    if(fields.length === 0 && Object.keys(existingData).length === 0) {
        container.innerHTML = '<span style="font-size:0.8rem;">Tidak ada spesifikasi khusus untuk kategori ini.</span>';
        return;
    }

    const allKeys = new Set([...fields, ...Object.keys(existingData)]);

    allKeys.forEach(field => {
        const val = existingData[field] || '';
        const group = document.createElement('div');
        group.className = 'form-group';
        group.innerHTML = `
            <label>${field}</label>
            <input type="text" class="dynamic-spec-input" data-key="${field}" value="${val}" placeholder="Opsional...">
        `;
        container.appendChild(group);
    });
}

// Helper: Compress Image Before Upload (Untuk mencegah Vercel Payload Limit ERR_CONNECTION_RESET)
async function compressImage(file, maxWidth = 800, maxHeight = 800, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = event => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                canvas.toBlob((blob) => {
                    resolve(new File([blob], file.name, {
                        type: file.type || 'image/jpeg',
                        lastModified: Date.now()
                    }));
                }, file.type || 'image/jpeg', quality);
            };
            img.onerror = error => reject(error);
        };
        reader.onerror = error => reject(error);
    });
}
