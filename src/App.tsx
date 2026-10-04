import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
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

// Mock auth check — swap for real session/token logic once the backend is wired up.
function isAuthenticated() {
  return true;
}

function RequireAuth({ children }: { children: React.ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Auth screens render on their own, outside the app shell —
            no sidebar/topbar, per the wireframe. */}
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />

        <Route
          path="/"
          element={
            <RequireAuth>
              <Layout />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/tasks" replace />} />
          <Route path="tasks" element={<TaskList />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="kanban" element={<Kanban />} />
          <Route path="gantt" element={<Gantt />} />
          <Route path="focus" element={<Focus />} />
          <Route path="progress" element={<Progress />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
