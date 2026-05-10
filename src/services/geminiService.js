const API_BASE = process.env.REACT_APP_API_BASE || "http://localhost:5000";

export const fetchConsumerInsights = async (productName) => {
  const response = await fetch(`${API_BASE}/api/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ productName })
  });
  if (!response.ok) {
    throw new Error("Failed to analyze product");
  }
  const data = await response.json();
  return data.result;
};

export const createSharedReport = async (report) => {
  const response = await fetch(`${API_BASE}/api/reports`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ report })
  });
  if (!response.ok) {
    throw new Error("Failed to create share link");
  }
  return response.json();
};

export const fetchSharedReport = async (id) => {
  const response = await fetch(`${API_BASE}/api/reports/${id}`);
  if (!response.ok) {
    throw new Error("Shared report not found");
  }
  const data = await response.json();
  return data.report;
};
