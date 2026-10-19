import React, { useEffect, useState } from 'react';
import api from '../api/axios';
import { RefreshCw, Edit2, Trash2, Plus, X, PlayCircle, Headphones } from 'lucide-react';

interface MediaItem {
    id: string;
    media_type: 'video' | 'audio';
    title: string;
    series: string | null;
    category: string;
    duration: string | null;
    teacher: string | null;
    description: string | null;
    cover_style: string | null;
    url: string | null;
    created_at: string;
}

const MediaManage: React.FC = () => {
    const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'video' | 'audio'>('video');
    
    // Form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<MediaItem> | null>(null);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchMedia(activeTab);
    }, [activeTab]);

    const fetchMedia = async (type: 'video' | 'audio') => {
        setLoading(true);
        try {
            const res = await api.get(`/media/?media_type=${type}`);
            setMediaItems(res.data);
        } catch (err) {
            console.error(err);
            alert('获取媒体资源列表失败');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`确定要删除媒体「${title}」吗？操作不可恢复。`)) return;
        try {
            await api.delete(`/media/${id}`);
            fetchMedia(activeTab);
        } catch (err) {
            console.error(err);
            alert('删除失败');
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!editingItem) return;
        setIsSaving(true);
        try {
            if (editingItem.id && mediaItems.some(item => item.id === editingItem.id)) {
                // Update
                await api.put(`/media/${editingItem.id}`, editingItem);
            } else {
                // Create
                const createData = { ...editingItem, media_type: activeTab };
                await api.post(`/media/`, createData);
            }
            setIsModalOpen(false);
            setEditingItem(null);
            fetchMedia(activeTab);
        } catch (err) {
            console.error(err);
            alert('保存媒体信息失败');
        } finally {
            setIsSaving(false);
        }
    };

    const openCreateModal = () => {
        setEditingItem({
            media_type: activeTab,
            title: '',
            category: '',
            series: '',
            teacher: '',
            duration: '',
            description: '',
            cover_style: activeTab === 'video' ? 'linear-gradient(135deg, #667eea, #764ba2)' : 'fa-sun',
            url: ''
        });
        setIsModalOpen(true);
    };

    const openEditModal = (item: MediaItem) => {
        setEditingItem(item);
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">音视频管理</h2>
                    <p className="mt-1 text-sm text-gray-500">管理平台前端「读经计划」下展示的视频和音频列表资源。</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="bg-gray-100 p-1 flex rounded-lg shrink-0">
                        <button
                            onClick={() => setActiveTab('video')}
                            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-md transition-all ${activeTab === 'video' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <PlayCircle size={16} /> 视频资源
                        </button>
                        <button
                            onClick={() => setActiveTab('audio')}
                            className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-md transition-all ${activeTab === 'audio' ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-600 hover:text-gray-900'}`}
                        >
                            <Headphones size={16} /> 音频资源
                        </button>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={16} />
                        新增{activeTab === 'video' ? '视频' : '音频'}
                    </button>
                </div>
            </div>

            {/* Table Container */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/50">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">题图配置</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">标题 / 分类</th>
                                {activeTab === 'video' && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">系列</th>}
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">讲员/讲师</th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">时长</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <RefreshCw size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
                                        加载中...
                                    </td>
                                </tr>
                            ) : mediaItems.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        该分类下暂无资源
                                    </td>
                                </tr>
                            ) : (
                                mediaItems.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {activeTab === 'video' ? (
                                                <div className="w-12 h-8 rounded shrink-0 shadow-sm border border-black/5" style={{ background: item.cover_style || '#e2e8f0' }}></div>
                                            ) : (
                                                <div className="w-10 h-10 rounded-full shrink-0 flex items-center justify-center bg-gray-100 text-gray-500">
                                                    <i className={`fa-solid ${item.cover_style || 'fa-music'}`}></i>
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{item.title}</div>
                                            <div className="text-xs text-gray-500 mt-1"><span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.category}</span></div>
                                        </td>
                                        {activeTab === 'video' && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {item.series || '-'}
                                            </td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {item.teacher || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden md:table-cell">
                                            {item.duration || '-'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button 
                                                onClick={() => openEditModal(item)}
                                                className="text-blue-600 hover:text-blue-900 transition-colors p-2 rounded-lg hover:bg-blue-50 inline-flex items-center justify-center outline-none mr-2">
                                                <Edit2 size={18} />
                                            </button>
                                            <button 
                                                onClick={() => handleDelete(item.id, item.title)}
                                                className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-lg hover:bg-red-50 inline-flex items-center justify-center outline-none">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">{editingItem.id ? '编辑' : '新增'} {activeTab === 'video' ? '视频' : '音频'}</h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <div className="space-y-4 md:col-span-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">标题 <span className="text-red-500">*</span></label>
                                        <input required type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={editingItem.title || ''} onChange={(e) => setEditingItem({...editingItem, title: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    {activeTab === 'video' && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">大系列名称</label>
                                            <input type="text" placeholder="例: 旧约导论" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                                value={editingItem.series || ''} onChange={(e) => setEditingItem({...editingItem, series: e.target.value})} />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">分类 <span className="text-red-500">*</span></label>
                                        <input required type="text" placeholder="例: 新约、灵修、敬拜" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={editingItem.category || ''} onChange={(e) => setEditingItem({...editingItem, category: e.target.value})} />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">{activeTab === 'video' ? '讲员' : '讲员/表演者'}</label>
                                        <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={editingItem.teacher || ''} onChange={(e) => setEditingItem({...editingItem, teacher: e.target.value})} />
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">题图配置 / 样式</label>
                                        <input type="text" placeholder={activeTab === 'video' ? "linear-gradient(135deg, ...)" : "fa-sun"} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={editingItem.cover_style || ''} onChange={(e) => setEditingItem({...editingItem, cover_style: e.target.value})} />
                                        <p className="text-xs text-gray-500 mt-1">{activeTab === 'video' ? '填入 CSS 背景属性，如 gradient 或 image URL' : '填入 Font Awesome 类名，如 fa-sun'}</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">时长</label>
                                        <input type="text" placeholder="45:00" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                            value={editingItem.duration || ''} onChange={(e) => setEditingItem({...editingItem, duration: e.target.value})} />
                                    </div>
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">多媒体源 URL</label>
                                    <input type="text" placeholder="https://..." className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm" 
                                        value={editingItem.url || ''} onChange={(e) => setEditingItem({...editingItem, url: e.target.value})} />
                                </div>
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">描述</label>
                                    <textarea rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none" 
                                        value={editingItem.description || ''} onChange={(e) => setEditingItem({...editingItem, description: e.target.value})}></textarea>
                                </div>
                            </div>

                            <div className="pt-6 mt-6 flex justify-end gap-3 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                    取消
                                </button>
                                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                                    {isSaving ? <RefreshCw size={16} className="animate-spin" /> : null}
                                    保存资源
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default MediaManage;
