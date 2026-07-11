import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { toast } from 'burnt';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { useCallback, useEffect, useRef } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { AppText } from '@/shared/components/AppText';
import { AuthedImage } from '@/shared/components/AuthedImage';
import { Button } from '@/shared/components/Button';
import { useTemplatePhotos } from '@/shared/generated/machine-templates/machine-templates';
import type { TemplatePhotosResponse } from '@/shared/generated/model';
import { colors } from '@/shared/theme/tokens';

interface TemplatePhotoSheetProps {
  templateId: string;
  /** Model name shown as the sheet title (e.g. "랫 풀다운"). */
  templateLabel: string;
  /**
   * Free-text used to build the "웹에서 이미지 검색" link (e.g.
   * "Hammer Strength Lat Pull Down"). Brand + English model name gives the
   * cleanest gym-equipment image results.
   */
  searchQuery: string;
  onClose: () => void;
}

// Tall enough for a stacked image or two without the user having to drag up.
const SNAP_POINTS = ['85%'];
const BACKGROUND_STYLE = { backgroundColor: colors.bg.elevated };
const PRESENT_DELAY_MS = 50;
const IMAGE_ASPECT_RATIO = 4 / 3;
const PHOTO_BORDER_RADIUS = 12;
const PHOTO_STYLE = {
  width: '100%',
  aspectRatio: IMAGE_ASPECT_RATIO,
  borderRadius: PHOTO_BORDER_RADIUS,
} as const;

// Google Images search for the model. Zero per-model curation: we already
// know the brand + model name, so we build the query on the fly. A search
// link (not a hosted image) keeps this licence-clean and always available,
// even for models with no curated image and no user photo yet.
const IMAGE_SEARCH_BASE_URL = 'https://www.google.com/search?tbm=isch&q=';

function buildImageSearchUrl(query: string): string {
  return IMAGE_SEARCH_BASE_URL + encodeURIComponent(query);
}

async function openExternalUrl(url: string): Promise<void> {
  try {
    await WebBrowser.openBrowserAsync(url);
  } catch {
    toast({ title: '링크를 열 수 없어요', preset: 'error' });
  }
}

/**
 * On-demand reference photos for a machine model. Mounted only while open (the
 * caller conditionally renders it), so the query fires lazily on open. Shows a
 * curated official image first, then the top user photos, with a manufacturer
 * link as a last-resort fallback. Self-wraps BottomSheetModalProvider so it
 * works regardless of where it is mounted (mirrors ReportReasonSheet).
 *
 * Ownership: the photo feature owns this catalog-template reference view.
 * Other features (upload now, gym/machine detail later) import it from here —
 * keep the dependency direction one-way into features/photo.
 */
export function TemplatePhotoSheet(props: TemplatePhotoSheetProps) {
  return (
    <BottomSheetModalProvider>
      <TemplatePhotoSheetInner {...props} />
    </BottomSheetModalProvider>
  );
}

function TemplatePhotoSheetInner({
  templateId,
  templateLabel,
  searchQuery,
  onClose,
}: TemplatePhotoSheetProps) {
  const ref = useRef<React.ComponentRef<typeof BottomSheetModal>>(null);
  const query = useTemplatePhotos(templateId, undefined, {
    query: { staleTime: Number.POSITIVE_INFINITY },
  });

  useEffect(function presentOnMount() {
    const id = setTimeout(() => {
      ref.current?.present();
    }, PRESENT_DELAY_MS);
    return () => {
      clearTimeout(id);
    };
  }, []);

  const renderBackdrop = useCallback(
    (backdropProps: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop {...backdropProps} appearsOnIndex={0} disappearsOnIndex={-1} />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={ref}
      snapPoints={SNAP_POINTS}
      backgroundStyle={BACKGROUND_STYLE}
      backdropComponent={renderBackdrop}
      onDismiss={onClose}
    >
      <BottomSheetScrollView contentContainerClassName="gap-3 px-5 pb-8">
        <AppText className="text-heading-md text-text-primary">{templateLabel}</AppText>
        <TemplatePhotoBody
          isPending={query.isPending}
          isError={query.isError}
          data={query.data?.data}
        />
        {/* Always available, even with no curated image and no user photo:
            the universal "what does this look like?" fallback. */}
        <Button
          label="웹에서 이미지 검색"
          variant="secondary"
          onPress={function handleSearchWeb() {
            void openExternalUrl(buildImageSearchUrl(searchQuery));
          }}
        />
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
}

interface TemplatePhotoBodyProps {
  isPending: boolean;
  isError: boolean;
  data: TemplatePhotosResponse | undefined;
}

function TemplatePhotoBody({ isPending, isError, data }: TemplatePhotoBodyProps) {
  if (isPending) {
    return (
      <View className="items-center py-10">
        <ActivityIndicator color={colors.text.tertiary} />
      </View>
    );
  }
  if (isError || data === undefined) {
    return <EmptyNote text="사진을 불러올 수 없어요" />;
  }
  if (!data.hasAny) {
    return <EmptyNote text="아직 등록된 사진이 없어요" />;
  }
  // Destructure to consts so TS narrows officialUrl to string inside the guard
  // (avoids a non-null assertion, which the project bans).
  const { officialImageUrl, officialUrl, userPhotos } = data;
  return (
    <View className="gap-3">
      {officialImageUrl !== undefined ? (
        <View className="gap-1">
          <Image source={{ uri: officialImageUrl }} style={PHOTO_STYLE} contentFit="contain" />
          <AppText className="text-caption text-text-tertiary">공식 이미지</AppText>
        </View>
      ) : null}

      {userPhotos.map((photo) => (
        <AuthedImage
          key={photo.id}
          contentPath={photo.contentPath}
          style={PHOTO_STYLE}
          contentFit="cover"
        />
      ))}

      {officialUrl !== undefined ? (
        <Button
          label="제조사 사이트에서 보기"
          variant="secondary"
          onPress={function handleOpenManufacturer() {
            void openExternalUrl(officialUrl);
          }}
        />
      ) : null}
    </View>
  );
}

function EmptyNote({ text }: { text: string }) {
  return (
    <View className="items-center py-10">
      <AppText className="text-body-sm text-text-secondary">{text}</AppText>
    </View>
  );
}
