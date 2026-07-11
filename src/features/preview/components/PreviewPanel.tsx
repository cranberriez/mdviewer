import {
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
	type ReactNode,
	type RefObject,
} from 'react';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { OpenFile } from '../../../shared/types/files';
import { parentPath } from '../../../shared/utils/path';
import { Notice } from '../../../shared/ui/components/Notice';
import type { MarkdownAction } from '../markdownActions';
import { useCodeEditorToolbar } from '../hooks/useCodeEditorToolbar';
import { useScrollSync } from '../hooks/useScrollSync';
import { EmptyPreview } from './EmptyPreview';
import { MarkdownPreview } from './MarkdownPreview';
import { PlainTextPreview } from './PlainTextPreview';
import { LexicalMarkdownEditor, type LexicalMarkdownEditorHandle } from './LexicalMarkdownEditor';
import { splitYamlFrontmatter } from '../markdownDocument';

interface PreviewPanelProps {
	/** Floating outline overlay, rendered into the content area's left gutter. */
	outlinePanel: ReactNode;
	/** Drag-and-drop overlay shown over the whole content area while dragging. */
	dropOverlay: ReactNode;
	actionBar: ReactNode;
	error: string | null;
	findBar: ReactNode;
	findTargetRef: RefObject<HTMLElement | null>;
	mode: FileViewMode;
	openFile: OpenFile | null;
	onContentChange: (content: string) => void;
	onLinkClick: (href: string) => void;
	pendingFormatAction: { action: MarkdownAction; id: number } | null;
	renderedMarkdown: string;
}

/**
 * Minimum content-area width (px) at which the floating outline can be shown
 */
const OUTLINE_MIN_CONTENT_WIDTH = 720;

export function PreviewPanel({
	outlinePanel,
	dropOverlay,
	actionBar,
	error,
	findBar,
	findTargetRef,
	mode,
	openFile,
	onContentChange,
	onLinkClick,
	pendingFormatAction,
	renderedMarkdown,
}: PreviewPanelProps) {
	const frontmatter = openFile?.kind === 'md' ? splitYamlFrontmatter(openFile.content) : null;
	const contentRef = useRef<HTMLElement | null>(null);
	const editorScrollRef = useRef<HTMLTextAreaElement | null>(null);
	const visualEditorRootRef = useRef<HTMLDivElement | null>(null);
	const visualEditorRef = useRef<LexicalMarkdownEditorHandle | null>(null);
	const {
		handleEditorScroll,
		handlePreviewScroll,
		previewScrollRef,
		rememberEditorScrollPosition,
		setPreviewScrollRef,
	} = useScrollSync({
		editorScrollRef,
		mode,
		openFile,
		renderedMarkdown,
		visualEditorRootRef,
	});
	const { handleEditorContentChange, handleEditorKeyDown, rememberTextareaSelection } =
		useCodeEditorToolbar({
			editorScrollRef,
			mode,
			onContentChange,
			openFile,
			pendingFormatAction,
			rememberEditorScrollPosition,
			visualEditorRef,
		});

	// Whether the content area is currently wide enough to fit the floating
	// outline alongside the readable column. Drives temporary auto-hide: when the
	// window shrinks past the threshold the outline is suppressed; growing back
	// reveals it again, all without touching the user's on/off preference.
	const [contentWideEnough, setContentWideEnough] = useState(true);

	// Measure the content area and track whether it clears the outline threshold.
	// Only runs while the host actually wants the outline shown (`outlinePanel` is
	// non-null), so there's no observer overhead otherwise.
	useEffect(() => {
		const element = contentRef.current;
		if (!outlinePanel || !element || typeof ResizeObserver === 'undefined') {
			// Nothing to suppress when the outline isn't requested.
			setContentWideEnough(true);
			return;
		}

		const update = (width: number) => {
			setContentWideEnough(width >= OUTLINE_MIN_CONTENT_WIDTH);
		};

		update(element.clientWidth);

		const observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				update(entry.contentRect.width);
			}
		});
		observer.observe(element);

		return () => observer.disconnect();
	}, [outlinePanel]);

	const showOutline = Boolean(outlinePanel) && contentWideEnough;

	useLayoutEffect(() => {
		if (!openFile) {
			findTargetRef.current = null;
			return;
		}

		if (mode === 'code' || (mode === 'edit' && openFile.kind !== 'md')) {
			findTargetRef.current = editorScrollRef.current;
			return;
		}

		if (mode === 'edit') {
			findTargetRef.current = visualEditorRootRef.current;
			return;
		}

		findTargetRef.current = previewScrollRef.current;
	}, [findTargetRef, mode, openFile]);

	const previewContent = openFile ? (
		openFile.kind === 'md' ? (
			<MarkdownPreview
				ref={setPreviewScrollRef}
				frontmatter={frontmatter?.frontmatter}
				html={renderedMarkdown}
				onScroll={handlePreviewScroll}
				onLinkClick={onLinkClick}
			/>
		) : (
			<PlainTextPreview
				ref={setPreviewScrollRef}
				content={openFile.content}
				onScroll={handlePreviewScroll}
			/>
		)
	) : null;

	return (
		<main
			ref={contentRef}
			className={`content ${showOutline ? 'has-outline-panel' : ''}`}
			aria-label="Markdown preview"
			data-drop-zone="main"
		>
			{dropOverlay}
			{error ? <Notice tone="error">{error}</Notice> : null}

			{openFile ? (
				<article className={`preview-pane mode-${mode}`}>
					{actionBar}
					{findBar}

					<div className="document-region">
						{showOutline ? outlinePanel : null}
						<div className="document-layout">
							{mode === 'edit' && openFile.kind === 'md' ? (
								<section
									className="document-panel rendered-panel visual-editor-panel"
									aria-label="Markdown editor"
								>
									<LexicalMarkdownEditor
										ref={visualEditorRef}
										content={openFile.content}
										onChange={handleEditorContentChange}
										onScroll={handlePreviewScroll}
										rootRef={visualEditorRootRef}
									/>
								</section>
							) : null}

							{mode === 'code' || (mode === 'edit' && openFile.kind !== 'md') ? (
								<section className="document-panel editor-panel" aria-label="Editor">
									<textarea
										ref={editorScrollRef}
										className="editor"
										spellCheck={false}
										value={openFile.content}
										onScroll={handleEditorScroll}
										onKeyDown={handleEditorKeyDown}
										onKeyUp={rememberTextareaSelection}
										onClick={rememberTextareaSelection}
										onSelect={rememberTextareaSelection}
										onBlur={rememberTextareaSelection}
										onChange={(event) => handleEditorContentChange(event.target.value)}
									/>
								</section>
							) : null}

							{mode !== 'edit' ? (
								<section className="document-panel rendered-panel" aria-label="Preview">
									{previewContent}
								</section>
							) : null}
						</div>
					</div>

					<div className="file-meta">
						<span>{openFile.kind === 'md' ? 'Markdown' : 'Text'}</span>
						<span>{parentPath(openFile.path)}</span>
					</div>
				</article>
			) : (
				<EmptyPreview />
			)}
		</main>
	);
}
