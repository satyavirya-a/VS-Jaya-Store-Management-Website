const sqlite3 = require('sqlite3'); 
const db = new sqlite3.Database('inventory.db'); 
db.run("ALTER TABLE items ADD COLUMN spesifikasi TEXT DEFAULT '{}'", (err) => {
    if(err) console.log(err.message);
    else console.log("OK");
});
db.close();
