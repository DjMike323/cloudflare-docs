/**
 * KAI Visual Connector Library
 * Catalog of available connectors and their actions
 */

export interface ConnectorCategory {
	name: string;
	icon: string;
	connectors: ConnectorInfo[];
}

export interface ConnectorInfo {
	id: string;
	name: string;
	description: string;
	icon: string;
	type: string;
	category: string;
	authentication: "none" | "apikey" | "oauth" | "bearer";
	actions: ConnectorActionInfo[];
	popularity: number; // 1-5 stars
	installed: boolean;
	tags: string[];
}

export interface ConnectorActionInfo {
	id: string;
	name: string;
	description: string;
	inputSchema?: Record<string, any>;
	outputSchema?: Record<string, any>;
	examples?: string[];
}

/**
 * Visual Connector Library Manager
 */
export class ConnectorLibrary {
	private connectors: Map<string, ConnectorInfo> = new Map();
	private categories: Map<string, ConnectorCategory> = new Map();
	private favorites: Set<string> = new Set();

	constructor() {
		this.initializeDefaultConnectors();
	}

	/**
	 * Initialize with built-in connectors
	 */
	private initializeDefaultConnectors(): void {
		// HTTP Connector
		this.addConnector({
			id: "http",
			name: "HTTP/REST",
			description: "Call any REST API endpoint",
			icon: "🌐",
			type: "http",
			category: "API & Webhooks",
			authentication: "none",
			actions: [
				{
					id: "get",
					name: "GET Request",
					description: "Retrieve data from URL",
					inputSchema: {
						url: { type: "string", description: "Full URL to fetch" },
						headers: {
							type: "object",
							description: "Optional custom headers",
						},
					},
					outputSchema: {
						status: { type: "number" },
						body: { type: "object" },
					},
				},
				{
					id: "post",
					name: "POST Request",
					description: "Send data to URL",
					inputSchema: {
						url: { type: "string" },
						body: { type: "object" },
						headers: { type: "object" },
					},
				},
				{
					id: "put",
					name: "PUT Request",
					description: "Update data at URL",
				},
				{
					id: "delete",
					name: "DELETE Request",
					description: "Delete resource at URL",
				},
				{
					id: "patch",
					name: "PATCH Request",
					description: "Partially update resource",
				},
			],
			popularity: 5,
			installed: true,
			tags: ["api", "rest", "http", "webhook"],
		});

		// Slack Connector
		this.addConnector({
			id: "slack",
			name: "Slack",
			description: "Send messages and manage channels",
			icon: "💬",
			type: "service",
			category: "Communication",
			authentication: "bearer",
			actions: [
				{
					id: "send_message",
					name: "Send Message",
					description: "Post message to channel",
					inputSchema: {
						channel: { type: "string", description: "Channel or user ID" },
						text: { type: "string", description: "Message text" },
					},
				},
				{
					id: "create_channel",
					name: "Create Channel",
					description: "Create a new Slack channel",
					inputSchema: {
						name: { type: "string" },
						is_private: { type: "boolean" },
					},
				},
				{
					id: "update_user_status",
					name: "Update User Status",
					description: "Set user status and emoji",
					inputSchema: {
						user_id: { type: "string" },
						status_text: { type: "string" },
						status_emoji: { type: "string" },
					},
				},
				{
					id: "get_channel_info",
					name: "Get Channel Info",
					description: "Retrieve channel details",
				},
				{
					id: "list_users",
					name: "List Users",
					description: "Get list of workspace users",
				},
			],
			popularity: 5,
			installed: true,
			tags: ["messaging", "communication", "slack"],
		});

		// Database Connector (mock for UI)
		this.addConnector({
			id: "database",
			name: "Database Query",
			description: "Execute database queries",
			icon: "🗄️",
			type: "database",
			category: "Data & Storage",
			authentication: "apikey",
			actions: [
				{
					id: "query",
					name: "Execute Query",
					description: "Run SQL query",
				},
				{
					id: "insert",
					name: "Insert Data",
					description: "Add rows to table",
				},
			],
			popularity: 4,
			installed: false,
			tags: ["database", "sql", "data"],
		});

		// Email Connector (mock)
		this.addConnector({
			id: "email",
			name: "Email",
			description: "Send email messages",
			icon: "📧",
			type: "service",
			category: "Communication",
			authentication: "apikey",
			actions: [
				{
					id: "send",
					name: "Send Email",
					description: "Send email to recipients",
				},
			],
			popularity: 4,
			installed: false,
			tags: ["email", "messaging"],
		});

		// Webhook Connector
		this.addConnector({
			id: "webhook",
			name: "Webhook",
			description: "Trigger external webhooks",
			icon: "🪝",
			type: "webhook",
			category: "API & Webhooks",
			authentication: "none",
			actions: [
				{
					id: "trigger",
					name: "Trigger Webhook",
					description: "POST data to webhook URL",
				},
			],
			popularity: 4,
			installed: true,
			tags: ["webhook", "integration"],
		});

		// Create categories
		this.createCategory("API & Webhooks", "🌐", [
			this.connectors.get("http")!,
			this.connectors.get("webhook")!,
		]);

		this.createCategory("Communication", "💬", [
			this.connectors.get("slack")!,
			this.connectors.get("email")!,
		]);

		this.createCategory("Data & Storage", "🗄️", [
			this.connectors.get("database")!,
		]);
	}

