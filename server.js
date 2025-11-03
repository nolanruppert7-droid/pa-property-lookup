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
  },
  dauphin: {
    gisUrl: 'https://gis.dauphincounty.org/arcgis/rest/services/Parcels/MapServer/1/query',
    assessmentTableUrl: 'https://services1.arcgis.com/1zLkDAflTb7WLLps/arcgis/rest/services/Parcel_Characteristics/FeatureServer/0/query',
    twoStepLookup: true,
    fields: {
      parcelId: ['PID', 'PARID', 'PIN', 'PARCEL_ID'],
      propertyId: ['property_id'],
      owner: ['OWNER', 'OWNER_NAME', 'OWNERNAME'],
      address: ['street_name', 'SITUS', 'SITE_ADDR', 'LOCATION'],
      municipality: ['MUNICIPALITY', 'MUNI', 'MUNI_NAME'],
      acres: ['acres', 'ACRES', 'ACREAGE', 'GIS_ACRES'],
      landUse: ['LANDUSE', 'LAND_USE', 'USE_CODE'],
      zoning: ['ZONING', 'ZONE', 'ZONE_CLASS'],
      assessment: ['land', 'building', 'TOTVAL', 'TOTAL_VAL']
    },
    assessmentFields: {
      owner: ['owner_name', 'OWNER', 'OWNERNAME'],
      address: ['site_address', 'SITUS'],
      landUse: ['use_code', 'LANDUSE'],
      totalAssessment: ['total_value', 'TOTVAL']
    }
  }
};
function getFieldValue(attributes, possibleFields) {
  for (const field of possibleFields) {
    if (attributes[field] !== undefined && attributes[field] !== null && attributes[field] !== '') {
      return attributes[field];
    }
  }
  return null;
}

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

