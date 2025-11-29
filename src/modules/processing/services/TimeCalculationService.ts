import { Shift, TimeRecord } from '@prisma/client';
import { TimeCalculation } from '../types';
import {
  timeToMinutes,
  calculateTimeDifference,
} from '../../../shared/utils/dateHelpers';

/**
 * TimeCalculationService - versão completa e revisada
 *
 * Notas:
 * - interpretTimeRecord: insere almoço padrão automaticamente quando existem exatamente 2 registros
 *   e eles são compatíveis com uma jornada completa do turno.
 * - calculateTotalWorkedWithRules: soma apenas intervalos válidos; aplica regra CLT de desconto de almoço
 *   apenas se jornada > 6h e não houver almoço explícito.
 */
export class TimeCalculationService {
  public calculateWorkTime(
    timeRecord: TimeRecord,
    shift: Shift | null
  ): TimeCalculation {
    const calculation: TimeCalculation = {
      totalWorkedMinutes: 0,
      regularMinutes: 0,
      overtimeMinutes: 0,
      nightShiftMinutes: 0,
      lateMinutes: 0,
      earlyLeaveMinutes: 0,
      missingMinutes: 0,
      lunchDurationMinutes: 0,
      excessiveLunchMinutes: 0,
    };

    // Se não há marcações quaisquer
    const hasAnyClock =
      !!timeRecord.clockIn1 || !!timeRecord.clockOut1 ||
      !!timeRecord.clockIn2 || !!timeRecord.clockOut2 ||
      !!timeRecord.clockIn3 || !!timeRecord.clockOut3;

    if (!hasAnyClock) {
      if (shift) calculation.missingMinutes = this.calculateExpectedWorkMinutes(shift);
      return calculation;
    }

    // Interpretar registros (gera almoço automático para 1 registro ou 2 registros conforme regras)
    const interpreted = this.interpretTimeRecord(timeRecord, shift);

    // Detecta se existe qualquer saída após interpretação
    const hasAnyClockOut =
      !!interpreted.clockOut1 || !!interpreted.clockOut2 || !!interpreted.clockOut3;

    // Se existe turno e não há nenhuma saída e não é caso "apenas 1 registro" interpretado, tratar como falta
    const definedCountOriginal = this.countDefinedClocks(timeRecord);
    if (shift && !hasAnyClockOut && !(definedCountOriginal === 1)) {
      calculation.missingMinutes = this.calculateExpectedWorkMinutes(shift);
      return calculation;
    }

    // Calcular total trabalhado com regras (somente intervalos válidos)
    calculation.totalWorkedMinutes = this.calculateTotalWorkedWithRules(interpreted, shift);

    // Se tem turno, calcular detalhes adicionais
    if (shift) {
      // Late (usar primeiro clockIn efetivo)
      if (interpreted.clockIn1) {
        calculation.lateMinutes = this.calculateLateMinutesWithRules(
          interpreted.clockIn1,
          shift.startTime,
          shift.toleranceMinutes ?? 0
        );
      }

      // Early leave: último clockOut existente
      const lastClockOut = interpreted.clockOut3 || interpreted.clockOut2 || interpreted.clockOut1;
      if (lastClockOut) {
        calculation.earlyLeaveMinutes = this.calculateEarlyLeaveMinutes(
          lastClockOut,
          shift.endTime,
          shift.toleranceMinutes ?? 0
        );
      }

      // Lunch duration e excesso (somente se houver registros reais de saída e retorno)
      if (interpreted.clockOut1 && interpreted.clockIn2) {
        calculation.lunchDurationMinutes = calculateTimeDifference(
          interpreted.clockOut1,
          interpreted.clockIn2
        );

        const expectedLunch = calculateTimeDifference(shift.lunchStartTime, shift.lunchEndTime);
        if (calculation.lunchDurationMinutes > expectedLunch) {
          calculation.excessiveLunchMinutes = calculation.lunchDurationMinutes - expectedLunch;
        }
      } else {
        calculation.lunchDurationMinutes = 0;
      }

      // Expected work
      const expectedWork = this.calculateExpectedWorkMinutes(shift);

      // Regular / Overtime / Missing
      if (calculation.totalWorkedMinutes > expectedWork) {
        calculation.regularMinutes = expectedWork;
        calculation.overtimeMinutes = calculation.totalWorkedMinutes - expectedWork;
      } else {
        calculation.regularMinutes = calculation.totalWorkedMinutes;
        if (calculation.totalWorkedMinutes < expectedWork) {
          calculation.missingMinutes = expectedWork - calculation.totalWorkedMinutes;
        }
      }

      // Night shift
      calculation.nightShiftMinutes = this.calculateNightShiftMinutes(interpreted);
    } else {
      calculation.regularMinutes = calculation.totalWorkedMinutes;
    }

    // Normalizar não-negativos
    calculation.totalWorkedMinutes = Math.max(0, calculation.totalWorkedMinutes);
    calculation.regularMinutes = Math.max(0, calculation.regularMinutes);
    calculation.overtimeMinutes = Math.max(0, calculation.overtimeMinutes);
    calculation.missingMinutes = Math.max(0, calculation.missingMinutes);

    return calculation;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  // Conta quantos registros (presentes) existem no registro original
  private countDefinedClocks(timeRecord: TimeRecord) {
    return [
      timeRecord.clockIn1,
      timeRecord.clockOut1,
      timeRecord.clockIn2,
      timeRecord.clockOut2,
      timeRecord.clockIn3,
      timeRecord.clockOut3
    ].filter(Boolean).length;
  }

  /**
   * Interpreta registros de ponto.
   * - 0 registros: retorna vazio
   * - 1 registro: assume almoço padrão (clockOut1 = lunchStart, clockIn2 = lunchEnd)
   * - 2 registros:
   *    -> se ambos compatíveis com turno completo (entrada próximo ao início e saída próximo ao fim) ->
   *         insere almoço padrão entre lunchStart/lunchEnd e distribui saída real para clockOut2
   *    -> se segundo estiver antes do lunchStart -> assume entrada + saída (jornada contínua)
   *    -> se segundo estiver entre lunchStart e lunchEnd -> assume saída para almoço e insere volta no lunchEnd
   *    -> se segundo > lunchEnd -> assume entrada + volta de almoço (falta saída final)
   * - 3+ registros: preserva ordem em clockIn1..clockOut3 (até 6 valores)
   */
  public interpretTimeRecord(timeRecord: TimeRecord, shift: Shift | null): TimeRecord {
    if (!shift) return timeRecord;

    const clocks = [
      timeRecord.clockIn1,
      timeRecord.clockOut1,
      timeRecord.clockIn2,
      timeRecord.clockOut2,
      timeRecord.clockIn3,
      timeRecord.clockOut3
    ].filter(Boolean) as string[];

    // ordenar cronologicamente
    clocks.sort((a, b) => timeToMinutes(a) - timeToMinutes(b));

    const shiftStart = timeToMinutes(shift.startTime);
    const shiftEnd = timeToMinutes(shift.endTime);
    const lunchStart = timeToMinutes(shift.lunchStartTime);
    const lunchEnd = timeToMinutes(shift.lunchEndTime);

    // 0 registros
    if (clocks.length === 0) {
      return {
        ...timeRecord,
        clockIn1: null,
        clockOut1: null,
        clockIn2: null,
        clockOut2: null,
        clockIn3: null,
        clockOut3: null
      };
    }

    // 1 registro -> inserir almoço padrão (regra 2:C)
    if (clocks.length === 1) {
      const entry = clocks[0];
      return {
        ...timeRecord,
        clockIn1: entry,
        clockOut1: shift.lunchStartTime,
        clockIn2: shift.lunchEndTime,
        clockOut2: null,
        clockIn3: null,
        clockOut3: null
      };
    }

    // 2 registros -> regras específicas (inserir almoço se compatível com jornada)
    if (clocks.length === 2) {
      const first = clocks[0];
      const second = clocks[1];

      const firstMin = timeToMinutes(first);
      const secondMin = timeToMinutes(second);

      // heurística: considerar compatível com jornada completa quando:
      // - entrada até 2h após início do turno
      // - saída a partir de (end - 2h) até 2h depois do fim
      const entryWindow = shiftStart + 120; // 2h depois do início
      const exitWindow = shiftEnd - 120;   // 2h antes do fim

      const isEntryCompatible = firstMin <= entryWindow;
      const isExitCompatible = secondMin >= exitWindow;

      // Entrada + Saída compatíveis -> inserir almoço padrão entre lunchStart/lunchEnd
      if (isEntryCompatible && isExitCompatible) {
        return {
          ...timeRecord,
          clockIn1: first,
          clockOut1: shift.lunchStartTime,
          clockIn2: shift.lunchEndTime,
          clockOut2: second,
          clockIn3: null,
          clockOut3: null
        };
      }

      // Segundo está antes do início do almoço -> entrada + saída (jornada contínua curta)
      if (secondMin <= lunchStart) {
        return {
          ...timeRecord,
          clockIn1: first,
          clockOut1: second,
          clockIn2: null,
          clockOut2: null,
          clockIn3: null,
          clockOut3: null
        };
      }

      // Segundo entre lunchStart e lunchEnd -> entrada + saída para almoço real; inserir retorno padrão
      if (secondMin > lunchStart && secondMin <= lunchEnd) {
        return {
          ...timeRecord,
          clockIn1: first,
          clockOut1: second, // saída para almoço
          clockIn2: shift.lunchEndTime, // retorno padrão
          clockOut2: null,
          clockIn3: null,
          clockOut3: null
        };
      }

      // Segundo após lunchEnd -> interpretamos como entrada + volta do almoço (falta saída final)
      if (secondMin > lunchEnd) {
        return {
          ...timeRecord,
          clockIn1: first,
          clockOut1: null, // falta saída para almoço
          clockIn2: second, // volta real
          clockOut2: null,
          clockIn3: null,
          clockOut3: null
        };
      }

      // fallback conservador
      return {
        ...timeRecord,
        clockIn1: first,
        clockOut1: second,
        clockIn2: null,
        clockOut2: null,
        clockIn3: null,
        clockOut3: null
      };
    }

    // 3+ registros -> tenta mapear sequencialmente (até 6 valores)
    // tomada simplificada: atribui em ordem cronológica
    return {
      ...timeRecord,
      clockIn1: clocks[0] ?? null,
      clockOut1: clocks[1] ?? null,
      clockIn2: clocks[2] ?? null,
      clockOut2: clocks[3] ?? null,
      clockIn3: clocks[4] ?? null,
      clockOut3: clocks[5] ?? null,
    };
  }

  /**
   * Calcula tempo trabalhado somando apenas períodos válidos.
   * - Se falta saída final (e não for caso 1-registro) => total = 0 (incompleto)
   * - Se não há almoço explícito e jornada > 6h => subtrai almoço padrão (CLT)
   */
  private calculateTotalWorkedWithRules(
    timeRecord: TimeRecord,
    shift: Shift | null
  ): number {
    let total = 0;
    let hasExplicitLunch = false;

    // Se temos turno, verificar se falta saída final (exceto quando originalmente havia apenas 1 registro)
    const originalCount = this.countDefinedClocks(timeRecord);
    const hasAnyClockOut = !!timeRecord.clockOut1 || !!timeRecord.clockOut2 || !!timeRecord.clockOut3;
    if (shift && !hasAnyClockOut && originalCount > 1) {
      // incompleto segundo regra B -> total 0
      return 0;
    }

    // Período 1
    if (timeRecord.clockIn1 && timeRecord.clockOut1) {
      const effectiveIn = shift ? this.getEffectiveClockIn(timeRecord.clockIn1, shift.startTime) : timeRecord.clockIn1;
      const effectiveOut = shift ? this.getEffectiveClockOut(timeRecord.clockOut1, shift.endTime) : timeRecord.clockOut1;

      total += calculateTimeDifference(effectiveIn, effectiveOut);
      if (timeRecord.clockIn2) hasExplicitLunch = true;
    } else if (timeRecord.clockIn1 && !timeRecord.clockOut1 && shift && originalCount === 1) {
      // caso 1 registro já transformado pela interpretação -> o clockOut1/clockIn2 devem existir após interpretação
      // se chegou até aqui sem clockOut1 setado, seguir com salvaguarda (no entanto, o interpretTimeRecord deveria ter setado)
    }

    // Período 2
    if (timeRecord.clockIn2 && timeRecord.clockOut2) {
      hasExplicitLunch = true;
      const effIn2 = timeRecord.clockIn2;
      const effOut2 = shift ? this.getEffectiveClockOut(timeRecord.clockOut2, shift.endTime) : timeRecord.clockOut2;
      total += calculateTimeDifference(effIn2, effOut2);
    } else if (timeRecord.clockIn2 && !timeRecord.clockOut2 && shift) {
      // voltou do almoço mas não registrou saída -> incompleto (0)
      return 0;
    }

    // Período 3
    if (timeRecord.clockIn3 && timeRecord.clockOut3) {
      total += calculateTimeDifference(timeRecord.clockIn3, timeRecord.clockOut3);
    }

    // Se não houve almoço explícito e jornada > 6h -> subtrair almoço padrão (CLT)
    if (shift && !hasExplicitLunch) {
      const lunchStandard = calculateTimeDifference(shift.lunchStartTime, shift.lunchEndTime);
      if (total > 360) total -= lunchStandard;
    }

    return Math.max(0, total);
  }

  // Ajusta entrada antecipada para o início do turno
  private getEffectiveClockIn(actualClockIn: string, shiftStart: string): string {
    const actualMinutes = timeToMinutes(actualClockIn);
    const shiftMinutes = timeToMinutes(shiftStart);
    return actualMinutes < shiftMinutes ? shiftStart : actualClockIn;
  }

  // Mantém saída real (saída antes = early leave; saída depois = overtime)
  private getEffectiveClockOut(actualClockOut: string, _shiftEnd: string): string {
    return actualClockOut;
  }

  private calculateLateMinutesWithRules(clockIn: string, expectedStart: string, tolerance: number): number {
    const actual = timeToMinutes(clockIn);
    const expected = timeToMinutes(expectedStart);
    if (actual <= expected) return 0;
    const diff = actual - expected;
    return diff > tolerance ? diff - tolerance : 0;
  }

  private calculateExpectedWorkMinutes(shift: Shift): number {
    const totalShift = calculateTimeDifference(shift.startTime, shift.endTime);
    const lunchTime = calculateTimeDifference(shift.lunchStartTime, shift.lunchEndTime);
    return totalShift - lunchTime;
  }

  private calculateEarlyLeaveMinutes(clockOut: string, expectedEnd: string, tolerance: number): number {
    const actual = timeToMinutes(clockOut);
    const expected = timeToMinutes(expectedEnd);
    const diff = expected - actual;
    return diff > tolerance ? diff - tolerance : 0;
  }

  /**
   * Calcula minutos noturnos por interseção entre intervalo de trabalho e janela noturna (22:00-05:00).
   */
  private calculateNightShiftMinutes(timeRecord: TimeRecord): number {
    const intervals: Array<[string, string]> = [];
    if (timeRecord.clockIn1 && timeRecord.clockOut1) intervals.push([timeRecord.clockIn1, timeRecord.clockOut1]);
    if (timeRecord.clockIn2 && timeRecord.clockOut2) intervals.push([timeRecord.clockIn2, timeRecord.clockOut2]);
    if (timeRecord.clockIn3 && timeRecord.clockOut3) intervals.push([timeRecord.clockIn3, timeRecord.clockOut3]);

    const nightStart = timeToMinutes('22:00');
    const nightEnd = timeToMinutes('05:00');

    let night = 0;

    const intersect = (aStart: number, aEnd: number, bStart: number, bEnd: number) => {
      const start = Math.max(aStart, bStart);
      const end = Math.min(aEnd, bEnd);
      return Math.max(0, end - start);
    };

    for (const [s, e] of intervals) {
      let startMin = timeToMinutes(s);
      let endMin = timeToMinutes(e);

      // se cruza meia-noite
      if (endMin < startMin) {
        night += intersect(startMin, 1440, nightStart, 1440);
        night += intersect(0, endMin, 0, nightEnd);
      } else {
        night += intersect(startMin, endMin, nightStart, 1440);
        night += intersect(startMin, endMin, 0, nightEnd);
      }
    }

    return night;
  }

  /**
   * Fornece uma análise simplificada do registro.
   */
  analyzeTimeRecord(timeRecord: TimeRecord, shift: Shift | null) {
    const interpreted = this.interpretTimeRecord(timeRecord, shift);
    const issues: string[] = [];
    const suggestions: string[] = [];
    const calculations: any = {};

    const records: string[] = [];
    if (timeRecord.clockIn1) records.push(timeRecord.clockIn1);
    if (timeRecord.clockOut1) records.push(timeRecord.clockOut1);
    if (timeRecord.clockIn2) records.push(timeRecord.clockIn2);
    if (timeRecord.clockOut2) records.push(timeRecord.clockOut2);
    if (timeRecord.clockIn3) records.push(timeRecord.clockIn3);
    if (timeRecord.clockOut3) records.push(timeRecord.clockOut3);

    let interpretation = 'Registro normal';

    if (shift) {
      calculations.expectedWork = this.calculateExpectedWorkMinutes(shift);
      calculations.lunchTime = calculateTimeDifference(shift.lunchStartTime, shift.lunchEndTime);
    }

    const defined = this.countDefinedClocks(timeRecord);

    if (defined === 1) {
      interpretation = 'Apenas 1 registro - assumido almoço padrão';
      suggestions.push('Verificar se houve registro de saída/retorno reais');
    } else if (defined === 2) {
      if (interpreted.clockIn2 && !interpreted.clockOut1) {
        interpretation = 'Entrada + Volta do almoço (falta saída para almoço)';
        issues.push('Falta registro de saída para almoço');
        issues.push('Falta registro de saída final');
      } else if (interpreted.clockOut1 && !interpreted.clockIn2) {
        interpretation = 'Entrada + Saída (jornada contínua)';
        if (shift) suggestions.push(`Intervalo de almoço padrão de ${calculations.lunchTime} minutos pode ser descontado (se jornada > 6h)`);
      } else if (interpreted.clockIn2 && !interpreted.clockOut2) {
        interpretation = 'Entrada + Volta do almoço (falta saída final)';
        issues.push('Falta registro de saída final');
      }
    } else if (defined === 0) {
      interpretation = 'Sem registros (falta)';
      issues.push('Nenhum registro de ponto');
    } else if (defined >= 4) {
      interpretation = 'Registro completo';
    }

    return {
      interpretation,
      issues,
      suggestions,
      calculations,
    };
  }
}
