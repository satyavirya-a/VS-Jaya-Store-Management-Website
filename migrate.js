const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('inventory.db');

db.serialize(() => {
    console.log("Starting migration...");
    
    // Create new items table
    db.run(`CREATE TABLE IF NOT EXISTS items_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        merek TEXT,
        jenis_produk TEXT NOT NULL,
        nama_produk TEXT NOT NULL,
        harga_dasar INTEGER DEFAULT 0,
        harga_jual INTEGER DEFAULT 0,
        stok INTEGER DEFAULT 0,
        image_url TEXT,
        spesifikasi TEXT DEFAULT '{}'
    )`);

    // Note: If no data existed, it fails gracefully, but we just want to ensure items_new becomes items
    db.get("SELECT name FROM sqlite_master WHERE type='table' AND name='items'", [], (err, row) => {
        if(row) {
            db.run(`INSERT INTO items_new (id, nama_produk, jenis_produk, merek, harga_dasar, harga_jual, stok, image_url, spesifikasi)
                    SELECT id, nama, kategori, merk, harga_beli, harga_jual, stok, image_url, spesifikasi FROM items`, (err) => {
                db.run(`DROP TABLE items`);
                db.run(`ALTER TABLE items_new RENAME TO items`);
                console.log("Migration finished.");
            });
        } else {
            db.run(`ALTER TABLE items_new RENAME TO items`);
            console.log("Created fresh.");
        }
    });
});
