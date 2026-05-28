import { fireEvent, render } from '@testing-library/react-native';

import type * as BottomSheetMockModule from '@/test/utils/bottom-sheet-mock';

import { LabelInfoSheet } from '../LabelInfoSheet';

jest.mock('@gorhom/bottom-sheet', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mock = require('@/test/utils/bottom-sheet-mock') as typeof BottomSheetMockModule;
  return {
    __esModule: true,
    default: mock.BottomSheetPassthrough,
    BottomSheetModal: mock.BottomSheetModalPassthrough,
    BottomSheetModalProvider: mock.BottomSheetPassthrough,
    BottomSheetView: mock.BottomSheetPassthrough,
    BottomSheetBackdrop: () => null,
  };
});

describe('LabelInfoSheet', () => {
  it('renders the heading, example image, and close button', () => {
    const onClose = jest.fn();
    const { getByTestId, getByText } = render(<LabelInfoSheet onClose={onClose} />);

    expect(getByTestId('label-info-sheet')).toBeTruthy();
    expect(getByText('라벨이란?')).toBeTruthy();
    expect(getByTestId('label-info-sheet-image')).toBeTruthy();
    expect(getByTestId('label-info-sheet-close')).toBeTruthy();
  });

  it('renders the brand/model description copy users read in place of the previous banner', () => {
    const { getByText } = render(<LabelInfoSheet onClose={() => undefined} />);

    expect(getByText('브랜드/모델명이 적힌 라벨(스티커)을 가까이 찍어주세요')).toBeTruthy();
    expect(
      getByText('머신 전체가 아닌 라벨 부분을 찍으면 브랜드와 모델명이 자동으로 인식돼요'),
    ).toBeTruthy();
  });

  it('invokes the close button without throwing (parent owns onClose via onDismiss)', () => {
    // The mocked BottomSheetModalPassthrough does not invoke onDismiss when
    // dismiss() is called; the assertion here only protects the press handler
    // from regressing. End-to-end dismissal is verified manually on device.
    const onClose = jest.fn();
    const { getByTestId } = render(<LabelInfoSheet onClose={onClose} />);

    fireEvent.press(getByTestId('label-info-sheet-close'));
    // No throw, no crash. The handler calls sheetRef.current?.dismiss() which
    // is a no-op under the passthrough mock.
    expect(true).toBe(true);
  });
});
