export const EXERCISE_PATTERNS = [
  {
    id: "squat_knee_dominant",
    name: "膝盖主导深蹲",
    category: "下肢：蹲类模式",
    description: "躯干保持垂直，膝盖前移，刺激大腿前侧（如：高位杠深蹲、西西蹲）。"
  },
  {
    id: "squat_hip_dominant",
    name: "髋部主导深蹲",
    category: "下肢：蹲类模式",
    description: "躯干前倾，髋角更小（如：低位杠深蹲、保加利亚分腿蹲）。"
  },
  {
    id: "hinge_hip_dominant",
    name: "髋部主导铰链",
    category: "下肢：铰链与拉类模式",
    description: "侧重于在肌肉被拉长位加载（如罗马尼亚硬拉）或收缩位加载（如臀冲）。"
  },
  {
    id: "pull_knee_dominant",
    name: "膝盖主导拉/膝屈",
    category: "下肢：铰链与拉类模式",
    description: "针对硬拉无法有效训练到的肌肉如股二头肌短头（如：腿弯举、北欧掉）。"
  },
  {
    id: "push_horizontal",
    name: "水平推",
    category: "上肢：推类模式",
    description: "在水平面上进行的推行力动作（如：平卧推、哑铃平卧推）。"
  },
  {
    id: "push_vertical",
    name: "垂直推",
    category: "上肢：推类模式",
    description: "在垂直方向或高斜度进行的推行力动作（如：过顶推举、高斜度哑铃推举）。"
  },
  {
    id: "pull_horizontal",
    name: "水平拉",
    category: "上肢：拉类模式",
    description: "水平方向的拉行动作（如：杠铃俯身划船）。"
  },
  {
    id: "pull_vertical",
    name: "垂直拉",
    category: "上肢：拉类模式",
    description: "垂直方向的拉行动作（如：高位下拉、引体向上）。"
  },
  {
    id: "ancillary_arms",
    name: "手臂辅助项",
    category: "附属练习",
    description: "如二头弯举、三头下压等较小的隔离动作。"
  },
  {
    id: "ancillary_calves",
    name: "小腿辅助项",
    category: "附属练习",
    description: "如提踵等动作。"
  },
  {
    id: "ancillary_core",
    name: "核心与关节健康",
    category: "附属练习",
    description: "如肩袖肌群、腹部练习等。"
  }
];

export const MOCK_EXERCISES = [
  { id: "ex_squat_high_bar", name: "高位杠铃深蹲", patternId: "squat_knee_dominant", equipment: "杠铃", primaryMuscles: ["股四头肌", "臀大肌"] },
  { id: "ex_squat_low_bar", name: "低位杠铃深蹲", patternId: "squat_hip_dominant", equipment: "杠铃", primaryMuscles: ["臀大肌", "腿后侧", "股四头肌"] },
  { id: "ex_split_squat", name: "保加利亚分腿蹲", patternId: "squat_hip_dominant", equipment: "哑铃", primaryMuscles: ["臀大肌", "股四头肌"] },
  { id: "ex_sissy_squat", name: "西西蹲", patternId: "squat_knee_dominant", equipment: "自重", primaryMuscles: ["股四头肌"] },
  { id: "ex_deadlift_romanian", name: "罗马尼亚硬拉", patternId: "hinge_hip_dominant", equipment: "杠铃", primaryMuscles: ["腿后侧", "臀大肌", "下背部"] },
  { id: "ex_hip_thrust", name: "杠铃臀冲", patternId: "hinge_hip_dominant", equipment: "杠铃", primaryMuscles: ["臀大肌"] },
  { id: "ex_leg_curl", name: "坐姿腿弯举", patternId: "pull_knee_dominant", equipment: "器械", primaryMuscles: ["股二头肌"] },
  { id: "ex_bench_press", name: "平板杠铃卧推", patternId: "push_horizontal", equipment: "杠铃", primaryMuscles: ["胸大肌", "三角肌前束", "肱三头肌"] },
  { id: "ex_dumbbell_bench", name: "平板哑铃卧推", patternId: "push_horizontal", equipment: "哑铃", primaryMuscles: ["胸大肌", "三角肌前束", "肱三头肌"] },
  { id: "ex_overhead_press", name: "站姿杠铃推举", patternId: "push_vertical", equipment: "杠铃", primaryMuscles: ["三角肌", "肱三头肌"] },
  { id: "ex_barbell_row", name: "杠铃俯身划船", patternId: "pull_horizontal", equipment: "杠铃", primaryMuscles: ["背阔肌", "斜方肌", "菱形肌"] },
  { id: "ex_lat_pulldown", name: "高位下拉", patternId: "pull_vertical", equipment: "器械", primaryMuscles: ["背阔肌"] },
  { id: "ex_pullup", name: "引体向上", patternId: "pull_vertical", equipment: "自重", primaryMuscles: ["背阔肌"] },
  { id: "ex_bicep_curl", name: "哑铃弯举", patternId: "ancillary_arms", equipment: "哑铃", primaryMuscles: ["肱二头肌"] },
  { id: "ex_tricep_extension", name: "绳索下压", patternId: "ancillary_arms", equipment: "绳索", primaryMuscles: ["肱三头肌"] }
];

export function getExercisesByPattern(patternId: string) {
  return MOCK_EXERCISES.filter(ex => ex.patternId === patternId);
}

export function searchExercises(query: string) {
  const lowerQ = query.toLowerCase();
  return MOCK_EXERCISES.filter(ex => 
    ex.name.toLowerCase().includes(lowerQ) || 
    ex.primaryMuscles.some(m => m.includes(lowerQ))
  );
}
