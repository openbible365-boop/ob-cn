import { useState } from 'react';

// 简易日期选择器（可替换为 AntD/MUI 的更强组件）
export const DateRangePicker = ({ onChange }: { onChange: (start: string, end: string) => void }) => {
  const getTodayStr = () => new Date().toISOString().split('T')[0];
  const getPastDateStr = (days: number) => {
    const d = new Date();
    d.setDate(d.getDate() - days);
    return d.toISOString().split('T')[0];
  };

  const [start, setStart] = useState(getPastDateStr(30)); // 默认过去 30 天
  const [end, setEnd] = useState(getTodayStr());

  const handleApply = () => {
    onChange(start, end);
  };

  const setRange = (days: number) => {
    const e = getTodayStr();
    const s = getPastDateStr(days);
    setStart(s);
    setEnd(e);
    onChange(s, e);
  };

  return (
    <div className="flex items-center space-x-4 mb-6 p-4 bg-white rounded shadow-sm">
      <div className="flex space-x-2">
        <button className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" onClick={() => setRange(0)}>今天</button>
        <button className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" onClick={() => setRange(7)}>最近7天</button>
        <button className="px-3 py-1 text-sm bg-blue-100 text-blue-700 font-medium rounded" onClick={() => setRange(30)}>最近30天</button>
        <button className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded" onClick={() => setRange(90)}>最近90天</button>
      </div>
      
      <div className="flex items-center space-x-2 ml-auto">
        <input 
          type="date" 
          value={start} 
          onChange={e => setStart(e.target.value)} 
          className="border rounded px-2 py-1 text-sm"
        />
        <span className="text-gray-500">至</span>
        <input 
          type="date" 
          value={end} 
          onChange={e => setEnd(e.target.value)} 
          className="border rounded px-2 py-1 text-sm"
        />
        <button onClick={handleApply} className="bg-blue-600 text-white px-3 py-1 text-sm rounded shadow">应用</button>
      </div>
    </div>
  );
};
