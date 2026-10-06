/**
 * KAI HTTP Connector
 * REST API integration - GET, POST, PUT, DELETE, PATCH
 */

import { BaseConnector, Env } from "./base";
import { ConnectorAction } from "../types";

export class HttpConnector extends BaseConnector {
	constructor(config: any = {}) {
		super({
			id: "http",
			name: "HTTP",
			type: "http",
			description: "REST API connector for HTTP/HTTPS requests",
			auth: "none",
			...config,
		});
	}

	getActions(): ConnectorAction[] {
		return [
			{
				id: "get",
				name: "GET Request",
				description: "Perform an HTTP GET request",
				inputSchema: {
					url: { type: "string", required: true },
					headers: { type: "object" },
					query: { type: "object" },
					timeout: { type: "number" },
				},
				outputSchema: {
					status: { type: "number" },
					headers: { type: "object" },
					body: { type: "object" },
					text: { type: "string" },
				},
			},
			{
				id: "post",
				name: "POST Request",
				description: "Perform an HTTP POST request",
				inputSchema: {
					url: { type: "string", required: true },
					headers: { type: "object" },
					body: { type: "object" },
					timeout: { type: "number" },
				},
				outputSchema: {
					status: { type: "number" },
					headers: { type: "object" },
					body: { type: "object" },
				},
			},
			{
				id: "put",
				name: "PUT Request",
				description: "Perform an HTTP PUT request",
				inputSchema: {
					url: { type: "string", required: true },
					headers: { type: "object" },
					body: { type: "object" },
					timeout: { type: "number" },
				},
			},
			{
				id: "delete",
				name: "DELETE Request",
				description: "Perform an HTTP DELETE request",
				inputSchema: {
					url: { type: "string", required: true },
					headers: { type: "object" },
					timeout: { type: "number" },
				},
			},
			{
				id: "patch",
				name: "PATCH Request",
				description: "Perform an HTTP PATCH request",
				inputSchema: {
					url: { type: "string", required: true },
					headers: { type: "object" },
					body: { type: "object" },
					timeout: { type: "number" },
				},
			},
		];
	}

	async execute(
		action: string,
		params: Record<string, any>,
		env: Env,
	): Promise<any> {
		this.validateInput(params, this.getActionSchema(action));

		const { url, headers = {}, body, query, timeout = 30000 } = params;

		// Build URL with query params
		const urlObj = new URL(url);
		if (query) {
			for (const [key, value] of Object.entries(query)) {
				urlObj.searchParams.append(key, String(value));
			}
		}

		const options: RequestInit = {
			method: action.toUpperCase(),
			headers: {
				"Content-Type": "application/json",
				...headers,
			},
		};

		if (body && ["POST", "PUT", "PATCH"].includes(action.toUpperCase())) {
			options.body = typeof body === "string" ? body : JSON.stringify(body);
		}

		try {
			const response = await this.withTimeout(
				fetch(urlObj.toString(), options),
				timeout,
			);

			const contentType = response.headers.get("content-type");
			let responseBody: any;

			if (contentType?.includes("application/json")) {
				responseBody = await response.json();
			} else if (contentType?.includes("text")) {
				responseBody = await response.text();
			} else {
				responseBody = await response.arrayBuffer();
			}

			return {
				status: response.status,
				headers: Object.fromEntries(response.headers),
				body: responseBody,
				ok: response.ok,
			};
		} catch (error) {
			throw new Error(`HTTP request failed: ${(error as Error).message}`);
		}
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
		try {
			const result = await this.execute(
				"get",
				{ url: "https://api.example.com/health" },
				env,
			);
			return result.status < 500;
		} catch {
			return false;
		}
	}

	private getActionSchema(action: string): Record<string, any> {
		const schemas: Record<string, Record<string, any>> = {
			get: { url: { type: "string", required: true } },
			post: { url: { type: "string", required: true } },
			put: { url: { type: "string", required: true } },
			delete: { url: { type: "string", required: true } },
			patch: { url: { type: "string", required: true } },
		};

		return schemas[action.toLowerCase()] || {};
	}
}

export default HttpConnector;
