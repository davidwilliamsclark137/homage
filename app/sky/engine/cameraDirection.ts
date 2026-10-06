type Vector = { x: number; y: number; z: number };
const cross = (a: Vector, b: Vector): Vector => ({ x: a.y*b.z-a.z*b.y, y: a.z*b.x-a.x*b.z, z: a.x*b.y-a.y*b.x });
function unit(v: Vector): Vector | null {
  const length = Math.hypot(v.x,v.y,v.z);
  return Number.isFinite(length) && length > 0.0001 ? {x:v.x/length,y:v.y/length,z:v.z/length} : null;
}
// Inputs use device axes (+x right, +y top, +z out of screen).
// Gravity points down. The rear camera looks along -z, not the top edge +y.
export function cameraDirection(gravity: Vector, magnetic: Vector, declination: number) {
  const up = unit({x:-gravity.x,y:-gravity.y,z:-gravity.z});
  const field = unit(magnetic);
  if (!up || !field || !Number.isFinite(declination)) return null;
  const east = unit(cross(field,up));
  if (!east) return null;
  const north = cross(up,east);
  if (Math.hypot(east.z,north.z) < 0.01) return null; // azimuth undefined at zenith
  const heading = ((Math.atan2(-east.z,-north.z)*180/Math.PI + declination)%360+360)%360;
  return { heading, altitude: Math.asin(Math.max(-1,Math.min(1,-up.z)))*180/Math.PI, roll: Math.atan2(gravity.x,-gravity.y)*180/Math.PI };
}
