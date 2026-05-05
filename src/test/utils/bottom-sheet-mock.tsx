import { forwardRef } from 'react';
import type { ComponentType, ReactElement, ReactNode } from 'react';
import { View } from 'react-native';

interface PassthroughProps {
  children?: ReactNode;
}

export function BottomSheetPassthrough({ children }: PassthroughProps) {
  return <View>{children}</View>;
}

export const BottomSheetModalPassthrough = forwardRef<
  { present: () => void; dismiss: () => void },
  PassthroughProps
>(function BottomSheetModalMock({ children }, _ref) {
  return <View>{children}</View>;
});

interface ListMockProps<T> {
  data: readonly T[];
  renderItem: (info: { item: T; index: number }) => ReactElement | null;
  keyExtractor?: (item: T, index: number) => string;
  ListEmptyComponent?: ReactElement | (() => ReactElement);
  ItemSeparatorComponent?: ComponentType<unknown>;
}

export function BottomSheetListMock<T>({
  data,
  renderItem,
  keyExtractor,
  ListEmptyComponent,
  ItemSeparatorComponent,
}: ListMockProps<T>) {
  if (data.length === 0 && ListEmptyComponent) {
    const empty =
      typeof ListEmptyComponent === 'function' ? ListEmptyComponent() : ListEmptyComponent;
    return <View>{empty}</View>;
  }
  return (
    <View>
      {data.map((item, index) => (
        <View key={keyExtractor ? keyExtractor(item, index) : String(index)}>
          {renderItem({ item, index })}
          {ItemSeparatorComponent && index < data.length - 1 ? <ItemSeparatorComponent /> : null}
        </View>
      ))}
    </View>
  );
}
