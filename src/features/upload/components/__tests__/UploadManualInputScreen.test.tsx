import { act, fireEvent, render } from '@testing-library/react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';

import { UPLOAD_MACHINE_PHOTO_PATHNAME } from '../../constants';
import { UploadManualInputScreen } from '../UploadManualInputScreen';

jest.mock('@/features/map/hooks/useBrands', () => ({ useBrands: jest.fn() }));
jest.mock('@/features/map/hooks/useMachineTemplates', () => ({ useMachineTemplates: jest.fn() }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ gymId: 'gym-1' }),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseBrands = useBrands as jest.Mock;
const mockUseMachineTemplates = useMachineTemplates as jest.Mock;

interface TemplateFixture {
  id: string;
  brandId: string;
  brandName: string;
  brandNameKo: string;
  categoryId: string;
  nameEn: string;
  nameKo: string;
  loadingType: string;
}

function setupQueries() {
  const brands = [
    { id: 'brand-hammer', name: 'Hammer Strength', nameKo: '해머 스트렝스' },
    { id: 'brand-life', name: 'Life Fitness', nameKo: '라이프 피트니스' },
  ];
  const templates: TemplateFixture[] = [
    {
      id: 'tpl-hammer-chest',
      brandId: 'brand-hammer',
      brandName: 'Hammer Strength',
      brandNameKo: '해머 스트렝스',
      categoryId: 'cat-chest',
      nameEn: 'Iso Chest Press',
      nameKo: '아이소 체스트 프레스',
      loadingType: 'plate',
    },
    {
      id: 'tpl-hammer-back',
      brandId: 'brand-hammer',
      brandName: 'Hammer Strength',
      brandNameKo: '해머 스트렝스',
      categoryId: 'cat-back',
      nameEn: 'Lat Pull Down',
      nameKo: '랫 풀다운',
      loadingType: 'plate',
    },
  ];
  mockUseBrands.mockReturnValue({ data: brands });
  mockUseMachineTemplates.mockImplementation((params?: { brandId?: string }) => {
    if (params?.brandId === undefined) return { data: undefined };
    return { data: templates.filter((t) => t.brandId === params.brandId) };
  });
}

describe('UploadManualInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it('renders brand options on first mount', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);
    expect(getByTestId('upload-manual-brand-option-brand-hammer')).toBeTruthy();
    expect(getByTestId('upload-manual-brand-option-brand-life')).toBeTruthy();
  });

  it('keeps the next button disabled until a brand is picked', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);
    expect(getByTestId('upload-manual-next')).toHaveProp('accessibilityState', {
      disabled: true,
      busy: false,
    });
  });

  it('catalog brand + catalog template path pushes a template selection', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('upload-manual-next'));

    fireEvent.press(getByTestId('upload-manual-template-option-tpl-hammer-chest'));
    fireEvent.press(getByTestId('upload-manual-next'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: UPLOAD_MACHINE_PHOTO_PATHNAME,
      params: {
        gymId: 'gym-1',
        naverPlace: undefined,
        selection: JSON.stringify({ kind: 'template', templateId: 'tpl-hammer-chest' }),
      },
    });
  });

  it('template step filters to the selected brand only', () => {
    const { getByTestId, queryByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('upload-manual-next'));

    expect(getByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeTruthy();
    expect(queryByTestId('upload-manual-template-option-tpl-other')).toBeNull();
  });

  it('shows a propose-new brand row when the query has no catalog match', () => {
    const { getByTestId, queryByTestId } = render(<UploadManualInputScreen />);

    fireEvent.changeText(getByTestId('upload-manual-brand-search'), 'Cybex');

    expect(queryByTestId('upload-manual-brand-option-brand-hammer')).toBeNull();
    expect(getByTestId('upload-manual-brand-propose-new')).toBeTruthy();
  });

  it('proposed brand → name step → submits a freeForm selection with brand prefix', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);

    fireEvent.changeText(getByTestId('upload-manual-brand-search'), 'Cybex');
    fireEvent.press(getByTestId('upload-manual-brand-propose-new'));
    fireEvent.press(getByTestId('upload-manual-next'));

    fireEvent.changeText(getByTestId('upload-manual-name-input'), 'Lat Pulldown');
    fireEvent.press(getByTestId('upload-manual-next'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: UPLOAD_MACHINE_PHOTO_PATHNAME,
      params: {
        gymId: 'gym-1',
        naverPlace: undefined,
        selection: JSON.stringify({ kind: 'freeForm', text: 'Cybex Lat Pulldown' }),
      },
    });
  });

  it('catalog brand + proposed template → freeForm with brand label + typed name', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('upload-manual-next'));

    fireEvent.changeText(getByTestId('upload-manual-template-search'), 'Hip Thrust');
    fireEvent.press(getByTestId('upload-manual-template-propose-new'));
    fireEvent.press(getByTestId('upload-manual-next'));

    // Pre-filled from the template search query so the user doesn't retype.
    expect(getByTestId('upload-manual-name-input')).toHaveProp('value', 'Hip Thrust');

    fireEvent.press(getByTestId('upload-manual-next'));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: UPLOAD_MACHINE_PHOTO_PATHNAME,
      params: {
        gymId: 'gym-1',
        naverPlace: undefined,
        selection: JSON.stringify({
          kind: 'freeForm',
          text: '해머 스트렝스 (Hammer Strength) Hip Thrust',
        }),
      },
    });
  });

  it('crumb revert returns the user to the brand step and clears template selection', () => {
    const { getByTestId, queryByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('upload-manual-next'));

    act(() => {
      fireEvent.press(getByTestId('upload-manual-crumb-brand'));
    });

    expect(getByTestId('upload-manual-brand-option-brand-hammer')).toBeTruthy();
    expect(queryByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeNull();
  });
});
