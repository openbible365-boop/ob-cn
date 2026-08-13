import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';
import {
    Headphones,
    Plus,
    Trash2,
    Edit2,
    Save,
    X,
    AlertCircle,
    Loader2,
    Play,
    Pause,
    Mic,
    RotateCcw,
    Undo
} from 'lucide-react';

interface Version {
    code: string;
    name: string;
}

interface AudioEntry {
    id: number;
    version: string;
    book: string;
    chapter: number;
    voice: string;
    audio_url: string;
    timestamps?: string | null;
}

interface Book {
    code: string;
    full_name: string;
}

const VOICE_OPTIONS = [
    { value: 'female', label: '知性女声', color: 'bg-pink-100 text-pink-700' },
    { value: 'male',   label: '开朗学长', color: 'bg-blue-100 text-blue-700' },
];

const getVoiceConfig = (voice: string) =>
    VOICE_OPTIONS.find(v => v.value === voice) ?? { value: voice, label: voice, color: 'bg-gray-100 text-gray-600' };

const AudioManagement: React.FC = () => {
    const [audios, setAudios] = useState<AudioEntry[]>([]);
    const [versions, setVersions] = useState<Version[]>([]);
    const [books, setBooks] = useState<Book[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [playingAudioId, setPlayingAudioId] = useState<number | null>(null);
    const [audioElement] = useState(new Audio());

    const [filterVersion, setFilterVersion] = useState<string>('');
    const [filterBook, setFilterBook] = useState<string>('');
    const [filterChapter, setFilterChapter] = useState<string>('');
    const [filterVoice, setFilterVoice] = useState<string>('');      // 新增 voice 筛选
    const [filterBooks, setFilterBooks] = useState<Book[]>([]);

    // Form state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [formData, setFormData] = useState({
        version: 'cuv',
        book: '',
        chapter: 1,
        voice: 'female',    // 新增 voice 字段
        audio_url: '',
        timestamps: ''
    });

    // Marker Mode state
    const [isRecording, setIsRecording] = useState(false);
    const [markers, setMarkers] = useState<number[]>([]);
    
    const modalAudioRef = useRef<HTMLAudioElement | null>(null);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (isModalOpen && isRecording && e.code === 'Space') {
                const target = e.target as HTMLElement;
                if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    if (modalAudioRef.current) {
                        const time = parseFloat(modalAudioRef.current.currentTime.toFixed(2));
                        setMarkers(prev => {
                            const newMarkers = [...prev, time].sort((a, b) => a - b);
                            setFormData(f => ({ ...f, timestamps: JSON.stringify(newMarkers) }));
                            return newMarkers;
                        });
                    }
                }
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isModalOpen, isRecording]);

    useEffect(() => {
        fetchInitialData();
        return () => {
            audioElement.pause();
            audioElement.src = '';
        };
    }, []);

    // Filter effect for books
    useEffect(() => {
        if (filterVersion) {
            api.get('/books/', { params: { version: filterVersion } })
                .then(res => {
                    setFilterBooks(res.data || []);
                    setFilterBook('');
                })
                .catch(console.error);
        } else {
            setFilterBooks([]);
            setFilterBook('');
        }
    }, [filterVersion]);

    // Form effect for books
    useEffect(() => {
        if (formData.version) {
            fetchBooksForForm(formData.version);
        }
    }, [formData.version]);

    const fetchBooksForForm = async (version: string) => {
        try {
            const res = await api.get('/books/', { params: { version } });
            setBooks(res.data || []);
            if (res.data && res.data.length > 0 && !editingId) {
                const currentBookExists = res.data.some((b: Book) => b.code === formData.book);
                if (!currentBookExists) {
                    setFormData(prev => ({ ...prev, book: res.data[0].code }));
                }
            }
        } catch (err) {
            console.error('Failed to fetch form books', err);
        }
    };

    const fetchAudios = async () => {
        try {
            setLoading(true);
            const params: any = {};
            if (filterVersion) params.version = filterVersion;
            if (filterBook)    params.book    = filterBook;
            if (filterChapter) params.chapter = parseInt(filterChapter);
            if (filterVoice)   params.voice   = filterVoice;   // 传入 voice 筛选

            const audioRes = await api.get('/audio/', { params });
            setAudios(Array.isArray(audioRes.data) ? audioRes.data : []);
        } catch (err: any) {
            setError('获取音频数据失败');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Re-fetch audios when filters change
    useEffect(() => {
        fetchAudios();
    }, [filterVersion, filterBook, filterChapter, filterVoice]);

    const fetchInitialData = async () => {
        try {
            const [versionsRes] = await Promise.all([
                api.get('/versions/')
            ]);
            setVersions(versionsRes.data || []);
            
            if (versionsRes.data && versionsRes.data.length > 0) {
                setFormData(prev => ({ ...prev, version: versionsRes.data[0].code }));
            }
        } catch (err: any) {
            setError('获取数据失败，请确认您已登录且后端工作正常');
            console.error(err);
        }
    };

    const handleCreateOrUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            setLoading(true);
            await api.post('/audio/', formData);
            await fetchAudios();
            setIsModalOpen(false);
            setEditingId(null);
            setFormData({ ...formData, audio_url: '', chapter: formData.chapter + 1, timestamps: '' });
        } catch (err: any) {
            setError(err.response?.data?.detail || '保存失败，请检查输入格式');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (id: number) => {
        if (!window.confirm('确定要删除这条音频记录吗？')) return;
        try {
            await api.delete(`/audio/${id}`);
            setAudios(audios.filter(a => a.id !== id));
            if (playingAudioId === id) {
                audioElement.pause();
                setPlayingAudioId(null);
            }
        } catch (err) {
            setError('删除失败');
        }
    };

    const togglePlay = (audio: AudioEntry) => {
        if (playingAudioId === audio.id) {
            audioElement.pause();
            setPlayingAudioId(null);
        } else {
            audioElement.src = audio.audio_url;
            audioElement.play().catch(err => {
                console.error('Playback failed', err);
                setError('播放失败，请检查链接是否有效');
            });
            setPlayingAudioId(audio.id);

            audioElement.onended = () => {
                setPlayingAudioId(null);
            };
        }
    };


    const openEditModal = (audio: AudioEntry) => {
        setFormData({
            version: audio.version,
            book: audio.book,
            chapter: audio.chapter,
            voice: audio.voice || 'female',
            audio_url: audio.audio_url,
            timestamps: audio.timestamps || ''
        });
        setEditingId(audio.id);
        setMarkers(audio.timestamps ? JSON.parse(audio.timestamps) : []);
        setIsModalOpen(true);
    };

    const handleUndoMarker = () => {
        setMarkers(prev => {
            const newMarkers = prev.slice(0, -1);
            setFormData(f => ({ ...f, timestamps: JSON.stringify(newMarkers) }));
            return newMarkers;
        });
    };

    const handleResetMarkers = () => {
        if (window.confirm('确定要重置所有标记点吗？')) {
            setMarkers([]);
            setFormData(f => ({ ...f, timestamps: '[]' }));
        }
    };

    return (
        <div className="p-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Headphones className="w-8 h-8 text-indigo-600" />
                        音频管理
                    </h1>
                    <p className="text-gray-500 mt-1">管理各章节对应的音频链接</p>
                </div>
                <button
                    onClick={() => {
                        setEditingId(null);
                        setIsModalOpen(true);
                    }}
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    新增音频
                </button>
            </div>

            {/* Filter Bar */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-end">
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">筛选版本</label>
                    <select
                        value={filterVersion}
                        onChange={(e) => setFilterVersion(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="">所有版本</option>
                        {versions.map(v => (
                            <option key={v.code} value={v.code}>{v.name} ({v.code})</option>
                        ))}
                    </select>
                </div>
                <div className="flex-1 min-w-[160px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">筛选书卷</label>
                    <select
                        value={filterBook}
                        onChange={(e) => setFilterBook(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="">所有书卷</option>
                        {filterBooks.map(b => (
                            <option key={b.code} value={b.code}>
                                {b.full_name} ({b.code.toUpperCase()})
                            </option>
                        ))}
                    </select>
                </div>
                {/* 声音筛选 */}
                <div className="flex-[0.6] min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">筛选声音</label>
                    <select
                        value={filterVoice}
                        onChange={(e) => setFilterVoice(e.target.value)}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    >
                        <option value="">全部声音</option>
                        {VOICE_OPTIONS.map(v => (
                            <option key={v.value} value={v.value}>{v.label}</option>
                        ))}
                    </select>
                </div>
                <div className="flex-[0.4] min-w-[100px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">筛选章节</label>
                    <input
                        type="number"
                        min="1"
                        value={filterChapter}
                        onChange={(e) => setFilterChapter(e.target.value)}
                        placeholder="不限"
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                    />
                </div>
                <div>
                    <button
                        onClick={() => {
                            setFilterVersion('');
                            setFilterBook('');
                            setFilterChapter('');
                            setFilterVoice('');
                        }}
                        className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        title="清除筛选项"
                    >
                        <RotateCcw className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {error && (
                <div className="mb-6 bg-red-50 border-l-4 border-red-400 p-4 flex items-center gap-3 text-red-700">
                    <AlertCircle className="w-5 h-5" />
                    <p>{error}</p>
                    <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>
            )}

            {loading && audios.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <Loader2 className="w-12 h-12 animate-spin text-indigo-400 mb-4" />
                    <p>载入音频数据中...</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 text-gray-600 text-sm uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4 font-semibold">版本</th>
                                <th className="px-6 py-4 font-semibold">书卷</th>
                                <th className="px-6 py-4 font-semibold">章节</th>
                                <th className="px-6 py-4 font-semibold">声音</th>
                                <th className="px-6 py-4 font-semibold">试听</th>
                                <th className="px-6 py-4 font-semibold">音频链接</th>
                                <th className="px-6 py-4 font-semibold text-right">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 italic">
                            {audios.map((audio) => {
                                const vc = getVoiceConfig(audio.voice);
                                return (
                                    <tr key={audio.id} className="hover:bg-gray-50 transition-colors not-italic">
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 uppercase">
                                                {audio.version}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 font-medium text-gray-900 uppercase">
                                            {books.find(b => b.code === audio.book)?.full_name || audio.book}
                                        </td>
                                        <td className="px-6 py-4 text-gray-600">第 {audio.chapter} 章</td>
                                        {/* 声音列 */}
                                        <td className="px-6 py-4">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${vc.color}`}>
                                                <Mic className="w-3 h-3" />
                                                {vc.label}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <button
                                                onClick={() => togglePlay(audio)}
                                                className={`p-2 rounded-full transition-colors ${playingAudioId === audio.id
                                                    ? 'bg-red-100 text-red-600 hover:bg-red-200'
                                                    : 'bg-green-100 text-green-600 hover:bg-green-200'
                                                    }`}
                                                title={playingAudioId === audio.id ? '暂停' : '播放试听'}
                                            >
                                                {playingAudioId === audio.id ? (
                                                    <Pause className="w-4 h-4" />
                                                ) : (
                                                    <Play className="w-4 h-4" />
                                                )}
                                            </button>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500 truncate max-w-xs">{audio.audio_url}</td>
                                        <td className="px-6 py-4 text-right space-x-3">
                                            <button
                                                onClick={() => openEditModal(audio)}
                                                className="text-indigo-600 hover:text-indigo-900 bg-indigo-50 p-2 rounded-lg transition-colors"
                                                title="编辑"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(audio.id)}
                                                className="text-red-600 hover:text-red-900 bg-red-50 p-2 rounded-lg transition-colors"
                                                title="删除"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                );
                            })}

                            {audios.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                                        暂无音频记录，点击上方按钮新增。
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setIsModalOpen(false)} />
                    <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-xl font-bold text-gray-900">
                                {editingId ? '编辑音频' : '新增音频'}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleCreateOrUpdate} className="p-6 space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">版本</label>
                                    <select
                                        value={formData.version}
                                        onChange={(e) => setFormData({ ...formData, version: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        disabled={!!editingId}
                                    >
                                        {versions.map(v => (
                                            <option key={v.code} value={v.code}>{v.name} ({v.code})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">章节</label>
                                    <input
                                        type="number"
                                        value={formData.chapter}
                                        onChange={(e) => setFormData({ ...formData, chapter: parseInt(e.target.value) })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        min="1"
                                        required
                                        disabled={!!editingId}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">书卷</label>
                                    <select
                                        value={formData.book}
                                        onChange={(e) => setFormData({ ...formData, book: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        required
                                        disabled={!!editingId}
                                    >
                                        <option value="">选择书卷...</option>
                                        {books.map(b => (
                                            <option key={b.code} value={b.code}>
                                                {b.full_name} ({b.code.toUpperCase()})
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {/* 声音选择字段 */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">声音</label>
                                    <select
                                        value={formData.voice}
                                        onChange={(e) => setFormData({ ...formData, voice: e.target.value })}
                                        className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                        disabled={!!editingId}
                                    >
                                        {VOICE_OPTIONS.map(v => (
                                            <option key={v.value} value={v.value}>{v.label}</option>
                                        ))}
                                    </select>
                                    <p className="mt-1 text-xs text-gray-400">
                                        同一章节可同时存在多种声音
                                    </p>
                                </div>
                            </div>


                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">音频 URL</label>
                                <input
                                    type="url"
                                    value={formData.audio_url}
                                    onChange={(e) => setFormData({ ...formData, audio_url: e.target.value })}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                                    placeholder="https://example.com/audio.mp3"
                                    required
                                />
                            </div>

                            <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <Mic className="w-4 h-4 text-indigo-600" />
                                    交互式打点记录
                                </label>

                                <div className="space-y-3">
                                    <audio
                                        ref={modalAudioRef}
                                        src={formData.audio_url}
                                        controls
                                        className="w-full h-10"
                                    />

                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setIsRecording(!isRecording)}
                                            className={`flex-1 py-2 px-3 rounded-lg text-sm font-medium flex items-center justify-center gap-2 transition-all ${isRecording
                                                    ? 'bg-red-500 text-white shadow-inner pulse'
                                                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                                                }`}
                                        >
                                            {isRecording ? (
                                                <><Pause className="w-4 h-4" /> 停止记录 (已录入 {markers.length} 个点)</>
                                            ) : (
                                                <><Play className="w-4 h-4" /> 开始打点 (按下空格键标记)</>
                                            )}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleUndoMarker}
                                            disabled={markers.length === 0}
                                            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                            title="撤销上一个点"
                                        >
                                            <Undo className="w-4 h-4" />
                                        </button>

                                        <button
                                            type="button"
                                            onClick={handleResetMarkers}
                                            disabled={markers.length === 0}
                                            className="p-2 border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50 disabled:opacity-50"
                                            title="重置所有点"
                                        >
                                            <RotateCcw className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {markers.length > 0 && (
                                        <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto p-2 bg-white rounded border border-gray-100">
                                            {markers.map((m, i) => (
                                                <span key={i} className="text-[10px] bg-indigo-50 text-indigo-600 px-1.5 py-0.5 rounded border border-indigo-100">
                                                    {m}s
                                                </span>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">时间轴 (JSON 结果)</label>
                                <textarea
                                    value={formData.timestamps || ''}
                                    onChange={(e) => {
                                        setFormData({ ...formData, timestamps: e.target.value });
                                        try {
                                            const parsed = JSON.parse(e.target.value);
                                            if (Array.isArray(parsed)) setMarkers(parsed);
                                        } catch (e) { }
                                    }}
                                    className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:outline-none min-h-[80px] font-mono text-xs"
                                    placeholder="[0, 5.2, 12.5, ...]"
                                />
                                <p className="mt-1 text-xs text-gray-500">提示：您可以手动修改 JSON，也可以使用上方的录音键按【空格】自动生成。</p>
                            </div>

                            <div className="pt-4 flex gap-3">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    取消
                                </button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="flex-1 px-4 py-2 text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
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

export default AudioManagement;