	/**
	 * Add a connector to the library
	 */
	addConnector(connector: ConnectorInfo): void {
		this.connectors.set(connector.id, connector);
	}

	/**
	 * Get connector by ID
	 */
	getConnector(id: string): ConnectorInfo | undefined {
		return this.connectors.get(id);
	}

	/**
	 * Get all connectors
	 */
	getAllConnectors(): ConnectorInfo[] {
		return Array.from(this.connectors.values());
	}

	/**
	 * Get installed connectors only
	 */
	getInstalledConnectors(): ConnectorInfo[] {
		return this.getAllConnectors().filter((c) => c.installed);
	}

	/**
	 * Get connectors by category
	 */
	getConnectorsByCategory(category: string): ConnectorInfo[] {
		return this.getAllConnectors().filter((c) => c.category === category);
	}

	/**
	 * Search connectors by name or tags
	 */
	searchConnectors(query: string): ConnectorInfo[] {
		const q = query.toLowerCase();
		return this.getAllConnectors().filter(
			(c) =>
				c.name.toLowerCase().includes(q) ||
				c.description.toLowerCase().includes(q) ||
				c.tags.some((t) => t.toLowerCase().includes(q)),
		);
	}

	/**
	 * Get favorite connectors
	 */
	getFavorites(): ConnectorInfo[] {
		return Array.from(this.favorites)
			.map((id) => this.connectors.get(id))
			.filter((c) => c !== undefined) as ConnectorInfo[];
	}

	/**
	 * Toggle favorite status
	 */
	toggleFavorite(id: string): void {
		if (this.favorites.has(id)) {
			this.favorites.delete(id);
		} else {
			this.favorites.add(id);
		}
	}

	/**
	 * Create a category
	 */
	createCategory(
		name: string,
		icon: string,
		connectors: ConnectorInfo[],
	): void {
		this.categories.set(name, {
			name,
			icon,
			connectors,
		});
	}

	/**
	 * Get all categories
	 */
	getCategories(): ConnectorCategory[] {
		return Array.from(this.categories.values());
	}

	/**
	 * Get category by name
	 */
	getCategory(name: string): ConnectorCategory | undefined {
		return this.categories.get(name);
	}

	/**
	 * Get popular connectors
	 */
	getPopularConnectors(limit: number = 5): ConnectorInfo[] {
		return this.getAllConnectors()
			.sort((a, b) => b.popularity - a.popularity)
			.slice(0, limit);
	}

	/**
	 * Get recently used connectors
	 */
	getRecentlyUsed(): ConnectorInfo[] {
		// In real implementation, this would track usage
		return this.getInstalledConnectors().slice(0, 3);
	}

	/**
	 * Check if connector is installed
	 */
	isInstalled(id: string): boolean {
		const connector = this.connectors.get(id);
		return connector ? connector.installed : false;
	}

	/**
	 * Install a connector
	 */
	installConnector(id: string): boolean {
		const connector = this.connectors.get(id);
		if (connector) {
			connector.installed = true;
			return true;
		}
		return false;
	}

	/**
	 * Uninstall a connector
	 */
	uninstallConnector(id: string): boolean {
		const connector = this.connectors.get(id);
		if (connector) {
			connector.installed = false;
			return true;
		}
		return false;
	}

	/**
	 * Get connector recommendations based on workflow context
	 */
	getRecommendations(context: {
		workflowName?: string;
		currentSteps?: string[];
		tags?: string[];
	}): ConnectorInfo[] {
		const scores = new Map<string, number>();

		for (const connector of this.getInstalledConnectors()) {
			let score = connector.popularity;

			// Boost score if tags match
			if (context.tags) {
				score +=
					context.tags.filter((t) => connector.tags.includes(t)).length * 2;
			}

			scores.set(connector.id, score);
		}

		return Array.from(scores.entries())
			.sort((a, b) => b[1] - a[1])
			.slice(0, 5)
			.map((entry) => this.connectors.get(entry[0])!)
			.filter((c) => c !== undefined);
	}
}
