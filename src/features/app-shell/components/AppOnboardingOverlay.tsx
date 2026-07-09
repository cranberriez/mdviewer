import type { Entry } from '../../../shared/types/files';
import { comparablePath } from '../../../shared/utils/path';
import type { FileViewMode } from '../../file-actions/components/FileActionControls';
import type { ShellIntegrationPreferences } from '../../../shared/state/persistence';
import { OnboardingView, type OnboardingResult } from '../../home/components/OnboardingView';

interface AppOnboardingOverlayProps {
	visible: boolean;
	defaultHomeName?: string;
	homePath?: string;
	locations: Entry[];
	userName: string;
	viewMode: FileViewMode;
	shellIntegration: ShellIntegrationPreferences;
	onboardingCompleted: boolean;
	onPickFolder: () => Promise<Entry | null>;
	onComplete: (result: OnboardingResult) => Promise<void>;
	onSkip: () => void;
}

export function AppOnboardingOverlay({
	visible,
	defaultHomeName,
	homePath,
	locations,
	userName,
	viewMode,
	shellIntegration,
	onboardingCompleted,
	onPickFolder,
	onComplete,
	onSkip,
}: AppOnboardingOverlayProps) {
	if (!visible) {
		return null;
	}

	return (
		<OnboardingView
			home={
				homePath
					? {
							name: defaultHomeName ?? 'Home',
							path: homePath,
							is_dir: true,
							kind: 'folder',
						}
					: undefined
			}
			initialStarterFolders={locations.filter((location) =>
				homePath ? comparablePath(location.path) !== comparablePath(homePath) : true
			)}
			initialName={userName}
			initialViewMode={viewMode}
			initialShellIntegration={shellIntegration}
			firstRun={!onboardingCompleted}
			onPickFolder={onPickFolder}
			onComplete={onComplete}
			onSkip={onSkip}
		/>
	);
}
