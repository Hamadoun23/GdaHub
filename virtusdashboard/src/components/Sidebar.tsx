import {
  Bell,
  Calendar,
  CheckSquare,
  ChevronRight,
  Folder,
  Home,
  MessageCircle,
  Search,
  Settings,
  Sun,
} from 'lucide-react';
import { useState } from 'react';
import { navItems } from '../data/dashboard';
import { Avatar } from './ui/Avatar';

const ICONS = {
  Home,
  Calendar,
  Folder,
  CheckSquare,
  MessageCircle,
} as const;

export function Sidebar() {
  const [active, setActive] = useState('accueil');
  const [lightMode, setLightMode] = useState(false);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-border bg-surface px-4 py-5">
      <div className="flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-accent text-black">
          <span className="text-lg font-black">↗</span>
        </div>
        <span className="text-xl font-extrabold text-white">Virtus</span>
      </div>

      <div className="mt-5 flex items-center gap-2 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
        <Search size={16} className="text-muted" />
        <input
          placeholder="Rechercher..."
          className="w-full bg-transparent text-sm text-white placeholder:text-muted focus:outline-none"
        />
        <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] text-muted">⌘K</span>
      </div>

      <nav className="mt-6 flex flex-col gap-1">
        {navItems.map((item) => {
          const Icon = ICONS[item.icon];
          const isActive = item.id === active;
          return (
            <button
              key={item.id}
              onClick={() => setActive(item.id)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                isActive ? 'bg-accent text-black' : 'text-muted hover:bg-surface2 hover:text-white'
              }`}
            >
              <Icon size={17} />
              {item.label}
            </button>
          );
        })}
      </nav>

      <div className="mt-6 flex flex-col gap-1">
        <button className="flex items-center justify-between rounded-xl px-3 py-2.5 text-sm font-medium text-muted hover:bg-surface2 hover:text-white">
          <span className="flex items-center gap-3">
            <Bell size={17} />
            Notifications
          </span>
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-[11px] font-bold text-black">
            3
          </span>
        </button>
        <button className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium text-muted hover:bg-surface2 hover:text-white">
          <Settings size={17} />
          Paramètres
        </button>
      </div>

      <div className="flex-1" />

      <button
        onClick={() => setLightMode((v) => !v)}
        className="flex items-center justify-between rounded-2xl border border-border bg-surface2 px-3 py-2.5"
      >
        <span className="flex items-center gap-2 text-sm font-medium text-white">
          <Sun size={16} className="text-accent2" />
          Mode clair
        </span>
        <span
          className={`flex h-5 w-9 items-center rounded-full p-0.5 transition-colors ${
            lightMode ? 'bg-accent' : 'bg-surface'
          }`}
        >
          <span
            className={`h-4 w-4 rounded-full bg-white transition-transform ${
              lightMode ? 'translate-x-4' : 'translate-x-0'
            }`}
          />
        </span>
      </button>

      <button className="mt-3 flex items-center gap-3 rounded-2xl border border-border bg-surface2 px-3 py-2.5">
        <Avatar label="Hamadoun Cissé" size={36} />
        <div className="flex-1 text-left">
          <p className="text-sm font-semibold text-white">Hamadoun Cissé</p>
          <p className="text-xs text-muted">Développeur</p>
        </div>
        <ChevronRight size={16} className="text-muted" />
      </button>
    </aside>
  );
}
