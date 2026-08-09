const API_BASE = '/api';

async function request(path, options = {}) {
  const token = localStorage.getItem('token');
  const headers = { 'Content-Type': 'application/json', ...options.headers };
  if (token) headers['Authorization'] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error || 'Request failed');
  return data;
}

export const api = {
  auth: {
    login: (email, password) => request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    register: (email, password) => request('/auth/register', { method: 'POST', body: JSON.stringify({ email, password }) }),
  },
  alarms: {
    list: () => request('/alarms'),
    create: (data) => request('/alarms', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/alarms/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id, opts) => request(`/alarms/${id}${opts?.family ? '?family=1' : ''}`, { method: 'DELETE' }),
    toggle: (id) => request(`/alarms/${id}/toggle`, { method: 'PATCH' }),
    toggleLock: (id) => request(`/alarms/${id}/lock`, { method: 'PATCH' }),
    addException: (id, date) => request(`/alarms/${id}/exceptions`, { method: 'POST', body: JSON.stringify({ date }) }),
    removeException: (id, date) => request(`/alarms/${id}/exceptions/${date}`, { method: 'DELETE' }),
    generateSchedule: (parent_alarm_id, schedule) => request('/alarms/generate-schedule', { method: 'POST', body: JSON.stringify({ parent_alarm_id, schedule }) }),
    recurringList: () => request('/alarms/recurring'),
    recurringCreate: (data) => request('/alarms/recurring', { method: 'POST', body: JSON.stringify(data) }),
    recurringDelete: (id) => request(`/alarms/recurring/${id}`, { method: 'DELETE' }),
  },
  tags: {
    list: () => request('/tags'),
    create: (data) => request('/tags', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/tags/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/tags/${id}`, { method: 'DELETE' }),
  },
  memos: {
    get: (tagId) => request(`/memos/${tagId}`),
    update: (tagId, content) => request(`/memos/${tagId}`, { method: 'PUT', body: JSON.stringify({ content }) }),
  },
  workday: {
    today: () => request('/workday/today'),
    history: () => request('/workday/history'),
    answer: (is_work_day) => request('/workday/answer', { method: 'POST', body: JSON.stringify({ is_work_day }) }),
  },
  arcs: {
    list: () => request('/arcs'),
    create: (data) => request('/arcs', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => request(`/arcs/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    delete: (id) => request(`/arcs/${id}`, { method: 'DELETE' }),
    toggle: (id) => request(`/arcs/${id}/toggle`, { method: 'PATCH' }),
    move: (id, offset_minutes) => request(`/arcs/${id}/move`, { method: 'PATCH', body: JSON.stringify({ offset_minutes }) }),
    addException: (id, date) => request(`/arcs/${id}/exceptions`, { method: 'POST', body: JSON.stringify({ date }) }),
    removeException: (id, date) => request(`/arcs/${id}/exceptions/${date}`, { method: 'DELETE' }),
  },
  dayEvents: {
    list: () => request('/day-events'),
    set: (date, type) => request(`/day-events/${date}`, { method: 'PUT', body: JSON.stringify({ type: type || null }) }),
  },
};
