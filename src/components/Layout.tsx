import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout() {
  const location = useLocation();
  
  const getHeaderInfo = () => {
    switch (location.pathname) {
      case '/tasks': return { title: 'Task List', subtitle: 'Plan and schedule your day' };
      case '/calendar': return { title: 'Calendar', subtitle: 'Monthly view of your schedule' };
      case '/kanban': return { title: 'Kanban', subtitle: 'Track progress across stages' };
      case '/gantt': return { title: 'Gantt / Timeline', subtitle: 'Project timelines and dependencies' };
      case '/focus': return { title: 'Focus Mode', subtitle: 'Deep work and time tracking' };
      case '/progress': return { title: 'Progress', subtitle: 'Analytics and productivity trends' };
      case '/settings': return { title: 'Settings', subtitle: 'Working hours & availability' };
      default: return { title: 'Tempo', subtitle: 'Task Management' };
    }
  };

  const { title, subtitle } = getHeaderInfo();

  return (
    <div className="flex min-h-screen bg-canvas">
      <Sidebar />
      <div className="flex-1 min-w-0 ml-64 flex flex-col">
        <Header title={title} subtitle={subtitle} />
        <main className="flex-1 min-w-0 p-8 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
