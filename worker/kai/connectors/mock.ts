/**
 * KAI Mock Connectors for Testing
 * Simulates external API responses without network calls
 */

import { BaseConnector, Env } from "./base";
import { ConnectorAction } from "../types";

export interface MockConnectorConfig {
	delay?: number; // Simulate network latency
	errorRate?: number; // Percentage of requests that fail (0-1)
	injectError?: Error; // Specific error to throw
}

/**
 * Mock HTTP Connector for testing
 */
export class MockHttpConnector extends BaseConnector {
	private config: MockConnectorConfig;
	private requestLog: Array<{
		method: string;
		url: string;
		timestamp: number;
	}> = [];

	constructor(mockConfig: MockConnectorConfig = {}) {
		super({
			id: "mock_http",
			name: "Mock HTTP",
			type: "http",
			description: "Mock HTTP connector for testing",
			auth: "none",
		});
		this.config = mockConfig;
	}

	getActions(): ConnectorAction[] {
		return [
			{
				id: "get",
				name: "GET Request",
				description: "Mock GET request",
			},
			{
				id: "post",
				name: "POST Request",
				description: "Mock POST request",
			},
			{
				id: "put",
				name: "PUT Request",
				description: "Mock PUT request",
			},
			{
				id: "delete",
				name: "DELETE Request",
				description: "Mock DELETE request",
			},
			{
				id: "patch",
				name: "PATCH Request",
				description: "Mock PATCH request",
			},
		];
	}

	async execute(
		action: string,
		params: Record<string, any>,
		env: Env,
	): Promise<any> {
		// Simulate error injection
		if (this.config.injectError) {
			throw this.config.injectError;
		}

		// Simulate error rate
		if (this.config.errorRate && Math.random() < this.config.errorRate) {
			throw new Error("Mock HTTP Error: Simulated failure");
		}

		// Simulate latency
		if (this.config.delay) {
			await new Promise((resolve) => setTimeout(resolve, this.config.delay!));
		}

		// Log request
		this.requestLog.push({
			method: action.toUpperCase(),
			url: params.url,
			timestamp: Date.now(),
		});

		// Return mock response
		const status = action === "post" ? 201 : 200;
		return {
			status,
			headers: { "content-type": "application/json" },
			body: {
				id: "mock_id_123",
				timestamp: new Date().toISOString(),
				data: params.body || { query: params.query },
			},
			ok: status < 400,
		};
	}

	async validateConfig(config: Record<string, any>): Promise<boolean> {
		try {
			new URL(config.baseUrl || "http://localhost");
			return true;
		} catch {
			return false;
		}
	}

	async testConnection(env: Env): Promise<boolean> {
		return true; // Always healthy in mock
	}

	/**
	 * Get request log for testing verification
	 */
	getRequestLog(): Array<{ method: string; url: string; timestamp: number }> {
		return this.requestLog;
	}

	/**
	 * Clear request log
	 */
	clearRequestLog(): void {
		this.requestLog = [];
	}

	/**
	 * Get request count
	 */
	getRequestCount(): number {
		return this.requestLog.length;
	}
}

/**
 * Mock Slack Connector for testing
 */
export class MockSlackConnector extends BaseConnector {
	private messageLog: Array<{
		channel: string;
		text: string;
		timestamp: number;
	}> = [];
	private config: MockConnectorConfig;

	constructor(mockConfig: MockConnectorConfig = {}) {
		super({
			id: "mock_slack",
			name: "Mock Slack",
			type: "service",
			description: "Mock Slack connector for testing",
			auth: "apikey",
		});
		this.config = mockConfig;
	}

	getActions(): ConnectorAction[] {
		return [
			{
				id: "send_message",
				name: "Send Message",
				description: "Mock send message",
			},
			{
				id: "create_channel",
				name: "Create Channel",
				description: "Mock create channel",
			},
			{
				id: "update_user_status",
				name: "Update User Status",
				description: "Mock update status",
			},
			{
				id: "get_channel_info",
				name: "Get Channel Info",
				description: "Mock get info",
			},
			{
				id: "list_users",
				name: "List Users",
				description: "Mock list users",
			},
		];
	}

