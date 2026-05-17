import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { ScrollView } from 'react-native-gesture-handler';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import type { AdminReportResponse } from '@/shared/generated/model';
import { formatRelativeKo } from '@/shared/lib/format';

import { useAdminGymMachineDetail } from '../hooks/useAdminGymMachineDetail';
import { useDisposeReport } from '../hooks/useDisposeReport';

const LOADING_TITLE = '불러오는 중…';
const ERROR_TITLE = '머신 정보를 불러오지 못했어요';
const NO_PENDING_TITLE = '대기 중인 신고가 없어요';
const HEADER_TITLE = '머신 신고 처리';

interface AdminGymMachineScreenProps {
  gymMachineId: string;
}

/**
 * ADR 0022 follow-up (Task 46) Slice 46h: gym_machine admin screen. Shows
 * current template + pending reports; admin chooses re-template (template
 * picker via Task 45's catalog) / delete / dismiss per report.
 */
export function AdminGymMachineScreen({ gymMachineId }: AdminGymMachineScreenProps) {
  const detail = useAdminGymMachineDetail(gymMachineId);

  if (detail.isError) {
    return (
      <ScreenShell>
        <EmptyState icon="error-outline" title={ERROR_TITLE} />
      </ScreenShell>
    );
  }
  if (detail.isLoading || detail.data === undefined) {
    return (
      <ScreenShell>
        <EmptyState icon="hourglass-empty" title={LOADING_TITLE} />
      </ScreenShell>
    );
  }

  const data = detail.data;
  const templateLabel =
    data.brandName && data.templateName && data.loadingType
      ? `${data.brandName} ${data.templateName} · ${data.loadingType === 'pin' ? '핀' : '플레이트'}`
      : '커스텀 머신';

  return (
    <ScreenShell>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <Section title="헬스장">
          <Text className="text-base text-text-primary">{data.gymName}</Text>
        </Section>
        <Section title="현재 머신 매핑">
          <Text className="text-base text-text-primary">{templateLabel}</Text>
          <Text className="text-sm text-text-secondary">수량 {data.quantity}대</Text>
        </Section>

        <Section title={`대기 중 신고 (${String(data.pendingReports.length)}건)`}>
          {data.pendingReports.length === 0 ? (
            <EmptyState icon="inbox" title={NO_PENDING_TITLE} />
          ) : (
            data.pendingReports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                gymMachineId={gymMachineId}
                onDisposed={() => {
                  void detail.refetch();
                }}
              />
            ))
          )}
        </Section>
      </ScrollView>
    </ScreenShell>
  );
}

function ScreenShell({ children }: { children: React.ReactNode }) {
  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="flex-row items-center border-b border-border px-4 py-3">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="뒤로"
          onPress={() => {
            router.back();
          }}
          className="mr-3"
        >
          <Text className="text-text-primary">‹</Text>
        </Pressable>
        <Text className="text-lg font-semibold text-text-primary">{HEADER_TITLE}</Text>
      </View>
      {children}
    </SafeAreaView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="gap-2">
      <Text className="text-sm font-semibold text-text-secondary">{title}</Text>
      <View className="rounded-lg border border-border bg-bg-elevated p-3">{children}</View>
    </View>
  );
}

interface ReportCardProps {
  report: AdminReportResponse;
  gymMachineId: string;
  onDisposed: () => void;
}

function ReportCard({ report, gymMachineId, onDisposed }: ReportCardProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const dispose = useDisposeReport(
    report.id ?? '',
    { type: 'gymMachine', gymMachineId },
    { onSuccess: onDisposed },
  );

  function handleDelete() {
    dispose.handleDispose({ disposition: 'actioned', gymMachineAction: 'delete' });
  }

  function handleReTemplate(newTemplateId: string) {
    dispose.handleDispose({
      disposition: 'actioned',
      gymMachineAction: 'reTemplate',
      newTemplateId,
    });
    setPickerOpen(false);
  }

  function handleDismiss() {
    dispose.handleDispose({ disposition: 'dismissed' });
  }

  return (
    <View className="rounded-md border border-border-subtle bg-bg-base p-3">
      <Text className="text-sm font-medium text-text-primary">{report.reason ?? ''}</Text>
      {report.detail ? (
        <Text className="mt-1 text-xs text-text-secondary">{report.detail}</Text>
      ) : null}
      {report.createdAt ? (
        <Text className="mt-1 text-xs text-text-tertiary">
          {formatRelativeKo(report.createdAt)}
        </Text>
      ) : null}
      <View className="mt-3 gap-2">
        <Button
          label="다른 머신으로 교체"
          variant="primary"
          onPress={() => {
            setPickerOpen(true);
          }}
          disabled={dispose.isPending}
        />
        <Button
          label="이 머신 삭제"
          variant="secondary"
          onPress={handleDelete}
          disabled={dispose.isPending}
        />
        <Button
          label="신고 기각"
          variant="secondary"
          onPress={handleDismiss}
          disabled={dispose.isPending}
        />
      </View>
      {pickerOpen ? (
        <TemplatePicker
          onPick={handleReTemplate}
          onClose={() => {
            setPickerOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

interface TemplatePickerProps {
  onPick: (templateId: string) => void;
  onClose: () => void;
}

function TemplatePicker({ onPick, onClose }: TemplatePickerProps) {
  const templates = useMachineTemplates();
  const data = templates.data ?? [];

  return (
    <View className="mt-3 rounded-md border border-accent bg-accent-50 p-2">
      <View className="mb-2 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-text-primary">새 머신 선택</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="머신 선택 닫기" onPress={onClose}>
          <Text className="text-text-secondary">×</Text>
        </Pressable>
      </View>
      <ScrollView style={{ maxHeight: 240 }}>
        {data.map((template) => (
          <Pressable
            key={template.id}
            accessibilityRole="button"
            accessibilityLabel={`${template.brandName} ${template.name} 선택`}
            onPress={() => {
              onPick(template.id);
            }}
            className="border-b border-border-subtle px-2 py-2 active:bg-bg-elevated"
          >
            <Text className="text-sm text-text-primary">
              {template.brandName} {template.name} ·{' '}
              {template.loadingType === 'pin' ? '핀' : '플레이트'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
