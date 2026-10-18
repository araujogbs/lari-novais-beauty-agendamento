import React, { useEffect, useRef } from 'react';
import { Animated, StyleProp, View, ViewStyle } from 'react-native';
import { THEME } from '../theme';

// Bloco placeholder com opacidade pulsante
export function SkeletonBlock({ height = 64, style }: { height?: number; style?: StyleProp<ViewStyle> }) {
  const opacity = useRef(new Animated.Value(0.4)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return <Animated.View style={[{ height, borderRadius: 12, backgroundColor: THEME.roseLight, opacity }, style]} />;
}

export function SkeletonList({ height = 64 }: { height?: number }) {
  return (
    <View style={{ paddingHorizontal: 16, gap: 12, marginVertical: 14 }}>
      {[0, 1, 2].map((i) => (
        <SkeletonBlock key={i} height={height} />
      ))}
    </View>
  );
}
