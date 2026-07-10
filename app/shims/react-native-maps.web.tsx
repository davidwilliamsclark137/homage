import { forwardRef, type ReactNode } from "react";
import { Text, View } from "react-native";

type MapShimProps = {
  children?: ReactNode;
  style?: object;
};

const MapView = forwardRef<View, MapShimProps>(({ children, style }, ref) => (
  <View ref={ref} style={[{ overflow: "hidden" }, style]}>
    {children}
  </View>
));

MapView.displayName = "MapView";

function MapChild({ children }: MapShimProps) {
  return <>{children}</>;
}

function Marker({ title }: { title?: string }) {
  return title ? <Text>{title}</Text> : null;
}

const PROVIDER_GOOGLE = "google";

export { MapChild as Circle, Marker, MapChild as Polygon, MapChild as Polyline };
export { PROVIDER_GOOGLE };
export default MapView;
