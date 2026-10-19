import api from './axios';

const API_BASE = '/admin/spiritual';

export interface SpiritualQuestion {
    id: number;
    stage_id: number;
    question_text: string;
    category: string; // "general" or "verse_drawer"
    description?: string;
    is_active: boolean;
    sort_order: number;
    created_at: string;
}

export interface SpiritualStage {
    id: number;
    name: string;
    description?: string;
    sort_order: number;
    questions: SpiritualQuestion[];
    created_at: string;
}

export const spiritualApi = {
    // Stages
    getStages: () => api.get<SpiritualStage[]>(`${API_BASE}/stages`),
    createStage: (data: any) => api.post<SpiritualStage>(`${API_BASE}/stages`, data),
    updateStage: (id: number, data: any) => api.put<SpiritualStage>(`${API_BASE}/stages/${id}`, data),
    deleteStage: (id: number) => api.delete(`${API_BASE}/stages/${id}`),

    // Questions
    getQuestions: (stageId?: number) => 
        api.get<SpiritualQuestion[]>(`${API_BASE}/questions${stageId ? `?stage_id=${stageId}` : ''}`),
    createQuestion: (data: any) => api.post<SpiritualQuestion>(`${API_BASE}/questions`, data),
    updateQuestion: (id: number, data: any) => api.put<SpiritualQuestion>(`${API_BASE}/questions/${id}`, data),
    deleteQuestion: (id: number) => api.delete(`${API_BASE}/questions/${id}`),
};
