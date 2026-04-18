import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Dumbbell,
  Check,
  Plus,
  Trash2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Target,
  Play,
  RotateCcw,
  Save,
  MoreHorizontal,
  Filter,
  Zap,
  TrendingUp,
  Award,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import ExerciseSelectorModal from './ExerciseSelectorModal';

// Types
export interface ExerciseSet {
  id: string;
  reps: number;
  weight: number;
  rpe?: number;
  completed: boolean;
  isWarmup?: boolean;
}

export interface Exercise {
  id: string;
  name: string;
  muscleGroups: string[];
  equipment: string;
  sets: ExerciseSet[];
  restSeconds: number;
  targetSets?: number;
  targetReps?: string;
  imageUrl?: string;
  notes?: string;
}

export interface WorkoutDay {
  id: string;
  weekNumber: number;
  dayNumber: number;
  name: string;
  description?: string;
  exercises: Exercise[];
  estimatedDurationMinutes: number;
  muscleGroups: string[];
  completed?: boolean;
}

export interface TrainingTemplate {
  id: string;
  name: string;
  description: string;
  category: 'strength' | 'hypertrophy' | 'endurance' | 'custom';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  weeks: WorkoutDay[][];
  createdAt: string;
}

interface TrainingCardViewProps {
  onSaveWorkout: (workout: WorkoutDay) => void;
  onCreateFreeWorkout: () => void;
  recentWorkouts?: WorkoutDay[];
}

// Sample Templates
const SAMPLE_TEMPLATES: TrainingTemplate[] = [
  {
    id: 'template_5x5',
    name: 'StrongLifts 5x5',
    description: '经典力量训练计划，专注于5个核心复合动作',
    category: 'strength',
    difficulty: 'beginner',
    weeks: [
      [
        {
          id: '5x5_w1_d1',
          weekNumber: 1,
          dayNumber: 1,
          name: '训练 A',
          description: '深蹲、卧推、划船',
          muscleGroups: ['腿部', '胸部', '背部'],
          estimatedDurationMinutes: 60,
          completed: false,
          exercises: [
            {
              id: 'ex_squat',
              name: '深蹲',
              muscleGroups: ['腿部', '臀部'],
              equipment: '杠铃',
              restSeconds: 180,
              targetSets: 5,
              targetReps: '5',
              sets: [
                { id: 's1', reps: 5, weight: 60, completed: false, isWarmup: true },
                { id: 's2', reps: 5, weight: 80, completed: false, isWarmup: true },
                { id: 's3', reps: 5, weight: 100, completed: false },
                { id: 's4', reps: 5, weight: 100, completed: false },
                { id: 's5', reps: 5, weight: 100, completed: false },
                { id: 's6', reps: 5, weight: 100, completed: false },
                { id: 's7', reps: 5, weight: 100, completed: false },
              ]
            },
            {
              id: 'ex_bench',
              name: '卧推',
              muscleGroups: ['胸部', '三头肌'],
              equipment: '杠铃',
              restSeconds: 180,
              targetSets: 5,
              targetReps: '5',
              sets: [
                { id: 'b1', reps: 5, weight: 40, completed: false, isWarmup: true },
                { id: 'b2', reps: 5, weight: 50, completed: false, isWarmup: true },
                { id: 'b3', reps: 5, weight: 60, completed: false },
                { id: 'b4', reps: 5, weight: 60, completed: false },
                { id: 'b5', reps: 5, weight: 60, completed: false },
                { id: 'b6', reps: 5, weight: 60, completed: false },
                { id: 'b7', reps: 5, weight: 60, completed: false },
              ]
            },
            {
              id: 'ex_row',
              name: '杠铃划船',
              muscleGroups: ['背部', '二头肌'],
              equipment: '杠铃',
              restSeconds: 120,
              targetSets: 5,
              targetReps: '5',
              sets: [
                { id: 'r1', reps: 5, weight: 40, completed: false },
                { id: 'r2', reps: 5, weight: 40, completed: false },
                { id: 'r3', reps: 5, weight: 40, completed: false },
                { id: 'r4', reps: 5, weight: 40, completed: false },
                { id: 'r5', reps: 5, weight: 40, completed: false },
              ]
            },
          ]
        },
      ],
    ],
    createdAt: new Date().toISOString(),
  },
];

// Helper functions
const generateId = () => Math.random().toString(36).substr(2, 9);

