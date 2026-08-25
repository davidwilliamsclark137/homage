import { haversine, type LatLng } from "../../../lib/geo";
import { NINE_BUILDINGS } from "../simulations/catalog";

export const PORTAL_RADIUS_METERS = 85;
export const DOWNTOWN_PORTALS = [
  { latitude: 33.19835, longitude: -96.61615 },
  { latitude: 33.19835, longitude: -96.61540 },
  { latitude: 33.19835, longitude: -96.61465 },
  { latitude: 33.19765, longitude: -96.61615 },
  { latitude: 33.19765, longitude: -96.61540 },
  { latitude: 33.19765, longitude: -96.61465 },
  { latitude: 33.19695, longitude: -96.61615 },
  { latitude: 33.19695, longitude: -96.61540 },
  { latitude: 33.19695, longitude: -96.61465 },
].map((point,index)=>({...point,index,name:NINE_BUILDINGS[index]}));

export function nearestPortal(position:LatLng){
  return DOWNTOWN_PORTALS.map(portal=>({...portal,distance:haversine(position,portal)})).sort((a,b)=>a.distance-b.distance)[0];
}
