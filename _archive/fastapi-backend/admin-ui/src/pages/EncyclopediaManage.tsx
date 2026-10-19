import React, { useEffect, useState } from 'react';
import { encyclopediaApi, EncyclopediaEntry, EncyclopediaListItem, EntryType } from '../api/encyclopedia';
import { RefreshCw, Edit2, Trash2, Plus, X, BookA, Newspaper, Sun, Info, Search, ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';

type LangTab = 'zh' | 'en' | 'ko';

const PAGE_SIZE = 50;
const LETTERS = ['#', ...'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('')];

const TYPE_TABS: { key: EntryType; label: string; icon: LucideIcon }[] = [
    { key: 'dictionary', label: '词典', icon: BookA },
    { key: 'article', label: '文章', icon: Newspaper },
    { key: 'devotional', label: '灵修', icon: Sun },
];

const LANG_TABS: { key: LangTab; label: string }[] = [
    { key: 'zh', label: '中文' },
    { key: 'en', label: 'English' },
    { key: 'ko', label: '한국어' },
];

const EncyclopediaManage: React.FC = () => {
    const [entries, setEntries] = useState<EncyclopediaListItem[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);            // 0-based
    const [query, setQuery] = useState('');          // 输入框即时值
    const [debouncedQuery, setDebouncedQuery] = useState('');
    const [letter, setLetter] = useState('');        // 词典首字母过滤
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<EntryType>('dictionary');

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingItem, setEditingItem] = useState<Partial<EncyclopediaEntry> | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [loadingEditId, setLoadingEditId] = useState<string | null>(null);
    const [langTab, setLangTab] = useState<LangTab>('zh');
    const [isSaving, setIsSaving] = useState(false);

    // 搜索防抖：输入停顿 300ms 后才真正查询，并回到第一页
    useEffect(() => {
        const t = setTimeout(() => {
            setDebouncedQuery(query.trim());
            setPage(0);
        }, 300);
        return () => clearTimeout(t);
    }, [query]);

    useEffect(() => {
        fetchEntries();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [activeTab, debouncedQuery, letter, page]);

    const fetchEntries = async () => {
        setLoading(true);
        try {
            const res = await encyclopediaApi.getEntries({
                entryType: activeTab,
                q: debouncedQuery || undefined,
                letter: activeTab === 'dictionary' ? (letter || undefined) : undefined,
                limit: PAGE_SIZE,
                offset: page * PAGE_SIZE,
            });
            setEntries(res.data.items);
            setTotal(res.data.total);
        } catch (err) {
            console.error(err);
            alert('获取百科条目列表失败');
        } finally {
            setLoading(false);
        }
    };

    const switchTab = (key: EntryType) => {
        if (key === activeTab) return;
        setActiveTab(key);
        setPage(0);
        setQuery('');
        setDebouncedQuery('');
        setLetter('');
    };

    const handleDelete = async (id: string, title: string) => {
        if (!window.confirm(`确定要删除「${title || id}」吗？操作不可恢复。`)) return;
        try {
            await encyclopediaApi.deleteEntry(id);
            // 删掉当前页最后一条时回退一页，避免停在空页
            if (entries.length === 1 && page > 0) setPage(p => p - 1);
            else fetchEntries();
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
            if (isEditing && editingItem.id) {
                await encyclopediaApi.updateEntry(editingItem.id, editingItem);
            } else {
                await encyclopediaApi.createEntry({ ...editingItem, entry_type: activeTab });
            }
            setIsModalOpen(false);
            setEditingItem(null);
            fetchEntries();
        } catch (err) {
            console.error(err);
            alert('保存失败');
        } finally {
            setIsSaving(false);
        }
    };

    const openCreateModal = () => {
        setLangTab('zh');
        setIsEditing(false);
        setEditingItem({
            entry_type: activeTab,
            category: '',
            index_letter: '',
            cover_style: activeTab === 'dictionary' ? '' : 'linear-gradient(135deg, #667eea, #764ba2)',
            author: '',
            sort_order: 0,
            is_active: true,
            title_zh: '', title_en: '', title_ko: '',
            summary_zh: '', summary_en: '', summary_ko: '',
            content_zh: '', content_en: '', content_ko: '',
        });
        setIsModalOpen(true);
    };

    const openEditModal = async (item: EncyclopediaListItem) => {
        // 列表为轻量数据(无长文)，编辑时按 id 拉取全量内容
        setLoadingEditId(item.id);
        try {
            const res = await encyclopediaApi.getEntry(item.id);
            setLangTab('zh');
            setIsEditing(true);
            setEditingItem(res.data);
            setIsModalOpen(true);
        } catch (err) {
            console.error(err);
            alert('加载条目详情失败');
        } finally {
            setLoadingEditId(null);
        }
    };

    const upd = (field: keyof EncyclopediaEntry, value: any) =>
        setEditingItem(prev => (prev ? { ...prev, [field]: value } : prev));

    const isDict = activeTab === 'dictionary';
    const displayTitle = (it: EncyclopediaListItem) => it.title_zh || it.title_en || it.title_ko || '(无标题)';
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

    return (
        <div className="space-y-6 animate-in fade-in duration-500 relative">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">百科管理</h2>
                    <p className="mt-1 text-sm text-gray-500">管理前台「百科」页面的词典、文章、灵修内容（三语）。影音内容请在「媒体资源」页管理。</p>
                </div>
                <div className="flex items-center gap-3 w-full md:w-auto">
                    <div className="bg-gray-100 p-1 flex rounded-lg shrink-0">
                        {TYPE_TABS.map(tb => {
                            const Icon = tb.icon;
                            return (
                                <button
                                    key={tb.key}
                                    onClick={() => switchTab(tb.key)}
                                    className={`px-4 py-2 flex items-center gap-2 text-sm font-medium rounded-md transition-all ${activeTab === tb.key ? 'bg-white text-blue-700 shadow-sm border border-gray-200/50' : 'text-gray-600 hover:text-gray-900'}`}
                                >
                                    <Icon size={16} /> {tb.label}
                                </button>
                            );
                        })}
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="inline-flex shrink-0 items-center justify-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={16} />
                        新增{TYPE_TABS.find(t => t.key === activeTab)?.label}
                    </button>
                </div>
            </div>

            {/* Toolbar: 搜索 + 词典首字母过滤 */}
            <div className="flex flex-col gap-3">
                <div className="relative w-full md:max-w-sm">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder={isDict ? '搜索词条标题 / 分类…' : '搜索标题 / 分类…'}
                        className="w-full pl-9 pr-9 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                    {query && (
                        <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 p-1">
                            <X size={14} />
                        </button>
                    )}
                </div>
                {isDict && (
                    <div className="flex flex-wrap gap-1">
                        <button
                            onClick={() => { setLetter(''); setPage(0); }}
                            className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${letter === '' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                        >全部</button>
                        {LETTERS.map(L => (
                            <button
                                key={L}
                                onClick={() => { setLetter(L); setPage(0); }}
                                className={`w-7 h-7 text-xs font-medium rounded-md transition-colors ${letter === L ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >{L}</button>
                        ))}
                    </div>
                )}
            </div>

            {/* Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50/50">
                            <tr>
                                {isDict ? (
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">首字母</th>
                                ) : (
                                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">封面</th>
                                )}
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">标题 / 分类</th>
                                {!isDict && <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">作者</th>}
                                <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider hidden md:table-cell">状态</th>
                                <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">操作</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                                        <RefreshCw size={24} className="animate-spin mx-auto text-blue-500 mb-2" />
                                        加载中...
                                    </td>
                                </tr>
                            ) : entries.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">该分类下暂无内容</td>
                                </tr>
                            ) : (
                                entries.map(item => (
                                    <tr key={item.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap text-center">
                                            {isDict ? (
                                                <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-blue-50 text-blue-700 font-bold">{item.index_letter || '#'}</span>
                                            ) : (
                                                <div className="w-12 h-9 rounded shrink-0 shadow-sm border border-black/5 flex items-center justify-center text-white" style={{ background: item.cover_style && !item.cover_style.startsWith('fa-') ? item.cover_style : '#e2e8f0' }}>
                                                    {item.cover_style && item.cover_style.startsWith('fa-') ? <i className={`fa-solid ${item.cover_style}`}></i> : null}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm font-medium text-gray-900">{displayTitle(item)}</div>
                                            <div className="text-xs text-gray-500 mt-1">
                                                {item.category && <span className="bg-gray-100 px-2 py-0.5 rounded text-gray-600">{item.category}</span>}
                                            </div>
                                        </td>
                                        {!isDict && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{item.author || '-'}</td>
                                        )}
                                        <td className="px-6 py-4 whitespace-nowrap hidden md:table-cell">
                                            <span className={`text-xs px-2 py-1 rounded-full ${item.is_active ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {item.is_active ? '已上架' : '已隐藏'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                            <button onClick={() => openEditModal(item)} disabled={loadingEditId === item.id} className="text-blue-600 hover:text-blue-900 transition-colors p-2 rounded-lg hover:bg-blue-50 inline-flex items-center justify-center outline-none mr-2 disabled:opacity-50">
                                                {loadingEditId === item.id ? <RefreshCw size={18} className="animate-spin" /> : <Edit2 size={18} />}
                                            </button>
                                            <button onClick={() => handleDelete(item.id, displayTitle(item))} className="text-red-500 hover:text-red-700 transition-colors p-2 rounded-lg hover:bg-red-50 inline-flex items-center justify-center outline-none">
                                                <Trash2 size={18} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Pagination */}
                {total > 0 && (
                    <div className="flex items-center justify-between px-6 py-3 border-t border-gray-100 bg-gray-50/40">
                        <span className="text-sm text-gray-500">
                            共 <span className="font-medium text-gray-700">{total}</span> 条
                            {totalPages > 1 && <> · 第 {page + 1}/{totalPages} 页</>}
                        </span>
                        {totalPages > 1 && (
                            <div className="flex items-center gap-1">
                                <button
                                    onClick={() => setPage(p => Math.max(0, p - 1))}
                                    disabled={page === 0 || loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    <ChevronLeft size={16} /> 上一页
                                </button>
                                <button
                                    onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                                    disabled={page >= totalPages - 1 || loading}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                                >
                                    下一页 <ChevronRight size={16} />
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Modal */}
            {isModalOpen && editingItem && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl overflow-hidden animate-in zoom-in-95 duration-200 my-8">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {isEditing ? '编辑' : '新增'} {TYPE_TABS.find(t => t.key === activeTab)?.label}
                            </h3>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 p-1 rounded-md hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 max-h-[70vh] overflow-y-auto">
                            {/* Common fields */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-5">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">分类 / 标签</label>
                                    <input type="text" placeholder={isDict ? '例: 神学词汇、圣经人物' : '例: 信仰生活、晨更灵修'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editingItem.category || ''} onChange={(e) => upd('category', e.target.value)} />
                                </div>
                                {isDict ? (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">首字母索引</label>
                                        <input type="text" maxLength={2} placeholder="留空将自动按拼音首字母归类" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editingItem.index_letter || ''} onChange={(e) => upd('index_letter', e.target.value.toUpperCase())} />
                                        <p className="text-xs text-gray-500 mt-1">留空时后端会根据中文标题自动取拼音首字母（如「恩典」→ E）。</p>
                                    </div>
                                ) : (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">作者署名</label>
                                        <input type="text" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={editingItem.author || ''} onChange={(e) => upd('author', e.target.value)} />
                                    </div>
                                )}
                                {!isDict && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">封面样式</label>
                                        <input type="text" placeholder="CSS 背景 / 图片 URL / fa-图标类名" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none font-mono text-sm"
                                            value={editingItem.cover_style || ''} onChange={(e) => upd('cover_style', e.target.value)} />
                                        <p className="text-xs text-gray-500 mt-1">可填 linear-gradient(...)、图片 URL，或 Font Awesome 类名如 fa-sun。</p>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">排序值</label>
                                    <input type="number" className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={editingItem.sort_order ?? 0} onChange={(e) => upd('sort_order', parseInt(e.target.value) || 0)} />
                                </div>
                                <div className="flex items-center gap-2 pt-7">
                                    <input id="enc-active" type="checkbox" className="w-4 h-4" checked={editingItem.is_active ?? true} onChange={(e) => upd('is_active', e.target.checked)} />
                                    <label htmlFor="enc-active" className="text-sm font-medium text-gray-700">前台显示（上架）</label>
                                </div>
                            </div>

                            {/* Language tabs for multilingual content */}
                            <div className="border-t border-gray-100 pt-4">
                                <div className="bg-gray-100 p-1 inline-flex rounded-lg mb-4">
                                    {LANG_TABS.map(l => (
                                        <button key={l.key} type="button" onClick={() => setLangTab(l.key)}
                                            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${langTab === l.key ? 'bg-white text-blue-700 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}>
                                            {l.label}
                                        </button>
                                    ))}
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            标题（{LANG_TABS.find(l => l.key === langTab)?.label}）{langTab === 'zh' && <span className="text-red-500">*</span>}
                                        </label>
                                        <input type="text" required={langTab === 'zh'} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                            value={(editingItem as any)[`title_${langTab}`] || ''} onChange={(e) => upd(`title_${langTab}` as keyof EncyclopediaEntry, e.target.value)} />
                                    </div>
                                    {!isDict && (
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">摘要（{LANG_TABS.find(l => l.key === langTab)?.label}）</label>
                                            <textarea rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                                value={(editingItem as any)[`summary_${langTab}`] || ''} onChange={(e) => upd(`summary_${langTab}` as keyof EncyclopediaEntry, e.target.value)} />
                                        </div>
                                    )}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            {isDict ? '释义' : '正文'}（{LANG_TABS.find(l => l.key === langTab)?.label}）
                                        </label>
                                        <textarea rows={isDict ? 4 : 9} className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none leading-relaxed"
                                            placeholder={isDict ? '词条释义…' : '正文，段落之间空一行（\\n\\n）将自动分段。'}
                                            value={(editingItem as any)[`content_${langTab}`] || ''} onChange={(e) => upd(`content_${langTab}` as keyof EncyclopediaEntry, e.target.value)} />
                                    </div>
                                </div>

                                <div className="flex items-start gap-2 mt-3 text-xs text-gray-500 bg-blue-50/60 rounded-lg p-3">
                                    <Info size={14} className="mt-0.5 shrink-0 text-blue-500" />
                                    <span>三语内容请分别切换上方语言页签填写。前台未提供对应语言时会回退到中文。</span>
                                </div>
                            </div>

                            <div className="pt-6 mt-2 flex justify-end gap-3 border-t border-gray-100">
                                <button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50">
                                    取消
                                </button>
                                <button type="submit" disabled={isSaving} className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 inline-flex items-center gap-2">
                                    {isSaving ? <RefreshCw size={16} className="animate-spin" /> : null}
                                    保存
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default EncyclopediaManage;
