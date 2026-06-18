"use client";

import { useState, useMemo } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { simulateLoan, LoanDetails, StepUpSettings, Prepayment } from '@/lib/engine';
import { format } from 'date-fns';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, AreaChart, Area, BarChart, Bar } from 'recharts';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useEffect } from 'react';
import React from 'react';
import { PlusSquare, MinusSquare } from 'lucide-react';

function numberToWordsIndian(num: number): string {
    if (num === 0) return 'zero rupees only';
    
    const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const formatDecades = (n: number) => {
        if (n < 20) return a[n] + ' ';
        return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '') + ' ';
    };

    let result = '';
    
    if (Math.floor(num / 10000000) > 0) {
        result += formatDecades(Math.floor(num / 10000000)) + 'Crore ';
        num %= 10000000;
    }
    if (Math.floor(num / 100000) > 0) {
        result += formatDecades(Math.floor(num / 100000)) + 'Lakh ';
        num %= 100000;
    }
    if (Math.floor(num / 1000) > 0) {
        result += formatDecades(Math.floor(num / 1000)) + 'Thousand ';
        num %= 1000;
    }
    if (Math.floor(num / 100) > 0) {
        result += formatDecades(Math.floor(num / 100)) + 'Hundred ';
        num %= 100;
    }
    if (num > 0) {
        result += formatDecades(num);
    }
    
    return result.trim() + ' rupees only';
}

