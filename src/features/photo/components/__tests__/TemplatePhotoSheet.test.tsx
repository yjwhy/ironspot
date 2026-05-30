import { fireEvent, render } from '@testing-library/react-native';
import * as WebBrowser from 'expo-web-browser';
import type * as ReactNS from 'react';
import { ActivityIndicator } from 'react-native';
import type * as RN from 'react-native';

import { useTemplatePhotos } from '@/shared/generated/machine-templates/machine-templates';

import { TemplatePhotoSheet } from '../TemplatePhotoSheet';

// gorhom passthroughs: ignore the ref so present() no-ops (mirrors the shared
// bottom-sheet test util used by GymBottomSheet).
jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { forwardRef } = require('react') as typeof ReactNS;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { View } = require('react-native') as typeof RN;
  const Pass = ({ children }: { children?: ReactNS.ReactNode }) => <View>{children}</View>;
  return {
    __esModule: true,
    BottomSheetModalProvider: Pass,
    BottomSheetModal: forwardRef(function Modal(
      { children }: { children?: ReactNS.ReactNode },
      _ref: unknown,
    ) {
      return <View>{children}</View>;
    }),
    BottomSheetScrollView: Pass,
    BottomSheetBackdrop: () => null,
  };
});

jest.mock('expo-web-browser', () => ({ openBrowserAsync: jest.fn() }));

jest.mock('burnt', () => ({ toast: jest.fn() }));

// AuthedImage pulls in supabase via useAuthedImageSource; stub it to a marker.
jest.mock('@/shared/components/AuthedImage', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Text } = require('react-native') as typeof RN;
  return {
    AuthedImage: ({ contentPath }: { contentPath?: string }) => (
      <Text testID={`authed-image-${contentPath ?? 'none'}`}>img</Text>
    ),
  };
});

jest.mock('@/shared/generated/machine-templates/machine-templates', () => ({
  useTemplatePhotos: jest.fn(),
}));

const mockUseTemplatePhotos = useTemplatePhotos as jest.Mock;
const mockOpenBrowser = WebBrowser.openBrowserAsync as jest.Mock;

function mockQuery(state: { isPending?: boolean; isError?: boolean; data?: unknown }) {
  mockUseTemplatePhotos.mockReturnValue({
    isPending: state.isPending ?? false,
    isError: state.isError ?? false,
    data: state.data === undefined ? undefined : { data: state.data },
  });
}

function renderSheet() {
  return render(
    <TemplatePhotoSheet templateId="tpl-1" templateLabel="랫 풀다운" onClose={jest.fn()} />,
  );
}

describe('TemplatePhotoSheet', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('shows a spinner while loading', () => {
    mockQuery({ isPending: true });
    const { UNSAFE_queryAllByType } = renderSheet();
    expect(UNSAFE_queryAllByType(ActivityIndicator).length).toBeGreaterThan(0);
  });

  it('shows the empty note when hasAny is false', () => {
    mockQuery({ data: { templateId: 'tpl-1', userPhotos: [], hasAny: false } });
    const { getByText } = renderSheet();
    expect(getByText('아직 등록된 사진이 없어요')).toBeTruthy();
  });

  it('shows an error note on query error', () => {
    mockQuery({ isError: true });
    const { getByText } = renderSheet();
    expect(getByText('사진을 불러올 수 없어요')).toBeTruthy();
  });

  it('renders the official image, user photos, and a manufacturer link', () => {
    mockQuery({
      data: {
        templateId: 'tpl-1',
        officialImageUrl: 'https://cdn.example/official.webp',
        officialUrl: 'https://brand.example/model',
        userPhotos: [
          { id: 'p1', contentPath: '/api/photos/p1/content' },
          { id: 'p2', contentPath: '/api/photos/p2/content' },
        ],
        hasAny: true,
      },
    });

    const { getByText, getByTestId } = renderSheet();

    expect(getByText('공식 이미지')).toBeTruthy();
    expect(getByTestId('authed-image-/api/photos/p1/content')).toBeTruthy();
    expect(getByTestId('authed-image-/api/photos/p2/content')).toBeTruthy();
    expect(getByText('제조사 사이트에서 보기')).toBeTruthy();
  });

  it('opens the manufacturer site in an external browser when the link is tapped', () => {
    mockQuery({
      data: {
        templateId: 'tpl-1',
        officialUrl: 'https://brand.example/model',
        userPhotos: [],
        hasAny: true,
      },
    });

    const { getByText } = renderSheet();
    fireEvent.press(getByText('제조사 사이트에서 보기'));

    expect(mockOpenBrowser).toHaveBeenCalledWith('https://brand.example/model');
  });
});
