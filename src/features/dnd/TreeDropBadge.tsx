import { Copy, CornerDownRight } from 'lucide-react';
import type { DragRenderHint, DropMode, DropZone } from './dropTypes';

interface TreeDropBadgeProps {
	target: DropZone | null;
	hint: DragRenderHint | null;
	mode: DropMode;
	count: number;
}

export function TreeDropBadge({ target, hint, mode, count }: TreeDropBadgeProps) {
	const isTree = target?.kind === 'tree-folder' || target?.kind === 'tree-root';
	if (!isTree || !hint || (hint.operation !== 'move' && hint.operation !== 'copy')) {
		return null;
	}

	const verb = hint.operation === 'copy' ? 'Copy' : 'Move';
	const noun = count > 1 ? `${count} items` : 'item';

	return (
		<div className={`tree-drop-badge ${hint.operation}`} role="status" aria-live="polite">
			<span className="tree-drop-badge-action">
				{hint.operation === 'copy' ? <Copy size={13} /> : <CornerDownRight size={13} />}
				{verb} {noun}
			</span>
			<span className="tree-drop-badge-dest">into {hint.label}</span>
			<span className="tree-drop-badge-hint">
				{mode === 'copy' ? 'Release Shift to move' : 'Hold Shift to copy'}
			</span>
		</div>
	);
}
