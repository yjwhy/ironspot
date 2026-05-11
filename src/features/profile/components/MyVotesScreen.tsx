import { MyPhotoListView } from './MyPhotoListView';
import { useMyVotes } from '../hooks/useMyVotes';

export function MyVotesScreen() {
  const { data, isPending, isError, isFetching, refetch } = useMyVotes();

  function handleRefresh() {
    void refetch();
  }

  return (
    <MyPhotoListView
      testID="my-votes-screen"
      title="내가 추천한 사진"
      emptyTitle="아직 추천한 사진이 없어요"
      emptyDescription="마음에 드는 사진에 추천을 눌러보세요!"
      photos={data}
      isPending={isPending}
      isError={isError}
      isFetching={isFetching}
      onRefresh={handleRefresh}
    />
  );
}
