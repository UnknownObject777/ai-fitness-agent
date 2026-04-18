import { useState, useEffect } from 'react';
import { X, Search, Utensils, Check } from 'lucide-react';
import type { FoodNutrition } from '../../services/nutritionApiService';

interface ManualDietEntryProps {
  onClose: () => void;
  onSave: () => void;
}

export default function ManualDietEntry({ onClose, onSave }: ManualDietEntryProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FoodNutrition[]>([]);
  const [selectedFood, setSelectedFood] = useState<FoodNutrition | null>(null);
  const [amountConfig, setAmountConfig] = useState({ quantity: 100, mealType: 'meal' });
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) {
        setSearchResults([]);
        return;
      }
      setIsSearching(true);
      try {
        const res = await fetch(`/api/dictionary/foods?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        if (data.success) {
          setSearchResults(data.data);
        }
      } catch (e) {
        console.error('Failed to search food', e);
      } finally {
        setIsSearching(false);
      }
    }, 500); // 500ms debounce
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const calcNutrients = () => {
    if (!selectedFood) return null;
    const multi = amountConfig.quantity / 100;
    return {
      kcal: Math.round(selectedFood.caloriesPer100g * multi),
      protein: Math.round(selectedFood.proteinPer100g * multi * 10) / 10,
      carbs: Math.round(selectedFood.carbsPer100g * multi * 10) / 10,
      fat: Math.round(selectedFood.fatPer100g * multi * 10) / 10
    };
  };

  const currentNutrients = calcNutrients();

  const handleSave = async () => {
    if (!selectedFood || !currentNutrients) return;
    setIsSaving(true);
    try {
      const payload = {
        food_name: selectedFood.name,
        quantity: amountConfig.quantity,
        unit: selectedFood.defaultUnit,
        meal_type: amountConfig.mealType,
        calories: currentNutrients.kcal,
        protein: currentNutrients.protein,
        carbs: currentNutrients.carbs,
        fat: currentNutrients.fat
      };

      const res = await fetch('/api/save-record', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          intent: 'log_food',
          data: payload,
          entryDate: 'today'
        })
      });

      if (res.ok) {
        onSave();
        onClose();
      }
    } catch (e) {
      console.error('Failed to save manual food log', e);
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex flex-col justify-end">
      <div className="bg-[#F9F9F9] w-full h-[85vh] rounded-t-[24px] flex flex-col relative animate-in slide-in-from-bottom">
        <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-[#EAEAEE] rounded-full" />
        
        <div className="px-5 pt-8 pb-4 bg-white border-b border-[#EAEAEE] rounded-t-[24px]">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-[16px] font-bold flex items-center gap-2">
              <Utensils className="w-5 h-5 text-[#F0997B]" />
              手动记录饮食
            </h2>
            <button onClick={onClose} className="p-1.5 bg-[#F5F5F5] rounded-full text-[#141414]/50 hover:text-black">
              <X className="w-5 h-5" />
            </button>
          </div>

          {!selectedFood ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#141414]/30" />
              <input
                type="text"
                placeholder="搜索食物 (如: 鸡蛋, 燕麦)..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full bg-[#F5F5F7] text-[13px] pl-9 pr-4 py-2.5 rounded-xl border border-transparent focus:border-[#F0997B] focus:bg-white focus:outline-none transition-colors"
                autoFocus
              />
            </div>
          ) : (
            <div className="p-3 bg-[#FFF5F2] border border-[#F0997B]/30 rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[14px] font-bold text-[#D85A30]">{selectedFood.name}</div>
                <div className="text-[11px] text-[#F0997B] mt-0.5">{selectedFood.caloriesPer100g} kcal / 100{selectedFood.defaultUnit}</div>
              </div>
              <button onClick={() => setSelectedFood(null)} className="text-[11px] text-[#D85A30] underline">
                重新选择
              </button>
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {!selectedFood ? (
            <div className="space-y-2">
              {isSearching ? (
                <div className="text-[12px] text-center text-[#141414]/40 py-4">搜索中...</div>
              ) : searchResults.length > 0 ? (
                searchResults.map(f => (
                  <button
                    key={f.id}
                    onClick={() => setSelectedFood(f)}
                    className="w-full text-left p-3 bg-white border border-[#EAEAEE] rounded-xl hover:border-[#F0997B] transition-all flex justify-between items-center"
                  >
                    <div>
                      <div className="text-[14px] font-medium text-[#141414]">{f.name}</div>
                      <div className="text-[11px] text-[#141414]/50 mt-1">C: {f.carbsPer100g}g | P: {f.proteinPer100g}g | F: {f.fatPer100g}g</div>
                    </div>
                    <div className="text-[12px] font-bold text-[#F0997B]">{f.caloriesPer100g} kcal/100{f.defaultUnit}</div>
                  </button>
                ))
              ) : searchQuery.trim() ? (
                <div className="text-[12px] text-center text-[#141414]/40 py-4">API 暂未收录该食物</div>
              ) : (
                <div className="text-[12px] text-center text-[#141414]/40 py-4">输入内容从外部 API 查询营养素</div>
              )}
            </div>
          ) : (
            <div className="space-y-4 animate-in fade-in duration-300">
              <div className="bg-white p-4 rounded-xl border border-[#EAEAEE]">
                <h3 className="text-[12px] font-bold text-[#141414]/50 mb-3 uppercase">设置份量与餐别</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#141414]">摄入量 ({selectedFood.defaultUnit})</span>
                    <input
                      type="number"
                      value={amountConfig.quantity}
                      onChange={e => setAmountConfig({ ...amountConfig, quantity: Number(e.target.value) || 0 })}
                      className="w-24 text-right bg-[#F5F5F7] px-3 py-2 rounded-lg text-[14px] font-bold text-[#D85A30] focus:border-[#F0997B] focus:outline-none focus:bg-white border border-transparent"
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[13px] text-[#141414]">餐别</span>
                    <select
                      value={amountConfig.mealType}
                      onChange={e => setAmountConfig({ ...amountConfig, mealType: e.target.value })}
                      className="bg-[#F5F5F7] px-3 py-2 rounded-lg text-[13px] text-[#141414] focus:outline-none focus:bg-white border border-transparent focus:border-[#F0997B]"
                    >
                      <option value="breakfast">早餐</option>
                      <option value="lunch">午餐</option>
                      <option value="dinner">晚餐</option>
                      <option value="snack">加餐</option>
                      <option value="meal">其他</option>
                    </select>
                  </div>
                </div>
              </div>

              <div className="bg-white p-4 rounded-xl border border-[#F0997B]/30 shadow-sm">
                <h3 className="text-[12px] font-bold text-[#D85A30] mb-3">营养总计评估</h3>
                <div className="flex items-end gap-1 mb-4">
                  <span className="text-[32px] font-bold leading-none text-[#F0997B]">{currentNutrients?.kcal}</span>
                  <span className="text-[12px] text-[#F0997B]/70 pb-1">kcal</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2">
                  <div className="bg-[#EEEDFE] p-2 rounded-lg text-center">
                    <div className="text-[14px] font-bold text-[#7F77DD]">{currentNutrients?.carbs}g</div>
                    <div className="text-[10px] text-[#7F77DD]/70">碳水</div>
                  </div>
                  <div className="bg-[#E1F5EE] p-2 rounded-lg text-center">
                    <div className="text-[14px] font-bold text-[#1D9E75]">{currentNutrients?.protein}g</div>
                    <div className="text-[10px] text-[#1D9E75]/70">蛋白质</div>
                  </div>
                  <div className="bg-[#F5F5F5] p-2 rounded-lg text-center">
                    <div className="text-[14px] font-bold text-[#141414]">{currentNutrients?.fat}g</div>
                    <div className="text-[10px] text-[#141414]/70">脂肪</div>
                  </div>
                </div>
              </div>

            </div>
          )}
        </div>

        {selectedFood && (
          <div className="p-4 bg-white border-t border-[#EAEAEE]">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="w-full py-3.5 bg-[#F0997B] text-white rounded-xl text-[15px] font-semibold hover:bg-[#D85A30] transition-colors flex items-center justify-center gap-2 shadow-lg shadow-[#F0997B]/20 disabled:opacity-50"
            >
              {isSaving ? (
                '保存中...'
              ) : (
                <>
                  <Check className="w-5 h-5" />确认记录
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
