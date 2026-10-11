const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const app = path.resolve(__dirname, '..');
const output = fs.mkdtempSync(path.join(require('node:os').tmpdir(), 'homage-rooftop-'));
try {
  for (const relative of ['features/mckinney/portals/rooftop.ts', 'features/mckinney/portals/mapAccess.ts', 'lib/geo.ts', 'features/mckinney/audio/proximity.ts']) {
    const target = path.join(output, relative.replace(/\.ts$/, '.js'));
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, ts.transpileModule(fs.readFileSync(path.join(app, relative), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true } }).outputText);
  }
  fs.copyFileSync(path.join(app, 'features/mckinney/portals/chestnutGarage.json'), path.join(output, 'features/mckinney/portals/chestnutGarage.json'));
  fs.copyFileSync(path.join(app, 'features/mckinney/portals/mapPortals.json'), path.join(output, 'features/mckinney/portals/mapPortals.json'));
  const { MAP_PORTALS, portalAccess, isPortalVisible } = require(path.join(output, 'features/mckinney/portals/mapAccess.js'));
  const { garage, insideGarage, canPlace, canRecordBaseline, relativeHeight, isPlacement, rooftopAccess } = require(path.join(output, 'features/mckinney/portals/rooftop.js'));
  const { proximitySignal } = require(path.join(output, 'features/mckinney/audio/proximity.js'));
  const now = Date.now();
  const fix = { ...garage.location, altitude: 200, altitudeAccuracy: 8, accuracy: 5, timestamp: now };
  const hidden = MAP_PORTALS.find(p => p.id === 'tupps-hidden');
  const hiddenFix = { ...fix, latitude: hidden.latitude, longitude: hidden.longitude };
  const approachFix = { ...hiddenFix, latitude: hidden.latitude + 0.00035 };
  assert(!isPortalVisible(hidden, approachFix, now));
  assert.equal(proximitySignal(approachFix, 'android', now).id, hidden.id);
  assert(proximitySignal(approachFix, 'android', now).tuning < 1);
  assert.equal(proximitySignal(hiddenFix, 'android', now).tuning, 1);
  for (const invalid of [null, {...hiddenFix, accuracy:21}, {...hiddenFix, timestamp:now-31000}, {...hiddenFix, latitude:34}]) {
    assert.equal(proximitySignal(invalid, 'android', now), null);
  }
  assert(proximitySignal({...fix, latitude:MAP_PORTALS[0].latitude, longitude:MAP_PORTALS[0].longitude}, 'android', now).tuning < 1);
  assert(insideGarage(fix));
  assert(canPlace(fix, now));
  assert(canRecordBaseline(fix, now));
  for (const patch of [{longitude:-96.615}, {accuracy:null}, {accuracy:21}, {timestamp:now-31000}, {timestamp:now+1000}]) assert(!canPlace({...fix,...patch},now));
  assert(!canRecordBaseline({...fix,latitude:34},now));
  assert.equal(relativeHeight(fix,{...fix,altitude:188,timestamp:now-60000}),12);
  assert.equal(relativeHeight({...fix,altitude:null},fix),null);
  assert.equal(relativeHeight(fix,{...fix,timestamp:now-1800001}),null);
  assert.equal(relativeHeight(fix,{...fix,timestamp:now+1}),null);
  const draft = {version:1,sourceId:garage.sourceId,level:'top-deck',...garage.location,modelHeightMeters:12,method:'model-draft',savedAt:now,fix:null,baseline:null};
  assert(isPlacement(JSON.parse(JSON.stringify(draft))));
  for (const patch of [{sourceId:'other'},{latitude:0},{method:'gps-verified'}]) assert(!isPlacement({...draft,...patch}));
  const roof = {...fix, altitude:garage.targetAltitudeMeters, altitudeAccuracy:2};
  assert(rooftopAccess(roof,'ios',now).ready);
  assert(!rooftopAccess({...roof,altitude:garage.modelBaseElevationMeters},'ios',now).ready);
  for (const patch of [{altitude:null},{altitudeAccuracy:null},{altitudeAccuracy:6},{timestamp:now-31000},{longitude:-96.615}]) assert(!rooftopAccess({...roof,...patch},'ios',now).ready);
  assert(!rooftopAccess(roof,'android',now).ready);
  assert(!rooftopAccess(null,'ios',now).ready);
  for(const portal of MAP_PORTALS.filter(p=>p.kind==='storefront')) {
    const streetFix={...fix,latitude:portal.latitude,longitude:portal.longitude,altitude:null,altitudeAccuracy:null};
    assert(portalAccess(portal,streetFix,'ios',now).ready);
    assert(portalAccess(portal,streetFix,'android',now).ready);
    assert(!portalAccess(portal,{...streetFix,latitude:34},'ios',now).ready);
    assert(!portalAccess(portal,{...streetFix,accuracy:30},'ios',now).ready);
    assert(!portalAccess(portal,{...streetFix,timestamp:now-31000},'ios',now).ready);
  }
  assert(!portalAccess(MAP_PORTALS[0],{...roof,altitude:null},'ios',now).ready);
  const { offset } = require(path.join(output,'lib/geo.js'));
  for(const hidden of MAP_PORTALS.filter(p=>p.hiddenUntilNearby)){
    const near={...fix,latitude:hidden.latitude,longitude:hidden.longitude,altitude:null,altitudeAccuracy:null};
    const within={...near,...offset(hidden,90,17)};
    const outside={...near,...offset(hidden,90,19)};
    // Arrival, departure, and return never persist discovery.
    assert(!isPortalVisible(hidden,outside,now));
    assert(isPortalVisible(hidden,within,now));
    assert(!isPortalVisible(hidden,outside,now));
    assert(isPortalVisible(hidden,near,now));
    assert(!isPortalVisible(hidden,null,now));
    assert(!isPortalVisible(hidden,{...near,accuracy:21},now));
    assert(!isPortalVisible(hidden,{...near,timestamp:now-31000},now));
    assert(!isPortalVisible(hidden,{...near,timestamp:now+1000},now));
  }
  for(const visible of MAP_PORTALS.filter(p=>!p.hiddenUntilNearby)) assert(isPortalVisible(visible,null,now));
  assert.equal(MAP_PORTALS.filter(p=>isPortalVisible(p,null,now)).length,5);
  console.log('Hidden portal checks passed: arrive, leave, return, missing/inaccurate/stale GPS; existing portals stay visible.');
  console.log('Passed rooftop footprint, accuracy, freshness, baseline, and saved-record checks.');
} finally { fs.rmSync(output,{recursive:true,force:true}); }
