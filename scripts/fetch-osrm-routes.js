const https = require('https');
const fs = require('fs');
const path = require('path');

function osrmRoute(coords) {
  return new Promise((resolve, reject) => {
    const url = `https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson&steps=false`;
    https.get(url, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

function downsample(coords, targetCount) {
  if (coords.length <= targetCount) return coords;
  const step = coords.length / targetCount;
  const result = [];
  for (let i = 0; i < coords.length; i = Math.floor(i + step)) {
    result.push(coords[Math.min(i, coords.length - 1)]);
  }
  if (
    result[result.length - 1][0] !== coords[coords.length - 1][0] ||
    result[result.length - 1][1] !== coords[coords.length - 1][1]
  ) {
    result.push(coords[coords.length - 1]);
  }
  return result;
}

(async () => {
  console.log('Fetching route A (fastest)...');
  const r1 = await osrmRoute('121.606,25.054;121.433,25.175');
  console.log('Fetching route B (via waypoint)...');
  const r2 = await osrmRoute('121.606,25.054;121.560,25.100;121.433,25.175');
  console.log('Fetching route C (via 2 waypoints)...');
  const r3 = await osrmRoute('121.606,25.054;121.550,25.090;121.470,25.140;121.433,25.175');

  const results = [r1, r2, r3].map((r, i) => {
    const rt = r.routes[0];
    const coords = rt.geometry.coordinates;
    const sampled = downsample(coords, 70);
    return {
      key: ['route-a', 'route-b', 'route-c'][i],
      label: ['RouteA', 'RouteB', 'RouteC'][i],
      distance: Math.round(rt.distance),
      duration: Math.round(rt.duration),
      coords: sampled,
      originalCount: coords.length,
      sampledCount: sampled.length
    };
  });

  let code =
    '// Auto-generated from OSRM routing engine - real road network data\n';
  code += `// Generated: ${new Date().toISOString()}\n`;
  code += '// Source: https://router.project-osrm.org\n\n';

  results.forEach((r) => {
    code += `// Route: ${r.key} - ${r.distance}m, ${r.duration}s (${r.sampledCount} pts from ${r.originalCount} original)\n`;
    code += `export const planning${r.label}Coords: readonly [number, number][] = [\n`;
    r.coords.forEach((c, idx) => {
      const comma = idx < r.coords.length - 1 ? ',' : '';
      code += `  [${c[0]}, ${c[1]}]${comma}\n`;
    });
    code += '];\n\n';
  });

  code += 'export const planningOsrmMetrics = {\n';
  results.forEach((r) => {
    code += `  '${r.key}': { distance: ${r.distance}, duration: ${r.duration} },\n`;
  });
  code += '} as const;\n';

  const outPath = path.join(__dirname, '..', 'src', 'mock', 'planning-route-coords.ts');
  fs.writeFileSync(outPath, code, 'utf-8');
  console.log(`Written ${code.split('\n').length} lines to ${outPath}`);

  results.forEach((r) => {
    const durMin = Math.round(r.duration / 60);
    const distKm = (r.distance / 1000).toFixed(1);
    console.log(`  ${r.key}: ${distKm}km, ${durMin}min (${r.sampledCount} waypoints)`);
  });
})();
