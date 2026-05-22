import { Image } from 'expo-image';
import { router } from 'expo-router';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/shared/components/Button';
import { EmptyState } from '@/shared/components/EmptyState';
import { formatRelativeKo } from '@/shared/lib/format';

import { ADMIN_LOADING_TITLE } from './strings';
import { useAdminPhotoDetail } from '../hooks/useAdminPhotoDetail';
import { useBanUserAction } from '../hooks/useBanUser';
import { useDisposeReport } from '../hooks/useDisposeReport';
import { useRestorePhotoAction } from '../hooks/useRestorePhoto';

const ERROR_TITLE = '사진 정보를 불러오지 못했어요';
const BLINDED_BADGE = '블라인드됨';
const BANNED_BADGE = '차단됨';
const RESTORE_LABEL = '사진 복구';
const BAN_LABEL = '업로더 차단';
const ACTION_LABEL = '처리';
const DISMISS_LABEL = '반려';
const NO_PENDING = '처리 대기 신고 없음';

interface Props {
  photoId: string;
}

export function AdminPhotoScreen({ photoId }: Props) {
  const { data, isLoading, isError } = useAdminPhotoDetail(photoId);

  if (isError) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <EmptyState icon="error-outline" title={ERROR_TITLE} />
      </SafeAreaView>
    );
  }
  if (isLoading || data === undefined) {
    return (
      <SafeAreaView className="flex-1 bg-bg-base">
        <EmptyState icon="hourglass-empty" title={ADMIN_LOADING_TITLE} />
      </SafeAreaView>
    );
  }

  return <Detail photoId={photoId} detail={data} />;
}

interface DetailProps {
  photoId: string;
  detail: {
    photo: {
      id?: string;
      photoUrl?: string;
      isBlinded?: boolean;
      createdAt?: string;
    };
    uploader: {
      id?: string;
      nickname?: string;
      bannedAt?: string;
    };
    pendingReports: PendingReport[];
  };
}

interface PendingReport {
  id?: string;
  userId?: string;
  reason?: string;
  detail?: string;
  createdAt?: string;
}

function Detail({ photoId, detail }: DetailProps) {
  const { photo, uploader, pendingReports } = detail;
  const uploaderId = uploader.id ?? '';
  const isBlinded = photo.isBlinded === true;
  const isUploaderBanned = uploader.bannedAt != null;

  const restore = useRestorePhotoAction(photoId);
  const ban = useBanUserAction(uploaderId, photoId);

  // Lifted from ReportRow: parent owns "last pending report disposed → leave the
  // screen" so the row component doesn't need to know its index in the list.
  const isOnlyPending = pendingReports.length === 1;
  function handleDisposed() {
    if (isOnlyPending) router.back();
  }

  return (
    <SafeAreaView className="flex-1 bg-bg-base">
      <ScrollView contentContainerStyle={{ padding: 16, gap: 16 }}>
        <View>
          <Image
            source={{ uri: photo.photoUrl ?? '' }}
            style={{ width: '100%', aspectRatio: 1, borderRadius: 12 }}
            cachePolicy="memory-disk"
          />
          {isBlinded ? <Badge testID="admin-photo-blinded-badge" label={BLINDED_BADGE} /> : null}
        </View>

        <View className="rounded-lg bg-bg-elevated p-3">
          <Text className="text-sm text-text-secondary">업로더</Text>
          <View className="mt-1 flex-row items-center gap-2">
            <Text className="text-base font-medium text-text-primary">
              {uploader.nickname ?? '(알 수 없음)'}
            </Text>
            {isUploaderBanned ? (
              <Badge testID="admin-uploader-banned-badge" label={BANNED_BADGE} />
            ) : null}
          </View>
          {photo.createdAt ? (
            <Text className="mt-1 text-xs text-text-secondary">
              업로드: {formatRelativeKo(photo.createdAt)}
            </Text>
          ) : null}
        </View>

        <View className="gap-2">
          <Text className="text-sm font-semibold text-text-primary">
            신고 ({pendingReports.length}건)
          </Text>
          {pendingReports.length === 0 ? (
            <Text className="text-text-secondary">{NO_PENDING}</Text>
          ) : (
            pendingReports.map((report) => (
              <ReportRow
                key={report.id ?? `pending-${String(pendingReports.indexOf(report))}`}
                report={report}
                photoId={photoId}
                onDisposed={handleDisposed}
              />
            ))
          )}
        </View>

        <View className="gap-2">
          {isBlinded ? (
            <Button
              label={RESTORE_LABEL}
              variant="secondary"
              onPress={restore.handleRestore}
              disabled={restore.isPending}
            />
          ) : null}
          {!isUploaderBanned && uploaderId.length > 0 ? (
            <Button
              label={BAN_LABEL}
              variant="primary"
              onPress={ban.confirmAndBan}
              disabled={ban.isPending}
            />
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function ReportRow({
  report,
  photoId,
  onDisposed,
}: {
  report: PendingReport;
  photoId: string;
  onDisposed: () => void;
}) {
  const reportId = report.id ?? '';
  const dispose = useDisposeReport(
    reportId,
    { type: 'photo', photoId },
    {
      onSuccess: onDisposed,
    },
  );

  return (
    <View className="rounded-lg border border-border p-3">
      <Text className="text-sm text-text-primary">{report.reason ?? ''}</Text>
      {report.detail ? (
        <Text className="mt-1 text-xs text-text-secondary">{report.detail}</Text>
      ) : null}
      {report.createdAt ? (
        <Text className="mt-1 text-xs text-text-secondary">
          {formatRelativeKo(report.createdAt)}
        </Text>
      ) : null}
      <View className="mt-2 flex-row gap-2">
        <Button
          label={ACTION_LABEL}
          variant="primary"
          onPress={() => {
            dispose.handleDispose({ disposition: 'actioned' });
          }}
          disabled={dispose.isPending}
        />
        <Button
          label={DISMISS_LABEL}
          variant="secondary"
          onPress={() => {
            dispose.handleDispose({ disposition: 'dismissed' });
          }}
          disabled={dispose.isPending}
        />
      </View>
    </View>
  );
}

function Badge({ label, testID }: { label: string; testID?: string }) {
  return (
    <View testID={testID} className="rounded-full bg-error px-2 py-0.5">
      <Text className="text-xs font-medium text-text-inverse">{label}</Text>
    </View>
  );
}
