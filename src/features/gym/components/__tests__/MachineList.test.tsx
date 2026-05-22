import { fireEvent, render } from '@testing-library/react-native';

import {
  makeBrand,
  makeCategory,
  makeGymMachineWithDetails,
  makeMachinePhoto,
  makeMachineTemplate,
} from '@/test/utils/factories/gym-machine';

import { MachineList } from '../MachineList';

// ADR 0022 follow-up (Task 46): MachineList renders ReportReasonSheet which
// transitively pulls in `burnt` (ESM, not parsed by Jest). Mock as a no-op.
jest.mock('@/features/photo/components/ReportReasonSheet', () => ({
  ReportReasonSheet: () => null,
}));

const panatta = makeBrand({ id: 'b-pan', name: 'Panatta', nameKo: '파나타' });
const hammer = makeBrand({ id: 'b-ham', name: 'Hammer Strength', nameKo: '해머 스트렝스' });
const back = makeCategory({ id: 'c-back', name: 'Back' });

const panattaHighRow = makeGymMachineWithDetails({
  machine: { id: 'gm-1', quantity: 1 },
  brand: panatta,
  category: back,
  template: makeMachineTemplate({ id: 't-1', name_en: 'High Row', name_ko: 'High Row' }),
  photos: [makeMachinePhoto({ id: 'p-1' }), makeMachinePhoto({ id: 'p-2' })],
});

const panattaLowRow = makeGymMachineWithDetails({
  machine: { id: 'gm-2', quantity: 3 },
  brand: panatta,
  category: back,
  template: makeMachineTemplate({ id: 't-2', name_en: 'Low Row', name_ko: 'Low Row' }),
  photos: [],
});

const hammerLatPullDown = makeGymMachineWithDetails({
  machine: { id: 'gm-3', quantity: 1 },
  brand: hammer,
  category: back,
  template: makeMachineTemplate({ id: 't-3', name_en: 'Lat Pull Down', name_ko: 'Lat Pull Down' }),
  photos: [makeMachinePhoto({ id: 'p-3' })],
});

const all = [panattaHighRow, panattaLowRow, hammerLatPullDown];

describe('MachineList', () => {
  it('renders one header per brand with the bilingual "한글 (영문)" label', () => {
    const { getAllByRole, getByRole } = render(
      <MachineList machines={all} onPressMachine={() => undefined} />,
    );
    expect(getAllByRole('header')).toHaveLength(2);
    expect(getByRole('header', { name: '파나타 (Panatta)' })).toBeTruthy();
    expect(getByRole('header', { name: '해머 스트렝스 (Hammer Strength)' })).toBeTruthy();
  });

  it('renders each machine display name as a button', () => {
    const { getByRole } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByRole('button', { name: /^High Row,/ })).toBeTruthy();
    expect(getByRole('button', { name: /^Low Row,/ })).toBeTruthy();
    expect(getByRole('button', { name: /^Lat Pull Down,/ })).toBeTruthy();
  });

  it('shows a quantity badge when quantity >= 2', () => {
    const { getByText } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByText('x3')).toBeTruthy();
  });

  it('omits the quantity badge when quantity === 1', () => {
    const { queryByText } = render(
      <MachineList machines={[panattaHighRow]} onPressMachine={() => undefined} />,
    );
    expect(queryByText(/^x\d/)).toBeNull();
  });

  it('renders the photo count for each machine row', () => {
    const { getByText } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    expect(getByText('사진 2')).toBeTruthy();
    expect(getByText('사진 0')).toBeTruthy();
  });

  it('calls onPressMachine with the gym_machine id when a row is tapped', () => {
    const onPressMachine = jest.fn();
    const { getByRole } = render(<MachineList machines={all} onPressMachine={onPressMachine} />);
    fireEvent.press(getByRole('button', { name: /^Low Row,/ }));
    expect(onPressMachine).toHaveBeenCalledWith('gm-2');
  });

  it('collapses a brand section when its header is tapped, hiding the rows', () => {
    const { getByRole, queryByRole } = render(
      <MachineList machines={all} onPressMachine={() => undefined} />,
    );
    fireEvent.press(getByRole('button', { name: '파나타 (Panatta) 섹션 접기' }));
    expect(queryByRole('button', { name: /^High Row,/ })).toBeNull();
    expect(queryByRole('button', { name: /^Low Row,/ })).toBeNull();
    expect(queryByRole('button', { name: /^Lat Pull Down,/ })).toBeTruthy();
  });

  it('expands a previously-collapsed brand section when its header is tapped again', () => {
    const { getByRole } = render(<MachineList machines={all} onPressMachine={() => undefined} />);
    fireEvent.press(getByRole('button', { name: '파나타 (Panatta) 섹션 접기' }));
    fireEvent.press(getByRole('button', { name: '파나타 (Panatta) 섹션 펼치기' }));
    expect(getByRole('button', { name: /^High Row,/ })).toBeTruthy();
  });
});
