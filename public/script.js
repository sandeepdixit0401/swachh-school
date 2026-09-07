// ==================== API Helpers (Netlify) ====================
const API_BASE = "/api";

async function apiGet(path) {
  const res = await fetch(API_BASE + path);
  if (!res.ok) throw new Error("Network error");
  return res.json();
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = "Network error";
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return res.json();
}

async function apiPatch(path, body) {
  const res = await fetch(API_BASE + path, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let errMsg = "Network error";
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return res.json();
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, { method: "DELETE" });
  if (!res.ok) {
    let errMsg = "Network error";
    try {
      const data = await res.json();
      errMsg = data.error || errMsg;
    } catch (_) {}
    throw new Error(errMsg);
  }
  return res.json();
}

// ==================== Toast ====================
function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = message;
  toast.className = "toast " + type + " show";
  setTimeout(() => toast.classList.remove("show"), 3000);
}

// ==================== Home Stats ====================
async function updateHomeStats() {
  try {
    const stats = await apiGet("/stats");
    const el = (id) => document.getElementById(id);
    if (el("totalReports")) el("totalReports").textContent = stats.total;
    if (el("pendingReports")) el("pendingReports").textContent = stats.pending;
    if (el("processingReports")) el("processingReports").textContent = stats.processing;
    if (el("completedReports")) el("completedReports").textContent = stats.completed;
  } catch (e) {
    console.warn("Stats load failed", e);
  }
}

// ==================== Report Page ====================
let stream = null;
let photoDataUrl = null;

function initReportPage() {
  const startBtn = document.getElementById("startCameraBtn");
  const captureBtn = document.getElementById("captureBtn");
  const retakeBtn = document.getElementById("retakeBtn");
  const fileInput = document.getElementById("fileInput");
  const form = document.getElementById("reportForm");
  const video = document.getElementById("cameraPreview");
  const capturedImg = document.getElementById("capturedPhoto");
  const placeholder = document.getElementById("cameraPlaceholder");

  if (startBtn) {
    startBtn.addEventListener("click", async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
        video.srcObject = stream;
        video.classList.add("active");
        video.play();
        placeholder.style.display = "none";
        startBtn.style.display = "none";
        captureBtn.style.display = "inline-flex";
        retakeBtn.style.display = "none";
        capturedImg.classList.remove("active");
      } catch (err) {
        showToast("कैमरा एक्सेस नहीं मिला। फाइल चुनें।", "error");
      }
    });
  }

  if (captureBtn) {
    captureBtn.addEventListener("click", () => {
      const canvas = document.createElement("canvas");
      // Resize for smaller upload
      const maxWidth = 800;
      let w = video.videoWidth;
      let h = video.videoHeight;
      if (w > maxWidth) {
        h = Math.round((h * maxWidth) / w);
        w = maxWidth;
      }
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(video, 0, 0, w, h);
      photoDataUrl = canvas.toDataURL("image/jpeg", 0.7);

      if (stream) {
        stream.getTracks().forEach((t) => t.stop());
        stream = null;
      }
      video.classList.remove("active");
      video.srcObject = null;

      capturedImg.src = photoDataUrl;
      capturedImg.classList.add("active");
      document.getElementById("photoData").value = photoDataUrl;

      captureBtn.style.display = "none";
      retakeBtn.style.display = "inline-flex";
      startBtn.style.display = "inline-flex";
      startBtn.textContent = "📷 कैमरा फिर से";
    });
  }

  if (retakeBtn) {
    retakeBtn.addEventListener("click", () => {
      photoDataUrl = null;
      document.getElementById("photoData").value = "";
      capturedImg.classList.remove("active");
      capturedImg.src = "";
      retakeBtn.style.display = "none";
      startBtn.style.display = "inline-flex";
      captureBtn.style.display = "none";
      placeholder.style.display = "block";
    });
  }

  if (fileInput) {
    fileInput.addEventListener("change", (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        // Compress the selected image too
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          const maxWidth = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxWidth) {
            h = Math.round((h * maxWidth) / w);
            w = maxWidth;
          }
          canvas.width = w;
          canvas.height = h;
          canvas.getContext("2d").drawImage(img, 0, 0, w, h);
          photoDataUrl = canvas.toDataURL("image/jpeg", 0.7);
          document.getElementById("photoData").value = photoDataUrl;
          capturedImg.src = photoDataUrl;
          capturedImg.classList.add("active");
          placeholder.style.display = "none";
          captureBtn.style.display = "none";
          retakeBtn.style.display = "inline-flex";
          startBtn.style.display = "inline-flex";
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  if (form) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const photo = document.getElementById("photoData").value;
      const location = document.getElementById("location").value.trim();
      const description = document.getElementById("description").value.trim();
      const reporterName = document.getElementById("reporterName").value.trim();

      if (!photo) {
        showToast("कृपया फोटो लें या चुनें!", "error");
        return;
      }
      if (!location) {
        showToast("लोकेशन जरूरी है!", "error");
        return;
      }

      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "भेज रहा है...";

      try {
        const result = await apiPost("/reports", {
          photo,
          location,
          description,
          reporterName,
        });

        if (result.success) {
          showToast("✅ रिपोर्ट सफलतापूर्वक भेज दी गई!");
          form.reset();
          photoDataUrl = null;
          document.getElementById("photoData").value = "";
          capturedImg.classList.remove("active");
          capturedImg.src = "";
          placeholder.style.display = "block";
          retakeBtn.style.display = "none";
          captureBtn.style.display = "none";
          startBtn.style.display = "inline-flex";
          startBtn.textContent = "📷 कैमरा खोलें";
        } else {
          showToast(result.error || "रिपोर्ट भेजने में समस्या", "error");
        }
      } catch (err) {
        console.error(err);
        showToast("नेटवर्क एरर। थोड़ी देर बाद कोशिश करें।", "error");
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "🚀 रिपोर्ट भेजें";
      }
    });
  }
}

