import { addMonths } from 'date-fns';

export interface LoanDetails {
  principal: number;
  interestRate: number; // annual
  tenureYears: number;
  startDate: Date;
  customEmi?: number;
}

export interface StepUpSettings {
  enabled: boolean;
  type: 'percentage' | 'fixed';
  value: number; // e.g., 5 for 5% or 5000 for 5000 rupees
  frequency: 'yearly'; // usually yearly
  applyMonthIndex: number; // 0 for Anniversary, 1 for January
}

export interface Prepayment {
  id: string;
  amount: number;
  type: 'one-time' | 'recurring';
  date?: Date; // For one-time prepayment
  recurringFrequency?: 'monthly' | 'quarterly' | 'half-yearly' | 'yearly';
  startMonthIndex?: number;
  stepUpType?: 'percentage' | 'fixed';
  stepUpValue?: number;
}

export interface AmortizationRow {
  month: number;
  date: Date;
  openingBalance: number;
  emi: number;
  interest: number;
  principalComponent: number;
  prepayment: number;
  closingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface LoanResult {
  original: {
    emi: number;
    totalInterest: number;
    totalPayment: number;
    endDate: Date;
    tenureMonths: number;
    schedule: AmortizationRow[];
  };
  revised: {
    emi: number; // initial EMI
    totalInterest: number;
    totalPayment: number;
    endDate: Date;
    tenureMonths: number;
    schedule: AmortizationRow[];
  };
  savings: {
    interestSaved: number;
    tenureReducedMonths: number;
  };
}

export function calculateStandardEmi(principal: number, annualRate: number, tenureYears: number): number {
  if (annualRate === 0) return principal / (tenureYears * 12);
  const r = annualRate / 12 / 100;
  const n = tenureYears * 12;
  const emi = (principal * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return emi;
}

export function generateAmortizationSchedule(
  details: LoanDetails,
  stepUp: StepUpSettings,
  prepayments: Prepayment[]
): { emi: number; schedule: AmortizationRow[]; totalInterest: number; totalPayment: number; endDate: Date; tenureMonths: number } {
  const schedule: AmortizationRow[] = [];
  let currentBalance = details.principal;
  let currentEmi = details.customEmi && details.customEmi > 0 
    ? details.customEmi 
    : calculateStandardEmi(details.principal, details.interestRate, details.tenureYears);
  
  const initialEmi = currentEmi;
  const monthlyRate = details.interestRate / 12 / 100;
  let cumulativeInterest = 0;
  let cumulativePrincipal = 0;
  let month = 1;
  const maxMonths = details.tenureYears * 12 * 2;

  const startDate = new Date(details.startDate);

  while (currentBalance > 0.01 && month <= maxMonths) {
    const currentDate = addMonths(startDate, month - 1);
    
    // Step-up EMI Check
    if (stepUp.enabled) {
      const isAnniversaryMonth = (month - 1) % 12 === 0 && month > 1;
      const isJanuary = currentDate.getMonth() === 0 && month > 1;
      
      let shouldStepUp = false;
      if (stepUp.applyMonthIndex === 0 && isAnniversaryMonth) {
        shouldStepUp = true;
      } else if (stepUp.applyMonthIndex === 1 && isJanuary) {
        shouldStepUp = true;
      }

      if (shouldStepUp) {
        if (stepUp.type === 'percentage') {
          currentEmi = currentEmi * (1 + stepUp.value / 100);
        } else if (stepUp.type === 'fixed') {
          currentEmi = currentEmi + stepUp.value;
        }
      }
    }

    const interestForMonth = currentBalance * monthlyRate;
    
    // Prepayments Check
    let prepaymentForMonth = 0;
    prepayments.forEach(p => {
      if (p.type === 'one-time' && p.date) {
        const pDate = new Date(p.date);
        if (pDate.getFullYear() === currentDate.getFullYear() && pDate.getMonth() === currentDate.getMonth()) {
          prepaymentForMonth += p.amount;
        }
      } else if (p.type === 'recurring') {
        const startMonthIndex = p.startMonthIndex || 1;
        if (month >= startMonthIndex) {
          const monthsSinceStart = month - startMonthIndex;
          let triggers = false;
          if (p.recurringFrequency === 'monthly') triggers = true;
          else if (p.recurringFrequency === 'quarterly' && monthsSinceStart % 3 === 0) triggers = true;
          else if (p.recurringFrequency === 'half-yearly' && monthsSinceStart % 6 === 0) triggers = true;
          else if (p.recurringFrequency === 'yearly' && monthsSinceStart % 12 === 0) triggers = true;
          
          if (triggers) {
            let currentPrepaymentAmount = p.amount;
            if (p.stepUpType && p.stepUpValue) {
              const yearsElapsed = Math.floor(monthsSinceStart / 12);
              if (yearsElapsed > 0) {
                if (p.stepUpType === 'percentage') {
                  currentPrepaymentAmount = currentPrepaymentAmount * Math.pow(1 + p.stepUpValue / 100, yearsElapsed);
                } else if (p.stepUpType === 'fixed') {
                  currentPrepaymentAmount = currentPrepaymentAmount + (p.stepUpValue * yearsElapsed);
                }
              }
            }
            prepaymentForMonth += currentPrepaymentAmount;
          }
        }
      }
    });

    let principalComponentForMonth = currentEmi - interestForMonth;
    
    // Final month scenario adjustments
    if (currentBalance + interestForMonth <= currentEmi + prepaymentForMonth) {
      if (currentBalance + interestForMonth <= currentEmi) {
        currentEmi = currentBalance + interestForMonth;
        principalComponentForMonth = currentBalance;
        prepaymentForMonth = 0;
      } else {
        principalComponentForMonth = currentEmi - interestForMonth;
        prepaymentForMonth = currentBalance - principalComponentForMonth;
      }
    }

    const totalPrincipalReduction = principalComponentForMonth + prepaymentForMonth;

    let closingBalance = currentBalance - totalPrincipalReduction;
    if (closingBalance < 0.01) closingBalance = 0;

    cumulativeInterest += interestForMonth;
    cumulativePrincipal += totalPrincipalReduction;

    schedule.push({
      month,
      date: currentDate,
      openingBalance: currentBalance,
      emi: currentEmi,
      interest: interestForMonth,
      principalComponent: principalComponentForMonth,
      prepayment: prepaymentForMonth,
      closingBalance,
      cumulativeInterest,
      cumulativePrincipal,
    });

    currentBalance = closingBalance;
    month++;
  }

  const finalEndDate = schedule.length > 0 ? schedule[schedule.length - 1].date : new Date(details.startDate);

  return {
    emi: initialEmi,
    schedule,
    totalInterest: cumulativeInterest,
    totalPayment: details.principal + cumulativeInterest,
    endDate: finalEndDate,
    tenureMonths: schedule.length
  };
}

export function simulateLoan(
  details: LoanDetails,
  stepUp: StepUpSettings,
  prepayments: Prepayment[]
): LoanResult {
  const original = generateAmortizationSchedule(
    details,
    { enabled: false, type: 'percentage', value: 0, frequency: 'yearly', applyMonthIndex: 0 },
    []
  );

  const revised = generateAmortizationSchedule(details, stepUp, prepayments);

  return {
    original,
    revised,
    savings: {
      interestSaved: Math.max(0, original.totalInterest - revised.totalInterest),
      tenureReducedMonths: Math.max(0, original.tenureMonths - revised.tenureMonths)
    }
  };
}
