import { Router } from 'express';
import { getDb, queryAll, queryOne, run } from '../db/init.js';
import { authenticateToken } from '../middleware/auth.js';

const router = Router();
router.use(authenticateToken);

router.get('/', async (req, res) => {
  await getDb();
  const alarms = queryAll(`
    SELECT a.*, t.name as tag_name, t.color as tag_color, t.categories as tag_categories,
           p.time as parent_time, p.label as parent_label
    FROM alarms a
    LEFT JOIN tags t ON a.tag_id = t.id
    LEFT JOIN alarms p ON a.parent_alarm_id = p.id
    WHERE a.user_id = ? ORDER BY a.time
  `, [req.user.id]);
  const excRows = queryAll('SELECT alarm_id, exception_date FROM alarm_exceptions WHERE user_id = ?', [req.user.id]);
  const excMap = {};
  for (const e of excRows) {
    (excMap[e.alarm_id] ||= []).push(e.exception_date);
  }
  res.json(alarms.map(a => ({ ...a, exceptions: excMap[a.id] || [] })));
});

router.post('/', async (req, res) => {
  await getDb();
  const { time, days_of_week, tag_id, label, is_active, snooze_minutes, parent_alarm_id, is_locked, start_date, recurring, arc_id } = req.body;
  if (!time) return res.status(400).json({ error: 'Time is required' });

  run(`
    INSERT INTO alarms (user_id, time, days_of_week, tag_id, label, is_active, snooze_minutes, parent_alarm_id, is_locked, start_date, recurring, arc_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `, [req.user.id, time, days_of_week || '1,2,3,4,5', tag_id || null, label || '', is_active ?? 1, snooze_minutes ?? 5, parent_alarm_id || null, is_locked ?? 1, start_date || null, recurring === undefined || recurring === null ? 1 : recurring, arc_id || null]);

  const alarm = queryOne('SELECT * FROM alarms WHERE user_id = ? AND time = ? ORDER BY id DESC LIMIT 1', [req.user.id, time]);
  res.status(201).json({ ...alarm, exceptions: [] });
});

router.put('/:id', async (req, res) => {
  await getDb();
  const { time, days_of_week, tag_id, label, is_active, snooze_minutes, start_date, parent_alarm_id, is_locked, recurring } = req.body;
  const existing = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!existing) return res.status(404).json({ error: 'Alarm not found' });

  const newTime = time ?? existing.time;
  const newDays = days_of_week ?? existing.days_of_week;
  const newTagId = tag_id !== undefined ? (tag_id || null) : existing.tag_id;
  const newLabel = label ?? existing.label;
  const newActive = is_active ?? existing.is_active;
  const newSnooze = snooze_minutes ?? existing.snooze_minutes;
  const newStartDate = start_date !== undefined ? (start_date || null) : existing.start_date;
  const newRecurring = recurring !== undefined && recurring !== null ? recurring : existing.recurring ?? 1;
  const newParent = parent_alarm_id !== undefined ? (parent_alarm_id || null) : existing.parent_alarm_id;
  const newLocked = is_locked !== undefined ? is_locked : existing.is_locked;

  run(`
    UPDATE alarms SET time = ?, days_of_week = ?, tag_id = ?, label = ?, is_active = ?, snooze_minutes = ?, start_date = ?, recurring = ?, parent_alarm_id = ?, is_locked = ?, updated_at = datetime('now')
    WHERE id = ? AND user_id = ?
  `, [newTime, newDays, newTagId, newLabel, newActive, newSnooze, newStartDate, newRecurring, newParent, newLocked, req.params.id, req.user.id]);

  // A family keeps a single tag: changing any member's tag updates the whole
  // family (arc alarms + the arc itself, or the parent/child group).
  if (newTagId !== existing.tag_id) {
    if (existing.arc_id) {
      run('UPDATE alarms SET tag_id = ? WHERE arc_id = ? AND user_id = ?', [newTagId, existing.arc_id, req.user.id]);
      run('UPDATE arcs SET tag_id = ? WHERE id = ? AND user_id = ?', [newTagId, existing.arc_id, req.user.id]);
    } else if (existing.parent_alarm_id) {
      const rootId = existing.parent_alarm_id;
      run('UPDATE alarms SET tag_id = ? WHERE user_id = ? AND (id = ? OR parent_alarm_id = ?)', [newTagId, req.user.id, rootId, rootId]);
    }
  }

  if (existing.parent_alarm_id === null) {
    const children = queryAll('SELECT * FROM alarms WHERE parent_alarm_id = ? AND is_locked = 1', [existing.id]);
    for (const child of children) {
      const childDays = child.days_of_week.split(',').map(Number);
      const parentDays = newDays.split(',').map(Number);
      const intersect = childDays.filter(d => parentDays.includes(d));

      run(`
        UPDATE alarms SET time = ?, tag_id = ?, label = ?, is_active = ?, snooze_minutes = ?, start_date = ?, recurring = ?, updated_at = datetime('now')
        WHERE id = ?
      `, [newTime, newTagId, newLabel, newActive, newSnooze, newStartDate, newRecurring, child.id]);
    }
  }

  const alarm = queryOne('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
  const excRows = queryAll('SELECT exception_date FROM alarm_exceptions WHERE user_id = ? AND alarm_id = ?', [req.user.id, alarm.id]);
  res.json({ ...alarm, exceptions: excRows.map(r => r.exception_date) });
});

