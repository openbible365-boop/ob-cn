import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { BookOpen, Search, Plus, Upload, Edit, Trash2, RefreshCw, X } from 'lucide-react';

interface Verse {
    id: number;
    version: string;
    book: string;
    chapter: number;
    verse_num: number;
    text: string;
}

const Verses: React.FC = () => {
    const [verses, setVerses] = useState<Verse[]>([]);
    const [loading, setLoading] = useState(false);
    const [search, setSearch] = useState('');
    const [versionFilter, setVersionFilter] = useState('');
    const [bookFilter, setBookFilter] = useState('');
    const [chapterFilter, setChapterFilter] = useState<number | ''>('');
    const [page, setPage] = useState(0);
    const [total, setTotal] = useState(0);
    const limit = 10;

    const [books, setBooks] = useState<any[]>([]);
    const [versions, setVersions] = useState<any[]>([]);

    // Modal states
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isImportModalOpen, setIsImportModalOpen] = useState(false);
    const [currentVerse, setCurrentVerse] = useState<Partial<Verse>>({});

    // Import state
    const [importData, setImportData] = useState('');
    const [importVersion, setImportVersion] = useState('cuv');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [importError, setImportError] = useState('');

    const fetchVersions = async () => {
        try {
            const res = await api.get('/versions/');
            setVersions(res.data);
            if (res.data.length > 0 && !versionFilter) {
                // If cuv exists, might want it as default, otherwise first one
                const hasCuv = res.data.find((v: any) => v.code === 'cuv');
                if (hasCuv) setVersionFilter('cuv');
                else setVersionFilter(res.data[0].code);
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error);
        }
    };

    const fetchBooks = async (version?: string) => {
        try {
            const res = await api.get('/books/', { params: { version } });
            setBooks(res.data);
        } catch (error) {
            console.error('Failed to fetch books:', error);
        }
    };

    const fetchVerses = async () => {
        setLoading(true);
        try {
            const params = {
                skip: page * limit,
                limit,
                search: search || undefined,
                version: versionFilter || undefined,
                book: bookFilter || undefined,
                chapter: chapterFilter || undefined
            };
            const res = await api.get('/verses/', { params });
            setVerses(res.data.items);
            setTotal(res.data.total);
        } catch (error) {
            console.error('Failed to fetch verses:', error);
            alert('获取经文列表失败');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        // Fetch initially
        fetchVersions();
        fetchBooks(versionFilter);
    }, []);

    useEffect(() => {
        if (versions.length > 0 && !importVersion) {
            const hasCuv = versions.find(v => v.code === 'cuv');
            if (hasCuv) setImportVersion('cuv');
            else setImportVersion(versions[0].code);
        }
    }, [versions]);

    useEffect(() => {
        // Update books when version changes
        setBookFilter('');
        setChapterFilter('');
        fetchBooks(versionFilter);
    }, [versionFilter]);

    useEffect(() => {
        const delayDebounceFn = setTimeout(() => {
            setPage(0); // Reset page on filter change
            fetchVerses();
        }, 300);
        return () => clearTimeout(delayDebounceFn);
    }, [search, versionFilter, bookFilter, chapterFilter]);

    useEffect(() => {
        fetchVerses();
    }, [page]);

    const handleSaveVerse = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        try {
            if (currentVerse.id) {
                await api.put(`/verses/${currentVerse.id}`, currentVerse);
            } else {
                await api.post('/verses/', currentVerse);
            }
            setIsEditModalOpen(false);
            fetchVerses();
        } catch (error: any) {
            alert(error.response?.data?.detail || '保存失败');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteVerse = async (id: number) => {
        if (!window.confirm('确定要删除这节经文吗？')) return;
        try {
            await api.delete(`/verses/${id}`);
            fetchVerses();
        } catch (error) {
            alert('删除失败');
        }
    };

    const handleBulkImport = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSubmitting(true);
        setImportError('');
        try {
            const parsedData = JSON.parse(importData);
            const res = await api.post('/verses/bulk-import', {
                version: importVersion,
                data: parsedData
            });
            alert(res.data.msg);
            setIsImportModalOpen(false);
            setImportData('');
            fetchVerses();
        } catch (error: any) {
            if (error instanceof SyntaxError) {
                setImportError('JSON 格式不正确');
            } else {
                setImportError(error.response?.data?.detail || '导入失败');
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <BookOpen className="text-blue-600" />
                        经文数据管理
                    </h2>
                    <p className="text-sm text-gray-500 mt-1">管理各版本的圣经原文数据</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => { setCurrentVerse({}); setIsEditModalOpen(true); }}
                        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
                    >
                        <Plus size={16} /> 新增经文
                    </button>
                    <button
                        onClick={() => setIsImportModalOpen(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition"
                    >
                        <Upload size={16} /> 批量导入
                    </button>
                    <button
                        onClick={fetchVerses}
                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-white rounded-lg border border-transparent hover:border-blue-100 transition"
                        title="刷新列表"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* Filters */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-white rounded-xl shadow-sm border border-gray-100">
                <div className="relative col-span-1 md:col-span-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                        type="text"
                        placeholder="搜索经文内容..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                    />
                </div>
                <select
                    value={versionFilter}
                    onChange={(e) => setVersionFilter(e.target.value)}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">所有版本</option>
                    {versions.map(v => (
                        <option key={v.code} value={v.code}>{v.name}</option>
                    ))}
                </select>
                <select
                    value={bookFilter}
                    onChange={(e) => { setBookFilter(e.target.value); setChapterFilter(''); }}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                    <option value="">所有书卷</option>
                    {books.map(b => (
                        <option key={b.code} value={b.code}>{b.full_name}</option>
                    ))}
                </select>
                <select
                    value={chapterFilter}
                    onChange={(e) => setChapterFilter(e.target.value ? parseInt(e.target.value) : '')}
                    disabled={!bookFilter}
                    className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
                >
                    <option value="">所有章节</option>
                    {bookFilter && Array.from({ length: books.find(b => b.code === bookFilter)?.chapter_count || 0 }, (_, i) => i + 1).map(c => (
                        <option key={c} value={c}>第 {c} 章</option>
                    ))}
                </select>
            </div>

            {/* Table */}
            <div className="bg-white shadow-sm border border-gray-100 rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="bg-gray-50 border-b border-gray-100 text-gray-500 uppercase">
                            <tr>
                                <th className="px-6 py-4 font-semibold">版本</th>
                                <th className="px-6 py-4 font-semibold">卷别</th>
                                <th className="px-6 py-4 font-semibold">章:节</th>
                                <th className="px-6 py-4 font-semibold w-full">内容</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 text-gray-700">
                            {loading && verses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-500">
                                        加载中...
                                    </td>
                                </tr>
                            ) : verses.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="py-12 text-center text-gray-500">
                                        没有找到匹配的经文
                                    </td>
                                </tr>
                            ) : (
                                verses.map((verse) => (
                                    <tr key={verse.id} className="hover:bg-blue-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2 py-1 rounded bg-gray-100 text-xs font-medium text-gray-800 uppercase">
                                                {verse.version}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium uppercase">{verse.book}</td>
                                        <td className="px-6 py-4 font-mono text-xs font-semibold text-blue-600">
                                            {verse.chapter}:{verse.verse_num}
                                        </td>
                                        <td className="px-6 py-4 whitespace-normal min-w-[300px]">
                                            <p className="line-clamp-2 text-gray-600">{verse.text}</p>
                                        </td>
                                        <td className="px-6 py-4 text-right">
                                            <div className="flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => { setCurrentVerse(verse); setIsEditModalOpen(true); }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-100 rounded transition"
                                                    title="编辑"
                                                >
                                                    <Edit size={16} />
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteVerse(verse.id)}
                                                    className="p-1.5 text-red-600 hover:bg-red-100 rounded transition"
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
                {/* Pagination */}
                <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <span className="text-sm text-gray-500">
                        共 <span className="font-semibold text-gray-900">{total}</span> 条经文
                    </span>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            disabled={page === 0}
                            className="px-3 py-1 text-sm border bg-white rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            上一页
                        </button>
                        <span className="text-sm text-gray-600 px-2">第 {page + 1} 页</span>
                        <button
                            onClick={() => setPage(p => p + 1)}
                            disabled={(page + 1) * limit >= total}
                            className="px-3 py-1 text-sm border bg-white rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            下一页
                        </button>
                    </div>
                </div>
            </div>

            {/* Edit / Create Modal */}
            {isEditModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-bold text-gray-900">
                                {currentVerse.id ? '编辑经文' : '新增经文'}
                            </h3>
                            <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSaveVerse} className="p-6 space-y-4 text-sm">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">版本代码</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentVerse.version || ''}
                                        onChange={e => setCurrentVerse({ ...currentVerse, version: e.target.value })}
                                        placeholder="例: cuv"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">卷名缩写</label>
                                    <input
                                        type="text"
                                        required
                                        value={currentVerse.book || ''}
                                        onChange={e => setCurrentVerse({ ...currentVerse, book: e.target.value })}
                                        placeholder="例: gen"
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">章号</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={currentVerse.chapter || ''}
                                        onChange={e => setCurrentVerse({ ...currentVerse, chapter: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">节号</label>
                                    <input
                                        type="number"
                                        required
                                        min="1"
                                        value={currentVerse.verse_num || ''}
                                        onChange={e => setCurrentVerse({ ...currentVerse, verse_num: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block font-medium text-gray-700 mb-1">经文内容</label>
                                <textarea
                                    required
                                    value={currentVerse.text || ''}
                                    onChange={e => setCurrentVerse({ ...currentVerse, text: e.target.value })}
                                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    rows={4}
                                />
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

            {/* Bulk Import Modal */}
            {isImportModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="flex justify-between items-center px-6 py-4 border-b border-gray-100 shrink-0">
                            <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                                <Upload size={20} className="text-purple-600" />
                                批量导入经文数据
                            </h3>
                            <button onClick={() => setIsImportModalOpen(false)} className="text-gray-400 hover:text-gray-900">
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-sm bg-gray-50/50">
                            {importError && (
                                <div className="p-3 bg-red-50 text-red-600 border border-red-100 rounded-lg">
                                    {importError}
                                </div>
                            )}
                            <div className="bg-blue-50 p-4 rounded-lg border border-blue-100 text-blue-800">
                                <p className="font-semibold mb-1">要求的数据格式 (JSON):</p>
                                <pre className="text-xs opacity-80 overflow-x-auto bg-blue-900/5 p-2 rounded mt-2">
                                    {`{
  "gen": {        // 卷缩写
    "1": [        // 章号
      { "verse": 1, "text": "起初，神..." }
    ]
  }
}`}
                                </pre>
                            </div>
                            <form id="importForm" onSubmit={handleBulkImport} className="space-y-4">
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">目标版本标识</label>
                                    <select
                                        value={importVersion}
                                        onChange={(e) => setImportVersion(e.target.value)}
                                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                    >
                                        {versions.map(v => (
                                            <option key={v.code} value={v.code}>{v.name} ({v.code.toUpperCase()})</option>
                                        ))}
                                    </select>
                                    <p className="text-xs text-gray-500 mt-1">若库中存在相同版本和章节的记录，原文本将被更新。</p>
                                </div>
                                <div>
                                    <label className="block font-medium text-gray-700 mb-1">粘贴 JSON 内容</label>
                                    <textarea
                                        required
                                        value={importData}
                                        onChange={e => setImportData(e.target.value)}
                                        className="w-full px-3 py-2 border bg-white rounded-lg focus:ring-2 focus:ring-purple-500 outline-none font-mono text-xs"
                                        rows={12}
                                    />
                                </div>
                            </form>
                        </div>
                        <div className="flex justify-end gap-3 p-4 border-t border-gray-100 bg-white shrink-0">
                            <button
                                type="button"
                                onClick={() => setIsImportModalOpen(false)}
                                className="px-4 py-2 text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition"
                            >
                                取消
                            </button>
                            <button
                                type="submit"
                                form="importForm"
                                disabled={isSubmitting || !importData.trim()}
                                className="px-5 py-2 text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition disabled:opacity-50 flex items-center gap-2"
                            >
                                {isSubmitting ? <RefreshCw size={16} className="animate-spin" /> : <Upload size={16} />}
                                {isSubmitting ? '正在解析导入...' : '开始导入'}
                            </button>
                        </div>
                    </div>
                </div >
            )}
        </div >
    );
};

export default Verses;
