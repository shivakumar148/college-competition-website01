const http = require("http");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(ROOT, "data");
const DB_PATH = path.join(DATA_DIR, "db.json");
const SETTINGS_PATH = path.join(DATA_DIR, "settings.json");

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "admin@collegefest.local").toLowerCase();
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

const sessions = new Map();

const defaultSettings = {
  upiId: process.env.UPI_ID || "add-your-upi-id@bank",
  upiName: process.env.UPI_NAME || "KALPATARU INSTITUTE OF TECHNOLOGY"
};

const initialData = {
  competitions: [
    {
      id: "code-sprint",
      name: "Code Sprint",
      category: "Technical",
      date: "2026-05-15",
      venue: "Computer Lab A",
      fee: 1000,
      teamMin: 2,
      teamMax: 4,
      seats: 80
    },
    {
      id: "business-plan",
      name: "Business Plan Pitch",
      category: "Management",
      date: "2026-05-16",
      venue: "Seminar Hall",
      fee: 1000,
      teamMin: 2,
      teamMax: 4,
      seats: 40
    },
    {
      id: "robotics-rush",
      name: "Robotics Rush",
      category: "Engineering",
      date: "2026-05-17",
      venue: "Innovation Lab",
      fee: 1000,
      teamMin: 2,
      teamMax: 4,
      seats: 30
    },
    {
      id: "poster-design",
      name: "Poster Design",
      category: "Creative",
      date: "2026-05-15",
      venue: "Design Studio",
      fee: 1000,
      teamMin: 2,
      teamMax: 4,
      seats: 100
    }
  ],
  students: [],
  registrations: []
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function ensureDatabase() {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  try {
    await fsp.access(DB_PATH, fs.constants.F_OK);
  } catch {
    await writeDatabase(initialData);
  }
  try {
    await fsp.access(SETTINGS_PATH, fs.constants.F_OK);
  } catch {
    await writeSettings(defaultSettings);
  }
}

async function readDatabase() {
  await ensureDatabase();
  const raw = await fsp.readFile(DB_PATH, "utf8");
  const data = JSON.parse(raw);
  return {
    competitions: Array.isArray(data.competitions) ? data.competitions : initialData.competitions,
    students: Array.isArray(data.students) ? data.students : [],
    registrations: Array.isArray(data.registrations) ? data.registrations : []
  };
}

async function writeDatabase(data) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(DB_PATH, JSON.stringify(data, null, 2));
}

async function readSettings() {
  await ensureDatabase();
  const raw = await fsp.readFile(SETTINGS_PATH, "utf8");
  const settings = JSON.parse(raw);
  return {
    upiId: String(settings.upiId || defaultSettings.upiId).trim(),
    upiName: String(settings.upiName || defaultSettings.upiName).trim()
  };
}

async function writeSettings(settings) {
  await fsp.mkdir(DATA_DIR, { recursive: true });
  await fsp.writeFile(SETTINGS_PATH, JSON.stringify(settings, null, 2));
}

function publicPaymentSettings(settings) {
  const upiId = settings.upiId || defaultSettings.upiId;
  const configured = upiId !== defaultSettings.upiId && upiId.includes("@");
  return {
    upiId,
    upiName: settings.upiName || defaultSettings.upiName,
    configured
  };
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(body)
  });
  res.end(body);
}

