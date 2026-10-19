import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { Users, Activity, Bookmark } from 'lucide-react';

const Dashboard: React.FC = () => {
    const [stats, setStats] = useState({ usersCount: 0 });

    useEffect(() => {
        // 简易拉取数据统计
        api.get('/admin/users/').then(res => {
            setStats({ usersCount: res.data.length });
        }).catch(err => console.error(err));
    }, []);

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row md:items-center justify-between pb-6 border-b border-gray-200">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 tracking-tight">概览 Dashboard</h1>
                    <p className="mt-1 text-sm text-gray-500">欢迎回来，以下是 OpenBible 的近期核心数据概况。</p>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Stat Card 1 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
                        <Users size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">总注册用户</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">{stats.usersCount}</h3>
                    </div>
                </div>

                {/* Stat Card 2 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
                        <Activity size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">今日活跃</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">-</h3>
                    </div>
                </div>

                {/* Stat Card 3 */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center space-x-4 hover:shadow-md transition-shadow">
                    <div className="p-3 bg-purple-50 text-purple-600 rounded-lg">
                        <Bookmark size={28} />
                    </div>
                    <div>
                        <p className="text-sm font-medium text-gray-500">笔记与书签</p>
                        <h3 className="text-3xl font-bold text-gray-900 mt-1">-</h3>
                    </div>
                </div>

            </div>

            {/* Extra Content Area for future */}
            <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Placeholder Chart Area */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 h-80 flex flex-col justify-center items-center text-gray-400">
                    <i className="fa-solid fa-chart-line text-4xl mb-3 opacity-50"></i>
                    <p>图表区域（开发中）</p>
                </div>
                {/* Placeholder List Area */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-6 h-80 flex flex-col justify-center items-center text-gray-400">
                    <i className="fa-solid fa-list-check text-4xl mb-3 opacity-50"></i>
                    <p>近期活动（开发中）</p>
                </div>
            </div>
        </div>
    );
};

export default Dashboard;
