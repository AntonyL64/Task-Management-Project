import { ChevronDown } from 'lucide-react';
import { Link } from 'react-router-dom';
import { currentUser } from '../lib/mockData';

type HeaderProps = {
  title: string;
  subtitle?: string;
};

export default function Header({ title, subtitle }: HeaderProps) {
  return (
    <header className="h-20 bg-surface border-b border-gray-200 px-8 flex items-center justify-between sticky top-0 z-10">
      <div>
        <h1 className="text-2xl font-semibold text-text">{title}</h1>
        {subtitle && <p className="text-sm text-muted-500 mt-0.5">{subtitle}</p>}
      </div>

      <Link
        to="/settings"
        className="flex items-center gap-3 cursor-pointer hover:bg-gray-50 p-2 rounded-lg transition-colors"
      >
        <div className="w-9 h-9 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-medium text-sm">
          {currentUser.initials}
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-medium text-text leading-tight">{currentUser.name}</span>
          <span className="text-xs text-muted-500 leading-tight">{currentUser.role}</span>
        </div>
        <ChevronDown className="w-4 h-4 text-gray-400 ml-1" />
      </Link>
    </header>
  );
}
