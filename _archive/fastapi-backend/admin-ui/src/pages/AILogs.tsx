import { useEffect, useState } from 'react';
import axios from 'axios';

interface AILog {
  id: number;
  user_id: number;
  interaction_type: string;
  prompt_summary: string;
  reference: string;
  model_name: string;
  tokens: number;
  latency_ms: number;
  created_at: string;
}

export const AILogs = () => {
  const [logs, setLogs] = useState<AILog[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const limit = 20;

  const loadData = async () => {
    setLoading(true);
    try {
      const skip = (page - 1) * limit;
      const res = await axios.get(`http://localhost:8000/api/admin/stats/ai-logs?skip=${skip}&limit=${limit}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('admin_token')}` }
      });
      setLogs(res.data.items);
      setTotal(res.data.total);
    } catch (e) {
      console.error("加载 AI 日志失败", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [page]);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">AI 助手使用记录</h1>
      
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">时间</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">用户</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">交互类型</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">关联经文</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">耗时 / Token</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">摘要</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {loading ? (
              <tr><td colSpan={6} className="text-center py-4">加载中...</td></tr>
            ) : logs.map(log => (
              <tr key={log.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                  UID: {log.user_id || '游客'}
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.interaction_type}
                  <div className="text-xs text-blue-500">{log.model_name}</div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <span className="px-2 py-1 bg-gray-100 rounded">{log.reference}</span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {log.latency_ms}ms <br/>
                  <span className="text-xs text-yellow-600">{log.tokens} Tks</span>
                </td>
                <td className="px-6 py-4 text-sm text-gray-500">
                  {log.prompt_summary}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        
        {/* Pagination */}
        <div className="bg-white px-4 py-3 border-t border-gray-200 flex items-center justify-between sm:px-6">
          <div className="text-sm text-gray-700">
            共 <span className="font-medium">{total}</span> 条记录
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              上一页
            </button>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={page * limit >= total}
              className="px-3 py-1 border rounded text-sm disabled:opacity-50"
            >
              下一页
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
