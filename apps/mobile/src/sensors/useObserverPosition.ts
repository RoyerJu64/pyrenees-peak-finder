import { useEffect, useState } from 'react';
import * as Location from 'expo-location';
import type { ObserverPosition } from '@ppf/shared-types';

export type PositionState =
  | { readonly status: 'pending' }
  | { readonly status: 'denied' }
  | { readonly status: 'unavailable'; readonly reason: string }
  | { readonly status: 'ready'; readonly position: ObserverPosition };

/**
 * Position de l'observateur, altitude comprise.
 *
 * L'altitude est la donnee critique et la plus fragile : le GPS la donne a
 * plusieurs dizaines de metres pres, et une erreur de 50 m sur l'observateur
 * decale l'angle d'elevation d'un sommet a 5 km de plus d'un demi-degre.
 * `BestForNavigation` est demande pour cette raison, malgre son cout en
 * batterie.
 */
export function useObserverPosition(): PositionState {
  const [state, setState] = useState<PositionState>({ status: 'pending' });

  useEffect(() => {
    let subscription: Location.LocationSubscription | undefined;
    let cancelled = false;

    void (async () => {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (cancelled) {
        return;
      }
      if (!permission.granted) {
        setState({ status: 'denied' });
        return;
      }

      try {
        subscription = await Location.watchPositionAsync(
          {
            accuracy: Location.Accuracy.BestForNavigation,
            distanceInterval: 10,
            timeInterval: 2000,
          },
          (location) => {
            if (cancelled) {
              return;
            }
            setState({
              status: 'ready',
              position: {
                latitude: location.coords.latitude,
                longitude: location.coords.longitude,
                // Une altitude absente vaut zero : a defaut, tous les sommets
                // paraitraient plus hauts qu'ils ne sont, ce qui reste moins
                // trompeur qu'un ecran vide.
                altitude: location.coords.altitude ?? 0,
                ...(location.coords.accuracy != null
                  ? { horizontalAccuracy: location.coords.accuracy }
                  : {}),
                ...(location.coords.altitudeAccuracy != null
                  ? { verticalAccuracy: location.coords.altitudeAccuracy }
                  : {}),
              },
            });
          },
        );
      } catch (error) {
        if (!cancelled) {
          setState({
            status: 'unavailable',
            reason: error instanceof Error ? error.message : String(error),
          });
        }
      }
    })();

    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, []);

  return state;
}