router.delete('/:id', async (req, res) => {
  await getDb();
  const { family } = req.query;
  const alarm = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  if (family === '1') {
    // Delete the whole family: for arc alarms remove the arc and all its
    // alarms; otherwise remove the root alarm plus everything linked to it.
    if (alarm.arc_id) {
      run('DELETE FROM alarm_exceptions WHERE user_id = ? AND alarm_id IN (SELECT id FROM alarms WHERE arc_id = ?)', [req.user.id, alarm.arc_id]);
      run('DELETE FROM arc_exceptions WHERE user_id = ? AND arc_id = ?', [req.user.id, alarm.arc_id]);
      run('DELETE FROM alarms WHERE arc_id = ? AND user_id = ?', [alarm.arc_id, req.user.id]);
      run('DELETE FROM arcs WHERE id = ? AND user_id = ?', [alarm.arc_id, req.user.id]);
    } else {
      const rootId = alarm.parent_alarm_id || alarm.id;
      run('DELETE FROM alarm_exceptions WHERE user_id = ? AND alarm_id IN (SELECT id FROM alarms WHERE user_id = ? AND (id = ? OR parent_alarm_id = ?))', [req.user.id, req.user.id, rootId, rootId]);
      run('DELETE FROM alarms WHERE user_id = ? AND (id = ? OR parent_alarm_id = ?)', [req.user.id, rootId, rootId]);
    }
  } else {
    run('DELETE FROM alarm_exceptions WHERE user_id = ? AND alarm_id = ?', [req.user.id, alarm.id]);
    run('DELETE FROM alarms WHERE id = ? AND user_id = ?', [alarm.id, req.user.id]);

    // Deleting a single arc alarm: if it was the arc start or end, shorten the
    // arc so the next/previous alarm becomes the new start/end. Deleting an
    // in-between alarm leaves the arc times untouched.
    if (alarm.arc_id) {
      const arc = queryOne('SELECT * FROM arcs WHERE id = ? AND user_id = ?', [alarm.arc_id, req.user.id]);
      if (arc) {
        const remaining = queryAll(
          'SELECT time FROM alarms WHERE arc_id = ? AND user_id = ? AND id != ? ORDER BY time',
          [arc.id, req.user.id, alarm.id]
        ).map(r => r.time);

        if (remaining.length === 0) {
          // No alarms left on the arc -> remove the arc too.
          run('DELETE FROM arc_exceptions WHERE user_id = ? AND arc_id = ?', [req.user.id, arc.id]);
          run('DELETE FROM arcs WHERE id = ? AND user_id = ?', [arc.id, req.user.id]);
        } else {
          let newStart = arc.start_time;
          let newEnd = arc.end_time;
          if (alarm.time === arc.start_time) {
            newStart = remaining.find(t => t > alarm.time) || remaining[0];
          }
          if (alarm.time === arc.end_time) {
            newEnd = [...remaining].reverse().find(t => t < alarm.time) || remaining[remaining.length - 1];
          }
          const mode = newStart === newEnd ? 'single' : arc.mode;
          run('UPDATE arcs SET start_time = ?, end_time = ?, mode = ?, updated_at = datetime(\'now\') WHERE id = ?',
            [newStart, newEnd, mode, arc.id]);
        }
      }
    }
  }
  res.json({ message: 'Deleted' });
});

