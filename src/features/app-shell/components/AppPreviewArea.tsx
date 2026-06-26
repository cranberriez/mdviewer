import type { ReactNode, RefObject } from 'react';
import type { OpenFile } from '../../../shared/types/files';
import type { DragSessionState } from '../../dnd/dropTypes';
import { MainDropOverlay } from '../../dnd/MainDropOverlay';
import { FindBar } from '../../file-actions/components/FindBar';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import { FloatingOutlinePanel } from '../../outline/components/FloatingOutlinePanel';
import type { MarkdownAction } from '../../preview/markdownActions';
import { PreviewPanel } from '../../preview/components/PreviewPanel';

interface FindState {
	current: number;
	open: boolean;
	query: string;
	total: number;
	close: () => void;
	goToNext: () => void;
	goToPrevious: () => void;
	setQuery: (query: string) => void;
}

interface AppPreviewAreaProps {
	actionBar: ReactNode;
	dropCount: number;
	dropState: DragSessionState;
	error: string | null;
	find: FindState;
	findTargetRef: RefObject<HTMLElement | null>;
	mode: FileViewMode;
	openFile: OpenFile | null;
	outlinePanelVisible: boolean;
	pendingFormatAction: { action: MarkdownAction; id: number } | null;
	renderedMarkdown: string;
	onContentChange: (content: string) => void;
	onLinkClick: (href: string) => void;
	onSelectHeading: (id: string) => void;
}

export function AppPreviewArea({
	actionBar,
	dropCount,
	dropState,
	error,
	find,
	findTargetRef,
	mode,
	openFile,
	outlinePanelVisible,
	pendingFormatAction,
	renderedMarkdown,
	onContentChange,
	onLinkClick,
	onSelectHeading,
}: AppPreviewAreaProps) {
	return (
		<PreviewPanel
			outlinePanel={
				outlinePanelVisible ? (
					<FloatingOutlinePanel
						renderedHtml={openFile?.kind === 'md' ? renderedMarkdown : null}
						hasOpenFile={Boolean(openFile)}
						onSelectHeading={onSelectHeading}
					/>
				) : null
			}
			dropOverlay={
				<MainDropOverlay target={dropState.target} hint={dropState.renderHint} count={dropCount} />
			}
			actionBar={actionBar}
			error={error}
			findBar={
				openFile ? (
					<FindBar
						current={find.current}
						open={find.open}
						query={find.query}
						total={find.total}
						onClose={find.close}
						onNext={find.goToNext}
						onPrevious={find.goToPrevious}
						onQueryChange={find.setQuery}
					/>
				) : null
			}
			findTargetRef={findTargetRef}
			mode={mode}
			openFile={openFile}
			onContentChange={onContentChange}
			onLinkClick={onLinkClick}
			pendingFormatAction={pendingFormatAction}
			renderedMarkdown={renderedMarkdown}
		/>
	);
}
