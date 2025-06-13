import React from "react";
import { View, Image, StyleSheet } from "react-native";
import MapView, { Marker } from "react-native-maps";

const CustomMap = () => {
  return (
    <MapView
      style={{ flex: 1 }}
      initialRegion={{
        latitude: 37.78825,
        longitude: -122.4324,
        latitudeDelta: 0.0922,
        longitudeDelta: 0.0421,
      }}
    >
      <Marker coordinate={{ latitude: 37.78825, longitude: -122.4324 }}>
        <View style={styles.markerContainer}>
          <Image
            source={require("../../../assets/images/metro.png")}
            style={styles.markerImage}
          />
        </View>
      </Marker>
    </MapView>
  );
};

const styles = StyleSheet.create({
  markerContainer: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "white",
    padding: 5,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: "black",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5, // For Android shadow
  },
  markerImage: {
    width: 30,
    height: 30,
    borderRadius: 15, // To make it circular
  },
});

export default CustomMap;
