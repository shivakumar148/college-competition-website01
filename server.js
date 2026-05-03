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
const PLACEHOLDER_UPI_ID = "add-your-upi-id@bank";
const DEFAULT_UPI_NAME = "KALPATARU INSTITUTE OF TECHNOLOGY";

const sessions = new Map();

const COLLEGE_PROFILE = {
  name: "Kalpataru Institute of Technology",
  shortName: "KIT Tiptur",
  campusLabel: "Tiptur Engineering College",
  location: "Tiptur, Tumakuru District, Karnataka",
  tagline: "A practical, innovation-led engineering campus focused on technical skill, teamwork, and industry readiness.",
  about:
    "Kalpataru Institute of Technology, Tiptur, established in 1986, is an AICTE-approved and VTU-affiliated engineering institution that regularly hosts technical, management, and creative events for student teams across campuses.",
  highlights: [
    "Industry-oriented engineering departments and skill-building clubs",
    "Technical labs, seminar halls, innovation spaces, and event-ready venues",
    "Placements, startup culture, and project exposure across departments",
    "Campus events that combine technology, creativity, presentation, and teamwork"
  ],
  departments: [
    "Computer Science and Engineering",
    "Information Science and Engineering",
    "Artificial Intelligence and Machine Learning",
    "Electronics and Communication Engineering",
    "Mechanical Engineering",
    "Civil Engineering",
    "Master of Business Administration",
    "Basic Science"
  ],
  accreditations: ["AICTE Approved", "VTU Affiliated", "NBA Accredited", "NAAC Accredited"],
  stats: [
    { label: "Established", value: "1986" },
    { label: "Campus", value: "30+ Acres" },
    { label: "Recruiters", value: "150+" },
    { label: "Highest Package", value: "5 LPA" }
  ],
  facilities: [
    "Computer labs and innovation spaces",
    "Seminar halls and presentation venues",
    "Library, Wi-Fi, and student support services",
    "Transport, hostels, sports, and campus activity areas"
  ],
  gallery: [
    "/assets/kit-campus-main.jpg",
    "/assets/kit-campus-2.jpeg",
    "/assets/kit-campus-3.jpeg"
  ],
  supportDesk: {
    email: "info@kittiptur.ac.in",
    phone: "+91 99160 70553",
    alternatePhone: "+91 97400 16919",
    hours: "09:00 AM to 05:00 PM"
  }
};

const defaultSettings = {
  upiId: process.env.UPI_ID || PLACEHOLDER_UPI_ID,
  upiName: process.env.UPI_NAME || DEFAULT_UPI_NAME
};

