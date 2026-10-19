import React, { useEffect, useState } from 'react';
import { spiritualApi, SpiritualStage, SpiritualQuestion } from '../api/spiritual';
import { 
    RefreshCw, Plus, Edit2, Trash2, ChevronDown, ChevronRight, 
    GripVertical, Info, Layout, BookOpen
} from 'lucide-react';

const Spiritual: React.FC = () => {
    const [stages, setStages] = useState<SpiritualStage[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedStages, setExpandedStages] = useState<number[]>([]);
    
    // Modals
    const [showStageModal, setShowStageModal] = useState(false);
    const [editingStage, setEditingStage] = useState<Partial<SpiritualStage> | null>(null);
    
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [editingQuestion, setEditingQuestion] = useState<Partial<SpiritualQuestion> | null>(null);
    const [targetStageId, setTargetStageId] = useState<number | null>(null);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        setLoading(true);
        try {
            const res = await spiritualApi.getStages();
            setStages(res.data);
            // Default expand all
            if (expandedStages.length === 0) {
                setExpandedStages(res.data.map(s => s.id));
            }
        } catch (err) {
            console.error(err);
            alert('加载数据失败');
        } finally {
            setLoading(false);
        }
    };

    const toggleStage = (id: number) => {
        setExpandedStages(prev => 
            prev.includes(id) ? prev.filter(sid => sid !== id) : [...prev, id]
        );
    };

    // Stage Actions
    const handleSaveStage = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingStage?.id) {
                await spiritualApi.updateStage(editingStage.id, editingStage);
            } else {
                await spiritualApi.createStage(editingStage);
            }
            setShowStageModal(false);
            setEditingStage(null);
            fetchData();
        } catch (err) {
            alert('保存阶段失败');
        }
    };

    const handleDeleteStage = async (id: number) => {
        if (!window.confirm('确认删除该阶段及其所有关联问题吗？')) return;
        try {
            await spiritualApi.deleteStage(id);
            fetchData();
        } catch (err) {
            alert('删除失败');
        }
    };

    // Question Actions
    const handleSaveQuestion = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingQuestion?.id) {
                await spiritualApi.updateQuestion(editingQuestion.id, editingQuestion);
            } else {
                await spiritualApi.createQuestion({ ...editingQuestion, stage_id: targetStageId });
            }
            setShowQuestionModal(false);
            setEditingQuestion(null);
            fetchData();
        } catch (err) {
            alert('保存问题失败');
        }
    };

    const handleDeleteQuestion = async (id: number) => {
        if (!window.confirm('确认删除该问题吗？')) return;
        try {
            await spiritualApi.deleteQuestion(id);
            fetchData();
        } catch (err) {
            alert('删除失败');
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 pb-6 border-b border-gray-200">
                <div>
                    <h2 className="text-2xl font-bold text-gray-900 tracking-tight">属灵阶段与问题管理</h2>
                    <p className="mt-1 text-sm text-gray-500">配置不同属灵生命阶段的评估问题，用于个性化读经与AI对话策略。</p>
                </div>
                <div className="flex gap-3">
                    <button
                        onClick={fetchData}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                        <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                        刷新
                    </button>
                    <button
                        onClick={() => { setEditingStage({ name: '', description: '', sort_order: 0 }); setShowStageModal(true); }}
                        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                        <Plus size={16} />
                        新增阶段
                    </button>
                </div>
            </div>

            {/* Stages List */}
            <div className="space-y-4">
                {loading && stages.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">加载中...</div>
                ) : stages.length === 0 ? (
                    <div className="text-center py-20 text-gray-500 bg-white rounded-xl border border-dashed border-gray-300">暂无数据，请点击左上角新增</div>
                ) : (
                    stages.map(stage => (
                        <div key={stage.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden group">
                           {/* Stage Header */}
                            <div className="flex items-center p-4 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => toggleStage(stage.id)}>
                                <div className="p-1 text-gray-400 hover:text-gray-600">
                                    {expandedStages.includes(stage.id) ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                </div>
                                <div className="flex-1 ml-2">
                                    <h3 className="text-lg font-bold text-gray-900 flex items-center gap-3">
                                        {stage.name}
                                        <span className="text-xs font-normal bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full border border-blue-100">
                                            排序: {stage.sort_order}
                                        </span>
                                    </h3>
                                    {stage.description && <p className="text-sm text-gray-500 mt-1">{stage.description}</p>}
                                </div>
                                <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                                    <button 
                                        onClick={() => { setEditingStage(stage); setShowStageModal(true); }}
                                        className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button 
                                        onClick={() => handleDeleteStage(stage.id)}
                                        className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* Questions (Expanded) */}
                            {expandedStages.includes(stage.id) && (
                                <div className="border-t border-gray-100 bg-gray-50/30 p-4">
                                    <div className="space-y-2">
                                        {stage.questions.length === 0 ? (
                                            <p className="text-sm text-gray-400 italic py-2">该阶段暂无问题</p>
                                        ) : (
                                            stage.questions.map(q => (
                                                <div key={q.id} className="flex items-center bg-white p-3 rounded-lg border border-gray-100 shadow-xs hover:border-blue-200 transition-colors group/q">
                                                    <GripVertical size={16} className="text-gray-300 mr-2" />
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-sm font-medium text-gray-900">{q.question_text}</span>
                                                            <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                                                                q.category === 'verse_drawer' 
                                                                ? 'bg-purple-50 text-purple-600 border border-purple-100' 
                                                                : 'bg-blue-50 text-blue-600 border border-blue-100'
                                                            }`}>
                                                                {q.category === 'verse_drawer' ? '经文研读' : '通用快捷'}
                                                            </span>
                                                            {!q.is_active && (
                                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded uppercase font-bold">已禁用</span>
                                                            )}
                                                        </div>
                                                        {q.description && (
                                                            <p className="text-xs text-gray-500 mt-0.5 flex items-center gap-1">
                                                                <Info size={10} /> {q.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                    <div className="flex items-center gap-1 opacity-0 group-hover/q:opacity-100 transition-opacity">
                                                        <button 
                                                            onClick={() => { setEditingQuestion(q); setTargetStageId(stage.id); setShowQuestionModal(true); }}
                                                            className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded"
                                                        >
                                                            <Edit2 size={14} />
                                                        </button>
                                                        <button 
                                                            onClick={() => handleDeleteQuestion(q.id)}
                                                            className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                                                        >
                                                            <Trash2 size={14} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                        <button 
                                            onClick={() => { setEditingQuestion({ question_text: '', category: 'general', is_active: true, sort_order: 0 }); setTargetStageId(stage.id); setShowQuestionModal(true); }}
                                            className="w-full py-2 mt-2 flex items-center justify-center gap-2 text-xs font-medium text-blue-600 bg-white border border-dashed border-blue-200 rounded-lg hover:bg-blue-50 transition-colors"
                                        >
                                            <Plus size={14} /> 添加问题
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Stage Modal */}
            {showStageModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">{editingStage?.id ? '编辑属灵阶段' : '新增属灵阶段'}</h3>
                            <button onClick={() => setShowStageModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <form onSubmit={handleSaveStage} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">阶段名称</label>
                                <input 
                                    required
                                    type="text" 
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={editingStage?.name}
                                    onChange={e => setEditingStage({ ...editingStage!, name: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">阶段描述</label>
                                <textarea 
                                    rows={3}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={editingStage?.description}
                                    onChange={e => setEditingStage({ ...editingStage!, description: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">排序 (数字越小越靠前)</label>
                                <input 
                                    type="number" 
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={editingStage?.sort_order}
                                    onChange={e => setEditingStage({ ...editingStage!, sort_order: parseInt(e.target.value) })}
                                />
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowStageModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">取消</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">保存</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Question Modal */}
            {showQuestionModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-200">
                        <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
                            <h3 className="text-lg font-bold text-gray-900">{editingQuestion?.id ? '编辑问题' : '新增问题'}</h3>
                            <button onClick={() => setShowQuestionModal(false)} className="text-gray-400 hover:text-gray-600">×</button>
                        </div>
                        <form onSubmit={handleSaveQuestion} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">问题内容</label>
                                <textarea 
                                    required
                                    rows={2}
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={editingQuestion?.question_text}
                                    onChange={e => setEditingQuestion({ ...editingQuestion!, question_text: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">问题分类</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setEditingQuestion({ ...editingQuestion!, category: 'general' })}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                                            editingQuestion?.category === 'general' 
                                            ? 'bg-blue-50 border-blue-200 text-blue-700 font-bold ring-2 ring-blue-500' 
                                            : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <Layout size={16} /> 首页通用
                                    </button>
                                    <button 
                                        type="button"
                                        onClick={() => setEditingQuestion({ ...editingQuestion!, category: 'verse_drawer' })}
                                        className={`flex items-center justify-center gap-2 p-3 rounded-xl border text-sm transition-all ${
                                            editingQuestion?.category === 'verse_drawer' 
                                            ? 'bg-purple-50 border-purple-200 text-purple-700 font-bold ring-2 ring-purple-500' 
                                            : 'bg-white border-gray-100 text-gray-600 hover:bg-gray-50'
                                        }`}
                                    >
                                        <BookOpen size={16} /> 经文研读
                                    </button>
                                </div>
                                <p className="mt-1 text-[10px] text-gray-400 italic">“首页通用”展示在首页AI建议，“经文研读”展示在选中经文后的AI面板。</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">说明/引导文字 (可选)</label>
                                <input 
                                    type="text" 
                                    className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                    value={editingQuestion?.description}
                                    onChange={e => setEditingQuestion({ ...editingQuestion!, description: e.target.value })}
                                />
                            </div>
                            <div className="flex items-center gap-4">
                                <div className="flex-1">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">排序</label>
                                    <input 
                                        type="number" 
                                        className="w-full px-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                                        value={editingQuestion?.sort_order}
                                        onChange={e => setEditingQuestion({ ...editingQuestion!, sort_order: parseInt(e.target.value) })}
                                    />
                                </div>
                                <div className="flex-1 pt-6">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 rounded text-blue-600 border-gray-300 focus:ring-blue-500"
                                            checked={editingQuestion?.is_active}
                                            onChange={e => setEditingQuestion({ ...editingQuestion!, is_active: e.target.checked })}
                                        />
                                        <span className="text-sm font-medium text-gray-700">启用该问题</span>
                                    </label>
                                </div>
                            </div>
                            <div className="pt-4 flex gap-3">
                                <button type="button" onClick={() => setShowQuestionModal(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-50 rounded-xl hover:bg-gray-100 transition-colors">取消</button>
                                <button type="submit" className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-blue-600 rounded-xl hover:bg-blue-700 shadow-md shadow-blue-200 transition-all">确认</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Spiritual;
