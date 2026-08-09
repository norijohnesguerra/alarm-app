import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { WorkDayProvider } from './context/WorkDayContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Layout from './components/Layout';

function ProtectedRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center h-screen"><div className="text-neon-cyan font-display animate-pulse-glow">LOADING...</div></div>;
  if (!user) return <Navigate to="/login" />;
  return <WorkDayProvider>{children}</WorkDayProvider>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedRoute><Layout /></ProtectedRoute>}>
        <Route index element={<Dashboard />} />
      </Route>
    </Routes>
  );
}
