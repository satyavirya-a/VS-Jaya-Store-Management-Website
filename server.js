const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Gunakan ssl rejectUnauthorized false wajib untuk Supabase
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const initializeDB = async () => {
    try {
        await pool.query(`CREATE TABLE IF NOT EXISTS items (
            id SERIAL PRIMARY KEY,
            merek TEXT DEFAULT '-',
            jenis_produk TEXT NOT NULL,
            nama_produk TEXT NOT NULL,
            harga_dasar INTEGER DEFAULT 0,
            harga_jual INTEGER NOT NULL,
            stok INTEGER DEFAULT 0,
            image_url TEXT,
            spesifikasi TEXT
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS transactions (
            id SERIAL PRIMARY KEY,
            tipe_transaksi TEXT NOT NULL,
            total_transaksi INTEGER NOT NULL,
            tanggal TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )`);
        await pool.query(`CREATE TABLE IF NOT EXISTS transaction_details (
            id SERIAL PRIMARY KEY,
            transaction_id INTEGER REFERENCES transactions(id) ON DELETE CASCADE,
            item_id INTEGER REFERENCES items(id) ON DELETE CASCADE,
            jumlah INTEGER NOT NULL,
            harga_satuan INTEGER NOT NULL,
            keuntungan INTEGER DEFAULT 0
        )`);
        console.log("Connected to Supabase PostgreSQL.");
    } catch (err) {
        console.error("Failed to connect to DB:", err.message);
    }
};

initializeDB();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}
app.use('/uploads', express.static(uploadDir));

const storage = multer.diskStorage({
    destination: function (req, file, cb) { cb(null, uploadDir) },
    filename: function (req, file, cb) { cb(null, Date.now() + path.extname(file.originalname)) }
});
const upload = multer({ storage: storage });

// Helper Query (PostgreSQL pool.query)
const runQuery = async (text, params) => {
    return await pool.query(text, params);
};

