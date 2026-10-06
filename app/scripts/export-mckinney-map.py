"""Copy a bounded model snapshot into Homage; never change the source engine."""
import base64, hashlib, json, math, os, struct
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
ENGINE = Path(os.environ.get('MCKINNEY_ENGINE', '/home/phoenix_wurx/Documents/ChatGPT/mckinney_engine'))
source = ENGINE/'data/mckinney-downtown-20260918/normalized.geojson'
terrain_path = ENGINE/'data/verification/mckinney-terrain/patch.json'
terrain = json.loads(terrain_path.read_text())
origin = terrain['origin']
def point(p):
    return [round((p[0]-origin[0])*111320*math.cos(math.radians(origin[1])),2),round(-(p[1]-origin[1])*111320,2)]
buildings, roads, parks = [], [], []
for f in json.loads(source.read_text())['features']:
    p, g = f['properties'], f['geometry']
    tags=p.get('osm_tags',{})
    polys = [g['coordinates']] if g['type']=='Polygon' else g['coordinates'] if g['type']=='MultiPolygon' else []
    if p['kind']=='building':
        for poly in polys:
            buildings.append({'id':f['id'],'rings':[[point(v) for v in ring] for ring in poly],'height':p.get('height_m',12),'name':tags.get('name','')})
    elif p['kind']=='road' and g['type'] in ['LineString','MultiLineString']:
        for line in ([g['coordinates']] if g['type']=='LineString' else g['coordinates']):
            roads.append({'points':[point(v) for v in line],'name':tags.get('name',''),'type':tags.get('highway','')})
    elif p['kind']=='park':
        parks += [[[point(v) for v in ring] for ring in poly] for poly in polys]
n=terrain['grid_size']
h=struct.unpack('<'+'f'*(n*n),base64.b64decode(terrain['heights']))
# Retain original grid samples covering the downtown source; no flat replacement.
a,b=112,144
step=(terrain['bounds'][2]-terrain['bounds'][0])/(n-1)
grid={'size':b-a+1,'min':terrain['bounds'][0]+a*step,'max':terrain['bounds'][0]+b*step,'heights':[round(h[j*n+i],3) for j in range(a,b+1) for i in range(a,b+1)]}
assert all(math.isfinite(v) for v in grid['heights'])
out={'origin':origin,'buildings':buildings,'roads':roads,'parks':parks,'terrain':grid,'provenance':{'geometrySha256':hashlib.sha256(source.read_bytes()).hexdigest(),'terrainSha256':hashlib.sha256(terrain_path.read_bytes()).hexdigest(),'geometrySource':str(source.relative_to(ENGINE)),'terrainSource':str(terrain_path.relative_to(ENGINE)),'attribution':'© OpenStreetMap contributors · Copernicus DSM / EU / ESA / DLR / Airbus','note':'Derived downtown snapshot. Inferred building heights and historical surface terrain; not surveyed parking levels.'}}
(ROOT/'features/mckinney/map/scene.json').write_text(json.dumps(out,separators=(',',':')))
print(f'Exported {len(buildings)} building polygons, {len(roads)} roads, {grid["size"]}×{grid["size"]} source terrain samples.')
