export function validateCPF(cpf: string): boolean {
  const cleanCPF = cpf.replace(/[^\d]/g, '');

  if (cleanCPF.length !== 11) return false;
  if (/^(\d)\1{10}$/.test(cleanCPF)) return false;

  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (10 - i);
  }
  
  let remainder = 11 - (sum % 11);
  let digit1 = (remainder === 10 || remainder === 11) ? 0 : remainder;
  
  if (parseInt(cleanCPF.charAt(9)) !== digit1) return false;

  sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cleanCPF.charAt(i)) * (11 - i);
  }
  
  remainder = 11 - (sum % 11);
  let digit2 = (remainder === 10 || remainder === 11) ? 0 : remainder;
  
  return parseInt(cleanCPF.charAt(10)) === digit2;
}

export function formatCPF(cpf: string): string {
  return cpf
    .replace(/[^\d]/g, '')
    .replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function normalizeCPF(cpf: string): string {
  return cpf.replace(/[^\d]/g, '');
}

export function validatePhone(phone: string): boolean {
  // Remove tudo que não for dígito
  const cleanPhone = phone.replace(/[^\d]/g, '');
  // Valida celulares (11) ou fixos (10) com DDD
  return /^[1-9]{2}9?[0-9]{8}$/.test(cleanPhone);
}

export function normalizePhone(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}