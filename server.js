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
      parcelId: ['PIN', 'PROPID', 'PARID', 'PIN_NUM'],
      owner: ['NAME1', 'WBNAME', 'OWNER', 'OWNERNAME1'],
      address: ['FULLMAILADDRESS', 'DESCR1', 'WBLOCN', 'SITUS', 'LOCATION'],
      municipality: ['MUNI', 'MUNI_NAME', 'MUNICIPAL'],
      acres: ['ACREAGE', 'ACRES', 'CALC_ACRE'],
      landUse: ['LANDUSE', 'LAND_USE', 'USE_CODE', 'CLASS'],
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
  },
dauphin: {
    gisUrl: 'https://gis.dauphincounty.org/arcgis/rest/services/Parcels/MapServer/1/query',
    fields: {
      parcelId: ['PARID', 'PID', 'PIN', 'PARCEL_ID'],
      owner: ['OWNER', 'OWNER_NAME', 'OWNERNAME', 'NAME1'],
      address: ['SITUS', 'SITE_ADDR', 'LOCATION', 'PROP_ADDR'],
      municipality: ['MUNI', 'MUNICIPAL', 'MUNI_NAME', 'MUNICIPALITY'],
      acres: ['ACRES', 'ACREAGE', 'CALC_ACRE', 'GIS_ACRES'],
      landUse: ['LANDUSE', 'LAND_USE', 'USE_CODE', 'USE_DESC'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['TOTVAL', 'TOTAL_VAL', 'ASSESS_TOT']
    }
  },
  lebanon: {
    gisUrl: 'https://services1.arcgis.com/xaMeopcWaPbefZG7/arcgis/rest/services/Parcels/FeatureServer/0/query',
    fields: {
      parcelId: ['PARCEL_ID', 'PIN', 'PARID', 'PID'],
      owner: ['OWNER', 'OWNER_NAME', 'OWNERNAME1'],
      address: ['SITUS', 'SITE_ADDR', 'LOCATION', 'PROP_ADDR'],
      municipality: ['MUNI', 'MUNICIPAL', 'MUNI_NAME'],
      acres: ['ACRES', 'ACREAGE', 'CALC_ACRE', 'GIS_ACRES'],
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

// Geocoding endpoint
async function geocodeAddress(address) {
  try {
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

// Query county GIS for parcel data
async function queryCountyGIS(county, lat, lon) {
  const config = countyConfigs[county];
  
  if (!config) {
    throw new Error('County "' + county + '" not yet configured');
  }

  try {
    console.log('\n' + '='.repeat(60));
    console.log('Querying ' + county.toUpperCase() + ' County GIS at ' + lat + ', ' + lon + '...');
    console.log('GIS URL: ' + config.gisUrl);
    
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
    const fullUrl = config.gisUrl + '?' + queryString;
    console.log('Full query URL: ' + fullUrl.substring(0, 150) + '...');

    const response = await axios.get(config.gisUrl, { 
      params,
      timeout: 10000 
    });

    console.log('GIS Response: ' + JSON.stringify(response.data).substring(0, 200));

    if (response.data.error) {
      console.log('GIS returned error:', response.data.error);
      throw new Error('GIS Error: ' + response.data.error.message);
    }

    if (!response.data.features || response.data.features.length === 0) {
      console.log('No parcels found in response');
      throw new Error('No parcel found at this location');
    }

    const feature = response.data.features[0];
    const attrs = feature.attributes;

    console.log('\n--- Available Fields in GIS Response ---');
    console.log('Field count:', Object.keys(attrs).length);
    console.log('Sample fields:', Object.keys(attrs).slice(0, 20).join(', '));
    
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

    Object.entries(fieldMappings).forEach(function(entry) {
      const key = entry[0];
      const value = entry[1];
      const fields = config.fields[key];
      const foundField = fields.find(function(f) { return attrs[f] !== undefined; });
      console.log(key + ': "' + value + '" (from field: ' + (foundField || 'NOT FOUND') + ')');
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
    console.error('GIS Query Error for ' + county + ':', error.message);
    throw error;
  }
}

// Main lookup endpoint
app.post('/api/lookup', async function(req, res) {
  try {
    const address = req.body.address;
    
    if (!address) {
      return res.status(400).json({ error: 'Address is required' });
    }

    console.log('\n' + '*'.repeat(60));
    console.log('Looking up: ' + address);
    
    const geocodeResult = await geocodeAddress(address);
    console.log('Found in ' + geocodeResult.county + ' County');
    
    const parcelData = await queryCountyGIS(
      geocodeResult.county,
      geocodeResult.lat,
      geocodeResult.lon
    );

    console.log('Retrieved parcel ' + parcelData.parcelId);
    console.log('*'.repeat(60) + '\n');

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
app.get('/api/health', function(req, res) {
  res.json({ 
    status: 'online',
    counties: Object.keys(countyConfigs),
    timestamp: new Date().toISOString()
  });
});

// Serve frontend
app.get('/', function(req, res) {
  res.send('<!DOCTYPE html>\n' +
'<html lang="en">\n' +
'<head>\n' +
'    <meta charset="UTF-8">\n' +
'    <meta name="viewport" content="width=device-width, initial-scale=1.0">\n' +
'    <title>PA Property Lookup System</title>\n' +
'    <script src="https://cdn.tailwindcss.com"></script>\n' +
'    <style>\n' +
'        .log-entry { padding: 0.5rem; border-left: 3px solid #3b82f6; margin-bottom: 0.5rem; }\n' +
'        .log-success { border-color: #10b981; background-color: #d1fae5; }\n' +
'        .log-error { border-color: #ef4444; background-color: #fee2e2; }\n' +
'        .log-info { border-color: #3b82f6; background-color: #dbeafe; }\n' +
'    </style>\n' +
'</head>\n' +
'<body class="bg-gray-50">\n' +
'    <div class="max-w-5xl mx-auto p-8">\n' +
'        <div class="bg-white rounded-lg shadow-lg p-8 mb-6">\n' +
'            <h1 class="text-3xl font-bold text-gray-800 mb-2">PA Property Lookup System</h1>\n' +
'            <p class="text-gray-600 mb-6">Horst Signs - Automated Property Research</p>\n' +
'            \n' +
'            <div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">\n' +
'                <p class="text-green-800 font-semibold">✓ System Online: Free County GIS Integration Active</p>\n' +
'            </div>\n' +
'\n' +
'            <div class="mb-6">\n' +
'                <label class="block text-sm font-semibold text-gray-700 mb-2">Property Address (Pennsylvania)</label>\n' +
'                <input \n' +
'                    type="text" \n' +
'                    id="addressInput"\n' +
'                    placeholder="e.g., 633 Court St, Reading, PA 19601"\n' +
'                    class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"\n' +
'                />\n' +
'            </div>\n' +
'\n' +
'            <button \n' +
'                id="lookupBtn"\n' +
'                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center"\n' +
'            >\n' +
'                <span id="btnText">Lookup Property</span>\n' +
'            </button>\n' +
'        </div>\n' +
'\n' +
'        <div id="statusLog" class="bg-white rounded-lg shadow-lg p-6 mb-6 hidden">\n' +
'            <h3 class="text-lg font-semibold text-gray-800 mb-4">System Log</h3>\n' +
'            <div id="logContent" class="space-y-2 font-mono text-sm"></div>\n' +
'        </div>\n' +
'\n' +
'        <div id="resultsContainer" class="bg-white rounded-lg shadow-lg p-8 hidden">\n' +
'            <div class="flex justify-between items-center mb-6">\n' +
'                <h2 class="text-2xl font-bold text-gray-800">Property Details - <span id="countyBadge" class="text-blue-600"></span></h2>\n' +
'            </div>\n' +
'            \n' +
'            <div id="propertyGrid" class="grid grid-cols-2 gap-6"></div>\n' +
'        </div>\n' +
'\n' +
'        <div class="mt-6 flex gap-4">\n' +
'            <button id="saveBtn" class="hidden flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">\n' +
'                Save Report\n' +
'            </button>\n' +
'            <button id="printBtn" class="hidden flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">\n' +
'                Print\n' +
'            </button>\n' +
'            <button onclick="clearResults()" class="hidden flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition duration-200" id="clearBtn">\n' +
'                Clear\n' +
'            </button>\n' +
'        </div>\n' +
'    </div>\n' +
'\n' +
'    <script>\n' +
'        function addLog(message, type) {\n' +
'            type = type || "info";\n' +
'            var logContent = document.getElementById("logContent");\n' +
'            var logEntry = document.createElement("div");\n' +
'            logEntry.className = "log-entry log-" + type;\n' +
'            logEntry.textContent = message;\n' +
'            logContent.appendChild(logEntry);\n' +
'            logContent.scrollTop = logContent.scrollHeight;\n' +
'        }\n' +
'\n' +
'        function showError(message) {\n' +
'            addLog("✗ Error: " + message, "error");\n' +
'        }\n' +
'\n' +
'        async function lookupProperty() {\n' +
'            var address = document.getElementById("addressInput").value.trim();\n' +
'            \n' +
'            if (!address) {\n' +
'                alert("Please enter an address");\n' +
'                return;\n' +
'            }\n' +
'\n' +
'            var btn = document.getElementById("lookupBtn");\n' +
'            var btnText = document.getElementById("btnText");\n' +
'            \n' +
'            btn.disabled = true;\n' +
'            btnText.textContent = "Looking up...";\n' +
'            \n' +
'            document.getElementById("resultsContainer").classList.add("hidden");\n' +
'            document.getElementById("statusLog").classList.remove("hidden");\n' +
'            document.getElementById("logContent").innerHTML = "";\n' +
'            \n' +
'            addLog("Starting lookup...", "info");\n' +
'            addLog("Address: " + address, "info");\n' +
'\n' +
'            try {\n' +
'                var response = await fetch("/api/lookup", {\n' +
'                    method: "POST",\n' +
'                    headers: { "Content-Type": "application/json" },\n' +
'                    body: JSON.stringify({ address: address })\n' +
'                });\n' +
'\n' +
'                var result = await response.json();\n' +
'\n' +
'                if (!response.ok) {\n' +
'                    throw new Error(result.error || "Lookup failed");\n' +
'                }\n' +
'\n' +
'                addLog("✓ Located in " + result.geocode.county + " County", "success");\n' +
'                addLog("✓ Retrieved parcel " + result.parcel.parcelId, "success");\n' +
'                \n' +
'                if (result.parcel.dataSource === "Real GIS Data") {\n' +
'                    addLog("✓ Using REAL county GIS data", "success");\n' +
'                }\n' +
'                \n' +
'                addLog("✅ Complete!", "success");\n' +
'\n' +
'                displayResults(result);\n' +
'\n' +
'            } catch (error) {\n' +
'                showError(error.message);\n' +
'            } finally {\n' +
'                btn.disabled = false;\n' +
'                btnText.textContent = "Lookup Property";\n' +
'            }\n' +
'        }\n' +
'\n' +
'        function displayResults(data) {\n' +
'            document.getElementById("countyBadge").textContent = data.geocode.county + " County";\n' +
'\n' +
'            var details = [\n' +
'                { label: "Address", value: data.parcel.situs },\n' +
'                { label: "Township", value: data.parcel.municipality },\n' +
'                { label: "Parcel ID", value: data.parcel.parcelId },\n' +
'                { label: "Size", value: data.parcel.acres ? data.parcel.acres + " acres" : "N/A" },\n' +
'                { label: "Zoning", value: data.parcel.zoning },\n' +
'                { label: "Owner", value: data.parcel.owner },\n' +
'                { label: "Land Use", value: data.parcel.landUse },\n' +
'                { label: "Assessment", value: data.parcel.assessment ? "$" + data.parcel.assessment.toLocaleString() : "N/A" },\n' +
'                { label: "Data Source", value: data.parcel.dataSource || "Demo" }\n' +
'            ];\n' +
'\n' +
'            document.getElementById("propertyGrid").innerHTML = details.map(function(item) {\n' +
'                return "<div>" +\n' +
'                    "<p class=\\"text-sm text-gray-600\\">" + item.label + "</p>" +\n' +
'                    "<p class=\\"font-semibold text-gray-800\\">" + item.value + "</p>" +\n' +
'                "</div>";\n' +
'            }).join("");\n' +
'\n' +
'            document.getElementById("resultsContainer").classList.remove("hidden");\n' +
'            document.getElementById("saveBtn").classList.remove("hidden");\n' +
'            document.getElementById("printBtn").classList.remove("hidden");\n' +
'            document.getElementById("clearBtn").classList.remove("hidden");\n' +
'        }\n' +
'\n' +
'        function clearResults() {\n' +
'            document.getElementById("resultsContainer").classList.add("hidden");\n' +
'            document.getElementById("addressInput").value = "";\n' +
'            document.getElementById("logContent").innerHTML = "";\n' +
'            document.getElementById("statusLog").classList.add("hidden");\n' +
'            document.getElementById("saveBtn").classList.add("hidden");\n' +
'            document.getElementById("printBtn").classList.add("hidden");\n' +
'            document.getElementById("clearBtn").classList.add("hidden");\n' +
'        }\n' +
'\n' +
'        document.getElementById("lookupBtn").addEventListener("click", lookupProperty);\n' +
'        document.getElementById("addressInput").addEventListener("keypress", function(e) {\n' +
'            if (e.key === "Enter") lookupProperty();\n' +
'        });\n' +
'\n' +
'        document.getElementById("saveBtn").addEventListener("click", function() {\n' +
'            alert("Save functionality coming soon!");\n' +
'        });\n' +
'\n' +
'        document.getElementById("printBtn").addEventListener("click", function() {\n' +
'            window.print();\n' +
'        });\n' +
'    </script>\n' +
'</body>\n' +
'</html>');
});

app.listen(PORT, function() {
  console.log('='.repeat(60));
  console.log('🚀 PA Property Lookup Backend Server');
  console.log('='.repeat(60));
  console.log('Server running on http://localhost:' + PORT);
  console.log('County GIS Integration with 50m radius buffer');
  console.log('Configured counties: ' + Object.keys(countyConfigs).join(', '));
  console.log('='.repeat(60));
});





