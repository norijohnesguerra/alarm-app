import { useState, useEffect, useRef, useCallback } from 'react';
import { api } from '../lib/api';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import AlarmCalendar, { alarmAppliesOnDate } from './AlarmCalendar';
import WorkDayToggle from './WorkDayToggle';
import WorkScheduleModal, { Toggle } from './WorkScheduleModal';

const PRESET_COLORS = ['#00e5ff', '#ff00ff', '#76ff03', '#ff9100', '#ff4081', '#7c4dff', '#00e676', '#ffea00'];
const CATEGORY_ICONS = {
  work: '💼', personal: '👤', custom: '🏷️'
};
const CATEGORIES = [
  { value: 'work', label: 'Work' },
  { value: 'personal', label: 'Personal' },
  { value: 'custom', label: 'Custom' },
];

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return { r: parseInt(h.substring(0, 2), 16), g: parseInt(h.substring(2, 4), 16), b: parseInt(h.substring(4, 6), 16) };
}

function colorDistance(c1, c2) {
  const a = hexToRgb(c1), b = hexToRgb(c2);
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

const TIMEZONES = [
  { label: 'UTC-8', offset: -8 }, { label: 'UTC-5', offset: -5 }, { label: 'UTC+0', offset: 0 },
  { label: 'UTC+1', offset: 1 }, { label: 'UTC+3', offset: 3 }, { label: 'UTC+5:30', offset: 5.5 },
  { label: 'UTC+7', offset: 7 }, { label: 'UTC+8', offset: 8 }, { label: 'UTC+9', offset: 9 },
  { label: 'UTC+10', offset: 10 }, { label: 'UTC+12', offset: 12 },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getTimeInTimezone(offset) {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  return new Date(utc + offset * 3600000);
}

function timeToAngle(hours, minutes) { return (((hours % 12) + minutes / 60) / 12) * 360; }
function minutesToAngle(minutes) { return (minutes / 60) * 360; }

function timeToMinute(timeStr) {
  const [h, m] = timeStr.split(':').map(Number);
  return ((h * 60 + m) % 1440 + 1440) % 1440;
}

function hoursToString(hours) {
  let m = Math.round((hours % 1) * 60 / 5) * 5;
  let h = Math.floor(hours);
  if (m === 60) { m = 0; h += 1; }
  h = ((h % 24) + 24) % 24;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function addMinutesTime(time, mins) {
  if (!time) return '';
  const total = (((timeToMinute(time) + mins) % 1440) + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}

// While painting: start hour comes from angle + am/pm half, then the sweep
// accumulates continuously so dragging past 12 o'clock crosses into the
// opposite half (PM -> AM -> outer ring).
function paintTimes(startAngle, currentAngle, ampm) {
  const base = ampm === 'PM' ? 12 : 0;
  const startHours = base + (startAngle / 360) * 12;
  const sweepHours = (((currentAngle - startAngle) % 360) + 360) % 360 / 360 * 12;
  return {
    start: hoursToString(startHours),
    end: hoursToString(startHours + sweepHours),
  };
}

// SVG path for a painted arc. PM hours render on the inner ring, AM hours on
// the outer ring; a stroke crossing midnight continues seamlessly.
function describePaintedArc(cx, cy, rInner, rOuter, startTime, endTime) {
  const start = timeToMinute(startTime);
  const end = timeToMinute(endTime);
  if (start === end) return null;

  let total = ((end - start) % 1440 + 1440) % 1440;
  if (total === 0) total = 720;

  const segments = [];
  let remaining = total;
  let t = start;
  while (remaining > 0) {
    const norm = ((t % 1440) + 1440) % 1440;
    const boundary = norm < 720 ? 720 : 1440;
    const chunk = Math.min(remaining, boundary - norm);
    const pm = norm >= 720;
    segments.push({
      startAngle: ((norm / 720) * 360) - 90,
      endAngle: ((((norm + chunk) % 1440) / 720) * 360) - 90,
      radius: pm ? rInner : rOuter,
    });
    t += chunk;
    remaining -= chunk;
  }

  let d = '';
  segments.forEach((s, i) => {
    const sr = (s.startAngle * Math.PI) / 180;
    const er = (s.endAngle * Math.PI) / 180;
    const x1 = cx + s.radius * Math.cos(sr);
    const y1 = cy + s.radius * Math.sin(sr);
    const x2 = cx + s.radius * Math.cos(er);
    const y2 = cy + s.radius * Math.sin(er);
    const sweep = (((s.endAngle - s.startAngle) % 360) + 360) % 360 || 360;
    const large = sweep > 180 ? 1 : 0;
    if (i === 0) d += `M ${x1} ${y1} A ${s.radius} ${s.radius} 0 ${large} 1 ${x2} ${y2}`;
    else d += ` L ${x1} ${y1} A ${s.radius} ${s.radius} 0 ${large} 1 ${x2} ${y2}`;
  });
  return d;
}

function CategoryButtons({ selected, onChange }) {
  return (
    <div className="flex flex-wrap gap-1">
      {CATEGORIES.map(c => {
        const active = selected.includes(c.value);
        return (
          <button key={c.value} type="button"
            onClick={() => onChange(active ? selected.filter(x => x !== c.value) : [...selected, c.value])}
            className={`px-2 py-1 rounded text-[9px] font-display border transition-all ${
              active ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40' : 'text-gray-400 border-neon-border hover:text-white hover:border-gray-500'
            }`}>
            {CATEGORY_ICONS[c.value]} {c.label}
          </button>
        );
      })}
    </div>
  );
}

// Edit / Create Alarm Modal
function EditAlarmModal({ alarm, tags, onClose, onSave, onDelete }) {
  const isNew = !alarm.id;
  const todayDow = new Date().getDay();
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [time, setTime] = useState(alarm.time);
  const [label, setLabel] = useState(alarm.label || '');
  const [tagId, setTagId] = useState(alarm.tag_id || '');
  const [snooze, setSnooze] = useState(alarm.snooze_minutes || 5);
  const [recurring, setRecurring] = useState(isNew ? false : alarm.recurring !== 0);
  const [startDate, setStartDate] = useState(alarm.start_date || todayStr);
  const [days, setDays] = useState(alarm.days_of_week?.split(',').map(Number) || [todayDow]);
  const toggleDay = (d) => {
    if (!recurring) return;
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };
  const handleRecurringChange = (on) => {
    setRecurring(on);
    if (!on) {
      setDays([todayDow]);
      setStartDate(todayStr);
    } else {
      setStartDate(alarm.start_date || todayStr);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-96 border-neon-cyan/30 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-sm text-neon-cyan tracking-wider">{isNew ? 'NEW ALARM' : 'EDIT ALARM'}</h3>
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="block text-[10px] text-gray-400 mb-1 font-display">TIME</label>
            <input type="time" value={time} onChange={e => setTime(e.target.value)} className="neon-input w-full" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-gray-400 mb-1 font-display">LABEL</label>
            <input type="text" value={label} onChange={e => setLabel(e.target.value)} className="neon-input w-full" placeholder="Label" />
          </div>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 font-display">TAG</label>
          <select value={tagId} onChange={e => setTagId(e.target.value)} className="neon-input w-full">
            <option value="">No tag</option>
            {tags.map(t => <option key={t.id} value={t.id}>{(t.categories?.split(',') || []).map(c => CATEGORY_ICONS[c]).join('')} {t.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] text-gray-400 mb-1 font-display">SNOOZE (min)</label>
          <input type="number" min="0" max="30" value={snooze} onChange={e => setSnooze(parseInt(e.target.value) || 5)} className="neon-input w-full" />
        </div>

        <div className="flex items-center justify-between border-t border-neon-border pt-3">
          <div>
            <label className="text-[10px] text-gray-400 font-display">RECURRING</label>
            <p className="text-[9px] text-gray-600">{recurring ? 'On — repeats weekly on selected days' : 'Off — single alarm for today'}</p>
          </div>
          <Toggle checked={recurring} onChange={() => handleRecurringChange(!recurring)} color="#00e5ff" />
        </div>

        <div className={recurring ? '' : 'opacity-40'}>
          <label className="block text-[10px] text-gray-400 mb-2 font-display">DAYS {!recurring && '· TODAY ONLY'}</label>
          <div className="flex gap-1.5">
            {[0,1,2,3,4,5,6].map(d => (
              <button key={d} onClick={() => toggleDay(d)}
                className={`w-9 h-9 rounded-lg text-[10px] font-display font-bold transition-all ${
                  days.includes(d) ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'bg-neon-bg text-gray-500 border border-neon-border'}`}>
                {DAYS[d].substring(0,2)}
              </button>
            ))}
          </div>
        </div>
        <div className="flex gap-2 pt-2">
          {!isNew && <button onClick={() => onDelete(alarm.id)} className="neon-btn-danger text-xs flex-1">DELETE</button>}
          <button onClick={onClose} className="neon-btn text-gray-400 hover:text-white text-xs flex-1">Cancel</button>
          <button onClick={() => onSave({ time, label, tag_id: tagId || null, snooze_minutes: snooze, days_of_week: days.join(','), recurring: recurring ? 1 : 0, start_date: startDate || todayStr })}
            className="neon-btn-primary text-xs flex-1 font-display">{isNew ? 'CREATE' : 'SAVE'}</button>
        </div>
      </div>
    </div>
  );
}

// Delete prompt: DELETE ALL removes every alarm and arc on the selected date;
// DELETE removes only the alarm that was tapped. Both are per-date only.
function DeleteAlarmPrompt({ alarm, dayCount, onClose, onDeleteDay, onDeleteAlarm }) {
  const name = alarm.label || alarm.tag_name || 'Alarm';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-80 border-red-500/30 space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-sm text-red-400 tracking-wider">DELETE ALARM</h3>
        <p className="text-xs text-gray-300">
          Delete <span className="text-white font-bold">{name}</span> at <span className="font-mono text-white font-bold">{alarm.time}</span>?
        </p>
        <p className="text-[10px] text-gray-500">Both options only affect this date — no other day is touched.</p>
        <div className="space-y-2">
          <button onClick={onDeleteDay} className="w-full neon-btn-danger text-xs">DELETE ALL ({dayCount}) — ALL ALARMS & ARCS ON THIS DATE</button>
          <button onClick={onDeleteAlarm} className="w-full text-xs py-2 rounded-lg border border-red-500/30 text-red-400 hover:bg-red-500/10 transition-colors">DELETE THIS ALARM — ONLY THIS ALARM</button>
        </div>
        <button onClick={onClose} className="neon-btn text-gray-400 hover:text-white text-xs w-full">Cancel</button>
      </div>
    </div>
  );
}

// Alarm detail modal: view + edit + delete + active toggle + memo + schedule + lock
function AlarmDetailModal({ alarm, arc, onClose, onEdit, onDelete, onToggle, onSchedule, onToggleLock, onArcSlide, onArcEdit, onArcDelete }) {
  const [memo, setMemo] = useState('');
  const [memoDraft, setMemoDraft] = useState('');
  const [memoLoaded, setMemoLoaded] = useState(false);
  const [active, setActive] = useState(alarm.is_active === 1);

  useEffect(() => {
    setActive(alarm.is_active === 1);
    if (alarm.tag_id) {
      api.memos.get(alarm.tag_id).then(m => {
        setMemo(m.content || '');
        setMemoDraft(m.content || '');
        setMemoLoaded(true);
      }).catch(() => setMemoLoaded(true));
    } else {
      setMemo('');
      setMemoDraft('');
      setMemoLoaded(true);
    }
  }, [alarm.id, alarm.tag_id, alarm.is_active]);

  const handleToggle = async () => {
    await api.alarms.toggle(alarm.id);
    setActive(!active);
    onToggle?.();
  };

  const handleMemoSave = async () => {
    if (!alarm.tag_id) return;
    await api.memos.update(alarm.tag_id, memoDraft);
    setMemo(memoDraft);
  };

  const color = alarm.tag_color || '#00e5ff';
  const name = alarm.label || alarm.tag_name || 'Alarm';

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-96 border-neon-cyan/30 space-y-4" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
          <h3 className="font-display text-sm text-white tracking-wider flex-1 truncate">{name}</h3>
          <button onClick={handleToggle} className={`text-[10px] font-display px-2 py-1 rounded border transition-colors ${
            active ? 'bg-neon-lime/15 text-neon-lime border-neon-lime/40' : 'bg-neon-orange/15 text-neon-orange border-neon-orange/40'
          }`}>
            {active ? 'ON' : 'OFF'}
          </button>
        </div>

        <div className="flex items-end gap-3">
          <span className="font-mono text-3xl font-black text-white" style={{ textShadow: `0 0 16px ${color}80` }}>{alarm.time}</span>
          {alarm.tag_name && (
            <span className="text-[10px] px-2 py-1 rounded-full mb-1" style={{ backgroundColor: `${color}20`, color, border: `1px solid ${color}40` }}>
              {alarm.tag_name}
            </span>
          )}
        </div>

        <div>
          <p className="text-[10px] text-gray-400 mb-1 font-display">DAYS</p>
          <p className="text-[11px] text-gray-300">{alarm.days_of_week.split(',').map(d => DAYS[d]).join(', ')}</p>
        </div>

        <div className="flex items-center gap-4">
          <div>
            <p className="text-[10px] text-gray-400 mb-1 font-display">SNOOZE</p>
            <p className="text-[11px] text-gray-300">{alarm.snooze_minutes ?? 5} min</p>
          </div>
          {(alarm.tag_categories || '').split(',').includes('work') && (
            <button onClick={() => onSchedule?.(alarm)} className="text-[10px] font-display px-2 py-1 rounded border border-neon-lime/40 bg-neon-lime/10 text-neon-lime hover:bg-neon-lime/20 transition-colors">
              + SCHEDULE
            </button>
          )}
          {alarm.parent_alarm_id && (
            <button onClick={() => onToggleLock?.(alarm)} className={`text-[10px] font-display px-2 py-1 rounded border transition-colors ${
              alarm.locked ? 'border-neon-cyan/40 bg-neon-cyan/15 text-neon-cyan' : 'border-gray-600 bg-neon-bg text-gray-400 hover:text-white'
            }`}>
              {alarm.locked ? '🔒 LINKED' : '🔓 LINK'}
            </button>
          )}
        </div>

        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400 font-display">MEMO</p>
          <textarea value={memoDraft} onChange={e => setMemoDraft(e.target.value)}
            placeholder={alarm.tag_id ? 'Write a memo for this reminder...' : 'No tag — add one to attach a memo.'}
            disabled={!alarm.tag_id}
            className="neon-input w-full h-20 resize-none text-xs" />
          {memoLoaded && alarm.tag_id && memoDraft !== memo && (
            <button onClick={handleMemoSave} className="text-[10px] font-display px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
              SAVE MEMO
            </button>
          )}
        </div>

        {arc && (
          <div className="border-t border-neon-border pt-3 space-y-2">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: arc.tag_color || '#00e5ff', boxShadow: `0 0 6px ${arc.tag_color || '#00e5ff'}80` }} />
              <p className="text-[10px] text-gray-400 font-display">ARC · {arc.label || 'Untitled'}</p>
            </div>
            <div className="flex gap-2">
              <button onClick={() => onArcSlide?.(arc)} className="text-[10px] font-display px-2 py-1 rounded border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors flex-1">SLIDE</button>
              <button onClick={() => onArcEdit?.(arc)} className="text-[10px] font-display px-2 py-1 rounded border border-neon-lime/40 bg-neon-lime/10 text-neon-lime hover:bg-neon-lime/20 transition-colors flex-1">EDIT ARC</button>
              <button onClick={() => onArcDelete?.(arc)} className="text-[10px] font-display px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors flex-1">DELETE ARC</button>
            </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={() => onEdit(alarm)} className="neon-btn text-neon-cyan hover:text-white text-xs flex-1">EDIT</button>
          <button onClick={() => onDelete(alarm.id)} className="neon-btn-danger text-xs flex-1">DELETE</button>
          <button onClick={onClose} className="neon-btn text-gray-400 hover:text-white text-xs flex-1">CLOSE</button>
        </div>
      </div>
    </div>
  );
}

// Arc creation/editing modal
function PaintArcModal({ arc, tag, onClose, onSave, defaultDay, defaultDate }) {
  const editing = !!arc.id;
  const todayStr = (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; })();
  const [mode, setMode] = useState(arc.mode || (arc.start === arc.end ? 'single' : 'both'));
  const [label, setLabel] = useState(arc.label || tag?.name || '');
  const [startTime, setStartTime] = useState(arc.start_time || arc.start || '');
  const [endTime, setEndTime] = useState(arc.end_time || arc.end || '');
  const [days, setDays] = useState(arc.days_of_week ? arc.days_of_week.split(',').map(Number) : [...new Set([defaultDay ?? new Date().getDay(), 1, 2, 3, 4, 5])].sort());
  const [recurring, setRecurring] = useState(editing ? arc.recurring !== 0 : false);
  const [startDate, setStartDate] = useState(arc.start_date || todayStr);
  const toggleDay = (d) => {
    if (!recurring) return;
    setDays(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d].sort());
  };
  const handleRecurringChange = (on) => {
    setRecurring(on);
    if (!on) {
      setDays([defaultDay ?? new Date().getDay()]);
      setStartDate(defaultDate || todayStr);
    } else {
      setStartDate(arc.start_date || todayStr);
    }
  };

  const [hasLunch, setHasLunch] = useState(!!arc.has_lunch);
  const [lunchStart, setLunchStart] = useState(arc.lunch_start || '12:00');
  const [lunchEnd, setLunchEnd] = useState(arc.lunch_end || '13:00');
  const [hasMorningBreak, setHasMorningBreak] = useState(!!arc.has_morning_break);
  const [morningBreakStart, setMorningBreakStart] = useState(arc.morning_break_start || '10:15');
  const [morningBreakEnd, setMorningBreakEnd] = useState(arc.morning_break_end || '10:30');
  const [hasAfternoonBreak, setHasAfternoonBreak] = useState(!!arc.has_afternoon_break);
  const [afternoonBreakStart, setAfternoonBreakStart] = useState(arc.afternoon_break_start || '15:00');
  const [afternoonBreakEnd, setAfternoonBreakEnd] = useState(arc.afternoon_break_end || '15:15');
  const [remindersBeforeStart, setRemindersBeforeStart] = useState(arc.reminders_before_start || 0);
  const [memoDraft, setMemoDraft] = useState('');
  const [memoLoaded, setMemoLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(editing);

  useEffect(() => {
    if (tag?.id) {
      api.memos.get(tag.id).then(m => { setMemoDraft(m.content || ''); }).catch(() => {}).finally(() => setMemoLoaded(true));
    } else {
      setMemoLoaded(true);
    }
  }, [tag?.id]);

  const handleMemoSave = async () => {
    if (!tag?.id) return;
    await api.memos.update(tag.id, memoDraft);
  };

  const handleSave = () => onSave({
    id: arc.id,
    start: startTime,
    end: endTime,
    mode,
    label,
    days_of_week: days.join(','),
    recurring: recurring ? 1 : 0,
    start_date: startDate || todayStr,
    has_lunch: hasLunch ? 1 : 0, lunch_start: lunchStart, lunch_end: lunchEnd,
    has_morning_break: hasMorningBreak ? 1 : 0, morning_break_start: morningBreakStart, morning_break_end: morningBreakEnd,
    has_afternoon_break: hasAfternoonBreak ? 1 : 0, afternoon_break_start: afternoonBreakStart, afternoon_break_end: afternoonBreakEnd,
    reminders_before_start: remindersBeforeStart,
  });

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-96 border-neon-cyan/30 max-h-[90vh] overflow-y-auto space-y-4" onClick={e => e.stopPropagation()}>
        <h3 className="font-display text-sm text-neon-cyan tracking-wider flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: tag?.color, boxShadow: `0 0 8px ${tag?.color}80` }} />
          {editing ? 'EDIT ARC' : 'NEW ARC'}
        </h3>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <label className="block text-[10px] text-gray-400 mb-1 font-display">START</label>
            <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)} className="neon-input w-full text-sm" />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] text-gray-400 mb-1 font-display">END</label>
            <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)} className="neon-input w-full text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-[10px] text-gray-400 mb-1 font-display">LABEL</label>
          <input type="text" value={label} onChange={e => setLabel(e.target.value)} className="neon-input w-full" placeholder="Reminder name" />
        </div>

        {/* Collapsible alarm settings */}
        <button onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between text-[9px] font-display tracking-wider text-gray-400 hover:text-white border-t border-neon-border pt-3 transition-colors">
          <span>ALARM SETTINGS</span>
          <span className="text-neon-cyan">{showSettings ? '▾' : '▸'}</span>
        </button>
        {showSettings && (
          <div className="space-y-4">
        <div>
          <label className="block text-[10px] text-gray-400 mb-2 font-display">ALARMS</label>
          <div className="flex gap-2">
            <button onClick={() => setMode('both')}
              className={`flex-1 text-[10px] font-display px-2 py-2 rounded-lg border transition-all ${
                mode === 'both' ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40' : 'text-gray-400 border-neon-border hover:text-white'
              }`}>
              START & END
            </button>
            <button onClick={() => setMode('single')}
              className={`flex-1 text-[10px] font-display px-2 py-2 rounded-lg border transition-all ${
                mode === 'single' ? 'bg-neon-cyan/20 text-neon-cyan border-neon-cyan/40' : 'text-gray-400 border-neon-border hover:text-white'
              }`}>
              START ONLY
            </button>
          </div>
        </div>

        <div className={recurring ? '' : 'opacity-40'}>
          <label className="block text-[10px] text-gray-400 mb-2 font-display">DAYS {!recurring && '· ONE-TIME'}</label>
          <div className="flex gap-1.5">
            {[0,1,2,3,4,5,6].map(d => (
              <button key={d} onClick={() => toggleDay(d)}
                className={`w-9 h-9 rounded-lg text-[10px] font-display font-bold transition-all ${
                  days.includes(d) ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' : 'bg-neon-bg text-gray-500 border border-neon-border'}`}>
                {DAYS[d].substring(0,2)}
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div>
            <label className="text-[10px] text-gray-400 font-display">REPEAT WEEKLY</label>
            <p className="text-[9px] text-gray-600">{recurring ? 'On — repeats on the selected days from today' : 'Off — one-time on the selected day'}</p>
          </div>
          <Toggle checked={recurring} onChange={() => handleRecurringChange(!recurring)} color="#00e5ff" />
        </div>

        {/* Breaks & lunch */}
        <div className="border-t border-neon-border pt-3 space-y-3">
          <p className="text-[9px] text-gray-400 font-display tracking-wider">BREAKS & LUNCH</p>
          <div className="flex items-center gap-3">
            <label className="text-[10px] text-gray-400 font-display">REMINDER BEFORE START</label>
            <input type="number" min="0" max="120" value={remindersBeforeStart}
              onChange={e => setRemindersBeforeStart(parseInt(e.target.value, 10) || 0)}
              className="neon-input w-20 text-sm text-center" />
            <span className="text-[10px] text-gray-500">min</span>
          </div>

          <div className="flex items-center justify-between">
            <label className="text-[10px] text-gray-400 font-display">LUNCH</label>
            <Toggle checked={hasLunch} onChange={() => setHasLunch(!hasLunch)} color="#76ff03" />
          </div>
          {hasLunch && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">Start</label>
                <input type="time" value={lunchStart} onChange={e => setLunchStart(e.target.value)} className="neon-input w-full text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">End</label>
                <input type="time" value={lunchEnd} onChange={e => setLunchEnd(e.target.value)} className="neon-input w-full text-sm" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-[10px] text-gray-400 font-display">MORNING BREAK</label>
            <Toggle checked={hasMorningBreak} onChange={() => setHasMorningBreak(!hasMorningBreak)} color="#ff9100" />
          </div>
          {hasMorningBreak && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">Start</label>
                <input type="time" value={morningBreakStart} onChange={e => setMorningBreakStart(e.target.value)} className="neon-input w-full text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">End</label>
                <input type="time" value={morningBreakEnd} onChange={e => setMorningBreakEnd(e.target.value)} className="neon-input w-full text-sm" />
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <label className="text-[10px] text-gray-400 font-display">AFTERNOON BREAK</label>
            <Toggle checked={hasAfternoonBreak} onChange={() => setHasAfternoonBreak(!hasAfternoonBreak)} color="#ff4081" />
          </div>
          {hasAfternoonBreak && (
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">Start</label>
                <input type="time" value={afternoonBreakStart} onChange={e => setAfternoonBreakStart(e.target.value)} className="neon-input w-full text-sm" />
              </div>
              <div className="flex-1">
                <label className="block text-[10px] text-gray-500 mb-1">End</label>
                <input type="time" value={afternoonBreakEnd} onChange={e => setAfternoonBreakEnd(e.target.value)} className="neon-input w-full text-sm" />
              </div>
            </div>
          )}
        </div>

        {/* Memo */}
        <div className="space-y-1.5">
          <p className="text-[10px] text-gray-400 font-display">MEMO</p>
          <textarea value={memoDraft} onChange={e => setMemoDraft(e.target.value)}
            placeholder={tag?.id ? 'Write a memo for this reminder...' : 'Assign a tag to attach a memo.'}
            disabled={!tag?.id}
            className="neon-input w-full h-20 resize-none text-xs" />
          {memoLoaded && tag?.id && (
            <button onClick={handleMemoSave} className="text-[10px] font-display px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan hover:bg-neon-cyan/30">
              SAVE MEMO
            </button>
          )}
        </div>
          </div>
        )}

        <div className="flex gap-2 pt-2">
          <button onClick={onClose} className="neon-btn text-gray-400 hover:text-white text-xs flex-1">Cancel</button>
          <button onClick={handleSave}
            className="neon-btn-primary text-xs flex-1 font-display">{editing ? 'SAVE' : 'CREATE'}</button>
        </div>
      </div>
    </div>
  );
}

// Arc options menu: long-press an arc to slide / edit / delete
function ArcOptionsMenu({ arc, onClose, onSlide, onEdit, onDelete }) {
  const color = arc.tag_color || '#00e5ff';
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-80 border-neon-cyan/30 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-3">
          <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 8px ${color}80` }} />
          <div className="flex-1 min-w-0">
            <h3 className="font-display text-sm text-white tracking-wider truncate">{arc.label || 'ARC'}</h3>
            <p className="font-mono text-[11px]" style={{ color }}>{arc.start_time} → {arc.end_time}</p>
          </div>
        </div>
        <div className="grid gap-2">
          <button onClick={() => onSlide(arc)} className="text-left text-xs px-3 py-2 rounded-lg border border-neon-cyan/30 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors">
            SLIDE — drag the arc on the clock
          </button>
          <button onClick={() => onEdit(arc)} className="text-left text-xs px-3 py-2 rounded-lg border border-neon-lime/30 bg-neon-lime/10 text-neon-lime hover:bg-neon-lime/20 transition-colors">
            EDIT — label, memo, times, breaks
          </button>
          <button onClick={() => onDelete(arc)} className="text-left text-xs px-3 py-2 rounded-lg border border-red-500/30 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
            DELETE — arc and its alarms on this date
          </button>
        </div>
        <button onClick={onClose} className="neon-btn text-gray-400 hover:text-white text-xs w-full">CLOSE</button>
      </div>
    </div>
  );
}

// Identity matchers used by undo/redo: row-deleted entities are recreated
// from snapshots, and their ids change on every recreate. These match the
// current incarnation of an entity so a redo deletes the live row (not a
// stale id) and an undo reuses it instead of creating a duplicate.
const sameArcShape = (a, s) =>
  (a.label || '') === (s.label || '') &&
  (a.start_time || '') === (s.start_time || '') &&
  (a.end_time || '') === (s.end_time || '') &&
  (a.mode || '') === (s.mode || '') &&
  (a.tag_id || null) === (s.tag_id || null) &&
  (a.days_of_week || '') === (s.days_of_week || '') &&
  a.recurring === s.recurring &&
  (a.start_date || null) === (s.start_date || null);

const sameAlarmShape = (a, s, parentId) =>
  (a.time || '') === (s.time || '') &&
  (a.label || '') === (s.label || '') &&
  (a.days_of_week || '') === (s.days_of_week || '') &&
  a.recurring === s.recurring &&
  (a.tag_id || null) === (s.tag_id || null) &&
  (a.parent_alarm_id || null) === (parentId ?? null) &&
  (a.arc_id || null) === (s.arc_id || null);

export default function NeonClock() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [timezone, setTimezone] = useState(8);
  const [now, setNow] = useState(() => getTimeInTimezone(8));
  const [alarms, setAlarms] = useState([]);
  const [tags, setTags] = useState([]);
  const [arcs, setArcs] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [collapsedFams, setCollapsedFams] = useState(new Set());
  const [hoveredAlarm, setHoveredAlarm] = useState(null);
  const [hoveredTag, setHoveredTag] = useState(null);
  const [editingAlarm, setEditingAlarm] = useState(null);
  const [detailAlarm, setDetailAlarm] = useState(null);
  const [deletePrompt, setDeletePrompt] = useState(null);
  const [scheduleAlarm, setScheduleAlarm] = useState(null);
  const [dayEvents, setDayEvents] = useState([]);
  const [selectedDate, setSelectedDate] = useState(() => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; });
  const [selectedAlarmIds, setSelectedAlarmIds] = useState(new Set());
  const undoStackRef = useRef([]);
  const redoStackRef = useRef([]);
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [editingTag, setEditingTag] = useState(null);
  const [tagEditName, setTagEditName] = useState('');
  const [tagEditColor, setTagEditColor] = useState('');
  const [tagEditCategories, setTagEditCategories] = useState(['custom']);
  const [tagEditError, setTagEditError] = useState('');
  const [showCreateTag, setShowCreateTag] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#00e5ff');
  const [newTagCategories, setNewTagCategories] = useState(['custom']);
  const [newTagError, setNewTagError] = useState('');
  const [ampm, setAmpm] = useState(() => { const h = getTimeInTimezone(8).getHours(); return h >= 12 ? 'PM' : 'AM'; });
  const rafRef = useRef();

  // Dev-only test alarm (header button, web equivalent of the Android one)
  const [testAlert, setTestAlert] = useState(null);
  const testSoundRef = useRef(null);
  const startTestAlarmSound = () => {
    if (testSoundRef.current) return;
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();
      const gain = ctx.createGain();
      gain.connect(ctx.destination);
      const osc = ctx.createOscillator();
      osc.type = 'square';
      osc.frequency.value = 880;
      osc.connect(gain);
      osc.start();
      let on = false;
      gain.gain.setValueAtTime(0, ctx.currentTime);
      const timer = setInterval(() => {
        on = !on;
        gain.gain.setValueAtTime(on ? 0.15 : 0, ctx.currentTime);
      }, 600);
      testSoundRef.current = { ctx, osc, gain, timer };
    } catch (_) {}
  };
  const stopTestAlarmSound = () => {
    const s = testSoundRef.current;
    if (!s) return;
    clearInterval(s.timer);
    try { s.osc.stop(); } catch (_) {}
    try { s.ctx.close(); } catch (_) {}
    testSoundRef.current = null;
  };
  const triggerTestAlarm = () => {
    const t = getTimeInTimezone(8);
    setTestAlert(`${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`);
    startTestAlarmSound();
  };
  const dismissTestAlarm = () => { stopTestAlarmSound(); setTestAlert(null); };

  // Paint brush state
  const [brushTag, setBrushTag] = useState(null);
  const [painting, setPainting] = useState(false);
  const [paintStart, setPaintStart] = useState(null);
  const [paintCurrent, setPaintCurrent] = useState(null);
  const [paintArc, setPaintArc] = useState(null);

  // Arc options / slide state
  const [arcOptions, setArcOptions] = useState(null);
  const [slideArc, setSlideArc] = useState(null);
  const [slidePreview, setSlidePreview] = useState(null);
  const slideRef = useRef(null);
  const slideDraggingRef = useRef(false);
  const slideOffsetRef = useRef(0);

  // Long press state
  const longPressRef = useRef(null);
  const longPressAlarmRef = useRef(null);
  const arcLongPressRef = useRef(null);
  const arcLongPressTimerRef = useRef(null);
  const clockRef = useRef(null);

  const loadSeqRef = useRef(0);
  const load = () => {
    const seq = ++loadSeqRef.current;
    return Promise.all([api.alarms.list(), api.tags.list(), api.arcs.list(), api.dayEvents.list()])
      .then(([a, t, ar, de]) => {
        // Ignore responses superseded by a newer load so stale data can never
        // clobber the state that reflects the latest undo/redo/edit.
        if (seq !== loadSeqRef.current) return;
        setAlarms(a); setTags(t); setArcs(ar); setDayEvents(de);
      })
      .catch(() => {});
  };
  useEffect(() => { load(); }, []);

  // Exit paint mode when the user clicks anywhere outside the clock UI
  useEffect(() => {
    const handleOutside = (e) => {
      if (brushTag && clockRef.current && !clockRef.current.contains(e.target)) {
        setBrushTag(null);
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [brushTag]);

  useEffect(() => {
    const tick = () => { setNow(getTimeInTimezone(timezone)); rafRef.current = requestAnimationFrame(tick); };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [timezone]);

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();
  const ms = now.getMilliseconds();
  const smoothSeconds = seconds + ms / 1000;
  const smoothMinutes = minutes + smoothSeconds / 60;
  const hourAngle = timeToAngle(hours, minutes);
  const minuteAngle = minutesToAngle(smoothMinutes);
  const secondAngle = minutesToAngle(smoothSeconds);

  const displayHours = hours;

  const toDateStr = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const todayStr = toDateStr(new Date());
  const selectedDateStr = toDateStr(selectedDate);
  const selectedDow = selectedDate.getDay();
  const isTodaySelected = selectedDateStr === todayStr;

  // Date exceptions: recurring alarms/arcs that were deleted on specific dates.
  const exceptions = {
    alarms: new Map(alarms.map(a => [a.id, new Set(a.exceptions || [])])),
    arcs: new Map(arcs.map(a => [a.id, new Set(a.exceptions || [])])),
  };

  // Alarms and arcs that apply to the selected day
  const selectedDayAlarms = alarms
    .filter(a => alarmAppliesOnDate(a, selectedDateStr, exceptions))
    .sort((a, b) => a.time.localeCompare(b.time));

  const visibleArcs = arcs.filter(a => {
    const dowOk = (a.days_of_week || '').split(',').includes(String(selectedDow));
    if (!dowOk) return false;
    if (exceptions.arcs.get(a.id)?.has(selectedDateStr)) return false;
    if (a.recurring === 0) return selectedDateStr === a.start_date;
    if (a.start_date && selectedDateStr < a.start_date) return false;
    return true;
  });

  const dayAlarmCount = alarms.filter(a => alarmAppliesOnDate(a, selectedDateStr, exceptions)).length;
  const dayArcCount = arcs.filter(a => alarmAppliesOnDate(a, selectedDateStr, exceptions)).length;

  const highlightedDays = hoveredAlarm != null
    ? (alarms.find(a => a.id === hoveredAlarm)?.days_of_week || '').split(',').map(Number)
    : null;

  const tagHighlightDays = hoveredTag != null
    ? Array.from(new Set([
        ...alarms.filter(a => a.tag_id === hoveredTag).flatMap(a => a.days_of_week.split(',').map(Number)),
        ...arcs.filter(a => a.tag_id === hoveredTag).flatMap(a => a.days_of_week.split(',').map(Number)),
      ]))
    : null;

  const cx = 150, cy = 150, r = 130;
  const rInner = 78, rOuter = 118;

  const angleFromEvent = useCallback((e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    return (Math.atan2(y, x) * 180 / Math.PI + 90 + 360) % 360;
  }, []);

  // Slide handlers: drag on the clock to move the whole arc + its alarms
  const handleSlidePointerDown = (e) => {
    if (!slideArc) return;
    if (e.target.closest && e.target.closest('button, select, input')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const angle = angleFromEvent(e);
    slideRef.current = { arc: slideArc, grabAngle: angle, refStart: slideArc.start_time, refEnd: slideArc.end_time };
    slideDraggingRef.current = true;
    slideOffsetRef.current = 0;
  };

  const handleSlidePointerMove = (e) => {
    if (!slideDraggingRef.current || !slideRef.current) return;
    const angle = angleFromEvent(e);
    let deltaMin = (((angle - slideRef.current.grabAngle) % 360) + 360) % 360 / 360 * 1440;
    if (deltaMin > 720) deltaMin -= 1440;
    const rounded = Math.round(deltaMin / 5) * 5;
    slideOffsetRef.current = rounded;
    setSlidePreview({
      start: addMinutesTime(slideRef.current.refStart, rounded),
      end: addMinutesTime(slideRef.current.refEnd, rounded),
    });
  };

  const handleSlidePointerUp = async () => {
    if (!slideDraggingRef.current) return;
    slideDraggingRef.current = false;
    const s = slideRef.current;
    slideRef.current = null;
    const offset = slideOffsetRef.current;
    slideOffsetRef.current = 0;
    setSlidePreview(null);
    if (s && offset !== 0) {
      await api.arcs.move(s.arc.id, offset);
    }
    setSlideArc(null);
    load();
  };

  const cancelSlide = () => {
    slideDraggingRef.current = false;
    slideRef.current = null;
    slideOffsetRef.current = 0;
    setSlidePreview(null);
    setSlideArc(null);
  };

  // Paint handlers
  const handleClockPointerDown = useCallback((e) => {
    if (slideArc) { handleSlidePointerDown(e); return; }
    if (!brushTag) return;
    if (e.target.closest && e.target.closest('button, select, input')) return;
    e.currentTarget.setPointerCapture?.(e.pointerId);
    const angle = angleFromEvent(e);
    setPaintStart(angle);
    setPaintCurrent(angle);
    setPainting(true);
  }, [brushTag, angleFromEvent, slideArc]);

  const handleClockPointerMove = useCallback((e) => {
    if (slideDraggingRef.current) { handleSlidePointerMove(e); return; }
    if (!painting) return;
    setPaintCurrent(angleFromEvent(e));
  }, [painting, angleFromEvent]);

  const handleClockPointerUp = useCallback((e) => {
    if (slideDraggingRef.current) { handleSlidePointerUp(); return; }
    if (!painting) return;
    const angle = angleFromEvent(e);
    const { start, end } = paintTimes(paintStart, angle, ampm);
    setPainting(false);
    setPaintStart(null);
    setPaintCurrent(null);
    if (!brushTag) return;
    setPaintArc({ start, end, tag_id: brushTag.id });
  }, [painting, paintStart, ampm, brushTag, angleFromEvent]);

  const handleArcSave = async (data) => {
    const body = {
      start_time: data.start,
      end_time: data.end,
      mode: data.mode,
      tag_id: paintArc?.tag_id || brushTag?.id || null,
      label: data.label,
      days_of_week: data.days_of_week,
      recurring: data.recurring ?? 1,
      start_date: data.start_date || null,
      has_lunch: data.has_lunch || 0,
      lunch_start: data.lunch_start,
      lunch_end: data.lunch_end,
      has_morning_break: data.has_morning_break || 0,
      morning_break_start: data.morning_break_start,
      morning_break_end: data.morning_break_end,
      has_afternoon_break: data.has_afternoon_break || 0,
      afternoon_break_start: data.afternoon_break_start,
      afternoon_break_end: data.afternoon_break_end,
      reminders_before_start: data.reminders_before_start || 0,
    };
    if (data.id) {
      await api.arcs.update(data.id, body);
    } else {
      await api.arcs.create(body);
      if (body.tag_id) await api.memos.update(body.tag_id, '').catch(() => {});
    }
    setPaintArc(null);
    load();
  };

  // Arc long press handlers
  const handleArcLongPressStart = (arc) => {
    arcLongPressRef.current = arc;
    arcLongPressTimerRef.current = setTimeout(() => {
      setArcOptions(arc);
      arcLongPressTimerRef.current = null;
    }, 500);
  };

  const handleArcLongPressEnd = () => {
    if (arcLongPressTimerRef.current) {
      clearTimeout(arcLongPressTimerRef.current);
      arcLongPressTimerRef.current = null;
    }
    arcLongPressRef.current = null;
  };

  const handleArcOptionsEdit = (arc) => {
    setArcOptions(null);
    setPaintArc(arc);
  };

  const handleArcOptionsDelete = async (arc) => {
    if (!confirm(`Delete this arc and its alarms on ${selectedDateStr}? Other days are not affected.`)) return;
    recordDeleteOp(await skipOrDeleteArc(arc, selectedDateStr));
    setArcOptions(null);
    setDetailAlarm(null);
    await load();
  };

  const paintPreview = painting && paintStart != null && paintCurrent != null && brushTag
    ? describePaintedArc(cx, cy, rInner, rOuter, paintTimes(paintStart, paintCurrent, ampm).start, paintTimes(paintStart, paintCurrent, ampm).end)
    : null;

  // Long press handlers
  const handleAlarmLongPressStart = (alarm) => {
    longPressAlarmRef.current = alarm;
    longPressRef.current = setTimeout(() => {
      setEditingAlarm(alarm);
      longPressRef.current = null;
    }, 500);
  };

  const handleAlarmLongPressEnd = () => {
    if (longPressRef.current) {
      clearTimeout(longPressRef.current);
      longPressRef.current = null;
    }
    longPressAlarmRef.current = null;
  };

  // Alarm detail / edit / delete
  const handleSaveAlarm = async (data) => {
    if (editingAlarm?.id) {
      await api.alarms.update(editingAlarm.id, data);
    } else {
      // Recurring/single alarms only exist from today onwards, never before.
      await api.alarms.create({ ...data, start_date: data.start_date || todayStr });
    }
    setEditingAlarm(null);
    setDetailAlarm(null);
    load();
  };

  const handleScheduleSave = async (id, schedule) => {
    await api.alarms.generateSchedule(id, schedule);
    setScheduleAlarm(null);
    setDetailAlarm(null);
    load();
  };

  const handleToggleLock = async (alarm) => {
    await api.alarms.toggleLock(alarm.id);
    setDetailAlarm(null);
    load();
  };

  const handleDeleteAlarm = (id) => {
    const alarm = alarms.find(a => a.id === id);
    if (!alarm) return;
    setDeletePrompt(alarm);
  };

  // Per-date deletion: a recurring item gets a skip exception for that date
  // (other days are untouched); a one-time item, or a recurring item that only
  // ever runs on that weekday, is removed entirely. Each returns item
  // descriptors used to record an undo/redo op. API 404s (item already gone,
  // e.g. an arc removed server-side with its last alarm) are treated as done —
  // the item is still recorded so undo can restore it.
  const skipOrDeleteAlarm = async (alarm, date) => {
    const dow = String(new Date(date + 'T00:00:00').getDay());
    const days = (alarm.days_of_week || '').split(',').map(Number);
    if (alarm.recurring === 0 || (days.length === 1 && days[0] === Number(dow))) {
      try { await api.alarms.delete(alarm.id); } catch {}
      // The server cascades row deletes to children; record them so undo
      // restores the whole family.
      const kids = alarms.filter(a => a.parent_alarm_id === alarm.id);
      return [
        { type: 'alarm', id: alarm.id, action: 'delete', snapshot: alarm },
        ...kids.map(k => ({ type: 'alarm', id: k.id, action: 'delete', snapshot: k })),
      ];
    }
    try { await api.alarms.addException(alarm.id, date); } catch {}
    return [{ type: 'alarm', id: alarm.id, action: 'exception', date }];
  };

  const skipOrDeleteArc = async (arc, date) => {
    const dow = String(new Date(date + 'T00:00:00').getDay());
    const days = (arc.days_of_week || '').split(',').map(Number);
    if (arc.recurring === 0 || (days.length === 1 && days[0] === Number(dow))) {
      try { await api.arcs.delete(arc.id); } catch {}
      return [{ type: 'arc', id: arc.id, action: 'delete', snapshot: arc }];
    }
    try { await api.arcs.addException(arc.id, date); } catch {}
    return [{ type: 'arc', id: arc.id, action: 'exception', date }];
  };

  // Delete every alarm and arc that applies on one date, per date only.
  const deleteForDate = async (date) => {
    const items = [];
    const dayArcs = arcs.filter(a => alarmAppliesOnDate(a, date, exceptions));
    for (const a of dayArcs) items.push(...await skipOrDeleteArc(a, date));
    const arcIds = new Set(dayArcs.map(a => a.id));
    for (const a of alarms) {
      if (!alarmAppliesOnDate(a, date, exceptions)) continue;
      if (a.arc_id && arcIds.has(a.arc_id)) continue;
      items.push(...await skipOrDeleteAlarm(a, date));
    }
    return items;
  };

  // Record a per-date delete as one undoable op (rollback of that edit).
  const recordDeleteOp = (items) => {
    if (!items.length) return;
    undoStackRef.current.push({ kind: 'dayDelete', items });
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
  };

  // DELETE ALL: every alarm and arc on the selected date.
  const deleteAllForSelectedDay = async () => {
    recordDeleteOp(await deleteForDate(selectedDateStr));
    setDeletePrompt(null);
    setDetailAlarm(null);
    setEditingAlarm(null);
    await load();
  };

  // DELETE: only the alarm that was tapped, only on the selected date. If it
  // was the last remaining alarm of its arc on that date, the arc is wiped
  // for that date too.
  const deleteSingleForDate = async (alarm) => {
    const items = [...await skipOrDeleteAlarm(alarm, selectedDateStr)];
    if (alarm.arc_id) {
      const arc = arcs.find(a => a.id === alarm.arc_id);
      if (arc) {
        const remaining = alarms.filter(a => a.arc_id === alarm.arc_id && a.id !== alarm.id && alarmAppliesOnDate(a, selectedDateStr, exceptions));
        if (remaining.length === 0) items.push(...await skipOrDeleteArc(arc, selectedDateStr));
      }
    }
    recordDeleteOp(items);
    setDeletePrompt(null);
    setDetailAlarm(null);
    setEditingAlarm(null);
    await load();
  };

  // CLEAR tool: remove every alarm and arc that applies on the selected dates,
  // per date only (other days are untouched).
  const handleClearDates = async (dates) => {
    const targets = [...dates];
    const alarmsOnDates = alarms.filter(a => targets.some(d => alarmAppliesOnDate(a, d, exceptions)));
    const arcsOnDates = arcs.filter(a => targets.some(d => alarmAppliesOnDate(a, d, exceptions)));
    const alarmCount = alarmsOnDates.length;
    const arcCount = arcsOnDates.length;
    if (alarmCount + arcCount === 0) return;
    if (!confirm(`Delete ${alarmCount} alarm${alarmCount !== 1 ? 's' : ''} and ${arcCount} arc${arcCount !== 1 ? 's' : ''} on ${targets.length} date${targets.length !== 1 ? 's' : ''}?`)) return;
    const items = [];
    for (const d of targets) items.push(...await deleteForDate(d));
    recordDeleteOp(items);
    await load();
  };

  // Calendar tools: paint days onto alarms, rest/PTO brushes, undo/redo
  const handleApplyDays = async (alarmIds, dows) => {
    if (!alarmIds.length || !dows.length) return;
    const before = [];
    const after = [];
    for (const id of alarmIds) {
      const alarm = alarms.find(a => a.id === id);
      if (!alarm) continue;
      const current = new Set(alarm.days_of_week.split(',').map(Number));
      const next = [...new Set([...current, ...dows])].sort().join(',');
      before.push({ id, days_of_week: alarm.days_of_week });
      after.push({ id, days_of_week: next });
      await api.alarms.update(id, { days_of_week: next });
    }
    undoStackRef.current.push({ kind: 'alarmDays', days: { before, after } });
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    load();
  };

  const handleApplyDayEvent = async (dateStr, type) => {
    const existing = dayEvents.find(e => e.date === dateStr);
    const op = { kind: 'dayEvent', event: { date: dateStr, before: existing ? existing.type : null, after: type } };
    await api.dayEvents.set(dateStr, type);
    undoStackRef.current.push(op);
    redoStackRef.current = [];
    setCanUndo(true);
    setCanRedo(false);
    load();
  };

  // Undo a row-deleted arc or alarm: recreate it from its snapshot. Arcs go
  // first (their alarms are regenerated server-side), then alarms — with
  // arc/parent references remapped to the recreated ids. If a current
  // incarnation of the entity already exists (e.g. it was deleted and undone
  // twice, or recreated under an earlier op), it is adopted instead of
  // duplicating it.
  const recreateDeleted = async (items) => {
    const arcRemap = new Map();
    for (const it of items) {
      if (it.type !== 'arc' || it.action !== 'delete') continue;
      const s = it.snapshot;
      let existing = arcs.find(a => sameArcShape(a, s));
      if (!existing) {
        const res = await api.arcs.create({
          start_time: s.start_time, end_time: s.end_time, mode: s.mode, tag_id: s.tag_id, label: s.label,
          days_of_week: s.days_of_week, has_lunch: s.has_lunch, lunch_start: s.lunch_start, lunch_end: s.lunch_end,
          has_morning_break: s.has_morning_break, morning_break_start: s.morning_break_start, morning_break_end: s.morning_break_end,
          has_afternoon_break: s.has_afternoon_break, afternoon_break_start: s.afternoon_break_start, afternoon_break_end: s.afternoon_break_end,
          reminders_before_start: s.reminders_before_start, recurring: s.recurring, start_date: s.start_date,
        });
        existing = res;
      }
      it.newId = existing.id;
      arcRemap.set(s.id, existing.id);
    }
    const alarmRemap = new Map();
    const alarmsToRestore = items
      .filter(it => it.type === 'alarm' && it.action === 'delete')
      .sort((a, b) => (a.snapshot.parent_alarm_id ? 1 : 0) - (b.snapshot.parent_alarm_id ? 1 : 0));
    for (const it of alarmsToRestore) {
      const s = it.snapshot;
      // Arc regeneration already restored this alarm.
      if (s.arc_id && arcRemap.has(s.arc_id)) continue;
      const parentId = s.parent_alarm_id ? (alarmRemap.get(s.parent_alarm_id) || s.parent_alarm_id) : null;
      const arcId = s.arc_id ? (arcRemap.get(s.arc_id) || s.arc_id) : null;
      let existing = alarms.find(a => sameAlarmShape(a, s, parentId));
      if (!existing) {
        const res = await api.alarms.create({
          time: s.time, days_of_week: s.days_of_week, tag_id: s.tag_id, label: s.label,
          is_active: s.is_active, snooze_minutes: s.snooze_minutes, start_date: s.start_date,
          recurring: s.recurring,
          parent_alarm_id: parentId,
          is_locked: s.is_locked, arc_id: arcId,
        });
        existing = res;
      }
      it.newId = existing.id;
      alarmRemap.set(s.id, existing.id);
    }
  };

  const applyOp = async (op, dir) => {
    const useBefore = dir === 'undo';
    if (op.kind === 'alarmDays') {
      const list = useBefore ? op.days.before : op.days.after;
      for (const a of list) {
        // The alarm may have been deleted since the op was recorded; skip it.
        try { await api.alarms.update(a.id, { days_of_week: a.days_of_week }); } catch {}
      }
    } else if (op.kind === 'dayEvent') {
      const t = useBefore ? op.event.before : op.event.after;
      try { await api.dayEvents.set(op.event.date, t); } catch {}
    } else if (op.kind === 'dayDelete') {
      const { alarms: alarmApi, arcs: arcApi } = api;
      for (const it of op.items) {
        if (it.action !== 'exception') continue;
        const ep = it.type === 'arc' ? arcApi : alarmApi;
        try {
          if (useBefore) await ep.removeException(it.id, it.date);
          else await ep.addException(it.id, it.date);
        } catch {}
      }
      if (useBefore) {
        try { await recreateDeleted(op.items); } catch {}
      } else {
        const resolved = new Map();
        for (const it of op.items) {
          if (it.action !== 'delete') continue;
          const list = it.type === 'arc' ? arcs : alarms;
          let rid = it.newId || it.id;
          if (!list.some(x => x.id === rid)) {
            // The recorded id is stale (the entity was deleted and recreated
            // again since). Delete its current incarnation instead.
            const parentId = it.snapshot?.parent_alarm_id ? resolved.get(it.snapshot.parent_alarm_id) : null;
            const match = list.find(x => it.type === 'arc'
              ? sameArcShape(x, it.snapshot)
              : sameAlarmShape(x, it.snapshot, parentId));
            if (match) rid = match.id;
          }
          resolved.set(it.snapshot?.id, rid);
          try {
            if (it.type === 'arc') await arcApi.delete(rid);
            else await alarmApi.delete(rid);
          } catch {}
        }
      }
    }
  };

  const handleUndo = async () => {
    const op = undoStackRef.current.pop();
    if (!op) return;
    await applyOp(op, 'undo');
    redoStackRef.current.push(op);
    setCanUndo(undoStackRef.current.length > 0);
    setCanRedo(true);
    await load();
  };

  const handleRedo = async () => {
    const op = redoStackRef.current.pop();
    if (!op) return;
    await applyOp(op, 'redo');
    undoStackRef.current.push(op);
    setCanRedo(redoStackRef.current.length > 0);
    setCanUndo(true);
    await load();
  };

  // Tag helpers
  const validateTagColor = (color, ignoreId) => {
    const others = tags.filter(t => t.id !== ignoreId);
    if (others.some(t => t.color === color)) return 'Color already in use';
    const similar = others.find(t => colorDistance(color, t.color) < 60);
    if (similar) return `Too similar to "${similar.name}"`;
    return '';
  };

  const handleSaveTag = async () => {
    const err = validateTagColor(tagEditColor, editingTag.id);
    if (err) { setTagEditError(err); return; }
    await api.tags.update(editingTag.id, { name: tagEditName, color: tagEditColor, categories: tagEditCategories });
    setEditingTag(null);
    setTagEditError('');
    load();
  };

  const handleDeleteTag = async (id) => {
    if (!confirm('Delete this tag? Its arcs and alarms will be removed too.')) return;
    await api.tags.delete(id);
    if (brushTag?.id === id) setBrushTag(null);
    load();
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;
    const err = validateTagColor(newTagColor, null);
    if (err) { setNewTagError(err); return; }
    try {
      await api.tags.create({ name: newTagName, color: newTagColor, categories: newTagCategories });
      setNewTagName(''); setNewTagColor('#00e5ff'); setNewTagCategories(['custom']); setShowCreateTag(false); setNewTagError('');
      load();
    } catch (e) {
      setNewTagError(e.message || 'Failed to create tag');
    }
  };

  const handleLogout = () => { logout(); navigate('/login'); };

  // Group the selected day's alarms into families (arc or parent+children), sorted by header time
  const buildFamilyGroups = () => {
    const groups = [];
    const used = new Set();
    for (const alarm of selectedDayAlarms) {
      if (used.has(alarm.id)) continue;
      let members;
      let header;
      let id;
      if (alarm.arc_id) {
        id = `arc-${alarm.arc_id}`;
        members = selectedDayAlarms.filter(a => a.arc_id === alarm.arc_id);
        const arc = arcs.find(a => a.id === alarm.arc_id);
        header = members.find(a => a.time === arc?.start_time) || members[0];
      } else {
        const rootId = alarm.parent_alarm_id || alarm.id;
        id = `fam-${rootId}`;
        members = selectedDayAlarms.filter(a => a.id === rootId || a.parent_alarm_id === rootId);
        header = members.find(a => a.id === rootId) || members[0];
      }
      if (header) {
        groups.push({ id, header, members });
        members.forEach(m => used.add(m.id));
      }
    }
    return groups.sort((g1, g2) => (g1.header?.time || '99:99').localeCompare(g2.header?.time || '99:99'));
  };
  const familyGroups = buildFamilyGroups();
  const displayGroups = showAll ? familyGroups : familyGroups.slice(0, 5);
  const toggleFamily = (id) => setCollapsedFams(prev => {
    const next = new Set(prev);
    if (next.has(id)) next.delete(id); else next.add(id);
    return next;
  });

  const handleSelectDate = (dateStr) => {
    setSelectedAlarmIds(new Set());
    setSlideArc(null);
    setArcOptions(null);
    setSelectedDate(new Date(dateStr + 'T00:00:00'));
  };
  const handleToggleSelection = (alarm, shift) => {
    setSelectedAlarmIds(prev => {
      if (shift) return new Set(selectedDayAlarms.map(a => a.id));
      const next = new Set(prev);
      if (next.has(alarm.id)) next.delete(alarm.id); else next.add(alarm.id);
      return next;
    });
  };
  const detailArc = detailAlarm?.arc_id ? arcs.find(a => a.id === detailAlarm.arc_id) : null;
  return (
    <div className="min-h-screen bg-neon-bg flex flex-col">
      {editingAlarm && <EditAlarmModal alarm={editingAlarm} tags={tags} onClose={() => setEditingAlarm(null)} onSave={handleSaveAlarm} onDelete={handleDeleteAlarm} />}
      {deletePrompt && (
        <DeleteAlarmPrompt
          alarm={deletePrompt}
          dayCount={dayAlarmCount + dayArcCount}
          onClose={() => setDeletePrompt(null)}
          onDeleteDay={deleteAllForSelectedDay}
          onDeleteAlarm={() => deleteSingleForDate(deletePrompt)}
        />
      )}
      {detailAlarm && (
        <AlarmDetailModal
          alarm={detailAlarm}
          arc={detailArc}
          onClose={() => setDetailAlarm(null)}
          onEdit={(alarm) => {
            if (alarm.arc_id) {
              const arc = arcs.find(a => a.id === alarm.arc_id);
              if (arc) { setDetailAlarm(null); setPaintArc(arc); return; }
            }
            setDetailAlarm(null);
            setEditingAlarm(alarm);
          }}
          onDelete={handleDeleteAlarm}
          onToggle={load}
          onSchedule={(a) => { setScheduleAlarm(a); }}
          onToggleLock={handleToggleLock}
          onArcSlide={(a) => { setDetailAlarm(null); setSlideArc(a); }}
          onArcEdit={(a) => { setDetailAlarm(null); setPaintArc(a); }}
          onArcDelete={handleArcOptionsDelete}
        />
      )}
      {scheduleAlarm && (
        <WorkScheduleModal alarm={scheduleAlarm} onClose={() => setScheduleAlarm(null)} onGenerate={handleScheduleSave} />
      )}
      {arcOptions && (
        <ArcOptionsMenu
          arc={arcOptions}
          onClose={() => setArcOptions(null)}
          onSlide={(a) => { setArcOptions(null); setSlideArc(a); }}
          onEdit={handleArcOptionsEdit}
          onDelete={handleArcOptionsDelete}
        />
      )}
      {paintArc && (
        <PaintArcModal
          arc={paintArc}
          tag={brushTag || tags.find(t => t.id === paintArc.tag_id)}
          defaultDay={selectedDow}
          defaultDate={selectedDateStr}
          onClose={() => setPaintArc(null)}
          onSave={handleArcSave}
        />
      )}

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-4 border-b border-neon-border bg-neon-surface/50">
        <div className="flex items-center gap-4">
          <h1 className="font-display text-xl font-bold text-neon-cyan tracking-wider">NEON ALARM</h1>
          <WorkDayToggle onToggle={load} />
        </div>
        <div className="flex items-center gap-4">
          {import.meta.env.DEV && (
            <button onClick={triggerTestAlarm}
              className="text-xs font-display px-2 py-1 rounded border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors"
              title="Dev tool: fire a test alarm now">
              🔔 TEST ALARM
            </button>
          )}
          <span className="text-xs text-gray-500 font-display">{user?.email}</span>
          <button onClick={handleLogout} className="text-xs text-gray-500 hover:text-red-400 transition-colors">Sign Out</button>
        </div>
      </header>

      {/* Dev-only test alarm overlay */}
      {testAlert && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-neon-bg/95 backdrop-blur-sm">
          <p className="font-display text-sm tracking-[0.3em] text-neon-cyan animate-pulse-glow">TEST ALARM</p>
          <p className="font-display text-8xl font-black text-white" style={{ textShadow: '0 0 32px #00e5ff80' }}>{testAlert}</p>
          <div className="flex gap-4">
            <button onClick={dismissTestAlarm}
              className="font-display text-sm px-8 py-3 rounded-lg border border-neon-cyan/40 bg-neon-cyan/10 text-neon-cyan hover:bg-neon-cyan/20 transition-colors">
              SNOOZE 10 MIN
            </button>
            <button onClick={dismissTestAlarm}
              className="font-display text-sm px-8 py-3 rounded-lg border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
              DISMISS
            </button>
          </div>
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex items-start justify-center p-6 gap-5">
        {/* Left: Tag brush panel */}
        <div className="w-48 flex-shrink-0 space-y-2 pt-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] text-gray-500 font-display tracking-wider">TAGS</p>
            <button onClick={() => setShowCreateTag(!showCreateTag)} className="text-neon-cyan text-lg leading-none hover:text-white">+</button>
          </div>

          {showCreateTag && (
            <div className="neon-card p-2 space-y-2">
              <input type="text" value={newTagName} onChange={(e) => setNewTagName(e.target.value)} placeholder="Tag name"
                className="w-full bg-neon-bg border border-neon-border rounded px-2 py-1 text-[10px] text-white placeholder-gray-500 focus:outline-none focus:border-neon-cyan"
                onKeyDown={(e) => e.key === 'Enter' && handleCreateTag()} />
              <div className="flex gap-1 flex-wrap">
                {PRESET_COLORS.map((c) => {
                  const taken = tags.some(t => t.color === c);
                  const tooClose = !taken && tags.some(t => colorDistance(c, t.color) < 60);
                  return (
                    <button key={c} onClick={() => { setNewTagColor(c); setNewTagError(''); }}
                      className={`w-4 h-4 rounded-full border-2 transition-all ${taken || tooClose ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-110'} ${newTagColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                      style={{ backgroundColor: c }} disabled={taken || tooClose} />
                  );
                })}
              </div>
              <div className="flex items-center gap-2">
                <input type="color" value={newTagColor} onChange={(e) => { setNewTagColor(e.target.value); setNewTagError(''); }}
                  className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
                <span className="text-[9px] text-gray-500 font-mono">{newTagColor}</span>
              </div>
              <div className="space-y-1">
                <p className="text-[9px] text-gray-400 font-display">CATEGORIES</p>
                <CategoryButtons selected={newTagCategories} onChange={setNewTagCategories} />
              </div>
              {newTagError && <p className="text-[9px] text-red-400">{newTagError}</p>}
              <div className="flex gap-1">
                <button onClick={handleCreateTag} className="flex-1 text-[9px] px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan font-display">CREATE</button>
                <button onClick={() => { setShowCreateTag(false); setNewTagError(''); }} className="flex-1 text-[9px] px-2 py-1 rounded bg-gray-800 text-gray-400">Cancel</button>
              </div>
            </div>
          )}

          {tags.map(tag => (
            <div key={tag.id} className="group">
              {editingTag?.id === tag.id ? (
                <div className="neon-card p-2 space-y-2">
                  <input type="text" value={tagEditName} onChange={(e) => setTagEditName(e.target.value)}
                    className="w-full bg-neon-bg border border-neon-border rounded px-2 py-1 text-[10px] text-white focus:outline-none focus:border-neon-cyan" />
                  <div className="flex gap-1 flex-wrap">
                    {PRESET_COLORS.map((c) => {
                      const taken = tags.some(t => t.color === c && t.id !== tag.id);
                      const tooClose = !taken && tags.some(t => t.id !== tag.id && colorDistance(c, t.color) < 60);
                      return (
                        <button key={c} onClick={() => { setTagEditColor(c); setTagEditError(''); }}
                          className={`w-4 h-4 rounded-full border-2 transition-all ${taken || tooClose ? 'opacity-30 cursor-not-allowed' : 'cursor-pointer hover:scale-110'} ${tagEditColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                          style={{ backgroundColor: c }} disabled={taken || tooClose} />
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-2">
                    <input type="color" value={tagEditColor} onChange={(e) => { setTagEditColor(e.target.value); setTagEditError(''); }}
                      className="w-5 h-5 rounded cursor-pointer bg-transparent border-0" />
                    <span className="text-[9px] text-gray-500 font-mono">{tagEditColor}</span>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] text-gray-400 font-display">CATEGORIES</p>
                    <CategoryButtons selected={tagEditCategories} onChange={setTagEditCategories} />
                  </div>
                  {tagEditError && <p className="text-[9px] text-red-400">{tagEditError}</p>}
                  <div className="flex gap-1">
                    <button onClick={handleSaveTag} className="flex-1 text-[9px] px-2 py-1 rounded bg-neon-cyan/20 text-neon-cyan">Save</button>
                    <button onClick={() => { setEditingTag(null); setTagEditError(''); }} className="flex-1 text-[9px] px-2 py-1 rounded bg-gray-800 text-gray-400">Cancel</button>
                  </div>
                </div>
              ) : (
                <div
                  onClick={() => setBrushTag(brushTag?.id === tag.id ? null : tag)}
                  onMouseEnter={() => setHoveredTag(tag.id)}
                  onMouseLeave={() => setHoveredTag(null)}
                  className={`cursor-pointer p-2 rounded-lg border flex items-center gap-2 transition-all hover:scale-105 ${brushTag?.id === tag.id ? 'ring-2 ring-white/60 scale-105' : ''} ${hoveredTag === tag.id ? 'ring-1 ring-white/30' : ''}`}
                  style={{ borderColor: `${tag.color}40`, backgroundColor: `${tag.color}10` }}
                  title={brushTag?.id === tag.id ? 'Click to put the brush down' : 'Click to pick up as a paint brush'}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: tag.color, boxShadow: `0 0 6px ${tag.color}60` }} />
                  <span className="text-[9px] font-display flex-1 truncate" style={{ color: tag.color }}>
                    {tag.name}
                  </span>
                  <span className="text-[9px] opacity-0 group-hover:opacity-100 transition-opacity" title={tag.categories}>
                    {(tag.categories?.split(',') || []).map(c => CATEGORY_ICONS[c]).join('')}
                  </span>
                  {!tag.is_system_default && (
                    <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={(e) => { e.stopPropagation(); setEditingTag(tag); setTagEditName(tag.name); setTagEditColor(tag.color); setTagEditCategories(tag.categories?.split(',') || ['custom']); }} className="text-gray-400 hover:text-neon-cyan p-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteTag(tag.id); }} className="text-gray-400 hover:text-red-400 p-0.5">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Center: Clock + Calendar side by side */}
        <div className="flex gap-5">
          {/* Clock */}
          <div className="w-[340px] h-[380px] flex-shrink-0">
            <div ref={clockRef} className="neon-card relative overflow-hidden h-full border-neon-cyan/20 bg-gradient-to-br from-[#060612] via-[#0a0a1a] to-[#060612] select-none touch-none"
              onPointerDown={handleClockPointerDown}
              onPointerMove={handleClockPointerMove}
              onPointerUp={handleClockPointerUp}>
              {/* Digital time */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
                <div className="font-display text-2xl font-black tracking-wider text-neon-cyan" style={{ textShadow: '0 0 20px #00e5ff60' }}>
                  {String(displayHours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}:{String(seconds).padStart(2, '0')}
                </div>
              </div>

              {/* Paint mode indicator */}
              {brushTag && !painting && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
                  <div className="text-[10px] font-display tracking-wider px-3 py-1.5 rounded-lg border border-dashed"
                    style={{ color: brushTag.color, borderColor: `${brushTag.color}60`, backgroundColor: `${brushTag.color}10` }}>
                    PAINT WITH {brushTag.name.toUpperCase()} — DRAG ON CLOCK
                  </div>
                </div>
              )}

              {painting && brushTag && (
                <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 text-center pointer-events-none">
                  <div className="text-[10px] font-display tracking-wider px-3 py-1.5 rounded-lg border"
                    style={{ color: brushTag.color, borderColor: `${brushTag.color}60`, backgroundColor: `${brushTag.color}15` }}>
                    {paintTimes(paintStart, paintCurrent, ampm).start} → {paintTimes(paintStart, paintCurrent, ampm).end}
                  </div>
                </div>
              )}

              {/* Slide mode indicator */}
              {slideArc && (
                <>
                  <div className="absolute top-12 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 pointer-events-none">
                    <div className="text-[10px] font-display tracking-wider px-3 py-1.5 rounded-lg border"
                      style={{ color: slideArc.tag_color || '#00e5ff', borderColor: `${slideArc.tag_color || '#00e5ff'}60`, backgroundColor: `${slideArc.tag_color || '#00e5ff'}15` }}>
                      {slidePreview
                        ? `${slidePreview.start} → ${slidePreview.end}  ·  ${slideOffsetRef.current > 0 ? `+${slideOffsetRef.current}` : slideOffsetRef.current} min`
                        : `${slideArc.start_time} → ${slideArc.end_time} — DRAG TO SLIDE`}
                    </div>
                  </div>
                  <button onClick={cancelSlide}
                    className="absolute top-1 right-2 z-10 text-[9px] font-display tracking-wider px-2 py-1 rounded border border-red-500/40 bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors">
                    X CANCEL
                  </button>
                </>
              )}

              <svg viewBox="0 0 300 300" className="w-full h-full">
                <defs>
                  <filter id="glow"><feGaussianBlur stdDeviation="3" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <filter id="glow-strong"><feGaussianBlur stdDeviation="6" result="blur" /><feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                  <radialGradient id="face-gradient" cx="50%" cy="40%">
                    <stop offset="0%" stopColor="#0d1525" />
                    <stop offset="100%" stopColor="#060612" />
                  </radialGradient>
                </defs>
                <circle cx={cx} cy={cy} r={r} fill="url(#face-gradient)" stroke="#00e5ff25" strokeWidth="2" />

                {Array.from({ length: 12 }, (_, i) => {
                  const angle = (i / 12) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const isMain = i % 3 === 0;
                  return <line key={i} x1={cx + (r - (isMain ? 20 : 12)) * Math.cos(rad)} y1={cy + (r - (isMain ? 20 : 12)) * Math.sin(rad)} x2={cx + (r - 4) * Math.cos(rad)} y2={cy + (r - 4) * Math.sin(rad)} stroke="#00e5ff" strokeWidth={isMain ? 3 : 1.5} strokeLinecap="round" filter="url(#glow)" opacity={isMain ? 1 : 0.5} />;
                })}
                {Array.from({ length: 60 }, (_, i) => {
                  if (i % 5 === 0) return null;
                  const rad = (((i / 60) * 360 - 90) * Math.PI) / 180;
                  return <circle key={`m${i}`} cx={cx + (r - 6) * Math.cos(rad)} cy={cy + (r - 6) * Math.sin(rad)} r={1} fill="#00e5ff30" />;
                })}
                {[12,1,2,3,4,5,6,7,8,9,10,11].map((num, i) => {
                  const rad = (((i / 12) * 360 - 90) * Math.PI) / 180;
                  return <text key={num} x={cx + (r - 32) * Math.cos(rad)} y={cy + (r - 32) * Math.sin(rad)} textAnchor="middle" dominantBaseline="central" fill="#67e8f9" fontSize="11" fontFamily="Orbitron, monospace" fontWeight="700">{num}</text>;
                })}

                {/* Persisted painted arcs (always visible) */}
                {visibleArcs.map(arc => {
                  const color = arc.tag_color || '#00e5ff';
                  const preview = slideArc?.id === arc.id ? slidePreview : null;
                  const drawStart = preview ? preview.start : arc.start_time;
                  const drawEnd = preview ? preview.end : arc.end_time;
                  const path = describePaintedArc(cx, cy, rInner, rOuter, drawStart, drawEnd);
                  const isSliding = slideArc?.id === arc.id;
                  const isHoverMatch = hoveredTag != null && arc.tag_id === hoveredTag;
                  const dimmed = hoveredTag != null && !isHoverMatch;
                  const highlight = isHoverMatch || isSliding;
                  const opacity = arc.is_active ? (dimmed ? 0.1 : 1) : 0.3;
                  if (path) {
                    return (
                      <g key={arc.id} opacity={opacity} className="cursor-pointer"
                        onMouseDown={() => handleArcLongPressStart(arc)}
                        onMouseUp={handleArcLongPressEnd}
                        onMouseLeave={handleArcLongPressEnd}
                        onTouchStart={() => handleArcLongPressStart(arc)}
                        onTouchEnd={handleArcLongPressEnd}
                        style={highlight ? { filter: `drop-shadow(0 0 8px ${color})` } : undefined}>
                        <path d={path} fill="none" stroke={color} strokeWidth={highlight ? "14" : "12"} opacity={highlight ? "0.22" : "0.12"} strokeLinecap="round" />
                        <path d={path} fill="none" stroke={color} strokeWidth={highlight ? "4.5" : "2.5"} opacity={highlight ? "1" : "0.85"} strokeLinecap="round" filter={highlight ? "url(#glow-strong)" : "url(#glow)"} />
                      </g>
                    );
                  }
                  const [ah, am] = drawStart.split(':').map(Number);
                  const ang = ((timeToAngle(ah, am) - 90) * Math.PI) / 180;
                  const radius = ah >= 12 ? rInner : rOuter;
                  return (
                    <circle key={arc.id} cx={cx + radius * Math.cos(ang)} cy={cy + radius * Math.sin(ang)} r={highlight ? 6 : 4} fill={color} filter="url(#glow-strong)" opacity={opacity}
                      className="cursor-pointer"
                      onMouseDown={() => handleArcLongPressStart(arc)}
                      onMouseUp={handleArcLongPressEnd}
                      onMouseLeave={handleArcLongPressEnd}
                      onTouchStart={() => handleArcLongPressStart(arc)}
                      onTouchEnd={handleArcLongPressEnd} />
                  );
                })}

                {/* Painting preview */}
                {paintPreview && brushTag && (
                  <g opacity={0.8}>
                    <path d={paintPreview} fill="none" stroke={brushTag.color} strokeWidth="10" opacity="0.25" strokeLinecap="round" />
                    <path d={paintPreview} fill="none" stroke={brushTag.color} strokeWidth="2" opacity="0.9" strokeLinecap="round" filter="url(#glow)" />
                  </g>
                )}

                {/* Alarm arms for standalone alarms (not arc-based) with long press */}
                {selectedDayAlarms.filter(a => !a.arc_id).map((alarm, i) => {
                  const [ah, am] = alarm.time.split(':').map(Number);
                  const armAngle = timeToAngle(ah, am);
                  const rad = ((armAngle - 90) * Math.PI) / 180;
                  const armLen = r - 45 - (i % 2) * 10;
                  const armDimmed = hoveredTag != null && alarm.tag_id !== hoveredTag;
                  return (
                    <g key={alarm.id}
                      onMouseDown={() => handleAlarmLongPressStart(alarm)}
                      onMouseUp={handleAlarmLongPressEnd}
                      onMouseLeave={handleAlarmLongPressEnd}
                      onTouchStart={() => handleAlarmLongPressStart(alarm)}
                      onTouchEnd={handleAlarmLongPressEnd}
                      className="cursor-pointer">
                      <line x1={cx} y1={cy} x2={cx + armLen * Math.cos(rad)} y2={cy + armLen * Math.sin(rad)} stroke={alarm.tag_color || '#00e5ff'} strokeWidth={2.5} strokeLinecap="round" filter="url(#glow)" opacity={armDimmed ? 0.1 : 0.7} />
                      <circle cx={cx + armLen * Math.cos(rad)} cy={cy + armLen * Math.sin(rad)} r={armDimmed ? 2.5 : 4} fill={alarm.tag_color || '#00e5ff'} filter="url(#glow-strong)" opacity={armDimmed ? 0.15 : 0.9} />
                    </g>
                  );
                })}

                <line x1={cx} y1={cy} x2={cx + 55 * Math.cos(((hourAngle - 90) * Math.PI) / 180)} y2={cy + 55 * Math.sin(((hourAngle - 90) * Math.PI) / 180)} stroke="#e0f2fe" strokeWidth="4" strokeLinecap="round" filter="url(#glow-strong)" />
                <line x1={cx} y1={cy} x2={cx + 85 * Math.cos(((minuteAngle - 90) * Math.PI) / 180)} y2={cy + 85 * Math.sin(((minuteAngle - 90) * Math.PI) / 180)} stroke="#00e5ff" strokeWidth="2.5" strokeLinecap="round" filter="url(#glow)" />
                <line x1={cx - 15 * Math.cos(((secondAngle - 90) * Math.PI) / 180)} y1={cy - 15 * Math.sin(((secondAngle - 90) * Math.PI) / 180)} x2={cx + 95 * Math.cos(((secondAngle - 90) * Math.PI) / 180)} y2={cy + 95 * Math.sin(((secondAngle - 90) * Math.PI) / 180)} stroke="#06b6d4" strokeWidth="1" strokeLinecap="round" opacity={0.8} />
                <circle cx={cx} cy={cy} r={5} fill="#00e5ff" filter="url(#glow-strong)" />
                <circle cx={cx} cy={cy} r={2} fill="white" />
              </svg>

              {/* Bottom controls */}
              <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between bg-gradient-to-t from-black/40 to-transparent">
                <div className="flex items-center gap-2">
                  <button onClick={() => setAmpm(ampm === 'AM' ? 'PM' : 'AM')}
                    className={`text-[10px] font-display px-2 py-1 rounded transition-colors border ${
                      ampm === 'AM'
                        ? 'text-[#ffb74d] bg-[#ff9100]/20 hover:bg-[#ff9100]/30 border-[#ff9100]/40 font-bold'
                        : 'text-neon-cyan bg-neon-cyan/10 hover:bg-neon-cyan/20 border border-neon-cyan/20'
                    }`}>
                    {ampm}
                  </button>
                  <span className="text-[10px] font-display text-white font-bold">
                    {String(displayHours).padStart(2, '0')}:{String(minutes).padStart(2, '0')}
                  </span>
                </div>
                <select value={timezone} onChange={(e) => setTimezone(Number(e.target.value))}
                  className="bg-black/40 border border-white/10 rounded-lg px-2 py-1 text-[10px] text-gray-300 font-display focus:outline-none focus:border-neon-cyan appearance-none cursor-pointer">
                  {TIMEZONES.map(tz => <option key={tz.offset} value={tz.offset}>{tz.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Calendar */}
          <div className="w-[420px] h-[380px] flex-shrink-0">
            <AlarmCalendar alarms={alarms} highlightedDays={highlightedDays || tagHighlightDays} highlightAllWeek={hoveredAlarm != null}
              dayEvents={dayEvents} onApplyDays={handleApplyDays} onApplyDayEvent={handleApplyDayEvent}
              onUndo={handleUndo} onRedo={handleRedo} canUndo={canUndo} canRedo={canRedo}
              selectedDateStr={selectedDateStr} onSelectDate={handleSelectDate}
              selectedAlarmIds={selectedAlarmIds} onClearDates={handleClearDates}
              exceptions={exceptions} />
          </div>
        </div>

        {/* Right: Alarm list */}
        <div className="w-56 flex-shrink-0">
          <div className="flex items-center justify-between mb-3">
            <p className="text-[9px] text-gray-500 font-display tracking-wider">
              {DAYS[selectedDow].toUpperCase()} {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'][selectedDate.getMonth()]} {selectedDate.getDate()}
              {isTodaySelected ? ' · TODAY' : ''}
            </p>
            <button onClick={() => setEditingAlarm({ time: '08:00', label: '', tag_id: null, snooze_minutes: 5, days_of_week: String(selectedDow) })}
              className="text-[9px] font-display tracking-wider text-neon-cyan border border-neon-cyan/40 rounded px-2 py-0.5 hover:bg-neon-cyan/10 transition-colors">+ NEW</button>
          </div>
          <div className="space-y-1.5 max-h-[380px] overflow-hidden">
            {displayGroups.length === 0 ? (
              <p className="text-[10px] text-gray-600">No alarms {isTodaySelected ? 'today' : 'that day'}</p>
            ) : (
              displayGroups.map(group => {
                const collapsed = collapsedFams.has(group.id);
                const isFamily = group.members.length > 1;
                const renderRow = (alarm, { isHeader = false, child = false } = {}) => {
                  const color = alarm.tag_color || '#00e5ff';
                  const name = alarm.label || alarm.tag_name || 'Alarm';
                  const tagMatch = hoveredTag != null && alarm.tag_id === hoveredTag;
                  const dimmed = hoveredTag != null ? !tagMatch : alarm.is_active !== 1;
                  const isSel = selectedAlarmIds.has(alarm.id);
                  return (
                    <div key={alarm.id}
                      className={`group relative neon-card py-2 px-2.5 cursor-pointer hover:bg-white/5 transition-all ${dimmed ? 'opacity-40' : ''} ${tagMatch ? 'ring-1 ring-white/40' : ''} ${isSel ? 'bg-neon-cyan/10 ring-1 ring-neon-cyan/40' : ''} ${child ? 'ml-3 border-l-2 rounded-l-none' : ''}`}
                      style={{ borderColor: isHeader ? `${color}30` : `${color}20` }}
                      onClick={(e) => handleToggleSelection(alarm, e.shiftKey)}
                      onMouseEnter={() => setHoveredAlarm(alarm.id)}
                      onMouseLeave={() => setHoveredAlarm(null)}>
                      <div className="flex items-center gap-2">
                        {isHeader && isFamily && (
                          <button onClick={(e) => { e.stopPropagation(); toggleFamily(group.id); }} className="text-[8px] text-neon-cyan flex-shrink-0 hover:text-white">
                            {collapsed ? '▸' : '▾'}
                          </button>
                        )}
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: dimmed ? '#555' : color, boxShadow: dimmed ? 'none' : `0 0 4px ${color}80` }} />
                        <div className="flex-1 min-w-0">
                          <p className="font-display text-xs font-bold text-white truncate">
                            {name}
                            {isHeader && isFamily && <span className="ml-1 text-[9px] text-gray-500 font-normal">({group.members.length})</span>}
                          </p>
                          <p className="font-mono text-[11px]" style={{ color: dimmed ? '#666' : color }}>{alarm.time}</p>
                        </div>
                        <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={(e) => { e.stopPropagation(); setDetailAlarm(alarm); }} className="text-gray-400 hover:text-neon-cyan p-0.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                          </button>
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteAlarm(alarm.id); }} className="text-gray-400 hover:text-red-400 p-0.5">
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                };
                const children = collapsed ? [] : group.members.filter(m => m.id !== group.header.id);
                return (
                  <div key={group.id} className="space-y-1.5">
                    {renderRow(group.header, { isHeader: true })}
                    {children.map(child => renderRow(child, { child: true }))}
                  </div>
                );
              })
            )}
          </div>
          {familyGroups.length > 5 && (
            <button onClick={() => setShowAll(!showAll)}
              className="mt-2 w-full text-[9px] text-neon-cyan font-display tracking-wider hover:text-white transition-colors py-1.5 rounded-lg border border-neon-cyan/20 hover:border-neon-cyan/40">
              {showAll ? 'LESS' : `+${familyGroups.length - 5} MORE`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
