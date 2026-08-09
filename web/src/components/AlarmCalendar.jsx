import { useEffect, useRef, useState } from 'react';

const DAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDaysInMonth(year, month) { return new Date(year, month + 1, 0).getDate(); }
function getFirstDayOfMonth(year, month) { return new Date(year, month, 1).getDay(); }

function dateStr(year, month, day) {
  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

// An alarm applies to a date if its weekday is selected. Recurring alarms only
// exist from their start date onwards; a non-recurring (one-time) alarm applies
// on exactly its start date. Date exceptions (deleted single occurrences) are
// checked per alarm and per arc.
export function alarmAppliesOnDate(alarm, date, exceptions) {
  if (!alarm?.days_of_week) return false;
  const dow = new Date(date + 'T00:00:00').getDay();
  if (!alarm.days_of_week.split(',').includes(String(dow))) return false;
  if (exceptions) {
    if (alarm.arc_id && exceptions.arcs?.get(alarm.arc_id)?.has(date)) return false;
    if (exceptions.alarms?.get(alarm.id)?.has(date)) return false;
  }
  if (alarm.recurring === 0) return alarm.start_date === date;
  if (alarm.start_date && date < alarm.start_date) return false;
  return true;
}

export default function AlarmCalendar({
  alarms, highlightedDays, highlightAllWeek,
  dayEvents, onApplyDays, onApplyDayEvent,
  onUndo, onRedo, canUndo, canRedo,
  selectedDateStr, onSelectDate,
  selectedAlarmIds, onClearDates, exceptions,
}) {
  const today = new Date();
  const todayStr = dateStr(today.getFullYear(), today.getMonth(), today.getDate());
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());
  const [tool, setTool] = useState(null); // 'rest' | 'pto' | 'clear' | null
  const [clearDates, setClearDates] = useState(new Set());
  const paintingRef = useRef({ mode: 'none', dows: new Set(), dates: new Set() });
  const calendarRef = useRef(null);

  // Clicking outside the calendar while a tool is armed exits that tool.
  useEffect(() => {
    if (!tool) return;
    const handleOutside = (e) => {
      if (calendarRef.current && !calendarRef.current.contains(e.target)) {
        setTool(null);
        setClearDates(new Set());
      }
    };
    document.addEventListener('pointerdown', handleOutside);
    return () => document.removeEventListener('pointerdown', handleOutside);
  }, [tool]);

  const highlightSet = highlightedDays ? new Set(highlightedDays.map(Number)) : null;
  const eventMap = {};
  (dayEvents || []).forEach(e => { eventMap[e.date] = e.type; });

  // Hover highlights only show within the week containing the selected date.
  const selectedWeekStart = (() => {
    if (!selectedDateStr) return null;
    const d = new Date(selectedDateStr + 'T00:00:00');
    d.setDate(d.getDate() - d.getDay());
    return d;
  })();
  const inSelectedWeek = (date) => {
    if (!selectedWeekStart) return false;
    const d = new Date(date + 'T00:00:00');
    return d >= selectedWeekStart && d < new Date(selectedWeekStart.getTime() + 7 * 86400000);
  };

  const daysInMonth = getDaysInMonth(currentYear, currentMonth);
  const firstDay = getFirstDayOfMonth(currentYear, currentMonth);

  const prevMonth = () => {
    if (currentMonth === 0) { setCurrentMonth(11); setCurrentYear(currentYear - 1); }
    else setCurrentMonth(currentMonth - 1);
  };
  const nextMonth = () => {
    if (currentMonth === 11) { setCurrentMonth(0); setCurrentYear(currentYear + 1); }
    else setCurrentMonth(currentMonth + 1);
  };

  const getAlarmsForDate = (date) => {
    const dayAlarms = alarms.filter(a => alarmAppliesOnDate(a, date, exceptions));
    // One dot per family (arc or parent/child group) so the dates don't crowd.
    const families = [];
    const seen = new Set();
    for (const a of dayAlarms) {
      const key = a.arc_id ? `arc-${a.arc_id}` : (a.parent_alarm_id ? `fam-${a.parent_alarm_id}` : `alarm-${a.id}`);
      if (seen.has(key)) continue;
      seen.add(key);
      families.push(a);
    }
    return families;
  };

  const cells = [];
  for (let i = 0; i < firstDay; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const selectedIds = selectedAlarmIds;

  const commitPaint = async () => {
    const p = paintingRef.current;
    if (p.mode === 'days') {
      const dows = [...p.dows];
      if (dows.length && selectedIds.size) await onApplyDays([...selectedIds], dows);
    } else if (p.mode === 'event' && tool) {
      const dates = [...p.dates];
      if (tool === 'clear') {
        setClearDates(prev => new Set([...prev, ...dates]));
      } else {
        for (const d of dates) await onApplyDayEvent(d, tool);
      }
    }
    paintingRef.current = { mode: 'none', dows: new Set(), dates: new Set() };
  };

  const cellPointerDown = (date, dow) => {
    if (tool) {
      paintingRef.current = { mode: 'event', dows: new Set(), dates: new Set([date]) };
    } else if (selectedIds.size > 0) {
      paintingRef.current = { mode: 'days', dows: new Set([dow]), dates: new Set() };
    }
  };
  const cellPointerEnter = (date, dow) => {
    const p = paintingRef.current;
    if (p.mode === 'event') p.dates.add(date);
    else if (p.mode === 'days') p.dows.add(dow);
  };

  const handleToolClick = (name) => {
    setTool(t => (t === name ? null : name));
    setClearDates(new Set());
  };

  // CLEAR: first click arms date selection; pressing it again deletes the
  // alarms and arcs on every selected date.
  const handleClearClick = () => {
    if (tool !== 'clear') {
      setTool('clear');
      setClearDates(new Set());
      return;
    }
    if (clearDates.size === 0) return;
    onClearDates([...clearDates]);
    setTool(null);
    setClearDates(new Set());
  };

  return (
    <div ref={calendarRef} className="neon-card border-neon-cyan/20 bg-gradient-to-br from-[#060612] to-[#0a0a1a] h-full flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neon-border">
        <button onClick={prevMonth} className="text-gray-400 hover:text-neon-cyan text-lg px-2 transition-colors">‹</button>
        <h3 className="font-display text-sm text-neon-cyan tracking-wider">{MONTHS[currentMonth].toUpperCase()} {currentYear}</h3>
        <button onClick={nextMonth} className="text-gray-400 hover:text-neon-cyan text-lg px-2 transition-colors">›</button>
      </div>

      {/* Day headers */}
      <div className="grid grid-cols-7 gap-1 px-4 pt-3">
        {DAYS_SHORT.map((d, i) => (
          <div key={d} className={`text-center text-[10px] py-1 font-display transition-colors ${highlightSet?.has(i) ? 'text-neon-cyan font-bold' : 'text-gray-500'}`}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div className="grid grid-cols-7 auto-rows-fr gap-1 px-4 py-2 flex-1 min-h-0"
        onPointerUp={commitPaint}
        onPointerLeave={() => { paintingRef.current = { mode: 'none', dows: new Set(), dates: new Set() }; }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={`empty-${i}`} />;
          const date = dateStr(currentYear, currentMonth, day);
          const dow = new Date(currentYear, currentMonth, day).getDay();
          const dayAlarms = getAlarmsForDate(date);
          const isToday = date === todayStr;
          const isSelected = date === selectedDateStr;
          const hasAlarms = dayAlarms.length > 0;
          const eventType = eventMap[date];
          // Hovering an alarm highlights the whole week; hovering a tag
          // highlights only that tag's weekdays within the selected week.
          const isHighlighted = (highlightAllWeek ? true : highlightSet?.has(dow)) && inSelectedWeek(date) && !isToday && !eventType;
          const isClearMarked = clearDates.has(date);

          return (
            <button key={day}
              onClick={() => onSelectDate?.(date)}
              onPointerDown={(e) => { e.preventDefault(); cellPointerDown(date, dow); }}
              onPointerEnter={() => cellPointerEnter(date, dow)}
              className={`relative min-h-[30px] rounded-lg text-xs font-display transition-all flex flex-col items-center justify-center select-none ${
                isClearMarked ? 'bg-red-500/25 text-red-200 border border-red-400/50' :
                eventType === 'rest' ? 'bg-red-500/20 text-red-300 border border-red-500/40' :
                eventType === 'pto' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                isSelected ? 'bg-neon-cyan/20 text-neon-cyan border border-neon-cyan/40' :
                isToday ? 'bg-white/5 text-white border border-white/20' :
                isHighlighted ? 'bg-neon-cyan/15 text-neon-cyan/80 ring-1 ring-neon-cyan/30' :
                hasAlarms ? 'text-white hover:bg-white/5' : 'text-gray-500 hover:bg-white/5'
              }`}>
              {day}
              {eventType ? (
                <span className={`text-[7px] font-bold mt-0.5 ${eventType === 'rest' ? 'text-red-400' : 'text-amber-400'}`}>
                  {eventType === 'rest' ? 'REST' : 'PTO'}
                </span>
              ) : hasAlarms && (
                <div className="flex gap-0.5 mt-0.5">
                  {dayAlarms.slice(0, 4).map((a, j) => (
                    <span key={j} className="w-1 h-1 rounded-full" style={{ backgroundColor: a.tag_color || '#00e5ff' }} />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tools */}
      <div className="mt-auto border-t border-neon-border px-4 py-3">
        <button onClick={handleClearClick}
          className={`w-full mb-1.5 flex items-center justify-center gap-1.5 text-[9px] font-display tracking-wider px-2 py-1.5 rounded-lg border transition-all ${
            tool === 'clear'
              ? 'border-red-400/60 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
              : 'border-neon-border bg-neon-bg/40 text-gray-500 hover:text-red-300 hover:border-red-500/40'
          }`}>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          {tool === 'clear'
            ? (clearDates.size ? `CLEAR · ${clearDates.size} DATE${clearDates.size > 1 ? 'S' : ''}` : 'CLEAR — SELECT DATES')
            : 'CLEAR'}
        </button>
        <div className="grid grid-cols-4 gap-1.5">
          <button onClick={() => handleToolClick('rest')}
            className={`flex items-center justify-center gap-1.5 text-[9px] font-display tracking-wider px-1 py-1.5 rounded-lg border transition-all ${
              tool === 'rest'
                ? 'border-red-400/60 bg-red-500/15 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.25)]'
                : 'border-neon-border bg-neon-bg/40 text-gray-500 hover:text-red-300 hover:border-red-500/40'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tool === 'rest' ? 'bg-red-400 shadow-[0_0_6px_#f87171]' : 'bg-red-500/50'}`} />
            REST DAY
          </button>
          <button onClick={() => handleToolClick('pto')}
            className={`flex items-center justify-center gap-1.5 text-[9px] font-display tracking-wider px-1 py-1.5 rounded-lg border transition-all ${
              tool === 'pto'
                ? 'border-amber-400/60 bg-amber-500/15 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'border-neon-border bg-neon-bg/40 text-gray-500 hover:text-amber-300 hover:border-amber-500/40'
            }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${tool === 'pto' ? 'bg-amber-400 shadow-[0_0_6px_#fbbf24]' : 'bg-amber-500/50'}`} />
            PTO
          </button>
          <button onClick={onUndo} disabled={!canUndo}
            className={`flex items-center justify-center gap-1 text-[9px] font-display tracking-wider px-1 py-1.5 rounded-lg border transition-all ${
              canUndo
                ? 'border-neon-border bg-neon-bg/40 text-gray-300 hover:text-neon-cyan hover:border-neon-cyan/50 hover:shadow-[0_0_10px_rgba(0,229,255,0.15)]'
                : 'border-neon-border/40 bg-neon-bg/20 text-gray-700 cursor-not-allowed'
            }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 14l-4-4 4-4M5 10h9a5 5 0 015 5v1" /></svg>
            UNDO
          </button>
          <button onClick={onRedo} disabled={!canRedo}
            className={`flex items-center justify-center gap-1 text-[9px] font-display tracking-wider px-1 py-1.5 rounded-lg border transition-all ${
              canRedo
                ? 'border-neon-border bg-neon-bg/40 text-gray-300 hover:text-neon-cyan hover:border-neon-cyan/50 hover:shadow-[0_0_10px_rgba(0,229,255,0.15)]'
                : 'border-neon-border/40 bg-neon-bg/20 text-gray-700 cursor-not-allowed'
            }`}>
            <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 14l4-4-4-4M19 10h-9a5 5 0 00-5 5v1" /></svg>
            REDO
          </button>
        </div>
      </div>
    </div>
  );
}