	async execute(
		action: string,
		params: Record<string, any>,
		env: Env,
	): Promise<any> {
		// Simulate error injection
		if (this.config.injectError) {
			throw this.config.injectError;
		}

		// Simulate latency
		if (this.config.delay) {
			await new Promise((resolve) => setTimeout(resolve, this.config.delay!));
		}

		switch (action.toLowerCase()) {
			case "send_message":
				return this.mockSendMessage(params);
			case "create_channel":
				return this.mockCreateChannel(params);
			case "update_user_status":
				return this.mockUpdateStatus(params);
			case "get_channel_info":
				return this.mockGetChannelInfo(params);
			case "list_users":
				return this.mockListUsers(params);
			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	private mockSendMessage(params: Record<string, any>): any {
		this.messageLog.push({
			channel: params.channel,
			text: params.text,
			timestamp: Date.now(),
		});

		return {
			ok: true,
			channel: params.channel,
			ts: Date.now().toString(),
			message: {
				text: params.text,
				type: "message",
			},
		};
	}

	private mockCreateChannel(params: Record<string, any>): any {
		return {
			ok: true,
			channel: {
				id: `C_${Math.random().toString(36).substr(2, 9)}`,
				name: params.name,
				is_private: params.is_private || false,
				created: Date.now(),
			},
		};
	}

	private mockUpdateStatus(params: Record<string, any>): any {
		return {
			ok: true,
			user: params.user_id,
			profile: {
				status_emoji: params.status_emoji,
				status_text: params.status_text,
			},
		};
	}

	private mockGetChannelInfo(params: Record<string, any>): any {
		return {
			ok: true,
			channel: {
				id: params.channel,
				name: "test-channel",
				is_member: true,
				members_count: 42,
			},
		};
	}

	private mockListUsers(params: Record<string, any>): any {
		return {
			ok: true,
			members: Array(params.limit || 10)
				.fill(null)
				.map((_, i) => ({
					id: `U_${i}`,
					name: `user_${i}`,
					profile: { email: `user${i}@example.com` },
				})),
			response_metadata: {
				next_cursor: params.cursor ? "" : "cursor_123",
			},
		};
	}

	async validateConfig(config: Record<string, any>): Promise<boolean> {
		return !!config.slack_bot_token || true; // Mock is always valid
	}

	async testConnection(env: Env): Promise<boolean> {
		return true; // Always healthy in mock
	}

	/**
	 * Get sent messages for testing
	 */
	getMessageLog(): Array<{ channel: string; text: string; timestamp: number }> {
		return this.messageLog;
	}

	/**
	 * Get messages sent to specific channel
	 */
	getMessagesForChannel(
		channel: string,
	): Array<{ text: string; timestamp: number }> {
		return this.messageLog
			.filter((m) => m.channel === channel)
			.map(({ text, timestamp }) => ({ text, timestamp }));
	}

	/**
	 * Clear message log
	 */
	clearMessageLog(): void {
		this.messageLog = [];
	}

	/**
	 * Get total messages sent
	 */
	getMessageCount(): number {
		return this.messageLog.length;
	}
}

/**
 * Create test connector set with all mocks
 */
export function createMockConnectorSet(
	httpConfig?: MockConnectorConfig,
	slackConfig?: MockConnectorConfig,
): Map<string, BaseConnector> {
	const connectors = new Map<string, BaseConnector>();
	connectors.set("http", new MockHttpConnector(httpConfig));
	connectors.set("slack", new MockSlackConnector(slackConfig));
	return connectors;
}

/**
 * Test utility: Create mock connector with error
 */
export function createMockConnectorWithError(
	type: "http" | "slack",
	error: Error,
): BaseConnector {
	if (type === "http") {
		return new MockHttpConnector({ injectError: error });
	} else {
		return new MockSlackConnector({ injectError: error });
	}
}

/**
 * Test utility: Create mock connector with delay
 */
export function createMockConnectorWithDelay(
	type: "http" | "slack",
	delayMs: number,
): BaseConnector {
	if (type === "http") {
		return new MockHttpConnector({ delay: delayMs });
	} else {
		return new MockSlackConnector({ delay: delayMs });
	}
}
