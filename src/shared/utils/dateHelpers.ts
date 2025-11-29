import { dayjs } from '../lib/dayjs';

export interface TimeRange {
  start: string; // HH:mm
  end: string;   // HH:mm
}

export function parseTime(time: string): { hours: number; minutes: number } {
  if (!time) throw new Error('Hora inválida: valor vazio');
  
  // Validação estrita do formato
  const d = dayjs(time, 'HH:mm', true);
  
  if (!d.isValid()) {
    throw new Error(`Formato de hora inválido: ${time}`);
  }

  return { hours: d.hour(), minutes: d.minute() };
}

export function formatTime(hours: number, minutes: number): string {
  return dayjs().hour(hours).minute(minutes).format('HH:mm');
}

export function isValidTimeFormat(time: string): boolean {
  return dayjs(time, 'HH:mm', true).isValid();
}

export function timeToMinutes(time: string): number {
  const d = dayjs(time, 'HH:mm');
  if (!d.isValid()) return 0;
  return d.hour() * 60 + d.minute();
}

export function minutesToTime(minutes: number): string {
  const d = dayjs.duration(minutes, 'minutes');
  const hours = Math.floor(d.asHours()); // asHours lida com durações > 24h corretamente
  const mins = d.minutes();
  return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
}

export function isTimeInRange(time: string, range: TimeRange): boolean {
  const target = dayjs(time, 'HH:mm');
  const start = dayjs(range.start, 'HH:mm');
  let end = dayjs(range.end, 'HH:mm');

  if (!target.isValid() || !start.isValid() || !end.isValid()) return false;

  // Tratamento de turno noturno (ex: 22:00 as 05:00)
  if (end.isBefore(start)) {
    end = end.add(1, 'day');
    // Se o target for de madrugada (antes do início), assume dia seguinte
    if (target.isBefore(start)) {
      const targetNextDay = target.add(1, 'day');
      return targetNextDay.isBetween(start, end, null, '[]'); // [] = inclusivo
    }
  }

  return target.isBetween(start, end, null, '[]');
}

export function calculateTimeDifference(start: string, end: string): number {
  const startTime = dayjs(start, 'HH:mm');
  let endTime = dayjs(end, 'HH:mm');

  if (!startTime.isValid() || !endTime.isValid()) return 0;

  // Se fim for menor que inicio, adiciona 1 dia (turno noturno)
  if (endTime.isBefore(startTime)) {
    endTime = endTime.add(1, 'day');
  }

  return endTime.diff(startTime, 'minute');
}

export function getDayOfWeek(date: Date | string): number {
  // Dayjs: 0 (Dom) a 6 (Sab) -> Objetivo: 1 (Seg) a 7 (Dom)
  const day = dayjs(date).day();
  return day === 0 ? 7 : day;
}

export function parseWorkDays(workDaysJson: string | unknown): number[] {
  if (Array.isArray(workDaysJson)) return workDaysJson.filter(d => typeof d === 'number');
  if (typeof workDaysJson !== 'string') return [];

  try {
    const days = JSON.parse(workDaysJson);
    if (!Array.isArray(days)) return [];
    
    return days
      .map(d => Number(d))
      .filter(day => !isNaN(day) && day >= 1 && day <= 7);
  } catch {
    return [];
  }
}

export function isWorkDay(date: Date, workDays: number[]): boolean {
  const dayOfWeek = getDayOfWeek(date);
  return workDays.includes(dayOfWeek);
}