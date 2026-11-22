// Runs the Step 7 tests automatically. Needs Node 18 or newer.
// Usage: node test-api.js http://localhost:3000
const BASE = (process.argv[2] || "http://localhost:3000").replace(/\/$/, "");
const good = { title: "Test light", category: "Electrical", description: "Test description here.", status: "Pending" };
let passed = 0, failed = 0;

async function call(method, path, body, raw) {
  const options = { method, headers: { "Content-Type": "application/json" } };
  if (raw !== undefined) options.body = raw;
  else if (body !== undefined) options.body = JSON.stringify(body);
  const res = await fetch(BASE + path, options);
  let data = null;
  try { data = await res.json(); } catch { /* not JSON */ }
  return { status: res.status, data };
}

function check(name, condition, info) {
  if (condition) { passed++; console.log("PASS", name); }
  else { failed++; console.log("FAIL", name, info !== undefined ? JSON.stringify(info) : ""); }
}

(async () => {
  let r = await call("GET", "/health");
  check("GET /health returns 200", r.status === 200, r);

  r = await call("GET", "/api/records");
  check("GET /api/records returns 200 and an array", r.status === 200 && Array.isArray(r.data), r);
  const before = r.data.length;

  r = await call("POST", "/api/records", good);
  check("POST valid record returns 201 with id", r.status === 201 && Number.isInteger(r.data.id), r);
  const id = r.data && r.data.id;

  r = await call("GET", `/api/records/${id}`);
  check("GET one returns the created record", r.status === 200 && r.data.title === good.title, r);

  r = await call("PUT", `/api/records/${id}`, { ...good, title: "Changed title", status: "Completed" });
  check("PUT returns 200, new values, same id", r.status === 200 && r.data.id === id && r.data.status === "Completed", r);

  r = await call("POST", "/api/records", { ...good, id: 9999, title: "Id ignored test" });
  check("POST ignores client id", r.status === 201 && r.data.id !== 9999, r);
  const extraId = r.data && r.data.id;

  r = await call("DELETE", `/api/records/${id}`);
  check("DELETE returns 200 and message", r.status === 200 && r.data.message === "Record deleted.", r);
  if (extraId) await call("DELETE", `/api/records/${extraId}`);

  r = await call("GET", `/api/records/${id}`);
  check("GET deleted record returns 404", r.status === 404, r);

  r = await call("POST", "/api/records", { ...good, title: "" });
  check("POST missing title returns 400", r.status === 400 && r.data.message, r);
  r = await call("POST", "/api/records", { ...good, title: "   " });
  check("POST spaces-only title returns 400", r.status === 400, r);
  r = await call("POST", "/api/records", { ...good, status: "Done" });
  check("POST invalid status returns 400", r.status === 400, r);
  r = await call("POST", "/api/records", { ...good, title: 123 });
  check("POST non-string title returns 400", r.status === 400, r);

  r = await call("GET", "/api/records");
  check("No rows were created by invalid requests", r.data.length === before, { before, now: r.data.length });

  r = await call("GET", "/api/records/abc");
  check("GET invalid id returns 400", r.status === 400 && r.data.message, r);
  r = await call("POST", "/api/records", undefined, "{ bad json");
  check("Malformed JSON returns 400", r.status === 400 && r.data.message, r);

  r = await call("GET", "/api/records/999999");
  check("GET missing id returns 404", r.status === 404, r);
  r = await call("PUT", "/api/records/999999", good);
  check("PUT missing id returns 404", r.status === 404, r);
  r = await call("DELETE", "/api/records/999999");
  check("DELETE missing id returns 404", r.status === 404, r);

  r = await call("GET", "/nothing-here");
  check("Unknown route returns 404 JSON", r.status === 404 && r.data && r.data.message, r);

  console.log(`\n${passed} passed, ${failed} failed`);
  console.log("Manual test still needed: create a record, restart the server, and check it still exists.");
  process.exit(failed ? 1 : 0);
})();
