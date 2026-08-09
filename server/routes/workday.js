import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

function todayStr() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr, days) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + days);
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
}

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

function suspendDayAlarms(userId, todayDateStr) {
  const dow = dayOfWeek(todayDateStr);
  const allAlarms = queryAll('SELECT * FROM alarms WHERE user_id = ?', [userId]);

  // Next scheduled day: first day forward (up to 14) that is not explicitly
  // logged as a day off AND has at least one alarm scheduled on that weekday.
  let resumeDate = addDays(todayDateStr, 14);
  for (let i = 1; i <= 14; i++) {
    const candidate = addDays(todayDateStr, i);
    const log = queryOne('SELECT * FROM work_day_log WHERE user_id = ? AND date = ?', [userId, candidate]);
    if (log && !log.is_work_day) continue;
    const cdow = dayOfWeek(candidate);
    if (allAlarms.length === 0 || allAlarms.some(a => (a.days_of_week || '').split(',').includes(String(cdow)))) {
      resumeDate = candidate;
      break;
    }
  }

  const existing = queryOne('SELECT * FROM work_suspension WHERE user_id = ?', [userId]);
  if (existing) {
    run('UPDATE work_suspension SET resume_date = ?, created_at = datetime(\'now\') WHERE user_id = ?', [resumeDate, userId]);
  } else {
    run('INSERT INTO work_suspension (user_id, resume_date) VALUES (?, ?)', [userId, resumeDate]);
  }

  run('UPDATE alarms SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [userId, `%,${dow},%`]);
  run('UPDATE arcs SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [userId, `%,${dow},%`]);
}

function resumeDayAlarms(userId) {
  run('UPDATE alarms SET is_active = 1, updated_at = datetime(\'now\') WHERE user_id = ?', [userId]);
  run('UPDATE arcs SET is_active = 1, updated_at = datetime(\'now\') WHERE user_id = ?', [userId]);
  run('DELETE FROM work_suspension WHERE user_id = ?', [userId]);
}

function autoResume(userId, todayDateStr) {
  const suspension = queryOne('SELECT * FROM work_suspension WHERE user_id = ?', [userId]);
  if (!suspension) return false;
  if (todayDateStr >= suspension.resume_date) {
    resumeDayAlarms(userId);
    // Persist today as a work day so the toggle stays ON automatically.
    const existing = queryOne('SELECT * FROM work_day_log WHERE user_id = ? AND date = ?', [userId, todayDateStr]);
    if (existing) {
      run('UPDATE work_day_log SET is_work_day = 1, answered_at = datetime(\'now\') WHERE id = ?', [existing.id]);
    } else {
      run('INSERT INTO work_day_log (user_id, date, is_work_day) VALUES (?, ?, 1)', [userId, todayDateStr]);
    }
    return true;
  }
  return false;
}

router.get('/today', async (req, res) => {
  await getDb();
  const today = todayStr();
  const resumed = autoResume(req.user.id, today);
  if (resumed) return res.json({ date: today, is_work_day: 1 });
  const log = queryOne('SELECT * FROM work_day_log WHERE user_id = ? AND date = ?', [req.user.id, today]);
  res.json(log || { date: today, is_work_day: null });
});

router.get('/history', async (req, res) => {
  await getDb();
  const logs = queryAll('SELECT * FROM work_day_log WHERE user_id = ? ORDER BY date DESC LIMIT 30', [req.user.id]);
  res.json(logs);
});

router.post('/answer', async (req, res) => {
  await getDb();
  const { is_work_day } = req.body;
  if (typeof is_work_day !== 'number') return res.status(400).json({ error: 'is_work_day must be 0 or 1' });

  const today = todayStr();

  if (is_work_day) {
    resumeDayAlarms(req.user.id);
  } else {
    suspendDayAlarms(req.user.id, today);
  }

  const existing = queryOne('SELECT * FROM work_day_log WHERE user_id = ? AND date = ?', [req.user.id, today]);
  if (existing) {
    run('UPDATE work_day_log SET is_work_day = ?, answered_at = datetime(\'now\') WHERE id = ?', [is_work_day, existing.id]);
  } else {
    run('INSERT INTO work_day_log (user_id, date, is_work_day) VALUES (?, ?, ?)', [req.user.id, today, is_work_day]);
  }

  res.json({ date: today, is_work_day });
});

export default router;
