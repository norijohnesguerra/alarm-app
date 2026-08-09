import { useWorkDay } from '../context/WorkDayContext';

export default function WorkDayToggle({ onToggle }) {
  const { isWorkDay, loading, toggle } = useWorkDay();

  if (loading) return <div className="h-8 w-8 animate-pulse rounded-lg bg-white/5" />;

  const active = isWorkDay === 1;

  const handleClick = async () => {
    await toggle();
    onToggle?.();
  };

  return (
    <button onClick={handleClick}
      className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] font-display tracking-wider transition-all border ${
        active
          ? 'bg-neon-lime/15 text-neon-lime border-neon-lime/30 hover:bg-neon-lime/25'
          : 'bg-neon-orange/15 text-neon-orange border-neon-orange/30 hover:bg-neon-orange/25'
      }`}
      title={active ? 'Work day — click for day off' : 'Day off — click for work day'}>
      <span className="text-sm">{active ? '💼' : '🏠'}</span>
      <span>{active ? 'WORK' : 'OFF'}</span>
    </button>
  );
}
