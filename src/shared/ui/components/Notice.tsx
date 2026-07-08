import { AlertCircle } from 'lucide-react';

interface NoticeProps {
	children: string;
	tone?: 'error';
}

export function Notice({ children, tone }: NoticeProps) {
	return (
		<div className={`notice ${tone ?? ''}`}>
			<AlertCircle size={18} />
			<span>{children}</span>
		</div>
	);
}
