import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface IconActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	active?: boolean;
	children: ReactNode;
	tooltip: string;
}

const tooltipClasses =
	'after:pointer-events-none after:absolute after:left-1/2 after:top-[calc(100%+7px)] after:z-[70] after:-translate-x-1/2 after:-translate-y-[3px] after:whitespace-nowrap after:rounded-md after:border after:border-border-base after:bg-bg-menu after:px-2 after:py-[3px] after:text-[11px] after:text-text-primary after:opacity-0 after:shadow-[0_6px_16px_-6px_rgba(0,0,0,.6)] after:transition after:duration-100 after:content-[attr(data-tip)] hover:after:translate-y-0 hover:after:opacity-100 hover:after:delay-[450ms]';

export function IconActionButton({
	active = false,
	children,
	className = '',
	tooltip,
	...buttonProps
}: IconActionButtonProps) {
	const classes = [
		'relative flex h-7 min-w-7 items-center justify-center gap-1.5 rounded-ctl border-0 bg-transparent px-[7px] text-xs text-text-secondary transition-colors duration-100',
		'hover:bg-bg-hover hover:text-text-primary active:bg-bg-active',
		'disabled:pointer-events-none disabled:opacity-40',
		active ? 'bg-bg-active text-[var(--color-text-on-active)]' : '',
		tooltipClasses,
		className,
	]
		.filter(Boolean)
		.join(' ');

	return (
		<button
			type="button"
			{...buttonProps}
			className={classes}
			data-tip={tooltip}
			aria-label={buttonProps['aria-label'] ?? tooltip}
		>
			{children}
		</button>
	);
}
