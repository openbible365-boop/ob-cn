import { useState } from 'react';
import axios from 'axios';
import { DateRangePicker } from '../components/DateRangePicker';

export const AudioStats = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const loadData = async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/admin/stats/audio?start_date=${start}&end_date=${end}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setData(res.data);
    } catch (e) {
      console.error("加载音频统计失败", e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">音频统计</h1>
      <DateRangePicker onChange={loadData} />
      
      {loading ? (
        <div className="text-gray-500">正在加载统计数据...</div>
      ) : data ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">期间内累计播放人次</div>
            <div className="text-3xl font-bold mt-2">{data.summary.total_plays}</div>
          </div>
          <div className="bg-white p-4 rounded shadow">
            <div className="text-gray-500 text-sm">期间内累计收听时长 (小时)</div>
            <div className="text-3xl font-bold mt-2 text-indigo-600">{data.summary.total_duration_hours} h</div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">暂无数据</div>
      )}
    </div>
  );
};