async function queryDauphinCounty(lat, lon) {
  const config = countyConfigs.dauphin;
  
  try {
    console.log('\n' + '='.repeat(60));
    console.log('Querying DAUPHIN County (Two-Step Lookup)');
    console.log('Step 1: Getting parcel geometry...');
    
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

    const parcelResponse = await axios.get(config.gisUrl, { params, timeout: 10000 });

    if (parcelResponse.data.error) {
      throw new Error('GIS Error: ' + parcelResponse.data.error.message);
    }

    if (!parcelResponse.data.features || parcelResponse.data.features.length === 0) {
      throw new Error('No parcel found at this location');
    }

    const parcelAttrs = parcelResponse.data.features[0].attributes;
    
    console.log('Step 1 Complete - Found parcel');
    console.log('Parcel ID:', getFieldValue(parcelAttrs, config.fields.parcelId));
    
    const propertyId = getFieldValue(parcelAttrs, config.fields.propertyId);
    console.log('Property ID for lookup:', propertyId);

    const baseData = {
      parcelId: getFieldValue(parcelAttrs, config.fields.parcelId) || 'Unknown',
      municipality: getFieldValue(parcelAttrs, config.fields.municipality) || 'Unknown',
      acres: getFieldValue(parcelAttrs, config.fields.acres) || 'Unknown',
      situs: getFieldValue(parcelAttrs, config.fields.address) || 'Unknown',
      assessment: getFieldValue(parcelAttrs, config.fields.assessment) || 0
    };

    if (!propertyId) {
      console.log('No property_id found - returning base data only');
      return {
        ...baseData,
        owner: 'Unknown',
        landUse: 'Unknown',
        zoning: 'Unknown',
        dataSource: 'Real GIS Data (Partial)'
      };
    }

    console.log('Step 2: Querying assessment table...');
    // TEST: Try multiple possible URLs
// TEST: Try multiple possible URLs
const testUrls = [
  'https://services1.arcgis.com/1zLkDAflTb7WLLps/arcgis/rest/services/Parcel_Characteristics/FeatureServer/0/query',
  'https://services1.arcgis.com/1zLkDAflTb7WLLps/arcgis/rest/services/Tax_Roll_Table/FeatureServer/0/query',
  'https://gis.dauphincounty.org/arcgis/rest/services/Assessment/MapServer/0/query'
];

for (const testUrl of testUrls) {
  console.log('Testing URL:', testUrl);
  try {
    // First, get the layer info to see available fields
    const infoUrl = testUrl.replace('/query', '?f=json');
    const infoResponse = await axios.get(infoUrl, { timeout: 5000 });
    
    if (infoResponse.data.fields) {
      console.log('SUCCESS! Layer has', infoResponse.data.fields.length, 'fields');
      console.log('Field names:', infoResponse.data.fields.map(f => f.name).slice(0, 15).join(', '));
      
      // Find fields that might contain PID
      const pidFields = infoResponse.data.fields.filter(f => 
        f.name.includes('PID') || f.name.includes('PARID') || f.name.includes('PARCEL')
      );
      console.log('PID-related fields:', pidFields.map(f => f.name).join(', '));
      break;
    }
  } catch (e) {
    console.log('Failed:', e.message);
  }
}
    
    const assessmentParams = {
  where: 'PID=\'' + propertyId + '\'',
  outFields: '*',
  f: 'json'
};

    try {
      const assessmentResponse = await axios.get(config.assessmentTableUrl, {
        params: assessmentParams,
        timeout: 10000
      });

      if (assessmentResponse.data.features && assessmentResponse.data.features.length > 0) {
        const assessAttrs = assessmentResponse.data.features[0].attributes;
        console.log('Step 2 Complete - Found owner data');
        
        return {
          ...baseData,
          owner: getFieldValue(assessAttrs, config.assessmentFields.owner) || 'Unknown',
          landUse: getFieldValue(assessAttrs, config.assessmentFields.landUse) || 'Unknown',
          zoning: 'Unknown',
          dataSource: 'Real GIS Data'
        };
      } else {
        console.log('Step 2: No assessment data found');
        return {
          ...baseData,
          owner: 'Unknown',
          landUse: 'Unknown',
          zoning: 'Unknown',
          dataSource: 'Real GIS Data (Partial)'
        };
      }
    } catch (assessError) {
      console.log('Step 2 Error:', assessError.message);
      return {
        ...baseData,
        owner: 'Unknown',
        landUse: 'Unknown',
        zoning: 'Unknown',
        dataSource: 'Real GIS Data (Partial)'
      };
    }

  } catch (error) {
    console.error('Dauphin County Query Error:', error.message);
    throw error;
  }
}
async function queryCountyGIS(county, lat, lon) {
  if (county === 'dauphin') {
    return await queryDauphinCounty(lat, lon);
  }

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

    const response = await axios.get(config.gisUrl, { params, timeout: 10000 });

    if (response.data.error) {
      throw new Error('GIS Error: ' + response.data.error.message);
    }

    if (!response.data.features || response.data.features.length === 0) {
      throw new Error('No parcel found at this location');
    }

    const attrs = response.data.features[0].attributes;

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

app.get('/api/health', function(req, res) {
  res.json({ 
    status: 'online',
    counties: Object.keys(countyConfigs),
    timestamp: new Date().toISOString()
  });
});

app.get('/', function(req, res) {
  res.send('<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0">\n<title>PA Property Lookup System</title>\n<script src="https://cdn.tailwindcss.com"></script>\n<style>.log-entry{padding:0.5rem;border-left:3px solid #3b82f6;margin-bottom:0.5rem}.log-success{border-color:#10b981;background-color:#d1fae5}.log-error{border-color:#ef4444;background-color:#fee2e2}.log-info{border-color:#3b82f6;background-color:#dbeafe}</style>\n</head>\n<body class="bg-gray-50">\n<div class="max-w-5xl mx-auto p-8">\n<div class="bg-white rounded-lg shadow-lg p-8 mb-6">\n<h1 class="text-3xl font-bold text-gray-800 mb-2">PA Property Lookup System</h1>\n<p class="text-gray-600 mb-6">Horst Signs - Automated Property Research</p>\n<div class="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">\n<p class="text-green-800 font-semibold">✓ System Online: Free County GIS Integration Active</p>\n</div>\n<div class="mb-6">\n<label class="block text-sm font-semibold text-gray-700 mb-2">Property Address (Pennsylvania)</label>\n<input type="text" id="addressInput" placeholder="e.g., 1241 E Chocolate Ave, Hershey, PA 17033" class="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"/>\n</div>\n<button id="lookupBtn" class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200 flex items-center justify-center">\n<span id="btnText">Lookup Property</span>\n</button>\n</div>\n<div id="statusLog" class="bg-white rounded-lg shadow-lg p-6 mb-6 hidden">\n<h3 class="text-lg font-semibold text-gray-800 mb-4">System Log</h3>\n<div id="logContent" class="space-y-2 font-mono text-sm"></div>\n</div>\n<div id="resultsContainer" class="bg-white rounded-lg shadow-lg p-8 hidden">\n<div class="flex justify-between items-center mb-6">\n<h2 class="text-2xl font-bold text-gray-800">Property Details - <span id="countyBadge" class="text-blue-600"></span></h2>\n</div>\n<div id="propertyGrid" class="grid grid-cols-2 gap-6"></div>\n</div>\n<div class="mt-6 flex gap-4">\n<button id="saveBtn" class="hidden flex-1 bg-green-600 hover:bg-green-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">Save Report</button>\n<button id="printBtn" class="hidden flex-1 bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-6 rounded-lg transition duration-200">Print</button>\n<button onclick="clearResults()" class="hidden flex-1 bg-gray-400 hover:bg-gray-500 text-white font-semibold py-3 px-6 rounded-lg transition duration-200" id="clearBtn">Clear</button>\n</div>\n</div>\n<script>\nfunction addLog(message,type){type=type||"info";var logContent=document.getElementById("logContent");var logEntry=document.createElement("div");logEntry.className="log-entry log-"+type;logEntry.textContent=message;logContent.appendChild(logEntry);logContent.scrollTop=logContent.scrollHeight}\nfunction showError(message){addLog("✗ Error: "+message,"error")}\nasync function lookupProperty(){var address=document.getElementById("addressInput").value.trim();if(!address){alert("Please enter an address");return}var btn=document.getElementById("lookupBtn");var btnText=document.getElementById("btnText");btn.disabled=true;btnText.textContent="Looking up...";document.getElementById("resultsContainer").classList.add("hidden");document.getElementById("statusLog").classList.remove("hidden");document.getElementById("logContent").innerHTML="";addLog("Starting lookup...","info");addLog("Address: "+address,"info");try{var response=await fetch("/api/lookup",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({address:address})});var result=await response.json();if(!response.ok){throw new Error(result.error||"Lookup failed")}addLog("✓ Located in "+result.geocode.county+" County","success");addLog("✓ Retrieved parcel "+result.parcel.parcelId,"success");if(result.parcel.dataSource==="Real GIS Data"){addLog("✓ Using REAL county GIS data","success")}addLog("✅ Complete!","success");displayResults(result)}catch(error){showError(error.message)}finally{btn.disabled=false;btnText.textContent="Lookup Property"}}\nfunction displayResults(data){document.getElementById("countyBadge").textContent=data.geocode.county+" County";var details=[{label:"Address",value:data.parcel.situs},{label:"Township",value:data.parcel.municipality},{label:"Parcel ID",value:data.parcel.parcelId},{label:"Size",value:data.parcel.acres?data.parcel.acres+" acres":"N/A"},{label:"Zoning",value:data.parcel.zoning},{label:"Owner",value:data.parcel.owner},{label:"Land Use",value:data.parcel.landUse},{label:"Assessment",value:data.parcel.assessment?"$"+data.parcel.assessment.toLocaleString():"N/A"},{label:"Data Source",value:data.parcel.dataSource||"Demo"}];document.getElementById("propertyGrid").innerHTML=details.map(function(item){return"<div>"+"<p class=\\"text-sm text-gray-600\\">"+item.label+"</p>"+"<p class=\\"font-semibold text-gray-800\\">"+item.value+"</p>"+"</div>"}).join("");document.getElementById("resultsContainer").classList.remove("hidden");document.getElementById("saveBtn").classList.remove("hidden");document.getElementById("printBtn").classList.remove("hidden");document.getElementById("clearBtn").classList.remove("hidden")}\nfunction clearResults(){document.getElementById("resultsContainer").classList.add("hidden");document.getElementById("addressInput").value="";document.getElementById("logContent").innerHTML="";document.getElementById("statusLog").classList.add("hidden");document.getElementById("saveBtn").classList.add("hidden");document.getElementById("printBtn").classList.add("hidden");document.getElementById("clearBtn").classList.add("hidden")}\ndocument.getElementById("lookupBtn").addEventListener("click",lookupProperty);document.getElementById("addressInput").addEventListener("keypress",function(e){if(e.key==="Enter")lookupProperty()});document.getElementById("saveBtn").addEventListener("click",function(){alert("Save functionality coming soon!")});document.getElementById("printBtn").addEventListener("click",function(){window.print()})\n</script>\n</body>\n</html>');
});

app.listen(PORT, function() {
  console.log('='.repeat(60));
  console.log('🚀 PA Property Lookup Backend Server');
  console.log('='.repeat(60));
  console.log('Server running on http://localhost:' + PORT);
  console.log('County GIS Integration with Two-Step Dauphin Lookup');
  console.log('Configured counties: ' + Object.keys(countyConfigs).join(', '));
  console.log('='.repeat(60));
});





