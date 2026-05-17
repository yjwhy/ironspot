import { fireEvent, render } from '@testing-library/react-native';

import type { Gym, GymMachineWithDetails } from '@/shared/types/database';
import { makeGymMachineWithDetails } from '@/test/utils/factories/gym-machine';

import { useGymMachines } from '../../hooks/useGymMachines';
import { GymDetail } from '../GymDetail';

// ADR 0022 follow-up (Task 46): MachineList renders ReportReasonSheet which
// transitively imports `burnt` (ESM, not parsed by Jest).
jest.mock('@/features/photo/components/ReportReasonSheet', () => ({
  ReportReasonSheet: () => null,
}));

jest.mock('../../hooks/useGymMachines', () => ({
  useGymMachines: jest.fn(),
}));

const mockUseGymMachines = useGymMachines as jest.MockedFunction<typeof useGymMachines>;

const baseGym: Gym = {
  id: 'g-1',
  name: 'Fitness Factory',
  address: '서울 강남구 역삼동 123-4',
  latitude: 37.5,
  longitude: 127.03,
  phone: '02-1234-5678',
  operating_hours: '06:00-23:00',
  day_pass_price: null,
  is_verified: true,
  last_verified_at: '2026-03-15T10:00:00Z',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

interface MockResultOpts {
  data?: GymMachineWithDetails[];
  isPending?: boolean;
  isError?: boolean;
}

function setMockResult({ data, isPending = false, isError = false }: MockResultOpts) {
  mockUseGymMachines.mockReturnValue({
    data,
    isPending,
    isError,
    error: isError ? new Error('failed') : null,
    refetch: jest.fn(),
  } as unknown as ReturnType<typeof useGymMachines>);
}

describe('GymDetail', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    setMockResult({ data: [] });
  });

  it('renders the gym name as a header', () => {
    const { getByRole } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByRole('header', { name: 'Fitness Factory' })).toBeTruthy();
  });

  it('renders the gym address', () => {
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('서울 강남구 역삼동 123-4')).toBeTruthy();
  });

  it('renders the phone number when present', () => {
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('02-1234-5678')).toBeTruthy();
  });

  it('omits the phone row when phone is null', () => {
    const { queryByText } = render(
      <GymDetail gym={{ ...baseGym, phone: null }} onPressMachine={() => undefined} />,
    );
    expect(queryByText('02-1234-5678')).toBeNull();
  });

  it('renders operating hours when present', () => {
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('06:00-23:00')).toBeTruthy();
  });

  it('omits operating hours when null', () => {
    const { queryByText } = render(
      <GymDetail gym={{ ...baseGym, operating_hours: null }} onPressMachine={() => undefined} />,
    );
    expect(queryByText('06:00-23:00')).toBeNull();
  });

  it('renders the last verified chip when present', () => {
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('확인일 2026.03.15')).toBeTruthy();
  });

  it('omits the verified chip when last_verified_at is null', () => {
    const { queryByText } = render(
      <GymDetail gym={{ ...baseGym, last_verified_at: null }} onPressMachine={() => undefined} />,
    );
    expect(queryByText(/^확인일/)).toBeNull();
  });

  it('shows skeleton placeholders while machines are pending', () => {
    setMockResult({ isPending: true });
    const { getAllByLabelText } = render(
      <GymDetail gym={baseGym} onPressMachine={() => undefined} />,
    );
    expect(getAllByLabelText('로딩 중').length).toBeGreaterThan(0);
  });

  it('shows an empty state when there are zero machines', () => {
    setMockResult({ data: [] });
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('등록된 기구가 없어요')).toBeTruthy();
  });

  it('shows an error message when the fetch fails', () => {
    setMockResult({ isError: true });
    const { getByText } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByText('기구 정보를 불러오지 못했어요')).toBeTruthy();
  });

  it('renders MachineList rows when machines are returned', () => {
    setMockResult({
      data: [
        makeGymMachineWithDetails({
          machine: { id: 'gm-1' },
          template: { name: 'High Row' },
        }),
      ],
    });
    const { getByRole } = render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(getByRole('button', { name: /^High Row,/ })).toBeTruthy();
  });

  it('forwards onPressMachine when a machine row is tapped', () => {
    const onPressMachine = jest.fn();
    setMockResult({
      data: [
        makeGymMachineWithDetails({
          machine: { id: 'gm-1' },
          template: { name: 'High Row' },
        }),
      ],
    });
    const { getByRole } = render(<GymDetail gym={baseGym} onPressMachine={onPressMachine} />);
    fireEvent.press(getByRole('button', { name: /^High Row,/ }));
    expect(onPressMachine).toHaveBeenCalledWith('gm-1');
  });

  it('queries the hook with the gym id from the prop', () => {
    render(<GymDetail gym={baseGym} onPressMachine={() => undefined} />);
    expect(mockUseGymMachines).toHaveBeenCalledWith('g-1');
  });
});
