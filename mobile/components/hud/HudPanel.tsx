import React, { useEffect, useRef } from 'react';
import {
  Animated,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { HUD } from '@/constants/hud-theme';

interface HudPanelProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  style?: ViewStyle;
}

function CornerAccent({
  position,
  opacity = 1,
}: {
  position: 'topLeft' | 'topRight' | 'bottomLeft' | 'bottomRight';
  opacity?: number;
}) {
  const isLeft = position === 'topLeft' || position === 'bottomLeft';
  const isTop = position === 'topLeft' || position === 'topRight';

  const containerStyle: ViewStyle = {
    position: 'absolute',
    width: 18,
    height: 18,
    ...(isLeft ? { left: 0 } : { right: 0 }),
    ...(isTop ? { top: 0 } : { bottom: 0 }),
  };

  const hLine: ViewStyle = {
    position: 'absolute',
    width: 18,
    height: 1.5,
    backgroundColor: HUD.cyan,
    opacity,
    ...(isTop ? { top: 0 } : { bottom: 0 }),
    ...(isLeft ? { left: 0 } : { right: 0 }),
  };

  const vLine: ViewStyle = {
    position: 'absolute',
    width: 1.5,
    height: 18,
    backgroundColor: HUD.cyan,
    opacity,
    ...(isTop ? { top: 0 } : { bottom: 0 }),
    ...(isLeft ? { left: 0 } : { right: 0 }),
  };

  return (
    <View style={containerStyle} pointerEvents="none">
      <View style={hLine} />
      <View style={vLine} />
    </View>
  );
}

export default function HudPanel({ title, subtitle, children, style }: HudPanelProps) {
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 0.2,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [pulseAnim]);

  return (
    <View style={[styles.panel, style]}>
      {/* Corner accents */}
      <CornerAccent position="topLeft" opacity={1} />
      <CornerAccent position="topRight" opacity={0.5} />
      <CornerAccent position="bottomLeft" opacity={0.35} />
      <CornerAccent position="bottomRight" opacity={0.35} />

      {/* Header */}
      <View style={styles.header}>
        <Animated.View style={[styles.pulseDot, { opacity: pulseAnim }]} />
        <View style={styles.headerText}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {/* Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: HUD.cardBg,
    borderWidth: 1,
    borderColor: HUD.border,
    borderRadius: 4,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: HUD.border,
    gap: 8,
  },
  pulseDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: HUD.cyan,
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontFamily: HUD.mono,
    fontSize: 11,
    letterSpacing: 2,
    color: HUD.cyan,
    textTransform: 'uppercase',
  },
  subtitle: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1,
    marginTop: 2,
  },
  content: {
    padding: 14,
  },
});
