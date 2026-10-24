import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import type { ReactNode } from 'react';
import Layout from './components/Layout';
import Login from './views/Login';
import Signup from './views/Signup';
import TaskList from './views/TaskList';
import Calendar from './views/Calendar';
import Kanban from './views/Kanban';
import Gantt from './views/Gantt';
import Focus from './views/Focus';
import Progress from './views/Progress';
import Settings from './views/Settings';

// Mock auth check — replace with real session/token validation when the backend is ready.
export function isAuthenticated(): boolean {
  return localStorage.getItem('isAuthenticated') === 'true';
}

function RequireAuth({ children }: { children: ReactNode }) {
  return isAuthenticated() ? <>{children}</> : <Navigate to="/login" replace />;
}

function GuestOnly({ children }: { children: ReactNode }) {
  return isAuthenticated() ? <Navigate to="/tasks" replace /> : <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Standalone auth screens: deliberately outside Layout. */}
        <Route
          path="/login"
          element={<GuestOnly><Login /></GuestOnly>}
        />
        <Route
          path="/signup"
          element={<GuestOnly><Signup /></GuestOnly>}
        />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route
            index
            element={
              <Navigate
                to={isAuthenticated() ? '/tasks' : '/login'}
                replace
              />
            }
          />
          <Route path="tasks" element={<TaskList />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="gantt" element={<Gantt />} />
          <Route path="focus" element={<Focus />} />
          <Route path="progress" element={<Progress />} />
          <Route path="settings" element={<Settings />} />
        </Route>

        {/* Unknown URLs follow the same auth-aware default redirect. */}
        <Route
          path="*"
          element={<Navigate to={isAuthenticated() ? '/tasks' : '/login'} replace />}
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
