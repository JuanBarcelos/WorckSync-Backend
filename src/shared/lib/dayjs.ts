import dayjs from 'dayjs';
import 'dayjs/locale/pt-br';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import isBetween from 'dayjs/plugin/isBetween';
import duration from 'dayjs/plugin/duration';

// Configuração Global
dayjs.locale('pt-br');

// Plugins
dayjs.extend(customParseFormat); // Permite usar formatos como 'HH:mm' no parse
dayjs.extend(isBetween);         // Útil para verificar intervalos
dayjs.extend(duration);          // Útil para cálculos de tempo

export { dayjs };