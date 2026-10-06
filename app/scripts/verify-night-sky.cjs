const assert=require('node:assert/strict');
const fs=require('node:fs'), path=require('node:path'),ts=require('typescript');
const app=path.resolve(__dirname,'..');
const out=fs.mkdtempSync(path.join(require('node:os').tmpdir(),'homage-night-sky-'));
try {
 fs.symlinkSync(path.join(app,'node_modules'),path.join(out,'node_modules'),'dir');
 for(const file of [...fs.readdirSync(path.join(app,'sky/engine')).filter(f=>f.endsWith('.ts')).map(f=>'sky/engine/'+f),'features/mckinney/encounter/skyGate.ts','features/mckinney/encounter/skyHold.ts','sky/cameraDirection.ts','sky/catalog.ts','sky/astronomy.ts','lib/geo.ts']){
  const dest=path.join(out,file.replace('.ts','.js'));fs.mkdirSync(path.dirname(dest),{recursive:true});
  fs.writeFileSync(dest,ts.transpileModule(fs.readFileSync(path.join(app,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText);
 }
 const {skyTargets,alignmentGate,DOWNTOWN}=require(path.join(out,'features/mckinney/encounter/skyGate.js'));
 assert.equal(skyTargets(DOWNTOWN,new Date('2026-09-19T18:00:00Z')).length,0,'Daylight cannot trigger a night encounter');
 const night=skyTargets(DOWNTOWN,new Date('2026-09-20T02:00:00Z'));
 assert(night.length>0,'At least one supported pattern is available on the test night');
 assert(night.every(t=>t.target.altitude>=12 && t.target.altitude<=80));
 const now=100000;
 const good={observer:DOWNTOWN,accuracy:5,locationTimestamp:now,headingAccuracy:3,headingTimestamp:now,motionTimestamp:now,heading:359,altitude:45,now,target:{azimuth:1,altitude:45}};
 assert(alignmentGate(good),'Bearing wraps at north');
 for(const patch of [{observer:null},{observer:{latitude:0,longitude:0}},{accuracy:21},{accuracy:-1},{accuracy:null},{locationTimestamp:now-31000},{locationTimestamp:now+1},{headingAccuracy:2},{headingTimestamp:now-15100},{motionTimestamp:now-1001},{target:null},{heading:40},{altitude:0}])assert(!alignmentGate({...good,...patch}),JSON.stringify(patch));
 // Sensors can arrive between the 100 ms UI ticks. Evaluate freshness at
 // the time of the reading/render, not at the preceding UI tick.
 let heldAt=null, completed=false;
 for(let elapsed=0;elapsed<=3200;elapsed+=80){
  const sensorTime=now+elapsed;
  const aligned=alignmentGate({...good,headingTimestamp:sensorTime,motionTimestamp:sensorTime,now:sensorTime});
  if(!aligned) heldAt=null;
  else if(heldAt===null) heldAt=sensorTime;
  if(heldAt!==null && sensorTime-heldAt>=3000) completed=true;
 }
 assert(completed,'Continuous fresh 80 ms sensor readings allow a three-second hold between UI ticks');
 assert(!alignmentGate({...good,heading:NaN}),'Invalid direction cannot capture');
 const {advanceSkyHold,emptyHold}=require(path.join(out,'features/mckinney/encounter/skyHold.js'));
 let hold=emptyHold();
 for(let t=0;t<=3100;t+=100) hold=advanceSkyHold(hold,t,'cygnus',true,t===0?6:8);
 assert.equal(hold.elapsed,3000,'Small aiming jitter does not restart capture');
 hold=advanceSkyHold(hold,3200,'cygnus',false,5);
 assert.equal(hold.elapsed,0,'Invalid sensors immediately reset capture');
 hold=advanceSkyHold(emptyHold(),0,'cygnus',true,5);
 hold=advanceSkyHold(hold,100,'cygnus',true,5);
 hold=advanceSkyHold(hold,200,'cygnus',true,12);
 hold=advanceSkyHold(hold,400,'cygnus',true,5);
 assert.equal(hold.elapsed,100,'Brief excursion preserves progress but adds no time');
 assert.equal(advanceSkyHold(hold,500,'orion',true,5).elapsed,0,'Changing targets resets hold');
 assert.equal(advanceSkyHold(hold,2000,'cygnus',true,5).elapsed,0,'Long interruption resets hold');
 hold=advanceSkyHold(hold,500,'cygnus',true,12);
 hold=advanceSkyHold(hold,800,'cygnus',true,12);
 hold=advanceSkyHold(hold,1000,'cygnus',true,12);
 assert.equal(hold.tracking,false,'Sustained off-target aim resets hold');
 assert(alignmentGate({...good,headingTimestamp:now-4000}),'Steady Android compass remains usable during hold');
 const {cameraDirection}=require(path.join(out,'sky/cameraDirection.js'));
 const dot=(a,b)=>a.reduce((sum,v,i)=>sum+v*b[i],0);
 for(const az of [0,45,90,180,270,359]) for(const alt of [0,34,73]) for(const roll of [-60,0,60]) {
  const h=az*Math.PI/180,a=alt*Math.PI/180,r=roll*Math.PI/180;
  const right=[Math.cos(h),-Math.sin(h),0];
  const top=[-Math.sin(a)*Math.sin(h),-Math.sin(a)*Math.cos(h),Math.cos(a)];
  const screen=[-Math.cos(a)*Math.sin(h),-Math.cos(a)*Math.cos(h),-Math.sin(a)];
  const axes=[right.map((v,i)=>v*Math.cos(r)+top[i]*Math.sin(r)),top.map((v,i)=>v*Math.cos(r)-right[i]*Math.sin(r)),screen];
  const [gx,gy,gz]=axes.map(axis=>dot(axis,[0,0,-1]));
  const [mx,my,mz]=axes.map(axis=>dot(axis,[0,25,-40]));
  const result=cameraDirection({x:gx,y:gy,z:gz},{x:mx,y:my,z:mz},0);
  assert(result);
  assert(Math.abs(((result.heading-az+540)%360)-180)<0.00001,`Rear camera heading: ${az}/${alt}/${roll}`);
  assert(Math.abs(result.altitude-alt)<0.00001,'Camera altitude matches physical tilt');
  const corrected=cameraDirection({x:gx,y:gy,z:gz},{x:mx,y:my,z:mz},5);
  assert(Math.abs(((corrected.heading-az-5+540)%360)-180)<0.00001,'True north correction');
 }
 assert.equal(cameraDirection({x:0,y:0,z:0},{x:1,y:1,z:1},0),null);
 assert.equal(cameraDirection({x:0,y:-1,z:0},{x:0,y:0,z:0},0),null);
 console.log('Camera direction passed 54 heading/tilt/roll combinations, true north correction, and invalid-sensor rejection.');
 const engine=require(path.join(out,'sky/engine/index.js'));
 const elsewhere={latitude:DOWNTOWN.latitude+0.1,longitude:DOWNTOWN.longitude};
 assert(engine.alignmentStatus({...good,observer:elsewhere}).aligned,'Lab alignment has no city restriction');
 assert(!engine.alignmentStatus({...good,observer:elsewhere},{center:DOWNTOWN,radiusMeters:1500}).aligned,'Encounter supplies its own region policy');
 const anchors=engine.skyTargets(DOWNTOWN,new Date('2026-09-20T02:00:00Z'),'anchor');
 assert(anchors.length>=night.length,'Anchor mode supports targets without requiring the whole pattern visible');
 assert.equal(engine.skyTargets(DOWNTOWN,new Date('2026-09-19T18:00:00Z'),'anchor').length,0,'Lab also rejects daylight');
 console.log('Night sky checks passed: daylight exclusion, visible nighttime patterns, bearing wrap, downtown boundary, GPS quality/freshness, compass/motion freshness, off-target rejection.');
}finally{fs.rmSync(out,{recursive:true,force:true});}
