import { fireEvent, render } from '@testing-library/react-native';

import { useBrands } from '@/features/map/hooks/useBrands';
import { useCategories } from '@/features/map/hooks/useCategories';
import { useMachineTemplates } from '@/features/map/hooks/useMachineTemplates';

import { MachinePicker, type MachinePickerSelection } from '../MachinePicker';

jest.mock('@/features/map/hooks/useBrands', () => ({ useBrands: jest.fn() }));
jest.mock('@/features/map/hooks/useCategories', () => ({ useCategories: jest.fn() }));
jest.mock('@/features/map/hooks/useMachineTemplates', () => ({ useMachineTemplates: jest.fn() }));

const mockUseBrands = useBrands as jest.Mock;
const mockUseCategories = useCategories as jest.Mock;
const mockUseMachineTemplates = useMachineTemplates as jest.Mock;

interface SetupOverrides {
  brands?: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
  templates?: {
    id: string;
    brandId: string;
    brandName: string;
    categoryId: string;
    name: string;
    loadingType: string;
  }[];
}

function setupQueries(overrides: SetupOverrides = {}) {
  const brands = overrides.brands ?? [
    { id: 'brand-hammer', name: 'Hammer Strength' },
    { id: 'brand-life', name: 'Life Fitness' },
    { id: 'brand-panatta', name: 'Panatta' },
  ];
  const categories = overrides.categories ?? [
    { id: 'cat-chest', name: '가슴' },
    { id: 'cat-back', name: '등' },
    { id: 'cat-legs', name: '다리' },
  ];
  const templates = overrides.templates ?? [
    {
      id: 'tpl-hammer-chest',
      brandId: 'brand-hammer',
      brandName: 'Hammer Strength',
      categoryId: 'cat-chest',
      name: 'Iso Chest Press',
      loadingType: 'plate',
    },
    {
      id: 'tpl-hammer-back',
      brandId: 'brand-hammer',
      brandName: 'Hammer Strength',
      categoryId: 'cat-back',
      name: 'Lat Pull Down',
      loadingType: 'plate',
    },
    {
      id: 'tpl-panatta-chest',
      brandId: 'brand-panatta',
      brandName: 'Panatta',
      categoryId: 'cat-chest',
      name: 'Chest Press',
      loadingType: 'plate',
    },
  ];
  mockUseBrands.mockReturnValue({ data: brands, isLoading: false, isError: false });
  mockUseCategories.mockReturnValue({ data: categories, isLoading: false, isError: false });
  mockUseMachineTemplates.mockReturnValue({ data: templates, isLoading: false, isError: false });
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
          categoryId: 'cat-chest',
          name: 'Iso Chest Press',
          loadingType: 'plate',
        },
        {
          id: 'tpl-incline',
          brandId: 'brand-hammer',
          brandName: 'Hammer Strength',
          categoryId: 'cat-chest',
          name: 'Incline Press',
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
