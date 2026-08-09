import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

const ARC_SELECT = `
  SELECT a.*, t.name as tag_name, t.color as tag_color, t.categories as tag_categories
  FROM arcs a
  LEFT JOIN tags t ON a.tag_id = t.id
`;

function getArc(userId, arcId) {
  const rows = queryAll(`${ARC_SELECT} WHERE a.user_id = ? AND a.id = ?`, [userId, arcId]);
  return rows[0] || null;
}

function getArcAlarms(userId, arcId) {
  return queryAll(`
    SELECT a.*, t.name as tag_name, t.color as tag_color, t.categories as tag_categories
    FROM alarms a
    LEFT JOIN tags t ON a.tag_id = t.id
    WHERE a.user_id = ? AND a.arc_id = ? ORDER BY a.time
  `, [userId, arcId]);
}

function addMinutes(time, mins) {
  if (!time) return time;
  const [h, m] = time.split(':').map(Number);
  const total = (((h * 60 + m + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

function buildAlarmSpecs(arc) {
  const { start_time, end_time, mode, label } = arc;
  const specs = [];
  if (mode === 'both') {
    specs.push({ time: start_time, label: label ? `${label} - Start` : 'Start' });
    specs.push({ time: end_time, label: label ? `${label} - End` : 'End' });
  } else {
    specs.push({ time: start_time, label: label || '' });
  }
  if (arc.reminders_before_start) {
    specs.push({ time: addMinutes(start_time, -arc.reminders_before_start), label: label ? `${label} - Pre-start` : 'Pre-start' });
  }
  if (arc.has_lunch) specs.push({ time: arc.lunch_start, label: label ? `${label} - Lunch` : 'Lunch' });
  if (arc.has_morning_break) specs.push({ time: arc.morning_break_start, label: label ? `${label} - Morning Break` : 'Morning Break' });
  if (arc.has_afternoon_break) specs.push({ time: arc.afternoon_break_start, label: label ? `${label} - Afternoon Break` : 'Afternoon Break' });
  return specs;
}

function withAlarms(arc) {
  if (!arc) return null;
  return { ...arc, alarms: getArcAlarms(arc.user_id, arc.id) };
}

function withExceptions(arc) {
  if (!arc) return null;
  const rows = queryAll('SELECT exception_date FROM arc_exceptions WHERE user_id = ? AND arc_id = ?', [arc.user_id, arc.id]);
  return { ...arc, exceptions: rows.map(r => r.exception_date) };
}

function respond(arc) {
  return withExceptions(withAlarms(arc));
}

router.get('/', async (req, res) => {
  await getDb();
  const arcs = queryAll(`${ARC_SELECT} WHERE a.user_id = ? ORDER BY a.start_time`, [req.user.id]);
  const excRows = queryAll('SELECT arc_id, exception_date FROM arc_exceptions WHERE user_id = ?', [req.user.id]);
  const excMap = {};
  for (const e of excRows) {
    (excMap[e.arc_id] ||= []).push(e.exception_date);
  }
  res.json(arcs.map(arc => ({ ...arc, exceptions: excMap[arc.id] || [] })).map(withAlarms));
});

router.post('/', async (req, res) => {
  await getDb();
  const {
    start_time, end_time, mode, tag_id, label, days_of_week,
    has_lunch, lunch_start, lunch_end,
    has_morning_break, morning_break_start, morning_break_end,
    has_afternoon_break, afternoon_break_start, afternoon_break_end,
    reminders_before_start, recurring, start_date,
  } = req.body;
  if (!start_time || !end_time) return res.status(400).json({ error: 'start_time and end_time are required' });
  if (mode !== 'both' && mode !== 'single') return res.status(400).json({ error: 'mode must be "single" or "both"' });

  if (tag_id) {
    const tag = queryOne('SELECT id FROM tags WHERE id = ? AND user_id = ?', [tag_id, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
  }

  const arcData = {
    user_id: req.user.id,
    tag_id: tag_id || null,
    start_time, end_time, mode,
    label: label || '',
    days_of_week: days_of_week || '1,2,3,4,5',
    has_lunch: has_lunch ?? 0, lunch_start: lunch_start || '12:00', lunch_end: lunch_end || '13:00',
    has_morning_break: has_morning_break ?? 0, morning_break_start: morning_break_start || '10:15', morning_break_end: morning_break_end || '10:30',
    has_afternoon_break: has_afternoon_break ?? 0, afternoon_break_start: afternoon_break_start || '15:00', afternoon_break_end: afternoon_break_end || '15:15',
    reminders_before_start: reminders_before_start ?? 0,
    recurring: recurring === undefined || recurring === null ? 1 : recurring,
    start_date: start_date || null,
  };

  const arcResult = run(`
    INSERT INTO arcs (user_id, tag_id, start_time, end_time, mode, label, days_of_week, is_active,
      has_lunch, lunch_start, lunch_end, has_morning_break, morning_break_start, morning_break_end,
      has_afternoon_break, afternoon_break_start, afternoon_break_end, reminders_before_start, recurring, start_date)
    VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [arcData.user_id, arcData.tag_id, arcData.start_time, arcData.end_time, arcData.mode, arcData.label, arcData.days_of_week,
    arcData.has_lunch, arcData.lunch_start, arcData.lunch_end, arcData.has_morning_break, arcData.morning_break_start, arcData.morning_break_end,
    arcData.has_afternoon_break, arcData.afternoon_break_start, arcData.afternoon_break_end, arcData.reminders_before_start, arcData.recurring, arcData.start_date]);
  const arcId = arcResult.lastInsertRowid;

  for (const s of buildAlarmSpecs(arcData)) {
    run(`
      INSERT INTO alarms (user_id, time, days_of_week, tag_id, label, is_active, snooze_minutes, arc_id, start_date, recurring)
      VALUES (?, ?, ?, ?, ?, 1, 5, ?, ?, ?)
    `, [req.user.id, s.time, arcData.days_of_week, arcData.tag_id, s.label, arcId, arcData.start_date, arcData.recurring]);
  }

  res.status(201).json(respond(getArc(req.user.id, arcId)));
});

router.put('/:id', async (req, res) => {
  await getDb();
  const arc = queryOne('SELECT * FROM arcs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!arc) return res.status(404).json({ error: 'Arc not found' });

  const b = req.body;

  if (b.tag_id) {
    const tag = queryOne('SELECT id FROM tags WHERE id = ? AND user_id = ?', [b.tag_id, req.user.id]);
    if (!tag) return res.status(404).json({ error: 'Tag not found' });
  }

  const merged = {
    start_time: b.start_time ?? arc.start_time,
    end_time: b.end_time ?? arc.end_time,
    mode: b.mode ?? arc.mode,
    tag_id: b.tag_id !== undefined ? (b.tag_id || null) : arc.tag_id,
    label: b.label ?? arc.label,
    days_of_week: b.days_of_week ?? arc.days_of_week,
    has_lunch: b.has_lunch ?? arc.has_lunch,
    lunch_start: b.lunch_start ?? arc.lunch_start,
    lunch_end: b.lunch_end ?? arc.lunch_end,
    has_morning_break: b.has_morning_break ?? arc.has_morning_break,
    morning_break_start: b.morning_break_start ?? arc.morning_break_start,
    morning_break_end: b.morning_break_end ?? arc.morning_break_end,
    has_afternoon_break: b.has_afternoon_break ?? arc.has_afternoon_break,
    afternoon_break_start: b.afternoon_break_start ?? arc.afternoon_break_start,
    afternoon_break_end: b.afternoon_break_end ?? arc.afternoon_break_end,
    reminders_before_start: b.reminders_before_start ?? arc.reminders_before_start,
    recurring: b.recurring !== undefined && b.recurring !== null ? b.recurring : arc.recurring ?? 1,
    start_date: b.start_date !== undefined ? b.start_date : arc.start_date,
  };

  run(`UPDATE arcs SET start_time = ?, end_time = ?, mode = ?, tag_id = ?, label = ?, days_of_week = ?,
      has_lunch = ?, lunch_start = ?, lunch_end = ?, has_morning_break = ?, morning_break_start = ?, morning_break_end = ?,
      has_afternoon_break = ?, afternoon_break_start = ?, afternoon_break_end = ?, reminders_before_start = ?,
      recurring = ?, start_date = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [merged.start_time, merged.end_time, merged.mode, merged.tag_id, merged.label, merged.days_of_week,
      merged.has_lunch, merged.lunch_start, merged.lunch_end, merged.has_morning_break, merged.morning_break_start, merged.morning_break_end,
      merged.has_afternoon_break, merged.afternoon_break_start, merged.afternoon_break_end, merged.reminders_before_start,
      merged.recurring, merged.start_date, arc.id]);

  run('DELETE FROM alarms WHERE arc_id = ? AND user_id = ?', [arc.id, req.user.id]);
  for (const s of buildAlarmSpecs(merged)) {
    run(`
      INSERT INTO alarms (user_id, time, days_of_week, tag_id, label, is_active, snooze_minutes, arc_id, start_date, recurring)
      VALUES (?, ?, ?, ?, ?, ?, 5, ?, ?, ?)
    `, [req.user.id, s.time, merged.days_of_week, merged.tag_id, s.label, arc.is_active, arc.id, merged.start_date, merged.recurring]);
  }

  res.json(respond(getArc(req.user.id, arc.id)));
});

// Skip one occurrence of a recurring arc on a specific date.
router.post('/:id/exceptions', async (req, res) => {
  await getDb();
  const arc = queryOne('SELECT * FROM arcs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!arc) return res.status(404).json({ error: 'Arc not found' });
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  run('INSERT OR IGNORE INTO arc_exceptions (user_id, arc_id, exception_date) VALUES (?, ?, ?)', [req.user.id, arc.id, date]);
  res.json({ message: 'Added', date });
});

// Undo support: remove a skip exception for a specific date.
router.delete('/:id/exceptions/:date', async (req, res) => {
  await getDb();
  run('DELETE FROM arc_exceptions WHERE user_id = ? AND arc_id = ? AND exception_date = ?', [req.user.id, req.params.id, req.params.date]);
  res.json({ message: 'Removed', date: req.params.date });
});

router.patch('/:id/move', async (req, res) => {
  await getDb();
  const offset = parseInt(req.body.offset_minutes, 10) || 0;
  const arc = queryOne('SELECT * FROM arcs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!arc) return res.status(404).json({ error: 'Arc not found' });
  if (offset === 0) return res.json(respond(getArc(req.user.id, arc.id)));

  const shiftCols = ['start_time', 'end_time', 'lunch_start', 'lunch_end', 'morning_break_start', 'morning_break_end', 'afternoon_break_start', 'afternoon_break_end'];
  const sets = shiftCols.map(c => `${c} = ?`).join(', ');
  const vals = shiftCols.map(c => (arc[c] ? addMinutes(arc[c], offset) : arc[c]));
  run(`UPDATE arcs SET ${sets}, updated_at = datetime('now') WHERE id = ?`, [...vals, arc.id]);

  const alarmRows = queryAll('SELECT id, time FROM alarms WHERE arc_id = ?', [arc.id]);
  for (const a of alarmRows) {
    run('UPDATE alarms SET time = ?, updated_at = datetime(\'now\') WHERE id = ?', [addMinutes(a.time, offset), a.id]);
  }

  res.json(respond(getArc(req.user.id, arc.id)));
});

router.delete('/:id', async (req, res) => {
  await getDb();
  run('DELETE FROM arc_exceptions WHERE user_id = ? AND arc_id = ?', [req.user.id, req.params.id]);
  run('DELETE FROM alarm_exceptions WHERE user_id = ? AND alarm_id IN (SELECT id FROM alarms WHERE arc_id = ?)', [req.user.id, req.params.id]);
  run('DELETE FROM alarms WHERE arc_id = ? AND user_id = ?', [req.params.id, req.user.id]);
  const result = run('DELETE FROM arcs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (result.changes === 0) return res.status(404).json({ error: 'Arc not found' });
  res.json({ message: 'Deleted' });
});

router.patch('/:id/toggle', async (req, res) => {
  await getDb();
  const arc = queryOne('SELECT * FROM arcs WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!arc) return res.status(404).json({ error: 'Arc not found' });

  const next = arc.is_active ? 0 : 1;
  run('UPDATE arcs SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?', [next, arc.id]);
  run('UPDATE alarms SET is_active = ?, updated_at = datetime(\'now\') WHERE arc_id = ?', [next, arc.id]);

  res.json(respond(getArc(req.user.id, arc.id)));
});

export default router;
