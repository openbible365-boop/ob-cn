import { useEffect, useState } from 'react';
import axios from 'axios';
import { DateRangePicker } from '../components/DateRangePicker';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

export const ReadingStats = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  
  const loadData = async (start: string, end: string) => {
    setLoading(true);
    try {
      const res = await axios.get(`http://localhost:8000/api/admin/stats/reading?start_date=${start}&end_date=${end}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setData(res.data);
    } catch (e) {
      console.error("加载阅读统计失败", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // 组件挂载时不请求，让 DateRangePicker 触发初始加载
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">阅读统计</h1>
      <DateRangePicker onChange={loadData} />
      
      {loading ? (
        <div className="text-gray-500">正在加载统计数据...</div>
      ) : data ? (
        <div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
            <div className="bg-white p-4 rounded shadow">
              <div className="text-gray-500 text-sm">期间内总阅读人次/遍数</div>
              <div className="text-3xl font-bold mt-2">{data.summary.total_reads}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-gray-500 text-sm">期间内总阅读章节数 (估算)</div>
              <div className="text-3xl font-bold mt-2">{data.summary.total_chapters}</div>
            </div>
            <div className="bg-white p-4 rounded shadow">
              <div className="text-gray-500 text-sm">最大热门书卷</div>
              <div className="text-xl font-bold mt-2 text-blue-600">
                {data.book_ranking.length > 0 ? data.book_ranking[0].name.toUpperCase() : '无'}
              </div>
            </div>
          </div>
          
          <div className="bg-white p-6 rounded shadow mb-8">
            <h2 className="text-lg font-bold mb-4">书卷阅读人次排行 (Top 20)</h2>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.book_ranking} layout="vertical" margin={{ left: 20 }}>
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={80} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-gray-400">暂无数据 / 请选择日期范围</div>
      )}
    </div>
  );
};
