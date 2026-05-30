import { fireEvent, render } from '@testing-library/react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';
import { useSeries } from '@/features/map/hooks/useSeries';

import { MachinePicker, type MachinePickerSelection } from '../MachinePicker';

jest.mock('@/features/map/hooks/useBrands', () => ({ useBrands: jest.fn() }));
jest.mock('@/features/map/hooks/useCategories', () => ({ useCategories: jest.fn() }));
jest.mock('@/features/map/hooks/useMachineTemplates', () => ({ useMachineTemplates: jest.fn() }));
jest.mock('@/features/map/hooks/useSeries', () => ({ useSeries: jest.fn() }));

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
  seriesId?: string | null;
}

interface SetupOverrides {
  brands?: { id: string; name: string; nameKo: string }[];
  categories?: { id: string; name: string }[];
  templates?: TemplateFixture[];
  series?: { id: string; brandId: string; name: string; nameKo: string }[];
}

function setupQueries(overrides: SetupOverrides = {}) {
  const brands = overrides.brands ?? [
    { id: 'brand-hammer', name: 'Hammer Strength', nameKo: '해머 스트렝스' },
    { id: 'brand-life', name: 'Life Fitness', nameKo: '라이프 피트니스' },
    { id: 'brand-panatta', name: 'Panatta', nameKo: '파나타' },
  ];
  const categories = overrides.categories ?? [
    { id: 'cat-chest', name: '가슴' },
    { id: 'cat-back', name: '등' },
    { id: 'cat-legs', name: '다리' },
  ];
  const templates: TemplateFixture[] = overrides.templates ?? [
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
    {
      id: 'tpl-panatta-chest',
      brandId: 'brand-panatta',
      brandName: 'Panatta',
      brandNameKo: '파나타',
      categoryId: 'cat-chest',
      nameEn: 'Chest Press',
      nameKo: '체스트 프레스',
      loadingType: 'plate',
    },
  ];
  const series = overrides.series ?? [];
  mockUseBrands.mockReturnValue({ data: brands, isLoading: false, isError: false });
  mockUseCategories.mockReturnValue({ data: categories, isLoading: false, isError: false });
  mockUseSeries.mockReturnValue({ data: series, isLoading: false, isError: false });
  // Phase 5 item 18 pushdown: the hook only fetches once both brandId and
  // categoryId are passed, and the server filters the catalog. Mock that
  // behaviour so the test still asserts "only matching templates render".
  mockUseMachineTemplates.mockImplementation(
    (params?: { brandId?: string; categoryId?: string }) => {
      if (!params?.brandId || !params.categoryId) {
        return { data: undefined, isLoading: false, isError: false };
      }
      const filtered = templates.filter(
        (t) => t.brandId === params.brandId && t.categoryId === params.categoryId,
      );
      return { data: filtered, isLoading: false, isError: false };
    },
  );
}

const NONE: MachinePickerSelection = { kind: 'none' };

