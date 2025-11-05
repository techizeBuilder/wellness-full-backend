const API = process.env.API_BASE || 'http://localhost:5000';
const email = process.env.TEST_ADMIN_EMAIL || 'admin@zenovia.com';
const password = process.env.TEST_ADMIN_PASSWORD || 'admin123';

(async () => {
  try {
    const res = await fetch(`${API}/api/admin/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const text = await res.text();
    console.log('Status:', res.status);
    try {
      console.log('Body:', JSON.parse(text));
    } catch (e) {
      console.log('Body (raw):', text);
    }
  } catch (err) {
    console.error('Request failed:', err.message || err);
  }
})();
