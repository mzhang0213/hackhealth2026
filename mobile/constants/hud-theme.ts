import { Platform, ViewStyle } from 'react-native';

export const HUD = {
  bg: '#080c14',
  cardBg: '#0c1220',
  cyan: '#00d4ff',
  success: '#00e676',
  warning: '#ffb300',
  danger: '#ff5252',
  text: '#e0f2fe',
  muted: 'rgba(0,212,255,0.45)',
  border: 'rgba(0,212,255,0.2)',
  mono: Platform.OS === 'android' ? 'monospace' : 'Courier New',
} as const;

export function hudGlow(radius: number = 10): ViewStyle {
  if (Platform.OS === 'ios') {
    return {
      shadowColor: HUD.cyan,
      shadowOffset: { width: 0, height: 0 },
      shadowRadius: radius,
      shadowOpacity: 0.55,
    };
  }
  return { elevation: 4 };
}
