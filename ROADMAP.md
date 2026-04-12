# Sparky AI 健身助手 - 远期规划文档 (Roadmap)

> 🎯 通过集成 Claude Skills，将 Sparky AI 从记录工具进化为智能健身伙伴

---

## 项目现状 (v1.0)

**已实现功能：**
- ✅ AI 对话式记录饮食/训练/身体指标
- ✅ 食物图片识别（多模态 AI）
- ✅ 训练计划生成与跟进
- ✅ 语义记忆（用户目标/偏好/伤病史）
- ✅ 移动端友好的 iOS 风格 UI
- ✅ SQLite 本地数据持久化

**技术栈：**
- 前端：React 19 + TypeScript + Vite 6 + Tailwind CSS 4
- 后端：Express.js + SQLite3
- AI：OpenAI API / Gemini API
- UI 组件：Lucide React + Motion

---

## Phase 1: 数据分析能力集成 (v1.1)

**时间规划：** 2-3 周
**核心技能：** `data-analysis`

### 1.1 健身数据洞察仪表板

**用户场景：**
> 用户说："分析我最近一个月的训练情况"

**系统响应：**
- 自动查询 workout_logs、activity_records 表
- 生成训练量趋势图（周/月维度）
- 肌肉群训练分布热力图
- 训练强度（RPE）趋势曲线
- 力量进步曲线（1RM 估算）

**技术实现：**
```typescript
// 新增 API
GET /api/analysis/workout-trends?range=30d

// 返回：
{
  "charts": [{
    "type": "line",
    "title": "训练量趋势",
    "data_url": "/uploads/workout_trend_30d.png"
  }],
  "insights": [
    "本周训练量比上周增加 15%",
    "胸部训练量略高于背部，建议调整平衡"
  ]
}
```

### 1.2 饮食营养分析

**用户场景：**
> 用户说："我本周蛋白质摄入够吗？"

**系统响应：**
- 查询 meal_logs、meal_items 表
- 生成每日热量/营养素趋势图
- 饮食结构分布饼图
- 与目标对比分析
- 营养缺口识别报告

**核心指标：**
- 日均热量摄入 vs 目标
- 蛋白质/碳水/脂肪占比
- 连续达标天数统计
- 饮食规律度评分

### 1.3 身体指标追踪

**功能点：**
- 体重/体脂率趋势曲线
- 身体围度变化追踪
- BMI 自动计算和分类
- 进步里程碑标记（如：减重 5kg 庆祝）

---

## Phase 2: 可视化报告生成 (v1.2)

**时间规划：** 2-3 周
**核心技能：** `pdf`, `data-analysis`

### 2.1 周/月度健康报告

**自动触发：**
- 每周日晚 8:00 生成本周报告
- 每月最后一日生成本月报告

**报告内容：**
```markdown
# 本周健康报告 (2026.04.06 - 04.12)

## 训练总结
- 训练天数：4/7 天
- 总训练量：12,450 kg
- 主要训练：胸部、背部、腿部
- 亮点：卧推 5RM 突破 80kg 🎉

## 饮食回顾
- 日均热量：1,840 kcal / 目标 2,000 kcal
- 蛋白质达标率：85%
- 建议：增加早餐蛋白质摄入

## 身体指标
- 体重：72.5 kg (-0.5 kg vs 上周)
- 体脂率：18.2% (-0.3% vs 上周)
- 趋势：稳步下降 ✓

## 下周建议
- 增加一次有氧训练
- 尝试增加腿部训练容量
```

**导出格式：**
- Markdown（聊天界面展示）
- PDF（通过 `pdf` skill 生成）
- PNG（长图，适合分享）

### 2.2 里程碑成就系统

**成就类型：**
- 🏋️ 力量类：卧推 1.5x 体重、硬拉 2x 体重
- 📅 坚持类：连续训练 7 天、连续打卡 30 天
- 🥗 饮食类：蛋白质达标 7 天、饮水达标 7 天
- 🎯 目标类：减重 5kg、增肌 2kg

---

## Phase 3: 智能建议系统 (v1.3)

**时间规划：** 2-3 周
**核心技能：** 自定义算法 + `data-analysis`

### 3.1 训练计划智能调整

**场景识别：**
```typescript
// 检测训练瓶颈
if (连续3周同一动作重量无进步) {
  return {
    type: "plateau",
    suggestion: "建议改变动作顺序或尝试递减组",
    newPlan: {...调整后的计划}
  }
}

// 检测恢复不足
if (RPE 持续 > 9 && 睡眠质量 < 7) {
  return {
    type: "overtraining",
    suggestion: "建议降低训练容量 20%，增加休息日"
  }
}

// 检测肌肉不平衡
if (胸部训练量 / 背部训练量 > 1.5) {
  return {
    type: "imbalance",
    suggestion: "建议增加背部训练频率"
  }
}
```

