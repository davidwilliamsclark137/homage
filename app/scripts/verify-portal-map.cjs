const assert = require('node:assert/strict');
const scene = require('../features/mckinney/map/scene.json');
const garage = require('../features/mckinney/portals/chestnutGarage.json');
const embedded = require('../features/mckinney/map/embedded.json');
assert.equal(scene.buildings.length,1140);
assert.equal(scene.roads.length,377);
assert.equal(scene.terrain.heights.length,scene.terrain.size ** 2);
assert(scene.terrain.heights.every(Number.isFinite));
assert(new Set(scene.terrain.heights).size>100,'Terrain must not be a flat stand-in');
assert.equal(scene.provenance.geometrySha256,garage.sourceSha256);
const building = scene.buildings.find(b=>b.id===garage.sourceId);
assert(building,'Target garage retained');
assert.equal(building.height,garage.modelHeightMeters);
const local = ([lon,lat]) => [
 Math.round((lon-scene.origin[0])*111320*Math.cos(scene.origin[1]*Math.PI/180)*100)/100,
 Math.round(-(lat-scene.origin[1])*111320*100)/100
];
assert.deepEqual(building.rings[0],garage.footprint.map(local));
for(const b of scene.buildings) {
 assert(Number.isFinite(b.height) && b.height>0);
 for(const ring of b.rings)assert(ring.length>=4 && ring.every(p=>p.length===2&&p.every(Number.isFinite)));
}
const portals = require('../features/mckinney/portals/mapPortals.json');
assert.equal(portals.length,8);
assert.equal(new Set(portals.map(p=>p.id)).size,8);
assert.equal(portals.filter(p=>p.hiddenUntilNearby).length,3);
for(const p of portals){
  assert(scene.buildings.some(b=>b.id===p.sourceId));
  assert(embedded.html.includes(p.id));
  if(p.kind==='storefront'){
    assert.equal(p.heightMeters,0);
    assert.equal(p.fieldVerified,false);
    const b=scene.buildings.find(b=>b.id===p.sourceId), [x,z]=local([p.longitude,p.latitude]);
    let nearest=Infinity;
    const ring=b.rings[0];
    for(let i=1;i<ring.length;i++){
      const [ax,az]=ring[i-1],[bx,bz]=ring[i],dx=bx-ax,dz=bz-az;
      const t=Math.max(0,Math.min(1,((x-ax)*dx+(z-az)*dz)/(dx*dx+dz*dz)));
      nearest=Math.min(nearest,Math.hypot(x-ax-t*dx,z-az-t*dz));
    }
    assert(nearest>=1 && nearest<=4,'Storefront marker should be just outside its facade');
  }
}
assert(!/<script[^>]+src=/.test(embedded.html),'Map script must be bundled');
assert(!/<link[^>]+href=/.test(embedded.html),'Map styling must be bundled');
console.log('Map checks passed: source footprint, 1,140 buildings, 377 roads, non-flat terrain, embedded assets.');
