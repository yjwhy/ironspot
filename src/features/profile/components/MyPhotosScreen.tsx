import { MyPhotoListView } from './MyPhotoListView';
import { useMyPhotos } from '../hooks/useMyPhotos';

export function MyPhotosScreen() {
  const { data, isPending, isError, isFetching, refetch } = useMyPhotos();

  function handleRefresh() {
    void refetch();
  }

  return (
    <MyPhotoListView
      testID="my-photos-screen"
      title="내가 올린 사진"
      emptyTitle="아직 올린 사진이 없어요"
      emptyDescription="기구 사진을 올려보세요!"
      photos={data}
      isPending={isPending}
      isError={isError}
      isFetching={isFetching}
      onRefresh={handleRefresh}
    />
  );
}
