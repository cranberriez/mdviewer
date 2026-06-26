import type { Entry } from '../../shared/types/files';
import { comparablePath, containsPath } from '../../shared/utils/path';

export function deriveSavedLocations({
	defaultLocations,
	pinnedLocations,
	removedDefaultPaths,
	homePath,
}: {
	defaultLocations: Entry[];
	pinnedLocations: Entry[];
	removedDefaultPaths: string[];
	homePath?: string;
}) {
	const removed = new Set(removedDefaultPaths.map((path) => comparablePath(path)));
	const seen = new Set<string>();
	const result: Entry[] = [];

	for (const location of defaultLocations) {
		const key = comparablePath(location.path);
		const isHome = homePath ? comparablePath(homePath) === key : false;
		if (!isHome && removed.has(key)) {
			continue;
		}
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(location);
	}

	for (const location of pinnedLocations) {
		const key = comparablePath(location.path);
		if (seen.has(key)) {
			continue;
		}
		seen.add(key);
		result.push(location);
	}

	return result;
}

export function findContainingLocation(locations: Entry[], path?: string) {
	if (!path) {
		return null;
	}

	return (
		locations
			.filter((location) => containsPath(location.path, path))
			.sort(
				(left, right) => comparablePath(right.path).length - comparablePath(left.path).length
			)[0] ?? null
	);
}

export function isPathSavedLocation(locations: Entry[], path: string) {
	const key = comparablePath(path);
	return locations.some((location) => comparablePath(location.path) === key);
}

export function isHomeLocation(location: Entry, homePath?: string) {
	return homePath ? comparablePath(homePath) === comparablePath(location.path) : false;
}
