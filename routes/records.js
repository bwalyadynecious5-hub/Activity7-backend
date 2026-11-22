const router = require("express").Router();
const pool = require("../db");

const STATUSES = ["Pending", "In progress", "Completed"];
const MAX_ID = 2147483647; // largest value the database id column can hold
const COLUMNS = "id, title, category, description, status";

// Returns the id as a number, or null after sending an error response.
function readId(req, res) {
  if (!/^[1-9]\d*$/.test(req.params.id)) {
    res.status(400).json({ message: "Id must be a positive whole number." });
    return null;
  }
  const id = Number(req.params.id);
  if (id > MAX_ID) {
    res.status(404).json({ message: "Record not found." });
    return null;
  }
  return id;
}

// Checks types first, then trims, then checks lengths and status.
function validateBody(body) {
  const source = body && typeof body === "object" ? body : {};
  const rules = [
    ["title", "Title", 3, 80],
    ["category", "Category", 2, 40],
    ["description", "Description", 5, 300]
  ];
  const values = {};

  for (const [key, label, min, max] of rules) {
    const raw = source[key];
    if (typeof raw !== "string") {
      return { error: `${label} is required and must be a string.` };
    }
    const value = raw.trim();
    if (value.length < min || value.length > max) {
      return { error: `${label} must have ${min} to ${max} characters.` };
    }
    values[key] = value;
  }

  if (typeof source.status !== "string") {
    return { error: "Status is required and must be a string." };
  }
  const status = source.status.trim();
  if (!STATUSES.includes(status)) {
    return { error: "Status must be Pending, In progress or Completed." };
  }
  values.status = status;

  return { values }; // any client-supplied id is ignored
}

router.get("/", async (req, res, next) => {
  try {
    const result = await pool.query(`SELECT ${COLUMNS} FROM records ORDER BY id`);
    res.status(200).json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const id = readId(req, res);
    if (id === null) return;
    const result = await pool.query(`SELECT ${COLUMNS} FROM records WHERE id = $1`, [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found." });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/", async (req, res, next) => {
  try {
    const { error, values } = validateBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const result = await pool.query(
      `INSERT INTO records (title, category, description, status)
       VALUES ($1, $2, $3, $4) RETURNING ${COLUMNS}`,
      [values.title, values.category, values.description, values.status]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.put("/:id", async (req, res, next) => {
  try {
    const id = readId(req, res);
    if (id === null) return;
    const { error, values } = validateBody(req.body);
    if (error) return res.status(400).json({ message: error });
    const result = await pool.query(
      `UPDATE records
       SET title = $1, category = $2, description = $3, status = $4
       WHERE id = $5 RETURNING ${COLUMNS}`,
      [values.title, values.category, values.description, values.status, id]
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found." });
    }
    res.status(200).json(result.rows[0]);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    const id = readId(req, res);
    if (id === null) return;
    const result = await pool.query("DELETE FROM records WHERE id = $1 RETURNING id", [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Record not found." });
    }
    res.status(200).json({ message: "Record deleted." });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
