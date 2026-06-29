import { create } from 'zustand';
import type { InlineDraft } from '../components/TreeInlineInput';

interface DraftState {
	draft: InlineDraft | null;
}

interface DraftActions {
	cancelDraft: () => void;
	setDraft: (draft: InlineDraft | null) => void;
}

export type DraftStore = DraftState & DraftActions;

export const useDraftStore = create<DraftStore>()((set) => ({
	draft: null,

	cancelDraft: () => set({ draft: null }),
	setDraft: (draft) => set({ draft }),
}));
