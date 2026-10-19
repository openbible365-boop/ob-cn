import React, { useState, useEffect } from 'react';
import { Trash2 } from 'lucide-react';
import api from '../api/axios';

interface UserPlan {
  id: number;
  user_id: number;
  username: string;
  email: string;
  plan_id: number;
  plan_name: string;
  start_date: string;
  current_day: number;
  status: string;
}

const UserPlans: React.FC = () => {
  const [userPlans, setUserPlans] = useState<UserPlan[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchUserPlans = async () => {
    try {
      setLoading(true);
      const res = await api.get('/admin/user-plans');
      setUserPlans(res.data.user_plans || []);
    } catch (e) {
      console.error(e);
      alert('加载失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserPlans();
  }, []);

  const deleteUserPlan = async (id: number) => {
    if (window.confirm("确定要删除此用户的阅读进度吗？这是不可逆转的操作！")) {
      try {
        await api.delete(`/admin/user-plans/${id}`);
        fetchUserPlans();
      } catch (e) {
        console.error(e);
        alert('删除失败');
      }
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">用户计划订阅</h2>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="p-8 text-center text-gray-500">加载中...</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">订阅计划</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">开始日期</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">当前进度 (天)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">状态</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">操作</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {userPlans.map((up) => (
                <tr key={up.id}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">{up.username || '匿名'}</div>
                    <div className="text-sm text-gray-500">{up.email}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{up.plan_name}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{up.start_date}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-600 font-bold">第 {up.current_day} 天</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${up.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                      {up.status === 'active' ? '进行中' : '已完成'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => deleteUserPlan(up.id)} className="text-red-600 hover:text-red-900">
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default UserPlans;
