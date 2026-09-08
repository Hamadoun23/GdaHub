import { AboutYouSection } from './components/AboutYouSection';
import { PerformanceSection } from './components/PerformanceSection';
import { Sidebar } from './components/Sidebar';
import { TaskTrackingSection } from './components/TaskTrackingSection';
import { TopBar } from './components/TopBar';

export default function App() {
  return (
    <div className="flex h-screen bg-bg text-white">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopBar />
        <main className="flex-1 overflow-y-auto px-8 py-6">
          <div className="mx-auto flex max-w-[1400px] flex-col gap-6">
            <div className="grid grid-cols-[1.4fr_1fr] gap-6">
              <TaskTrackingSection />
              <PerformanceSection />
            </div>
            <AboutYouSection />
          </div>
        </main>
      </div>
    </div>
  );
}
