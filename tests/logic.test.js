import { describe, it, expect } from 'vitest';
import * as utils from '../utils.js';

describe('Core Logic Utilities', () => {
  
  describe('money()', () => {
    it('should round to 2 decimal places', () => {
      expect(utils.money(10.555)).toBe(10.56);
      expect(utils.money(10.554)).toBe(10.55);
    });

    it('should handle string inputs', () => {
      expect(utils.money("100")).toBe(100);
    });
  });

  describe('formatMoney()', () => {
    it('should format correctly', () => {
      expect(utils.formatMoney(10)).toBe('$10.00');
      expect(utils.formatMoney(10.5)).toBe('$10.50');
    });
  });

  describe('jobTotal()', () => {
    it('should calculate total with rush fee and tips', () => {
      const testJob = {
        jobPrice: 100,
        rush: true,
        tips: 5
      };
      expect(utils.jobTotal(testJob)).toBe(115);
    });

    it('should calculate total without rush fee', () => {
      const testJob = {
        jobPrice: 100,
        rush: false,
        tips: 5
      };
      expect(utils.jobTotal(testJob)).toBe(105);
    });
  });

  describe('addMonths()', () => {
    it('should advance one month', () => {
      expect(utils.addMonths("2023-01", 1)).toBe("2023-02");
    });

    it('should handle year rollover', () => {
      expect(utils.addMonths("2023-12", 1)).toBe("2024-01");
    });
  });

  describe('csvCell()', () => {
    it('should return normal text', () => {
      expect(utils.csvCell("Normal")).toBe("Normal");
    });

    it('should escape commas', () => {
      expect(utils.csvCell('Comma,')).toBe('"Comma,"');
    });

    it('should escape quotes', () => {
      expect(utils.csvCell('"Quote"')).toBe('"\"Quote\""');
    });
  });
});
