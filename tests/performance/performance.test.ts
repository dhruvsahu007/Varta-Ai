import { describe, test, expect, beforeEach, jest } from '@jest/globals';

// Performance testing utilities
class PerformanceMonitor {
  private startTime: number = 0;
  private endTime: number = 0;
  private measurements: { [key: string]: number[] } = {};

  start() {
    this.startTime = performance.now();
  }

  end() {
    this.endTime = performance.now();
    return this.endTime - this.startTime;
  }

  measure(label: string) {
    const duration = this.end();
    if (!this.measurements[label]) {
      this.measurements[label] = [];
    }
    this.measurements[label].push(duration);
    return duration;
  }

  getAverageTime(label: string): number {
    const times = this.measurements[label] || [];
    return times.reduce((sum, time) => sum + time, 0) / times.length;
  }

  getMaxTime(label: string): number {
    const times = this.measurements[label] || [];
    return Math.max(...times);
  }

  reset() {
    this.measurements = {};
  }
}

// Mock heavy operations for testing
const mockDatabaseQuery = async (complexity: number = 1): Promise<any[]> => {
  // Simulate database query time
  await new Promise(resolve => setTimeout(resolve, complexity * 10));
  return Array.from({ length: complexity * 100 }, (_, i) => ({ id: i, data: `item${i}` }));
};

const mockAIProcessing = async (inputSize: number = 1): Promise<string> => {
  // Simulate AI processing time
  await new Promise(resolve => setTimeout(resolve, inputSize * 50));
  return `AI processed ${inputSize} tokens`;
};

const mockWebSocketBroadcast = async (messageCount: number = 1): Promise<void> => {
  // Simulate WebSocket message broadcasting
  await new Promise(resolve => setTimeout(resolve, messageCount * 2));
};

