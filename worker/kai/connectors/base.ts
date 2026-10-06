/**
 * KAI Base Connector Class
 * Abstract base for all connector implementations
 */

import { ConnectorAction, ConnectorConfig } from "../types";

export interface Env {
	DB: D1Database;
	KV: KVNamespace;
	R2: R2Bucket;
	[key: string]: any;
}

export abstract class BaseConnector {
	readonly id: string;
	readonly name: string;
	readonly type: "http" | "database" | "messaging" | "storage" | "service";
	readonly description?: string;
	readonly auth?: "apikey" | "oauth" | "basic" | "none";
	protected config: ConnectorConfig;
	protected credentials?: Record<string, string>;

	constructor(config: ConnectorConfig) {
		this.id = config.id;
		this.name = config.name;
		this.type = config.type;
		this.description = config.description;
		this.auth = config.auth;
		this.config = config;
	}

	/**
	 * Get available actions for this connector
	 */
	abstract getActions(): ConnectorAction[];

	/**
	 * Execute a connector action
	 */
	abstract execute(
		action: string,
		params: Record<string, any>,
		env: Env,
	): Promise<any>;

	/**
	 * Validate connector configuration
	 */
	abstract validateConfig(config: Record<string, any>): Promise<boolean>;

	/**
	 * Test connector connectivity
	 */
	abstract testConnection(env: Env): Promise<boolean>;

	/**
	 * Get connector status
	 */
	async getStatus(env: Env): Promise<"healthy" | "degraded" | "unavailable"> {
		try {
			const isConnected = await this.testConnection(env);
			return isConnected ? "healthy" : "unavailable";
		} catch {
			return "unavailable";
		}
	}

	/**
	 * Set credentials for authentication
	 */
	setCredentials(credentials: Record<string, string>): void {
		this.credentials = credentials;
	}

	/**
	 * Get credential keys needed by this connector
	 */
	getRequiredCredentials(): string[] {
		return [];
	}

	/**
	 * Sanitize sensitive data from logs
	 */
	protected sanitizeParams(params: Record<string, any>): Record<string, any> {
		const sensitive = [
			"apikey",
			"api_key",
			"password",
			"token",
			"secret",
			"credentials",
		];
		const sanitized = { ...params };

		for (const key of Object.keys(sanitized)) {
			if (sensitive.some((s) => key.toLowerCase().includes(s))) {
				sanitized[key] = "***REDACTED***";
			}
		}

		return sanitized;
	}

	/**
	 * Retry logic with exponential backoff
	 */
	protected async retry<T>(
		fn: () => Promise<T>,
		maxRetries: number = 3,
		backoffMs: number = 1000,
	): Promise<T> {
		let lastError: Error | null = null;

		for (let i = 0; i < maxRetries; i++) {
			try {
				return await fn();
			} catch (error) {
				lastError = error as Error;
				if (i < maxRetries - 1) {
					await new Promise((resolve) =>
						setTimeout(resolve, backoffMs * Math.pow(2, i)),
					);
				}
			}
		}

		throw lastError || new Error("Retry failed");
	}

	/**
	 * Timeout wrapper for async operations
	 */
	protected async withTimeout<T>(
		promise: Promise<T>,
		timeoutMs: number = 30000,
	): Promise<T> {
		return Promise.race([
			promise,
			new Promise<T>((_, reject) =>
				setTimeout(
					() => reject(new Error(`Operation timeout after ${timeoutMs}ms`)),
					timeoutMs,
				),
			),
		]);
	}

	/**
	 * Validate input against action schema
	 */
	protected validateInput(
		params: Record<string, any>,
		schema?: Record<string, any>,
	): boolean {
		if (!schema) return true;

		for (const [key, rules] of Object.entries(schema)) {
			const value = params[key];
			const ruleSet = rules as any;

			if (ruleSet.required && value === undefined) {
				throw new Error(`Required parameter missing: ${key}`);
			}

			if (value !== undefined && ruleSet.type) {
				const expectedType = ruleSet.type;
				const actualType = typeof value;
				if (actualType !== expectedType) {
					throw new Error(
						`Parameter ${key} has wrong type. Expected ${expectedType}, got ${actualType}`,
					);
				}
			}
		}

		return true;
	}
}