function notFound(res) {
  json(res, 404, { error: "Not found" });
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error("Request body is too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

function requireText(value, label, min = 1) {
  const text = String(value || "").trim();
  if (text.length < min) {
    throw new Error(`${label} is required`);
  }
  return text;
}

function createId(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString("hex")}`;
}

function createToken() {
  return crypto.randomBytes(24).toString("hex");
}

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  const hash = crypto.pbkdf2Sync(String(password), salt, 120000, 32, "sha256").toString("hex");
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(":")) return false;
  const [salt, hash] = stored.split(":");
  const test = hashPassword(password, salt).split(":")[1];
  return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(test, "hex"));
}

function getSession(req) {
  const header = req.headers.authorization || "";
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  return sessions.get(match[1]) || null;
}

function publicStudent(student) {
  if (!student) return null;
  const { passwordHash, ...safeStudent } = student;
  return safeStudent;
}

function enrichRegistration(registration, db) {
  const student = db.students.find((item) => item.id === registration.studentId);
  const competition = db.competitions.find((item) => item.id === registration.competitionId);
  return {
    ...registration,
    student: publicStudent(student),
    competition
  };
}

function validateTeamSize(size, competition) {
  const teamSize = Number(size);
  if (!Number.isInteger(teamSize)) {
    throw new Error("Team size must be a number");
  }
  if (teamSize < competition.teamMin || teamSize > competition.teamMax) {
    throw new Error(`Team size for ${competition.name} must be between ${competition.teamMin} and ${competition.teamMax}`);
  }
  return teamSize;
}

function parseTeamMembers(value) {
  return String(value || "")
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function handleApi(req, res, url) {
  try {
    if (req.method === "GET" && url.pathname === "/api/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/competitions") {
      const db = await readDatabase();
      json(res, 200, { competitions: db.competitions });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/payment-settings") {
      const settings = await readSettings();
      json(res, 200, publicPaymentSettings(settings));
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/register") {
      const body = await parseBody(req);
      const db = await readDatabase();

      const fullName = requireText(body.fullName, "Full name", 2);
      const email = normalizeEmail(body.email);
      const phone = requireText(body.phone, "Phone number", 7);
      const password = requireText(body.password, "Password", 6);
      const collegeName = requireText(body.collegeName, "College name", 2);
      const department = requireText(body.department, "Department", 2);
      const year = requireText(body.year, "Year");
      const rollNumber = requireText(body.rollNumber, "Roll number", 2);
      const competition = db.competitions.find((item) => item.id === body.competitionId);

      if (!email.includes("@")) throw new Error("Valid email is required");
      if (!competition) throw new Error("Select a valid competition");
      if (db.students.some((student) => student.email === email)) {
        throw new Error("A student account with this email already exists");
      }

      const teamSize = validateTeamSize(body.teamSize, competition);
      const now = new Date().toISOString();
      const student = {
        id: createId("stu"),
        fullName,
        email,
        phone,
        passwordHash: hashPassword(password),
        collegeName,
        collegeCode: String(body.collegeCode || "").trim(),
        city: String(body.city || "").trim(),
        department,
        year,
        rollNumber,
        createdAt: now
      };
      const registration = {
        id: createId("reg"),
        studentId: student.id,
        competitionId: competition.id,
        teamName: String(body.teamName || "").trim() || `${fullName}'s Team`,
        teamSize,
        teamMembers: parseTeamMembers(body.teamMembers),
        feeAmount: competition.fee,
        paymentStatus: "Pending",
        paymentMethod: "",
        paymentReference: "",
        paidAt: "",
        adminStatus: "Awaiting Payment",
        createdAt: now,
        updatedAt: now
      };

      db.students.push(student);
      db.registrations.push(registration);
      await writeDatabase(db);

      const token = createToken();
      sessions.set(token, { role: "student", studentId: student.id, createdAt: Date.now() });
      json(res, 201, {
        token,
        role: "student",
        student: publicStudent(student),
        registration: enrichRegistration(registration, db)
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/login") {
      const body = await parseBody(req);
      const email = normalizeEmail(body.email);
      const password = String(body.password || "");
      const role = String(body.role || "student");

      if (role === "admin") {
        if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
          throw new Error("Invalid admin email or password");
        }
        const token = createToken();
        sessions.set(token, { role: "admin", createdAt: Date.now() });
        json(res, 200, {
          token,
          role: "admin",
          admin: { email: ADMIN_EMAIL, name: "Competition Admin" }
        });
        return;
      }

      const db = await readDatabase();
      const student = db.students.find((item) => item.email === email);
      if (!student || !verifyPassword(password, student.passwordHash)) {
        throw new Error("Invalid student email or password");
      }

      const token = createToken();
      sessions.set(token, { role: "student", studentId: student.id, createdAt: Date.now() });
      const registration = db.registrations.find((item) => item.studentId === student.id);
      json(res, 200, {
        token,
        role: "student",
        student: publicStudent(student),
        registration: registration ? enrichRegistration(registration, db) : null
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/auth/logout") {
      const header = req.headers.authorization || "";
      const match = header.match(/^Bearer\s+(.+)$/i);
      if (match) sessions.delete(match[1]);
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/student/dashboard") {
      const session = getSession(req);
      if (!session || session.role !== "student") {
        json(res, 401, { error: "Student login required" });
        return;
      }
      const db = await readDatabase();
      const student = db.students.find((item) => item.id === session.studentId);
      const registration = db.registrations.find((item) => item.studentId === session.studentId);
      json(res, 200, {
        student: publicStudent(student),
        registration: registration ? enrichRegistration(registration, db) : null
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/student/payment") {
      const session = getSession(req);
      if (!session || session.role !== "student") {
        json(res, 401, { error: "Student login required" });
        return;
      }

      const body = await parseBody(req);
      const method = requireText(body.method, "Payment method");
      const transactionId = requireText(body.transactionId, "UPI transaction/reference ID", 6);
      const db = await readDatabase();
      const registration = db.registrations.find((item) => item.studentId === session.studentId);

      if (!registration) throw new Error("Registration not found");
      if (registration.paymentStatus === "Paid") throw new Error("Fee has already been paid");

      registration.paymentStatus = "Paid";
      registration.paymentMethod = method;
      registration.paymentReference = transactionId;
      registration.paidAt = new Date().toISOString();
      registration.adminStatus = "Submitted";
      registration.updatedAt = registration.paidAt;
      await writeDatabase(db);

      json(res, 200, { registration: enrichRegistration(registration, db) });
      return;
    }

    if (req.method === "GET" && url.pathname === "/api/admin/registrations") {
      const session = getSession(req);
      if (!session || session.role !== "admin") {
        json(res, 401, { error: "Admin login required" });
        return;
      }
      const db = await readDatabase();
      const registrations = db.registrations
        .map((item) => enrichRegistration(item, db))
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      json(res, 200, {
        registrations,
        competitions: db.competitions,
        totals: {
          students: db.students.length,
          registrations: db.registrations.length,
          paid: db.registrations.filter((item) => item.paymentStatus === "Paid").length,
          collected: db.registrations
            .filter((item) => item.paymentStatus === "Paid")
            .reduce((sum, item) => sum + Number(item.feeAmount || 0), 0)
        }
      });
      return;
    }

    const statusMatch = url.pathname.match(/^\/api\/admin\/registrations\/([^/]+)\/status$/);
    if (req.method === "PATCH" && statusMatch) {
      const session = getSession(req);
      if (!session || session.role !== "admin") {
        json(res, 401, { error: "Admin login required" });
        return;
      }

      const body = await parseBody(req);
      const allowed = new Set(["Submitted", "Verified", "Rejected"]);
      const status = String(body.status || "");
      if (!allowed.has(status)) throw new Error("Invalid status");

      const db = await readDatabase();
      const registration = db.registrations.find((item) => item.id === statusMatch[1]);
      if (!registration) throw new Error("Registration not found");
      if (registration.paymentStatus !== "Paid") {
        throw new Error("Student payment is required before admin verification or rejection");
      }

      registration.adminStatus = status;
      registration.updatedAt = new Date().toISOString();
      await writeDatabase(db);
      json(res, 200, { registration: enrichRegistration(registration, db) });
      return;
    }

    notFound(res);
  } catch (error) {
    json(res, 400, { error: error.message || "Something went wrong" });
  }
}

async function serveStatic(req, res, url) {
  let requested = decodeURIComponent(url.pathname);
  if (requested === "/") requested = "/index.html";

  const filePath = path.normalize(path.join(PUBLIC_DIR, requested));
  if (!filePath.startsWith(PUBLIC_DIR)) {
    notFound(res);
    return;
  }

  try {
    const data = await fsp.readFile(filePath);
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "content-type": mimeTypes[ext] || "application/octet-stream",
      "cache-control": ext === ".html" ? "no-store" : "public, max-age=3600"
    });
    res.end(data);
  } catch {
    notFound(res);
  }
}

async function createServer() {
  await ensureDatabase();
  return http.createServer((req, res) => {
    const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    if (url.pathname.startsWith("/api/")) {
      handleApi(req, res, url);
    } else {
      serveStatic(req, res, url);
    }
  });
}

async function start(port = PORT, shouldLog = true, host = HOST) {
  const server = await createServer();
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.off("error", reject);
      const address = server.address();
      const actualPort = typeof address === "object" && address ? address.port : port;
      if (shouldLog) {
        console.log(`College competition website running at http://localhost:${actualPort}`);
        console.log(`Admin login: ${ADMIN_EMAIL} / ${ADMIN_PASSWORD}`);
      }
      resolve({ server, port: actualPort });
    });
  });
}

if (require.main === module) {
  start().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}

module.exports = {
  createServer,
  start
};
