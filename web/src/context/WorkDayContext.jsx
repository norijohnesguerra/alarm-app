import { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../lib/api';

const WorkDayContext = createContext(null);

export function WorkDayProvider({ children }) {
  const [isWorkDay, setIsWorkDay] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api.workday.today().then((data) => {
      setIsWorkDay(data.is_work_day);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { refresh(); }, []);

  const toggle = async () => {
    const next = isWorkDay === 1 ? 0 : 1;
    setIsWorkDay(next);
    await api.workday.answer(next);
  };

  return (
    <WorkDayContext.Provider value={{ isWorkDay, loading, toggle, refresh }}>
      {children}
    </WorkDayContext.Provider>
  );
}

export const useWorkDay = () => useContext(WorkDayContext);
