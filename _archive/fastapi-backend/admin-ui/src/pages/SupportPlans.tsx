import React, { useState, useEffect } from 'react';
import { Sparkles, Edit3, X, Save, Check, Heart, HelpCircle, MessageSquare } from 'lucide-react';
import api from '../api/axios';

interface SupportPlan {
  id: string;
  name: string;
  name_en: string | null;
  name_ko: string | null;
  price_monthly: number;
  price_once: number;
  badge: string | null;
  badge_en: string | null;
  badge_ko: string | null;
  features: string;
  features_en: string | null;
  features_ko: string | null;
  dialogue_limit: number;
  sort_order: number;
}

const SupportPlans: React.FC = () => {
  const [plans, setPlans] = useState<SupportPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingPlan, setEditingPlan] = useState<SupportPlan | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [saveLoading, setSaveLoading] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // 表单状态
  const [formName, setFormName] = useState('');
  const [formNameEn, setFormNameEn] = useState('');
  const [formNameKo, setFormNameKo] = useState('');
  const [formPriceMonthly, setFormPriceMonthly] = useState<number>(0);
  const [formPriceOnce, setFormPriceOnce] = useState<number>(0);
  const [formBadge, setFormBadge] = useState('');
  const [formBadgeEn, setFormBadgeEn] = useState('');
  const [formBadgeKo, setFormBadgeKo] = useState('');
  const [formFeatures, setFormFeatures] = useState('');
  const [formFeaturesEn, setFormFeaturesEn] = useState('');
  const [formFeaturesKo, setFormFeaturesKo] = useState('');
  const [formDialogueLimit, setFormDialogueLimit] = useState<number>(20);

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/support-plans');
      setPlans(res.data || []);
    } catch (e) {
      console.error(e);
      showToast('加载支持计划失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg(null);
    }, 3000);
  };

  const handleEditClick = (plan: SupportPlan) => {
    setEditingPlan(plan);
    setFormName(plan.name);
    setFormNameEn(plan.name_en || '');
    setFormNameKo(plan.name_ko || '');
    setFormPriceMonthly(plan.price_monthly);
    setFormPriceOnce(plan.price_once);
    setFormBadge(plan.badge || '');
    setFormBadgeEn(plan.badge_en || '');
    setFormBadgeKo(plan.badge_ko || '');
    setFormFeatures(plan.features);
    setFormFeaturesEn(plan.features_en || '');
    setFormFeaturesKo(plan.features_ko || '');
    setFormDialogueLimit(plan.dialogue_limit);
    setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlan) return;

    try {
      setSaveLoading(true);
      const res = await api.put(`/admin/support-plans/${editingPlan.id}`, {
        name: formName,
        name_en: formNameEn.trim() || null,
        name_ko: formNameKo.trim() || null,
        price_monthly: Number(formPriceMonthly),
        price_once: Number(formPriceOnce),
        badge: formBadge.trim() || null,
        badge_en: formBadgeEn.trim() || null,
        badge_ko: formBadgeKo.trim() || null,
        features: formFeatures,
        features_en: formFeaturesEn.trim() || null,
        features_ko: formFeaturesKo.trim() || null,
        dialogue_limit: Number(formDialogueLimit),
        sort_order: editingPlan.sort_order
      });

      // 更新列表
      setPlans(prev => prev.map(p => p.id === editingPlan.id ? res.data : p));
      setIsModalOpen(false);
      showToast(`《${formName}》更新配置成功`);
    } catch (err: any) {
      console.error(err);
      alert(err.response?.data?.detail || '保存套餐失败，请检查参数');
    } finally {
      setSaveLoading(false);
    }
  };

  return (
    <div className="space-y-6 relative pb-10">
      {/* Toast Alert */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-emerald-500 text-white px-6 py-3 rounded-xl shadow-lg flex items-center gap-2 animate-bounce">
          <Check size={18} />
          <span className="font-semibold text-sm">{toastMsg}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Heart className="text-rose-500 fill-rose-500" size={24} />
            <h2 className="text-2xl font-bold text-slate-800">支持计划管理</h2>
          </div>
          <p className="text-slate-400 text-sm mt-1">
            动态修改主页面“我们需要您的支持”弹窗的多语言数据、对话次数限额与 Stripe 支付真实收取价格。
          </p>
        </div>
        <div className="text-xs bg-slate-100 text-slate-500 px-3 py-1.5 rounded-lg flex items-center gap-1.5">
          <HelpCircle size={14} />
          以换行符分隔特性的展示列表
        </div>
      </div>

      {/* Main Grid */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-500"></div>
          <span className="ml-3 text-slate-500 font-medium">拉取配置中...</span>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {plans.map((plan) => {
            const isFeatured = !!plan.badge;
            const featuresList = plan.features.split('\n').filter(f => f.trim() !== '');

            return (
              <div 
                key={plan.id} 
                className={`bg-white rounded-2xl border transition-all duration-300 relative flex flex-col justify-between overflow-hidden group shadow-sm hover:shadow-md ${
                  isFeatured ? 'border-indigo-400 ring-2 ring-indigo-500/10' : 'border-slate-100'
                }`}
              >
                {/* Badge Tag */}
                {plan.badge && (
                  <div className="absolute top-3 right-3 bg-gradient-to-r from-indigo-500 to-purple-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-sm">
                    {plan.badge}
                  </div>
                )}

                {/* Body */}
                <div className="p-6 space-y-6">
                  <div>
                    <h3 className="text-lg font-bold text-slate-800 flex items-center gap-1.5">
                      {plan.id !== 'free' && <Sparkles size={16} className="text-indigo-500" />}
                      {plan.name}
                    </h3>
                    <div className="text-xs text-slate-400 mt-1 space-y-0.5">
                      <p>EN: {plan.name_en || <span className="italic text-slate-300">未设置</span>} {plan.badge_en && <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase">{plan.badge_en}</span>}</p>
                      <p>KO: {plan.name_ko || <span className="italic text-slate-300">未设置</span>} {plan.badge_ko && <span className="ml-1.5 text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-bold uppercase">{plan.badge_ko}</span>}</p>
                    </div>
                  </div>

                  {/* Dialogue Limit & Pricing Box */}
                  <div className="bg-slate-50/50 p-4 rounded-xl space-y-2.5 border border-slate-100/50">
                    <div className="flex justify-between items-center text-xs text-slate-500 font-medium">
                      <span className="flex items-center gap-1"><MessageSquare size={13} className="text-indigo-400" /> 对话限额</span>
                      <span className="font-bold text-indigo-600">{plan.dialogue_limit} 次/月</span>
                    </div>
                    <div className="border-t border-slate-100/70 pt-2 flex justify-between items-baseline">
                      <span className="text-xs text-slate-400 font-medium">连续每月</span>
                      <span className="text-lg font-extrabold text-slate-800">${plan.price_monthly}</span>
                    </div>
                    <div className="flex justify-between items-baseline border-t border-slate-100/70 pt-2">
                      <span className="text-xs text-slate-400 font-medium">单次支持</span>
                      <span className="text-lg font-extrabold text-slate-800">${plan.price_once}</span>
                    </div>
                  </div>

                  {/* Features List */}
                  <div className="space-y-2">
                    <p className="text-xs text-slate-400 font-bold tracking-wider uppercase">中文权益特性 ({featuresList.length})</p>
                    <div className="space-y-2 max-h-32 overflow-y-auto pr-1">
                      {featuresList.map((feat, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs text-slate-500 leading-normal">
                          <Check size={12} className="text-indigo-500 mt-0.5 shrink-0" />
                          <span>{feat}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-6 border-t border-slate-50 bg-slate-50/20">
                  <button 
                    onClick={() => handleEditClick(plan)}
                    className="w-full flex items-center justify-center gap-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-600 font-semibold text-sm py-2.5 px-4 rounded-xl transition-colors duration-250"
                  >
                    <Edit3 size={15} />
                    编辑配置
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Edit Modal Drawer */}
      {isModalOpen && editingPlan && (
        <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto py-10">
          {/* Backdrop */}
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
            onClick={() => setIsModalOpen(false)}
          ></div>

          {/* Dialog Card */}
          <div className="bg-white rounded-3xl w-full max-w-2xl mx-4 z-10 overflow-hidden shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
            {/* Header */}
            <div className="px-8 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50 shrink-0">
              <div>
                <h3 className="font-bold text-slate-800 text-lg">编辑计划配置 (支持多语言)</h3>
                <p className="text-slate-400 text-xs mt-0.5">正在编辑套餐 {editingPlan.id}</p>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-8 space-y-6">
              
              {/* 多语言计划名称 */}
              <div className="space-y-3">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">1. 计划名称 (多语言)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">中文名</label>
                    <input 
                      type="text" 
                      required 
                      value={formName}
                      onChange={e => setFormName(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">英文名 (EN)</label>
                    <input 
                      type="text" 
                      value={formNameEn}
                      onChange={e => setFormNameEn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">韩文名 (KO)</label>
                    <input 
                      type="text" 
                      value={formNameKo}
                      onChange={e => setFormNameKo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 核心限制与属性 */}
              <div className="space-y-3 pt-2 border-t border-slate-50">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">2. 价格与配额</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">月度支持价 ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      required 
                      value={formPriceMonthly}
                      onChange={e => setFormPriceMonthly(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">单次支持价 ($)</label>
                    <input 
                      type="number" 
                      step="0.01"
                      min="0"
                      required 
                      value={formPriceOnce}
                      onChange={e => setFormPriceOnce(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">对话次数配额</label>
                    <input 
                      type="number" 
                      min="0"
                      required 
                      value={formDialogueLimit}
                      onChange={e => setFormDialogueLimit(Number(e.target.value))}
                      className="w-full bg-slate-50 border border-indigo-200 ring-2 ring-indigo-500/10 rounded-xl px-4 py-2.5 text-sm font-bold text-indigo-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 多语言特惠徽章 */}
              <div className="space-y-3 pt-2 border-t border-slate-50">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">3. 特惠徽章 (选填，多语言)</h4>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">中文徽章</label>
                    <input 
                      type="text" 
                      placeholder="如: 热门"
                      value={formBadge}
                      onChange={e => setFormBadge(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">英文徽章 (EN)</label>
                    <input 
                      type="text" 
                      placeholder="e.g. Popular"
                      value={formBadgeEn}
                      onChange={e => setFormBadgeEn(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-500 block">韩文徽章 (KO)</label>
                    <input 
                      type="text" 
                      placeholder="예: 인기"
                      value={formBadgeKo}
                      onChange={e => setFormBadgeKo(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-sm font-semibold text-slate-700 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                </div>
              </div>

              {/* 多语言权益特性描述 */}
              <div className="space-y-4 pt-2 border-t border-slate-50">
                <h4 className="text-xs font-bold text-indigo-600 uppercase tracking-wider">4. 权益特性列表 (多语言，一行填写一条)</h4>
                
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 block">中文特性列表</label>
                  <textarea 
                    rows={3}
                    required
                    placeholder="中文特性，一行填写一条特性"
                    value={formFeatures}
                    onChange={e => setFormFeatures(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  ></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 block">英文特性列表 (EN)</label>
                  <textarea 
                    rows={3}
                    placeholder="英文特性，一行填写一条特性"
                    value={formFeaturesEn}
                    onChange={e => setFormFeaturesEn(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  ></textarea>
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-500 block">韩文特性列表 (KO)</label>
                  <textarea 
                    rows={3}
                    placeholder="韩文特性，一行填写一条特性"
                    value={formFeaturesKo}
                    onChange={e => setFormFeaturesKo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-sm font-medium text-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                  ></textarea>
                </div>
              </div>

              {/* Actions Footer */}
              <div className="flex gap-3 justify-end pt-4 border-t border-slate-100 shrink-0">
                <button 
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-5 py-2.5 rounded-xl border border-slate-200 text-slate-500 hover:bg-slate-50 font-semibold text-sm transition-colors"
                >
                  取消
                </button>
                <button 
                  type="submit"
                  disabled={saveLoading}
                  className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700 text-white font-semibold text-sm shadow-md hover:shadow-lg flex items-center gap-1.5 transition-all duration-200 disabled:opacity-50"
                >
                  {saveLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  ) : (
                    <Save size={16} />
                  )}
                  保存配置
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default SupportPlans;
