import React from 'react';
import { Outlet, Navigate, useNavigate, useLocation } from 'react-router-dom';
import {
    LogOut,
    Users,
    Home,
    Settings,
    BookOpen,
    Globe,
    Headphones,
    BookMarked,
    BarChart,
    PieChart,
    Activity,
    Cpu,
    Calendar,
    ListTodo,
    Sparkles,
    FlaskConical,
    PlayCircle,
    Heart
} from 'lucide-react';

const Layout: React.FC = () => {
    const token = localStorage.getItem('admin_token');
    const navigate = useNavigate();
    const location = useLocation();

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    const handleLogout = () => {
        localStorage.removeItem('admin_token');
        localStorage.removeItem('admin_user');
        navigate('/login');
    };

    const navItems = [
        { path: '/', label: '首页概览', icon: Home },
        { path: '/stats/reading', label: '阅读统计', icon: BarChart },
        { path: '/stats/audio', label: '音频统计', icon: PieChart },
        { path: '/stats/login', label: '登录统计', icon: Activity },
        { path: '/ai-logs', label: 'AI使用记录', icon: Cpu },
        { path: '/ai-eval', label: '模型评测', icon: FlaskConical },
        { path: '/versions', label: '版本管理', icon: Globe },
        { path: '/audio', label: '音频管理', icon: Headphones },
        { path: '/media', label: '媒体资源', icon: PlayCircle },
        { path: '/encyclopedia', label: '百科管理', icon: BookOpen },
        { path: '/books', label: '书卷管理', icon: BookOpen },
        { path: '/study-notes', label: '精读本管理', icon: BookMarked },
        { path: '/reading-plans', label: '读经计划管理', icon: Calendar },
        { path: '/user-plans', label: '用户计划订阅', icon: ListTodo },
        { path: '/support-plans', label: '支持套餐管理', icon: Heart },
        { path: '/spiritual', label: '属灵阶段管理', icon: Sparkles },
        { path: '/users', label: '用户管理', icon: Users },
        { path: '/settings', label: '系统设置', icon: Settings },
    ];

    return (
        <div className="flex h-screen bg-slate-50 overflow-hidden">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col transition-all duration-300">
                {/* Brand */}
                <div className="h-16 flex items-center px-6 border-b border-gray-100">
                    <img src="/favicon.png" className="w-8 h-8 rounded-lg mr-3 object-cover shadow-sm" alt="Logo" />
                    <h1 className="text-lg font-bold text-gray-900 tracking-tight">
                        OpenBible <span className="text-gray-400 font-normal">Admin</span>
                    </h1>
                </div>

                {/* Navigation */}
                <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
                    {navItems.map((item) => {
                        const isActive = location.pathname === item.path;
                        const Icon = item.icon;
                        return (
                            <button
                                key={item.path}
                                onClick={() => item.path !== '#' && navigate(item.path)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-50 text-blue-700'
                                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                                    }`}
                            >
                                <Icon size={18} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                                {item.label}
                            </button>
                        );
                    })}
                </nav>

                {/* Footer Actions */}
                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-red-50 hover:text-red-600 hover:border-red-100 transition-colors"
                    >
                        <LogOut size={16} />
                        退出登录
                    </button>
                </div>
            </aside>

            {/* Main Content Area */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                <header className="h-16 bg-white border-b border-gray-200 flex items-center px-8 shrink-0">
                    <div className="ml-auto flex items-center space-x-4">
                        <button 
                            onClick={handleLogout}
                            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        >
                            <LogOut size={16} />
                            退出
                        </button>
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-sm">
                            A
                        </div>
                    </div>
                </header>
                <div className="flex-1 overflow-y-auto p-8 bg-slate-50/50">
                    <div className="max-w-7xl mx-auto">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};

export default Layout;
