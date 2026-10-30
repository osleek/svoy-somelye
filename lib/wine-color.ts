
const ACCENTS: Record<string, string> = {
  Красное: '#4E1F2B',
  Белое: '#3D6B58',
  Розовое: '#B87E88',
  Оранжевое: '#B5733A',
};

export function accentFor(type: string | null): string {
  if (!type) return '#3D6B58';
  return ACCENTS[type] ?? '#3D6B58';
}

function luminance(hex: string): number {
  const value = hex.replace('#', '');
  const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
  const linear = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}

export function onColor(accent: string): string {
  return luminance(accent) > 0.45 ? '#221D19' : '#FBF8F2';
}
