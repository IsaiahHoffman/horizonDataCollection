// public/ocr/api/client.js

export async function requestJSON(url, options = {}) {
  const res = await fetch(url, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // ignore JSON parse failure
  }

  if (!res.ok) {
    const err = new Error(
      data?.error || `HTTP ${res.status} ${res.statusText}`
    );
    err.status = res.status;
    err.data = data;
    throw err;
  }

  return data;
}