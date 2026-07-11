import { useState } from 'react';
import {
	ArrowRight,
	FileText,
	FolderOpen,
	FolderPlus,
	Home as HomeIcon,
	Minus,
	Text,
} from 'lucide-react';
import type { Entry } from '../../../shared/types/files';
import type {
	ShellIntegrationPreferences,
	StoredFileViewMode,
} from '../../../shared/state/persistence';

export interface OnboardingResult {
	name: string;
	homeLocation?: Entry;
	shellIntegration: ShellIntegrationPreferences;
	/** Folders to pin (beyond Home, which is always implied). */
	starterFolders: Entry[];
	/** Default mode files open in. */
	viewMode: StoredFileViewMode;
}

interface OnboardingViewProps {
	/** Home location — always shown first, can be re-pointed but not removed. */
	home?: Entry;
	/** Initial starter folders (e.g. Documents on first run, or current pins on re-entry). */
	initialStarterFolders: Entry[];
	initialName?: string;
	initialViewMode: StoredFileViewMode;
	initialShellIntegration: ShellIntegrationPreferences;
	/** Whether this is the first run (changes copy + whether Skip is offered). */
	firstRun: boolean;
	/** Open the native folder picker, returning the chosen folder or null. */
	onPickFolder: () => Promise<Entry | null>;
	onComplete: (result: OnboardingResult) => Promise<void>;
	onSkip: () => void;
}

function comparable(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

const VIEW_MODES: Array<{ id: StoredFileViewMode; label: string }> = [
	{ id: 'preview', label: 'Preview' },
	{ id: 'edit', label: 'Edit' },
	{ id: 'code', label: 'Code' },
];

export function OnboardingView({
	home,
	initialStarterFolders,
	initialName,
	initialViewMode,
	initialShellIntegration,
	firstRun,
	onPickFolder,
	onComplete,
	onSkip,
}: OnboardingViewProps) {
	const [name, setName] = useState(initialName ?? '');
	const [homeOverride, setHomeOverride] = useState<Entry | undefined>(home);
	const [starterFolders, setStarterFolders] = useState<Entry[]>(initialStarterFolders);
	const [viewMode, setViewMode] = useState<StoredFileViewMode>(initialViewMode);
	const [shellIntegration, setShellIntegration] =
		useState<ShellIntegrationPreferences>(initialShellIntegration);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [submitting, setSubmitting] = useState(false);

	async function repointHome() {
		const folder = await onPickFolder();
		if (folder) {
			setHomeOverride(folder);
		}
	}

	async function addFolder() {
		const folder = await onPickFolder();
		if (!folder) {
			return;
		}
		setStarterFolders((current) => {
			const key = comparable(folder.path);
			const isHome = homeOverride ? comparable(homeOverride.path) === key : false;
			if (isHome || current.some((entry) => comparable(entry.path) === key)) {
				return current;
			}
			return [...current, folder];
		});
	}

	function removeFolder(path: string) {
		setStarterFolders((current) =>
			current.filter((entry) => comparable(entry.path) !== comparable(path))
		);
	}

	async function complete() {
		setSubmitError(null);
		setSubmitting(true);
		try {
			await onComplete({
				name: name.trim(),
				homeLocation: homeOverride,
				shellIntegration,
				starterFolders,
				viewMode,
			});
		} catch (cause) {
			setSubmitError(`Unable to update preferences: ${String(cause)}`);
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className="onboarding">
			<div className="onboarding-inner">
				<div className="onboarding-head">
					<div className="onboarding-logo">
						<Text size={19} />
					</div>
					<div>
						<h1>{firstRun ? 'Welcome to Markdown Viewer' : 'Setup preferences'}</h1>
						<p>A quiet place to read and write markdown.</p>
					</div>
				</div>

				<div className="ob-field">
					<span className="home-label">Your name</span>
					<input
						className="ob-input"
						placeholder="Optional"
						value={name}
						onChange={(event) => setName(event.target.value)}
					/>
				</div>

				<div className="ob-field">
					<span className="home-label">Starter folders</span>
					<div className="ob-folder-list">
						<div className="ob-folder-row">
							<span className="ob-folder-ico">
								<HomeIcon size={16} />
							</span>
							<span className="ob-folder-name">
								Home <span className="ob-folder-sub">· {homeOverride?.path ?? '—'}</span>
							</span>
							<button
								type="button"
								className="ob-row-act"
								title="Choose a different folder"
								onClick={() => void repointHome()}
							>
								<FolderOpen size={14} />
							</button>
						</div>
						{starterFolders.map((folder) => (
							<div key={folder.path} className="ob-folder-row">
								<span className="ob-folder-ico">
									<FolderOpen size={16} />
								</span>
								<span className="ob-folder-name">
									{folder.name} <span className="ob-folder-sub">· {folder.path}</span>
								</span>
								<button
									type="button"
									className="ob-row-act"
									title="Remove"
									onClick={() => removeFolder(folder.path)}
								>
									<Minus size={14} />
								</button>
							</div>
						))}
					</div>
					<button type="button" className="ob-add-folder" onClick={() => void addFolder()}>
						<FolderPlus size={15} />
						Add a folder
					</button>
				</div>

				<div className="ob-field">
					<span className="home-label">Open files in</span>
					<div className="ob-seg" role="group">
						{VIEW_MODES.map((option) => (
							<button
								key={option.id}
								type="button"
								className={viewMode === option.id ? 'active' : ''}
								onClick={() => setViewMode(option.id)}
							>
								{option.label}
							</button>
						))}
					</div>
				</div>

				<div className="ob-field">
					<span className="home-label">Windows Explorer</span>
					<div className="ob-toggle-list">
						<label className="ob-toggle-row">
							<FileText size={16} />
							<span>
								<strong>Open Markdown files with MDViewer</strong>
								<small>Adds an opt-in menu for .md and .markdown files.</small>
							</span>
							<input
								type="checkbox"
								checked={shellIntegration.markdownFiles}
								onChange={(event) =>
									setShellIntegration((current) => ({
										...current,
										markdownFiles: event.target.checked,
									}))
								}
							/>
						</label>
						<label className="ob-toggle-row">
							<FolderOpen size={16} />
							<span>
								<strong>Open folders with MDViewer</strong>
								<small>Adds “Open folder in MDViewer” to folder menus.</small>
							</span>
							<input
								type="checkbox"
								checked={shellIntegration.folders}
								onChange={(event) =>
									setShellIntegration((current) => ({
										...current,
										folders: event.target.checked,
									}))
								}
							/>
						</label>
					</div>
				</div>

				{submitError ? <p className="ob-error">{submitError}</p> : null}

				<div className="ob-actions">
					{firstRun ? (
						<button type="button" className="ob-btn ghost" onClick={onSkip}>
							Skip
						</button>
					) : (
						<button type="button" className="ob-btn ghost" onClick={onSkip}>
							Cancel
						</button>
					)}
					<span className="ob-spacer" />
					<button
						type="button"
						className="ob-btn primary"
						disabled={submitting}
						onClick={() => void complete()}
					>
						{submitting ? 'Applying…' : firstRun ? 'Continue' : 'Done'}
						<ArrowRight size={15} />
					</button>
				</div>
			</div>
		</div>
	);
}
