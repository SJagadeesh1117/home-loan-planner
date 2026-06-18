import { describe, it, expect } from 'vitest';
import { calculateStandardEmi, generateAmortizationSchedule } from './engine';

describe('Home Loan Calculation Engine', () => {
  it('calculates standard EMI correctly', () => {
    // 50 Lakhs, 8.5%, 20 years
    const emi = calculateStandardEmi(5000000, 8.5, 20);
    expect(Math.round(emi)).toBe(43391);
  });

  it('generates a correct amortization schedule without prepayments', () => {
    const details = {
      principal: 5000000,
      interestRate: 8.5,
      tenureYears: 20,
      startDate: new Date('2024-01-01T00:00:00Z')
    };
    
    const result = generateAmortizationSchedule(
      details,
      { enabled: false, type: 'percentage', value: 0, frequency: 'yearly', applyMonthIndex: 0 },
      []
    );

    expect(result.schedule.length).toBe(240); // 20 years * 12 months
    // Total payment should roughly be EMI * 240
    const expectedTotal = 43391.21 * 240;
    expect(Math.abs(result.totalPayment - expectedTotal)).toBeLessThan(100);
    // Ending balance should be 0
    expect(result.schedule[result.schedule.length - 1].closingBalance).toBe(0);
  });

  it('handles step-up EMI (percentage)', () => {
    const details = {
      principal: 5000000,
      interestRate: 8.5,
      tenureYears: 20,
      startDate: new Date('2024-01-01T00:00:00Z')
    };
    
    const result = generateAmortizationSchedule(
      details,
      { enabled: true, type: 'percentage', value: 5, frequency: 'yearly', applyMonthIndex: 0 }, // 5% increase on anniversary
      []
    );

    // Tenure should be significantly less than 240 months
    expect(result.schedule.length).toBeLessThan(240);
    
    // Check if EMI increased in the 13th month
    const month12 = result.schedule.find(r => r.month === 12);
    const month13 = result.schedule.find(r => r.month === 13);
    
    expect(month12?.emi).toBeLessThan(month13?.emi!);
    expect(Math.round(month13!.emi)).toBe(Math.round(month12!.emi * 1.05));
  });

  it('handles step-up prepayments correctly', () => {
    const details = {
      principal: 5000000,
      interestRate: 8.5,
      tenureYears: 20,
      startDate: new Date('2024-01-01T00:00:00Z')
    };

    const result = generateAmortizationSchedule(
      details,
      { enabled: false, type: 'percentage', value: 0, frequency: 'yearly', applyMonthIndex: 0 },
      [{
        id: '1',
        amount: 10000,
        type: 'recurring',
        recurringFrequency: 'yearly',
        startMonthIndex: 12,
        stepUpType: 'fixed',
        stepUpValue: 5000
      }]
    );

    // Year 1 prepayment (month 12): 10,000
    const month12 = result.schedule.find(r => r.month === 12);
    expect(month12?.prepayment).toBe(10000);

    // Year 2 prepayment (month 24): 10,000 + 5,000 = 15,000
    const month24 = result.schedule.find(r => r.month === 24);
    expect(month24?.prepayment).toBe(15000);
  });
});