function FormattedInput({ value, onChange, isDecimal = false, className, placeholder }: any) {
  const [localVal, setLocalVal] = useState(() => {
    if (value === 0) return '0';
    return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value);
  });

  useEffect(() => {
    const parsedLocal = Number(localVal.replace(/,/g, ''));
    if (parsedLocal !== value && !Number.isNaN(value)) {
      setLocalVal(value === 0 ? '0' : new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(value));
    }
  }, [value]);

  const handleChange = (e: any) => {
    const val = e.target.value;
    
    if (val === '') {
      setLocalVal('');
      onChange(0);
      return;
    }

    let raw = val.replace(/,/g, '');

    if (!isDecimal && raw.includes('.')) return;
    if (isNaN(Number(raw)) && raw !== '-' && raw !== '') return;

    const parts = raw.split('.');
    let numStr = parts[0];
    
    let formattedNum = '';
    if (numStr.length > 3) {
      const last3 = numStr.substring(numStr.length - 3);
      const other = numStr.substring(0, numStr.length - 3);
      formattedNum = other.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + last3;
    } else {
      formattedNum = numStr;
    }

    let formatted = formattedNum;
    if (parts.length > 1) {
      formatted += '.' + parts[1];
    } else if (val.endsWith('.')) {
      formatted += '.';
    }
    
    setLocalVal(formatted);
    onChange(Number(raw));
  };

  return <Input type="text" className={className} placeholder={placeholder} value={localVal} onChange={handleChange} />;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function MonthYearSelector({ date, onChange, minYear = 2020, maxYear = 2060, className = "" }: any) {
  const d = new Date(date);
  const month = d.getMonth();
  const year = d.getFullYear();
  const years = Array.from({length: maxYear - minYear + 1}, (_, i) => minYear + i);
  
  const handleMonthChange = (m: string | null) => {
    if (!m) return;
    const newDate = new Date(d);
    newDate.setMonth(Number(m));
    onChange(newDate);
  };
  const handleYearChange = (y: string | null) => {
    if (!y) return;
    const newDate = new Date(d);
    newDate.setFullYear(Number(y));
    onChange(newDate);
  };

  return (
    <div className={`flex gap-2 ${className}`}>
      <Select value={month.toString()} onValueChange={handleMonthChange}>
        <SelectTrigger className="flex-1">
          <SelectValue>{MONTHS[month]}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((m, i) => <SelectItem key={i} value={i.toString()}>{m}</SelectItem>)}
        </SelectContent>
      </Select>
      <Select value={year.toString()} onValueChange={handleYearChange}>
        <SelectTrigger className="flex-1">
          <SelectValue>{year.toString()}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {years.map(y => <SelectItem key={y} value={y.toString()}>{y}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

export default function HomeLoanPlanner() {
  const [loanDetails, setLoanDetails] = useState<LoanDetails>({
    principal: 5000000,
    interestRate: 8.5,
    tenureYears: 20,
    startDate: new Date('2024-01-01T00:00:00Z'),
  });

  useEffect(() => {
    const now = new Date();
    setLoanDetails(prev => ({
      ...prev,
      startDate: new Date(now.getFullYear(), now.getMonth(), 1)
    }));
  }, []);

  const [stepUp, setStepUp] = useState<StepUpSettings>({
    enabled: false,
    type: 'percentage',
    value: 5,
    frequency: 'yearly',
    applyMonthIndex: 0,
  });

  const [prepayments, setPrepayments] = useState<Prepayment[]>([]);


  const results = useMemo(() => {
    const processedPrepayments = prepayments.map(p => {
      const pDate = p.date || loanDetails.startDate;
      const yearDiff = pDate.getFullYear() - loanDetails.startDate.getFullYear();
      const monthDiff = pDate.getMonth() - loanDetails.startDate.getMonth();
      const calculatedIndex = yearDiff * 12 + monthDiff + 1;
      
      return {
        ...p,
        date: pDate,
        startMonthIndex: calculatedIndex > 0 ? calculatedIndex : 1
      };
    });
    return simulateLoan(loanDetails, stepUp, processedPrepayments);
  }, [loanDetails, stepUp, prepayments]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(val);
  };

  const addPrepayment = () => {
    setPrepayments([...prepayments, {
      id: Math.random().toString(),
      amount: 50000,
      type: 'one-time',
      date: new Date(loanDetails.startDate),
      recurringFrequency: 'yearly',
      startMonthIndex: 1,
      stepUpType: 'percentage',
      stepUpValue: 0
    }]);
  };

  const removePrepayment = (id: string) => {
    setPrepayments(prepayments.filter(p => p.id !== id));
  };

  const updatePrepayment = (id: string, updates: Partial<Prepayment>) => {
    setPrepayments(prepayments.map(p => p.id === id ? { ...p, ...updates } : p));
  };

  const chartData = useMemo(() => {
    // We'll map the revised schedule and original schedule for comparison
    const data = results.revised.schedule.map((row, idx) => {
      const origRow = results.original.schedule[idx];
      return {
        month: row.month,
        date: format(row.date, 'MMM yyyy'),
        revisedBalance: row.closingBalance,
        originalBalance: origRow ? origRow.closingBalance : 0,
        emi: row.emi,
        prepayment: row.prepayment,
      };
    });
    return data;
  }, [results]);

  const yearlySchedule = useMemo(() => {
    const years: Record<number, { year: number, principal: number, prepayment: number, interest: number, balance: number, emi: number, months: any[] }> = {};
    results.revised.schedule.forEach(row => {
      const year = row.date.getFullYear();
      if (!years[year]) {
        years[year] = { year, principal: 0, prepayment: 0, interest: 0, balance: 0, emi: 0, months: [] };
      }
      years[year].principal += row.principalComponent;
      years[year].prepayment += row.prepayment;
      years[year].interest += row.interest;
      years[year].balance = row.closingBalance;
      years[year].emi += row.emi;
      years[year].months.push(row);
    });
    return Object.values(years).sort((a, b) => a.year - b.year);
  }, [results]);

  const [expandedYears, setExpandedYears] = useState<number[]>([]);

  const toggleYear = (year: number) => {
    setExpandedYears(prev => prev.includes(year) ? prev.filter(y => y !== year) : [...prev, year]);
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="mb-8">
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Home Loan Planner Pro</h1>
          <p className="text-slate-500 mt-1">Advanced Prepayment & Step-Up EMI Simulator</p>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* LEFT PANEL - INPUTS */}
          <div className="lg:col-span-4 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Loan Details</CardTitle>
                <CardDescription>Enter your base loan parameters.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Loan Amount (₹)</Label>
                  <FormattedInput 
                    value={loanDetails.principal} 
                    onChange={(v: number) => setLoanDetails({...loanDetails, principal: v})}
                  />
                  <p className="text-xs text-slate-500 italic lowercase">{numberToWordsIndian(loanDetails.principal)}</p>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Interest Rate (%)</Label>
                    <FormattedInput 
                      isDecimal={true}
                      value={loanDetails.interestRate} 
                      onChange={(v: number) => setLoanDetails({...loanDetails, interestRate: v})}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Tenure (Years)</Label>
                    <FormattedInput 
                      value={loanDetails.tenureYears} 
                      onChange={(v: number) => setLoanDetails({...loanDetails, tenureYears: v})}
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Loan Start Month & Year</Label>
                  <MonthYearSelector 
                    date={loanDetails.startDate} 
                    onChange={(d: Date) => setLoanDetails({...loanDetails, startDate: d})} 
                  />
                </div>
                <div className="space-y-2">
                  <Label>Custom EMI (Optional)</Label>
                  <FormattedInput 
                    placeholder="Auto Calculate"
                    value={loanDetails.customEmi || 0} 
                    onChange={(v: number) => setLoanDetails({...loanDetails, customEmi: v === 0 ? undefined : v})}
                  />
                  <p className="text-xs text-slate-500">Standard EMI: {formatCurrency(results.original.emi)}</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Step-Up EMI</CardTitle>
                    <CardDescription>Increase EMI annually to close faster.</CardDescription>
                  </div>
                  <Switch 
                    checked={stepUp.enabled} 
                    onCheckedChange={c => setStepUp({...stepUp, enabled: c})} 
                  />
                </div>
              </CardHeader>
              {stepUp.enabled && (
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select 
                        value={stepUp.type} 
                        onValueChange={(v: 'percentage'|'fixed') => setStepUp({...stepUp, type: v})}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="percentage">Percentage (%)</SelectItem>
                          <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Value</Label>
                      <FormattedInput 
                        value={stepUp.value} 
                        onChange={(v: number) => setStepUp({...stepUp, value: v})}
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Apply On</Label>
                    <Select 
                      value={stepUp.applyMonthIndex.toString()} 
                      onValueChange={v => setStepUp({...stepUp, applyMonthIndex: Number(v)})}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="0">Loan Anniversary</SelectItem>
                        <SelectItem value="1">Every January</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              )}
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>Prepayments</CardTitle>
                  <CardDescription>Add extra payments.</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={addPrepayment}>+ Add</Button>
              </CardHeader>
              <CardContent className="space-y-4">
                {prepayments.map((p, i) => (
                  <div key={p.id} className="p-3 border rounded-md space-y-3 relative bg-slate-50">
                    <button 
                      className="absolute top-2 right-2 text-slate-400 hover:text-red-500"
                      onClick={() => removePrepayment(p.id)}
                    >
                      ×
                    </button>
                    <div className="grid grid-cols-2 gap-3 pr-4">
                      <div className="space-y-1">
                        <Label className="text-xs">Type</Label>
                        <Select 
                          value={p.type} 
                          onValueChange={(v: 'one-time'|'recurring') => updatePrepayment(p.id, { type: v })}
                        >
                          <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="one-time">One-time</SelectItem>
                            <SelectItem value="recurring">Recurring</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Amount</Label>
                        <FormattedInput 
                          className="h-8 text-xs"
                          value={p.amount} 
                          onChange={(v: number) => updatePrepayment(p.id, { amount: v })}
                        />
                      </div>
                      <div className="space-y-1 col-span-2">
                        <Label className="text-xs">Start Month & Year</Label>
                        <MonthYearSelector 
                          className="h-8 text-xs"
                          minYear={loanDetails.startDate.getFullYear()}
                          maxYear={loanDetails.startDate.getFullYear() + Math.max(30, loanDetails.tenureYears)}
                          date={p.date || loanDetails.startDate} 
                          onChange={(d: Date) => {
                            let validDate = d;
                            if (d < loanDetails.startDate) validDate = new Date(loanDetails.startDate);
                            updatePrepayment(p.id, { date: validDate });
                          }} 
                        />
                      </div>
                    </div>
                    {p.type === 'recurring' && (
                      <div className="grid grid-cols-2 gap-3 pr-4 mt-2">
                        <div className="space-y-1 col-span-2">
                          <Label className="text-xs">Frequency</Label>
                          <Select 
                            value={p.recurringFrequency || 'yearly'} 
                            onValueChange={(v: any) => updatePrepayment(p.id, { recurringFrequency: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="monthly">Monthly</SelectItem>
                              <SelectItem value="quarterly">Quarterly</SelectItem>
                              <SelectItem value="half-yearly">Half-Yearly</SelectItem>
                              <SelectItem value="yearly">Yearly</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">StepUp Type</Label>
                          <Select 
                            value={p.stepUpType || 'percentage'} 
                            onValueChange={(v: any) => updatePrepayment(p.id, { stepUpType: v })}
                          >
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="percentage">Percentage (%)</SelectItem>
                              <SelectItem value="fixed">Fixed Amount (₹)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">StepUp Value</Label>
                          <FormattedInput 
                            className="h-8 text-xs"
                            value={p.stepUpValue || 0} 
                            onChange={(v: number) => updatePrepayment(p.id, { stepUpValue: v })}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
                {prepayments.length === 0 && (
                  <p className="text-sm text-slate-500 text-center py-2">No prepayments added.</p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* RIGHT PANEL - DASHBOARD */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card className="bg-emerald-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-emerald-100 text-sm font-medium">Monthly EMI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(results.revised.emi)}</div>
                  <p className="text-emerald-200 text-xs mt-1">Initial Monthly Payment</p>
                </CardContent>
              </Card>
              <Card className="bg-blue-600 text-white">
                <CardHeader className="pb-2">
                  <CardTitle className="text-blue-100 text-sm font-medium">Interest Saved</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{formatCurrency(results.savings.interestSaved)}</div>
                  <p className="text-blue-200 text-xs mt-1">Compared to original schedule</p>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-500 text-sm font-medium">Tenure</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {Math.floor(results.revised.tenureMonths / 12)}y {results.revised.tenureMonths % 12}m
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    <p className="text-slate-500 text-xs">Original Tenure: {Math.floor(results.original.tenureMonths / 12)}y {results.original.tenureMonths % 12}m</p>
                    {results.savings.tenureReducedMonths > 0 && (
                      <p className="text-emerald-600 text-xs font-medium">
                        Reduced by: {Math.floor(results.savings.tenureReducedMonths / 12)}y {results.savings.tenureReducedMonths % 12}m
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-slate-500 text-sm font-medium">New Closure Date</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold text-slate-900">
                    {format(results.revised.endDate, 'MMM yyyy')}
                  </div>
                  <p className="text-slate-500 text-xs mt-1">Original: {format(results.original.endDate, 'MMM yyyy')}</p>
                </CardContent>
              </Card>
            </div>

            {/* Charts & Tables */}
            <Card>
              <CardHeader>
                <CardTitle>Visualization & Schedule</CardTitle>
              </CardHeader>
              <CardContent className="space-y-12">
                <div className="space-y-8">
                    <div className="h-[300px] w-full mt-4">
                      <h3 className="text-sm font-medium text-slate-500 mb-2">Outstanding Balance Trend</h3>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorRevised" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#2563eb" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#2563eb" stopOpacity={0}/>
                            </linearGradient>
                            <linearGradient id="colorOrig" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.3}/>
                              <stop offset="95%" stopColor="#94a3b8" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="date" minTickGap={30} tick={{fontSize: 12}} />
                          <YAxis tickFormatter={(val) => `₹${(val/100000).toFixed(0)}L`} tick={{fontSize: 12}} />
                          <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                          <Legend />
                          <Area type="monotone" name="Revised Balance" dataKey="revisedBalance" stroke="#2563eb" fillOpacity={1} fill="url(#colorRevised)" />
                          <Area type="monotone" name="Original Balance" dataKey="originalBalance" stroke="#94a3b8" strokeDasharray="5 5" fillOpacity={1} fill="url(#colorOrig)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>

                    {(stepUp.enabled || prepayments.length > 0) && (
                      <div className="h-[200px] w-full mt-8">
                        <h3 className="text-sm font-medium text-slate-500 mb-2">Annual Payments Breakdown</h3>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={yearlySchedule}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} />
                            <XAxis dataKey="year" tick={{fontSize: 12}} />
                            <YAxis tickFormatter={(val) => `₹${(val/100000).toFixed(0)}L`} tick={{fontSize: 12}} />
                            <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                            <Legend />
                            <Bar dataKey="emi" name="Total EMI Paid" stackId="a" fill="#34d399" />
                            <Bar dataKey="prepayment" name="Prepayments" stackId="a" fill="#059669" radius={[4, 4, 0, 0]} />
                          </BarChart>
                        </ResponsiveContainer>
                      </div>
                    )}
                </div>
                
                <div className="pt-6">
                    <div className="bg-slate-100 rounded-md p-4 text-center mb-4 border">
                      <h2 className="text-xl font-bold text-slate-800">Home Loan Payment Schedule</h2>
                      <p className="text-slate-600 font-medium">
                        {results.revised.schedule.length > 0 ? (
                          <>({format(results.revised.schedule[0].date, 'MMM yyyy')} - {format(results.revised.endDate, 'MMM yyyy')})</>
                        ) : (
                          <>(No Schedule Available)</>
                        )}
                      </p>
                    </div>
                    <div className="rounded-md border h-[500px] overflow-auto">
                      <Table>
                        <TableHeader className="sticky top-0 bg-white shadow-sm z-10">
                          <TableRow>
                            <TableHead className="w-[120px] bg-slate-100 font-bold text-center border-r">Year</TableHead>
                            <TableHead className="bg-[#8cc63f] text-white text-center font-bold border-r">Principal (A)</TableHead>
                            <TableHead className="bg-[#e03a3e] text-white text-center font-bold border-r">Prepayment (B)</TableHead>
                            <TableHead className="bg-[#f58220] text-white text-center font-bold border-r">Interest (C)</TableHead>
                            <TableHead className="bg-slate-100 text-slate-800 text-center font-bold">Balance</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {yearlySchedule.map((yd) => (
                            <React.Fragment key={yd.year}>
                              <TableRow className="bg-slate-100 hover:bg-slate-200 cursor-pointer border-b" onClick={() => toggleYear(yd.year)}>
                                <TableCell className="font-bold flex items-center justify-center gap-2 border-r">
                                  {expandedYears.includes(yd.year) ? <MinusSquare className="w-4 h-4 text-slate-500"/> : <PlusSquare className="w-4 h-4 text-slate-500"/>} 
                                  {yd.year}
                                </TableCell>
                                <TableCell className="text-right font-medium border-r">{formatCurrency(yd.principal)}</TableCell>
                                <TableCell className="text-right font-medium border-r">{formatCurrency(yd.prepayment)}</TableCell>
                                <TableCell className="text-right font-medium border-r">{formatCurrency(yd.interest)}</TableCell>
                                <TableCell className="text-right font-bold text-slate-600">{formatCurrency(yd.balance)}</TableCell>
                              </TableRow>
                              {expandedYears.includes(yd.year) && yd.months.map(row => (
                                <TableRow key={row.month} className="bg-white border-b">
                                  <TableCell className="text-center text-slate-600 font-medium border-r">{format(row.date, 'MMM')}</TableCell>
                                  <TableCell className="text-right text-slate-600 border-r">{formatCurrency(row.principalComponent)}</TableCell>
                                  <TableCell className="text-right text-slate-600 border-r">{row.prepayment > 0 ? formatCurrency(row.prepayment) : '₹0'}</TableCell>
                                  <TableCell className="text-right text-slate-600 border-r">{formatCurrency(row.interest)}</TableCell>
                                  <TableCell className="text-right text-slate-600">{formatCurrency(row.closingBalance)}</TableCell>
                                </TableRow>
                              ))}
                            </React.Fragment>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                </div>
              </CardContent>
            </Card>

          </div>
        </div>
      </div>
    </div>
  );
}
