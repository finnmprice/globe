const express = require('express');
const path = require('path');
const https = require('https');
const fs = require('fs');

const app = express();
const port = 3000;

app.use(express.static('public'));

app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const satelliteSources = [
  {
    name: 'all',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=active&FORMAT=tle',
    filename: 'data/all.txt',
    type: 'other'
  },
  {
    name: 'starlink',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=tle',
    filename: 'data/starlink.txt',
    type: 'starlink',
  },
  {
    name: 'cosmos-1408-debris',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-1408-debris&FORMAT=tle',
    filename: 'data/cosmos-1408_debris.txt',
    type: 'debris'
  },
  {
    name: 'fengyun-debris',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=fengyun-1c-debris&FORMAT=tle',
    filename: 'data/fengyun-1C_debris.txt',
    type: 'debris'
  },
  {
    name: 'iridium-33-debris',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=iridium-33-debris&FORMAT=tle',
    filename: 'data/iridium-33_debris.txt',
    type: 'debris'
  },
  {
    name: 'cosmos-2251-debris',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=cosmos-2251-debris&FORMAT=tle',
    filename: 'data/cosmos-2251_debris.txt',
    type: 'debris'
  },
  {
    name: 'noaa',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=noaa&FORMAT=tle',
    filename: 'data/noaa.txt',
    type: 'weather'
  },
  {
    name: 'goes',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=goes&FORMAT=tle',
    filename: 'data/goes.txt',
    type: 'weather'
  },
  {
    name: 'weather',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=weather&FORMAT=tle',
    filename: 'data/weather.txt',
    type: 'weather'
  },
  {
    name: 'earth-resources',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=resource&FORMAT=tle',
    filename: 'data/earth_resources.txt',
    type: 'weather',
    description: 'resources'
  },
  {
    name: 'sarsat',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=sarsat&FORMAT=tle',
    filename: 'data/sarsat.txt',
    type: 'weather',
    description: 'search & rescue'
  },
  {
    name: 'disaster-monitor',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=dmc&FORMAT=tle',
    filename: 'data/disaster-monitor.txt',
    type: 'weather',
    description: 'disaster monitoring'
  },
  {
    name: 'tdrss',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=tdrss&FORMAT=tle',
    filename: 'data/tdrss.txt',
    type: 'weather',
    description: 'nasa tracking and data'
  },
  {
    name: 'argos',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=argos&FORMAT=tle',
    filename: 'data/argos.txt',
    type: 'weather',
    description: 'environmental monitoring'
  },
  {
    name: 'planet',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=planet&FORMAT=tle',
    filename: 'data/planet.txt',
    type: 'weather',
    description: 'imagery'
  },
  {
    name: 'spire',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=spire&FORMAT=tle',
    filename: 'data/spire.txt',
    type: 'weather'
  },
  {
    name: 'active-geo',
    url: 'https://celestrak.org/NORAD/elements/gp.php?GROUP=geo&FORMAT=tle',
    filename: 'data/active-geo.txt',
    type: 'communication'
  }
];

function fetchAndSaveData(source) {
  return new Promise((resolve, reject) => {
    https.get(source.url, (response) => {
      let data = '';

      response.on('data', (chunk) => {
        data += chunk;
      });

      response.on('end', () => {
        fs.writeFile(source.filename, data, (err) => {
          if (err) {
            console.error(`Error writing ${source.filename}:`, err);
            reject(err);
          } else {
            console.log(`${source.filename} updated`);
            resolve();
          }
        });
      });

    }).on("error", (err) => {
      console.log(`error fetching ${source.name} data:`, err.message);
      reject(err);
    });
  });
}

app.get('/satellite-data', (req, res) => {
  const combinedData = [];
  const specificSatellites = new Set();

  satelliteSources.forEach(source => {
    if (source.name !== 'all' && fs.existsSync(source.filename)) {
      const data = fs.readFileSync(source.filename, 'utf8').split('\n');
      for (let i = 0; i < data.length; i += 3) {
        if (data[i] && data[i+1] && data[i+2]) {
          const name = data[i].trim();
          specificSatellites.add(name);
          combinedData.push({
            name: name,
            line1: data[i+1],
            line2: data[i+2],
            type: source.type,
            description: source.description ? source.description : undefined
          });
        }
      }
    }
  });

  const allSource = satelliteSources.find(source => source.name === 'all');
  if (allSource && fs.existsSync(allSource.filename)) {
    const data = fs.readFileSync(allSource.filename, 'utf8').split('\n');
    for (let i = 0; i < data.length; i += 3) {
      if (data[i] && data[i+1] && data[i+2]) {
        const name = data[i].trim();
        if (!specificSatellites.has(name)) {
          combinedData.push({
            name: name,
            line1: data[i+1],
            line2: data[i+2],
            type: 'other'
          });
        }
      }
    }
  }

  res.json(combinedData);
});

// Promise.all(satelliteSources.map(source => fetchAndSaveData(source)))
//   .then(() => console.log('data fetch complete'))
//   .catch(err => console.error('error:', err));

// rotating hourly fetches
let currentSourceIndex = 0;
setInterval(() => {
  const source = satelliteSources[currentSourceIndex];
  fetchAndSaveData(source)
    .then(() => console.log(`${source.name} updated`))
    .catch(err => console.error(`error updating ${source.name}:`, err));
  
  currentSourceIndex = (currentSourceIndex + 1) % satelliteSources.length;
}, 60 * 60 * 1000);

app.listen(port, () => {
  console.log(`server running on http://localhost:${port}`);
});