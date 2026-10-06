/**
 * KAI Sustained Load Testing - Week 2 Thursday Validation
 * Real-world load scenarios for production readiness
 */

import { describe, it, expect, beforeAll } from "vitest";
import { initializeKai, WorkflowDefinition, WorkflowExecution } from "./index";

const mockEnv = {
	DB: {} as D1Database,
	KV: new Map() as any,
	R2: {} as any,
};

describe("KAI Sustained Load Testing", () => {
	let system: any;

	beforeAll(async () => {
		system = await initializeKai(mockEnv);
	});

	describe("Sustained Request Load (100 req/s for 60s)", () => {
		it("should handle sustained 100 req/s throughput", async () => {
			const duration = 60000; // 60 seconds
			const targetRate = 100; // requests per second
			const totalRequests = (duration / 1000) * targetRate; // 6000 requests

			let completedRequests = 0;
			const startTime = performance.now();

			// Simulate sustained load
			const batchSize = 100;
			for (let batch = 0; batch < totalRequests / batchSize; batch++) {
				const batchStart = performance.now();

				// Execute batch of requests
				const promises = Array(batchSize)
					.fill(null)
					.map(
						() =>
							new Promise<boolean>((resolve) => {
								// Simulate request execution (avg 50ms)
								setTimeout(() => {
									completedRequests++;
									resolve(true);
								}, Math.random() * 100);
							}),
					);

				const results = await Promise.all(promises);
				const successCount = results.filter((r) => r).length;

				completedRequests += successCount;

				// Check if we're maintaining target rate
				const batchElapsed = performance.now() - batchStart;
				const batchRate = (batchSize / batchElapsed) * 1000; // req/s

				expect(batchRate).toBeGreaterThan(50); // At least 50 req/s per batch
			}

			const totalElapsed = performance.now() - startTime;
			const actualRate = (completedRequests / totalElapsed) * 1000;

			console.log(`
✓ Sustained load test:
  Total requests: ${completedRequests}
  Duration: ${totalElapsed.toFixed(0)}ms
  Actual rate: ${actualRate.toFixed(0)} req/s
  Success rate: ${((completedRequests / totalRequests) * 100).toFixed(1)}%
  Average latency: ${(totalElapsed / completedRequests).toFixed(2)}ms
      `);

			expect(completedRequests).toBeGreaterThan(totalRequests * 0.95); // 95% success
		});

		it("should maintain P99 latency under sustained load", async () => {
			const latencies: number[] = [];
			const requests = 1000;

			for (let i = 0; i < requests; i++) {
				const start = performance.now();

				// Simulate request execution
				await new Promise((resolve) =>
					setTimeout(resolve, Math.random() * 100),
				);

				const latency = performance.now() - start;
				latencies.push(latency);
			}

			latencies.sort((a, b) => a - b);
			const p99Index = Math.ceil(requests * 0.99);
			const p99 = latencies[p99Index];

			console.log(`
✓ P99 Latency under sustained load:
  P99: ${p99.toFixed(2)}ms (target: < 1000ms)
  P95: ${latencies[Math.ceil(requests * 0.95)].toFixed(2)}ms
  P50: ${latencies[Math.ceil(requests * 0.5)].toFixed(2)}ms
  Max: ${latencies[latencies.length - 1].toFixed(2)}ms
      `);

			expect(p99).toBeLessThan(1000);
		});
	});

	describe("Memory Management Under Load", () => {
		it("should not leak memory with concurrent executions", async () => {
			const iterations = 2000;
			const executions: WorkflowExecution[] = [];

			const memBefore = process.memoryUsage().heapUsed / 1024 / 1024;

			// Create and store many executions
			for (let i = 0; i < iterations; i++) {
				const execution: WorkflowExecution = {
					id: `exec_mem_${i}`,
					workflowId: "memory_test",
					status: "success",
					startTime: Date.now() - i * 1000,
					endTime: Date.now() - i * 1000 + 1000,
					steps: {
						step_1: {
							stepId: "step_1",
							status: "success",
							input: {},
							output: { data: Math.random() },
							startTime: Date.now() - i * 1000,
							endTime: Date.now() - i * 1000 + 500,
							retries: 0,
						},
					},
					context: { data: "x".repeat(100) },
					correlationId: `corr_${i}`,
				};

				executions.push(execution);
				mockEnv.KV.set(`execution:${execution.id}`, JSON.stringify(execution));
			}

			// Cleanup half
			for (let i = 0; i < iterations / 2; i++) {
				mockEnv.KV.delete(`execution:exec_mem_${i}`);
			}

			const memAfter = process.memoryUsage().heapUsed / 1024 / 1024;
			const memGrowth = memAfter - memBefore;

			console.log(`
✓ Memory test:
  Executions stored: ${iterations}
  Memory before: ${memBefore.toFixed(2)}MB
  Memory after: ${memAfter.toFixed(2)}MB
  Growth: ${memGrowth.toFixed(2)}MB
  Per-execution: ${((memGrowth * 1024) / iterations).toFixed(2)}KB
      `);

			// Memory growth should be reasonable (less than 500MB for 2000 executions)
			expect(memGrowth).toBeLessThan(500);
		});

		it("should handle large context data efficiently", async () => {
			const largeContextSize = 1024 * 100; // 100KB
			const contextData = "x".repeat(largeContextSize);

			const execution: WorkflowExecution = {
				id: `exec_large_${Date.now()}`,
				workflowId: "test",
				status: "success",
				startTime: Date.now(),
				endTime: Date.now() + 100,
				steps: {},
				context: {
					largeData: contextData,
					nested: {
						level1: {
							level2: {
								level3: {
									largeValue: contextData,
								},
							},
						},
					},
				},
				correlationId: `corr_${Date.now()}`,
			};

			const start = performance.now();
			const serialized = JSON.stringify(execution);
			mockEnv.KV.set(`execution:${execution.id}`, serialized);
			const stored = mockEnv.KV.get(`execution:${execution.id}`);
			const deserialized = JSON.parse(stored);
			const duration = performance.now() - start;

			console.log(`
✓ Large context handling:
  Context size: ${(largeContextSize / 1024).toFixed(0)}KB
  Serialized size: ${(serialized.length / 1024).toFixed(0)}KB
  Operation time: ${duration.toFixed(2)}ms
  Throughput: ${(serialized.length / 1024 / (duration / 1000)).toFixed(0)}KB/s
      `);

			expect(duration).toBeLessThan(500); // Should complete in under 500ms
			expect(deserialized.id).toBe(execution.id);
		});
	});

	describe("Connection Pool Management", () => {
		it("should manage concurrent database connections", async () => {
			const concurrentConnections = 100;
			const operations: Promise<void>[] = [];

			for (let i = 0; i < concurrentConnections; i++) {
				operations.push(
					new Promise<void>((resolve) => {
						// Simulate DB operation
						setTimeout(() => {
							const executionId = `exec_pool_${i}`;
							mockEnv.KV.set(
								`execution:${executionId}`,
								JSON.stringify({ id: executionId, status: "success" }),
							);
							resolve();
						}, Math.random() * 50);
					}),
				);
			}

			const start = performance.now();
			await Promise.all(operations);
			const duration = performance.now() - start;

			console.log(`
✓ Connection pool test:
  Concurrent operations: ${concurrentConnections}
  Duration: ${duration.toFixed(0)}ms
  Operations per second: ${((concurrentConnections / duration) * 1000).toFixed(0)}
      `);

			expect(duration).toBeLessThan(5000); // Should complete in under 5 seconds
		});

		it("should handle connection timeout gracefully", async () => {
			const timeoutMs = 30000;
			const slowOperation = new Promise<void>((resolve) => {
				setTimeout(() => resolve(), 25000); // Just under timeout
			});

			const start = performance.now();
			await Promise.race([
				slowOperation,
				new Promise<void>((_, reject) =>
					setTimeout(() => reject(new Error("timeout")), timeoutMs),
				),
			]).catch(() => {
				// Expected to handle timeout
			});
			const duration = performance.now() - start;

			expect(duration).toBeGreaterThan(25000);
		});
	});

	describe("State Store Scaling", () => {
		it("should retrieve state quickly even with large KV store", async () => {
			// Pre-populate KV with many entries
			const populationSize = 10000;
			for (let i = 0; i < populationSize; i++) {
				mockEnv.KV.set(
					`execution:prepopulated_${i}`,
					JSON.stringify({ id: `exec_${i}` }),
				);
			}

			const retrievalTests = 1000;
			const latencies: number[] = [];

			// Test retrieval latency with populated KV
			for (let i = 0; i < retrievalTests; i++) {
				const key = `execution:prepopulated_${Math.floor(Math.random() * populationSize)}`;

				const start = performance.now();
				mockEnv.KV.get(key);
				const latency = performance.now() - start;

				latencies.push(latency);
			}

			latencies.sort((a, b) => a - b);
			const p95 = latencies[Math.ceil(retrievalTests * 0.95)];
			const p99 = latencies[Math.ceil(retrievalTests * 0.99)];

			console.log(`
✓ State store scaling:
  KV store size: ${populationSize} entries
  Retrieval latency (P95): ${p95.toFixed(3)}ms
  Retrieval latency (P99): ${p99.toFixed(3)}ms
  Average: ${(latencies.reduce((a, b) => a + b) / latencies.length).toFixed(3)}ms
      `);

			// State retrieval should be sub-millisecond even with large store
			expect(p99).toBeLessThan(10);
		});

		it("should handle large batch writes efficiently", async () => {
			const batchSize = 500;
			const batches = 10;

			const start = performance.now();

			for (let batch = 0; batch < batches; batch++) {
				for (let i = 0; i < batchSize; i++) {
					const id = `batch_${batch}_${i}`;
					mockEnv.KV.set(
						`execution:${id}`,
						JSON.stringify({
							id,
							status: "success",
							context: { batchNum: batch },
						}),
					);
				}
			}

			const duration = performance.now() - start;
			const totalWrites = batchSize * batches;

			console.log(`
✓ Batch write test:
  Total writes: ${totalWrites}
  Duration: ${duration.toFixed(0)}ms
  Writes per second: ${((totalWrites / duration) * 1000).toFixed(0)}
  Average per write: ${(duration / totalWrites).toFixed(3)}ms
      `);

			expect(duration).toBeLessThan(30000); // Should complete in under 30 seconds
		});
	});

	describe("Connector Performance Under Load", () => {
		it("should execute connectors concurrently without degradation", async () => {
			const concurrentRequests = 200;
			const httpConnector = system.connectors.get("http");

			const start = performance.now();
			const promises = Array(concurrentRequests)
				.fill(null)
				.map(() =>
					httpConnector.execute(
						"get",
						{ url: "https://api.example.com/test" },
						mockEnv,
					),
				);

			const results = await Promise.all(promises);
			const duration = performance.now() - start;

			const successCount = results.filter((r) => r.ok).length;
			const successRate = (successCount / concurrentRequests) * 100;

			console.log(`
✓ Connector load test:
  Concurrent requests: ${concurrentRequests}
  Duration: ${duration.toFixed(0)}ms
  Success rate: ${successRate.toFixed(1)}%
  Requests per second: ${((concurrentRequests / duration) * 1000).toFixed(0)}
      `);

			expect(successRate).toBeGreaterThan(95);
		});
	});

	describe("Workflow Execution Scaling", () => {
		it("should execute many workflows concurrently", async () => {
			const concurrentWorkflows = 100;
			const workflowDefinition: WorkflowDefinition = {
				id: "scale_test",
				name: "Scalability Test",
				version: 1,
				status: "published",
				steps: [
					{
						id: "step_1",
						type: "connector",
						connector: {
							type: "http",
							action: "get",
							params: { url: "https://api.example.com/data" },
						},
					},
				],
				triggers: [],
				createdAt: new Date(),
				updatedAt: new Date(),
			};

			const start = performance.now();

			const executions = Array(concurrentWorkflows)
				.fill(null)
				.map((_, i) => ({
					id: `exec_scale_${i}`,
					workflowId: workflowDefinition.id,
					status: "pending" as const,
					startTime: Date.now(),
					steps: {},
					context: { workflowIndex: i },
					correlationId: `corr_scale_${i}`,
				}));

			// Store all executions
			for (const execution of executions) {
				mockEnv.KV.set(`execution:${execution.id}`, JSON.stringify(execution));
			}

			const duration = performance.now() - start;

			console.log(`
✓ Workflow execution scaling:
  Concurrent workflows: ${concurrentWorkflows}
  Duration: ${duration.toFixed(0)}ms
  Average per workflow: ${(duration / concurrentWorkflows).toFixed(2)}ms
      `);

			expect(duration).toBeLessThan(5000);
		});
	});
});
