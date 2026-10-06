/**
 * KAI Slack Connector
 * Slack API integration - send messages, manage channels, etc.
 */

import { BaseConnector, Env } from "./base";
import { ConnectorAction } from "../types";

export class SlackConnector extends BaseConnector {
	private slackApiUrl = "https://slack.com/api";

	constructor(config: any = {}) {
		super({
			id: "slack",
			name: "Slack",
			type: "service",
			description: "Slack API connector for messaging and channel management",
			auth: "apikey",
			...config,
		});
	}

	getActions(): ConnectorAction[] {
		return [
			{
				id: "send_message",
				name: "Send Message",
				description: "Send a message to a Slack channel",
				inputSchema: {
					channel: { type: "string", required: true },
					text: { type: "string" },
					blocks: { type: "object" },
					thread_ts: { type: "string" },
				},
			},
			{
				id: "create_channel",
				name: "Create Channel",
				description: "Create a new Slack channel",
				inputSchema: {
					name: { type: "string", required: true },
					is_private: { type: "boolean" },
					description: { type: "string" },
				},
			},
			{
				id: "update_user_status",
				name: "Update User Status",
				description: "Update a user's status emoji and text",
				inputSchema: {
					user_id: { type: "string", required: true },
					status_emoji: { type: "string" },
					status_text: { type: "string" },
				},
			},
			{
				id: "get_channel_info",
				name: "Get Channel Info",
				description: "Get information about a Slack channel",
				inputSchema: {
					channel: { type: "string", required: true },
				},
			},
			{
				id: "list_users",
				name: "List Users",
				description: "List all users in the Slack workspace",
				inputSchema: {
					limit: { type: "number" },
					cursor: { type: "string" },
				},
			},
		];
	}

	async execute(
		action: string,
		params: Record<string, any>,
		env: Env,
	): Promise<any> {
		if (!this.credentials?.slack_bot_token) {
			throw new Error("Slack bot token not configured");
		}

		this.validateInput(params, this.getActionSchema(action));

		switch (action.toLowerCase()) {
			case "send_message":
				return this.sendMessage(params);
			case "create_channel":
				return this.createChannel(params);
			case "update_user_status":
				return this.updateUserStatus(params);
			case "get_channel_info":
				return this.getChannelInfo(params);
			case "list_users":
				return this.listUsers(params);
			default:
				throw new Error(`Unknown action: ${action}`);
		}
	}

	private async sendMessage(params: Record<string, any>): Promise<any> {
		const { channel, text, blocks, thread_ts } = params;

		const payload: Record<string, any> = {
			channel,
		};

		if (text) payload.text = text;
		if (blocks) payload.blocks = blocks;
		if (thread_ts) payload.thread_ts = thread_ts;

		return this.callSlackApi("chat.postMessage", payload);
	}

	private async createChannel(params: Record<string, any>): Promise<any> {
		const { name, is_private, description } = params;

		const payload: Record<string, any> = {
			name,
			is_private: is_private || false,
		};

		if (description) payload.topic = { value: description };

		return this.callSlackApi("conversations.create", payload);
	}

	private async updateUserStatus(params: Record<string, any>): Promise<any> {
		const { user_id, status_emoji, status_text } = params;

		const profile: Record<string, any> = {};
		if (status_emoji) profile.status_emoji = status_emoji;
		if (status_text) profile.status_text = status_text;

		return this.callSlackApi("users.profile.set", {
			user: user_id,
			profile,
		});
	}

	private async getChannelInfo(params: Record<string, any>): Promise<any> {
		return this.callSlackApi("conversations.info", {
			channel: params.channel,
		});
	}

	private async listUsers(params: Record<string, any>): Promise<any> {
		const payload: Record<string, any> = {
			limit: params.limit || 100,
		};

		if (params.cursor) payload.cursor = params.cursor;

		return this.callSlackApi("users.list", payload);
	}

	private async callSlackApi(
		method: string,
		params: Record<string, any>,
	): Promise<any> {
		const url = `${this.slackApiUrl}/${method}`;
		const payload = new URLSearchParams();

		for (const [key, value] of Object.entries(params)) {
			if (typeof value === "object") {
				payload.append(key, JSON.stringify(value));
			} else {
				payload.append(key, String(value));
			}
		}

		try {
			const response = await this.withTimeout(
				fetch(url, {
					method: "POST",
					headers: {
						Authorization: `Bearer ${this.credentials!.slack_bot_token}`,
						"Content-Type": "application/x-www-form-urlencoded",
					},
					body: payload.toString(),
				}),
				10000,
			);

			const result = await response.json();

			if (!result.ok) {
				throw new Error(`Slack API error: ${result.error}`);
			}

			return result;
		} catch (error) {
			throw new Error(`Slack API call failed: ${(error as Error).message}`);
		}
	}

	async validateConfig(config: Record<string, any>): Promise<boolean> {
		return !!config.slack_bot_token;
	}

	async testConnection(env: Env): Promise<boolean> {
		try {
			if (!this.credentials?.slack_bot_token) {
				return false;
			}
			const result = await this.callSlackApi("auth.test", {});
			return result.ok;
		} catch {
			return false;
		}
	}

	getRequiredCredentials(): string[] {
		return ["slack_bot_token"];
	}

	private getActionSchema(action: string): Record<string, any> {
		const schemas: Record<string, Record<string, any>> = {
			send_message: { channel: { type: "string", required: true } },
			create_channel: { name: { type: "string", required: true } },
			update_user_status: { user_id: { type: "string", required: true } },
			get_channel_info: { channel: { type: "string", required: true } },
			list_users: {},
		};

		return schemas[action.toLowerCase()] || {};
	}
}

export default SlackConnector;
