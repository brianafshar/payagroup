import { useEffect, useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Modal as RNModal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';
import { Button, IconButton } from './controls';
import { KEYBOARD_BEHAVIOR } from './layout';
import { Txt } from './primitives';

export interface ModalProps {
  open: boolean;
  title: string;
  description?: string;
  primaryLabel?: string;
  secondaryLabel?: string;
  primaryDisabled?: boolean;
  loading?: boolean;
  onPrimary?: () => void;
  onClose: () => void;
  children?: ReactNode;
}

/** Centered dialog. Tapping the scrim or the × closes it (Android back too). */
export function Modal({ open, title, description, primaryLabel, secondaryLabel, primaryDisabled, loading, onPrimary, onClose, children }: ModalProps) {
  const { c } = useTheme();
  return (
    <RNModal visible={open} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <KeyboardAvoidingView behavior={KEYBOARD_BEHAVIOR} style={{ flex: 1, justifyContent: 'center', padding: 16 }}>
        <Pressable accessibilityLabel="بستن" onPress={onClose} style={{ position: 'absolute', top: 0, bottom: 0, start: 0, end: 0, backgroundColor: c.overlay }} />
        <View accessibilityViewIsModal style={{ backgroundColor: c['surface-elevated'], borderRadius: 12, maxHeight: '90%', borderWidth: 1, borderColor: c['border-subtle'] }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingTop: 20, paddingStart: 24, paddingEnd: 20 }}>
            <View style={{ flex: 1 }}>
              <Txt size={18} lh={26} w={600} accessibilityRole="header">
                {title}
              </Txt>
              {description ? (
                <Txt size={14} lh={22} color="text-secondary" style={{ marginTop: 4 }}>
                  {description}
                </Txt>
              ) : null}
            </View>
            <IconButton icon="x" label="بستن" size="sm" onPress={onClose} />
          </View>
          {children ? (
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingVertical: 20, paddingHorizontal: 24, gap: 16 }}>
              {children}
            </ScrollView>
          ) : (
            <View style={{ height: 20 }} />
          )}
          <View
            style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 8, paddingVertical: 16, paddingHorizontal: 24, borderTopWidth: 1, borderTopColor: c['border-subtle'] }}
          >
            {secondaryLabel ? (
              <Button variant="secondary" onPress={onClose}>
                {secondaryLabel}
              </Button>
            ) : null}
            {primaryLabel ? (
              <Button disabled={primaryDisabled} loading={loading} onPress={onPrimary}>
                {primaryLabel}
              </Button>
            ) : null}
          </View>
        </View>
      </KeyboardAvoidingView>
    </RNModal>
  );
}

/* ---------------- toasts ---------------- */

type ToastItem = { id: number; title: string; desc?: string; tone: 'success' | 'error' | 'info' };
let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(t: ToastItem[]) => void>();
const emit = () => listeners.forEach((l) => l(items));

/** Confirmation toast shown above the tab bar (same role as `blToast` in the prototype). */
export function toast(title: string, desc?: string, tone: ToastItem['tone'] = 'success'): void {
  if (items.some((t) => t.title === title)) return;
  const t = { id: nextId++, title, desc, tone };
  items = [...items, t];
  emit();
  setTimeout(() => {
    items = items.filter((x) => x.id !== t.id);
    emit();
  }, 3200);
}

export function ToastHost() {
  const insets = useSafeAreaInsets();
  const [list, setList] = useState(items);
  useEffect(() => {
    listeners.add(setList);
    return () => {
      listeners.delete(setList);
    };
  }, []);
  if (!list.length) return null;
  return (
    <View pointerEvents="box-none" style={{ position: 'absolute', start: 16, end: 16, bottom: insets.bottom + 88, gap: 8 }}>
      {list.map((t) => (
        <View
          key={t.id}
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={{
            flexDirection: 'row',
            gap: 12,
            alignItems: 'flex-start',
            paddingVertical: 12,
            paddingHorizontal: 16,
            borderRadius: 10,
            backgroundColor: '#111418',
            borderWidth: 1,
            borderColor: '#2A2A2A',
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              marginTop: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: t.tone === 'error' ? '#E5484D' : '#FF9A1F',
            }}
          >
            <Txt size={12} lh={16} w={700} color="#111418">
              {t.tone === 'error' ? '!' : '✓'}
            </Txt>
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <Txt size={14} lh={22} w={600} color="#FFFFFF">
              {t.title}
            </Txt>
            {t.desc ? (
              <Txt size={13} lh={20} color="#C9CED6">
                {t.desc}
              </Txt>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}
