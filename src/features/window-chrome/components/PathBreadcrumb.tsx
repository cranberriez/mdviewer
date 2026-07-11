import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { FileText, Folder, FolderOpen, FolderUp } from 'lucide-react';
import { usePathSuggestions, type PathSuggestion } from '../hooks/usePathSuggestions';

interface PathBreadcrumbProps {
	currentPath?: string;
	currentPathKind: 'file' | 'folder';
	rootName?: string;
	scopeNames?: string[];
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
	scopeNames = [],
	title,
	onNavigate,
}: PathBreadcrumbProps) {
	const [editing, setEditing] = useState(false);
	const [draft, setDraft] = useState(currentPath ?? '');
	const [error, setError] = useState<string | null>(null);
	const [navigating, setNavigating] = useState(false);
	const [activeSuggestion, setActiveSuggestion] = useState(-1);
	const inputRef = useRef<HTMLInputElement | null>(null);
	const PathIcon = currentPathKind === 'file' ? FileText : Folder;
	const { loading, suggestions } = usePathSuggestions({
		currentPath,
		currentPathKind,
		draft,
		enabled: editing,
	});

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

	useEffect(() => {
		setActiveSuggestion(-1);
	}, [suggestions]);

	const rootLabel = rootName ?? 'Home';
	const showTitleSegment = scopeNames.length > 0 || title !== rootLabel;

	function beginEditing() {
		if (!currentPath) {
			return;
		}
		setDraft(currentPath);
		setError(null);
		setActiveSuggestion(-1);
		setEditing(true);
	}

	function cancelEditing() {
		if (navigating) {
			return;
		}
		setDraft(currentPath ?? '');
		setError(null);
		setActiveSuggestion(-1);
		setEditing(false);
	}

	async function navigateToPath(path: string) {
		if (navigating) {
			return;
		}
		if (path === currentPath) {
			setEditing(false);
			return;
		}

		setDraft(path);
		setError(null);
		setActiveSuggestion(-1);
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

	function selectSuggestion(suggestion: PathSuggestion) {
		if (suggestion.kind === 'file') {
			void navigateToPath(suggestion.path);
			return;
		}
		setDraft(suggestion.path);
		setError(null);
		setActiveSuggestion(-1);
		window.requestAnimationFrame(() => {
			const input = inputRef.current;
			if (!input) {
				return;
			}
			input.focus();
			input.setSelectionRange(suggestion.path.length, suggestion.path.length);
		});
	}

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		const path = submittedPath(draft);
		if (!path) {
			setError('Enter a file or folder path.');
			return;
		}
		await navigateToPath(path);
	}

	function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
		if (event.key === 'ArrowDown' && suggestions.length > 0) {
			event.preventDefault();
			setActiveSuggestion((current) => (current + 1) % suggestions.length);
			return;
		}
		if (event.key === 'ArrowUp' && suggestions.length > 0) {
			event.preventDefault();
			setActiveSuggestion((current) => (current <= 0 ? suggestions.length - 1 : current - 1));
			return;
		}
		if (event.key === 'Enter' && activeSuggestion >= 0) {
			event.preventDefault();
			const suggestion = suggestions[activeSuggestion];
			if (suggestion) {
				selectSuggestion(suggestion);
			}
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			cancelEditing();
		}
	}

	function suggestionIcon(suggestion: PathSuggestion) {
		if (suggestion.kind === 'parent') {
			return FolderUp;
		}
		if (suggestion.kind === 'current') {
			return FolderOpen;
		}
		return suggestion.kind === 'file' ? FileText : Folder;
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
					role="combobox"
					aria-autocomplete="list"
					aria-controls="titlebar-path-suggestions"
					aria-expanded={!error}
					aria-activedescendant={
						activeSuggestion >= 0 ? `titlebar-path-option-${activeSuggestion}` : undefined
					}
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
						setActiveSuggestion(-1);
					}}
					onKeyDown={handleKeyDown}
				/>
				{error ? (
					<span id="titlebar-path-error" className="titlebar-path-error" role="alert">
						{error}
					</span>
				) : (
					<div
						id="titlebar-path-suggestions"
						className="titlebar-path-suggestions"
						role="listbox"
						aria-label="Path options"
					>
						<div className="titlebar-path-suggestions-label">Folder structure</div>
						{suggestions.length > 0 ? (
							suggestions.map((suggestion, index) => {
								const SuggestionIcon = suggestionIcon(suggestion);
								return (
									<button
										id={`titlebar-path-option-${index}`}
										key={suggestion.id}
										type="button"
										className={`titlebar-path-suggestion ${
											activeSuggestion === index ? 'active' : ''
										} ${suggestion.kind === 'current' ? 'context' : ''}`}
										role="option"
										aria-selected={activeSuggestion === index}
										title={suggestion.path}
										disabled={navigating}
										onPointerDown={(event) => event.preventDefault()}
										onPointerEnter={() => setActiveSuggestion(index)}
										onClick={() => selectSuggestion(suggestion)}
									>
										<SuggestionIcon size={14} aria-hidden />
										<span className="titlebar-path-suggestion-label">{suggestion.label}</span>
									</button>
								);
							})
						) : !loading ? (
							<div className="titlebar-path-suggestions-empty">No existing folder found.</div>
						) : null}
						{loading ? (
							<div className="titlebar-path-suggestions-empty">Finding nearest folder...</div>
						) : null}
					</div>
				)}
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
			<span className="crumb-root" aria-hidden>
				/
			</span>
			{scopeNames.map((scopeName, index) => (
				<span
					className="crumb-group"
					key={`${scopeName}:${index}`}
					style={{ flexShrink: 16 ** Math.min(4, scopeNames.length - index) }}
				>
					{index > 0 ? <span className="crumb-separator">/</span> : null}
					<span className="crumb-scope">{scopeName}</span>
				</span>
			))}
			{showTitleSegment ? (
				<>
					{scopeNames.length > 0 ? <span className="crumb-separator">/</span> : null}
					<span className="crumb-name">{title}</span>
				</>
			) : null}
		</button>
	);
}
