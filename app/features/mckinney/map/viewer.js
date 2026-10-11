import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import data from './scene.json';
import garage from '../portals/chestnutGarage.json';
import portals from '../portals/mapPortals.json';
import { isPortalVisible } from '../portals/mapAccess.ts';

const send = (type, id) => {
  const value = JSON.stringify({type, id});
  if (window.ReactNativeWebView) window.ReactNativeWebView.postMessage(value);
  else parent.postMessage({type, id}, '*');
};
try {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#101e24');
  scene.fog = new THREE.Fog('#101e24', 1400, 2500);
  const camera = new THREE.PerspectiveCamera(44, innerWidth / innerHeight, 1, 5000);
  const renderer = new THREE.WebGLRenderer({antialias:false});
  renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));
  renderer.setSize(innerWidth,innerHeight);
  document.getElementById('map').appendChild(renderer.domElement);
  renderer.domElement.setAttribute('aria-label','Interactive 3D map of downtown McKinney');
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI*.46;
  controls.minDistance = 65; controls.maxDistance = 1900;
  controls.touches.ONE = THREE.TOUCH.PAN;
  controls.touches.TWO = THREE.TOUCH.DOLLY_ROTATE;
  controls.mouseButtons.LEFT = THREE.MOUSE.PAN;
  controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
  scene.add(new THREE.HemisphereLight('#e1f3ff','#31433a',2.8));
  const light = new THREE.DirectionalLight('#ffe7be',2.5);
  light.position.set(-300,700,350);scene.add(light);
  const origin=data.origin, grid=data.terrain, step=(grid.max-grid.min)/(grid.size-1);
  function local(lon,lat) {return [(lon-origin[0])*111320*Math.cos(origin[1]*Math.PI/180),-(lat-origin[1])*111320];}
  function ground(x,z) {
    const u=Math.max(0,Math.min(grid.size-1.00001,(x-grid.min)/step));
    const v=Math.max(0,Math.min(grid.size-1.00001,(z-grid.min)/step));
    const i=Math.floor(u),j=Math.floor(v),fx=u-i,fz=v-j,n=grid.size;
    const a=grid.heights[j*n+i],b=grid.heights[j*n+i+1],c=grid.heights[(j+1)*n+i],d=grid.heights[(j+1)*n+i+1];
    return (fx+fz<=1?a+(b-a)*fx+(c-a)*fz:d+(c-d)*(1-fx)+(b-d)*(1-fz))-garage.modelBaseElevationMeters;
  }
  const terrain=new THREE.BufferGeometry(), vertices=[], indices=[];
  for(let j=0;j<grid.size;j++)for(let i=0;i<grid.size;i++)vertices.push(grid.min+i*step,grid.heights[j*grid.size+i]-garage.modelBaseElevationMeters,grid.min+j*step);
  for(let j=0;j<grid.size-1;j++)for(let i=0;i<grid.size-1;i++){const k=j*grid.size+i;indices.push(k,k+grid.size,k+1,k+1,k+grid.size,k+grid.size+1);}
  terrain.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));terrain.setIndex(indices);terrain.computeVertexNormals();
  scene.add(new THREE.Mesh(terrain,new THREE.MeshLambertMaterial({color:'#243b3d',side:THREE.DoubleSide})));
  const normalMat=new THREE.MeshLambertMaterial({color:'#779296'});
  const garageMat=new THREE.MeshLambertMaterial({color:'#5ea38f'});
  function shape(rings) {
    const result=new THREE.Shape(rings[0].map(([x,z])=>new THREE.Vector2(x,-z)));
    for(const ring of rings.slice(1))result.holes.push(new THREE.Path(ring.map(([x,z])=>new THREE.Vector2(x,-z))));
    return result;
  }
  const buildingGeometry=[], garageGeometry=[];
  for(const b of data.buildings) {
    const geom=new THREE.ExtrudeGeometry(shape(b.rings),{depth:b.height,bevelEnabled:false,steps:1});
    geom.rotateX(-Math.PI/2);
    const pos=geom.attributes.position;
    for(let i=0;i<pos.count;i++)pos.setY(i,pos.getY(i)+ground(pos.getX(i),pos.getZ(i)));
    geom.computeVertexNormals();
    (b.id===garage.sourceId?garageGeometry:buildingGeometry).push(geom);
  }
  for(const [geometries,material] of [[buildingGeometry,normalMat],[garageGeometry,garageMat]]) {
    const merged=mergeGeometries(geometries);scene.add(new THREE.Mesh(merged,material));geometries.forEach(g=>g.dispose());
  }
  const roadVertices=[];
  const roadMat=new THREE.LineBasicMaterial({color:'#bac5be',transparent:true,opacity:.6});
  for(const road of data.roads) {
    const points=road.points.map(([x,z])=>new THREE.Vector3(x,ground(x,z)+.6,z));
    for(let i=1;i<points.length;i++)roadVertices.push(...points[i-1].toArray(),...points[i].toArray());
  }
  const roadGeometry=new THREE.BufferGeometry();roadGeometry.setAttribute('position',new THREE.Float32BufferAttribute(roadVertices,3));scene.add(new THREE.LineSegments(roadGeometry,roadMat));
  const labels=[];
  function label(text,x,y,z,className='place') {
    const el=document.createElement('div');el.className=className;el.textContent=text;document.getElementById('labels').appendChild(el);
    labels.push({el,point:new THREE.Vector3(x,y,z)});
  }
  const named=new Set();
  for(const road of data.roads) {
    if(!['East Virginia Street','West Virginia Street','East Louisiana Street','West Louisiana Street','North Chestnut Street','South Chestnut Street','North Tennessee Street','South Tennessee Street','East Hunt Street'].includes(road.name)||named.has(road.name))continue;
    const points=road.points;
    if(points.length<2)continue;
    const p=points[Math.floor(points.length/2)];
    if(Math.hypot(...p)>650)continue;
    named.add(road.name);label(road.name,...[p[0],ground(...p)+3,p[1]],'street');
  }
  label('DOWNTOWN SQUARE',0,ground(0,0)+22,0);
  let selectedId=null, currentFix=null, showHidden=false, lastFocusRequest=0;
  const portalVisible = p => showHidden || isPortalVisible(p,currentFix);
  const markers=portals.map(p=>{
    const [x,z]=local(p.longitude,p.latitude), y=ground(x,z)+p.heightMeters;
    const group=new THREE.Group();group.position.set(x,y+(p.kind==='rooftop'?7:3),z);
    const radius=p.kind==='rooftop'?7:2.5;
    const ring=new THREE.Mesh(new THREE.TorusGeometry(radius,radius*.13,8,40),new THREE.MeshBasicMaterial({color:p.color}));
    const aura=new THREE.Mesh(new THREE.TorusGeometry(radius*1.4,.2,6,40),new THREE.MeshBasicMaterial({color:p.color,transparent:true,opacity:.5}));
    group.add(ring,aura);scene.add(group);
    const beam=new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(x,y,z),new THREE.Vector3(x,y+14,z)]),new THREE.LineBasicMaterial({color:p.color}));scene.add(beam);
    const el=document.createElement('button');
    el.className='portal-marker';el.hidden=p.hiddenUntilNearby;group.visible=beam.visible=!p.hiddenUntilNearby;el.textContent='';
    el.setAttribute('aria-label','Select portal at '+p.place);el.style.borderColor=p.color;el.style.color=p.color;
    document.getElementById('markers').appendChild(el);
    el.onclick=()=>{if(!portalVisible(p))return;selectedId=p.id;send('portal-selected',p.id);focusPortal();};
    return {p,x,z,y,group,ring,aura,beam,el,point:new THREE.Vector3(x,y+(p.kind==='rooftop'?23:10),z)};
  });
  const player=new THREE.Mesh(new THREE.SphereGeometry(3,12,8),new THREE.MeshBasicMaterial({color:'#8ecaff',depthTest:false}));
  player.renderOrder=10;player.visible=false;scene.add(player);
  let playerPosition=null;
  function focus(x,z,distance=240){const y=ground(x,z);controls.target.set(x,y+9,z);camera.position.set(x+distance*.65,y+distance*.85,z+distance*.95);controls.update();}
  function focusPortal(){const m=markers.find(m=>m.p.id===selectedId&&portalVisible(m.p))||markers[1];focus(m.x,m.z,190);}
  function overview(){focus(40,-5,360);}
  document.getElementById('focus').onclick=focusPortal;
  document.getElementById('overview').onclick=overview;
  document.getElementById('me').onclick=()=>{
    if(playerPosition){focus(...playerPosition,220);document.getElementById('hint').textContent='Your location · blue dot';}
    else document.getElementById('hint').textContent='Waiting for your phone’s location';
  };
  window.homageMap={update(value){
    currentFix=value.fix??null;
    showHidden=value.showHidden === true;
    for(const m of markers){m.el.classList.toggle('ready',Array.isArray(value.readyIds)&&value.readyIds.includes(m.p.id));m.el.classList.toggle('selected',m.p.id===value.selectedId);}
    if(value.selectedId&&(value.selectedId!==selectedId||value.focusRequest!==lastFocusRequest)&&markers.some(m=>m.p.id===value.selectedId&&portalVisible(m.p))){selectedId=value.selectedId;lastFocusRequest=value.focusRequest;focusPortal();}
    if(value.latitude!==null&&Number.isFinite(value.latitude)&&Number.isFinite(value.longitude)){
      playerPosition=local(value.longitude,value.latitude);
      const [x,z]=playerPosition;
      player.visible=Math.abs(x)<=1000&&Math.abs(z)<=1000;
      if(player.visible)player.position.set(x,ground(x,z)+4,z);
      document.getElementById('me').disabled=!player.visible;
      if(!player.visible)document.getElementById('hint').textContent='You’re outside this downtown map · portal shown at the garage';
    } else {player.visible=false;playerPosition=null;document.getElementById('me').disabled=true;}
  }};
  // The embedded web preview accepts only messages from its owning page.
  addEventListener('message',e=>{if(e.source===parent&&e.data?.type==='homage-location')window.homageMap.update(e.data);});
  overview();
  const vector=new THREE.Vector3();
  function position(el,point) {
    vector.copy(point).project(camera);
    el.style.display=vector.z>1||Math.abs(vector.x)>1.2||Math.abs(vector.y)>1.2?'none':'block';
    el.style.left=(vector.x*.5+.5)*innerWidth+'px';el.style.top=(-vector.y*.5+.5)*innerHeight+'px';
  }
  let last=0;
  function frame(t){requestAnimationFrame(frame);if(document.hidden||t-last<33)return;last=t;controls.update();
    controls.target.x=THREE.MathUtils.clamp(controls.target.x,-780,780);controls.target.z=THREE.MathUtils.clamp(controls.target.z,-780,780);
    for(const m of markers){m.ring.rotation.z=t*.0002;m.aura.scale.setScalar(1+Math.sin(t*.002)*.08);m.group.quaternion.copy(camera.quaternion);}
    renderer.render(scene,camera);
    for(const m of markers){const visible=portalVisible(m.p);m.group.visible=m.beam.visible=visible;m.el.hidden=!visible;if(visible)position(m.el,m.point);else {m.el.style.display='none';if(selectedId===m.p.id)selectedId=null;}}
    for(const item of labels)position(item.el,item.point);
  }
  addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);});
  renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();document.getElementById('hint').textContent='Map paused. Reopen the map to reload.';send('map-error');});
  document.getElementById('loading').remove();
  send('map-ready');requestAnimationFrame(frame);
} catch(error) {
  document.getElementById('loading').textContent='The 3D map could not load. Reopen it to try again.';
  send('map-error');console.error(error);
}