// API: Items
app.get('/api/items', async (req, res) => {
    try {
        const result = await runQuery('SELECT * FROM items ORDER BY id DESC');
        res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/items/lowstock', async (req, res) => {
    try {
        const result = await runQuery('SELECT * FROM items WHERE stok <= 3 ORDER BY stok ASC');
        res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.post('/api/items', upload.single('image'), async (req, res) => {
    const { nama_produk, jenis_produk, merek, harga_dasar, harga_jual, stok, spesifikasi } = req.body;
    const imageUrl = req.file ? '/uploads/' + req.file.filename : null;
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const q = `INSERT INTO items (nama_produk, jenis_produk, merek, harga_dasar, harga_jual, stok, image_url, spesifikasi) 
                   VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING id`;
        const resItem = await client.query(q, [nama_produk, jenis_produk, merek || '-', parseInt(harga_dasar)||0, parseInt(harga_jual)||0, parseInt(stok)||0, imageUrl, spesifikasi || '{}']);
        const itemId = resItem.rows[0].id;
        
        const txQ = `INSERT INTO transactions (tipe_transaksi, total_transaksi) VALUES ('PEMBELIAN', $1) RETURNING id`;
        const txRes = await client.query(txQ, [(parseInt(harga_dasar)||0) * (parseInt(stok)||0)]);
        const txId = txRes.rows[0].id;
        
        await client.query(`INSERT INTO transaction_details (transaction_id, item_id, jumlah, harga_satuan, keuntungan) VALUES ($1, $2, $3, $4, 0)`, 
        [txId, itemId, parseInt(stok)||0, parseInt(harga_dasar)||0]);
        
        await client.query('COMMIT');
        res.json({ id: itemId });
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.post('/api/items/bulk', async (req, res) => {
    const items = req.body; 
    if (!Array.isArray(items)) return res.status(400).json({ error: "Invalid data format" });

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let count = 0;
        
        for(let item of items) {
            let n = item['Nama Produk'] || item.nama_produk || item.nama || 'Barang Tanpa Nama';
            if(item['Keterangan']) n += ' - ' + item['Keterangan'];
            const jenis = item['Jenis Produk'] || item.jenis_produk || item.kategori || 'Lainnya';
            const m = item['Merek'] || item.merek || item.merk || '-';
            const dasar = parseInt(item['Harga Dasar'] || item.harga_dasar || item['Harga Beli'] || item.harga_beli || 0) || 0;
            const jual = parseInt(item['Harga Jual'] || item.harga_jual || 0) || 0;
            const s = parseInt(item['Stok'] || item.stok || 0) || 0;

            let specs = {};
            const standardKeys = ['Nama Produk', 'nama_produk', 'nama', 'Jenis Produk', 'jenis_produk', 'kategori', 'Merek', 'merek', 'merk', 'Harga Dasar', 'harga_dasar', 'harga_beli', 'Harga Beli', 'Harga Jual', 'harga_jual', 'Stok', 'stok', 'Keterangan', '__rowNum__'];
            for(let key in item) {
                if(!standardKeys.includes(key) && item[key]) specs[key] = item[key];
            }
            
            const q = `INSERT INTO items (nama_produk, jenis_produk, merek, harga_dasar, harga_jual, stok, spesifikasi) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`;
            const resItem = await client.query(q, [n, jenis, m, dasar, jual, s, JSON.stringify(specs)]);
            const itemId = resItem.rows[0].id;
            
            const txRes = await client.query(`INSERT INTO transactions (tipe_transaksi, total_transaksi) VALUES ('PEMBELIAN', $1) RETURNING id`, [dasar * s]);
            await client.query(`INSERT INTO transaction_details (transaction_id, item_id, jumlah, harga_satuan, keuntungan) VALUES ($1, $2, $3, $4, 0)`, [txRes.rows[0].id, itemId, s, dasar]);
            count++;
        }
        await client.query('COMMIT');
        res.json({ success: true, count: count });
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.put('/api/items/:id', upload.single('image'), async (req, res) => {
    const { id } = req.params;
    const { nama_produk, jenis_produk, merek, harga_dasar, harga_jual, stok, spesifikasi } = req.body;
    try {
        if (req.file) {
            const imageUrl = '/uploads/' + req.file.filename;
            const q = `UPDATE items SET nama_produk=$1, jenis_produk=$2, merek=$3, harga_dasar=$4, harga_jual=$5, stok=$6, image_url=$7, spesifikasi=$8 WHERE id=$9`;
            await pool.query(q, [nama_produk, jenis_produk, merek, parseInt(harga_dasar)||0, parseInt(harga_jual)||0, parseInt(stok)||0, imageUrl, spesifikasi || '{}', id]);
        } else {
            const q = `UPDATE items SET nama_produk=$1, jenis_produk=$2, merek=$3, harga_dasar=$4, harga_jual=$5, stok=$6, spesifikasi=$7 WHERE id=$8`;
            await pool.query(q, [nama_produk, jenis_produk, merek, parseInt(harga_dasar)||0, parseInt(harga_jual)||0, parseInt(stok)||0, spesifikasi || '{}', id]);
        }
        res.json({ updated: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.delete('/api/items/:id', async (req, res) => {
    try {
        await pool.query("DELETE FROM items WHERE id=$1", [req.params.id]);
        res.json({ deleted: true });
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// APIs: Transactions
app.post('/api/transactions', async (req, res) => {
    const { tipe_transaksi, total_transaksi, items, tanggal } = req.body;
    let tanggalFormatted = tanggal ? tanggal.replace('T', ' ') + ':00' : new Date().toISOString().replace('T', ' ').substring(0, 19);
    
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const txRes = await client.query(`INSERT INTO transactions (tipe_transaksi, total_transaksi, tanggal) VALUES ($1, $2, $3) RETURNING id`, 
            [tipe_transaksi, parseInt(total_transaksi)||0, tanggalFormatted]);
        const txId = txRes.rows[0].id;
        
        for(let item of items) {
            let k = 0, sc = 0;
            if (tipe_transaksi === 'PENJUALAN') {
                k = (item.harga_satuan - item.harga_dasar_saat_ini) * item.jumlah;
                sc = -item.jumlah;
                await client.query(`INSERT INTO transaction_details (transaction_id, item_id, jumlah, harga_satuan, keuntungan) VALUES ($1, $2, $3, $4, $5)`, [txId, item.item_id, item.jumlah, item.harga_satuan, k]);
                await client.query(`UPDATE items SET stok = stok + $1 WHERE id = $2`, [sc, item.item_id]);
            } else if (tipe_transaksi === 'PEMBELIAN') {
                sc = item.jumlah;
                await client.query(`INSERT INTO transaction_details (transaction_id, item_id, jumlah, harga_satuan, keuntungan) VALUES ($1, $2, $3, $4, 0)`, [txId, item.item_id, item.jumlah, item.harga_satuan]);
                await client.query(`UPDATE items SET stok = stok + $1, harga_dasar = $2 WHERE id = $3`, [sc, item.harga_satuan, item.item_id]);
            }
        }
        await client.query('COMMIT');
        res.json({ success: true, transaction_id: txId });
    } catch(err) {
        await client.query('ROLLBACK');
        res.status(500).json({ error: err.message });
    } finally { client.release(); }
});

app.get('/api/transactions', async (req, res) => {
    const { start, end } = req.query;
    try {
        let result;
        if (start && end) {
            result = await pool.query("SELECT * FROM transactions WHERE DATE(tanggal) >= $1 AND DATE(tanggal) <= $2 ORDER BY tanggal DESC", [start, end]);
        } else {
            // Postgres local time equivalent (if timezone set)
            result = await pool.query("SELECT * FROM transactions WHERE DATE(tanggal) = CURRENT_DATE ORDER BY tanggal DESC");
        }
        res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/transactions/:id', async (req, res) => {
    try {
        const result = await pool.query(`SELECT td.*, i.nama_produk, i.merek 
            FROM transaction_details td JOIN items i ON td.item_id = i.id WHERE td.transaction_id = $1`, [req.params.id]);
        res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.get('/api/items/:id/history', async (req, res) => {
    try {
        const result = await pool.query(`SELECT td.harga_satuan as harga_beli, td.jumlah, t.tanggal 
            FROM transaction_details td JOIN transactions t ON td.transaction_id = t.id 
            WHERE td.item_id = $1 AND t.tipe_transaksi = 'PEMBELIAN' ORDER BY t.tanggal DESC`, [req.params.id]);
        res.json(result.rows);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

// Dashboard
app.get('/api/dashboard', async (req, res) => {
    const { start, end } = req.query;
    try {
        const results = { profitHariIni:0, pemasukanHariIni:0, profitBulanIni:0, pemasukanBulanIni:0, profitFilter:0, pemasukanFilter:0 };
        
        let hp = await pool.query(`SELECT SUM(keuntungan) as total FROM transaction_details td JOIN transactions t ON td.transaction_id = t.id WHERE t.tipe_transaksi='PENJUALAN' AND DATE(t.tanggal) = CURRENT_DATE`);
        results.profitHariIni = hp.rows[0].total || 0;
        
        let hm = await pool.query(`SELECT SUM(total_transaksi) as total FROM transactions t WHERE t.tipe_transaksi='PENJUALAN' AND DATE(t.tanggal) = CURRENT_DATE`);
        results.pemasukanHariIni = hm.rows[0].total || 0;
        
        let bmp = await pool.query(`SELECT SUM(keuntungan) as total FROM transaction_details td JOIN transactions t ON td.transaction_id = t.id WHERE t.tipe_transaksi='PENJUALAN' AND EXTRACT(MONTH FROM t.tanggal) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM t.tanggal) = EXTRACT(YEAR FROM CURRENT_DATE)`);
        results.profitBulanIni = bmp.rows[0].total || 0;
        
        let bm = await pool.query(`SELECT SUM(total_transaksi) as total FROM transactions t WHERE t.tipe_transaksi='PENJUALAN' AND EXTRACT(MONTH FROM t.tanggal) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM t.tanggal) = EXTRACT(YEAR FROM CURRENT_DATE)`);
        results.pemasukanBulanIni = bm.rows[0].total || 0;

        if (start && end) {
            let fp = await pool.query(`SELECT SUM(keuntungan) as total FROM transaction_details td JOIN transactions t ON td.transaction_id = t.id WHERE t.tipe_transaksi='PENJUALAN' AND DATE(t.tanggal) >= $1 AND DATE(t.tanggal) <= $2`, [start, end]);
            results.profitFilter = fp.rows[0].total || 0;
            
            let fm = await pool.query(`SELECT SUM(total_transaksi) as total FROM transactions t WHERE t.tipe_transaksi='PENJUALAN' AND DATE(t.tanggal) >= $1 AND DATE(t.tanggal) <= $2`, [start, end]);
            results.pemasukanFilter = fm.rows[0].total || 0;
        }

        res.json(results);
    } catch(err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
