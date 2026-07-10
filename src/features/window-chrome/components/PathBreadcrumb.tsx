import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { FileText, Folder } from 'lucide-react';

interface PathBreadcrumbProps {
	currentPath?: string;
	currentPathKind: 'file' | 'folder';
	rootName?: string;
	scopeName?: string | null;
	title: string;
	onNavigate: (path: string) => Promise<void>;
}

function submittedPath(value: string) {
	const trimmed = value.trim();
	const quote = trimmed[0];
	if ((quote === '"' || quote === "'") && trimmed[trimmed.length - 1] === quote) {
		return trimmed.slice(1, -1).trim();
	}
	return trimmed;
}

export function PathBreadcrumb({
	currentPath,
	currentPathKind,
	rootName,
	scopeName,
	title,
	onNavigate,
}: PathBreadcrumbProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(currentPath ?? '');
	const [error, setError] = useState<string | null>(null);
	const [navigating, setNavigating] = useState(false);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const PathIcon = currentPathKind === 'file' ? FileText : Folder;

	useEffect(() => {
		if (!editing) {
			setDraft(currentPath ?? '');
		}
	}, [currentPath, editing]);

	useEffect(() => {
		if (!editing) {
			return;
		}
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [editing]);

	const rootLabel = rootName ?? 'Home';
	const showTitleSegment = Boolean(scopeName) || title !== rootLabel;

	function beginEditing() {
		if (!currentPath) {
			return;
		}
		setDraft(currentPath);
		setError(null);
		setEditing(true);
	}

	function cancelEditing() {
		if (navigating) {
			return;
		}
		setDraft(currentPath ?? '');
		setError(null);
		setEditing(false);
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (navigating) {
			return;
		}
		const path = submittedPath(draft);
		if (!path) {
			setError('Enter a file or folder path.');
			return;
		}
		if (path === currentPath) {
			setEditing(false);
			return;
		}

		setError(null);
		setNavigating(true);
		try {
			await onNavigate(path);
			setEditing(false);
		} catch {
			setError('That file or folder could not be opened.');
			inputRef.current?.focus();
		} finally {
			setNavigating(false);
		}
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}

	if (editing) {
		return (
			<form
				className="titlebar-path-editor"
				aria-busy={navigating}
				onSubmit={(event) => void handleSubmit(event)}
			>
				<PathIcon className="titlebar-path-icon titlebar-path-input-icon" size={13} aria-hidden />
				<input
					ref={inputRef}
					className="titlebar-path-input"
					value={draft}
					readOnly={navigating}
					aria-label="Current file or folder path"
					aria-invalid={error ? true : undefined}
					aria-describedby={error ? 'titlebar-path-error' : undefined}
					autoComplete="off"
					spellCheck={false}
					title={
						navigating
							? 'Opening path...'
							: (error ?? 'Press Enter to open this path. Press Escape to cancel.')
					}
					onBlur={cancelEditing}
					onChange={(event) => {
						setDraft(event.target.value);
						setError(null);
					}}
					onKeyDown={handleKeyDown}
				/>
				{error ? (
					<span id="titlebar-path-error" className="titlebar-path-error" role="alert">
						{error}
					</span>
				) : null}
			</form>
		);
	}

	return (
		<button
			type="button"
			className="titlebar-crumb titlebar-path-trigger"
			disabled={!currentPath}
			aria-label={currentPath ? `Edit current path: ${currentPath}` : undefined}
			title={currentPath ? `Edit path: ${currentPath}` : undefined}
			onClick={beginEditing}
		>
			<PathIcon className="titlebar-path-icon" size={13} aria-hidden />
			<span>{rootLabel}</span>
			{scopeName ? (
				<>
					<span className="crumb-separator">/</span>
					<span>{scopeName}</span>
				</>
			) : null}
			{showTitleSegment ? (
				<>
					<span className="crumb-separator">/</span>
					<span className="crumb-name">{title}</span>
				</>
			) : null}
		</button>
	);
}
