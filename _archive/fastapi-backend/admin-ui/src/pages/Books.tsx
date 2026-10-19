import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { List, Plus, Edit, Trash2, RefreshCw, X } from 'lucide-react';

interface Book {
    id: number;
    version: string;
    sn: number;
    code: string;
    full_name: string;
    short_name: string;
    chapter_count: number;
    new_old: number;
}

const Books: React.FC = () => {
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(false);
    const [versions, setVersions] = useState<any[]>([]);
    const [versionFilter, setVersionFilter] = useState('cuv');
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [currentBook, setCurrentBook] = useState<Partial<Book>>({});
    const [isSubmitting, setIsSubmitting] = useState(false);

    const fetchVersions = async () => {
        try {
            const res = await api.get('/versions/');
            setVersions(res.data);
            if (res.data.length > 0 && !res.data.find((v: any) => v.code === 'cuv')) {
                setVersionFilter(res.data[0].code);
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error);
        }
    };

    const fetchBooks = async () => {
        setLoading(true);
        try {
            const res = await api.get('/books/', { params: { version: versionFilter } });
            setBooks(res.data);
        } catch (error) {
            console.error('Failed to fetch books:', error);
            alert('获取目录失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchVersions();
    }, []);

    useEffect(() => {
        if (versionFilter) fetchBooks();
    }, [versionFilter]);

    const handleSaveBook = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (currentBook.id) {
                await api.put(`/books/${currentBook.id}`, currentBook);
            } else {
                await api.post('/books/', currentBook);
            }
            setIsEditModalOpen(false);
            fetchBooks();
        } catch (error: any) {
            alert(error.response?.data?.detail || '保存失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteBook = async (id: number) => {
        if (!window.confirm('确定要删除这个书卷吗？此操作不可撤销。')) return;
        try {
            await api.delete(`/books/${id}`);
            fetchBooks();
        } catch (error) {
            alert('删除失败');
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <List className="text-blue-600" />
                        圣经目录管理
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">配置圣经 66 卷书的元数据（全称、简称、章节数等）</p>
                </div>
                <div className="flex items-center gap-3">
                    <select
                        value={versionFilter}
                        onChange={(e) => setVersionFilter(e.target.value)}
                        className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                        {versions.map(v => (
                            <option key={v.code} value={v.code}>{v.name} ({v.code.toUpperCase()})</option>
                        ))}
                    </select>
                    <button
                        onClick={() => { setCurrentBook({ sn: books.length + 1, new_old: 0, version: versionFilter }); setIsEditModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={16} /> 新增书卷
                    </button>
                    <button
                        onClick={fetchBooks}
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
                                <th className="px-6 py-4 font-semibold">序号</th>
                                <th className="px-6 py-4 font-semibold">代码</th>
                                <th className="px-6 py-4 font-semibold">全称</th>
                                <th className="px-6 py-4 font-semibold">简称</th>
                                <th className="px-6 py-4 font-semibold">章节数</th>
                                <th className="px-6 py-4 font-semibold">分类</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {loading && books.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="py-12 text-center text-gray-500">
                                        加载中...
                                    </td>
                                </tr>
                            ) : books.map((book) => (
                                <tr key={book.id} className="hover:bg-blue-50/50 transition-colors">
                                    <td className="px-6 py-4 font-mono text-gray-400">{book.sn}</td>
                                    <td className="px-6 py-4 font-medium uppercase text-blue-600">{book.code}</td>
                                    <td className="px-6 py-4 font-semibold">{book.full_name}</td>
                                    <td className="px-6 py-4">{book.short_name}</td>
                                    <td className="px-6 py-4">{book.chapter_count} 章</td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${book.new_old === 1 ? 'bg-purple-100 text-purple-700' : 'bg-amber-100 text-amber-700'}`}>
                                            {book.new_old === 1 ? '新约' : '旧约'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => { setCurrentBook(book); setIsEditModalOpen(true); }}
                                                className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                                                title="编辑"
                                            >
                                                <Edit size={16} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteBook(book.id)}
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

            {/* Edit / Create Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {currentBook.id ? '编辑书卷' : '新增书卷'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveBook} className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="col-span-2">
                                    <label className="block font-medium text-gray-700 mb-1">版本标识</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentBook.version || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, version: e.target.value })}
                                        placeholder="例: cuv"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">序号 (SN)</label>
                                    <input
                                        type="number"
                                        required
                                        value={currentBook.sn || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, sn: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">书卷代码</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentBook.code || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, code: e.target.value.toLowerCase() })}
                                        placeholder="例: gen"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block font-medium text-gray-700 mb-1">书卷全称</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentBook.full_name || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, full_name: e.target.value })}
                                        placeholder="例: 创世记"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">书卷简称</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentBook.short_name || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, short_name: e.target.value })}
                                        placeholder="例: 创"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">总章节数</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={currentBook.chapter_count || ''}
                                        onChange={e => setCurrentBook({ ...currentBook, chapter_count: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div className="col-span-2">
                                    <label className="block font-medium text-gray-700 mb-1">新旧约分类</label>
                                    <select
                                        value={currentBook.new_old}
                                        onChange={e => setCurrentBook({ ...currentBook, new_old: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        <option value={0}>旧约 (Old Testament)</option>
                                        <option value={1}>新约 (New Testament)</option>
                                    </select>
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={isSubmitting}
                                    className="px-4 py-2 text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition disabled:opacity-50"
                                >
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

export default Books;
