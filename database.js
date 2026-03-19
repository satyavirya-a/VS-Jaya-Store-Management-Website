const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.resolve(__dirname, 'inventory.db');
const db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
        console.error('Error connecting to database:', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        initDb();
    }
});

function initDb() {
    // Teks query untuk membuat tabel-tabel
    const createItemsTable = `
        CREATE TABLE IF NOT EXISTS items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            merek TEXT,
            jenis_produk TEXT NOT NULL,
            nama_produk TEXT NOT NULL,
            harga_dasar INTEGER DEFAULT 0,
            harga_jual INTEGER DEFAULT 0,
            stok INTEGER DEFAULT 0,
            image_url TEXT,
            spesifikasi TEXT DEFAULT '{}'
        )
    `;

    const createTransactionsTable = `
        CREATE TABLE IF NOT EXISTS transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipe_transaksi TEXT CHECK(tipe_transaksi IN ('PENJUALAN', 'PEMBELIAN')) NOT NULL,
            tanggal DATETIME DEFAULT CURRENT_TIMESTAMP,
            total_transaksi INTEGER DEFAULT 0
        )
    `;

    const createTransactionDetailsTable = `
        CREATE TABLE IF NOT EXISTS transaction_details (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            transaction_id INTEGER,
            item_id INTEGER,
            jumlah INTEGER NOT NULL,
            harga_satuan INTEGER NOT NULL,
            keuntungan INTEGER DEFAULT 0,
            FOREIGN KEY (transaction_id) REFERENCES transactions (id),
            FOREIGN KEY (item_id) REFERENCES items (id)
        )
    `;

    db.serialize(() => {
        db.run(createItemsTable);
        db.run(createTransactionsTable);
        db.run(createTransactionDetailsTable);
    });
}

module.exports = db;
