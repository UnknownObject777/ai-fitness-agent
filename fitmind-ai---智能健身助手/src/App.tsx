/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Brain, MessageSquare, Settings as SettingsIcon, Dumbbell, Sparkles } from 'lucide-react';
import ChatInterface from './components/ChatInterface';
import SettingsPanel from './components/SettingsPanel';
import MemoryDashboard from './components/MemoryDashboard';
import { cn } from './lib/utils';

export default function App() {
  const [activeView, setActiveView] = useState<'chat' | 'memory' | 'settings'>('chat');

  return (
    <div className="min-h-screen bg-[#F8F9FA] text-gray-900 font-sans selection:bg-orange-100 selection:text-orange-900">
      {/* Sidebar / Navigation */}
      <div className="fixed left-0 top-0 bottom-0 w-20 bg-white border-r border-gray-100 flex flex-col items-center py-8 gap-8 z-50">
        <div className="w-12 h-12 rounded-2xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-200">
          <Dumbbell className="w-6 h-6 text-white" />
        </div>
        
        <nav className="flex flex-col gap-4 flex-1">
          <NavButton 
            active={activeView === 'chat'} 
            onClick={() => setActiveView('chat')} 
            icon={<MessageSquare className="w-5 h-5" />} 
            label="对话"
          />
          <NavButton 
            active={activeView === 'memory'} 
            onClick={() => setActiveView('memory')} 
            icon={<Brain className="w-5 h-5" />} 
            label="记忆"
          />
        </nav>

        <NavButton 
          active={activeView === 'settings'} 
          onClick={() => setActiveView('settings')} 
          icon={<SettingsIcon className="w-5 h-5" />} 
          label="设置"
        />
      </div>

      {/* Main Content */}
      <main className="pl-20 h-screen flex flex-col">
        {/* Top Bar */}
        <header className="h-16 border-b border-gray-100 bg-white/80 backdrop-blur-md flex items-center justify-between px-8 sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold tracking-tight">FitMind AI</h1>
            <span className="px-2 py-0.5 rounded-full bg-orange-100 text-orange-600 text-[10px] font-bold uppercase tracking-wider">MVP v1.0</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-medium text-gray-500 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
              <Sparkles className="w-3 h-3 text-orange-400" />
              <span>智能体已就绪</span>
            </div>
          </div>
        </header>

        {/* View Area */}
        <div className="flex-1 overflow-hidden p-6 max-w-6xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className={cn(
            "h-full transition-all duration-300",
            activeView === 'chat' ? "lg:col-span-8" : "lg:col-span-12"
          )}>
            {activeView === 'chat' && <ChatInterface />}
            {activeView === 'memory' && <MemoryDashboard />}
            {activeView === 'settings' && <SettingsPanel />}
          </div>

          {activeView === 'chat' && (
            <div className="hidden lg:block lg:col-span-4 h-full">
              <MemoryDashboard />
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

function NavButton({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: React.ReactNode; label: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative flex flex-col items-center gap-1 p-3 rounded-2xl transition-all duration-200",
        active ? "bg-orange-50 text-orange-600" : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
      )}
    >
      {icon}
      <span className="text-[10px] font-bold uppercase tracking-wider opacity-0 group-hover:opacity-100 transition-opacity">{label}</span>
      {active && (
        <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-6 bg-orange-500 rounded-r-full" />
      )}
    </button>
  );
}