### 3.2 饮食目标智能推荐

**TDEE 计算：**
- 基于体重、活动水平、目标计算基础代谢
- 根据实际摄入和体重变化动态调整

**宏量营养素建议：**
```typescript
// 根据目标生成推荐
const goals = {
  fat_loss: { protein: 2.0, fat: 0.8, carbs: 3.0 }, // g/kg 体重
  muscle_gain: { protein: 1.8, fat: 1.0, carbs: 5.0 },
  maintenance: { protein: 1.6, fat: 1.0, carbs: 4.0 }
}
```

---

## Phase 4: 社交与分享 (v1.4)

**时间规划：** 1-2 周
**核心技能：** `feishu-card`, `frontend-design`

### 4.1 飞书报告推送

**集成方案：**
```typescript
// 每周自动生成飞书卡片
import feishuCard from 'skills/feishu-card'

feishuCard.send({
  title: "本周训练报告",
  content: [
    { type: "metric", label: "训练天数", value: "4/7" },
    { type: "chart", url: "...png" },
    { type: "action", text: "查看完整报告", url: "..." }
  ]
})
```

### 4.2 精美分享卡片

**场景：**
- 完成训练后生成打卡图
- 达成里程碑后生成成就图
- 饮食记录后生成营养分析图

**设计风格：**
- 使用 `frontend-design` skill 生成多样化风格
- 支持暗黑/明亮主题
- 可选的励志语录水印

---

## Phase 5: 扩展集成 (v2.0)

**时间规划：** 待定

### 5.1 可穿戴设备同步
- Apple Health / Google Fit 集成
- 心率、睡眠数据导入
- 活动卡路里自动记录

### 5.2 多用户与社交
- 家庭账户支持
- 好友挑战系统
- 训练计划分享

### 5.3 AI 教练升级
- 视频动作分析（姿态检测）
- 实时语音指导
- 智能组间休息建议

---

## 技术债务与优化

### 性能优化
- [ ] 数据库索引优化（高频查询字段）
- [ ] 图片压缩与缓存策略
- [ ] 虚拟滚动优化大数据列表

### 代码质量
- [ ] 状态管理升级（Zustand/Redux）
- [ ] 组件拆分与复用
- [ ] 单元测试覆盖

### 用户体验
- [ ] 离线模式支持（Service Worker）
- [ ] 推送通知系统
- [ ] 国际化支持（i18n）

---

## 里程碑计划

| 版本 | 时间 | 目标 | 关键成果 |
|------|------|------|----------|
| v1.1 | +3周 | 数据分析上线 | 训练/饮食数据可视化 |
| v1.2 | +6周 | 报告系统上线 | 周/月报告自动生成 |
| v1.3 | +9周 | 智能建议上线 | AI 计划调整建议 |
| v1.4 | +11周 | 社交功能上线 | 飞书推送/分享卡片 |
| v2.0 | +6个月 | 完整生态 | 多平台集成/社区功能 |

---

## 需要开发的新模块

```
src/
├── components/
│   ├── WorkoutTrendsView.tsx      # 训练趋势组件
│   ├── DietAnalysisView.tsx       # 饮食分析组件
│   ├── HealthReportView.tsx       # 健康报告组件
│   ├── AchievementCard.tsx        # 成就卡片
│   └── ShareCard.tsx              # 分享卡片

services/
├── exportService.ts               # 数据导出服务
├── nutritionService.ts            # 营养计算服务
├── trainingAnalytics.ts           # 训练分析服务
├── reportService.ts               # 报告生成服务
└── insightEngine.ts               # 洞察引擎

server/
└── analysis.ts                    # 数据分析 API 路由
```

---

## 附录：Skills 使用指南

### data-analysis skill
```bash
# 触发方式
用户输入: "/analyze workout trends"
或: "分析我最近的训练情况"

# 处理流程
1. 导出 SQLite 数据为 CSV
2. 调用 skill 生成图表
3. 返回可视化结果到聊天界面
```

### pdf skill
```bash
# 触发方式
用户输入: "/export monthly report to pdf"
或: 点击"导出 PDF"按钮

# 处理流程
1. 生成报告内容 (Markdown)
2. 调用 skill 转换为 PDF
3. 提供下载链接
```

### feishu-card skill
```bash
# 触发方式
系统定时触发: 每周日晚 8:00
或用户手动: "/send report to feishu"

# 配置要求
需配置 FEISHU_WEBHOOK_URL 环境变量
```

---

*文档版本: 1.0*
*最后更新: 2026-04-12*
*维护者: Sparky AI Team*
