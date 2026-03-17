import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, {
  Defs,
  Line,
  LinearGradient,
  Path,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { HUD } from '@/constants/hud-theme';
import { api, type MetricPoint } from '@/constants/api';
import { useUser } from '@/context/UserContext';

const SVG_HEIGHT = 180;
const PAD_TOP = 10;
const PAD_BOTTOM = 28;
const PAD_LEFT = 28;
const PAD_RIGHT = 8;
const MAX_VALUE = 100;

function scaleY(value: number, chartH: number): number {
  return PAD_TOP + (1 - value / MAX_VALUE) * chartH;
}

function buildCubicPath(
  points: { x: number; y: number }[],
  chartH: number,
  close: boolean,
  bottomY: number,
): string {
  if (points.length === 0) return '';
  const coords = points.map((p) => ({ x: p.x, y: scaleY(p.y, chartH) }));
  let d = `M ${coords[0].x} ${coords[0].y}`;
  for (let i = 1; i < coords.length; i++) {
    const prev = coords[i - 1];
    const curr = coords[i];
    const cpX = (prev.x + curr.x) / 2;
    d += ` C ${cpX} ${prev.y}, ${cpX} ${curr.y}, ${curr.x} ${curr.y}`;
  }
  if (close) {
    const last = coords[coords.length - 1];
    const first = coords[0];
    d += ` L ${last.x} ${bottomY} L ${first.x} ${bottomY} Z`;
  }
  return d;
}

const LEGEND = [
  { key: 'mobility', label: 'MOBILITY', color: HUD.cyan },
  { key: 'strength', label: 'STRENGTH', color: HUD.success },
  { key: 'pain',     label: 'PAIN.LVL', color: HUD.danger },
];

export default function RecoveryChart() {
  const { user } = useUser();
  const [data, setData] = useState<MetricPoint[]>([]);
  const [containerWidth, setContainerWidth] = useState(0);

  useEffect(() => {
    if (!user) return;
    api.getMetricsHistory(user.id)
      .then((rows) => { if (rows.length > 0) setData(rows); })
      .catch(() => {});
  }, [user?.id]);

  const chartW = containerWidth - PAD_LEFT - PAD_RIGHT;
  const chartH = SVG_HEIGHT - PAD_TOP - PAD_BOTTOM;
  const bottomY = PAD_TOP + chartH;
  const xStep = data.length > 1 ? chartW / (data.length - 1) : 0;

  const mobilityPts = data.map((d, i) => ({ x: PAD_LEFT + i * xStep, y: d.mobility }));
  const strengthPts = data.map((d, i) => ({ x: PAD_LEFT + i * xStep, y: d.strength }));
  const painPts     = data.map((d, i) => ({ x: PAD_LEFT + i * xStep, y: d.pain }));

  const mobilityArea = buildCubicPath(mobilityPts, chartH, true,  bottomY);
  const mobilityLine = buildCubicPath(mobilityPts, chartH, false, bottomY);
  const strengthArea = buildCubicPath(strengthPts, chartH, true,  bottomY);
  const strengthLine = buildCubicPath(strengthPts, chartH, false, bottomY);
  const painArea     = buildCubicPath(painPts,     chartH, true,  bottomY);
  const painLine     = buildCubicPath(painPts,     chartH, false, bottomY);

  const gridYValues = [0, 50, 100];

  return (
    <View>
      <View style={styles.legend}>
        {LEGEND.map((l) => (
          <View key={l.key} style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: l.color }]} />
            <Text style={[styles.legendLabel, { color: l.color }]}>{l.label}</Text>
          </View>
        ))}
      </View>

      <View
        onLayout={(e) => setContainerWidth(e.nativeEvent.layout.width)}
        style={styles.chartContainer}
      >
        {containerWidth > 0 && data.length > 0 && (
          <Svg width={containerWidth} height={SVG_HEIGHT}>
            <Defs>
              <LinearGradient id="mobGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={HUD.cyan}    stopOpacity="0.4" />
                <Stop offset="1" stopColor={HUD.cyan}    stopOpacity="0"   />
              </LinearGradient>
              <LinearGradient id="strGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={HUD.success} stopOpacity="0.4" />
                <Stop offset="1" stopColor={HUD.success} stopOpacity="0"   />
              </LinearGradient>
              <LinearGradient id="painGrad" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={HUD.danger}  stopOpacity="0.4" />
                <Stop offset="1" stopColor={HUD.danger}  stopOpacity="0"   />
              </LinearGradient>
            </Defs>

            {gridYValues.map((val) => {
              const y = scaleY(val, chartH);
              return (
                <Line
                  key={val}
                  x1={PAD_LEFT} y1={y}
                  x2={containerWidth - PAD_RIGHT} y2={y}
                  stroke={HUD.cyan} strokeOpacity={0.1} strokeWidth={1}
                />
              );
            })}

            {gridYValues.map((val) => {
              const y = scaleY(val, chartH);
              return (
                <SvgText
                  key={`ylabel-${val}`}
                  x={PAD_LEFT - 4} y={y + 4}
                  fontSize={8} fill={HUD.muted}
                  textAnchor="end" fontFamily={HUD.mono}
                >
                  {val}
                </SvgText>
              );
            })}

            <Path d={mobilityArea} fill="url(#mobGrad)" />
            <Path d={strengthArea} fill="url(#strGrad)" />
            <Path d={painArea}     fill="url(#painGrad)" />

            <Path d={mobilityLine} fill="none" stroke={HUD.cyan}    strokeWidth={1.5} strokeOpacity={0.9} />
            <Path d={strengthLine} fill="none" stroke={HUD.success} strokeWidth={1.5} strokeOpacity={0.9} />
            <Path d={painLine}     fill="none" stroke={HUD.danger}  strokeWidth={1.5} strokeOpacity={0.9} />

            {data.map((d, i) => (
              <SvgText
                key={d.week}
                x={PAD_LEFT + i * xStep} y={SVG_HEIGHT - 6}
                fontSize={8} fill={HUD.muted}
                textAnchor="middle" fontFamily={HUD.mono}
              >
                {d.week}
              </SvgText>
            ))}
          </Svg>
        )}

        {containerWidth > 0 && data.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>NO METRICS DATA YET</Text>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  legend: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 10,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendLabel: {
    fontFamily: HUD.mono,
    fontSize: 9,
    letterSpacing: 1,
  },
  chartContainer: {
    width: '100%',
    minHeight: SVG_HEIGHT,
  },
  empty: {
    height: SVG_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontFamily: HUD.mono,
    fontSize: 9,
    color: HUD.muted,
    letterSpacing: 1.5,
  },
});
