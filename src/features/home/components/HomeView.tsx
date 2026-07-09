import type { MouseEvent as ReactMouseEvent } from 'react';
import { FileText, FolderOpen, FolderPlus, Home as HomeIcon, Settings } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import * as Icons from 'lucide-react';
import type { Entry } from '../../../shared/types/files';
import { recentItemKind, type RecentItem } from '../../../shared/state/persistence';

interface HomeViewProps {
	/** Greeting name (from onboarding); empty falls back to "Welcome back". */
	userName?: string;
	/** Pinned/saved locations to surface as quick-access tiles. */
	locations: Entry[];
	/** Recently opened files and roots, newest first. */
	recents: RecentItem[];
	/** Path of the Home location, for its dedicated icon. */
	homePath?: string;
	/** Custom icon name per location path. */
	locationIcons: Record<string, string>;
	onOpenFolder: () => void;
	onSelectLocation: (location: Entry) => void;
	onOpenRecent: (item: RecentItem) => void;
	onLocationContextMenu: (location: Entry, event: ReactMouseEvent) => void;
	onRecentContextMenu: (item: RecentItem, event: ReactMouseEvent) => void;
	onEditSetup: () => void;
	/** True while an OS file/folder drag is hovering the Home screen. */
	dropActive?: boolean;
	openHomeOnStartup: boolean;
	onOpenHomeOnStartupChange: (enabled: boolean) => void;
}

function comparable(path: string) {
	return path.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
}

function resolveIcon(name: string | undefined): LucideIcon | null {
	if (!name) {
		return null;
	}
	const candidate = (Icons as unknown as Record<string, LucideIcon>)[name];
	return typeof candidate === 'function' ? candidate : null;
}

export function HomeView({
	userName,
	locations,
	recents,
	homePath,
	locationIcons,
	onOpenFolder,
	onSelectLocation,
	onOpenRecent,
	onLocationContextMenu,
	onRecentContextMenu,
	onEditSetup,
	dropActive,
	openHomeOnStartup,
	onOpenHomeOnStartupChange,
}: HomeViewProps) {
	const greeting = userName?.trim() ? `Welcome back, ${userName.trim()}` : 'Welcome back';

	return (
		<div className={`home ${dropActive ? 'drop-active' : ''}`} data-drop-zone="home">
			<div className="home-inner">
				<div className="home-head">
					<div className="home-logo">
						<FileText size={19} />
					</div>
					<div>
						<h1>{greeting}</h1>
						<p>Open a folder, or pick up where you left off.</p>
					</div>
				</div>

				<button type="button" className="home-open-root" onClick={onOpenFolder}>
					<FolderPlus size={16} />
					Open a folder
				</button>

				<div className="home-grid">
					<section className="home-col">
						<span className="home-label">Pinned</span>
						<div className="home-pins">
							{locations.map((location) => {
								const isHome = homePath
									? comparable(homePath) === comparable(location.path)
									: false;
								const CustomIcon = resolveIcon(locationIcons[location.path]);
								const Icon = CustomIcon ?? (isHome ? HomeIcon : FolderOpen);
								return (
									<button
										key={location.path}
										type="button"
										className="home-pin"
										title={location.path}
										onClick={() => onSelectLocation(location)}
										onContextMenu={(event) => onLocationContextMenu(location, event)}
									>
										<span className="home-pin-ico">
											<Icon size={16} />
										</span>
										<span className="home-pin-name">{location.name}</span>
									</button>
								);
							})}
						</div>
					</section>

					<section className="home-col">
						<span className="home-label">Recent</span>
						{recents.length === 0 ? (
							<p className="home-empty">Files and folders you open will show up here.</p>
						) : (
							<div className="home-recents">
								{recents.map((item, index) => {
									const isFile = recentItemKind(item) === 'file';
									return (
										<button
											key={`${isFile ? 'file' : 'root'}:${item.path}`}
											type="button"
											className={`home-recent ${index === 0 ? 'first' : ''}`}
											title={item.lastFile ? `${item.path}\n${item.lastFile.path}` : item.path}
											onClick={() => onOpenRecent(item)}
											onContextMenu={(event) => onRecentContextMenu(item, event)}
										>
											<span className="home-recent-ico">
												{isFile ? <FileText size={15} /> : <FolderOpen size={15} />}
											</span>
											<span className="home-recent-name">{item.name}</span>
											{item.lastFile ? (
												<span className="home-recent-file">
													<FileText size={12} />
													{item.lastFile.name}
												</span>
											) : null}
										</button>
									);
								})}
							</div>
						)}
					</section>
				</div>

				<div className="home-foot">
					<button type="button" className="home-setup-link" onClick={onEditSetup}>
						<Settings size={13} />
						Setup preferences
					</button>
					<label className="home-startup-toggle">
						<input
							type="checkbox"
							checked={openHomeOnStartup}
							onChange={(event) => onOpenHomeOnStartupChange(event.target.checked)}
						/>
						Open to this screen on startup
					</label>
				</div>
			</div>
		</div>
	);
}
