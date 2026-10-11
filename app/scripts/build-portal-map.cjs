const fs = require('node:fs');
const path = require('node:path');
const engine = process.env.MCKINNEY_ENGINE || '/home/phoenix_wurx/Documents/ChatGPT/mckinney_engine';
const esbuild = require(path.join(engine, 'node_modules/esbuild'));
const app = path.resolve(__dirname, '..');
const result=esbuild.buildSync({
  entryPoints:[path.join(app,'features/mckinney/map/viewer.js')],bundle:true,minify:true,write:false,format:'iife',
  alias:{'three/addons':path.join(engine,'node_modules/three/examples/jsm'),three:path.join(engine,'node_modules/three')},target:['safari15'],legalComments:'inline',
});
const js=result.outputFiles[0].text.replace(/<\/script/gi,'<\\/script');
const html='<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"><style>'+
'html,body,#map{margin:0;width:100%;height:100%;overflow:hidden;background:#101e24;font-family:system-ui;color:#effff8}canvas{display:block;touch-action:none}button{font:700 12px system-ui;color:#e7fff3;background:#173d36;border:1px solid #548b78;border-radius:12px;padding:12px;min-height:44px}button:disabled{opacity:.45}#tools{position:absolute;right:12px;bottom:75px;display:flex;flex-direction:column;gap:6px}#heading{position:absolute;top:18px;left:16px;font-size:11px;letter-spacing:2px;pointer-events:none}#hint{position:absolute;bottom:44px;left:12px;right:12px;text-align:center;color:#bbccc7;font-size:11px;pointer-events:none}#credit{position:absolute;bottom:10px;left:12px;font-size:9px;color:#a7beb7;pointer-events:none}.portal-marker{position:absolute;transform:translate(-50%,-50%);width:44px;height:44px;padding:0;min-height:44px;border:0;background:transparent;border-radius:50%}.portal-marker::after{content:"";position:absolute;inset:12px;border-radius:50%;background:currentColor;box-shadow:0 0 12px currentColor}.portal-marker[hidden]{display:none!important}.portal-marker.selected::after{outline:2px solid currentColor;outline-offset:4px}.portal-marker.ready::after{box-shadow:0 0 20px currentColor}.street,.place{position:absolute;transform:translate(-50%,-50%);pointer-events:none;text-shadow:0 1px 4px #000}.street{font-size:9px;color:#c1cfcc;white-space:nowrap}.place{font-size:10px;font-weight:800;color:#e0ebe7}#loading{position:absolute;top:40%;left:15%;right:15%;text-align:center}</style></head><body>'+
'<div id="map"></div><div id="labels"></div><div id="heading">HOMAGE / MCKINNEY</div><div id="markers"></div><div id="tools"><button id="focus" aria-label="Focus selected portal">◎ Portal</button><button id="overview">Overview</button><button id="me" disabled>My location</button></div><div id="hint">Drag to explore · pinch to zoom · two fingers to rotate</div><div id="credit">© OpenStreetMap · Copernicus DSM · estimated building heights</div><div id="loading">Opening downtown McKinney…</div><script>'+js+'</script></body></html>';
fs.writeFileSync(path.join(app,'features/mckinney/map/embedded.json'),JSON.stringify({html}));
fs.copyFileSync(path.join(engine,'node_modules/three/LICENSE'),path.join(app,'features/mckinney/map/THREE-LICENSE.txt'));
console.log('Built self-contained map:',Buffer.byteLength(html),'bytes');