// Skip one occurrence of a recurring alarm on a specific date.
router.post('/:id/exceptions', async (req, res) => {
  await getDb();
  const alarm = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  run('INSERT OR IGNORE INTO alarm_exceptions (user_id, alarm_id, exception_date) VALUES (?, ?, ?)', [req.user.id, alarm.id, date]);
  res.json({ message: 'Added', date });
});

// Undo support: remove a skip exception for a specific date.
router.delete('/:id/exceptions/:date', async (req, res) => {
  await getDb();
  run('DELETE FROM alarm_exceptions WHERE user_id = ? AND alarm_id = ? AND exception_date = ?', [req.user.id, req.params.id, req.params.date]);
  res.json({ message: 'Removed', date: req.params.date });
});

router.patch('/:id/toggle', async (req, res) => {
  await getDb();
  const alarm = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  run('UPDATE alarms SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?', [alarm.is_active ? 0 : 1, req.params.id]);

  if (alarm.parent_alarm_id === null) {
    const children = queryAll('SELECT * FROM alarms WHERE parent_alarm_id = ? AND is_locked = 1', [alarm.id]);
    for (const child of children) {
      run('UPDATE alarms SET is_active = ?, updated_at = datetime(\'now\') WHERE id = ?', [alarm.is_active ? 0 : 1, child.id]);
    }
  }

  const updated = queryOne('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.patch('/:id/lock', async (req, res) => {
  await getDb();
  const alarm = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  run('UPDATE alarms SET is_locked = ?, updated_at = datetime(\'now\') WHERE id = ?', [alarm.is_locked ? 0 : 1, req.params.id]);
  const updated = queryOne('SELECT * FROM alarms WHERE id = ?', [req.params.id]);
  res.json(updated);
});

router.post('/generate-schedule', async (req, res) => {
  await getDb();
  const { parent_alarm_id, schedule } = req.body;
  if (!parent_alarm_id || !schedule) return res.status(400).json({ error: 'parent_alarm_id and schedule required' });

  const parent = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [parent_alarm_id, req.user.id]);
  if (!parent) return res.status(404).json({ error: 'Parent alarm not found' });

  run('DELETE FROM alarms WHERE parent_alarm_id = ? AND user_id = ?', [parent.id, req.user.id]);

  const {
    start_time, end_time,
    has_lunch, lunch_start, lunch_end,
    has_morning_break, morning_break_start, morning_break_end,
    has_afternoon_break, afternoon_break_start, afternoon_break_end,
    reminders_before_start
  } = schedule;

  const childAlarms = [];
  const makeChild = (time, label) => {
    const r = run(`
      INSERT INTO alarms (user_id, time, days_of_week, tag_id, label, is_active, snooze_minutes, parent_alarm_id, is_locked)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1)
    `, [req.user.id, time, parent.days_of_week, parent.tag_id, `${parent.label || 'Work'} - ${label}`, 1, 5, parent.id]);
    return queryOne('SELECT * FROM alarms WHERE id = ?', [r.lastInsertRowid]);
  };

  if (reminders_before_start && reminders_before_start > 0) {
    childAlarms.push(makeChild(subtractMinutes(start_time, reminders_before_start), 'Reminder'));
  }

  if (has_morning_break && morning_break_start && morning_break_end) {
    childAlarms.push(makeChild(subtractMinutes(morning_break_start, 5), 'AM Break in 5m'));
  }

  if (has_lunch && lunch_start && lunch_end) {
    childAlarms.push(makeChild(subtractMinutes(lunch_start, 5), 'Lunch in 5m'));
  }

  if (has_afternoon_break && afternoon_break_start && afternoon_break_end) {
    childAlarms.push(makeChild(subtractMinutes(afternoon_break_start, 5), 'PM Break in 5m'));
  }

  childAlarms.push(makeChild(end_time, 'End of day'));

  const scheduleValues = [
    start_time, end_time, has_lunch ? 1 : 0, lunch_start || '', lunch_end || '',
    has_morning_break ? 1 : 0, morning_break_start || '', morning_break_end || '',
    has_afternoon_break ? 1 : 0, afternoon_break_start || '', afternoon_break_end || '',
    reminders_before_start || 0,
  ];
  const existingSchedule = queryOne('SELECT id FROM work_schedules WHERE user_id = ?', [req.user.id]);
  if (existingSchedule) {
    run(`UPDATE work_schedules SET start_time=?, end_time=?, has_lunch=?, lunch_start=?, lunch_end=?,
      has_morning_break=?, morning_break_start=?, morning_break_end=?,
      has_afternoon_break=?, afternoon_break_start=?, afternoon_break_end=?,
      reminders_before_start=? WHERE user_id=?`,
      [...scheduleValues, req.user.id]);
  } else {
    run(`INSERT INTO work_schedules (user_id, start_time, end_time, has_lunch, lunch_start, lunch_end,
      has_morning_break, morning_break_start, morning_break_end,
      has_afternoon_break, afternoon_break_start, afternoon_break_end, reminders_before_start)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, ...scheduleValues]);
  }

  res.json({ parent, children: childAlarms.filter(Boolean) });
});

function subtractMinutes(timeStr, minutes) {
  const [h, m] = timeStr.split(':').map(Number);
  const totalMin = h * 60 + m - minutes;
  const nh = Math.floor(((totalMin % (24 * 60)) + 24 * 60) % (24 * 60) / 60);
  const nm = ((totalMin % 60) + 60) % 60;
  return `${String(nh).padStart(2, '0')}:${String(nm).padStart(2, '0')}`;
}

// Recurring rules endpoints
router.get('/recurring', async (req, res) => {
  await getDb();
  const rules = queryAll('SELECT * FROM recurring_rules WHERE user_id = ?', [req.user.id]);
  res.json(rules);
});

router.post('/recurring', async (req, res) => {
  await getDb();
  const { alarm_id, start_date, end_date, recurrence_type } = req.body;
  if (!alarm_id || !start_date || !end_date) {
    return res.status(400).json({ error: 'alarm_id, start_date, end_date required' });
  }

  const alarm = queryOne('SELECT * FROM alarms WHERE id = ? AND user_id = ?', [alarm_id, req.user.id]);
  if (!alarm) return res.status(404).json({ error: 'Alarm not found' });

  run('INSERT INTO recurring_rules (alarm_id, user_id, start_date, end_date, recurrence_type) VALUES (?, ?, ?, ?, ?)',
    [alarm_id, req.user.id, start_date, end_date, recurrence_type || 'daily']);

  // Generate alarms for the date range
  const startDate = new Date(start_date);
  const endDate = new Date(end_date);
  const [h, m] = alarm.time.split(':').map(Number);
  const createdAlarms = [];

  for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
    const dayOfWeek = d.getDay();
    if (alarm.days_of_week.split(',').includes(String(dayOfWeek))) {
      const dateStr = d.toISOString().split('T')[0];
      const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

      const r = run(`
        INSERT INTO alarms (user_id, time, days_of_week, tag_id, label, is_active, snooze_minutes, parent_alarm_id, is_locked)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [req.user.id, timeStr, String(dayOfWeek), alarm.tag_id, alarm.label, 1, 5, alarm.id, 1]);

      createdAlarms.push(queryOne('SELECT * FROM alarms WHERE id = ?', [r.lastInsertRowid]));
    }
  }

  res.status(201).json({ rule: queryOne('SELECT * FROM recurring_rules ORDER BY id DESC LIMIT 1'), alarms: createdAlarms });
});

router.delete('/recurring/:id', async (req, res) => {
  await getDb();
  const rule = queryOne('SELECT * FROM recurring_rules WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!rule) return res.status(404).json({ error: 'Rule not found' });

  run('DELETE FROM recurring_rules WHERE id = ?', [req.params.id]);
  run('DELETE FROM alarms WHERE parent_alarm_id = ? AND user_id = ?', [rule.alarm_id, req.user.id]);
  res.json({ message: 'Deleted' });
});

export default router;
