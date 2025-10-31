const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Pennsylvania County GIS configurations
const countyConfigs = {
  lancaster: {
    gisUrl: 'https://gis.co.lancaster.pa.us/arcgis/rest/services/Parcels/MapServer/0/query',
    fields: {
      parcelId: ['PIN', 'PARCEL_ID', 'PARID'],
      owner: ['OWNER', 'OWNER_NAME'],
      address: ['SITUS', 'SITE_ADDR', 'LOCATION'],
      municipality: ['MUNI', 'MUNICIPAL', 'MUNI_NAME'],
      acres: ['ACRES', 'CALC_ACRE', 'ACREAGE'],
      landUse: ['LAND_USE', 'USE_CODE', 'LANDUSE'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['TOTVAL', 'TOTAL_VAL', 'ASSESS_TOT']
    }
  },
  berks: {
    gisUrl: 'https://gis.co.berks.pa.us/arcgis/rest/services/Assess/ParcelSearchTable/MapServer/0/query',
    fields: {
      parcelId: ['PARID', 'PIN', 'MAPNO', 'PIN_NUM'],
      owner: ['WBNAME', 'OWNER', 'OWNERNAME1'],
      address: ['WBLOCN', 'SITUS', 'WBADDR', 'LOCATION'],
      municipality: ['MUNI_NAME', 'MUNI', 'MUNICIPAL'],
      acres: ['ACRES', 'CALC_ACRE', 'ACREAGE'],
      landUse: ['LAND_USE', 'USE_CODE', 'LANDUSE'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['TOTVAL', 'TOTAL_VAL', 'ASSESS_TOT', 'TOTAL_VALUE']
    }
  },
  york: {
    gisUrl: 'https://gis.yorkcountypa.gov/arcgis/rest/services/Public/Parcels/MapServer/0/query',
    fields: {
      parcelId: ['PARID', 'PIN', 'PARCEL_ID'],
      owner: ['OWNER', 'OWNER_NAME', 'OWNERNAME1'],
      address: ['SITUS', 'SITE_ADDR', 'LOCATION'],
      municipality: ['MUNI', 'MUNICIPAL', 'MUNI_NAME'],
      acres: ['ACRES', 'CALC_ACRE', 'ACREAGE'],
      landUse: ['LAND_USE', 'USE_CODE', 'LANDUSE'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['TOTVAL', 'TOTAL_VAL', 'ASSESS_TOT']
    }
  },
  chester: {
    gisUrl: 'https://gis.chesco.org/arcgis/rest/services/Parcels/MapServer/0/query',
    fields: {
      parcelId: ['PARID', 'PIN', 'PARCEL_ID'],
      owner: ['OWNER', 'OWNER_NAME', 'OWNERNAME1'],
      address: ['SITUS', 'SITE_ADDR', 'LOCATION'],
      municipality: ['MUNI', 'MUNICIPAL', 'MUNI_NAME'],
      acres: ['ACRES', 'CALC_ACRE', 'ACREAGE'],
      landUse: ['LAND_USE', 'USE_CODE', 'LANDUSE'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['TOTVAL', 'TOTAL_VAL', 'ASSESS_TOT']
    }
  }
};

// Helper function to find field value from multiple possible field names
function getFieldValue(attributes, possibleFields) {
  for (const field of possibleFields) {
    if (attributes[field] !== undefined && attributes[field] !== null && attributes[field] !== '') {
      return attributes[field];
    }
  }
  return null;
}

// Geocoding endpoint (Google Maps Geocoding API alternative using free service)
async function geocodeAddress(address) {
  try {
    // Using Nominatim (OpenStreetMap) for free geocoding
    const response = await axios.get('https://nominatim.openstreetmap.org/search', {
      params: {
        q: address,
        format: 'json',
        addressdetails: 1,
        limit: 1
      },
      headers: {
        'User-Agent': 'HorstSigns-PropertyLookup/1.0'
      }
    });

    if (response.data && response.data.length > 0) {
      const result = response.data[0];
      const addressDetails = result.address;
      
      // Extract county from the address details
      let county = addressDetails.county || '';
      county = county.replace(' County', '').toLowerCase();

      return {
        lat: parseFloat(result.lat),
        lon: parseFloat(result.lon),
        county: county,
        municipality: addressDetails.city || addressDetails.town || addressDetails.village || '',
        fullAddress: result.display_name
      };
    }
    
    throw new Error('Address not found');
  } catch (error) {
    console.error('Geocoding error:', error.message);
    throw new Error('Failed to geocode address');
  }
}

// Query county GIS for parcel data with 50m radius buffer
async function queryCountyGIS(county, lat, lon) {
  const config = countyConfigs[county];
  
  if (!config) {
    throw new Error(`County "${county}" not yet configured`);
  }

  try {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Querying ${county.toUpperCase()} County GIS at ${lat}, ${lon}...`);
    console.log(`GIS URL: ${config.gisUrl}`);
    
    // Create 50 meter buffer around point (approximately 0.00045 degrees at PA latitude)
    const bufferDegrees = 0.00045;
    const geometry = {
      xmin: lon - bufferDegrees,
      ymin: lat - bufferDegrees,
      xmax: lon + bufferDegrees,
      ymax: lat + bufferDegrees,
      spatialReference: { wkid: 4326 }
    };

    const params = {
      geometry: JSON.stringify(geometry),
      geometryType: 'esriGeometryEnvelope',
      inSR: 4326,
      spatialRel: 'esriSpatialRelIntersects',
      outFields: '*',
      returnGeometry: false,
      f: 'json'
    };

    const queryString = new URLSearchParams(params).toString();
    const fullUrl = `${config.gisUrl}?${queryString}`;
    console.log(`Full query URL: ${fullUrl.substring(0, 150)}...`);

    const response = await axios.get(config.gisUrl, { 
      params,
      timeout: 10000 
    });

    console.log('GIS Response:', JSON.stringify(response.data).substring(0, 200));

    if (response.data.error) {
      console.log('GIS returned error:', response.data.error);
      throw new Error(`GIS Error: ${response.data.error.message}`);
    }

    if (!response.data.features || response.data.features.length === 0) {
      console.log('No parcels found in response');
      throw new Error('No parcel found at this location');
    }

    const feature = response.data.features[0];
    const attrs = feature.attributes;

    // Log all available fields from the response
    console.log('\n--- Available Fields in GIS Response ---');
    console.log('Field count:', Object.keys(attrs).length);
    console.log('Sample fields:', Object.keys(attrs).slice(0, 20).join(', '));
    
    // Log the actual values we're trying to extract
    console.log('\n--- Field Value Extraction ---');
    const fieldMappings = {
      parcelId: getFieldValue(attrs, config.fields.parcelId),
      owner: getFieldValue(attrs, config.fields.owner),
      address: getFieldValue(attrs, config.fields.address),
      municipality: getFieldValue(attrs, config.fields.municipality),
      acres: getFieldValue(attrs, config.fields.acres),
      landUse: getFieldValue(attrs, config.fields.landUse),
      zoning: getFieldValue(attrs, config.fields.zoning),
      assessment: getFieldValue(attrs, config.fields.assessment)
    };

    Object.entries(fieldMappings).forEach(([key, value]) => {
      const fields = config.fields[key];
      const foundField = fields.find(f => attrs[f] !== undefined);
      console.log(`${key}: "${value}" (from field: ${foundField || 'NOT FOUND'})`);
    });

    console.log('='.repeat(60) + '\n');

    return {
      parcelId: fieldMappings.parcelId || 'Unknown',
      owner: fieldMappings.owner || 'Unknown',
      situs: fieldMappings.address || 'Unknown',
      municipality: fieldMappings.municipality || 'Unknown',
      acres: fieldMappings.acres || 'Unknown',
      landUse: fieldMappings.landUse || 'Unknown',
      zoning: fieldMappings.zoning || 'Unknown',
      assessment: fieldMappings.assessment || 0,
      dataSource: 'Real GIS Data'
    };

  } catch (error) {
    console.error(`GIS Query Error for ${county}:`, error.message);
    throw error;
  }
}

// Main lookup endpoint
app.post('/api/lookup', async (req, res) => {
  try {
    const { address } = req.body;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    console.log(`\n${'*'.repeat(60)}`);
    console.log(`Looking up: ${address}`);
    
    // Step 1: Geocode the address
    const geocodeResult = await geocodeAddress(address);
    console.log(`Found in ${geocodeResult.county} County`);
    
    // Step 2: Query county GIS
    const parcelData = await queryCountyGIS(
      geocodeResult.county,
      geocodeResult.lat,
      geocodeResult.lon
    );

    console.log(`Retrieved parcel ${parcelData.parcelId}`);
    console.log('*'.repeat(60) + '\n');

    // Return combined result
    res.json({
      geocode: geocodeResult,
      parcel: parcelData
    });

  } catch (error) {
    console.error('Lookup error:', error.message);
    res.status(500).json({ 
      error: error.message,
      details: 'Check server logs for more information'
    });
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'online',
    counties: Object.keys(countyConfigs),
    timestamp: new Date().toISOString()
  });
});

// Serve static frontend
app.use(express.static('public'));

// Frontend HTML
app.get('/', (req, res) => {
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PA Property Lookup System</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <style>
        .log-entry { padding: 0.5rem; border-left: 3px solid #3b82f6; margin-bottom: 0.5rem; }
        .log-success { border-color: #10b981; background-color: #d1fae5; }
        .log-error { border-color: #ef4444; background-color: #fee2e2; }
        .log-info { border-color: #3b82f6; background-color: #dbeafe; }
    </style>
</head>
<body class="bg-gray-50">
    <div class="max-w-5xl mx-auto p-8">
        <div class="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">PA Property Lookup System</h1>
            <p class="text-gray-600 mb-6">Horst Signs - Automated Property Research</p>
            
            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                <p class="text-green-800 font-semibold">✓ System Online: Free County GIS Integration Active</p>
            </div>

            <div class="mb-6">
                <label class="block text-sm font-semibold text-gray-700 mb-2">Property Address (Pennsylvania)</label>
                <input 
                    type="text" 
                    id="addressInput"
                    placeholder="e.g., 633 Court St, Reading, PA 19601"
                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
            </div>

            <button 
                id="lookupBtn"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center"
            >
                <span id="btnText">Lookup Property</span>
            </button>
        </div>

        <div id="statusLog" class="bg-white rounded-lg shadow-lg p-6 mb-6 hidden">
            <h3 class="text-lg font-semibold text-gray-800 mb-4">System Log</h3>
            <div id="logContent" class="space-y-2 font-mono text-sm"></div>
        </div>

        <div id="resultsContainer" class="bg-white rounded-lg shadow-lg p-8 hidden">
            <div class="flex justify-between items-center mb-6">
                <h2 class="text-2xl font-bold text-gray-800">Property Details - <span id="countyBadge" class="text-blue-600"></span></h2>
            </div>
            
            <div id="propertyGrid" class="grid grid-cols-2 gap-6"></div>
        </div>

        <div class="mt-6 flex gap-4">
            <button id="saveBtn" class="hidden flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">
                Save Report
            </button>
            <button id="printBtn" class="hidden flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">
                Print
            </button>
            <button onclick="clearResults()" class="hidden flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition duration-200" id="clearBtn">
                Clear
            </button>
        </div>
    </div>

    <script>
        function addLog(message, type = 'info') {
            const logContent = document.getElementById('logContent');
            const logEntry = document.createElement('div');
            logEntry.className = 'log-entry log-' + type;
            logEntry.textContent = message;
            logContent.appendChild(logEntry);
            logContent.scrollTop = logContent.scrollHeight;
        }

        function showError(message) {
            addLog('✗ Error: ' + message, 'error');
        }

        async function lookupProperty() {
            const address = document.getElementById('addressInput').value.trim();
            
            if (!address) {
                alert('Please enter an address');
                return;
            }

            const btn = document.getElementById('lookupBtn');
            const btnText = document.getElementById('btnText');
            
            btn.disabled = true;
            btnText.textContent = 'Looking up...';
            
            document.getElementById('resultsContainer').classList.add('hidden');
            document.getElementById('statusLog').classList.remove('hidden');
            document.getElementById('logContent').innerHTML = '';
            
            addLog('Starting lookup...', 'info');
            addLog('Address: ' + address, 'info');

            try {
                const response = await fetch('/api/lookup', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ address })
                });

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(result.error || 'Lookup failed');
                }

                addLog('✓ Located in ' + result.geocode.county + ' County', 'success');
                addLog('✓ Retrieved parcel ' + result.parcel.parcelId, 'success');
                
                if (result.parcel.dataSource === 'Real GIS Data') {
                    addLog('✓ Using REAL county GIS data', 'success');
                }
                
                addLog('✅ Complete!', 'success');

                displayResults(result);

            } catch (error) {
                showError(error.message);
            } finally {
                btn.disabled = false;
                btnText.textContent = 'Lookup Property';
            }
        }

        function displayResults(data) {
            document.getElementById('countyBadge').textContent = data.geocode.county + ' County';

            const details = [
                { label: 'Address', value: data.parcel.situs },
                { label: 'Township', value: data.parcel.municipality },
                { label: 'Parcel ID', value: data.parcel.parcelId },
                { label: 'Size', value: data.parcel.acres ? data.parcel.acres + ' acres' : 'N/A' },
                { label: 'Zoning', value: data.parcel.zoning },
                { label: 'Owner', value: data.parcel.owner },
                { label: 'Land Use', value: data.parcel.landUse },
                { label: 'Assessment', value: data.parcel.assessment ? '$' + data.parcel.assessment.toLocaleString() : 'N/A' },
                { label: 'Data Source', value: data.parcel.dataSource || 'Demo' }
            ];

            document.getElementById('propertyGrid').innerHTML = details.map(item => 
                '<div>' +
                    '<p class="text-sm text-gray-600">' + item.label + '</p>' +
                    '<p class="font-semibold text-gray-800">' + item.value + '</p>' +
                '</div>'
            ).join('');

            document.getElementById('resultsContainer').classList.remove('hidden');
            document.getElementById('saveBtn').classList.remove('hidden');
            document.getElementById('printBtn').classList.remove('hidden');
            document.getElementById('clearBtn').classList.remove('hidden');
        }

        function clearResults() {
            document.getElementById('resultsContainer').classList.add('hidden');
            document.getElementById('addressInput').value = '';
            document.getElementById('logContent').innerHTML = '';
            document.getElementById('statusLog').classList.add('hidden');
            document.getElementById('saveBtn').classList.add('hidden');
            document.getElementById('printBtn').classList.add('hidden');
            document.getElementById('clearBtn').classList.add('hidden');
        }

        document.getElementById('lookupBtn').addEventListener('click', lookupProperty);
        document.getElementById('addressInput').addEventListener('keypress', e => {
            if (e.key === 'Enter') lookupProperty();
        });

        document.getElementById('saveBtn').addEventListener('click', () => {
            alert('Save functionality coming soon!');
        });

        document.getElementById('printBtn').addEventListener('click', () => {
            window.print();
        });
    </script>
</body>
</html>
  `);
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 PA Property Lookup Backend Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('County GIS Integration with 50m radius buffer');
  console.log(`Configured counties: ${Object.keys(countyConfigs).join(', ')}`);
  console.log('='.repeat(60));
});
