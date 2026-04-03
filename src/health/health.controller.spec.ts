// src/health/health.controller.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  describe('check()', () => {
    it('returns status "ok"', () => {
      const result = controller.check();
      expect(result.status).toBe('ok');
    });

    it('returns a timestamp in ISO 8601 format', () => {
      const before = new Date().toISOString();
      const result = controller.check();
      const after = new Date().toISOString();

      // Must be a valid ISO 8601 date string
      expect(() => new Date(result.timestamp)).not.toThrow();
      expect(new Date(result.timestamp).toISOString()).toBe(result.timestamp);

      // Timestamp must be within the test window
      expect(result.timestamp >= before).toBe(true);
      expect(result.timestamp <= after).toBe(true);
    });

    it('returns an object with exactly "status" and "timestamp" keys', () => {
      const result = controller.check();
      expect(Object.keys(result).sort()).toEqual(['status', 'timestamp']);
    });
  });
});
