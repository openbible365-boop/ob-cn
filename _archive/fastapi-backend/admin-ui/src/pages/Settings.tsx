import { useEffect, useState } from 'react';
import api from '../api/axios';
import { Settings, Key, Server, Cpu, CheckCircle, AlertTriangle, Loader, Eye, EyeOff, Volume2 } from 'lucide-react';

interface SettingsData {
  n1n_api_key_masked: string;
  n1n_api_base: string;
  n1n_model: string;
  has_key: boolean;
  tts_default_voice: string;
}

// 常用 n1n.ai 可选模型列表
const COMMON_MODELS = [
  { value: 'gpt-4o',            label: 'GPT-4o（最强）' },
  { value: 'gpt-4o-mini',       label: 'GPT-4o Mini（推荐）' },
  { value: 'gpt-4-turbo',       label: 'GPT-4 Turbo' },
  { value: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
  { value: 'claude-3-haiku-20240307',   label: 'Claude 3 Haiku（快速）' },
  { value: 'deepseek-v3',       label: 'DeepSeek V3' },
  { value: 'deepseek-r1',       label: 'DeepSeek R1（推理）' },
  { value: 'gemini-1.5-pro',    label: 'Gemini 1.5 Pro' },
  { value: 'gemini-1.5-flash',  label: 'Gemini 1.5 Flash（快速）' },
  { value: 'grok-3',            label: 'Grok 3' },
];

const SettingsPage = () => {
  const [data, setData] = useState<SettingsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // 表单状态
  const [apiKey, setApiKey] = useState('');
  const [apiBase, setApiBase] = useState('https://api.n1n.ai/v1');
  const [model, setModel] = useState('gpt-4o-mini');
  const [customModel, setCustomModel] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [useCustomModel, setUseCustomModel] = useState(false);
  const [defaultVoice, setDefaultVoice] = useState<'female' | 'male'>('female');  // 新取默认声音

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.get('/admin/settings');
      const d: SettingsData = res.data;
      setData(d);
      setApiBase(d.n1n_api_base || 'https://api.n1n.ai/v1');
      setDefaultVoice((d.tts_default_voice as 'female' | 'male') || 'female');

      // 判断当前模型是否在预设列表中
      const known = COMMON_MODELS.find(m => m.value === d.n1n_model);
      if (known) {
        setModel(d.n1n_model);
        setUseCustomModel(false);
      } else {
        setUseCustomModel(true);
        setCustomModel(d.n1n_model);
      }
    } catch (e) {
      setError('加载配置失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadSettings(); }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      const finalModel = useCustomModel ? customModel.trim() : model;
      if (!finalModel) {
        setError('模型名称不能为空');
        return;
      }
      await api.put('/admin/settings', {
        n1n_api_key: apiKey || undefined,
        n1n_api_base: apiBase,
        n1n_model: finalModel,
        tts_default_voice: defaultVoice,
      });
      setSuccess('✅ 配置已保存，立即生效！');
      setApiKey('');
      await loadSettings();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg || '保存失败，请重试');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        <Loader className="animate-spin mr-2" size={20} />
        加载配置中...
      </div>
    );
  }

  return (
    <div className="max-w-3xl">
      {/* 页头 */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
          <Settings className="text-blue-600" size={22} />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">系统设置</h1>
          <p className="text-sm text-gray-500 mt-0.5">管理 AI 问答服务的 API 配置</p>
        </div>
      </div>

      {/* 状态卡片 */}
      <div className={`flex items-center gap-3 p-4 rounded-xl mb-6 ${data?.has_key ? 'bg-emerald-50 border border-emerald-200' : 'bg-amber-50 border border-amber-200'}`}>
        {data?.has_key ? (
          <>
            <CheckCircle className="text-emerald-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-emerald-700">n1n.ai 已配置</p>
              <p className="text-xs text-emerald-600 mt-0.5">
                当前 Key：{data.n1n_api_key_masked || '已配置（已脱敏）'} &nbsp;·&nbsp; 模型：<span className="font-mono font-medium">{data.n1n_model}</span>
              </p>
            </div>
          </>
        ) : (
          <>
            <AlertTriangle className="text-amber-600 shrink-0" size={20} />
            <div>
              <p className="text-sm font-semibold text-amber-700">尚未配置 API Key</p>
              <p className="text-xs text-amber-600 mt-0.5">请填写 n1n.ai API Key 以启用慧读 AI 问答功能</p>
            </div>
          </>
        )}
      </div>

      {/* 表单卡片 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Cpu size={16} className="text-gray-400" />
            n1n.ai API 配置
          </h2>
        </div>

        <div className="p-6 space-y-6">
          {/* API Key */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Key size={14} className="inline mr-1.5 text-gray-400" />
              API Key
            </label>
            <div className="relative">
              <input
                type={showKey ? 'text' : 'password'}
                value={apiKey}
                onChange={e => setApiKey(e.target.value)}
                placeholder={data?.has_key ? '已配置（留空不修改）' : '输入 n1n.ai API Key，如 sk-xxx...'}
                className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent placeholder:text-gray-400 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowKey(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <p className="mt-1.5 text-xs text-gray-400">
              在 <a href="https://n1n.ai" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">n1n.ai</a> 控制台获取 API Key。若有已配置的 Key 留空此项则保持不变。
            </p>
          </div>

          {/* API Base URL */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Server size={14} className="inline mr-1.5 text-gray-400" />
              API Base URL
            </label>
            <input
              type="text"
              value={apiBase}
              onChange={e => setApiBase(e.target.value)}
              placeholder="https://api.n1n.ai/v1"
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-400">OpenAI 兼容接口地址，默认 https://api.n1n.ai/v1</p>
          </div>

          {/* Model */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <Cpu size={14} className="inline mr-1.5 text-gray-400" />
              AI 模型
            </label>

            {/* 模型快捷选择 */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              {COMMON_MODELS.map(m => (
                <button
                  key={m.value}
                  type="button"
                  onClick={() => { setModel(m.value); setUseCustomModel(false); }}
                  className={`text-left px-3 py-2 rounded-lg border text-sm transition-all ${
                    !useCustomModel && model === m.value
                      ? 'border-blue-500 bg-blue-50 text-blue-700 font-medium'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <span className="font-mono text-xs block">{m.value}</span>
                  <span className="text-xs text-gray-400">{m.label}</span>
                </button>
              ))}
            </div>

            {/* 自定义模型 */}
            <div className="flex items-center gap-2 mb-2">
              <input
                type="checkbox"
                id="customModel"
                checked={useCustomModel}
                onChange={e => setUseCustomModel(e.target.checked)}
                className="rounded border-gray-300 text-blue-600"
              />
              <label htmlFor="customModel" className="text-sm text-gray-600 cursor-pointer">使用自定义模型名称</label>
            </div>
            {useCustomModel && (
              <input
                type="text"
                value={customModel}
                onChange={e => setCustomModel(e.target.value)}
                placeholder="输入模型名称，如 gpt-4o、claude-3-5-sonnet-20241022..."
                className="w-full px-4 py-2.5 border border-blue-300 rounded-xl text-sm text-gray-900 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            )}
            <p className="mt-1.5 text-xs text-gray-400">
              当前使用：<span className="font-mono text-gray-600">{useCustomModel ? (customModel || '未填写') : model}</span>
            </p>
          </div>
        </div>

        {/* 音频声音设置卡 */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden mt-6">
        <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
            <Volume2 size={16} className="text-gray-400" />
            音频默认声音
          </h2>
        </div>
        <div className="p-6">
          <p className="text-sm text-gray-500 mb-4">
            设置首页播放新约章节时的默认声音。旧约始终使用「开朗学长」，不受此配置影响。
          </p>
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={() => setDefaultVoice('female')}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                defaultVoice === 'female'
                  ? 'border-pink-400 bg-pink-50 text-pink-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl">👩</span>
              <span className="font-semibold text-sm">知性女声</span>
              <span className="text-xs text-gray-400">zh_female_zhixingnvsheng</span>
              {defaultVoice === 'female' && (
                <span className="text-xs bg-pink-100 text-pink-600 px-2 py-0.5 rounded-full font-medium">当前默认</span>
              )}
            </button>
            <button
              type="button"
              onClick={() => setDefaultVoice('male')}
              className={`flex flex-col items-center gap-2 p-5 rounded-xl border-2 transition-all ${
                defaultVoice === 'male'
                  ? 'border-blue-400 bg-blue-50 text-blue-700'
                  : 'border-gray-200 text-gray-500 hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <span className="text-2xl">👨‍🎓</span>
              <span className="font-semibold text-sm">开朗学长</span>
              <span className="text-xs text-gray-400">en_male_jason_conversation</span>
              {defaultVoice === 'male' && (
                <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full font-medium">当前默认</span>
              )}
            </button>
          </div>
          <p className="mt-3 text-xs text-gray-400">
            用户在首页点击「收听」后，新约将自动使用此声音。用户也可在播放器中手动切换声音，屏幕切换会覆盖此全局设置。
          </p>
        </div>
      </div>

        {/* 操作栏 */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div>
            {error && (
              <p className="text-sm text-red-500 flex items-center gap-1">
                <AlertTriangle size={14} /> {error}
              </p>
            )}
            {success && (
              <p className="text-sm text-emerald-600 font-medium">{success}</p>
            )}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed transition-colors shadow-sm"
          >
            {saving ? <Loader size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            {saving ? '保存中...' : '保存配置'}
          </button>
        </div>
      </div>

      {/* 说明 */}
      <div className="mt-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
        <p className="text-xs text-blue-700 leading-relaxed">
          <strong>💡 说明：</strong>配置保存后立即生效（同时写入 .env 文件持久化）。API Key 仅在此处脱敏显示，完整 Key 安全存储在服务器 .env 文件中。
          使用 n1n.ai 的 OpenAI 兼容接口，支持 500+ 个 LLM 模型，<a href="https://n1n.ai" target="_blank" rel="noopener noreferrer" className="text-blue-600 underline">了解更多</a>。
        </p>
      </div>
    </div>
  );
};

export default SettingsPage;
