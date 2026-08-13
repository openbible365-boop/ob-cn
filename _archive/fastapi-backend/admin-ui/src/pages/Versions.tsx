import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { Globe, Plus, Edit, Trash2, RefreshCw, X } from 'lucide-react';

interface Version {
    id: number;
    code: string;
    name: string;
    language: string;
    description: string;
}

const Versions: React.FC = () => {
    const [versions, setVersions] = useState<Version[]>([]);
    const [loading, setLoading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentVersion, setCurrentVersion] = useState<Partial<Version>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchVersions = async () => {
        setLoading(true);
        try {
            const res = await api.get('/versions/');
            setVersions(res.data);
        } catch (error) {
            console.error('Failed to fetch versions:', error);
            alert('获取版本列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    const handleSaveVersion = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (currentVersion.id) {
                await api.put(`/versions/${currentVersion.id}`, currentVersion);
            } else {
                await api.post('/versions/', currentVersion);
            }
            setIsEditModalOpen(false);
            fetchVersions();
        } catch (error: any) {
            alert(error.response?.data?.detail || '保存失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteVersion = async (id: number) => {
        if (!window.confirm('确定要删除这个圣经版本吗？此操作将导致关联数据异常！')) return;
        try {
            await api.delete(`/versions/${id}`);
            fetchVersions();
        } catch (error) {
            alert('删除失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Globe className="text-blue-600" />
                        圣经版本管理
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">定义系统中支持的圣经译本（如和合本、KJV 等）</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setCurrentVersion({}); setIsEditModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={16} /> 新增版本
                    </button>
                    <button
                        onClick={fetchVersions}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-blue-100 transition"
                        title="刷新列表"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Table */}
            <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-4 font-semibold">代码 (Code)</th>
                                <th className="px-6 py-4 font-semibold">显示名称</th>
                                <th className="px-6 py-4 font-semibold">语言</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {loading && versions.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="py-12 text-center text-gray-500">
                                        加载中...
                                    </td>
                                </tr>
                            ) : versions.map((v) => (
                                <tr key={v.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono font-bold text-blue-600">{v.code}</td>
                                    <td className="px-6 py-4 font-semibold">{v.name}</td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs uppercase">
                                            {v.language}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setCurrentVersion(v); setIsEditModalOpen(true); }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                                                title="编辑"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteVersion(v.id)}
                                                className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
                                                title="删除"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {currentVersion.id ? '编辑版本' : '新增版本'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveVersion} className="p-6 space-y-4 text-sm">
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">代码 (e.g., cuv)</label>
                                <input
                                    type="text"
                                    required
                                    value={currentVersion.code || ''}
                                    onChange={e => setCurrentVersion({ ...currentVersion, code: e.target.value.toLowerCase() })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">显示名称</label>
                                <input
                                    type="text"
                                    required
                                    value={currentVersion.name || ''}
                                    onChange={e => setCurrentVersion({ ...currentVersion, name: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">语言 (zh/en/...)</label>
                                <input
                                    type="text"
                                    required
                                    value={currentVersion.language || ''}
                                    onChange={e => setCurrentVersion({ ...currentVersion, language: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">描述</label>
                                <textarea
                                    value={currentVersion.description || ''}
                                    onChange={e => setCurrentVersion({ ...currentVersion, description: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none h-24"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button type="button" onClick={() => setIsEditModalOpen(false)} className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition">取消</button>
                                <button type="submit" disabled={isSubmitting} className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50">
                                    {isSubmitting ? '保存中...' : '保存'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Versions;
