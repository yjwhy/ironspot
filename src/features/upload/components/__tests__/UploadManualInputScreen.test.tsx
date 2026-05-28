import { act, fireEvent, render } from '@testing-library/react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { useSeries } from '@/features/map/hooks/useSeries';

import { UPLOAD_MACHINE_PHOTO_PATHNAME } from '../../constants';
import { UploadManualInputScreen } from '../UploadManualInputScreen';

jest.mock('@/features/map/hooks/useBrands', () => ({ useBrands: jest.fn() }));
jest.mock('@/features/map/hooks/useCategories', () => ({ useCategories: jest.fn() }));
jest.mock('@/features/map/hooks/useMachineTemplates', () => ({ useMachineTemplates: jest.fn() }));
jest.mock('@/features/map/hooks/useSeries', () => ({ useSeries: jest.fn() }));

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ gymId: 'gym-1' }),
  useRouter: () => ({ push: mockPush }),
}));

const mockUseBrands = useBrands as jest.Mock;
const mockUseCategories = useCategories as jest.Mock;
const mockUseMachineTemplates = useMachineTemplates as jest.Mock;
const mockUseSeries = useSeries as jest.Mock;

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
  const categories = [
    { id: 'cat-chest', name: '가슴' },
    { id: 'cat-back', name: '등' },
  ];
  mockUseBrands.mockReturnValue({ data: brands });
  mockUseCategories.mockReturnValue({ data: categories });
  mockUseSeries.mockReturnValue({ data: [] });
  mockUseMachineTemplates.mockImplementation((params?: { brandId?: string; seriesId?: string }) => {
    if (params?.seriesId !== undefined) {
      return { data: [] };
    }
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

  it('does not render a next button on the brand step (selection auto-advances)', () => {
    const { queryByTestId } = render(<UploadManualInputScreen />);
    expect(queryByTestId('upload-manual-next')).toBeNull();
  });

  it('tapping a catalog brand auto-advances to its template step', () => {
    const { getByTestId, queryByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));

    // Advanced to the template step without a separate "다음" tap.
    expect(getByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeTruthy();
    expect(queryByTestId('upload-manual-brand-option-brand-hammer')).toBeNull();
  });

  it('catalog brand + catalog template path pushes a template selection', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('upload-manual-template-option-tpl-hammer-chest'));

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

    expect(getByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeTruthy();
    expect(queryByTestId('upload-manual-template-option-tpl-other')).toBeNull();
  });

  it('shows the selected brand logo in the brand crumb on the template step', () => {
    const { getByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));

    // The crumb summarising the picked brand carries its logo, not just text.
    expect(getByTestId('upload-manual-crumb-brand')).toBeTruthy();
    expect(getByTestId('upload-manual-crumb-brand-logo')).toBeTruthy();
  });

  it('groups the brand templates under their body-part headers', () => {
    const { getByTestId, getByText } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));

    // The chest and back machines surface under their body-part (운동 부위) headers.
    expect(getByText('가슴')).toBeTruthy();
    expect(getByText('등')).toBeTruthy();
    expect(getByTestId('upload-manual-template-group-가슴')).toBeTruthy();
    expect(getByTestId('upload-manual-template-group-등')).toBeTruthy();
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

    // Proposed brand auto-advances to the name step.
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

    fireEvent.changeText(getByTestId('upload-manual-template-search'), 'Hip Thrust');
    fireEvent.press(getByTestId('upload-manual-template-propose-new'));

    // Proposed template auto-advances to the name step, pre-filled from the
    // template search query so the user doesn't retype.
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

    act(() => {
      fireEvent.press(getByTestId('upload-manual-crumb-brand'));
    });

    expect(getByTestId('upload-manual-brand-option-brand-hammer')).toBeTruthy();
    expect(queryByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeNull();
  });

  it('template crumb revert returns from the name step to the template step', () => {
    const { getByTestId, queryByTestId } = render(<UploadManualInputScreen />);

    fireEvent.press(getByTestId('upload-manual-brand-option-brand-hammer'));
    fireEvent.changeText(getByTestId('upload-manual-template-search'), 'Hip Thrust');
    fireEvent.press(getByTestId('upload-manual-template-propose-new'));

    // On the name step (proposed template auto-advanced here).
    expect(getByTestId('upload-manual-name-input')).toBeTruthy();

    act(() => {
      fireEvent.press(getByTestId('upload-manual-crumb-template'));
    });

    // Back on the template step with the template selection cleared.
    expect(getByTestId('upload-manual-template-option-tpl-hammer-chest')).toBeTruthy();
    expect(queryByTestId('upload-manual-name-input')).toBeNull();
  });
});
