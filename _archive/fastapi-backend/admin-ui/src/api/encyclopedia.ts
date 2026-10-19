import api from './axios';

const API_BASE = '/admin/encyclopedia';

export type EntryType = 'dictionary' | 'article' | 'devotional';

export interface EncyclopediaEntry {
    id: string;
    entry_type: EntryType;
    category: string | null;
    index_letter: string | null;
    cover_style: string | null;
    author: string | null;
    sort_order: number;
    is_active: boolean;

    title_zh: string | null;
    title_en: string | null;
    title_ko: string | null;
    summary_zh: string | null;
    summary_en: string | null;
    summary_ko: string | null;
    content_zh: string | null;
    content_en: string | null;
    content_ko: string | null;

    created_at: string;
    updated_at: string;
}

// 列表轻量项：后端不再返回长文 content/summary，编辑时再按 id 拉全量。
export type EncyclopediaListItem = Pick<
    EncyclopediaEntry,
    'id' | 'entry_type' | 'category' | 'index_letter' | 'cover_style' | 'author'
    | 'sort_order' | 'is_active' | 'title_zh' | 'title_en' | 'title_ko'
>;

export interface EncyclopediaPage {
    total: number;
    items: EncyclopediaListItem[];
}

export interface ListParams {
    entryType?: EntryType;
    q?: string;
    letter?: string;
    limit?: number;
    offset?: number;
}

export const encyclopediaApi = {
    getEntries: (params: ListParams = {}) => {
        const sp = new URLSearchParams();
        if (params.entryType) sp.set('entry_type', params.entryType);
        if (params.q) sp.set('q', params.q);
        if (params.letter) sp.set('letter', params.letter);
        sp.set('limit', String(params.limit ?? 50));
        sp.set('offset', String(params.offset ?? 0));
        return api.get<EncyclopediaPage>(`${API_BASE}/entries?${sp.toString()}`);
    },
    getEntry: (id: string) =>
        api.get<EncyclopediaEntry>(`${API_BASE}/entries/${id}`),
    createEntry: (data: Partial<EncyclopediaEntry>) =>
        api.post<EncyclopediaEntry>(`${API_BASE}/entries`, data),
    updateEntry: (id: string, data: Partial<EncyclopediaEntry>) =>
        api.put<EncyclopediaEntry>(`${API_BASE}/entries/${id}`, data),
    deleteEntry: (id: string) =>
        api.delete(`${API_BASE}/entries/${id}`),
};
