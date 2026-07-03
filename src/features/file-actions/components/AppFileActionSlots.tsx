import type { ReactNode } from 'react';
import type { OpenFile } from '../../../shared/types/files';
import type { MarkdownAction } from '../../preview/markdownActions';
import { FileActionBar } from './FileActionBar';
import { FileActionControls, type FileViewMode } from './FileActionControls';
import { MarkdownFormatToolbar } from './MarkdownFormatToolbar';

interface AppFileActionSlotsOptions {
	openFile: OpenFile | null;
	dirty: boolean;
	findOpen: boolean;
	merged: boolean;
	mode: FileViewMode;
	saving: boolean;
	onModeChange: (mode: FileViewMode) => void;
	onSave: () => void;
	onToggleFind: () => void;
	onToggleMerged: () => void;
	onFormatAction: (action: MarkdownAction) => void;
}

export function useAppFileActionSlots({
	openFile,
	dirty,
	findOpen,
	merged,
	mode,
	saving,
	onModeChange,
	onSave,
	onToggleFind,
	onToggleMerged,
	onFormatAction,
}: AppFileActionSlotsOptions): {
	fileActionControls: ReactNode;
	previewActionBar: ReactNode;
} {
	const fileActionControls = openFile ? (
		<FileActionControls
			dirty={dirty}
			findOpen={findOpen}
			merged={merged}
			mode={mode}
			saving={saving}
			onModeChange={onModeChange}
			onSave={onSave}
			onToggleFind={onToggleFind}
			onToggleMerged={onToggleMerged}
		/>
	) : null;

	const formatControls =
		openFile?.kind === 'md' && (mode === 'edit' || mode === 'code') ? (
			<MarkdownFormatToolbar onAction={onFormatAction} />
		) : null;

	const previewActionBar =
		openFile && (formatControls || !merged) ? (
			<FileActionBar>
				{formatControls}
				<span className="file-action-spacer" aria-hidden="true" />
				{!merged ? fileActionControls : null}
			</FileActionBar>
		) : null;

	return { fileActionControls, previewActionBar };
}
