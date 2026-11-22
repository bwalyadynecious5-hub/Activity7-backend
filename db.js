const fs = require("fs");
const path = require("path");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
const isLocal = !connectionString || /localhost|127\.0\.0\.1/.test(connectionString);

const pool = new Pool({
  connectionString,
  // Hosted databases (Render, Neon, etc.) need SSL. A local database does not.
  ssl: isLocal ? false : { rejectUnauthorized: false }
});

// Creates the table if it is missing, and inserts the starting records
// only when the table is created for the first time.
async function initDb() {
  const check = await pool.query("SELECT to_regclass('public.records') AS name");
  const firstTime = check.rows[0].name === null;

  const schema = fs.readFileSync(path.join(__dirname, "schema.sql"), "utf8");
  await pool.query(schema);

  if (firstTime) {
    const seed = fs.readFileSync(path.join(__dirname, "seed.sql"), "utf8");
    await pool.query(seed);
    console.log("Database created and starting records inserted.");
  }
}

module.exports = pool;
module.exports.initDb = initDb;