const initialData = {
  competitions: [
    {
      id: "code-sprint",
      name: "Code Sprint",
      category: "Technical",
      date: "2026-05-15",
      venue: "Computer Lab A",
      fee: 1,
      teamMin: 2,
      teamMax: 4,
      seats: 80,
      reportingTime: "09:00 AM",
      duration: "2 rounds | 3 hours",
      description: "A problem-solving coding event focused on logic, debugging, and fast implementation.",
      rounds: ["Aptitude and logic screening", "Hands-on coding challenge"],
      rules: [
        "Teams must have 2 to 4 members from a recognized college.",
        "Every team should bring at least one laptop with the required coding tools.",
        "Internet use is allowed only if the round coordinator announces it.",
        "The final submission must be uploaded before the timer ends."
      ]
    },
    {
      id: "business-plan",
      name: "Business Plan Pitch",
      category: "Management",
      date: "2026-05-16",
      venue: "Seminar Hall",
      fee: 1,
      teamMin: 2,
      teamMax: 4,
      seats: 40,
      reportingTime: "10:00 AM",
      duration: "Presentation + Q&A",
      description: "Teams pitch a startup idea, market strategy, and revenue plan to a panel.",
      rounds: ["Idea abstract review", "Pitch presentation and jury interaction"],
      rules: [
        "Teams must submit a clear business theme and problem statement.",
        "Presentation time is limited and will be stopped once the bell rings.",
        "Only original ideas are accepted; copied plans will be rejected.",
        "Judging will consider feasibility, creativity, and delivery."
      ]
    },
    {
      id: "robotics-rush",
      name: "Robotics Rush",
      category: "Engineering",
      date: "2026-05-17",
      venue: "Innovation Lab",
      fee: 1,
      teamMin: 2,
      teamMax: 4,
      seats: 30,
      reportingTime: "09:30 AM",
      duration: "Arena task + build review",
      description: "Build and control a robot to complete a timed task in the arena.",
      rounds: ["Machine inspection", "Arena performance"],
      rules: [
        "All machines must satisfy the size and power rules announced at check-in.",
        "Teams are responsible for their own device safety and spare parts.",
        "Unsafe operation can lead to immediate disqualification.",
        "Judging will combine task completion, accuracy, and timing."
      ]
    },
    {
      id: "poster-design",
      name: "Poster Design",
      category: "Creative",
      date: "2026-05-15",
      venue: "Design Studio",
      fee: 1,
      teamMin: 2,
      teamMax: 4,
      seats: 100,
      reportingTime: "11:00 AM",
      duration: "Design sprint | 2 hours",
      description: "Create a visual poster around a campus or social innovation theme.",
      rounds: ["Theme briefing", "Poster creation and jury review"],
      rules: [
        "Teams must finish their poster within the announced design window.",
        "All submitted work must be original and prepared by the team.",
        "Judging considers concept clarity, layout, and visual impact.",
        "Final files should be submitted in the format requested by coordinators."
      ]
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
  const competitions = mergeCompetitions(data.competitions);
  const competitionMap = new Map(competitions.map((item) => [item.id, item]));
  return {
    competitions,
    students: Array.isArray(data.students) ? data.students : [],
    registrations: Array.isArray(data.registrations)
      ? data.registrations.map((item) => normalizeRegistration(item, competitionMap))
      : []
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
  const configured = upiId !== PLACEHOLDER_UPI_ID && upiId.includes("@");
  return {
    upiId,
    upiName: settings.upiName || defaultSettings.upiName,
    configured
  };
}

function mergeCompetitions(items) {
  const defaults = new Map(initialData.competitions.map((item) => [item.id, item]));
  const source = Array.isArray(items) && items.length ? items : initialData.competitions;
  const merged = source.map((item) => {
    const fallback = defaults.get(item.id) || {};
    return {
      ...fallback,
      ...item,
      fee: Number(item.fee ?? fallback.fee ?? 1000),
      teamMin: Number(item.teamMin ?? fallback.teamMin ?? 2),
      teamMax: Number(item.teamMax ?? fallback.teamMax ?? 4),
      seats: Number(item.seats ?? fallback.seats ?? 0),
      rounds: Array.isArray(item.rounds) && item.rounds.length ? item.rounds : Array.isArray(fallback.rounds) ? fallback.rounds : [],
      rules: Array.isArray(item.rules) && item.rules.length ? item.rules : Array.isArray(fallback.rules) ? fallback.rules : []
    };
  });

  for (const fallback of initialData.competitions) {
    if (!merged.some((item) => item.id === fallback.id)) {
      merged.push(fallback);
    }
  }

  return merged;
}

function normalizeRegistration(item, competitionMap) {
  const competition = competitionMap.get(item.competitionId);
  return {
    ...item,
    teamSize: Number(item.teamSize || competition?.teamMin || 2),
    teamMembers: Array.isArray(item.teamMembers) ? item.teamMembers : parseTeamMembers(item.teamMembers),
    feeAmount: Number(item.feeAmount || competition?.fee || 0),
    paymentStatus: item.paymentStatus || "Pending",
    paymentMethod: item.paymentMethod || "",
    paymentReference: item.paymentReference || "",
    paidAt: item.paidAt || "",
    adminStatus: item.adminStatus || (item.paymentStatus === "Paid" ? "Submitted" : "Awaiting Payment")
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

function studentRegistrations(db, studentId) {
  return db.registrations
    .filter((item) => item.studentId === studentId)
    .map((item) => enrichRegistration(item, db))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

function studentDashboardStats(registrations) {
  const paid = registrations.filter((item) => item.paymentStatus === "Paid").length;
  const verified = registrations.filter((item) => item.adminStatus === "Verified").length;
  const upcoming = registrations
    .filter((item) => item.competition?.date)
    .sort((a, b) => String(a.competition?.date || "").localeCompare(String(b.competition?.date || "")))[0];

  return {
    total: registrations.length,
    paid,
    verified,
    awaitingPayment: registrations.filter((item) => item.paymentStatus !== "Paid").length,
    nextCompetition: upcoming
      ? {
          name: upcoming.competition?.name,
          date: upcoming.competition?.date,
          venue: upcoming.competition?.venue
        }
      : null
  };
}

function departmentSummary(registrations) {
  const summary = new Map();
  for (const item of registrations) {
    const department = item.student?.department || "Unknown";
    const bucket = summary.get(department) || { department, count: 0, paid: 0, verified: 0 };
    bucket.count += 1;
    if (item.paymentStatus === "Paid") bucket.paid += 1;
    if (item.adminStatus === "Verified") bucket.verified += 1;
    summary.set(department, bucket);
  }
  return [...summary.values()].sort((a, b) => b.count - a.count);
}

function competitionProgress(competitions, registrations) {
  return competitions.map((competition) => {
    const items = registrations.filter((item) => item.competitionId === competition.id);
    const paid = items.filter((item) => item.paymentStatus === "Paid").length;
    const verified = items.filter((item) => item.adminStatus === "Verified").length;
    const seatsFilled = competition.seats ? Math.min(100, Math.round((items.length / competition.seats) * 100)) : 0;
    return {
      id: competition.id,
      name: competition.name,
      category: competition.category,
      seats: competition.seats,
      registrations: items.length,
      paid,
      verified,
      seatsFilled
    };
  });
}

function recentActivity(registrations) {
  return [...registrations]
    .sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)))
    .slice(0, 8)
    .map((item) => ({
      id: item.id,
      studentName: item.student?.fullName || "Student",
      competition: item.competition?.name || "Competition",
      status: item.adminStatus,
      paymentStatus: item.paymentStatus,
      updatedAt: item.updatedAt || item.createdAt
    }));
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

    if (req.method === "GET" && url.pathname === "/api/college-info") {
      json(res, 200, { college: COLLEGE_PROFILE });
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
      const registrations = studentRegistrations(db, student.id);
      json(res, 201, {
        token,
        role: "student",
        student: publicStudent(student),
        registration: enrichRegistration(registration, db),
        registrations
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
      const registrations = studentRegistrations(db, student.id);
      json(res, 200, {
        token,
        role: "student",
        student: publicStudent(student),
        registration: registrations[0] || null,
        registrations
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
      const registrations = studentRegistrations(db, session.studentId);
      const registeredIds = new Set(registrations.map((item) => item.competitionId));
      json(res, 200, {
        student: publicStudent(student),
        registrations,
        stats: studentDashboardStats(registrations),
        college: COLLEGE_PROFILE,
        availableCompetitions: db.competitions.filter((item) => !registeredIds.has(item.id))
      });
      return;
    }

    if (req.method === "POST" && url.pathname === "/api/student/registrations") {
      const session = getSession(req);
      if (!session || session.role !== "student") {
        json(res, 401, { error: "Student login required" });
        return;
      }

      const body = await parseBody(req);
      const db = await readDatabase();
      const student = db.students.find((item) => item.id === session.studentId);
      if (!student) throw new Error("Student record not found");

      const competition = db.competitions.find((item) => item.id === body.competitionId);
      if (!competition) throw new Error("Select a valid competition");
      if (db.registrations.some((item) => item.studentId === session.studentId && item.competitionId === competition.id)) {
        throw new Error("You have already added this competition");
      }

      const teamSize = validateTeamSize(body.teamSize, competition);
      const now = new Date().toISOString();
      const registration = {
        id: createId("reg"),
        studentId: student.id,
        competitionId: competition.id,
        teamName: String(body.teamName || "").trim() || `${student.fullName}'s Team`,
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

      db.registrations.push(registration);
      await writeDatabase(db);
      json(res, 201, { registration: enrichRegistration(registration, db) });
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
      const registrationId = String(body.registrationId || "").trim();
      const studentEntries = db.registrations.filter((item) => item.studentId === session.studentId);
      const registration = registrationId
        ? studentEntries.find((item) => item.id === registrationId)
        : studentEntries.length === 1
          ? studentEntries[0]
          : null;

      if (!registration) throw new Error("Select a competition registration first");
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
        college: COLLEGE_PROFILE,
        departmentSummary: departmentSummary(registrations),
        competitionProgress: competitionProgress(db.competitions, registrations),
        recentActivity: recentActivity(registrations),
        reviewQueue: registrations.filter((item) => item.paymentStatus === "Paid" && item.adminStatus === "Submitted").slice(0, 6),
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
