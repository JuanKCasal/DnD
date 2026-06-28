const BASE = window.location.hostname === 'localhost'
  ? 'http://localhost:8000/api/v1'
  : 'https://dnd-production-2c64.up.railway.app/api/v1';

function getToken() {
  return localStorage.getItem('dnd_token');
}

async function request(method, path, body = null) {
  const headers = { 'Content-Type': 'application/json' };
  const token = getToken();
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const opts = { method, headers };
  if (body) opts.body = JSON.stringify(body);

  const res = await fetch(`${BASE}${path}`, opts);

  if (res.status === 401) {
    window.dispatchEvent(new Event('auth:expired'));
    throw new Error('Session expired');
  }

  const json = await res.json();
  if (!res.ok) throw new Error(json.error?.message || 'Error del servidor');
  return json; // caller accesses .data and .meta
}

export const api = {
  get:   (path)        => request('GET',    path),
  post:  (path, body)  => request('POST',   path, body),
  put:   (path, body)  => request('PUT',    path, body),
  patch: (path, body)  => request('PATCH',  path, body),
  del:   (path)        => request('DELETE', path),
};
