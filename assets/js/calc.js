/* 돈셈랩 (DonsemLab) — 2026년 기준 계산 엔진
   모든 요율은 2026년 1월 1일 시행 법령·고시 기준이며, 화면 하단 출처 표와 함께 안내합니다. */
(function () {
  "use strict";

  var DS = (window.DS = window.DS || {});

  /* ============================================================
     2026년 기준값
     ============================================================ */
  var R = (DS.RATES = {
    year: 2026,
    // 국민연금: 총 9.5%(근로자·사업주 각 4.75%), 2026.7~2027.6 기준소득월액 41만~659만원
    pensionEmployee: 0.0475,
    pensionEmployer: 0.0475,
    pensionMinBase: 410000,
    pensionMaxBase: 6590000,
    // 건강보험: 총 7.19%
    healthEmployee: 0.03595,
    healthEmployer: 0.03595,
    healthTotal: 0.0719,
    // 장기요양: 보수월액 0.9448% = 건강보험료의 13.14%
    ltcOfHealth: 0.1314,
    // 고용보험(실업급여): 총 1.8%, 각 0.9%
    employmentEmployee: 0.009,
    employmentEmployer: 0.009,
    // 실업급여 2026.1.1 이후 이직자
    jobSeekCap: 68100,
    jobSeekBaseCap: 113500,
    minimumWageHourly: 10320,
    // 근로소득 기본공제 1인당
    basicDeduction: 1500000
  });

  /** 10원 미만 절사 — 원천징수·보험료 고지서의 실무 단위 (부동소수점 오차 보정 포함) */
  DS.floor10 = function (n) {
    return Math.floor(Math.round(n) / 10) * 10;
  };

  DS.TAX_BRACKETS = [
    { limit: 14000000, rate: 0.06, progressive: 0 },
    { limit: 50000000, rate: 0.15, progressive: 1260000 },
    { limit: 88000000, rate: 0.24, progressive: 5760000 },
    { limit: 150000000, rate: 0.35, progressive: 15440000 },
    { limit: 300000000, rate: 0.38, progressive: 19940000 },
    { limit: 500000000, rate: 0.4, progressive: 25940000 },
    { limit: 1000000000, rate: 0.42, progressive: 35940000 },
    { limit: Infinity, rate: 0.45, progressive: 65940000 }
  ];

  DS.incomeTax = function (taxableBase) {
    if (!(taxableBase > 0)) return 0;
    var b = DS.TAX_BRACKETS;
    for (var i = 0; i < b.length; i++) {
      if (taxableBase <= b[i].limit) {
        return Math.max(0, taxableBase * b[i].rate - b[i].progressive);
      }
    }
    return 0;
  };

  /** 근로소득공제 (2026년, 한도 2,000만원) */
  DS.workIncomeDeduction = function (gross) {
    if (!(gross > 0)) return 0;
    var d;
    if (gross <= 5000000) d = gross * 0.7;
    else if (gross <= 15000000) d = 3500000 + (gross - 5000000) * 0.4;
    else if (gross <= 45000000) d = 7500000 + (gross - 15000000) * 0.15;
    else if (gross <= 100000000) d = 12000000 + (gross - 45000000) * 0.05;
    else d = 14750000 + (gross - 100000000) * 0.02;
    return Math.min(d, 20000000);
  };

  /** 근로소득세액공제 한도 */
  DS.earnedIncomeCreditLimit = function (gross) {
    if (gross <= 33000000) return 740000;
    if (gross <= 70000000) return Math.max(660000, 740000 - (gross - 33000000) * 0.008);
    if (gross <= 120000000) return Math.max(500000, 660000 - (gross - 70000000) * 0.5 * 0.008);
    return Math.max(200000, 500000 - (gross - 120000000) * 0.5 * 0.008);
  };

  /** 근로소득세액공제 공제액 */
  DS.earnedIncomeCredit = function (gross, calculatedTax) {
    var credit;
    if (calculatedTax <= 1300000) credit = calculatedTax * 0.55;
    else credit = 1300000 * 0.55 + (calculatedTax - 1300000) * 0.3;
    return Math.min(credit, DS.earnedIncomeCreditLimit(gross));
  };

  /* ============================================================
     1) 연봉 실수령액 · 4대보험
     ============================================================ */

  /**
   * @param {number} grossMonthly 세전 월급(비과세 포함)
   * @param {number} nonTaxableMonthly 월 비과세액
   * @param {number} dependents 부양가족 수(본인 포함)
   */
  DS.salary = function (grossMonthly, nonTaxableMonthly, dependents) {
    grossMonthly = Math.max(0, Math.round(grossMonthly || 0));
    nonTaxableMonthly = Math.max(0, Math.min(Math.round(nonTaxableMonthly || 0), grossMonthly));
    dependents = Math.max(1, Math.round(dependents || 1));

    var taxable = Math.max(0, grossMonthly - nonTaxableMonthly);

    // 국민연금: 기준소득월액 = 천원 미만 절사 후 상·하한 적용
    var pensionBase = Math.floor(taxable / 1000) * 1000;
    pensionBase = Math.min(Math.max(pensionBase, R.pensionMinBase), R.pensionMaxBase);
    var pension = DS.floor10(pensionBase * R.pensionEmployee);

    var health = DS.floor10(taxable * R.healthEmployee);
    // 장기요양: 보수월액의 0.9448%를 원 단위로 반올림한 뒤 근로자·사업주가 절반씩
    var ltc = Math.round(Math.round(taxable * 0.009448) / 2);
    var employment = DS.floor10(taxable * R.employmentEmployee);

    // 소득세: 연간 기준으로 계산한 뒤 12로 나눈 근사치(간이세액표 근사)
    var grossAnnual = taxable * 12;
    var earnedDeduction = DS.workIncomeDeduction(grossAnnual);
    var earnedIncome = Math.max(0, grossAnnual - earnedDeduction);
    var personalDeduction = R.basicDeduction * dependents;
    var pensionDeduction = pension * 12;
    var taxBase = Math.max(0, earnedIncome - personalDeduction - pensionDeduction);
    var calculatedTax = DS.incomeTax(taxBase);
    var taxCredit = DS.earnedIncomeCredit(grossAnnual, calculatedTax);
    var annualIncomeTax = Math.max(0, Math.round(calculatedTax - taxCredit));
    var incomeTax = DS.floor10(annualIncomeTax / 12);
    var localTax = DS.floor10(incomeTax * 0.1);

    var totalDeduction = pension + health + ltc + employment + incomeTax + localTax;
    var net = grossMonthly - totalDeduction;

    return {
      gross: grossMonthly,
      nonTaxable: nonTaxableMonthly,
      taxable: taxable,
      pensionBase: pensionBase,
      pension: pension,
      health: health,
      ltc: ltc,
      employment: employment,
      incomeTax: incomeTax,
      localTax: localTax,
      insuranceTotal: pension + health + ltc + employment,
      taxTotal: incomeTax + localTax,
      totalDeduction: totalDeduction,
      net: net,
      netAnnual: net * 12,
      grossAnnual: grossMonthly * 12,
      deductionAnnual: totalDeduction * 12,
      taxBaseAnnual: taxBase,
      calculatedTaxAnnual: calculatedTax,
      incomeTaxAnnual: annualIncomeTax,
      deductionRate: grossMonthly > 0 ? (totalDeduction / grossMonthly) * 100 : 0
    };
  };

  DS.formatSalaryTable = function (rows) {
    return rows
      .map(function (r) {
        return (
          "<tr><th scope='row'>" +
          r.label +
          "</th><td class='num'>" +
          DS.won(r.value) +
          "</td><td class='num muted'>" +
          (r.rate === null || r.rate === undefined ? "-" : DS.pct(r.rate)) +
          "</td></tr>"
        );
      })
      .join("");
  };

  /* ============================================================
     2) 퇴직금 · 실업급여
     ============================================================ */
  function toDate(str) {
    if (!str) return null;
    var parts = String(str).split("-");
    if (parts.length !== 3) return null;
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    return isNaN(d.getTime()) ? null : d;
  }
  DS.toDate = toDate;

  function daysBetween(a, b) {
    var ms = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
    return Math.round(ms / 86400000);
  }

  function addMonths(date, months) {
    var d = new Date(date.getTime());
    var day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) d.setDate(0);
    return d;
  }

  DS.severance = function (joinStr, leaveStr, salaries, extraPay) {
    var join = toDate(joinStr);
    var leave = toDate(leaveStr);
    if (!join || !leave || leave < join) return { valid: false, reason: "date" };

    var serviceDays = daysBetween(join, leave) + 1;
    if (serviceDays < 365) {
      return { valid: false, reason: "short", serviceDays: serviceDays };
    }

    var start3m = addMonths(leave, -3);
    var periodDays = daysBetween(start3m, leave) || 91;
    var totalPay = (salaries || []).reduce(function (s, v) { return s + Math.max(0, v || 0); }, 0) + Math.max(0, extraPay || 0);
    var dailyWage = totalPay / periodDays;
    var severance = dailyWage * 30 * (serviceDays / 365);

    return {
      valid: true,
      serviceDays: serviceDays,
      serviceYears: serviceDays / 365,
      periodDays: periodDays,
      totalPay: totalPay,
      dailyWage: dailyWage,
      monthlyAverage: dailyWage * 30,
      severance: severance
    };
  };

  DS.SERVICE_DAYS_TABLE = {
    under1: { under50: 120, over50: 120, label: "1년 미만" },
    y1to3: { under50: 150, over50: 180, label: "1년 이상 3년 미만" },
    y3to5: { under50: 180, over50: 210, label: "3년 이상 5년 미만" },
    y5to10: { under50: 210, over50: 240, label: "5년 이상 10년 미만" },
    over10: { under50: 240, over50: 270, label: "10년 이상" }
  };

  /**
   * @param {number} monthlyAvg 월 평균임금(세전)
   * @param {number} age 만 나이
   * @param {string} periodKey SERVICE_DAYS_TABLE 키
   * @param {number} dailyHours 1일 소정근로시간
   */
  DS.unemployment = function (monthlyAvg, age, periodKey, dailyHours) {
    monthlyAvg = Math.max(0, monthlyAvg || 0);
    age = Math.max(0, age || 0);
    dailyHours = Math.min(Math.max(dailyHours || 8, 1), 8);

    var dailyAvg = (monthlyAvg * 12) / 365;
    var baseDaily = Math.min(dailyAvg, R.jobSeekBaseCap);
    var rawBenefit = baseDaily * 0.6;

    var lowerBound = R.minimumWageHourly * dailyHours * 0.8;
    var benefit = Math.min(Math.max(rawBenefit, lowerBound), R.jobSeekCap);
    if (lowerBound > R.jobSeekCap) benefit = lowerBound;

    var row = DS.SERVICE_DAYS_TABLE[periodKey] || DS.SERVICE_DAYS_TABLE.y1to3;
    var days = age >= 50 ? row.over50 : row.under50;

    return {
      dailyAvg: dailyAvg,
      baseDaily: baseDaily,
      rawBenefit: rawBenefit,
      lowerBound: lowerBound,
      benefit: benefit,
      days: days,
      total: benefit * days,
      monthly: benefit * 30,
      band: rawBenefit >= R.jobSeekCap ? "cap" : rawBenefit <= lowerBound ? "floor" : "normal"
    };
  };

  /* ============================================================
     3) 프리랜서 3.3% · 종합소득세
     ============================================================ */
  DS.freelance = function (amount) {
    amount = Math.max(0, Math.round(amount || 0));
    var incomeTax = Math.round(amount * 0.03);
    var localTax = Math.round(amount * 0.003);
    return {
      amount: amount,
      incomeTax: incomeTax,
      localTax: localTax,
      withholding: incomeTax + localTax,
      net: amount - incomeTax - localTax
    };
  };

  DS.grossFromNet = function (net) {
    return Math.max(0, Math.round(net / 0.967));
  };

  DS.comprehensiveTax = function (revenue, expenseRate, dependents, extraDeduction) {
    revenue = Math.max(0, revenue || 0);
    expenseRate = Math.min(Math.max(expenseRate || 0, 0), 1);
    dependents = Math.max(1, dependents || 1);
    extraDeduction = Math.max(0, extraDeduction || 0);

    var expense = revenue * expenseRate;
    var businessIncome = revenue - expense;
    var personal = R.basicDeduction * dependents;
    var taxBase = Math.max(0, businessIncome - personal - extraDeduction);
    var calculatedTax = DS.incomeTax(taxBase);
    var standardCredit = Math.min(calculatedTax, 70000); // 표준세액공제 7만원
    var incomeTax = Math.max(0, Math.round(calculatedTax - standardCredit));
    var localTax = Math.round(incomeTax * 0.1);
    var decided = incomeTax + localTax;
    var prepaidIncome = Math.round(revenue * 0.03);
    var prepaidLocal = Math.round(revenue * 0.003);
    var prepaid = prepaidIncome + prepaidLocal;

    return {
      revenue: revenue,
      expense: expense,
      businessIncome: businessIncome,
      personalDeduction: personal,
      taxBase: taxBase,
      calculatedTax: calculatedTax,
      incomeTax: incomeTax,
      localTax: localTax,
      decided: decided,
      prepaid: prepaid,
      settle: prepaid - decided,
      effectiveRate: revenue > 0 ? (decided / revenue) * 100 : 0
    };
  };

  /* ============================================================
     4) 연말정산 신용카드 소득공제 (2026년 사용분)
     ============================================================ */
  DS.cardDeduction = function (gross, children, credit, check, transit, market) {
    gross = Math.max(0, gross || 0);
    children = Math.max(0, children || 0);
    credit = Math.max(0, credit || 0);
    check = Math.max(0, check || 0);
    transit = Math.max(0, transit || 0);
    market = Math.max(0, market || 0);

    var threshold = gross * 0.25;
    var base = credit + check;
    var excess = Math.max(0, base - threshold);
    var creditApplied = Math.min(credit, excess);
    var checkApplied = Math.max(0, excess - creditApplied);
    var generalDeduction = creditApplied * 0.15 + checkApplied * 0.3;

    // 문턱을 채우지 못한 부분은 대중교통·전통시장 사용액이 40%로 채운다(그 부분은 공제 제외).
    var remainder = Math.max(0, threshold - base);
    var transitEligible = Math.max(0, transit - remainder);
    var remainder2 = Math.max(0, remainder - transit);
    var marketEligible = Math.max(0, market - remainder2);
    var bonusDeduction = transitEligible * 0.4 + marketEligible * 0.4;

    var over70 = gross > 70000000;
    var basicLimit = over70
      ? children >= 2 ? 3000000 : children === 1 ? 2750000 : 2500000
      : children >= 2 ? 4000000 : children === 1 ? 3500000 : 3000000;
    var bonusLimit = over70 ? 2000000 : 3000000;

    var basicApplied = Math.min(generalDeduction, basicLimit);
    var bonusApplied = Math.min(bonusDeduction, bonusLimit);
    var totalDeduction = basicApplied + bonusApplied;

    return {
      gross: gross,
      threshold: threshold,
      usable: credit + check + transit + market,
      base: base,
      excess: excess,
      creditApplied: creditApplied,
      checkApplied: checkApplied,
      generalDeduction: generalDeduction,
      transitEligible: transitEligible,
      marketEligible: marketEligible,
      bonusDeduction: bonusDeduction,
      basicLimit: basicLimit,
      bonusLimit: bonusLimit,
      basicApplied: basicApplied,
      bonusApplied: bonusApplied,
      totalDeduction: totalDeduction,
      limited: generalDeduction > basicLimit || bonusDeduction > bonusLimit,
      // 소득공제 1원당 절세액은 한계세율에 따라 달라진다(6~24% 구간 가정)
      savingLow: totalDeduction * 0.06,
      savingHigh: totalDeduction * 0.24
    };
  };

  /* ============================================================
     5) 4대보험 상세(근로자·사업주) · 시급/주휴수당 환산
     ============================================================ */
  DS.BIZ_SIZE = {
    small: { rate: 0.0025, label: "150명 미만" },
    mid1: { rate: 0.0045, label: "150명 이상(우선지원대상기업)" },
    mid2: { rate: 0.0065, label: "150~1,000명 미만" },
    large: { rate: 0.0085, label: "1,000명 이상·국가·지방자치단체" }
  };

  DS.insurance = function (monthlyPay, bizSizeKey, injuryRate) {
    monthlyPay = Math.max(0, monthlyPay || 0);
    var size = DS.BIZ_SIZE[bizSizeKey] || DS.BIZ_SIZE.small;
    injuryRate = Math.max(0, injuryRate === undefined ? 0.0147 : injuryRate);

    var pensionBase = Math.floor(monthlyPay / 1000) * 1000;
    pensionBase = Math.min(Math.max(pensionBase, R.pensionMinBase), R.pensionMaxBase);
    var pensionEmployee = DS.floor10(pensionBase * R.pensionEmployee);
    var pensionEmployer = DS.floor10(pensionBase * R.pensionEmployer);

    var healthEmployee = DS.floor10(monthlyPay * R.healthEmployee);
    var healthEmployer = DS.floor10(monthlyPay * R.healthEmployer);
    var ltcEmployee = Math.round(Math.round(monthlyPay * 0.009448) / 2);
    var ltcEmployer = ltcEmployee;

    var empEmployee = DS.floor10(monthlyPay * R.employmentEmployee);
    var empEmployer = DS.floor10(monthlyPay * R.employmentEmployer);
    var stability = DS.floor10(monthlyPay * size.rate);
    var injury = DS.floor10(monthlyPay * injuryRate);

    var employeeTotal = pensionEmployee + healthEmployee + ltcEmployee + empEmployee;
    var employerTotal = pensionEmployer + healthEmployer + ltcEmployer + empEmployer + stability + injury;

    return {
      pay: monthlyPay,
      pensionBase: pensionBase,
      rows: [
        { name: "국민연금", employee: pensionEmployee, employer: pensionEmployer, rateEmployee: 4.75, rateEmployer: 4.75 },
        { name: "건강보험", employee: healthEmployee, employer: healthEmployer, rateEmployee: 3.595, rateEmployer: 3.595 },
        { name: "장기요양보험", employee: ltcEmployee, employer: ltcEmployer, rateEmployee: 0.4724, rateEmployer: 0.4724 },
        { name: "고용보험(실업급여)", employee: empEmployee, employer: empEmployer, rateEmployee: 0.9, rateEmployer: 0.9 },
        { name: "고용안정·직업능력개발", employee: 0, employer: stability, rateEmployee: 0, rateEmployer: size.rate * 100 },
        { name: "산재보험", employee: 0, employer: injury, rateEmployee: 0, rateEmployer: injuryRate * 100 }
      ],
      employeeTotal: employeeTotal,
      employerTotal: employerTotal,
      totalCost: monthlyPay + employerTotal,
      employeeRate: monthlyPay > 0 ? (employeeTotal / monthlyPay) * 100 : 0,
      employerRate: monthlyPay > 0 ? (employerTotal / monthlyPay) * 100 : 0,
      sizeLabel: size.label
    };
  };

  /** 주휴수당·월 환산 (주 15시간 이상 근무 시 주휴수당 발생) */
  DS.hourly = function (hourlyWage, hoursPerDay, daysPerWeek) {
    hourlyWage = Math.max(0, hourlyWage || 0);
    hoursPerDay = Math.min(Math.max(hoursPerDay || 0, 0), 24);
    daysPerWeek = Math.min(Math.max(daysPerWeek || 0, 0), 7);

    var weeklyWorkHours = hoursPerDay * daysPerWeek;
    var holidayHours = 0;
    if (weeklyWorkHours >= 15) {
      holidayHours = Math.min(8, (weeklyWorkHours / 40) * 8);
    }
    var weeklyPay = hourlyWage * weeklyWorkHours;
    var holidayPay = hourlyWage * holidayHours;
    var weeklyTotal = weeklyPay + holidayPay;
    var monthWeeks = 365 / 7 / 12; // 4.3452
    var monthlyHours = Math.round((weeklyWorkHours + holidayHours) * monthWeeks); // 급여 실무의 월 소정근로시간(주 40시간제 209시간)
    var monthlyPay = Math.round(hourlyWage * monthlyHours);

    return {
      hourlyWage: hourlyWage,
      weeklyWorkHours: weeklyWorkHours,
      holidayHours: holidayHours,
      weeklyPay: weeklyPay,
      holidayPay: holidayPay,
      weeklyTotal: weeklyTotal,
      monthlyHours: monthlyHours,
      monthlyPay: monthlyPay,
      annualPay: monthlyPay * 12,
      meetsMinimum: hourlyWage >= R.minimumWageHourly,
      minimumGap: hourlyWage - R.minimumWageHourly,
      eligibleHoliday: weeklyWorkHours >= 15
    };
  };

  /** 월급(또는 연봉) → 시급 역산 */
  DS.monthlyToHourly = function (monthlyPay, hoursPerDay, daysPerWeek) {
    var weeklyWorkHours = Math.max(0, hoursPerDay || 0) * Math.max(0, daysPerWeek || 0);
    var holidayHours = weeklyWorkHours >= 15 ? Math.min(8, (weeklyWorkHours / 40) * 8) : 0;
    var monthWeeks = 365 / 7 / 12;
    var monthlyHours = Math.round((weeklyWorkHours + holidayHours) * monthWeeks);
    var hourly = monthlyHours > 0 ? monthlyPay / monthlyHours : 0;
    return {
      monthlyHours: monthlyHours,
      hourlyWage: hourly,
      weeklyWorkHours: weeklyWorkHours,
      holidayHours: holidayHours
    };
  };

  /* ============================================================
     화면 초기화
     ============================================================ */
  function onInput(el, handler) {
    if (!el) return;
    ["input", "change"].forEach(function (evt) {
      el.addEventListener(evt, handler);
    });
  }

  function radioValue(name) {
    var checked = document.querySelector("input[name='" + name + "']:checked");
    return checked ? checked.value : null;
  }

  /* ---------- 연봉 실수령액 (index · salary 공용) ---------- */
  function initSalaryCalc() {
    var amount = DS.$("pay-amount");
    if (!amount) return;

    function render() {
      var mode = radioValue("pay-mode") || "annual";
      var raw = DS.toInt(amount.value);
      var grossMonthly = mode === "annual" ? raw / 12 : raw;
      var nonTaxable = DS.$("nontaxable") ? DS.toInt(DS.$("nontaxable").value) : 200000;
      var dependents = DS.$("dependents") ? DS.toInt(DS.$("dependents").value) || 1 : 1;

      var r = DS.salary(grossMonthly, nonTaxable, dependents);

      DS.text("res-net", DS.won(r.net));
      DS.text("res-net-sub", "세전 " + DS.won(r.gross) + " · 월 공제 " + DS.won(r.totalDeduction));
      DS.text("res-gross", DS.won(r.gross));
      DS.text("res-deduction", DS.won(r.totalDeduction));
      DS.text("res-rate", DS.pct(r.deductionRate));
      DS.text("res-annual-net", DS.won(r.netAnnual));
      DS.text("res-insurance", DS.won(r.insuranceTotal));
      DS.text("res-tax", DS.won(r.taxTotal));

      var rows = [
        { label: "국민연금 (4.75%)", value: r.pension, rate: (r.pension / r.gross) * 100 },
        { label: "건강보험 (3.595%)", value: r.health, rate: (r.health / r.gross) * 100 },
        { label: "장기요양보험 (건강보험료의 13.14%)", value: r.ltc, rate: (r.ltc / r.gross) * 100 },
        { label: "고용보험 (0.9%)", value: r.employment, rate: (r.employment / r.gross) * 100 },
        { label: "근로소득세 (간이세액 근사)", value: r.incomeTax, rate: (r.incomeTax / r.gross) * 100 },
        { label: "지방소득세 (소득세의 10%)", value: r.localTax, rate: (r.localTax / r.gross) * 100 }
      ];

      var tbody = DS.$("salary-breakdown");
      if (tbody) {
        tbody.innerHTML =
          rows
            .map(function (row) {
              return (
                "<tr><th scope='row' class='em'>" + row.label + "</th><td class='num'>" + DS.won(row.value) +
                "</td><td class='num muted'>" + DS.pct(row.rate) + "</td></tr>"
              );
            })
            .join("") +
          "<tr class='total'><td>공제 합계</td><td class='num'>" + DS.won(r.totalDeduction) +
          "</td><td class='num'>" + DS.pct(r.deductionRate) + "</td></tr>" +
          "<tr class='total'><td>월 실수령액</td><td class='num'>" + DS.won(r.net) + "</td><td class='num'>-</td></tr>";
      }

      DS.text("res-pension-base", DS.won(r.pensionBase));
      DS.text("res-tax-base", DS.won(r.taxBaseAnnual));
      DS.text("res-calc-tax", DS.won(r.calculatedTaxAnnual));

      // 연봉 구간표
      var tableBody = DS.$("salary-table-body");
      if (tableBody) {
        var brackets = [];
        for (var i = 2000; i <= 6000; i += 400) brackets.push(i);
        for (var j = 7000; j <= 10000; j += 1000) brackets.push(j);
        brackets.push(12000);
        tableBody.innerHTML = brackets
          .map(function (manWon) {
            var grossAnnual = manWon * 10000;
            var s = DS.salary(grossAnnual / 12, nonTaxable, dependents);
            return (
              "<tr><td class='em'>" + DS.num(grossAnnual) + "원</td><td class='num'>" + DS.won(s.gross) +
              "</td><td class='num'>" + DS.won(s.net) + "</td><td class='num muted'>" + DS.pct(s.deductionRate) +
              "</td><td class='num'>" + DS.won(s.netAnnual) + "</td></tr>"
            );
          })
          .join("");
      }

      var tableNote = DS.$("salary-table-note");
      if (tableNote) {
        tableNote.textContent =
          "부양가족 " + dependents + "명(본인 포함), 월 비과세 " + DS.won(nonTaxable) + " 기준으로 계산했습니다.";
      }
    }

    onInput(amount, render);
    document.querySelectorAll("input[name='pay-mode']").forEach(function (el) {
      onInput(el, function () {
        if (DS.$("pay-amount")) {
          DS.$("pay-amount").placeholder = el.value === "annual" ? "40,000,000" : "3,400,000";
        }
        render();
      });
    });
    onInput(DS.$("nontaxable"), render);
    onInput(DS.$("dependents"), render);
    render();
  }

  /* ---------- 퇴직금 ---------- */
  function initSeveranceCalc() {
    var join = DS.$("join-date");
    if (!join) return;

    function render() {
      var salaries = [DS.value("salary-1"), DS.value("salary-2"), DS.value("salary-3")];
      var extra = DS.value("salary-bonus");
      var r = DS.severance(join.value, DS.$("leave-date").value, salaries, extra);
      var warn = DS.$("sev-warning");

      if (!r.valid) {
        DS.text("sev-result", "0원");
        DS.text("sev-sub", r.reason === "short" ? "재직일수 365일 미만 — 퇴직금이 발생하지 않습니다." : "입사일과 퇴사일을 확인해 주세요.");
        DS.text("sev-days", r.serviceDays ? DS.num(r.serviceDays) + "일" : "-");
        DS.text("sev-daily", "-");
        DS.text("sev-total-pay", "-");
        DS.html("sev-breakdown", "");
        if (warn) warn.hidden = r.reason !== "short";
        return;
      }
      if (warn) warn.hidden = true;

      DS.text("sev-result", DS.won(r.severance));
      DS.text("sev-sub", "2026년 근로자퇴직급여보장법 기준 · 세전 금액");
      DS.text("sev-days", DS.num(r.serviceDays) + "일 (약 " + r.serviceYears.toFixed(2) + "년)");
      DS.text("sev-daily", DS.won(r.dailyWage));
      DS.text("sev-total-pay", DS.won(r.totalPay) + " / " + DS.num(r.periodDays) + "일");
      DS.text("sev-30day", DS.won(r.dailyWage * 30));

      var tbody = DS.$("sev-breakdown");
      if (tbody) {
        tbody.innerHTML =
          "<tr><th scope='row'>3개월 임금 총액</th><td class='num'>" + DS.won(r.totalPay) + "</td></tr>" +
          "<tr><th scope='row'>3개월 총 일수</th><td class='num'>" + DS.num(r.periodDays) + "일</td></tr>" +
          "<tr><th scope='row'>1일 평균임금</th><td class='num'>" + DS.won(r.dailyWage) + "</td></tr>" +
          "<tr><th scope='row'>평균임금의 30일분</th><td class='num'>" + DS.won(r.dailyWage * 30) + "</td></tr>" +
          "<tr><th scope='row'>재직일수</th><td class='num'>" + DS.num(r.serviceDays) + "일</td></tr>" +
          "<tr class='total'><td>예상 퇴직금</td><td class='num'>" + DS.won(r.severance) + "</td></tr>";
      }
    }

    ["join-date", "leave-date", "salary-1", "salary-2", "salary-3", "salary-bonus"].forEach(function (id) {
      onInput(DS.$(id), render);
    });
    render();
  }

  /* ---------- 실업급여 ---------- */
  function initJobSeekCalc() {
    var avg = DS.$("unemp-avg");
    if (!avg) return;

    function render() {
      var r = DS.unemployment(DS.value("unemp-avg"), DS.value("unemp-age"), DS.$("unemp-period").value, DS.toNum(DS.$("unemp-hours").value) || 8);

      DS.text("unemp-benefit", DS.won(r.benefit));
      DS.text("unemp-benefit-2", DS.won(r.benefit));
      DS.text("unemp-avg-echo", DS.won(DS.value("unemp-avg")));
      DS.text("unemp-days", DS.num(r.days) + "일");
      DS.text("unemp-total", DS.won(r.total));
      DS.text("unemp-monthly", DS.won(r.monthly));
      DS.text("unemp-base", DS.won(r.dailyAvg));
      DS.text("unemp-raw", DS.won(r.rawBenefit));
      DS.text("unemp-floor", DS.won(r.lowerBound));

      var bandText =
        r.band === "cap"
          ? "상한액 적용 — 하루 68,100원"
          : r.band === "floor"
          ? "하한액 적용 — 하루 " + DS.won(r.lowerBound)
          : "평균임금의 60% 그대로 적용";
      DS.text("unemp-band", bandText);
    }

    ["unemp-avg", "unemp-age", "unemp-period", "unemp-hours"].forEach(function (id) {
      onInput(DS.$(id), render);
    });
    render();
  }

  /* ---------- 프리랜서 ---------- */
  function initFreelancerCalc() {
    var contract = DS.$("fl-amount");
    if (!contract) return;

    function renderWithholding() {
      var r = DS.freelance(DS.value("fl-amount"));
      DS.text("fl-net", DS.won(r.net));
      DS.text("fl-withholding", DS.won(r.withholding));
      DS.text("fl-income-tax", DS.won(r.incomeTax));
      DS.text("fl-local-tax", DS.won(r.localTax));
      DS.text("fl-amount-echo", DS.won(r.amount));

      var tbody = DS.$("fl-breakdown");
      if (tbody) {
        tbody.innerHTML =
          "<tr><th scope='row'>계약금액(세전)</th><td class='num'>" + DS.won(r.amount) + "</td></tr>" +
          "<tr><th scope='row'>소득세 3%</th><td class='num'>-" + DS.won(r.incomeTax) + "</td></tr>" +
          "<tr><th scope='row'>지방소득세 0.3%</th><td class='num'>-" + DS.won(r.localTax) + "</td></tr>" +
          "<tr class='total'><td>실수령액</td><td class='num'>" + DS.won(r.net) + "</td></tr>";
      }
    }

    function renderReverse() {
      var net = DS.value("fl-net-input");
      var gross = DS.grossFromNet(net);
      var r = DS.freelance(gross);
      DS.text("fl-rev-gross", DS.won(gross));
      DS.text("fl-rev-tax", DS.won(r.withholding));
      DS.text("fl-rev-echo", DS.won(net));
    }

    function renderAnnual() {
      var revenue = DS.value("ft-revenue");
      var expenseRate = (DS.toNum(DS.$("ft-expense").value) || 0) / 100;
      var dependents = DS.value("ft-dependents") || 1;
      var extra = DS.value("ft-extra");
      var r = DS.comprehensiveTax(revenue, expenseRate, dependents, extra);

      DS.text("ft-income", DS.won(r.businessIncome));
      DS.text("ft-taxbase", DS.won(r.taxBase));
      DS.text("ft-decided", DS.won(r.decided));
      DS.text("ft-prepaid", DS.won(r.prepaid));
      DS.text("ft-settle", DS.won(Math.abs(r.settle)));
      DS.text("ft-decided-sub", DS.won(r.decided));
      DS.text("ft-prepaid-sub", DS.won(r.prepaid));

      var settleLabel = DS.$("ft-settle-label");
      if (settleLabel) {
        settleLabel.textContent = r.settle >= 0 ? "예상 환급액" : "예상 추가납부액";
      }
      var badge = DS.$("ft-badge");
      if (badge) {
        badge.textContent = r.settle >= 0 ? "환급 예상" : "추가납부 예상";
        badge.className = "badge " + (r.settle >= 0 ? "badge-emerald" : "badge-amber");
      }
      DS.text("ft-effective", DS.pct(r.effectiveRate));

      var tbody = DS.$("ft-breakdown");
      if (tbody) {
        tbody.innerHTML =
          "<tr><th scope='row'>연간 수입금액</th><td class='num'>" + DS.won(r.revenue) + "</td></tr>" +
          "<tr><th scope='row'>필요경비 (" + DS.pct(expenseRate * 100, 1) + ")</th><td class='num'>-" + DS.won(r.expense) + "</td></tr>" +
          "<tr><th scope='row'>소득금액</th><td class='num'>" + DS.won(r.businessIncome) + "</td></tr>" +
          "<tr><th scope='row'>기본공제 (부양가족 " + dependents + "명)</th><td class='num'>-" + DS.won(r.personalDeduction) + "</td></tr>" +
          "<tr class='sub'><td>과세표준</td><td class='num'>" + DS.won(r.taxBase) + "</td></tr>" +
          "<tr><th scope='row'>산출세액</th><td class='num'>" + DS.won(r.incomeTax) + "</td></tr>" +
          "<tr><th scope='row'>지방소득세 (10%)</th><td class='num'>+" + DS.won(r.localTax) + "</td></tr>" +
          "<tr class='total'><td>결정세액 합계</td><td class='num'>" + DS.won(r.decided) + "</td></tr>" +
          "<tr class='sub'><td>기납부 원천징수액(3.3%)</td><td class='num'>" + DS.won(r.prepaid) + "</td></tr>";
      }
    }

    ["fl-amount"].forEach(function (id) { onInput(DS.$(id), renderWithholding); });
    ["fl-net-input"].forEach(function (id) { onInput(DS.$(id), renderReverse); });
    ["ft-revenue", "ft-expense", "ft-dependents", "ft-extra"].forEach(function (id) {
      onInput(DS.$(id), renderAnnual);
    });

    renderWithholding();
    renderReverse();
    renderAnnual();
  }

  /* ---------- 연말정산 카드공제 ---------- */
  function initCardCalc() {
    var gross = DS.$("card-gross");
    if (!gross) return;

    function render() {
      var r = DS.cardDeduction(
        DS.value("card-gross"),
        DS.value("card-children") || 0,
        DS.value("card-credit"),
        DS.value("card-check"),
        DS.value("card-transit"),
        DS.value("card-market")
      );

      DS.text("card-result", DS.won(r.totalDeduction));
      DS.text("card-sub", "총급여의 25%(" + DS.won(r.threshold) + ")을 넘는 사용액부터 공제됩니다.");
      DS.text("card-threshold", DS.won(r.threshold));
      DS.text("card-excess", DS.won(r.excess));
      DS.text("card-saving", DS.won(r.savingLow) + " ~ " + DS.won(r.savingHigh));
      DS.text("card-limit", DS.won(r.basicLimit) + " / 추가 " + DS.won(r.bonusLimit));

      var tbody = DS.$("card-breakdown");
      if (tbody) {
        tbody.innerHTML =
          "<tr><th scope='row'>총급여</th><td class='num'>" + DS.won(r.gross) + "</td></tr>" +
          "<tr><th scope='row'>최저사용금액 (총급여 25%)</th><td class='num'>" + DS.won(r.threshold) + "</td></tr>" +
          "<tr><th scope='row'>공제대상 사용액</th><td class='num'>" + DS.won(r.base) + "</td></tr>" +
          "<tr class='sub'><td>문턱 초과분</td><td class='num'>" + DS.won(r.excess) + "</td></tr>" +
          "<tr><th scope='row'>신용카드 15% (" + DS.won(r.creditApplied) + ")</th><td class='num'>" + DS.won(r.creditApplied * 0.15) + "</td></tr>" +
          "<tr><th scope='row'>체크·현금 30% (" + DS.won(r.checkApplied) + ")</th><td class='num'>" + DS.won(r.checkApplied * 0.3) + "</td></tr>" +
          "<tr class='sub'><td>기본한도 " + DS.won(r.basicLimit) + " 적용</td><td class='num'>" + DS.won(r.basicApplied) + "</td></tr>" +
          "<tr><th scope='row'>대중교통·전통시장 40%</th><td class='num'>" + DS.won(r.bonusDeduction) + "</td></tr>" +
          "<tr class='sub'><td>추가한도 " + DS.won(r.bonusLimit) + " 적용</td><td class='num'>" + DS.won(r.bonusApplied) + "</td></tr>" +
          "<tr class='total'><td>예상 소득공제액</td><td class='num'>" + DS.won(r.totalDeduction) + "</td></tr>";
      }

      var hint = DS.$("card-hint");
      if (hint) {
        var remain = r.basicLimit - r.basicApplied;
        hint.textContent = remain > 0
          ? "기본한도가 " + DS.won(remain) + " 남았습니다. 남은 금액은 체크카드·현금영수증(30%)으로 채우는 편이 유리합니다."
          : "이미 기본한도를 모두 채웠습니다. 추가 지출은 공제액을 늘리지 않습니다.";
      }
    }

    ["card-gross", "card-children", "card-credit", "card-check", "card-transit", "card-market"].forEach(function (id) {
      onInput(DS.$(id), render);
    });
    render();
  }

  /* ---------- 4대보험 상세 ---------- */
  function initInsuranceCalc() {
    var pay = DS.$("ins-pay");
    if (!pay) return;

    function render() {
      var injuryRate = (DS.toNum(DS.$("ins-injury").value) || 0) / 100;
      var r = DS.insurance(DS.value("ins-pay"), DS.$("ins-size").value, injuryRate);

      DS.text("ins-employee-total", DS.won(r.employeeTotal));
      DS.text("ins-employee-rate", "월 보수의 " + DS.pct(r.employeeRate));
      DS.text("ins-employer-total", DS.won(r.employerTotal));
      DS.text("ins-employer-rate", "월 보수의 " + DS.pct(r.employerRate));
      DS.text("ins-total-cost", DS.won(r.totalCost));
      DS.text("ins-pension-base", DS.won(r.pensionBase));

      var tbody = DS.$("ins-breakdown");
      if (tbody) {
        tbody.innerHTML =
          r.rows
            .map(function (row) {
              return (
                "<tr><th scope='row'>" + row.name + "</th><td class='num'>" + DS.pct(row.rateEmployee, 2) +
                "</td><td class='num'>" + DS.won(row.employee) + "</td><td class='num'>" + DS.pct(row.rateEmployer, 2) +
                "</td><td class='num'>" + DS.won(row.employer) + "</td></tr>"
              );
            })
            .join("") +
          "<tr class='total'><td>합계</td><td class='num'>" + DS.pct(r.employeeRate) + "</td><td class='num'>" +
          DS.won(r.employeeTotal) + "</td><td class='num'>" + DS.pct(r.employerRate) + "</td><td class='num'>" +
          DS.won(r.employerTotal) + "</td></tr>";
      }
      DS.text("ins-size-label", r.sizeLabel);
    }

    ["ins-pay", "ins-size", "ins-injury"].forEach(function (id) {
      onInput(DS.$(id), render);
    });
    render();
  }

  /* ---------- 시급·주휴수당 ---------- */
  function initHourlyCalc() {
    var wage = DS.$("hw-wage");
    if (!wage) return;

    function renderWage() {
      var r = DS.hourly(DS.value("hw-wage"), DS.toNum(DS.$("hw-hours").value), DS.value("hw-days"));
      DS.text("hw-w-monthly", DS.won(r.monthlyPay));
      DS.text("hw-w-monthly-2", DS.won(r.monthlyPay));
      DS.text("hw-w-weekly", DS.won(r.weeklyTotal));
      DS.text("hw-w-holiday", DS.won(r.holidayPay));
      DS.text("hw-w-holiday-hours", r.eligibleHoliday ? r.holidayHours.toFixed(1) + "시간" : "미발생");
      DS.text("hw-w-hours", r.monthlyHours.toFixed(1) + "시간");
      DS.text("hw-w-annual", DS.won(r.annualPay));
      DS.text("hw-w-week-hours", r.weeklyWorkHours + "시간");

      var warn = DS.$("hw-warning");
      if (warn) {
        if (!r.meetsMinimum && r.hourlyWage > 0) {
          warn.hidden = false;
          warn.textContent =
            "2026년 최저임금(시급 10,320원)보다 " + DS.won(Math.abs(r.minimumGap)) + " 낮습니다. 최저임금 위반 여부를 확인하세요.";
        } else {
          warn.hidden = true;
        }
      }
    }

    function renderMonthly() {
      var monthly = DS.value("hw-monthly-input");
      var p = DS.monthlyToHourly(monthly, DS.toNum(DS.$("hw-hours").value), DS.value("hw-days"));
      DS.text("hw-m-hourly", DS.won(p.hourlyWage));
      DS.text("hw-m-hours", p.monthlyHours.toFixed(1) + "시간");
      DS.text("hw-m-hours-2", p.monthlyHours.toFixed(1) + "시간");
      DS.text("hw-m-weekly-hours", p.weeklyWorkHours + "시간");
      DS.text("hw-m-holiday", p.holidayHours.toFixed(1) + "시간");
      DS.text("hw-m-annual", DS.won(monthly * 12));
    }

    ["hw-wage", "hw-hours", "hw-days"].forEach(function (id) {
      onInput(DS.$(id), function () {
        renderWage();
        renderMonthly();
      });
    });
    onInput(DS.$("hw-monthly-input"), renderMonthly);
    document.querySelectorAll("input[name='hw-mode']").forEach(function (el) {
      onInput(el, function () {
        DS.show("hw-panel-wage", el.value === "wage");
        DS.show("hw-panel-monthly", el.value === "monthly");
        DS.show("hw-panel-wage-result", el.value === "wage");
        DS.show("hw-panel-monthly-result", el.value === "monthly");
        renderWage();
        renderMonthly();
      });
    });
    renderWage();
    renderMonthly();
  }

  window.DSInit = function () {
    initSalaryCalc();
    initSeveranceCalc();
    initJobSeekCalc();
    initFreelancerCalc();
    initCardCalc();
    initInsuranceCalc();
    initHourlyCalc();
  };

  // 테스트(Node)에서도 쓸 수 있도록 내보내기
  if (typeof module !== "undefined" && module.exports) {
    module.exports = DS;
  }
})();
