import { useState } from 'react';
import axios from 'axios';
import { DateRangePicker } from '../components/DateRangePicker';

export const LoginStats = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/admin/stats/login?start_date=${start}&end_date=${end}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setData(res.data);
    } catch (e) {
      console.error("加载登录统计失败", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">登录统计 & 用户特征</h1>
      <DateRangePicker onChange={loadData} />
      
      {loading ? (
        <div className="text-gray-500">正在加载统计数据...</div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow border-l-4 border-green-500">
            <div className="text-gray-500 text-sm">期间内累计登录人次</div>
            <div className="text-3xl font-bold mt-2 text-green-700">{data.summary.total_logins}</div>
          </div>
          <div className="bg-white p-4 rounded shadow border-l-4 border-yellow-500">
            <div className="text-gray-500 text-sm">去重后的访客/用户数</div>
            <div className="text-3xl font-bold mt-2 text-yellow-600">{data.summary.unique_users}</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">暂无数据 / 请选择日期范围</div>
      )}
    </div>
  );
};