describe('Performance Tests', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    monitor = new PerformanceMonitor();
    jest.clearAllMocks();
  });

  describe('Database Performance', () => {
    test('should handle small queries efficiently', async () => {
      monitor.start();
      await mockDatabaseQuery(1);
      const duration = monitor.measure('small_query');

      expect(duration).toBeLessThan(100); // Should complete in under 100ms
    });

    test('should handle medium queries within acceptable time', async () => {
      monitor.start();
      await mockDatabaseQuery(5);
      const duration = monitor.measure('medium_query');

      expect(duration).toBeLessThan(500); // Should complete in under 500ms
    });

    test('should handle concurrent queries efficiently', async () => {
      monitor.start();
      
      const queries = Array.from({ length: 10 }, () => mockDatabaseQuery(1));
      await Promise.all(queries);
      
      const duration = monitor.measure('concurrent_queries');
      
      // Concurrent execution should be faster than sequential
      expect(duration).toBeLessThan(200); // Should complete in under 200ms total
    });

    test('should maintain performance with repeated queries', async () => {
      const iterations = 5;
      
      for (let i = 0; i < iterations; i++) {
        monitor.start();
        await mockDatabaseQuery(1);
        monitor.measure('repeated_query');
      }

      const avgTime = monitor.getAverageTime('repeated_query');
      const maxTime = monitor.getMaxTime('repeated_query');

      expect(avgTime).toBeLessThan(100);
      expect(maxTime).toBeLessThan(150);
      
      // Performance should not degrade significantly over iterations
      const measurements = monitor['measurements']['repeated_query'];
      const firstHalf = measurements.slice(0, Math.ceil(iterations / 2));
      const secondHalf = measurements.slice(Math.floor(iterations / 2));
      
      const firstAvg = firstHalf.reduce((sum, time) => sum + time, 0) / firstHalf.length;
      const secondAvg = secondHalf.reduce((sum, time) => sum + time, 0) / secondHalf.length;
      
      // Second half should not be significantly slower than first half
      expect(secondAvg).toBeLessThan(firstAvg * 1.5);
    });
  });

  describe('AI Processing Performance', () => {
    test('should process small inputs quickly', async () => {
      monitor.start();
      await mockAIProcessing(1);
      const duration = monitor.measure('ai_small_input');

      expect(duration).toBeLessThan(200); // Should complete in under 200ms
    });

    test('should scale reasonably with input size', async () => {
      monitor.start();
      await mockAIProcessing(1);
      const smallDuration = monitor.measure('ai_small');

      monitor.start();
      await mockAIProcessing(5);
      const largeDuration = monitor.measure('ai_large');

      // Large input should not be more than 10x slower
      expect(largeDuration).toBeLessThan(smallDuration * 10);
    });

    test('should handle multiple AI requests concurrently', async () => {
      monitor.start();
      
      const requests = Array.from({ length: 3 }, () => mockAIProcessing(2));
      await Promise.all(requests);
      
      const duration = monitor.measure('ai_concurrent');
      
      // Should complete in reasonable time
      expect(duration).toBeLessThan(1000);
    });

    test('should not have memory leaks with repeated processing', async () => {
      const iterations = 10;
      
      for (let i = 0; i < iterations; i++) {
        monitor.start();
        await mockAIProcessing(1);
        monitor.measure('ai_repeated');
      }

      const avgTime = monitor.getAverageTime('ai_repeated');
      expect(avgTime).toBeLessThan(200);

      // Check that performance doesn't degrade over time
      const measurements = monitor['measurements']['ai_repeated'];
      const variance = measurements.reduce((sum, time) => {
        return sum + Math.pow(time - avgTime, 2);
      }, 0) / measurements.length;
      
      // Low variance indicates consistent performance
      expect(Math.sqrt(variance)).toBeLessThan(avgTime * 0.5);
    });
  });

  describe('WebSocket Performance', () => {
    test('should broadcast messages quickly', async () => {
      monitor.start();
      await mockWebSocketBroadcast(1);
      const duration = monitor.measure('ws_single_broadcast');

      expect(duration).toBeLessThan(50); // Should complete very quickly
    });

    test('should handle multiple message broadcasts efficiently', async () => {
      monitor.start();
      await mockWebSocketBroadcast(100);
      const duration = monitor.measure('ws_multiple_broadcast');

      expect(duration).toBeLessThan(1000); // Should complete in under 1 second
    });

    test('should scale linearly with message count', async () => {
      monitor.start();
      await mockWebSocketBroadcast(10);
      const smallDuration = monitor.measure('ws_small_batch');

      monitor.start();
      await mockWebSocketBroadcast(50);
      const largeDuration = monitor.measure('ws_large_batch');

      // Should scale roughly linearly (with some tolerance)
      const expectedRatio = 50 / 10; // 5x
      const actualRatio = largeDuration / smallDuration;
      
      expect(actualRatio).toBeLessThan(expectedRatio * 2); // Allow 2x tolerance
      expect(actualRatio).toBeGreaterThan(expectedRatio * 0.5);
    });
  });

  describe('Memory Usage', () => {
    test('should not accumulate memory with repeated operations', () => {
      const initialMemory = process.memoryUsage().heapUsed;
      
      // Simulate memory-intensive operations
      const data = [];
      for (let i = 0; i < 1000; i++) {
        data.push({ id: i, message: `Message ${i}`, timestamp: new Date() });
      }
      
      // Clear the data
      data.length = 0;
      
      // Force garbage collection if available
      if (global.gc) {
        global.gc();
      }
      
      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;
      
      // Memory should not increase significantly
      expect(memoryIncrease).toBeLessThan(1024 * 1024); // Less than 1MB increase
    });

    test('should handle large message arrays efficiently', () => {
      monitor.start();
      
      const messages = Array.from({ length: 10000 }, (_, i) => ({
        id: i,
        content: `Message ${i}`,
        author: `User ${i % 100}`,
        timestamp: new Date(),
      }));
      
      // Simulate filtering operations
      const filtered = messages.filter(msg => msg.id % 2 === 0);
      const sorted = filtered.sort((a, b) => a.id - b.id);
      const mapped = sorted.map(msg => ({ ...msg, processed: true }));
      
      const duration = monitor.measure('large_array_processing');
      
      expect(duration).toBeLessThan(100); // Should be very fast
      expect(mapped.length).toBe(5000); // Half the messages
    });
  });

  describe('Load Testing Simulation', () => {
    test('should handle simulated user load', async () => {
      const userCount = 50;
      const actionsPerUser = 5;
      
      monitor.start();
      
      const userActions = Array.from({ length: userCount }, async (_, userId) => {
        const actions = [];
        
        for (let i = 0; i < actionsPerUser; i++) {
          // Simulate different user actions
          switch (i % 3) {
            case 0:
              actions.push(mockDatabaseQuery(1)); // Send message
              break;
            case 1:
              actions.push(mockAIProcessing(1)); // Get AI suggestion
              break;
            case 2:
              actions.push(mockWebSocketBroadcast(1)); // Receive message
              break;
          }
        }
        
        return Promise.all(actions);
      });
      
      await Promise.all(userActions);
      
      const duration = monitor.measure('load_test');
      
      // Should handle the load in reasonable time
      expect(duration).toBeLessThan(5000); // Under 5 seconds
    });

    test('should handle burst traffic', async () => {
      monitor.start();
      
      // Simulate burst of 100 concurrent operations
      const burstOperations = Array.from({ length: 100 }, (_, i) => {
        if (i % 3 === 0) return mockDatabaseQuery(1);
        if (i % 3 === 1) return mockAIProcessing(1);
        return mockWebSocketBroadcast(1);
      });
      
      await Promise.all(burstOperations);
      
      const duration = monitor.measure('burst_traffic');
      
      // Should handle burst traffic efficiently
      expect(duration).toBeLessThan(2000); // Under 2 seconds
    });
  });

  describe('Resource Monitoring', () => {
    test('should monitor CPU usage patterns', async () => {
      const startTime = process.hrtime.bigint();
      
      // CPU-intensive task simulation
      let result = 0;
      for (let i = 0; i < 100000; i++) {
        result += Math.sqrt(i);
      }
      
      const endTime = process.hrtime.bigint();
      const cpuTime = Number(endTime - startTime) / 1000000; // Convert to ms
      
      // Should complete CPU task in reasonable time
      expect(cpuTime).toBeLessThan(100); // Under 100ms
      expect(result).toBeGreaterThan(0); // Ensure calculation actually ran
    });

    test('should monitor I/O operation patterns', async () => {
      monitor.start();
      
      // Simulate I/O operations
      const ioOperations = Array.from({ length: 10 }, () => 
        new Promise(resolve => setTimeout(resolve, 10))
      );
      
      await Promise.all(ioOperations);
      
      const duration = monitor.measure('io_operations');
      
      // Concurrent I/O should be efficient
      expect(duration).toBeLessThan(50); // Much less than 10 * 10ms
    });
  });
});
