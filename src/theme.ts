// Visual identity carried over from the Assignment 1 prototype.
export const C = {
  ink: '#17191A',
  rail: '#1E2020',
  panel: '#222526',
  panel2: '#2D3030',
  raised: '#373B36',
  line: '#414542',
  lineSoft: '#343836',
  text: '#F0F1EC',
  muted: '#A1A59E',
  faint: '#73776F',
  lime: '#C7DD63',
  cyan: '#B8C2B0',
  coral: '#E77467',
  amber: '#D7A859',
  green: '#79C795',
  coralBg: '#321F25',
  coralLine: '#754138',
  amberLine: '#806032',
  limeBg: '#2C3320',
};

export const F = {
  regular: 'Manrope_400Regular',
  semi: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

export const levelColor = (level: string) => (level === 'HIGH' ? C.coral : level === 'WATCH' ? C.amber : C.green);
export const biasColor = (bias: string) => (bias === 'tailwind' ? C.green : bias === 'headwind' ? C.coral : C.amber);
export const regimeColor = (r: string) => (r === 'Calm' ? C.green : r === 'Elevated' ? C.amber : C.coral);
export function sevColor(s: number) {
  if (s < 0) return C.green;
  if (s < 4) return '#B8B26A';
  if (s < 6.5) return C.amber;
  if (s < 8.5) return C.coral;
  return '#C94434';
}