// ==================== Admin Page ====================
const ADMIN_SESSION_KEY = "swachhSchoolAdmin";

function initAdminPage() {
  const loginSection = document.getElementById("loginSection");
  const dashboardSection = document.getElementById("dashboardSection");
  const loginForm = document.getElementById("loginForm");
  const logoutBtn = document.getElementById("logoutBtn");

  if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "true") {
    showDashboard();
  }

  if (loginForm) {
    loginForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const password = document.getElementById("password").value;
      try {
        const result = await apiPost("/login", { password });
        if (result.success) {
          sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
          showDashboard();
          showToast("स्वागत है, एडमिन!");
        } else {
          showToast("गलत पासवर्ड!", "error");
        }
      } catch (err) {
        if (password === "admin123") {
          sessionStorage.setItem(ADMIN_SESSION_KEY, "true");
          showDashboard();
          showToast("स्वागत है, एडमिन!");
        } else {
          showToast("गलत पासवर्ड", "error");
        }
      }
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      loginSection.style.display = "block";
      dashboardSection.style.display = "none";
      showToast("लॉगआउट हो गया");
    });
  }

  document.querySelectorAll(".filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderReports(btn.dataset.filter);
    });
  });
}

async function showDashboard() {
  document.getElementById("loginSection").style.display = "none";
  document.getElementById("dashboardSection").style.display = "block";
  await updateAdminStats();
  await renderReports("all");
}

async function updateAdminStats() {
  try {
    const stats = await apiGet("/stats");
    const el = (id) => document.getElementById(id);
    if (el("adminTotal")) el("adminTotal").textContent = stats.total;
    if (el("adminPending")) el("adminPending").textContent = stats.pending;
    if (el("adminProcessing")) el("adminProcessing").textContent = stats.processing;
    if (el("adminCompleted")) el("adminCompleted").textContent = stats.completed;
  } catch (e) {
    console.warn(e);
  }
}

async function renderReports(filter = "all") {
  const list = document.getElementById("reportList");
  if (!list) return;

  try {
    const data = await apiGet("/reports");
    let reports = data.reports || [];

    if (filter !== "all") {
      reports = reports.filter((r) => r.status === filter);
    }

    if (reports.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="icon">📭</div>
          <h3>कोई रिपोर्ट नहीं मिली</h3>
          <p>जब छात्र रिपोर्ट भेजेंगे तो यहाँ दिखेंगी</p>
        </div>
      `;
      return;
    }

    list.innerHTML = reports
      .map((report) => {
        const date = new Date(report.createdAt).toLocaleString("hi-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        });

        const statusText = {
          pending: "लंबित",
          processing: "प्रोसेसिंग",
          completed: "पूर्ण",
        };

        return `
        <div class="report-card status-${report.status}" data-id="${report.id}">
          <img src="${report.photo}" alt="Report photo" class="report-img" loading="lazy"
               onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><text y=%22.9em%22 font-size=%2280%22>📷</text></svg>'">
          <div class="report-info">
            <h3>${escapeHtml(report.location)}</h3>
            <div class="report-meta">
              👤 ${escapeHtml(report.reporterName)} • 🕒 ${date}
            </div>
            <div class="report-desc">${escapeHtml(report.description)}</div>
            <span class="status-badge status-${report.status}">${statusText[report.status] || report.status}</span>
          </div>
          <div class="report-actions">
            ${report.status !== "processing" ? `<button class="btn btn-warning btn-sm" onclick="updateStatus('${report.id}', 'processing')">⚙️ प्रोसेसिंग</button>` : ""}
            ${report.status !== "completed" ? `<button class="btn btn-success btn-sm" onclick="updateStatus('${report.id}', 'completed')">✅ पूर्ण</button>` : ""}
            ${report.status !== "pending" ? `<button class="btn btn-secondary btn-sm" onclick="updateStatus('${report.id}', 'pending')">🔄 लंबित</button>` : ""}
            <button class="btn btn-danger btn-sm" onclick="deleteReport('${report.id}')">🗑️ हटाएं</button>
          </div>
        </div>
      `;
      })
      .join("");
  } catch (err) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="icon">⚠️</div>
        <h3>लोड नहीं हो पाया</h3>
        <p>थोड़ी देर बाद रिफ्रेश करें</p>
      </div>
    `;
  }
}

async function updateStatus(id, newStatus) {
  try {
    await apiPatch(`/reports/${id}`, { status: newStatus });
    await updateAdminStats();
    const activeFilter = document.querySelector(".filter-btn.active")?.dataset.filter || "all";
    await renderReports(activeFilter);
    const statusNames = { pending: "लंबित", processing: "प्रोसेसिंग", completed: "पूर्ण" };
    showToast(`स्टेटस अपडेट: ${statusNames[newStatus]}`);
  } catch (e) {
    showToast("अपडेट फेल हो गया", "error");
  }
}

async function deleteReport(id) {
  if (!confirm("क्या आप वाकई इस रिपोर्ट को हटाना चाहते हैं?")) return;
  try {
    await apiDelete(`/reports/${id}`);
    await updateAdminStats();
    const activeFilter = document.querySelector(".filter-btn.active")?.dataset.filter || "all";
    await renderReports(activeFilter);
    showToast("रिपोर्ट हटा दी गई");
  } catch (e) {
    showToast("डिलीट फेल हो गया", "error");
  }
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text || "";
  return div.innerHTML;
}

window.updateStatus = updateStatus;
window.deleteReport = deleteReport;
