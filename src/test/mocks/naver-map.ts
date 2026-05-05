import React from 'react';
import { View } from 'react-native';

export const NaverMapView = ({
  children,
}: {
  children?: React.ReactNode;
  [key: string]: unknown;
}) => React.createElement(View, { testID: 'naver-map-view' }, children);

export const NaverMapMarkerOverlay = () => null;