describe('MachinePicker', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setupQueries();
  });

  it('renders brand step + escape hatch on mount, hides category and template steps', () => {
    const { getByTestId, queryByTestId } = render(
      <MachinePicker value={NONE} onChange={jest.fn()} />,
    );

    expect(getByTestId('machine-picker-brand-option-brand-hammer')).toBeTruthy();
    expect(getByTestId('machine-picker-brand-option-brand-life')).toBeTruthy();
    expect(getByTestId('machine-picker-brand-option-brand-panatta')).toBeTruthy();
    expect(getByTestId('machine-picker-escape-link')).toBeTruthy();

    expect(queryByTestId('machine-picker-category-chip-cat-chest')).toBeNull();
    expect(queryByTestId('machine-picker-template-search')).toBeNull();
  });

  it('selecting a brand reveals the category step', () => {
    const { getByTestId, queryByTestId } = render(
      <MachinePicker value={NONE} onChange={jest.fn()} />,
    );

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));

    expect(getByTestId('machine-picker-category-chip-cat-chest')).toBeTruthy();
    expect(getByTestId('machine-picker-category-chip-cat-back')).toBeTruthy();
    expect(queryByTestId('machine-picker-template-search')).toBeNull();
  });

  it('selecting a category reveals the template step filtered by brand + category', () => {
    const { getByTestId, queryByTestId } = render(
      <MachinePicker value={NONE} onChange={jest.fn()} />,
    );

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));

    expect(getByTestId('machine-picker-template-option-tpl-hammer-chest')).toBeTruthy();
    // Same brand but different category → hidden
    expect(queryByTestId('machine-picker-template-option-tpl-hammer-back')).toBeNull();
    // Different brand → hidden even when category matches
    expect(queryByTestId('machine-picker-template-option-tpl-panatta-chest')).toBeNull();
  });

  it('typing in the template search narrows the filtered template list', () => {
    setupQueries({
      templates: [
        {
          id: 'tpl-iso',
          brandId: 'brand-hammer',
          brandName: 'Hammer Strength',
          brandNameKo: '해머 스트렝스',
          categoryId: 'cat-chest',
          nameEn: 'Iso Chest Press',
          nameKo: '아이소 체스트 프레스',
          loadingType: 'plate',
        },
        {
          id: 'tpl-incline',
          brandId: 'brand-hammer',
          brandName: 'Hammer Strength',
          brandNameKo: '해머 스트렝스',
          categoryId: 'cat-chest',
          nameEn: 'Incline Press',
          nameKo: '인클라인 프레스',
          loadingType: 'plate',
        },
      ],
    });

    const { getByTestId, queryByTestId } = render(
      <MachinePicker value={NONE} onChange={jest.fn()} />,
    );

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));
    fireEvent.changeText(getByTestId('machine-picker-template-search'), 'iso');

    expect(getByTestId('machine-picker-template-option-tpl-iso')).toBeTruthy();
    expect(queryByTestId('machine-picker-template-option-tpl-incline')).toBeNull();
  });

  it('selecting a template emits onChange with kind=template', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<MachinePicker value={NONE} onChange={onChange} />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));
    fireEvent.press(getByTestId('machine-picker-template-option-tpl-hammer-chest'));

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'template', templateId: 'tpl-hammer-chest' });
  });

  it('tapping the escape hatch link reveals the free-form input and clears any prior pick', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId } = render(
      <MachinePicker
        value={{ kind: 'template', templateId: 'tpl-hammer-chest' }}
        onChange={onChange}
      />,
    );

    expect(queryByTestId('machine-picker-freeform-input')).toBeNull();

    fireEvent.press(getByTestId('machine-picker-escape-link'));

    expect(getByTestId('machine-picker-freeform-input')).toBeTruthy();
    // First emit when escape opens clears any prior closed-list pick.
    expect(onChange).toHaveBeenCalledWith({ kind: 'freeForm', text: '' });
  });

  it('typing in the free-form input emits onChange with kind=freeForm', () => {
    const onChange = jest.fn();
    const { getByTestId } = render(<MachinePicker value={NONE} onChange={onChange} />);

    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), 'Hammer Strength MTS Row');

    expect(onChange).toHaveBeenLastCalledWith({
      kind: 'freeForm',
      text: 'Hammer Strength MTS Row',
    });
  });

  it('tags template rows with their series so same-named models stay distinct', () => {
    setupQueries({
      series: [
        { id: 'series-iso', brandId: 'brand-hammer', name: 'Iso-Lateral', nameKo: 'Iso-Lateral' },
        { id: 'series-select', brandId: 'brand-hammer', name: 'Select', nameKo: 'Select' },
      ],
      templates: [
        {
          id: 'tpl-iso-chest',
          brandId: 'brand-hammer',
          brandName: 'Hammer Strength',
          brandNameKo: '해머 스트렝스',
          categoryId: 'cat-chest',
          nameEn: 'Chest Press',
          nameKo: '체스트 프레스',
          loadingType: 'plate',
          seriesId: 'series-iso',
        },
        {
          id: 'tpl-select-chest',
          brandId: 'brand-hammer',
          brandName: 'Hammer Strength',
          brandNameKo: '해머 스트렝스',
          categoryId: 'cat-chest',
          nameEn: 'Chest Press',
          nameKo: '체스트 프레스',
          loadingType: 'pin',
          seriesId: 'series-select',
        },
      ],
    });

    const { getByText, getByTestId } = render(<MachinePicker value={NONE} onChange={jest.fn()} />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));

    // Both rows share the model name "체스트 프레스" but the series tag keeps
    // them distinguishable.
    expect(getByText(/\[Iso-Lateral\] 체스트 프레스/)).toBeTruthy();
    expect(getByText(/\[Select\] 체스트 프레스/)).toBeTruthy();
  });

  it('escape hatch link stays visible even when the template list is empty', () => {
    setupQueries({ templates: [] });

    const { getByTestId } = render(<MachinePicker value={NONE} onChange={jest.fn()} />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));

    expect(getByTestId('machine-picker-escape-link')).toBeTruthy();
  });

  it('escape hatch link stays visible when there are no brands either (persistent secondary link)', () => {
    setupQueries({ brands: [] });

    const { getByTestId } = render(<MachinePicker value={NONE} onChange={jest.fn()} />);

    expect(getByTestId('machine-picker-escape-link')).toBeTruthy();
  });

  it('tapping a brand while the escape hatch is open closes the hatch and clears freeform text', () => {
    const onChange = jest.fn();
    const { getByTestId, queryByTestId, rerender } = render(
      <MachinePicker value={NONE} onChange={onChange} />,
    );

    fireEvent.press(getByTestId('machine-picker-escape-link'));
    fireEvent.changeText(getByTestId('machine-picker-freeform-input'), 'WIP name');
    rerender(<MachinePicker value={{ kind: 'freeForm', text: 'WIP name' }} onChange={onChange} />);
    onChange.mockClear();

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));

    expect(queryByTestId('machine-picker-freeform-input')).toBeNull();
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'none' });
  });

  it('changing brand after picking a template clears the prior selection (kind=none)', () => {
    const onChange = jest.fn();
    const { getByTestId, rerender } = render(<MachinePicker value={NONE} onChange={onChange} />);

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-hammer'));
    fireEvent.press(getByTestId('machine-picker-category-chip-cat-chest'));
    fireEvent.press(getByTestId('machine-picker-template-option-tpl-hammer-chest'));

    // Parent commits the template pick and re-renders with the new value
    rerender(
      <MachinePicker
        value={{ kind: 'template', templateId: 'tpl-hammer-chest' }}
        onChange={onChange}
      />,
    );
    onChange.mockClear();

    fireEvent.press(getByTestId('machine-picker-brand-option-brand-panatta'));

    expect(onChange).toHaveBeenLastCalledWith({ kind: 'none' });
  });
});
