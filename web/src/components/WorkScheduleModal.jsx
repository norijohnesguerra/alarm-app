import { useState } from 'react';

export function Toggle({ checked, onChange, color = '#00e5ff' }) {
  return (
    <button onClick={onChange} className={`neon-toggle ${checked ? '' : 'bg-gray-700'}`}
      style={checked ? { backgroundColor: `${color}30`, boxShadow: `0 0 10px ${color}40` } : {}}>
      <span className={`neon-toggle-knob ${checked ? 'translate-x-6' : ''}`}
        style={checked ? { backgroundColor: color, boxShadow: `0 0 8px ${color}80` } : { backgroundColor: '#666' }} />
    </button>
  );
}

export default function WorkScheduleModal({ alarm, onClose, onGenerate }) {
  const [schedule, setSchedule] = useState({
    start_time: '08:30', end_time: '17:00',
    has_lunch: true, lunch_start: '12:00', lunch_end: '13:00',
    has_morning_break: false, morning_break_start: '10:15', morning_break_end: '10:30',
    has_afternoon_break: false, afternoon_break_start: '15:00', afternoon_break_end: '15:15',
    reminders_before_start: 30,
  });

  const handleSubmit = (e) => { e.preventDefault(); onGenerate(alarm.id, schedule); };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="neon-card w-full max-w-md border-neon-lime/30 max-h-[90vh] overflow-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-display text-lg text-neon-lime tracking-wider mb-1">WORK SCHEDULE</h3>
        <p className="text-xs text-gray-500 mb-4">Generate child alarms from <span className="text-white">{alarm.time} {alarm.label}</span></p>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-1 font-display tracking-wider">START</label>
              <input type="time" value={schedule.start_time} onChange={(e) => setSchedule({ ...schedule, start_time: e.target.value })} className="neon-input w-full text-sm" />
            </div>
            <div className="flex-1">
              <label className="block text-[10px] text-gray-400 mb-1 font-display tracking-wider">END</label>
              <input type="time" value={schedule.end_time} onChange={(e) => setSchedule({ ...schedule, end_time: e.target.value })} className="neon-input w-full text-sm" />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <label className="text-[10px] text-gray-400 font-display tracking-wider">REMINDER BEFORE START</label>
            <input type="number" min="0" max="120" value={schedule.reminders_before_start}
              onChange={(e) => setSchedule({ ...schedule, reminders_before_start: parseInt(e.target.value) || 0 })}
              className="neon-input w-20 text-sm text-center" />
            <span className="text-[10px] text-gray-500">min</span>
          </div>

          {/* Lunch */}
          <div className="border-t border-neon-border pt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-[10px] text-gray-400 font-display tracking-wider">LUNCH BREAK</label>
              <Toggle checked={schedule.has_lunch} onChange={() => setSchedule({ ...schedule, has_lunch: !schedule.has_lunch })} color="#76ff03" />
            </div>
            {schedule.has_lunch && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                  <input type="time" value={schedule.lunch_start} onChange={(e) => setSchedule({ ...schedule, lunch_start: e.target.value })} className="neon-input w-full text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">End</label>
                  <input type="time" value={schedule.lunch_end} onChange={(e) => setSchedule({ ...schedule, lunch_end: e.target.value })} className="neon-input w-full text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Morning Break */}
          <div className="border-t border-neon-border pt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-[10px] text-gray-400 font-display tracking-wider">MORNING BREAK</label>
              <Toggle checked={schedule.has_morning_break} onChange={() => setSchedule({ ...schedule, has_morning_break: !schedule.has_morning_break })} color="#ff9100" />
            </div>
            {schedule.has_morning_break && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                  <input type="time" value={schedule.morning_break_start} onChange={(e) => setSchedule({ ...schedule, morning_break_start: e.target.value })} className="neon-input w-full text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">End</label>
                  <input type="time" value={schedule.morning_break_end} onChange={(e) => setSchedule({ ...schedule, morning_break_end: e.target.value })} className="neon-input w-full text-sm" />
                </div>
              </div>
            )}
          </div>

          {/* Afternoon Break */}
          <div className="border-t border-neon-border pt-3">
            <div className="flex items-center gap-3 mb-2">
              <label className="text-[10px] text-gray-400 font-display tracking-wider">AFTERNOON BREAK</label>
              <Toggle checked={schedule.has_afternoon_break} onChange={() => setSchedule({ ...schedule, has_afternoon_break: !schedule.has_afternoon_break })} color="#ff4081" />
            </div>
            {schedule.has_afternoon_break && (
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">Start</label>
                  <input type="time" value={schedule.afternoon_break_start} onChange={(e) => setSchedule({ ...schedule, afternoon_break_start: e.target.value })} className="neon-input w-full text-sm" />
                </div>
                <div className="flex-1">
                  <label className="block text-[10px] text-gray-400 mb-1">End</label>
                  <input type="time" value={schedule.afternoon_break_end} onChange={(e) => setSchedule({ ...schedule, afternoon_break_end: e.target.value })} className="neon-input w-full text-sm" />
                </div>
              </div>
            )}
          </div>

          <div className="pt-2 flex gap-2">
            <button type="button" onClick={onClose} className="neon-btn text-gray-400 hover:text-white flex-1">Cancel</button>
            <button type="submit" className="neon-btn-primary font-display tracking-wider flex-1">GENERATE</button>
          </div>
        </form>
      </div>
    </div>
  );
}
