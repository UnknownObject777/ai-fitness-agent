import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Dumbbell, Utensils, Scale, BarChart2 } from 'lucide-react';
import WorkoutTrendsView from './WorkoutTrendsView';
import DietAnalysisView from './DietAnalysisView';
import BodyMetricsView from './BodyMetricsView';

type AnalysisTab = 'overview' | 'workout' | 'diet' | 'body';

interface TabDef {
  key: AnalysisTab;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  activeColor: string;
}

const TABS: TabDef[] = [
  { key: 'workout', label: '训练',   icon: Dumbbell,  color: 'text-indigo-400', activeColor: 'text-indigo-600' },
  { key: 'diet',    label: '饮食',   icon: Utensils,  color: 'text-orange-400', activeColor: 'text-orange-500' },
  { key: 'body',    label: '身体',   icon: Scale,     color: 'text-purple-400', activeColor: 'text-purple-600' },
];

export default function AnalysisDashboard() {
  const [activeTab, setActiveTab] = useState<AnalysisTab>('workout');

  return (
    <div className="flex flex-col -mt-1">
      {/* Sub-tab navigation */}
      <div className="flex bg-[#F5F5FA] rounded-2xl p-1 gap-1 mb-3 flex-shrink-0">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              id={`analysis-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl text-[12px] font-semibold transition-all ${
                isActive
                  ? 'bg-white shadow-sm ' + tab.activeColor
                  : 'text-gray-400 hover:text-gray-600'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? tab.activeColor : tab.color}`} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content area */}
      <div className="min-h-0">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
          >
            {activeTab === 'workout' && <WorkoutTrendsView />}
            {activeTab === 'diet'    && <DietAnalysisView />}
            {activeTab === 'body'    && <BodyMetricsView />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
