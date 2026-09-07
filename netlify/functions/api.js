const { connectLambda, getStore } = require("@netlify/blobs");
const { randomUUID } = require("crypto");

const REPORTS_KEY = "all-reports";
const ADMIN_PASSWORD = "admin123";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
    "Content-Type": "application/json",
  };
}

function json(status, data) {
  return {
    statusCode: status,
    headers: corsHeaders(),
    body: JSON.stringify(data),
  };
}

function getReportsStore() {
  return getStore({ name: "swachh-reports" });
}

function getImagesStore() {
  return getStore({ name: "swachh-images" });
}

async function loadReports() {
  const store = getReportsStore();
  const data = await store.get(REPORTS_KEY, { type: "json" });
  return Array.isArray(data) ? data : [];
}

async function saveReports(reports) {
  const store = getReportsStore();
  await store.setJSON(REPORTS_KEY, reports);
}

function getStats(reports) {
  return {
    total: reports.length,
    pending: reports.filter((r) => r.status === "pending").length,
    processing: reports.filter((r) => r.status === "processing").length,
    completed: reports.filter((r) => r.status === "completed").length,
  };
}

exports.handler = async (event) => {
  // CRITICAL: Must call this first for Netlify Blobs in Lambda compatibility mode
  try {
    connectLambda(event);
  } catch (e) {
    console.warn("connectLambda warning:", e.message);
  }

  // Handle CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: corsHeaders(), body: "" };
  }

  // Path can come as /.netlify/functions/api/reports or /api/reports or /reports depending on redirect
  let path = event.path || "/";
  path = path
    .replace(/^\/\.netlify\/functions\/api/, "")
    .replace(/^\/api/, "")
    .replace(/\/$/, "") || "/";
  if (!path.startsWith("/")) path = "/" + path;
  const method = event.httpMethod;

  try {
    // GET /reports or /stats
    if (method === "GET") {
      if (path === "/stats" || path.endsWith("/stats")) {
        const reports = await loadReports();
        return json(200, getStats(reports));
      }
      if (path === "/reports" || path.endsWith("/reports") || path === "/" || path === "") {
        const reports = await loadReports();
        // newest first
        reports.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        return json(200, reports);
      }

      // GET /image/:id
      const imageMatch = path.match(/\/image\/([^/]+)/);
      if (imageMatch) {
        const id = imageMatch[1];
        const images = getImagesStore();
        const photo = await images.get(id);
        if (!photo) return json(404, { error: "Image not found" });
        return {
          statusCode: 200,
          headers: {
            "Content-Type": "image/jpeg",
            "Cache-Control": "public, max-age=31536000",
            "Access-Control-Allow-Origin": "*",
          },
          body: photo,
          isBase64Encoded: true,
        };
      }
    }

    // POST /reports
    if (method === "POST" && (path === "/reports" || path.endsWith("/reports"))) {
      const body = JSON.parse(event.body || "{}");
      let { photo, location, description, reporterName } = body;

      if (!photo) {
        return json(400, { error: "Photo is required" });
      }

      // Remove data URL prefix if present
      if (photo.includes(",")) {
        photo = photo.split(",")[1];
      }

      // Limit size roughly (base64 ~ 1.5MB raw = ~2MB base64 is ok for free tier demos)
      if (photo.length > 2_500_000) {
        return json(400, { error: "Image too large. Please take a smaller photo." });
      }

      const id = "R" + randomUUID().replace(/-/g, "").slice(0, 12);
      const now = new Date().toISOString();

      // Save image
      const images = getImagesStore();
      await images.set(id, photo, { metadata: { contentType: "image/jpeg" } });

      const report = {
        id,
        photo: `/api/image/${id}`,
        location,
        description,
        reporterName,
        status: "pending",
        createdAt: now,
        updatedAt: now,
      };

      const reports = await loadReports();
      reports.push(report);
      await saveReports(reports);

      return json(201, { success: true, report });
    }

    // PATCH /reports/:id
    if (method === "PATCH") {
      const match = path.match(/\/reports\/([^/]+)/);
      if (!match) return json(404, { error: "Not found" });
      const id = match[1];
      const body = JSON.parse(event.body || "{}");
      const newStatus = body.status;
      if (!["pending", "processing", "completed"].includes(newStatus)) {
        return json(400, { error: "Invalid status" });
      }

      const reports = await loadReports();
      const idx = reports.findIndex((r) => r.id === id);
      if (idx === -1) return json(404, { error: "Report not found" });

      reports[idx].status = newStatus;
      reports[idx].updatedAt = new Date().toISOString();
      await saveReports(reports);

      return json(200, { success: true });
    }

    // DELETE /reports/:id
    if (method === "DELETE") {
      const match = path.match(/\/reports\/([^/]+)/);
      if (!match) return json(404, { error: "Not found" });
      const id = match[1];

      let reports = await loadReports();
      const exists = reports.some((r) => r.id === id);
      if (!exists) return json(404, { error: "Report not found" });

      reports = reports.filter((r) => r.id !== id);
      await saveReports(reports);

      // Also delete image
      try {
        const images = getImagesStore();
        await images.delete(id);
      } catch (e) {}

      return json(200, { success: true });
    }

    return json(404, { error: "Not found" });
  } catch (err) {
    console.error(err);
    return json(500, { error: "Server error: " + (err.message || "unknown") });
  }
};
