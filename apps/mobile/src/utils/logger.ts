/**
 * Production-safe logger utility
 * In production, these logs are suppressed
 * In development, they provide useful debugging info
 */

const isDev = __DEV__;

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface Logger {
	debug: (message: string, ...args: unknown[]) => void;
	info: (message: string, ...args: unknown[]) => void;
	warn: (message: string, ...args: unknown[]) => void;
	error: (message: string, ...args: unknown[]) => void;
}

const createLogger = (namespace: string): Logger => {
	const log = (level: LogLevel, message: string, ...args: unknown[]) => {
		if (!isDev && level !== 'error') {
			return;
		}

		const prefix = `[${namespace}][${level.toUpperCase()}]`;
		const timestamp = new Date().toISOString();

		switch (level) {
			case 'debug':
				console.log(`${timestamp} ${prefix}`, message, ...args);
				break;
			case 'info':
				console.info(`${timestamp} ${prefix}`, message, ...args);
				break;
			case 'warn':
				console.warn(`${timestamp} ${prefix}`, message, ...args);
				break;
			case 'error':
				console.error(`${timestamp} ${prefix}`, message, ...args);
				break;
		}
	};

	return {
		debug: (message: string, ...args: unknown[]) => log('debug', message, ...args),
		info: (message: string, ...args: unknown[]) => log('info', message, ...args),
		warn: (message: string, ...args: unknown[]) => log('warn', message, ...args),
		error: (message: string, ...args: unknown[]) => log('error', message, ...args),
	};
};

export const chatLogger = createLogger('Chat');
export const subscriptionLogger = createLogger('Subscription');




