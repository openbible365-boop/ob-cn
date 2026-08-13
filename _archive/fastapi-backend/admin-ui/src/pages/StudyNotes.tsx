import React, { useState, useEffect } from 'react';
import {
    Plus,
    Search,
    Edit2,
    Trash2,
    Loader2,
    AlertCircle,
    X,
    MessageSquare,
    Upload
} from 'lucide-react';
import api from '../api/axios';

interface StudyNote {
    id: number;
    verse_ref: string;
    content: string;
}

const StudyNotes: React.FC = () => {
    const [notes, setNotes] = useState<StudyNote[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [importData, setImportData] = useState('');
    const [formData, setFormData] = useState({
        verse_ref: '',
        content: ''
    });

    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        fetchNotes();
    }, []);

    const fetchNotes = async () => {
        try {
            setLoading(true);
            const res = await api.get('/study-notes/');
            setNotes(Array.isArray(res.data) ? res.data : []);
            setError(null);
        } catch (err: any) {
            setError('获取数据失败，请检查网络连接或登录状态');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            if (editingId) {
                await api.post('/study-notes/', formData);
            } else {
                await api.post('/study-notes/', formData);
            }
            await fetchNotes();
            setIsModalOpen(false);
            setFormData({ verse_ref: '', content: '' });
            setEditingId(null);
        } catch (err: any) {
            alert(err.response?.data?.detail || '保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    const handleEdit = (note: StudyNote) => {
        setEditingId(note.id);
        setFormData({
            verse_ref: note.verse_ref,
            content: note.content
        });
        setIsModalOpen(true);
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('确定要删除这条精读笔记吗？')) return;
        try {
            await api.delete(`/study-notes/${id}`);
            await fetchNotes();
        } catch (err) {
            alert('删除失败');
        }
    };

    const filteredNotes = notes.filter(n =>
        n.verse_ref.toLowerCase().includes(searchTerm.toLowerCase()) ||
        n.content.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <MessageSquare className="text-blue-600" />
                        精读本管理
                    </h2>
                    <p className="text-gray-500 mt-1">管理各节经文对应的精解内容，供 AI 分析参考</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setFormData({ verse_ref: '', content: '' });
                        setIsModalOpen(true);
                    }}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Plus size={18} />
                    新增精解
                </button>
                <button
                    onClick={() => {
                        setImportData('');
                        setIsImportModalOpen(true);
                    }}
                    className="ml-3 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors shadow-sm"
                >
                    <Upload size={18} />
                    批量导入
                </button>
            </div>

            {error && (
                <div className="bg-red-50 border border-red-100 text-red-700 px-4 py-3 rounded-lg flex items-center gap-3">
                    <AlertCircle size={20} />
                    {error}
                </div>
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="p-4 border-b border-gray-100 bg-gray-50/50">
                    <div className="relative max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="搜索经文索引或内容..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead>
                            <tr className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-semibold">经文索引 (Verse Ref)</th>
                                <th className="px-6 py-4 font-semibold">精解内容</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center">
                                        <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={32} />
                                        <span className="text-gray-400">正在加载数据...</span>
                                    </td>
                                </tr>
                            ) : filteredNotes.length === 0 ? (
                                <tr>
                                    <td colSpan={3} className="px-6 py-12 text-center text-gray-400">
                                        暂无精解记录
                                    </td>
                                </tr>
                            ) : (
                                filteredNotes.map((note) => (
                                    <tr key={note.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="px-6 py-4">
                                            <span className="font-mono text-sm bg-blue-50 text-blue-700 px-2 py-1 rounded">
                                                {note.verse_ref}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-600 line-clamp-2 max-w-xl">
                                                {note.content}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={() => handleEdit(note)}
                                                    className="p-1 px-2 text-blue-600 hover:bg-blue-50 rounded"
                                                    title="编辑"
                                                >
                                                    <Edit2 size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(note.id)}
                                                    className="p-1 px-2 text-red-600 hover:bg-red-50 rounded"
                                                    title="删除"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900">
                                {editingId ? '编辑精解内容' : '新增精解记录'}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    经文索引 (例如: gen-1-1)
                                </label>
                                <input
                                    type="text"
                                    value={formData.verse_ref}
                                    onChange={(e) => setFormData({ ...formData, verse_ref: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="book-chapter-verse"
                                    required
                                    disabled={!!editingId}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">精解解析内容</label>
                                <textarea
                                    value={formData.content}
                                    onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[250px]"
                                    placeholder="输入精读本的详细解析内容..."
                                    required
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSaving}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:bg-blue-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                                    {editingId ? '保存修改' : '立即创建'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Bulk Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setIsImportModalOpen(false)} />
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl relative z-10 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Upload size={20} className="text-indigo-600" />
                                批量导入精读记录
                            </h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 space-y-4">
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg">
                                <h4 className="text-sm font-bold text-blue-800 mb-1">导入说明</h4>
                                <p className="text-xs text-blue-700">
                                    请粘贴 JSON 格式的数组，每个对象包含 <code className="bg-blue-100 px-1 rounded">verse_ref</code> 和 <code className="bg-blue-100 px-1 rounded">content</code> 字段。
                                </p>
                                <pre className="mt-2 text-[10px] bg-white/50 p-2 rounded border border-blue-200 font-mono text-blue-600">
                                    {`[
  { "verse_ref": "gen-1-1", "content": "起初神..." },
  { "verse_ref": "gen-1-2", "content": "地是空虚..." }
]`}
                                </pre>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">JSON 数据</label>
                                <textarea
                                    value={importData}
                                    onChange={(e) => setImportData(e.target.value)}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none min-h-[300px] font-mono text-xs"
                                    placeholder="在此粘贴 JSON 数组..."
                                />
                            </div>

                            <div className="pt-2 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsImportModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="button"
                                    disabled={isSaving || !importData.trim()}
                                    onClick={async () => {
                                        try {
                                            const data = JSON.parse(importData);
                                            if (!Array.isArray(data)) throw new Error('提交的数据必须是一个数组');

                                            setIsSaving(true);
                                            await api.post('/study-notes/batch', data);
                                            await fetchNotes();
                                            setIsImportModalOpen(false);
                                            alert('同步导入成功！');
                                        } catch (err: any) {
                                            alert(err.message || '导入失败，请检查 JSON 格式是否正确');
                                        } finally {
                                            setIsSaving(false);
                                        }
                                    }}
                                    className="flex-1 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:bg-indigo-400 transition-colors flex items-center justify-center gap-2"
                                >
                                    {isSaving && <Loader2 size={16} className="animate-spin" />}
                                    立即开始导入
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default StudyNotes;
