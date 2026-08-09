import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

function dayOfWeek(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
}

router.get('/', async (req, res) => {
  await getDb();
  const events = queryAll('SELECT * FROM day_events WHERE user_id = ? ORDER BY date', [req.user.id]);
  res.json(events);
});

router.put('/:date', async (req, res) => {
  await getDb();
  const { date } = req.params;
  const { type } = req.body;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'Invalid date' });
  if (type !== null && type !== undefined && type !== 'rest' && type !== 'pto') {
    return res.status(400).json({ error: 'type must be rest, pto or null' });
  }

  const dow = dayOfWeek(date);
  const existing = queryOne('SELECT * FROM day_events WHERE user_id = ? AND date = ?', [req.user.id, date]);

  if (type === 'rest' || type === 'pto') {
    if (existing) {
      run('UPDATE day_events SET type = ?, created_at = datetime(\'now\') WHERE user_id = ? AND date = ?', [type, req.user.id, date]);
    } else {
      run('INSERT INTO day_events (user_id, date, type) VALUES (?, ?, ?)', [req.user.id, date, type]);
    }
    // Erase the day: deactivate alarms + arcs scheduled on that weekday.
    run('UPDATE alarms SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [req.user.id, `%,${dow},%`]);
    run('UPDATE arcs SET is_active = 0, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [req.user.id, `%,${dow},%`]);
  } else {
    if (existing) {
      run('DELETE FROM day_events WHERE user_id = ? AND date = ?', [req.user.id, date]);
    }
    // Restore the day: reactivate alarms + arcs scheduled on that weekday.
    run('UPDATE alarms SET is_active = 1, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [req.user.id, `%,${dow},%`]);
    run('UPDATE arcs SET is_active = 1, updated_at = datetime(\'now\') WHERE user_id = ? AND ("," || days_of_week || ",") LIKE ?', [req.user.id, `%,${dow},%`]);
  }

  res.json(queryOne('SELECT * FROM day_events WHERE user_id = ? AND date = ?', [req.user.id, date]) || { date, type: null });
});

export default router;
