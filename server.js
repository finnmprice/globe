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

const satelliteSources = JSON.parse(fs.readFileSync(path.join(__dirname, 'satelliteSources.json'), 'utf8'));

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
            // console.log(`${source.filename} updated`);
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