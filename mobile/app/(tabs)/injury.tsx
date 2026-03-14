import AsyncStorage from '@react-native-async-storage/async-storage';
import BottomSheet, {
  BottomSheetBackdrop,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  useColorScheme,
} from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Colors } from '@/constants/theme';
import {
  BODY_DIAGRAM_KEY,
  type InjuryStatus,
  type MarkedPart,
} from '@/constants/body-store';
import Body, {ExtendedBodyPart, Slug} from "react-native-body-highlighter";

const STATUS_COLORS: Record<InjuryStatus, string> = {
  pain: '#EF4444',
  moderate: '#F59E0B',
  recovering: '#22C55E',
};

const STATUS_LABELS: Record<InjuryStatus, string> = {
  pain: 'Pain',
  moderate: 'Moderate',
  recovering: 'Recovering',
};

function makeKey(slug: Slug, side?: 'left' | 'right') {
  return side ? `${slug}-${side}` : slug;
}

function formatSlug(slug: string) {
  return slug
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

export default function InjuryScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const colors = Colors[colorScheme];
  const isDark = colorScheme === 'dark';

  const [view, setView] = useState<'front' | 'back'>('front');
  const [markedParts, setMarkedParts] = useState<Record<string, MarkedPart>>({});
  const [sheetMode, setSheetMode] = useState<'add' | 'view'>('add');
  const [activePart, setActivePart] = useState<{ slug: Slug; side?: 'left' | 'right' } | null>(null);

  // Form fields (add mode)
  const [selectedStatus, setSelectedStatus] = useState<InjuryStatus>('pain');
  const [howItHappened, setHowItHappened] = useState('');
  const [dateOfInjury, setDateOfInjury] = useState('');
  const [doctorDiagnosis, setDoctorDiagnosis] = useState('');
  const [initialSymptoms, setInitialSymptoms] = useState('');

  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['55%', '92%'], []);

  const sheetBg = isDark ? '#1c1c1e' : '#ffffff';
  const inputBg = isDark ? '#2c2c2e' : '#f2f2f7';
  const borderColor = isDark ? '#3a3a3c' : '#e5e5ea';

  useEffect(() => {
    AsyncStorage.getItem(BODY_DIAGRAM_KEY).then((raw) => {
      if (raw) setMarkedParts(JSON.parse(raw));
    });
  }, []);

  useEffect(() => {
    AsyncStorage.setItem(BODY_DIAGRAM_KEY, JSON.stringify(markedParts));
  }, [markedParts]);

  function resetForm() {
    setSelectedStatus('pain');
    setHowItHappened('');
    setDateOfInjury('');
    setDoctorDiagnosis('');
    setInitialSymptoms('');
  }

  function handleBodyPartPress(part: ExtendedBodyPart, side?: 'left' | 'right') {
    if (!part.slug) return;
    const resolvedSide = side ?? part.side;
    const key = makeKey(part.slug, resolvedSide);

    setActivePart({ slug: part.slug, side: resolvedSide });

    if (markedParts[key]) {
      setSheetMode('view');
    } else {
      setSheetMode('add');
      resetForm();
    }

    sheetRef.current?.snapToIndex(0);
  }

  function handleSave() {
    if (!activePart) return;
    const key = makeKey(activePart.slug, activePart.side);
    const part: MarkedPart = {
      slug: activePart.slug,
      side: activePart.side,
      status: selectedStatus,
      ...(howItHappened.trim() && { howItHappened: howItHappened.trim() }),
      ...(dateOfInjury.trim() && { dateOfInjury: dateOfInjury.trim() }),
      ...(doctorDiagnosis.trim() && { doctorDiagnosis: doctorDiagnosis.trim() }),
      ...(initialSymptoms.trim() && { initialSymptoms: initialSymptoms.trim() }),
    };
    setMarkedParts((prev) => ({ ...prev, [key]: part }));
    sheetRef.current?.close();
  }

  function handleClear() {
    if (!activePart) return;
    const label = `${formatSlug(activePart.slug)}${activePart.side ? ` (${activePart.side})` : ''}`;
    Alert.alert('Clear Injury', `Remove injury mark from ${label}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: () => {
          setMarkedParts((prev) => {
            const next = { ...prev };
            delete next[makeKey(activePart.slug, activePart.side)];
            return next;
          });
          sheetRef.current?.close();
        },
      },
    ]);
  }

  function handleClearAll() {
    Alert.alert('Clear All', 'Remove all marked body parts?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Clear', style: 'destructive', onPress: () => setMarkedParts({}) },
    ]);
  }

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    []
  );

  const bodyData: ExtendedBodyPart[] = Object.values(markedParts).map((p) => ({
    slug: p.slug,
    side: p.side,
    color: STATUS_COLORS[p.status],
    intensity: 1,
  }));

  const markedCount = Object.keys(markedParts).length;
  const activeKey = activePart ? makeKey(activePart.slug, activePart.side) : null;
  const activeMarkedPart = activeKey ? markedParts[activeKey] : null;

  return (
    <ThemedView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <ThemedText type="title" style={styles.heading}>Body Map</ThemedText>
        <ThemedText style={[styles.subtitle, { color: colors.icon }]}>
          Tap a body part to log or view an injury.
          {markedCount > 0 ? ` ${markedCount} area${markedCount !== 1 ? 's' : ''} marked.` : ''}
        </ThemedText>

        {/* Front / Back toggle */}
        <View style={[styles.toggleRow, { backgroundColor: isDark ? '#2a2a2a' : '#f0f0f0' }]}>
          {(['front', 'back'] as const).map((v) => (
            <TouchableOpacity
              key={v}
              style={[styles.toggleBtn, view === v && { backgroundColor: colors.tint }]}
              onPress={() => setView(v)}
              activeOpacity={0.8}
            >
              <ThemedText style={[styles.toggleLabel, view === v && styles.toggleLabelActive]}>
                {v.charAt(0).toUpperCase() + v.slice(1)}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </View>

        {/* Body diagram */}
        <View style={styles.bodyContainer}>
          <Body
            data={bodyData}
            side={view}
            scale={1.1}
            gender="male"
            onBodyPartPress={handleBodyPartPress}
            defaultFill={isDark ? '#3a3a3a' : '#d0d0d0'}
            border={isDark ? '#555' : '#bbb'}
          />
        </View>

        {/* Legend */}
        <View style={styles.legend}>
          {(Object.entries(STATUS_COLORS) as [InjuryStatus, string][]).map(([status, color]) => (
            <View key={status} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: color }]} />
              <ThemedText style={styles.legendLabel}>{STATUS_LABELS[status]}</ThemedText>
            </View>
          ))}
        </View>

        {/* Marked parts list */}
        {markedCount > 0 && (
          <View style={styles.partsList}>
            <ThemedText type="defaultSemiBold" style={styles.partsHeader}>Marked Areas</ThemedText>
            {Object.values(markedParts).map((p) => {
              const key = makeKey(p.slug, p.side);
              return (
                <TouchableOpacity
                  key={key}
                  style={[styles.partRow, { borderBottomColor: borderColor }]}
                  onPress={() => {
                    setActivePart({ slug: p.slug, side: p.side });
                    setSheetMode('view');
                    sheetRef.current?.snapToIndex(0);
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.statusDot, { backgroundColor: STATUS_COLORS[p.status] }]} />
                  <ThemedText style={styles.partName}>
                    {formatSlug(p.slug)}{p.side ? ` (${p.side})` : ''}
                  </ThemedText>
                  <ThemedText style={[styles.partStatus, { color: STATUS_COLORS[p.status] }]}>
                    {STATUS_LABELS[p.status]}
                  </ThemedText>
                  <ThemedText style={[styles.chevron, { color: colors.icon }]}>›</ThemedText>
                </TouchableOpacity>
              );
            })}
            <TouchableOpacity onPress={handleClearAll} style={styles.clearAllBtn}>
              <ThemedText style={styles.clearAllText}>Clear All</ThemedText>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>

      {/* Bottom Sheet */}
      <BottomSheet
        ref={sheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose
        backdropComponent={renderBackdrop}
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        handleIndicatorStyle={{ backgroundColor: colors.icon }}
        backgroundStyle={{ backgroundColor: sheetBg }}
      >
        <BottomSheetScrollView contentContainerStyle={styles.sheetContent}>
          {/* Sheet header */}
          <View style={styles.sheetHeader}>
            <ThemedText style={styles.sheetTitle}>
              {activePart ? formatSlug(activePart.slug) : ''}
              {activePart?.side ? ` (${activePart.side})` : ''}
            </ThemedText>
            {sheetMode === 'view' && activeMarkedPart && (
              <View
                style={[
                  styles.statusBadge,
                  {
                    backgroundColor: STATUS_COLORS[activeMarkedPart.status] + '22',
                    borderColor: STATUS_COLORS[activeMarkedPart.status],
                  },
                ]}
              >
                <View style={[styles.badgeDot, { backgroundColor: STATUS_COLORS[activeMarkedPart.status] }]} />
                <ThemedText style={[styles.badgeText, { color: STATUS_COLORS[activeMarkedPart.status] }]}>
                  {STATUS_LABELS[activeMarkedPart.status]}
                </ThemedText>
              </View>
            )}
          </View>

          {sheetMode === 'add' ? (
            <>
              {/* Status picker */}
              <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Status</ThemedText>
              <View style={styles.statusRow}>
                {(Object.keys(STATUS_COLORS) as InjuryStatus[]).map((s) => (
                  <TouchableOpacity
                    key={s}
                    style={[
                      styles.statusChip,
                      {
                        backgroundColor: selectedStatus === s
                          ? STATUS_COLORS[s]
                          : inputBg,
                        borderColor: STATUS_COLORS[s],
                      },
                    ]}
                    onPress={() => setSelectedStatus(s)}
                    activeOpacity={0.7}
                  >
                    <ThemedText style={[styles.statusChipText, selectedStatus === s && styles.statusChipTextActive]}>
                      {STATUS_LABELS[s]}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </View>

              <View style={[styles.divider, { backgroundColor: borderColor }]} />
              <ThemedText style={[styles.optionalNote, { color: colors.icon }]}>
                All fields below are optional
              </ThemedText>

              <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>How did it happen?</ThemedText>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline, { backgroundColor: inputBg, color: colors.text, borderColor }]}
                placeholder="Describe what happened..."
                placeholderTextColor={colors.icon}
                value={howItHappened}
                onChangeText={setHowItHappened}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Date of Injury</ThemedText>
              <BottomSheetTextInput
                style={[styles.input, { backgroundColor: inputBg, color: colors.text, borderColor }]}
                placeholder="MM/DD/YYYY"
                placeholderTextColor={colors.icon}
                value={dateOfInjury}
                onChangeText={setDateOfInjury}
                keyboardType="numbers-and-punctuation"
                maxLength={10}
              />

              <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Doctor Diagnosis</ThemedText>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline, { backgroundColor: inputBg, color: colors.text, borderColor }]}
                placeholder="e.g. Grade II sprain, ACL tear..."
                placeholderTextColor={colors.icon}
                value={doctorDiagnosis}
                onChangeText={setDoctorDiagnosis}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <ThemedText type="defaultSemiBold" style={styles.fieldLabel}>Initial Symptoms</ThemedText>
              <BottomSheetTextInput
                style={[styles.input, styles.multiline, { backgroundColor: inputBg, color: colors.text, borderColor }]}
                placeholder="e.g. Swelling, limited range of motion..."
                placeholderTextColor={colors.icon}
                value={initialSymptoms}
                onChangeText={setInitialSymptoms}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />

              <TouchableOpacity
                style={[styles.saveBtn, { backgroundColor: colors.tint }]}
                onPress={handleSave}
                activeOpacity={0.8}
              >
                <ThemedText style={styles.saveBtnText}>Save</ThemedText>
              </TouchableOpacity>
            </>
          ) : (
            <>
              {activeMarkedPart && (
                <>
                  {activeMarkedPart.howItHappened && (
                    <DetailRow label="How it happened" value={activeMarkedPart.howItHappened} borderColor={borderColor} />
                  )}
                  {activeMarkedPart.dateOfInjury && (
                    <DetailRow label="Date of Injury" value={activeMarkedPart.dateOfInjury} borderColor={borderColor} />
                  )}
                  {activeMarkedPart.doctorDiagnosis && (
                    <DetailRow label="Doctor's Diagnosis" value={activeMarkedPart.doctorDiagnosis} borderColor={borderColor} />
                  )}
                  {activeMarkedPart.initialSymptoms && (
                    <DetailRow label="Initial Symptoms" value={activeMarkedPart.initialSymptoms} borderColor={borderColor} />
                  )}
                  {!activeMarkedPart.howItHappened &&
                    !activeMarkedPart.dateOfInjury &&
                    !activeMarkedPart.doctorDiagnosis &&
                    !activeMarkedPart.initialSymptoms && (
                      <ThemedText style={[styles.noDetails, { color: colors.icon }]}>
                        No additional details were recorded.
                      </ThemedText>
                    )}
                  <TouchableOpacity
                    style={[styles.clearBtn, { borderColor: '#EF4444' }]}
                    onPress={handleClear}
                    activeOpacity={0.8}
                  >
                    <ThemedText style={styles.clearBtnText}>Clear Injury</ThemedText>
                  </TouchableOpacity>
                </>
              )}
            </>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </ThemedView>
  );
}

function DetailRow({ label, value, borderColor }: { label: string; value: string; borderColor: string }) {
  return (
    <View style={[styles.detailRow, { borderBottomColor: borderColor }]}>
      <ThemedText style={styles.detailLabel}>{label}</ThemedText>
      <ThemedText style={styles.detailValue}>{value}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingTop: 60, paddingBottom: 48 },
  heading: { marginBottom: 6 },
  subtitle: { fontSize: 14, marginBottom: 20, lineHeight: 20 },

  toggleRow: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginBottom: 8,
    alignSelf: 'center',
    width: 200,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  toggleLabel: { fontSize: 14, fontWeight: '500', opacity: 0.5 },
  toggleLabelActive: { color: '#fff', opacity: 1 },

  bodyContainer: { alignItems: 'center', marginVertical: 12 },

  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 20,
    marginTop: 8,
    marginBottom: 24,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendLabel: { fontSize: 13, opacity: 0.8 },

  partsList: { marginTop: 4 },
  partsHeader: { marginBottom: 12, fontSize: 16 },
  partRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  partName: { flex: 1, fontSize: 15, textTransform: 'capitalize' },
  partStatus: { fontSize: 13, fontWeight: '500' },
  chevron: { fontSize: 18 },
  clearAllBtn: { marginTop: 16, alignItems: 'center', paddingVertical: 10 },
  clearAllText: { fontSize: 14, fontWeight: '500', color: '#EF4444' },

  // Bottom sheet
  sheetContent: { padding: 24, paddingBottom: 48 },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
    gap: 12,
  },
  sheetTitle: { fontSize: 22, fontWeight: 'bold', flex: 1 },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    borderWidth: 1,
    gap: 5,
  },
  badgeDot: { width: 7, height: 7, borderRadius: 4 },
  badgeText: { fontSize: 13, fontWeight: '600' },

  statusRow: { flexDirection: 'row', gap: 8, marginBottom: 20, flexWrap: 'wrap' },
  statusChip: {
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 20,
    borderWidth: 1.5,
  },
  statusChipText: { fontSize: 14, fontWeight: '500' },
  statusChipTextActive: { color: '#fff' },

  divider: { height: StyleSheet.hairlineWidth, marginBottom: 16 },
  optionalNote: { fontSize: 12, marginBottom: 16, fontStyle: 'italic' },
  fieldLabel: { marginBottom: 8, fontSize: 14 },
  input: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    marginBottom: 16,
  },
  multiline: { minHeight: 80, paddingTop: 12 },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 8,
  },
  saveBtnText: { color: '#fff', fontSize: 16, fontWeight: '600' },

  // View mode
  detailRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 4,
  },
  detailLabel: { fontSize: 12, opacity: 0.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  detailValue: { fontSize: 15, lineHeight: 22 },
  noDetails: { fontSize: 14, fontStyle: 'italic', marginVertical: 16 },
  clearBtn: {
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 20,
  },
  clearBtnText: { color: '#EF4444', fontSize: 15, fontWeight: '600' },
});
