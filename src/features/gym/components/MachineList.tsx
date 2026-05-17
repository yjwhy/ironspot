import { MaterialIcons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, View } from 'react-native';

import { ReportReasonSheet } from '@/features/photo/components/ReportReasonSheet';
import { AppText } from '@/shared/components/AppText';
import { toTestSlug } from '@/shared/lib/format';
import { pressedOpacity } from '@/shared/lib/pressable';
import { colors } from '@/shared/theme/tokens';
import type { GymMachineWithDetails } from '@/shared/types/database';

import { groupMachinesByBrand, machineDisplayName } from '../lib/group-machines';

interface MachineListProps {
  machines: readonly GymMachineWithDetails[];
  onPressMachine: (gymMachineId: string) => void;
}

export function MachineList({ machines, onPressMachine }: MachineListProps) {
  const groups = groupMachinesByBrand(machines);
  const [collapsedBrandIds, setCollapsedBrandIds] = useState<ReadonlySet<string>>(new Set());
  // ADR 0022 follow-up (Task 46): which gym_machine row is being reported.
  // null = sheet hidden. The sheet's BottomSheetModalProvider is self-contained.
  const [reportTargetId, setReportTargetId] = useState<string | null>(null);

  function toggleBrand(brandId: string) {
    setCollapsedBrandIds((prev) => {
      const next = new Set(prev);
      if (next.has(brandId)) next.delete(brandId);
      else next.add(brandId);
      return next;
    });
  }

  function handleReportSheetClose() {
    setReportTargetId(null);
  }

  return (
    <View className="gap-4">
      {groups.map((group) => {
        const isCollapsed = collapsedBrandIds.has(group.brand.id);
        const headerLabel = `${group.brand.name} 섹션 ${isCollapsed ? '펼치기' : '접기'}`;
        return (
          <View key={group.brand.id} className="gap-2">
            <Pressable
              onPress={() => {
                toggleBrand(group.brand.id);
              }}
              accessibilityRole="button"
              accessibilityLabel={headerLabel}
              className="flex-row items-center justify-between"
              style={pressedOpacity}
            >
              <AppText accessibilityRole="header" className="text-heading-sm text-text-primary">
                {group.brand.name}
              </AppText>
              <MaterialIcons
                name={isCollapsed ? 'expand-more' : 'expand-less'}
                size={20}
                color={colors.text.secondary}
                accessibilityElementsHidden
                importantForAccessibility="no-hide-descendants"
              />
            </Pressable>
            {isCollapsed
              ? null
              : group.machines.map((machine) => (
                  <MachineRow
                    key={machine.id}
                    machine={machine}
                    onPress={() => {
                      onPressMachine(machine.id);
                    }}
                    onPressReport={() => {
                      setReportTargetId(machine.id);
                    }}
                  />
                ))}
          </View>
        );
      })}
      {reportTargetId !== null ? (
        <ReportReasonSheet
          target={{ type: 'gymMachine', gymMachineId: reportTargetId }}
          onClose={handleReportSheetClose}
        />
      ) : null}
    </View>
  );
}

interface MachineRowProps {
  machine: GymMachineWithDetails;
  onPress: () => void;
  onPressReport: () => void;
}

function MachineRow({ machine, onPress, onPressReport }: MachineRowProps) {
  const name = machineDisplayName(machine);
  const photoCount = machine.photos.length;
  const showQuantity = machine.quantity >= 2;
  const accessibilityLabel = buildRowAccessibilityLabel(name, machine.quantity, photoCount);

  const testID = `machine-row-${toTestSlug(name)}`;
  const reportTestID = `machine-row-${toTestSlug(name)}-report`;

  // Sibling Pressables (not nested) so the overflow tap doesn't also fire the
  // row's navigate handler. The body Pressable is `flex-1` to fill remaining width.
  return (
    <View className="flex-row items-center gap-2 rounded-md bg-bg-subtle">
      <Pressable
        onPress={onPress}
        testID={testID}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        className="flex-1 flex-row items-center justify-between px-3 py-2"
        style={pressedOpacity}
      >
        <View className="flex-row items-center gap-2">
          <AppText className="text-body text-text-primary">{name}</AppText>
          {showQuantity ? (
            <View className="rounded-full bg-bg-muted px-2">
              <AppText className="font-medium text-body-sm text-text-secondary">
                x{String(machine.quantity)}
              </AppText>
            </View>
          ) : null}
        </View>
        <View className="flex-row items-center gap-1">
          <MaterialIcons
            name="photo-camera"
            size={14}
            color={colors.text.tertiary}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants"
          />
          <AppText className="text-body-sm text-text-tertiary">사진 {String(photoCount)}</AppText>
        </View>
      </Pressable>
      <Pressable
        onPress={onPressReport}
        testID={reportTestID}
        accessibilityRole="button"
        accessibilityLabel={`${name} 신고`}
        className="py-2 pr-3 pl-1"
        style={pressedOpacity}
        hitSlop={8}
      >
        <MaterialIcons name="more-vert" size={20} color={colors.text.tertiary} />
      </Pressable>
    </View>
  );
}

function buildRowAccessibilityLabel(name: string, quantity: number, photoCount: number): string {
  const parts = [name];
  if (quantity >= 2) parts.push(`${String(quantity)}대`);
  parts.push(`사진 ${String(photoCount)}장`);
  return parts.join(', ');
}
