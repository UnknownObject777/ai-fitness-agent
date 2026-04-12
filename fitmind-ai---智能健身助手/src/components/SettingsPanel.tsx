import React, { useState, useEffect } from 'react';
import { Settings, Save, CheckCircle2, AlertCircle, Globe, Key } from 'lucide-react';
import { getApiConfig, saveApiConfig } from '../memory/llmService';
import type { ApiConfig, Provider } from '../memory/types';

export default function SettingsPanel() {
  const [config, setConfig] = useState<ApiConfig>({
    provider: 'gemini',
    apiKey: '',
    baseUrl: '',
    model: ''
  });
  const [status, setStatus] = useState<'idle' | 'saved'>('idle');

  useEffect(() => {
    const saved = getApiConfig();
    if (saved) setConfig(saved);
  }, []);

  const handleSave = () => {
    saveApiConfig(config);
    setStatus('saved');
    setTimeout(() => setStatus('idle'), 2000);
  };

  return (
    <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
      <div className="flex items-center gap-2 border-b border-gray-100 pb-4">
        <Settings className="w-5 h-5 text-gray-400" />
        <h2 className="text-lg font-semibold text-gray-900">模型配置</h2>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
            服务商
          </label>
          <div className="grid grid-cols-2 gap-2">
            {(['gemini', 'openai'] as Provider[]).map((p) => (
              <button
                key={p}
                onClick={() => setConfig({ ...config, provider: p, model: p === 'gemini' ? 'gemini-3-flash-preview' : 'gpt-4o-mini' })}
                className={`py-2 px-4 rounded-xl border text-sm font-medium transition-all ${
                  config.provider === p
                    ? 'bg-orange-500 border-orange-500 text-white shadow-sm'
                    : 'bg-white border-gray-200 text-gray-600 hover:border-orange-200'
                }`}
              >
                {p === 'gemini' ? 'Google Gemini' : 'OpenAI / 兼容'}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              <Key className="w-3 h-3" /> API Key
            </label>
            <input
              type="password"
              value={config.apiKey}
              onChange={(e) => setConfig({ ...config, apiKey: e.target.value })}
              placeholder={config.provider === 'gemini' ? '输入 Gemini API Key' : '输入 OpenAI API Key'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>

          {config.provider === 'openai' && (
            <div>
              <label className="flex items-center gap-2 text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                <Globe className="w-3 h-3" /> Base URL (可选)
              </label>
              <input
                type="text"
                value={config.baseUrl}
                onChange={(e) => setConfig({ ...config, baseUrl: e.target.value })}
                placeholder="https://api.openai.com/v1"
                className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
              模型名称
            </label>
            <input
              type="text"
              value={config.model}
              onChange={(e) => setConfig({ ...config, model: e.target.value })}
              placeholder={config.provider === 'gemini' ? 'gemini-3-flash-preview' : 'gpt-4o-mini'}
              className="w-full bg-gray-50 border border-gray-200 rounded-xl py-2.5 px-4 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all"
            />
          </div>
        </div>
      </div>

      <div className="pt-4">
        <button
          onClick={handleSave}
          className="w-full flex items-center justify-center gap-2 bg-gray-900 hover:bg-black text-white py-3 rounded-xl font-medium transition-all shadow-lg active:scale-[0.98]"
        >
          {status === 'saved' ? (
            <>
              <CheckCircle2 className="w-4 h-4 text-green-400" />
              <span>已保存配置</span>
            </>
          ) : (
            <>
              <Save className="w-4 h-4" />
              <span>保存配置</span>
            </>
          )}
        </button>
      </div>

      <div className="p-4 bg-orange-50 rounded-xl border border-orange-100">
        <div className="flex gap-3">
          <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
          <p className="text-xs text-orange-800 leading-relaxed">
            配置将保存在本地浏览器中。请确保你的 API Key 有效且具有相应模型的访问权限。
          </p>
        </div>
      </div>
    </div>
  );
}
