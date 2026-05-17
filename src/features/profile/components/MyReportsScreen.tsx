import { useQueryClient } from '@tanstack/react-query';
import * as burnt from 'burnt';
import { ActivityIndicator, FlatList, Pressable, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/shared/components/AppText';
import { EmptyState } from '@/shared/components/EmptyState';
import type { MyReportResponse } from '@/shared/generated/model';
import { getListMineQueryKey, useEscalate, useListMine } from '@/shared/generated/reports/reports';
import { pressedOpacity } from '@/shared/lib/pressable';
import { captureError } from '@/shared/lib/sentry';

const LIST_LIMIT = 100;

type ReportStatus = 'pending' | 'actioned' | 'dismissed';

const STATUS_LABEL: Record<ReportStatus, string> = {
  pending: '검토 중',
  actioned: '처리됨',
  dismissed: '기각됨',
};

const STATUS_TONE: Record<ReportStatus, string> = {
  pending: 'text-amber-600',
  actioned: 'text-accent',
  dismissed: 'text-text-tertiary',
};

function asStatus(s: string): ReportStatus {
  if (s === 'actioned' || s === 'dismissed' || s === 'pending') return s;
  return 'pending';
}

export function MyReportsScreen() {
  const listQuery = useListMine({ limit: LIST_LIMIT });
  const escalateMutation = useEscalate();
  const queryClient = useQueryClient();

  async function handleEscalate(reportId: string) {
    try {
      await escalateMutation.mutateAsync({ id: reportId });
      burnt.toast({ title: '이의제기를 접수했어요', preset: 'done' });
      await queryClient.invalidateQueries({ queryKey: getListMineQueryKey({ limit: LIST_LIMIT }) });
    } catch (err) {
      captureError(err);
      burnt.toast({ title: '이의제기에 실패했어요', preset: 'error' });
    }
  }

  if (listQuery.isLoading) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center">
        <ActivityIndicator size="large" />
      </SafeAreaView>
    );
  }

  if (listQuery.isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base items-center justify-center px-6">
        <EmptyState icon="error-outline" title="신고 내역을 불러올 수 없어요" />
      </SafeAreaView>
    );
  }

  const items = listQuery.data?.data ?? [];

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <View className="px-6 py-4">
        <AppText className="text-headline font-bold text-text-primary">내가 한 신고들</AppText>
        <AppText className="text-body-sm text-text-secondary">{items.length}건</AppText>
      </View>

      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <MyReportRow
            report={item}
            isEscalating={escalateMutation.isPending}
            onEscalate={(id) => {
              void handleEscalate(id);
            }}
          />
        )}
        ListEmptyComponent={
          <View className="px-6 py-12">
            <EmptyState icon="flag" title="신고한 내역이 없어요" />
          </View>
        }
        contentContainerClassName="px-6 pb-12 gap-3"
      />
    </SafeAreaView>
  );
}

interface MyReportRowProps {
  report: MyReportResponse;
  isEscalating: boolean;
  onEscalate: (id: string) => void;
}

function MyReportRow({ report, isEscalating, onEscalate }: MyReportRowProps) {
  const status = asStatus(report.status);
  const canEscalate = (status === 'actioned' || status === 'dismissed') && !report.escalated;

  return (
    <View testID={`my-report-${report.id}`} className="rounded-lg bg-bg-elevated p-4 gap-2">
      <View className="flex-row items-center justify-between">
        <AppText className="text-body-sm text-text-tertiary">
          {report.targetType === 'photo' ? '사진 신고' : '머신 신고'} · {report.reason}
        </AppText>
        <AppText className={`text-caption font-medium ${STATUS_TONE[status]}`}>
          {STATUS_LABEL[status]}
        </AppText>
      </View>
      {typeof report.detail === 'string' && report.detail.length > 0 ? (
        <AppText className="text-body-sm text-text-secondary" numberOfLines={2}>
          {report.detail}
        </AppText>
      ) : null}
      {report.escalated ? (
        <AppText className="text-caption text-text-tertiary">
          이의제기됨 · admin 재검토 대기
        </AppText>
      ) : null}
      {canEscalate ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="이의제기"
          onPress={() => {
            onEscalate(report.id);
          }}
          disabled={isEscalating}
          style={pressedOpacity}
          testID={`my-report-${report.id}-escalate`}
          className="self-start rounded-md border border-accent px-3 py-1.5"
        >
          <AppText className="text-body-sm font-medium text-accent">이의제기</AppText>
        </Pressable>
      ) : null}
    </View>
  );
}
