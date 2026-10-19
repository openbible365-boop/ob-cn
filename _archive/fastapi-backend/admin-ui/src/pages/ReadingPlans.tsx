import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2 } from 'lucide-react';
import api from '../api/axios';

interface ReadingPlan {
  id: number;
  slug: string;
  name_zh: string;
  name_en: string | null;
  desc_zh: string | null;
  desc_en: string | null;
  icon: string;
  gradient: string;
  emoji: string;
  days: number;
  is_active: boolean;
  schedule?: any;
}

interface PlanFormData extends Partial<ReadingPlan> {
  schedule_string?: string;
}

const ReadingPlans: React.FC = () => {
  const [plans, setPlans] = useState<ReadingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingPlan, setEditingPlan] = useState<ReadingPlan | null>(null);

  const [formData, setFormData] = useState<PlanFormData>({
    slug: '', name_zh: '', name_en: '', desc_zh: '', desc_en: '',
    icon: 'fa-book-open-reader', gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
    emoji: '📖', days: 365, is_active: true
  });

  const fetchPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/reading-plans');
      setPlans(res.data.plans || []);
    } catch (e) {
      console.error(e);
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const openModal = (plan?: ReadingPlan) => {
    if (plan) {
      setEditingPlan(plan);
      setFormData({
         ...plan,
         schedule_string: plan.schedule ? JSON.stringify(plan.schedule, null, 2) : ''
      });
    } else {
      setEditingPlan(null);
      setFormData({
        slug: '', name_zh: '', name_en: '', desc_zh: '', desc_en: '',
        icon: 'fa-book-open-reader', gradient: 'linear-gradient(135deg, #6c5ce7, #a29bfe)',
        emoji: '📖', days: 365, is_active: true, schedule_string: ''
      });
    }
    setShowModal(true);
  };

  const savePlan = async () => {
    if (!formData.slug || !formData.name_zh) {
      alert('ID (Slug) 和中文名称不能为空');
      return;
    }
    const payload = { ...formData };
    if (payload.schedule_string) {
      try {
        payload.schedule = JSON.parse(payload.schedule_string);
      } catch (err) {
        alert('排期大纲 JSON 格式有误，请检查！');
        return;
      }
    } else {
      payload.schedule = null;
    }
    delete payload.schedule_string;
    
    try {
      if (editingPlan) {
        await api.put(`/admin/reading-plans/${editingPlan.id}`, payload);
      } else {
        await api.post('/admin/reading-plans', payload);
      }
      setShowModal(false);
      fetchPlans();
    } catch (e) {
      console.error(e);
      alert('保存失败，请检查是否 Slug 重复。');
    }
  };

  const deletePlan = async (id: number) => {
    if (window.confirm("确定要删除此计划吗？")) {
      try {
        await api.delete(`/admin/reading-plans/${id}`);
        fetchPlans();
      } catch (e) {
        console.error(e);
        alert('删除失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">读经计划管理</h2>
        <button
          onClick={() => openModal()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
        >
          <Plus size={20} /> 添加计划
        </button>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID (slug)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">名称 / 描述</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">天数</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {plans.map((p) => (
                <tr key={p.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{p.slug}</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div className="font-medium text-gray-900">{p.emoji} {p.name_zh}</div>
                    <div className="text-xs">{p.desc_zh}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{p.days}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${p.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {p.is_active ? '启用' : '禁用'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => openModal(p)} className="text-blue-600 hover:text-blue-900 mr-4">
                      <Edit2 size={16} />
                    </button>
                    <button onClick={() => deletePlan(p.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">{editingPlan ? '编辑计划' : '新增计划'}</h3>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">标识 (slug)*</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.slug || ''} onChange={e => setFormData({ ...formData, slug: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">类型 (图标)*</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.icon || ''} onChange={e => setFormData({ ...formData, icon: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">中文名称*</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.name_zh || ''} onChange={e => setFormData({ ...formData, name_zh: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">英文名称</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.name_en || ''} onChange={e => setFormData({ ...formData, name_en: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">中文描述</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.desc_zh || ''} onChange={e => setFormData({ ...formData, desc_zh: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">英文描述</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.desc_en || ''} onChange={e => setFormData({ ...formData, desc_en: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">总天数</label>
                  <input type="number" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.days || 365} onChange={e => setFormData({ ...formData, days: parseInt(e.target.value) || 365 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Emoji</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.emoji || ''} onChange={e => setFormData({ ...formData, emoji: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">背景渐变 (CSS Gradient)</label>
                  <input type="text" className="w-full px-3 py-2 border border-gray-300 rounded-lg" value={formData.gradient || ''} onChange={e => setFormData({ ...formData, gradient: e.target.value })} />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">排期大纲 (JSON 格式)</label>
                  <textarea 
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm" 
                    rows={6}
                    placeholder="[ [ {&quot;b&quot;: &quot;gen&quot;, &quot;c&quot;: 1} ] ]"
                    value={formData.schedule_string || ''} 
                    onChange={e => setFormData({ ...formData, schedule_string: e.target.value })} 
                  />
                  <p className="text-xs text-gray-500 mt-1">留空则代表尚未排期。数组最外层代表第几天，内层代表该天的多卷经文组合。</p>
                </div>
                <div className="col-span-2 flex items-center mt-2">
                  <input type="checkbox" id="isActive" checked={formData.is_active} onChange={e => setFormData({ ...formData, is_active: e.target.checked })} className="w-4 h-4 text-blue-600 rounded" />
                  <label htmlFor="isActive" className="ml-2 block text-sm text-gray-900">是否启用</label>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 flex justify-end gap-3">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg">取消</button>
              <button onClick={savePlan} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPlans;
