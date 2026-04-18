import { useState } from 'react';
import { X, Search, ChevronRight, Dumbbell, Play } from 'lucide-react';
import { EXERCISE_PATTERNS, getExercisesByPattern, searchExercises } from '../data/exerciseDictionary';
import type { Exercise } from './TrainingCardView';

interface ExerciseSelectorModalProps {
  onClose: () => void;
  onSelect: (exercise: Pick<Exercise, 'name' | 'muscleGroups' | 'equipment'>) => void;
}

export default function ExerciseSelectorModal({ onClose, onSelect }: ExerciseSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPattern, setSelectedPattern] = useState<string | null>(null);

  const renderContent = () => {
    if (searchQuery.trim()) {
      const results = searchExercises(searchQuery);
      if (results.length === 0) {
        return (
          <div className="text-center py-12 text-[#141414]/40 text-[13px]">
            未找到动作
          </div>
        );
      }
      return (
        <div className="space-y-2">
          {results.map(ex => (
            <button
              key={ex.id}
              onClick={() => onSelect({ name: ex.name, equipment: ex.equipment, muscleGroups: ex.primaryMuscles })}
              className="w-full text-left p-3 bg-white border border-[#EAEAEE] rounded-xl hover:border-[#7F77DD] transition-all flex justify-between items-center"
            >
              <div>
                <div className="text-[14px] font-semibold text-[#141414]">{ex.name}</div>
                <div className="text-[11px] text-[#141414]/50 mt-1">{ex.primaryMuscles.join(', ')} · {ex.equipment}</div>
              </div>
              <Play className="w-4 h-4 text-[#7F77DD]" />
            </button>
          ))}
        </div>
      );
    }

    if (selectedPattern) {
      const pattern = EXERCISE_PATTERNS.find(p => p.id === selectedPattern);
      const exercises = getExercisesByPattern(selectedPattern);
      return (
        <div className="animate-in slide-in-from-right-4 duration-300">
          <button
            onClick={() => setSelectedPattern(null)}
            className="text-[12px] text-[#7F77DD] mb-3 flex items-center"
          >
            &larr; 返回类别
          </button>
          <div className="mb-4 p-3 bg-[#EEEDFE] rounded-lg border border-[#AFA9EC]/30">
            <h3 className="font-semibold text-[#3C3489] text-[13px]">{pattern?.name}</h3>
            <p className="text-[11px] text-[#534AB7] mt-1">{pattern?.description}</p>
          </div>
          <div className="space-y-2">
            {exercises.map(ex => (
              <button
                key={ex.id}
                onClick={() => onSelect({ name: ex.name, equipment: ex.equipment, muscleGroups: ex.primaryMuscles })}
                className="w-full text-left p-3 bg-white border border-[#EAEAEE] rounded-xl hover:border-[#7F77DD] transition-all flex justify-between items-center"
              >
                <div>
                  <div className="text-[14px] font-semibold text-[#141414]">{ex.name}</div>
                  <div className="text-[11px] text-[#141414]/50 mt-1">{ex.primaryMuscles.join(', ')} · {ex.equipment}</div>
                </div>
                <Play className="w-4 h-4 text-[#7F77DD]" />
              </button>
            ))}
            {exercises.length === 0 && (
              <div className="text-[12px] text-[#141414]/40 text-center py-4">暂无收录动作</div>
            )}
          </div>
        </div>
      );
    }

    // Default: Group by Category
    const grouped = EXERCISE_PATTERNS.reduce((acc, curr) => {
      if (!acc[curr.category]) acc[curr.category] = [];
      acc[curr.category].push(curr);
      return acc;
    }, {} as Record<string, typeof EXERCISE_PATTERNS>);

    return (
      <div className="space-y-5">
        {Object.entries(grouped).map(([category, patterns]) => (
          <div key={category}>
            <h4 className="text-[12px] font-bold text-[#141414]/40 uppercase tracking-wider mb-2">{category}</h4>
            <div className="space-y-2">
              {patterns.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPattern(p.id)}
                  className="w-full text-left p-3 bg-white border border-[#EAEAEE] rounded-xl hover:border-[#7F77DD] transition-all flex justify-between items-center shadow-sm"
                >
                  <div>
                    <div className="text-[13px] font-semibold text-[#141414]">{p.name}</div>
                    <div className="text-[10px] text-[#141414]/50 mt-0.5 line-clamp-1">{p.description}</div>
                  </div>
                  <ChevronRight className="w-4 h-4 text-[#AFA9EC] flex-shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end">
      <div className="bg-[#F9F9F9] w-full h-[85vh] rounded-t-[24px] flex flex-col relative animate-in slide-in-from-bottom">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-[#EAEAEE] rounded-full" />
        
        <div className="px-5 pt-8 pb-4 bg-white border-b border-[#EAEAEE] rounded-t-[24px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[16px] font-bold flex items-center gap-2">
              <Dumbbell className="w-5 h-5 text-[#7F77DD]" />
              选择动作
            </h2>
            <button onClick={onClose} className="p-1.5 bg-[#F5F5F5] rounded-full text-[#141414]/50 hover:text-black">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
            <input
              type="text"
              placeholder="搜索动作名称或部位..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-[#F5F5F7] text-[13px] pl-9 pr-4 py-2.5 rounded-xl border border-transparent focus:border-[#AFA9EC] focus:bg-white focus:outline-none transition-colors"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}
