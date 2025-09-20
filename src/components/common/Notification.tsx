import React, { useEffect } from 'react';

export interface NotificationProps {
	type?: 'success' | 'error' | 'info' | 'warning';
	title?: string;
	message: string;
	onClose?: () => void;
	duration?: number; // ms
}

const colorMap: Record<NonNullable<NotificationProps['type']>, { base: string; border: string; text: string; iconBg: string; } > = {
	success: { base: 'bg-green-50', border: 'border-green-300', text: 'text-green-800', iconBg: 'bg-green-100' },
	error: { base: 'bg-red-50', border: 'border-red-300', text: 'text-red-800', iconBg: 'bg-red-100' },
	info: { base: 'bg-blue-50', border: 'border-blue-300', text: 'text-blue-800', iconBg: 'bg-blue-100' },
	warning: { base: 'bg-amber-50', border: 'border-amber-300', text: 'text-amber-800', iconBg: 'bg-amber-100' },
};

export const Notification: React.FC<NotificationProps> = ({ type='info', title, message, onClose, duration=3000 }) => {
	useEffect(() => {
		if (!duration) return; const id = setTimeout(() => { onClose && onClose(); }, duration); return () => clearTimeout(id);
	}, [duration, onClose]);
	const c = colorMap[type];
	return (
		<div className={`pointer-events-auto w-full max-w-sm shadow-lg rounded-xl border ${c.border} ${c.base} p-4 flex gap-3 animate-fadeIn`}>      
			<div className={`${c.iconBg} w-8 h-8 rounded-lg flex items-center justify-center text-sm font-semibold ${c.text}`}>{type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i'}</div>
			<div className="flex-1">
				{title && <div className={`text-sm font-semibold mb-0.5 ${c.text}`}>{title}</div>}
				<div className={`text-xs leading-relaxed ${c.text}`}>{message}</div>
			</div>
			{onClose && (
				<button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors text-sm">×</button>
			)}
		</div>
	);
};

export default Notification;