const formatTime = (seconds: number) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Main Component
export default function TrainingCardView({
  onSaveWorkout,
  onCreateFreeWorkout,
  recentWorkouts = [],
}: TrainingCardViewProps) {
  const [view, setView] = useState<'templates' | 'free' | 'active'>('templates');
  const [selectedTemplate, setSelectedTemplate] = useState<TrainingTemplate | null>(null);
  const [currentWeek, setCurrentWeek] = useState(0);
  const [currentDay, setCurrentDay] = useState(0);
  const [activeWorkout, setActiveWorkout] = useState<WorkoutDay | null>(null);
  const [restTimers, setRestTimers] = useState<Record<string, number>>({});
  const [expandedExercises, setExpandedExercises] = useState<Set<string>>(new Set());
  const [showExerciseModal, setShowExerciseModal] = useState(false);

  // Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setRestTimers(prev => {
        const updated = { ...prev };
        Object.keys(updated).forEach(key => {
          if (updated[key] > 0) {
            updated[key] -= 1;
          }
        });
        return updated;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Handlers
  const handleStartTemplate = (template: TrainingTemplate) => {
    setSelectedTemplate(template);
    setCurrentWeek(0);
    setCurrentDay(0);
    if (template.weeks[0]?.[0]) {
      setActiveWorkout(template.weeks[0][0]);
      setView('active');
    }
  };

  const handleStartFreeWorkout = () => {
    const emptyWorkout: WorkoutDay = {
      id: generateId(),
      weekNumber: 1,
      dayNumber: 1,
      name: '自由训练',
      description: '自定义训练计划',
      muscleGroups: [],
      estimatedDurationMinutes: 60,
      completed: false,
      exercises: [],
    };
    setActiveWorkout(emptyWorkout);
    setView('active');
    onCreateFreeWorkout();
  };

  const handleSetComplete = (exerciseId: string, setId: string, completed: boolean) => {
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.map(s => s.id === setId ? { ...s, completed } : s)
      };
    });

    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });

    if (completed) {
      const exercise = updatedExercises.find(e => e.id === exerciseId);
      if (exercise) {
        setRestTimers(prev => ({ ...prev, [exerciseId]: exercise.restSeconds }));
      }
    }
  };

  const handleAddSet = (exerciseId: string, isWarmup = false) => {
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const lastSet = ex.sets[ex.sets.length - 1];
      return {
        ...ex,
        sets: [...ex.sets, {
          id: generateId(),
          reps: lastSet?.reps || 8,
          weight: lastSet?.weight || 0,
          completed: false,
          isWarmup
        }]
      };
    });

    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const handleRemoveSet = (exerciseId: string, setId: string) => {
    if (!activeWorkout) return;

    const updatedExercises = activeWorkout.exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      return {
        ...ex,
        sets: ex.sets.filter(s => s.id !== setId)
      };
    });

    setActiveWorkout({ ...activeWorkout, exercises: updatedExercises });
  };

  const handleAddExercise = () => {
    setShowExerciseModal(true);
  };

  const handleExerciseSelect = (exerciseData: Pick<Exercise, 'name' | 'muscleGroups' | 'equipment'>) => {
    if (!activeWorkout) return;

    const newExercise: Exercise = {
      id: generateId(),
      name: exerciseData.name,
      muscleGroups: exerciseData.muscleGroups,
      equipment: exerciseData.equipment,
      restSeconds: 120,
      targetSets: 3,
      targetReps: '8-12',
      sets: [
        { id: generateId(), reps: 10, weight: 0, completed: false },
        { id: generateId(), reps: 10, weight: 0, completed: false },
        { id: generateId(), reps: 10, weight: 0, completed: false },
      ]
    };

    setActiveWorkout({
      ...activeWorkout,
      exercises: [...activeWorkout.exercises, newExercise]
    });
    setShowExerciseModal(false);
  };

  const handleRemoveExercise = (exerciseId: string) => {
    if (!activeWorkout) return;

    setActiveWorkout({
      ...activeWorkout,
      exercises: activeWorkout.exercises.filter(e => e.id !== exerciseId)
    });
  };

  const handleFinishWorkout = () => {
    if (!activeWorkout) return;
    onSaveWorkout({ ...activeWorkout, completed: true });
    setActiveWorkout(null);
    setView('templates');
  };

  const toggleExerciseExpanded = (exerciseId: string) => {
    setExpandedExercises(prev => {
      const next = new Set(prev);
      if (next.has(exerciseId)) {
        next.delete(exerciseId);
      } else {
        next.add(exerciseId);
      }
      return next;
    });
  };

  const calculateProgress = () => {
    if (!activeWorkout || activeWorkout.exercises.length === 0) return 0;

    let totalSets = 0;
    let completedSets = 0;

    activeWorkout.exercises.forEach(ex => {
      ex.sets.forEach(s => {
        totalSets++;
        if (s.completed) completedSets++;
      });
    });

    return totalSets > 0 ? Math.round((completedSets / totalSets) * 100) : 0;
  };

  const renderTemplates = () => (
    <div className="space-y-4 pb-20 p-4">
      <div className="grid grid-cols-2 gap-3">
        <button
          onClick={handleStartFreeWorkout}
          className="flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#7F77DD] to-[#5A52C0] rounded-2xl text-white shadow-lg shadow-[#7F77DD]/20"
        >
          <Plus className="w-6 h-6 mb-2" />
          <span className="text-[13px] font-semibold">自由训练</span>
          <span className="text-[10px] opacity-70 mt-0.5">自定义计划</span>
        </button>
        <button className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl text-[#141414] shadow-sm border border-[#EAEAEE]">
          <RotateCcw className="w-6 h-6 mb-2 text-[#7F77DD]" />
          <span className="text-[13px] font-semibold">最近训练</span>
          <span className="text-[10px] text-[#141414]/50 mt-0.5">查看历史</span>
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-[14px] font-bold text-[#141414]">预设模板</h3>
          <button className="flex items-center gap-1 text-[11px] text-[#7F77DD]">
            <Filter className="w-3 h-3" />
            筛选
          </button>
        </div>
        <div className="space-y-3">
          {SAMPLE_TEMPLATES.map(template => (
            <motion.div
              key={template.id}
              whileTap={{ scale: 0.98 }}
              className="bg-white rounded-2xl border border-[#EAEAEE] shadow-sm overflow-hidden"
            >
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-[#7F77DD] to-[#5A52C0] flex items-center justify-center">
                      <Dumbbell className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h4 className="text-[15px] font-bold text-[#141414]">{template.name}</h4>
                      <p className="text-[11px] text-[#141414]/50 mt-0.5">{template.description}</p>
                    </div>
                  </div>
                  <span className={`text-[10px] px-2 py-1 rounded-full ${
                    template.difficulty === 'beginner' ? 'bg-green-100 text-green-700' :
                    template.difficulty === 'intermediate' ? 'bg-yellow-100 text-yellow-700' :
                    'bg-red-100 text-red-700'
                  }`}>
                    {template.difficulty === 'beginner' ? '初级' : template.difficulty === 'intermediate' ? '中级' : '高级'}
                  </span>
                </div>

                <div className="flex items-center gap-4 mt-3 pt-3 border-t border-[#F5F5F7]">
                  <div className="flex items-center gap-1.5">
                    <Target className="w-3.5 h-3.5 text-[#7F77DD]" />
                    <span className="text-[11px] text-[#141414]/60">{template.weeks.length} 周</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-[#7F77DD]" />
                    <span className="text-[11px] text-[#141414]/60">60 分钟/次</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Flame className="w-3.5 h-3.5 text-[#F0997B]" />
                    <span className="text-[11px] text-[#141414]/60">
                      {template.category === 'strength' ? '力量' : template.category === 'hypertrophy' ? '增肌' : '耐力'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex border-t border-[#EAEAEE]">
                <button
                  onClick={() => handleStartTemplate(template)}
                  className="flex-1 py-3 bg-[#7F77DD] text-white text-[13px] font-semibold hover:bg-[#6B62CC] transition-colors flex items-center justify-center gap-2"
                >
                  <Play className="w-4 h-4" />
                  开始训练
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderActiveWorkout = () => {
    if (!activeWorkout) return null;

    const progress = calculateProgress();
    const completedExercises = activeWorkout.exercises.filter(ex =>
      ex.sets.every(s => s.completed)
    ).length;

    return (
      <div className="flex flex-col h-full bg-[#F9F9F9]">
        {/* Header */}
        <div className="bg-white border-b border-[#EAEAEE] px-4 py-3">
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setView('templates')}
              className="flex items-center gap-1 text-[12px] text-[#7F77DD]"
            >
              <ChevronLeft className="w-4 h-4" />
              返回
            </button>
            <span className="text-[12px] font-medium text-[#141414]">
              Week {activeWorkout.weekNumber} · Day {activeWorkout.dayNumber}
            </span>
            <button
              onClick={handleFinishWorkout}
              className="flex items-center gap-1 text-[12px] text-[#1D9E75] font-medium"
            >
              <Save className="w-4 h-4" />
              完成
            </button>
          </div>

          <div className="mb-2">
            <div className="flex items-center justify-between mb-1">
              <h2 className="text-[16px] font-bold text-[#141414]">{activeWorkout.name}</h2>
              <span className="text-[12px] text-[#141414]/50">{progress}%</span>
            </div>
            <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-[#7F77DD] to-[#5A52C0] transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <div className="flex items-center gap-4 text-[11px] text-[#141414]/50">
            <span className="flex items-center gap-1">
              <Target className="w-3.5 h-3.5" />
              {completedExercises}/{activeWorkout.exercises.length} 动作
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {activeWorkout.estimatedDurationMinutes} 分钟
            </span>
          </div>
        </div>

        {/* Exercise List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          <AnimatePresence mode="popLayout">
            {activeWorkout.exercises.map((exercise, index) => {
              const isExpanded = expandedExercises.has(exercise.id);
              const completedSets = exercise.sets.filter(s => s.completed).length;
              const totalSets = exercise.sets.length;
              const isFullyCompleted = completedSets === totalSets && totalSets > 0;
              const restTimeLeft = restTimers[exercise.id] || 0;

              return (
                <motion.div
                  key={exercise.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`bg-white rounded-2xl border ${isFullyCompleted ? 'border-[#1D9E75]/30' : 'border-[#EAEAEE]'} shadow-sm overflow-hidden`}
                >
                  {/* Exercise Header */}
                  <div
                    onClick={() => toggleExerciseExpanded(exercise.id)}
                    className="p-4 cursor-pointer"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        isFullyCompleted ? 'bg-[#E1F5EE]' : 'bg-gradient-to-br from-[#7F77DD] to-[#5A52C0]'
                      }`}>
                        {isFullyCompleted ? (
                          <Check className="w-6 h-6 text-[#1D9E75]" />
                        ) : (
                          <Dumbbell className="w-6 h-6 text-white" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-[15px] font-bold text-[#141414] truncate">{exercise.name}</h4>
                          {restTimeLeft > 0 && (
                            <span className="text-[11px] px-2 py-0.5 bg-[#F0997B]/20 text-[#D85A30] rounded-full animate-pulse">
                              {formatTime(restTimeLeft)}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[11px] text-[#141414]/50">{exercise.equipment}</span>
                          <span className="w-1 h-1 rounded-full bg-[#141414]/20" />
                          <span className={`text-[11px] font-medium ${isFullyCompleted ? 'text-[#1D9E75]' : 'text-[#7F77DD]'}`}>
                            {completedSets}/{totalSets} 组
                          </span>
                        </div>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-5 h-5 text-[#141414]/30" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-[#141414]/30" />
                      )}
                    </div>

                    <div className="mt-3 h-1.5 bg-[#F5F5F7] rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${isFullyCompleted ? 'bg-[#1D9E75]' : 'bg-[#7F77DD]'}`}
                        style={{ width: `${totalSets > 0 ? (completedSets / totalSets) * 100 : 0}%` }}
                      />
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-[#F5F5F7]"
                      >
                        <div className="p-4 space-y-2">
                          {exercise.sets.map((set, setIndex) => (
                            <div
                              key={set.id}
                              className={`flex items-center gap-3 p-3 rounded-xl ${set.completed ? 'bg-[#E1F5EE]' : set.isWarmup ? 'bg-[#FFF8E7]' : 'bg-[#F9F9F9]'}`}
                            >
                              <button
                                onClick={() => handleSetComplete(exercise.id, set.id, !set.completed)}
                                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors ${
                                  set.completed
                                    ? 'bg-[#1D9E75] text-white'
                                    : 'bg-white border border-[#EAEAEE] text-[#141414]/30 hover:border-[#7F77DD]'
                                }`}
                              >
                                <Check className="w-4 h-4" />
                              </button>

                              <div className="flex items-center gap-2">
                                <span className={`text-[11px] px-2 py-0.5 rounded ${set.isWarmup ? 'bg-[#F0997B]/20 text-[#D85A30]' : 'bg-[#7F77DD]/10 text-[#5A52C0]'}`}>
                                  {set.isWarmup ? 'W' : setIndex + 1}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 flex-1">
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={set.weight}
                                    onChange={(e) => {
                                      const newWeight = parseFloat(e.target.value) || 0;
                                      const updated = activeWorkout!.exercises.map(ex => {
                                        if (ex.id !== exercise.id) return ex;
                                        return {
                                          ...ex,
                                          sets: ex.sets.map(s => s.id === set.id ? { ...s, weight: newWeight } : s)
                                        };
                                      });
                                      setActiveWorkout({ ...activeWorkout!, exercises: updated });
                                    }}
                                    className="w-14 text-[13px] font-semibold text-[#141414] bg-transparent border-b border-[#EAEAEE] focus:border-[#7F77DD] focus:outline-none text-center"
                                  />
                                  <span className="text-[10px] text-[#141414]/50">kg</span>
                                </div>
                                <span className="text-[#141414]/30">×</span>
                                <input
                                  type="number"
                                  value={set.reps}
                                  onChange={(e) => {
                                    const newReps = parseInt(e.target.value) || 0;
                                    const updated = activeWorkout!.exercises.map(ex => {
                                      if (ex.id !== exercise.id) return ex;
                                      return {
                                        ...ex,
                                        sets: ex.sets.map(s => s.id === set.id ? { ...s, reps: newReps } : s)
                                      };
                                    });
                                    setActiveWorkout({ ...activeWorkout!, exercises: updated });
                                  }}
                                  className="w-10 text-[13px] font-semibold text-[#141414] bg-transparent border-b border-[#EAEAEE] focus:border-[#7F77DD] focus:outline-none text-center"
                                />
                              </div>

                              <button
                                onClick={() => handleRemoveSet(exercise.id, set.id)}
                                className="p-1.5 text-[#141414]/30 hover:text-[#B94747] hover:bg-[#FFF8F8] rounded-lg transition-colors"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          ))}

                          <div className="flex gap-2 pt-2">
                            <button
                              onClick={() => handleAddSet(exercise.id, true)}
                              className="flex-1 py-2 text-[11px] font-medium text-[#F0997B] bg-[#FFF8E7] border border-[#F0997B]/20 rounded-xl hover:bg-[#F0997B]/10 transition-colors"
                            >
                              + 热身组
                            </button>
                            <button
                              onClick={() => handleAddSet(exercise.id, false)}
                              className="flex-1 py-2 text-[11px] font-medium text-[#7F77DD] bg-[#EEEDFE] border border-[#7F77DD]/20 rounded-xl hover:bg-[#7F77DD]/10 transition-colors"
                            >
                              + 正式组
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>

          <button
            onClick={handleAddExercise}
            className="w-full py-4 border-2 border-dashed border-[#EAEAEE] rounded-2xl text-[#141414]/50 hover:text-[#7F77DD] hover:border-[#7F77DD]/30 hover:bg-[#F5F4FF] transition-all"
          >
            <div className="flex items-center justify-center gap-2">
              <Plus className="w-5 h-5" />
              <span className="text-[13px] font-medium">添加动作</span>
            </div>
          </button>
        </div>

        <div className="sticky bottom-0 left-0 right-0 p-4 bg-white border-t border-[#EAEAEE]">
          <button
            onClick={handleFinishWorkout}
            className="w-full py-3.5 bg-[#1D9E75] text-white rounded-xl text-[15px] font-semibold hover:bg-[#198F68] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#1D9E75]/20"
          >
            <Check className="w-5 h-5" />
            完成训练
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="h-full flex flex-col bg-[#F9F9F9]">
      <div className="bg-white border-b border-[#EAEAEE] px-4 py-3">
        <div className="flex items-center justify-between">
          <h2 className="text-[16px] font-bold text-[#141414]">
            {view === 'templates' && '训练计划'}
            {view === 'active' && '当前训练'}
          </h2>
          {view === 'active' && (
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#EEEDFE] rounded-full">
                <div className="w-2 h-2 rounded-full bg-[#7F77DD] animate-pulse" />
                <span className="text-[11px] font-medium text-[#5A52C0]">进行中</span>
              </div>
            </div>
          )}
        </div>

        {view === 'active' && activeWorkout && (
          <div className="mt-3">
            <div className="flex items-center justify-between text-[11px] text-[#141414]/50 mb-1">
              <span>完成进度</span>
              <span>{calculateProgress()}%</span>
            </div>
            <div className="h-2 bg-[#F5F5F7] rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-[#7F77DD] to-[#5A52C0]"
                initial={{ width: 0 }}
                animate={{ width: `${calculateProgress()}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>
        )}
      </div>

      <div className="flex-1 overflow-y-auto">
        {view === 'templates' && renderTemplates()}
        {view === 'active' && renderActiveWorkout()}
      </div>

      <AnimatePresence>
        {showExerciseModal && (
          <ExerciseSelectorModal
            onClose={() => setShowExerciseModal(false)}
            onSelect={handleExerciseSelect}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
