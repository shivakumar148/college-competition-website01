const app = document.querySelector("#app");
const COLLEGE_NAME = "KALPATARU INSTITUTE OF TECHNOLOGY";
const FEST_NAME = "KIT Competition Fest";

const state = {
  role: "student",
  authMode: "login",
  token: localStorage.getItem("cc_token") || "",
  roleStored: localStorage.getItem("cc_role") || "",
  competitions: [],
  paymentSettings: null,
  student: null,
  registration: null,
  adminData: null,
  selectedRegistrationId: "",
  filters: {
    search: "",
    payment: "all",
    status: "all",
    competition: "all"
  }
};

const money = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0
});

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function statusClass(value) {
  return `status-${String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

function saveAuth(token, role) {
  state.token = token;
  state.roleStored = role;
  localStorage.setItem("cc_token", token);
  localStorage.setItem("cc_role", role);
}

function clearAuth() {
  state.token = "";
  state.roleStored = "";
  state.student = null;
  state.registration = null;
  state.adminData = null;
  localStorage.removeItem("cc_token");
  localStorage.removeItem("cc_role");
}

async function api(path, options = {}) {
  const headers = {
    "content-type": "application/json",
    ...(options.headers || {})
  };
  if (state.token) {
    headers.authorization = `Bearer ${state.token}`;
  }

  const response = await fetch(path, {
    ...options,
    headers
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
}

async function loadCompetitions() {
  const data = await api("/api/competitions");
  state.competitions = data.competitions;
}

async function loadPaymentSettings() {
  state.paymentSettings = await api("/api/payment-settings");
}

function setMessage(type, text) {
  const box = document.querySelector("[data-message]");
  if (!box) return;
  box.className = `message ${type} show`;
  box.textContent = text;
}

function competitionOptions(selectedId = "") {
  return state.competitions
    .map((item) => {
      const selected = item.id === selectedId ? "selected" : "";
      return `<option value="${escapeHtml(item.id)}" ${selected}>${escapeHtml(item.name)} - ${money.format(item.fee)}</option>`;
    })
    .join("");
}

function selectedCompetition() {
  const select = document.querySelector("[name='competitionId']");
  const id = select?.value || state.competitions[0]?.id;
  return state.competitions.find((item) => item.id === id) || state.competitions[0];
}

function updateFeePreview() {
  const competition = selectedCompetition();
  const preview = document.querySelector("[data-fee-preview]");
  const teamHint = document.querySelector("[data-team-hint]");
  const teamInput = document.querySelector("[name='teamSize']");
  if (!competition || !preview) return;
  preview.textContent = money.format(competition.fee);
  if (teamHint) {
    teamHint.textContent = `${competition.teamMin}-${competition.teamMax} members`;
  }
  if (teamInput) {
    teamInput.min = competition.teamMin;
    teamInput.max = competition.teamMax;
    if (!teamInput.value) teamInput.value = competition.teamMin;
  }
}

function authView() {
  const isAdmin = state.role === "admin";
  const isRegister = state.authMode === "register" && !isAdmin;

  app.innerHTML = `
    <section class="auth-layout">
      <div class="auth-visual">
        <img src="/assets/campus-registration.png" alt="Students registering at a college competition desk" />
        <div class="brand-block">
          <div class="brand-kicker">${COLLEGE_NAME}</div>
          <h1>${FEST_NAME}</h1>
          <p>Students register teams, pay the competition fee by UPI QR, and receive a digital event pass.</p>
        </div>
      </div>

      <div class="auth-panel-wrap">
        <section class="auth-panel">
          <header class="auth-head">
            <div class="college-pill">${COLLEGE_NAME}</div>
            <h2>${isRegister ? "Student Registration" : isAdmin ? "Admin Login" : "Student Login"}</h2>
            <p>${isRegister ? "Create the student record and competition entry together." : isAdmin ? "Open the admin dashboard for student and payment details." : "Continue to the student dashboard."}</p>
          </header>

          <div class="role-row" role="tablist" aria-label="Login role">
            <button class="segmented ${state.role === "student" ? "active" : ""}" data-role="student" type="button">Student</button>
            <button class="segmented ${state.role === "admin" ? "active" : ""}" data-role="admin" type="button">Admin</button>
          </div>

          ${!isAdmin ? `
            <div class="tab-row" role="tablist" aria-label="Student form">
              <button class="segmented ${state.authMode === "login" ? "active" : ""}" data-mode="login" type="button">Login</button>
              <button class="segmented ${state.authMode === "register" ? "active" : ""}" data-mode="register" type="button">Register</button>
            </div>
          ` : ""}

          <div class="form-area">
            ${isRegister ? registerForm() : loginForm(isAdmin)}
            <div class="message" data-message></div>
            ${!isAdmin ? competitionPreview() : ""}
          </div>
        </section>
      </div>
    </section>
  `;

  document.querySelectorAll("[data-role]").forEach((button) => {
    button.addEventListener("click", () => {
      state.role = button.dataset.role;
      if (state.role === "admin") state.authMode = "login";
      authView();
    });
  });

  document.querySelectorAll("[data-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      state.authMode = button.dataset.mode;
      authView();
    });
  });

  const form = document.querySelector("form");
  if (form) {
    form.addEventListener("submit", isRegister ? handleRegister : handleLogin);
  }

  const competitionSelect = document.querySelector("[name='competitionId']");
  if (competitionSelect) {
    competitionSelect.addEventListener("change", updateFeePreview);
    updateFeePreview();
  }
}

function loginForm(isAdmin) {
  return `
    <form class="form-grid">
      <div class="field full">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field full">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="${isAdmin ? "current-password" : "current-password"}" required />
      </div>
      <div class="form-actions field full">
        <button class="primary-btn" type="submit">${isAdmin ? "Open Admin Dashboard" : "Login"}</button>
      </div>
    </form>
  `;
}

function registerForm() {
  const firstCompetition = state.competitions[0];
  return `
    <form class="form-grid">
      <div class="field">
        <label for="fullName">Full Name</label>
        <input id="fullName" name="fullName" autocomplete="name" required minlength="2" />
      </div>
      <div class="field">
        <label for="phone">Phone Number</label>
        <input id="phone" name="phone" autocomplete="tel" required minlength="7" />
      </div>
      <div class="field">
        <label for="email">Email</label>
        <input id="email" name="email" type="email" autocomplete="email" required />
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input id="password" name="password" type="password" autocomplete="new-password" minlength="6" required />
      </div>
      <div class="field">
        <label for="collegeName">College Name</label>
        <input id="collegeName" name="collegeName" value="${COLLEGE_NAME}" required minlength="2" />
      </div>
      <div class="field">
        <label for="collegeCode">College Code</label>
        <input id="collegeCode" name="collegeCode" />
      </div>
      <div class="field">
        <label for="city">City</label>
        <input id="city" name="city" />
      </div>
      <div class="field">
        <label for="department">Department</label>
        <input id="department" name="department" required minlength="2" />
      </div>
      <div class="field">
        <label for="year">Year</label>
        <select id="year" name="year" required>
          <option value="1st Year">1st Year</option>
          <option value="2nd Year">2nd Year</option>
          <option value="3rd Year">3rd Year</option>
          <option value="4th Year">4th Year</option>
          <option value="PG">PG</option>
        </select>
      </div>
      <div class="field">
        <label for="rollNumber">Roll Number</label>
        <input id="rollNumber" name="rollNumber" required minlength="2" />
      </div>
      <div class="field">
        <label for="competitionId">Competition</label>
        <select id="competitionId" name="competitionId" required>${competitionOptions(firstCompetition?.id)}</select>
      </div>
      <div class="field">
        <label for="teamSize">Team Size <span data-team-hint></span></label>
        <input id="teamSize" name="teamSize" type="number" value="${firstCompetition?.teamMin || 1}" required />
      </div>
      <div class="field">
        <label for="teamName">Team Name</label>
        <input id="teamName" name="teamName" />
      </div>
      <div class="field full">
        <label for="teamMembers">Team Members</label>
        <textarea id="teamMembers" name="teamMembers" rows="3" placeholder="Enter one member name per line"></textarea>
      </div>
      <div class="field">
        <label>Competition Fee</label>
        <div class="fee-strip">
          <span>Pay after registration</span>
          <strong data-fee-preview>${firstCompetition ? money.format(firstCompetition.fee) : "-"}</strong>
        </div>
      </div>
      <div class="form-actions field full">
        <button class="primary-btn" type="submit">Create Registration</button>
      </div>
    </form>
  `;
}

function competitionPreview() {
  if (!state.competitions.length) return "";
  return `
    <div class="event-preview">
      <div class="event-preview-head">
        <span>Featured Competitions</span>
        <strong>Fee: ${money.format(1000)} | Team: 2-4</strong>
      </div>
      <div class="mini-event-grid">
        ${state.competitions.map((item) => `
          <div class="mini-event-card">
            <span>${escapeHtml(item.category)}</span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${formatDate(item.date)} | ${escapeHtml(item.venue)}</small>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

async function handleLogin(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const data = await api("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        role: state.role,
        email: form.get("email"),
        password: form.get("password")
      })
    });
    saveAuth(data.token, data.role);
    if (data.role === "admin") {
      await loadAdminDashboard();
      adminView();
    } else {
      state.student = data.student;
      state.registration = data.registration;
      studentView();
    }
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    button.disabled = false;
  }
}

async function handleRegister(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const payload = Object.fromEntries(form.entries());
    payload.teamSize = Number(payload.teamSize);
    const data = await api("/api/auth/register", {
      method: "POST",
      body: JSON.stringify(payload)
    });
    saveAuth(data.token, data.role);
    state.student = data.student;
    state.registration = data.registration;
    studentView();
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    button.disabled = false;
  }
}

function shell(title, subtitle, body) {
  app.innerHTML = `
    <header class="topbar">
      <div class="topbar-inner">
        <div class="wordmark">
          <strong>${COLLEGE_NAME}</strong>
          <span>${escapeHtml(subtitle)}</span>
        </div>
        <button class="ghost-btn" data-logout type="button">Logout</button>
      </div>
    </header>
    <section class="dashboard">
      <div class="dashboard-head">
        <div>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(subtitle)}</p>
        </div>
      </div>
      ${body}
    </section>
  `;
  document.querySelector("[data-logout]").addEventListener("click", handleLogout);
}

function studentView() {
  const student = state.student;
  const reg = state.registration;
  const comp = reg?.competition || {};
  const paymentDone = reg?.paymentStatus === "Paid";
  const body = `
    ${progressTracker(reg)}
    <div class="student-grid">
      <section class="info-card">
        <div class="card-title">
          <div>
            <h3>Student Details</h3>
            <p>${escapeHtml(student?.email || "")}</p>
          </div>
          <div class="card-actions">
            <span class="status-pill ${statusClass(reg?.adminStatus)}">${escapeHtml(reg?.adminStatus || "Submitted")}</span>
            <button class="row-btn" data-copy-reg="${escapeHtml(reg?.id || "")}" type="button">Copy ID</button>
          </div>
        </div>
        <div class="card-body">
          <div class="detail-grid">
            ${detailItem("Name", student?.fullName)}
            ${detailItem("Phone", student?.phone)}
            ${detailItem("College", student?.collegeName)}
            ${detailItem("College Code", student?.collegeCode || "-")}
            ${detailItem("City", student?.city || "-")}
            ${detailItem("Department", student?.department)}
            ${detailItem("Year", student?.year)}
          ${detailItem("Roll Number", student?.rollNumber)}
          ${detailItem("Team Members", teamMembersText(reg))}
          </div>
        </div>
      </section>

      <section class="payment-panel">
        <h3>${escapeHtml(comp.name || "Competition")}</h3>
        <p>${escapeHtml(comp.category || "")} | ${formatDate(comp.date)} | ${escapeHtml(comp.venue || "")}</p>
        <div class="amount-line">
          <span>Fee Status</span>
          <span class="status-pill ${statusClass(reg?.paymentStatus)}">${escapeHtml(reg?.paymentStatus || "Pending")}</span>
        </div>
        <div class="amount-line">
          <span>Amount</span>
          <strong>${money.format(reg?.feeAmount || 0)}</strong>
        </div>
        ${paymentDone ? paidBlock(reg) : paymentForm(reg)}
      </section>
    </div>
    <div class="student-feature-grid">
      ${eventPass(student, reg, comp, paymentDone)}
      ${competitionGuide()}
    </div>
  `;

  shell(`Welcome, ${student?.fullName || "Student"}`, "Student dashboard", body);
  renderPaymentQr();
  renderPassQr();
  bindStudentActions();
  const form = document.querySelector("[data-payment-form]");
  if (form) form.addEventListener("submit", handlePayment);
}

function detailItem(label, value) {
  return `
    <div class="detail-item">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function teamMembersText(reg) {
  return Array.isArray(reg?.teamMembers) && reg.teamMembers.length ? reg.teamMembers.join(", ") : "-";
}

function progressTracker(reg) {
  const steps = [
    { label: "Details Saved", done: Boolean(reg?.id) },
    { label: "Fee Paid", done: reg?.paymentStatus === "Paid" },
    { label: "Submitted", done: ["Submitted", "Verified", "Rejected"].includes(reg?.adminStatus) },
    { label: "Entry Pass", done: reg?.paymentStatus === "Paid" && reg?.adminStatus === "Verified" }
  ];

  return `
    <section class="journey-panel">
      ${steps.map((step, index) => `
        <div class="journey-step ${step.done ? "done" : ""}">
          <span>${index + 1}</span>
          <strong>${escapeHtml(step.label)}</strong>
        </div>
      `).join("")}
    </section>
  `;
}

function eventPass(student, reg, comp, paymentDone) {
  const ready = paymentDone && reg?.adminStatus === "Verified";
  const passPayload = `KITPASS:${reg?.id || ""}:${student?.rollNumber || ""}:${reg?.competitionId || ""}`;
  return `
    <section class="pass-card">
      <div class="pass-header">
        <div>
          <span>${COLLEGE_NAME}</span>
          <h3>Digital Entry Pass</h3>
        </div>
        <span class="status-pill ${ready ? "status-verified" : "status-pending"}">${ready ? "Ready" : "Pending"}</span>
      </div>
      <div class="pass-body">
        <div class="pass-qr ${ready ? "" : "pass-qr-locked"}" data-pass-qr data-pass-payload="${escapeHtml(passPayload)}">
          ${ready ? "" : "<span>Unlocks after verification</span>"}
        </div>
        <div class="pass-details">
          ${detailItem("Registration ID", reg?.id)}
          ${detailItem("Student", student?.fullName)}
          ${detailItem("Competition", comp?.name)}
          ${detailItem("Team", `${reg?.teamName || "-"} (${reg?.teamSize || "-"})`)}
          ${detailItem("Members", teamMembersText(reg))}
        </div>
      </div>
      <div class="pass-actions">
        <button class="ghost-btn" data-print-pass type="button">Print Pass</button>
      </div>
    </section>
  `;
}

function competitionGuide() {
  return `
    <section class="guide-panel">
      <div class="card-title">
        <div>
          <h3>Competition Guide</h3>
          <p>Quick view of events, venues, and seats.</p>
        </div>
      </div>
      <div class="guide-grid">
        ${state.competitions.map((item) => `
          <div class="guide-card">
            <span>${escapeHtml(item.category)}</span>
            <strong>${escapeHtml(item.name)}</strong>
            <small>${formatDate(item.date)} | ${escapeHtml(item.venue)}</small>
            <em>${money.format(item.fee)} | ${item.teamMin}-${item.teamMax} members | ${item.seats} seats</em>
          </div>
        `).join("")}
      </div>
    </section>
  `;
}

function paymentForm(reg) {
  const payment = buildUpiPayment(reg);
  const settings = state.paymentSettings || {};
  const setupMessage = settings.configured
    ? ""
    : `<div class="message error show">Add your real UPI ID in data/settings.json to activate payments to your account.</div>`;

  return `
    <div class="payment-note">
      Your registration will be submitted to admin only after you complete UPI payment and enter the transaction/reference ID.
    </div>
    <div class="upi-payment">
      <div class="upi-qr ${settings.configured ? "" : "upi-qr-disabled"}" data-upi-qr data-upi-uri="${escapeHtml(payment.uri)}">
        ${settings.configured ? `<img src="${escapeHtml(payment.qrUrl)}" alt="UPI QR code for ${escapeHtml(settings.upiId)}" loading="eager" />` : "<span>UPI ID needed</span>"}
      </div>
      <div class="upi-details">
        <span>Pay by UPI QR</span>
        <strong>${money.format(reg?.feeAmount || 0)}</strong>
        <p>Receiver: ${escapeHtml(settings.upiName || COLLEGE_NAME)}<br />UPI ID: ${escapeHtml(settings.upiId || "add-your-upi-id@bank")}</p>
        ${settings.configured ? `
          <div class="pay-actions">
            <a class="primary-btn action-link" href="${escapeHtml(payment.uri)}">Open UPI App</a>
            <button class="ghost-btn" data-copy-upi="${escapeHtml(settings.upiId)}" type="button">Copy UPI ID</button>
          </div>
        ` : ""}
      </div>
    </div>
    <form class="payment-form" data-payment-form>
      <div class="field">
        <label for="transactionId">UPI Transaction / Reference ID</label>
        <input id="transactionId" name="transactionId" minlength="6" placeholder="Example: 412345678901" required ${settings.configured ? "" : "disabled"} />
      </div>
      <button class="secondary-btn" type="submit" ${settings.configured ? "" : "disabled"}>Submit Payment & Registration</button>
      ${setupMessage}
      <div class="message" data-message></div>
    </form>
  `;
}

function buildUpiPayment(reg) {
  const settings = state.paymentSettings || {};
  const amount = Number(reg?.feeAmount || 1000).toFixed(2);
  const reference = String(reg?.id || `REG${Date.now()}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 32);
  const params = new URLSearchParams({
    pa: settings.upiId || "add-your-upi-id@bank",
    pn: settings.upiName || COLLEGE_NAME,
    tr: reference,
    am: amount,
    cu: "INR",
    tn: `KIT Competition Fee ${reference}`.trim()
  });
  const uri = `upi://pay?${params.toString()}`;
  return {
    uri,
    qrUrl: `https://api.qrserver.com/v1/create-qr-code/?size=360x360&margin=18&ecc=H&data=${encodeURIComponent(uri)}`
  };
}

function renderPaymentQr() {
  const target = document.querySelector("[data-upi-qr]");
  if (!target || target.classList.contains("upi-qr-disabled")) return;
  const image = target.querySelector("img");
  if (image) {
    image.addEventListener("error", () => {
      target.innerHTML = "<span>QR image failed. Use Open UPI App or Copy UPI ID.</span>";
    });
  }
}

function renderPassQr() {
  const target = document.querySelector("[data-pass-qr]");
  if (!target || target.classList.contains("pass-qr-locked")) return;
  try {
    target.innerHTML = createQrSvg(target.dataset.passPayload, "Digital entry pass QR code");
  } catch {
    target.innerHTML = "<span>QR unavailable</span>";
  }
}

function bindStudentActions() {
  const copyButton = document.querySelector("[data-copy-reg]");
  if (copyButton) {
    copyButton.addEventListener("click", async () => {
      const id = copyButton.dataset.copyReg;
      try {
        await navigator.clipboard.writeText(id);
        copyButton.textContent = "Copied";
      } catch {
        copyButton.textContent = id;
      }
    });
  }

  const copyUpiButton = document.querySelector("[data-copy-upi]");
  if (copyUpiButton) {
    copyUpiButton.addEventListener("click", async () => {
      const id = copyUpiButton.dataset.copyUpi;
      try {
        await navigator.clipboard.writeText(id);
        copyUpiButton.textContent = "Copied";
      } catch {
        copyUpiButton.textContent = id;
      }
    });
  }

  const printButton = document.querySelector("[data-print-pass]");
  if (printButton) {
    printButton.addEventListener("click", () => window.print());
  }
}

function createQrSvg(text, label = "QR code") {
  const matrix = createQrMatrix(text);
  const border = 4;
  const viewSize = matrix.size + border * 2;
  const darkModules = [];

  for (let row = 0; row < matrix.size; row += 1) {
    for (let col = 0; col < matrix.size; col += 1) {
      if (matrix.modules[row][col]) {
        darkModules.push(`M${col + border},${row + border}h1v1h-1z`);
      }
    }
  }

  return `
    <svg class="qr-svg" viewBox="0 0 ${viewSize} ${viewSize}" role="img" aria-label="${escapeHtml(label)}">
      <rect width="${viewSize}" height="${viewSize}" fill="#ffffff"></rect>
      <path d="${darkModules.join(" ")}" fill="#18232f"></path>
    </svg>
  `;
}

function createQrMatrix(text) {
  const version = 6;
  const size = version * 4 + 17;
  const dataCodewords = 136;
  const blockCount = 2;
  const blockDataCodewords = 68;
  const ecCodewords = 18;
  const bytes = Array.from(new TextEncoder().encode(text));
  if (bytes.length > 134) {
    throw new Error("QR text is too long");
  }

  const bits = [];
  const appendBits = (value, length) => {
    for (let i = length - 1; i >= 0; i -= 1) {
      bits.push((value >>> i) & 1);
    }
  };

  appendBits(0b0100, 4);
  appendBits(bytes.length, 8);
  bytes.forEach((byte) => appendBits(byte, 8));

  const capacityBits = dataCodewords * 8;
  appendBits(0, Math.min(4, capacityBits - bits.length));
  while (bits.length % 8) bits.push(0);

  const data = [];
  for (let i = 0; i < bits.length; i += 8) {
    data.push(bits.slice(i, i + 8).reduce((value, bit) => (value << 1) | bit, 0));
  }
  for (let pad = 0; data.length < dataCodewords; pad += 1) {
    data.push(pad % 2 === 0 ? 0xec : 0x11);
  }

  const blocks = [];
  for (let i = 0; i < blockCount; i += 1) {
    const blockData = data.slice(i * blockDataCodewords, (i + 1) * blockDataCodewords);
    blocks.push({
      data: blockData,
      ec: reedSolomonRemainder(blockData, ecCodewords)
    });
  }

  const codewords = [];
  for (let i = 0; i < blockDataCodewords; i += 1) {
    blocks.forEach((block) => codewords.push(block.data[i]));
  }
  for (let i = 0; i < ecCodewords; i += 1) {
    blocks.forEach((block) => codewords.push(block.ec[i]));
  }

  const modules = Array.from({ length: size }, () => Array(size).fill(false));
  const reserved = Array.from({ length: size }, () => Array(size).fill(false));
  const setModule = (row, col, dark, isReserved = true) => {
    if (row < 0 || row >= size || col < 0 || col >= size) return;
    modules[row][col] = Boolean(dark);
    if (isReserved) reserved[row][col] = true;
  };

  drawQrFunctionPatterns(size, setModule);
  reserveQrFormatAreas(size, setModule);

  const codewordBits = [];
  codewords.forEach((codeword) => {
    for (let i = 7; i >= 0; i -= 1) {
      codewordBits.push((codeword >>> i) & 1);
    }
  });

  let bitIndex = 0;
  let upward = true;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vertical = 0; vertical < size; vertical += 1) {
      const row = upward ? size - 1 - vertical : vertical;
      for (let j = 0; j < 2; j += 1) {
        const col = right - j;
        if (reserved[row][col]) continue;
        let dark = bitIndex < codewordBits.length ? codewordBits[bitIndex] === 1 : false;
        bitIndex += 1;
        if ((row + col) % 2 === 0) dark = !dark;
        modules[row][col] = dark;
      }
    }
    upward = !upward;
  }

  drawQrFormatBits(size, setModule, 0);
  return { modules, size };
}

function drawQrFunctionPatterns(size, setModule) {
  const drawFinder = (row, col) => {
    for (let y = -1; y <= 7; y += 1) {
      for (let x = -1; x <= 7; x += 1) {
        const inFinder = x >= 0 && x <= 6 && y >= 0 && y <= 6;
        const dark = inFinder && (x === 0 || x === 6 || y === 0 || y === 6 || (x >= 2 && x <= 4 && y >= 2 && y <= 4));
        setModule(row + y, col + x, dark);
      }
    }
  };

  drawFinder(0, 0);
  drawFinder(0, size - 7);
  drawFinder(size - 7, 0);

  for (let i = 8; i < size - 8; i += 1) {
    const dark = i % 2 === 0;
    setModule(6, i, dark);
    setModule(i, 6, dark);
  }

  const center = size - 7;
  for (let y = -2; y <= 2; y += 1) {
    for (let x = -2; x <= 2; x += 1) {
      const distance = Math.max(Math.abs(x), Math.abs(y));
      setModule(center + y, center + x, distance === 2 || distance === 0);
    }
  }

  setModule(size - 8, 8, true);
}

function reserveQrFormatAreas(size, setModule) {
  for (let i = 0; i <= 8; i += 1) {
    if (i === 6) continue;
    setModule(8, i, false);
    setModule(i, 8, false);
  }
  for (let i = 0; i < 8; i += 1) {
    setModule(8, size - 1 - i, false);
  }
  for (let i = 8; i < 15; i += 1) {
    setModule(size - 15 + i, 8, false);
  }
  setModule(size - 8, 8, true);
}

function drawQrFormatBits(size, setModule, mask) {
  const bits = getQrFormatBits(mask);
  const bit = (index) => ((bits >>> index) & 1) === 1;

  for (let i = 0; i <= 5; i += 1) setModule(8, i, bit(i));
  setModule(8, 7, bit(6));
  setModule(8, 8, bit(7));
  setModule(7, 8, bit(8));
  for (let i = 9; i < 15; i += 1) setModule(14 - i, 8, bit(i));

  for (let i = 0; i < 8; i += 1) setModule(8, size - 1 - i, bit(i));
  for (let i = 8; i < 15; i += 1) setModule(size - 15 + i, 8, bit(i));
  setModule(size - 8, 8, true);
}

function getQrFormatBits(mask) {
  const data = (1 << 3) | mask;
  let remainder = data;
  for (let i = 0; i < 10; i += 1) {
    remainder = (remainder << 1) ^ (((remainder >>> 9) & 1) ? 0x537 : 0);
  }
  return ((data << 10) | (remainder & 0x3ff)) ^ 0x5412;
}

function reedSolomonRemainder(data, degree) {
  const divisor = reedSolomonDivisor(degree);
  const result = Array(degree).fill(0);
  data.forEach((byte) => {
    const factor = byte ^ result.shift();
    result.push(0);
    divisor.forEach((coefficient, index) => {
      result[index] ^= gfMultiply(coefficient, factor);
    });
  });
  return result;
}

function reedSolomonDivisor(degree) {
  const result = Array(degree).fill(0);
  result[degree - 1] = 1;
  let root = 1;
  for (let i = 0; i < degree; i += 1) {
    for (let j = 0; j < result.length; j += 1) {
      result[j] = gfMultiply(result[j], root);
      if (j + 1 < result.length) result[j] ^= result[j + 1];
    }
    root = gfMultiply(root, 0x02);
  }
  return result;
}

function gfMultiply(x, y) {
  let result = 0;
  for (let i = 7; i >= 0; i -= 1) {
    result = ((result << 1) ^ (((result >>> 7) & 1) ? 0x11d : 0)) & 0xff;
    if (((y >>> i) & 1) !== 0) result ^= x;
  }
  return result;
}

function paidBlock(reg) {
  return `
    <div class="payment-note success-note">
      Payment received locally. Your registration is now submitted for admin review.
    </div>
    <div class="detail-grid">
      ${detailItem("Payment Method", reg.paymentMethod)}
      ${detailItem("Reference", reg.paymentReference)}
      ${detailItem("Paid On", formatDate(reg.paidAt))}
      ${detailItem("Team", `${reg.teamName} (${reg.teamSize})`)}
    </div>
  `;
}

async function handlePayment(event) {
  event.preventDefault();
  const button = event.submitter;
  button.disabled = true;
  try {
    const form = new FormData(event.currentTarget);
    const transactionId = String(form.get("transactionId") || "").trim();
    if (transactionId.length < 6) {
      throw new Error("Enter the UPI transaction/reference ID after payment");
    }
    const data = await api("/api/student/payment", {
      method: "POST",
      body: JSON.stringify({ method: "UPI QR", transactionId })
    });
    state.registration = data.registration;
    studentView();
  } catch (error) {
    setMessage("error", error.message);
  } finally {
    button.disabled = false;
  }
}

async function loadStudentDashboard() {
  const data = await api("/api/student/dashboard");
  state.student = data.student;
  state.registration = data.registration;
}

async function loadAdminDashboard() {
  state.adminData = await api("/api/admin/registrations");
  if (!state.selectedRegistrationId && state.adminData.registrations.length) {
    state.selectedRegistrationId = state.adminData.registrations[0].id;
  }
}

function adminView() {
  const data = state.adminData || { registrations: [], competitions: [], totals: {} };
  const filtered = filteredRegistrations(data.registrations);
  const metrics = adminMetrics(data.registrations);
  const selected = data.registrations.find((item) => item.id === state.selectedRegistrationId) || filtered[0] || data.registrations[0];
  if (selected) state.selectedRegistrationId = selected.id;

  const body = `
    <div class="stats-grid">
      ${statCard("Students", data.totals.students || 0)}
      ${statCard("Registrations", data.totals.registrations || 0)}
      ${statCard("Paid Fees", data.totals.paid || 0)}
      ${statCard("Awaiting Payment", metrics.awaitingPayment)}
      ${statCard("Verified", metrics.verified)}
      ${statCard("Collected", money.format(data.totals.collected || 0))}
    </div>

    ${adminInsights(data, metrics)}

    <div class="toolbar">
      <input data-filter="search" value="${escapeHtml(state.filters.search)}" placeholder="Search student, college, email" />
      <select data-filter="competition">
        <option value="all">All competitions</option>
        ${data.competitions.map((item) => `<option value="${escapeHtml(item.id)}" ${state.filters.competition === item.id ? "selected" : ""}>${escapeHtml(item.name)}</option>`).join("")}
      </select>
      <select data-filter="payment">
        <option value="all" ${state.filters.payment === "all" ? "selected" : ""}>All payments</option>
        <option value="Paid" ${state.filters.payment === "Paid" ? "selected" : ""}>Paid</option>
        <option value="Pending" ${state.filters.payment === "Pending" ? "selected" : ""}>Pending</option>
      </select>
      <select data-filter="status">
        <option value="all" ${state.filters.status === "all" ? "selected" : ""}>All statuses</option>
        <option value="Awaiting Payment" ${state.filters.status === "Awaiting Payment" ? "selected" : ""}>Awaiting payment</option>
        <option value="Submitted" ${state.filters.status === "Submitted" ? "selected" : ""}>Submitted</option>
        <option value="Verified" ${state.filters.status === "Verified" ? "selected" : ""}>Verified</option>
        <option value="Rejected" ${state.filters.status === "Rejected" ? "selected" : ""}>Rejected</option>
      </select>
      <button class="ghost-btn" data-refresh type="button">Refresh</button>
      <button class="primary-btn" data-export type="button">Export CSV</button>
    </div>

    <div class="admin-layout">
      <section class="table-panel">
        ${filtered.length ? registrationsTable(filtered) : `<div class="empty-state">No registrations found.</div>`}
      </section>
      <aside class="detail-panel">
        ${selected ? selectedDetail(selected) : `<h3>No Entry</h3><p class="empty-state">Registrations will appear here.</p>`}
      </aside>
    </div>
  `;

  shell("Admin Dashboard", `${COLLEGE_NAME} registrations and fee collection`, body);
  bindAdminEvents();
}

function statCard(label, value) {
  return `
    <div class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function adminMetrics(registrations) {
  const total = registrations.length;
  const paid = registrations.filter((item) => item.paymentStatus === "Paid").length;
  const verified = registrations.filter((item) => item.adminStatus === "Verified").length;
  const awaitingPayment = registrations.filter((item) => item.adminStatus === "Awaiting Payment").length;
  const pendingPayment = registrations.filter((item) => item.paymentStatus !== "Paid").length;
  return {
    total,
    paid,
    verified,
    awaitingPayment,
    pendingPayment,
    paymentRate: total ? Math.round((paid / total) * 100) : 0,
    verificationRate: total ? Math.round((verified / total) * 100) : 0
  };
}

function adminInsights(data, metrics) {
  return `
    <div class="insight-grid">
      <section class="insight-panel">
        <div class="insight-head">
          <span>Collection Progress</span>
          <strong>${metrics.paymentRate}%</strong>
        </div>
        <div class="meter"><span style="width: ${metrics.paymentRate}%"></span></div>
        <div class="insight-row">
          <span>Pending payment</span>
          <strong>${metrics.pendingPayment}</strong>
        </div>
        <div class="insight-row">
          <span>Verified entries</span>
          <strong>${metrics.verified}</strong>
        </div>
      </section>
      <section class="insight-panel">
        <div class="insight-head">
          <span>Competition Summary</span>
          <strong>${data.competitions.length}</strong>
        </div>
        <div class="summary-list">
          ${data.competitions.map((competition) => competitionSummaryRow(competition, data.registrations)).join("")}
        </div>
      </section>
    </div>
  `;
}

function competitionSummaryRow(competition, registrations) {
  const count = registrations.filter((item) => item.competitionId === competition.id).length;
  const paid = registrations.filter((item) => item.competitionId === competition.id && item.paymentStatus === "Paid").length;
  return `
    <div class="summary-row">
      <div>
        <strong>${escapeHtml(competition.name)}</strong>
        <span>${escapeHtml(competition.venue)} | ${formatDate(competition.date)}</span>
      </div>
      <em>${count} entries | ${paid} paid</em>
    </div>
  `;
}

function filteredRegistrations(registrations) {
  const query = state.filters.search.trim().toLowerCase();
  return registrations.filter((item) => {
    const searchable = [
      item.student?.fullName,
      item.student?.email,
      item.student?.phone,
      item.student?.collegeName,
      item.student?.department,
      item.competition?.name,
      item.teamName,
      item.paymentReference
    ]
      .join(" ")
      .toLowerCase();
    const matchesSearch = !query || searchable.includes(query);
    const matchesPayment = state.filters.payment === "all" || item.paymentStatus === state.filters.payment;
    const matchesStatus = state.filters.status === "all" || item.adminStatus === state.filters.status;
    const matchesCompetition = state.filters.competition === "all" || item.competitionId === state.filters.competition;
    return matchesSearch && matchesPayment && matchesStatus && matchesCompetition;
  });
}

function registrationsTable(registrations) {
  return `
    <div class="table-scroll">
      <table>
        <thead>
          <tr>
            <th>Student</th>
            <th>College</th>
            <th>Competition</th>
            <th>Fee</th>
            <th>Payment</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          ${registrations.map(registrationRow).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function registrationRow(item) {
  return `
    <tr>
      <td class="name-cell">
        <strong>${escapeHtml(item.student?.fullName)}</strong>
        <span>${escapeHtml(item.student?.email)}</span>
      </td>
      <td>${escapeHtml(item.student?.collegeName || "-")}</td>
      <td>${escapeHtml(item.competition?.name || "-")}</td>
      <td>${money.format(item.feeAmount || 0)}</td>
      <td><span class="status-pill ${statusClass(item.paymentStatus)}">${escapeHtml(item.paymentStatus)}</span></td>
      <td><span class="status-pill ${statusClass(item.adminStatus)}">${escapeHtml(item.adminStatus)}</span></td>
      <td><button class="row-btn" data-select="${escapeHtml(item.id)}" type="button">View</button></td>
    </tr>
  `;
}

function selectedDetail(item) {
  const paymentComplete = item.paymentStatus === "Paid";
  const actionDisabled = paymentComplete ? "" : "disabled";
  return `
    <h3>${escapeHtml(item.student?.fullName || "Student")}</h3>
    <div class="side-list">
      ${sideItem("Email", item.student?.email)}
      ${sideItem("Phone", item.student?.phone)}
      ${sideItem("College", item.student?.collegeName)}
      ${sideItem("College Code", item.student?.collegeCode || "-")}
      ${sideItem("Department", `${item.student?.department || "-"} | ${item.student?.year || "-"}`)}
      ${sideItem("Roll Number", item.student?.rollNumber)}
      ${sideItem("Competition", item.competition?.name)}
      ${sideItem("Team", `${item.teamName} (${item.teamSize})`)}
      ${sideItem("Members", teamMembersText(item))}
      ${sideItem("Fee", money.format(item.feeAmount || 0))}
      ${sideItem("Payment", `${item.paymentStatus}${item.paymentReference ? ` | ${item.paymentReference}` : ""}`)}
      ${sideItem("Admin Status", item.adminStatus)}
      ${sideItem("Registered", formatDate(item.createdAt))}
    </div>
    ${paymentComplete ? "" : `<div class="message error show">Verification and rejection unlock after the student submits payment.</div>`}
    <div class="status-actions">
      <button class="ghost-btn" data-status="Submitted" data-status-id="${escapeHtml(item.id)}" type="button" ${actionDisabled}>Keep Pending</button>
      <button class="primary-btn" data-status="Verified" data-status-id="${escapeHtml(item.id)}" type="button" ${actionDisabled}>Verify</button>
      <button class="danger-btn" data-status="Rejected" data-status-id="${escapeHtml(item.id)}" type="button" ${actionDisabled}>Reject</button>
    </div>
    <div class="message" data-message></div>
  `;
}

function sideItem(label, value) {
  return `
    <div>
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value || "-")}</strong>
    </div>
  `;
}

function bindAdminEvents() {
  document.querySelectorAll("[data-filter]").forEach((input) => {
    if (input.tagName === "INPUT") {
      input.addEventListener("input", () => {
        const cursor = input.selectionStart;
        const filterKey = input.dataset.filter;
        state.filters[filterKey] = input.value;
        adminView();
        const nextInput = document.querySelector(`[data-filter="${filterKey}"]`);
        if (nextInput) {
          nextInput.focus();
          nextInput.setSelectionRange(cursor, cursor);
        }
      });
      return;
    }

    input.addEventListener("change", () => {
      state.filters[input.dataset.filter] = input.value;
      adminView();
    });
  });

  document.querySelectorAll("[data-select]").forEach((button) => {
    button.addEventListener("click", () => {
      state.selectedRegistrationId = button.dataset.select;
      adminView();
    });
  });

  document.querySelectorAll("[data-status]").forEach((button) => {
    button.addEventListener("click", async () => {
      button.disabled = true;
      try {
        const registrationId = button.dataset.statusId || state.selectedRegistrationId;
        if (!registrationId) throw new Error("Select a registration first");
        await api(`/api/admin/registrations/${registrationId}/status`, {
          method: "PATCH",
          body: JSON.stringify({ status: button.dataset.status })
        });
        state.selectedRegistrationId = registrationId;
        await loadAdminDashboard();
        adminView();
      } catch (error) {
        setMessage("error", error.message);
      } finally {
        button.disabled = false;
      }
    });
  });

  const exportButton = document.querySelector("[data-export]");
  if (exportButton) {
    exportButton.addEventListener("click", exportCsv);
  }

  const refreshButton = document.querySelector("[data-refresh]");
  if (refreshButton) {
    refreshButton.addEventListener("click", async () => {
      refreshButton.disabled = true;
      try {
        await loadAdminDashboard();
        adminView();
      } catch (error) {
        setMessage("error", error.message);
      } finally {
        refreshButton.disabled = false;
      }
    });
  }
}

function exportCsv() {
  const rows = filteredRegistrations(state.adminData?.registrations || []);
  const headers = [
    "Student Name",
    "Email",
    "Phone",
    "College",
    "College Code",
    "Department",
    "Year",
    "Roll Number",
    "Competition",
    "Team",
    "Team Members",
    "Team Size",
    "Fee",
    "Payment Status",
    "Payment Method",
    "Payment Reference",
    "Admin Status"
  ];
  const csvRows = [
    headers,
    ...rows.map((item) => [
      item.student?.fullName,
      item.student?.email,
      item.student?.phone,
      item.student?.collegeName,
      item.student?.collegeCode,
      item.student?.department,
      item.student?.year,
      item.student?.rollNumber,
      item.competition?.name,
      item.teamName,
      teamMembersText(item),
      item.teamSize,
      item.feeAmount,
      item.paymentStatus,
      item.paymentMethod,
      item.paymentReference,
      item.adminStatus
    ])
  ];
  const csv = csvRows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replaceAll('"', '""')}"`).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "competition-registrations.csv";
  link.click();
  URL.revokeObjectURL(url);
}

async function handleLogout() {
  try {
    await api("/api/auth/logout", { method: "POST", body: "{}" });
  } catch {
    // Local logout should still work even if the server session is already gone.
  }
  clearAuth();
  state.role = "student";
  state.authMode = "login";
  authView();
}

async function boot() {
  try {
    await Promise.all([loadCompetitions(), loadPaymentSettings()]);
    if (state.token && state.roleStored === "student") {
      await loadStudentDashboard();
      studentView();
      return;
    }
    if (state.token && state.roleStored === "admin") {
      await loadAdminDashboard();
      adminView();
      return;
    }
  } catch {
    clearAuth();
  }
  authView();
}

boot();
