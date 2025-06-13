import React, { useEffect, useState, useRef } from "react";
import {
  ScrollView,
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  TouchableHighlight,
  TouchableOpacity,
  Alert,
  Dimensions,
  Linking,
} from "react-native";
import MapView, {
  Polyline,
  Marker,
  PROVIDER_DEFAULT,
  UrlTile,
} from "react-native-maps";
import { useLocalSearchParams } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import * as Location from "expo-location";
import { MaterialIcons, FontAwesome } from "@expo/vector-icons";
import Modal from "react-native-modal";
import { router } from "expo-router";

const { width, height } = Dimensions.get("window");

// Decode polyline function
const decodePolyline = (encoded) => {
  let index = 0,
    len = encoded.length;
  let lat = 0,
    lng = 0;
  const coordinates = [];

  while (index < len) {
    let b,
      shift = 0,
      result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      b = encoded.charCodeAt(index++) - 63;
      result |= (b & 0x1f) << shift;
      shift += 5;
    } while (b >= 0x20);
    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    coordinates.push({
      latitude: lat / 1e5,
      longitude: lng / 1e5,
    });
  }
  return coordinates;
};

const MapScreen = () => {
  const { id, route, overview_polyline } = useLocalSearchParams();
  const [decodedLegs, setDecodedLegs] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [userLocation, setUserLocation] = useState(null);
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalContent, setModalContent] = useState(null);
  const [selectedLegs, setSelectedLegs] = useState([]);
  const [amount, setAmount] = useState(0);
  const mapRef = useRef(null);

  const modeColors = {
    WALK: "#77DD77",
    RAIL: "#779ECB",
    BUS: "#FFB347",
    SUBWAY: "#D3A4FF",
  };

  const handleLegSelection = (leg) => {
    if (leg.mode === "WALK") return;

    setSelectedLegs((prev) => {
      const isSelected = prev.some(
        (selectedLeg) =>
          selectedLeg.startTime === leg.startTime &&
          selectedLeg.endTime === leg.endTime
      );

      setAmount(modalContent?.totalCost || 0);

      if (isSelected) {
        return prev.filter(
          (selectedLeg) =>
            selectedLeg.startTime !== leg.startTime ||
            selectedLeg.endTime !== leg.endTime
        );
      } else {
        return [...prev, leg];
      }
    });
  };

  const isLegSelected = (leg) => {
    if (leg.mode === "WALK") return false;
    return selectedLegs.some(
      (selectedLeg) =>
        selectedLeg.startTime === leg.startTime &&
        selectedLeg.endTime === leg.endTime
    );
  };

  const renderLegIcon = (mode) => {
    switch (mode) {
      case "WALK":
        return <FontAwesome name="male" size={24} color={modeColors["WALK"]} />;
      case "RAIL":
        return <MaterialIcons name="train" size={24} color={modeColors["RAIL"]} />;
      case "BUS":
        return <FontAwesome name="bus" size={24} color={modeColors["BUS"]} />;
      case "SUBWAY":
        return <FontAwesome name="subway" size={24} color={modeColors["SUBWAY"]} />;
      default:
        return <FontAwesome name="question" size={24} color="red" />;
    }
  };

  const openGoogleMaps = (fromLat, fromLon, toLat, toLon) => {
    const url = `https://www.google.com/maps/dir/?api=1&origin=${fromLat},${fromLon}&destination=${toLat},${toLon}`;
    Linking.openURL(url).catch((err) => console.error("Error opening Google Maps:", err));
  };

  // Debounce route updates
  const [debouncedRoute, setDebouncedRoute] = useState(route);
  useEffect(() => {
    let handler;
    if (route) {
      console.log("Route data:", {
        type: typeof route,
        value: route,
        length: route.length
      });
      handler = setTimeout(() => setDebouncedRoute(route), 300);
    } else if (overview_polyline) {
      console.log("Using overview_polyline instead of route");
      setDebouncedRoute(overview_polyline);
    }
    
    return () => clearTimeout(handler);
  }, [route]);

  // Request user location
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        console.error("Permission to access location was denied");
        return;
      }
      const location = await Location.getCurrentPositionAsync({});
      setUserLocation(location.coords);
    })();
  }, []);

  // Update decoded legs on screen focus
  useFocusEffect(
    React.useCallback(() => {
      if (debouncedRoute && !overview_polyline) {
        try {
          const parsedRoute = JSON.parse(debouncedRoute);
          setModalContent(parsedRoute);
          if (parsedRoute.legs) {
            const legsWithColors = parsedRoute.legs.map((leg) => {
              const coordinates = decodePolyline(leg.legGeometry.points);
              return {
                coordinates,
                color: modeColors[leg.mode] || "#000000",
                mode: leg.mode,
              };
            });
            setDecodedLegs(legsWithColors);
          }
        } catch (error) {
          console.error("Error parsing route:", error);
        } finally {
          setIsLoading(false);
        }
      } else if (debouncedRoute && overview_polyline) {
        const coordinates = decodePolyline(debouncedRoute);
        setDecodedLegs([{ coordinates, color: "#000000" }]);
        setIsLoading(false);
      } else {
        setIsLoading(false);
      }
    }, [debouncedRoute])
  );

  // Animate map region
  useEffect(() => {
    if (decodedLegs.length > 0 && mapRef.current) {
      const allCoordinates = decodedLegs.flatMap((leg) => leg.coordinates);
      const latitudes = allCoordinates.map((point) => point.latitude);
      const longitudes = allCoordinates.map((point) => point.longitude);

      const minLat = Math.min(...latitudes);
      const maxLat = Math.max(...latitudes);
      const minLng = Math.min(...longitudes);
      const maxLng = Math.max(...longitudes);

      mapRef.current.animateToRegion({
        latitude: (minLat + maxLat) / 2,
        longitude: (minLng + maxLng) / 2,
        latitudeDelta: maxLat - minLat + 0.01,
        longitudeDelta: maxLng - minLng + 0.01,
      });
    }
  }, [decodedLegs]);

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#0000ff" />
        <Text>Loading map data...</Text>
      </View>
    );
  }

  if (!debouncedRoute) {
    return (
      <View style={styles.errorContainer}>
        <Text>No route data available. Please go back and try again.</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <MapView
        ref={mapRef}
        style={styles.map}
        provider={PROVIDER_DEFAULT}
        initialRegion={
          decodedLegs.length > 0
            ? {
                latitude: decodedLegs[0].coordinates[0].latitude,
                longitude: decodedLegs[0].coordinates[0].longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
              }
            : {
                latitude: 19.29462,
                longitude: 72.85618,
                latitudeDelta: 0.1,
                longitudeDelta: 0.1,
              }
        }
        showsUserLocation={true}
        zoomEnabled={true}
        scrollEnabled={true}
      >
        <UrlTile
          urlTemplate="https://a.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maximumZ={19}
        />

        {decodedLegs.map((leg, index) => (
          <React.Fragment key={index}>
            <Polyline
              coordinates={leg.coordinates}
              strokeColor={leg.color}
              strokeWidth={4}
            />
            <Marker
              coordinate={leg.coordinates[0]}
              pinColor={index === 0 ? "green" : "black"}
            />
            <Marker
              coordinate={leg.coordinates[leg.coordinates.length - 1]}
              pinColor={index === decodedLegs.length - 1 ? "red" : "black"}
            />
          </React.Fragment>
        ))}
      </MapView>

      <View style={styles.legendContainer}>
        {Object.entries(modeColors).map(([mode, color]) => (
          <View key={mode} style={styles.legendItem}>
            <View style={[styles.legendColor, { backgroundColor: color }]} />
            <Text style={styles.legendText}>{mode}</Text>
          </View>
        ))}
      </View>

      <TouchableHighlight
        underlayColor="rgba(6, 95, 70, 1)"
        style={styles.floatingButton}
        onPress={() => setIsModalVisible(true)}
      >
        <MaterialIcons name="directions" size={20} color="white" />
      </TouchableHighlight>

      <Modal
        isVisible={isModalVisible}
        onBackdropPress={() => setIsModalVisible(false)}
        onBackButtonPress={() => setIsModalVisible(false)}
        style={styles.modal}
      >
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Journey Details</Text>
            <TouchableOpacity onPress={() => setIsModalVisible(false)}>
              <MaterialIcons name="close" size={24} color="#334155" />
            </TouchableOpacity>
          </View>
          
          {modalContent ? (
            <View style={styles.modalInnerContainer}>
              <View style={styles.routeSummary}>
                <View style={styles.summaryItem}>
                  <MaterialIcons name="access-time" size={18} color="#065f46" />
                  <Text style={styles.summaryText}>
                    {Math.round(modalContent.duration / 60)} min
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <MaterialIcons name="straighten" size={18} color="#065f46" />
                  <Text style={styles.summaryText}>
                    {(() => {
                      const totalDistance = modalContent.legs.reduce((sum, leg) => sum + leg.distance, 0);
                      return totalDistance > 1000
                        ? `${Math.round(totalDistance / 1000)} km`
                        : `${Math.round(totalDistance)} m`;
                    })()}
                  </Text>
                </View>
                <View style={styles.summaryItem}>
                  <MaterialIcons name="payments" size={18} color="#065f46" />
                  <Text style={styles.summaryText}>
                    ₹{modalContent.totalCost?.toFixed(2) || "0.00"}
                  </Text>
                </View>
              </View>
              
              <ScrollView style={styles.legsContainer}>
                {modalContent.legs.map((leg, index) => (
                  <TouchableOpacity
                    key={index}
                    style={[
                      styles.leg,
                      isLegSelected(leg) && styles.selectedLeg,
                      leg.mode === "WALK" && styles.walkingLeg,
                    ]}
                    onPress={() => handleLegSelection(leg)}
                    disabled={leg.mode === "WALK"}
                  >
                    <View style={styles.iconContainer}>
                      {renderLegIcon(leg.mode)}
                      {index !== modalContent.legs.length - 1 && (
                        <View style={styles.verticalLine} />
                      )}
                    </View>
                    <View style={styles.legDetails}>
                      <Text
                        style={[
                          styles.legDescription,
                          leg.mode === "WALK" && styles.walkingLegText,
                        ]}
                      >
                        {leg.mode === "WALK"
                          ? "Walk"
                          : leg.mode === "BUS"
                          ? `Bus ${leg.routeShortName} · ${leg.route}`
                          : `${leg.route}`}{" "}
                        ·{" "}
                        {leg.distance > 1000
                          ? `${Math.round(leg.distance / 1000)} km`
                          : `${Math.round(leg.distance)} m`}
                      </Text>
                      <Text style={styles.legSubInfo}>
                        {leg.from.name} → {leg.to.name}
                      </Text>
                      <Text style={styles.legSubInfo}>
                        {new Date(leg.startTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})} -{" "}
                        {new Date(leg.endTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                      </Text>
                      <TouchableOpacity
                        style={styles.directionsButton}
                        onPress={() => openGoogleMaps(leg.from.lat, leg.from.lon, leg.to.lat, leg.to.lon)}
                      >
                        <Text style={styles.directionsButtonText}>Get Directions</Text>
                      </TouchableOpacity>
                    </View>
                    <View style={styles.checkboxContainer}>
                      {leg.mode !== "WALK" ? (
                        <View
                          style={[
                            styles.checkbox,
                            isLegSelected(leg) && styles.checkboxSelected,
                          ]}
                        >
                          {isLegSelected(leg) && (
                            <MaterialIcons
                              name="check"
                              size={16}
                              color="white"
                            />
                          )}
                        </View>
                      ) : (
                        <View style={styles.checkboxDisabled}>
                          <MaterialIcons
                            name="block"
                            size={16}
                            color="#94a3b8"
                          />
                        </View>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
              <View style={styles.buttonContainer}>
                <TouchableHighlight
                  underlayColor="rgba(6, 95, 70, 0.98)"
                  style={[
                    styles.bookNowButton,
                    selectedLegs.length === 0 && styles.bookNowButtonDisabled,
                  ]}
                  disabled={selectedLegs.length === 0}
                  onPress={() => {
                    setIsModalVisible(false);
                    router.push({
                      pathname: "/(tabs)/travel/booking",
                      params: {
                        selectedLegs: JSON.stringify(selectedLegs),
                        amount: amount,
                      },
                    });
                  }}
                >
                  <Text style={styles.bookNowButtonText}>
                    {selectedLegs.length === 0
                      ? "Select Transport Modes to Book"
                      : `Book Now for ₹${amount.toFixed(2)}`}
                  </Text>
                </TouchableHighlight>
              </View>
            </View>
          ) : (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color="#065f46" />
              <Text style={styles.loadingText}>Loading route details...</Text>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  map: {
    width: width,
    height: height,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  loadingText: {
    marginTop: 10,
    color: "#334155",
    fontSize: 16,
  },
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  floatingButton: {
    backgroundColor: "rgba(6, 95, 70, 0.9)",
    width: 50,
    height: 50,
    borderRadius: 25,
    position: "absolute",
    bottom: 20,
    right: 20,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
  },
  modal: {
    margin: 0,
    justifyContent: "flex-end",
  },
  modalContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingBottom: 20,
    maxHeight: "95%",
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#334155",
  },
  modalInnerContainer: {
    paddingHorizontal: 16,
  },
  routeSummary: {
    flexDirection: "row",
    justifyContent: "space-around",
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  summaryItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  summaryText: {
    marginLeft: 6,
    fontSize: 16,
    fontWeight: "500",
    color: "#334155",
  },
  legsContainer: {
    maxHeight: 500,
  },
  leg: {
    flexDirection: "row",
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    alignItems: "center",
  },
  selectedLeg: {
    backgroundColor: "#f0fdf4",
  },
  walkingLeg: {
    opacity: 0.7,
  },
  walkingLegText: {
    fontStyle: "italic",
  },
  iconContainer: {
    marginRight: 12,
    alignItems: 'center',
    width: 30,
  },
  verticalLine: {
    height: 30,
    width: 2,
    backgroundColor: '#cbd5e0',
    marginVertical: 5,
    alignSelf: 'center',
  },
  legDetails: {
    flex: 1,
    paddingLeft: 4,
  },
  legDescription: {
    fontSize: 16,
    fontWeight: "500",
    color: "#334155",
    marginBottom: 4,
  },
  legSubInfo: {
    fontSize: 14,
    color: "#64748b",
    marginBottom: 2,
    lineHeight: 20,
  },
  checkboxContainer: {
    marginLeft: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "#94a3b8",
    backgroundColor: "transparent",
    justifyContent: "center",
    alignItems: "center",
  },
  checkboxSelected: {
    backgroundColor: "#065f46",
    borderColor: "#065f46",
  },
  checkboxDisabled: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonContainer: {
    alignItems: "center",
    paddingVertical: 16,
  },
  bookNowButton: {
    backgroundColor: "rgba(6, 95, 70, 1)",
    paddingVertical: 12,
    paddingHorizontal: 25,
    borderRadius: 8,
    width: "90%",
  },
  bookNowButtonDisabled: {
    backgroundColor: "#94a3b8",
  },
  bookNowButtonText: {
    color: "white",
    fontSize: 16,
    fontWeight: "600",
    textAlign: "center",
  },
  legendContainer: {
    position: 'absolute',
    bottom: 20,
    left: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    padding: 12,
    borderRadius: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  legendColor: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: '#334155',
  },
  directionsButton: {
    marginTop: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#065f46',
    alignSelf: 'flex-start',
  },
  directionsButtonText: {
    color: '#065f46',
    fontSize: 14,
    fontWeight: '500',
  },
});

export default MapScreen;