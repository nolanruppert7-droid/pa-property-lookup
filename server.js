const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
const PORT = process.env.PORT || 3001;
const REGRID_API_KEY = 'eyJhbGciOiJIUzI1NiJ9.eyJpc3MiOiJyZWdyaWQuY29tIiwiaWF0IjoxNzYxOTM0MzkyLCJleHAiOjE3NjQ1MjYzOTIsInUiOjYxMDU0MiwiZyI6MjMxNTMsImNhcCI6InBhOnRzOnBzOmJmOm1hOnR5OmVvOnpvOnNiIn0.MoiAdpAR5vWZ1Ljopx425qmRSJoIhd3CntQJBP5_ScE';

app.use(cors());
app.use(express.json());

async function geocodeAddress(address) {
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address + ', Pennsylvania, USA')}&limit=1&addressdetails=1`;
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HorstSigns-PropertyLookup/1.0' }
  });
  
  if (!response.ok) throw new Error('Geocoding service unavailable');
  
  const data = await response.json();
  if (data.length === 0) throw new Error('Address not found in Pennsylvania');
  
  const result = data[0];
  const county = result.address.county?.replace(' County', '');
  
  if (!county) throw new Error('Could not determine county from address');
  
  return {
    lat: parseFloat(result.lat),
    lon: parseFloat(result.lon),
    county: county,
    displayName: result.display_name,
    city: result.address.city || result.address.town || result.address.village || result.address.municipality
  };
}

function generateDemoParcelData(lat, lon) {
  const parcelNum = Math.floor(100000 + Math.random() * 900000);
  const acres = (Math.random() * 5 + 0.5).toFixed(2);
  
  const owners = ['ABC Development LLC', 'Lancaster Properties Inc', 'Smith Family Trust', 'Johnson & Associates', 'Heritage Realty Group', 'Keystone Holdings LLC'];
  const zoningTypes = ['C-2 (General Commercial)', 'C-1 (Neighborhood Commercial)', 'R-2 (Medium Density Residential)', 'R-3 (High Density Residential)', 'I-1 (Light Industrial)', 'M-1 (Manufacturing)'];
  const landUses = ['Commercial', 'Residential', 'Industrial', 'Mixed Use', 'Retail', 'Office'];
  
  let municipality = 'Lancaster Township';
  if (lat > 40.05) municipality = 'Manheim Township';
  if (lat < 39.95) municipality = 'West Hempfield Township';
  if (lon > -76.25) municipality = 'East Hempfield Township';
  if (lat > 40.03 && lat < 40.045 && lon > -76.31 && lon < -76.29) municipality = 'Lancaster City';
  
  return {
    parcelId: `410-${parcelNum}-0-0000`,
    owner: owners[Math.floor(Math.random() * owners.length)],
    acres: acres,
    zoning: zoningTypes[Math.floor(Math.random() * zoningTypes.length)],
    municipality: municipality,
    situs: 'Property Address (Demo Data)',
    landUse: landUses[Math.floor(Math.random() * landUses.length)],
    assessment: Math.floor(Math.random() * 500000 + 200000),
    county: 'Lancaster County'
  };
}

async function queryRegridParcel(lat, lon) {
  const isPA = lat >= 39.5 && lat <= 42.5 && lon >= -80.5 && lon <= -74.5;
  
  if (isPA) {
    console.log('Using DEMO mode for PA location');
    return generateDemoParcelData(lat, lon);
  }
  
  const url = `https://app.regrid.com/api/v2/parcels/point?lat=${lat}&lon=${lon}&token=${REGRID_API_KEY}&return_geometry=false`;
  
  console.log('Calling Regrid API');
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HorstSigns-PropertyLookup/1.0' }
  });
  
  const data = await response.json();
  
  if (!response.ok || !data.parcels || !data.parcels.features || data.parcels.features.length === 0) {
    throw new Error('No parcel found at this location');
  }
  
  const parcel = data.parcels.features[0];
  const props = parcel.properties;
  const fields = props.fields || {};
  
  return {
    parcelId: fields.parcelnumb || 'N/A',
    owner: fields.owner || 'N/A',
    acres: fields.ll_gisacre || null,
    zoning: fields.zoning || 'N/A',
    municipality: fields.city || props.context?.name || 'Unknown',
    situs: fields.address || props.headline || 'N/A',
    landUse: fields.usedesc || 'N/A',
    assessment: fields.saleprice || null,
    county: props.context?.name || 'Unknown'
  };
}

app.post('/api/lookup-property', async (req, res) => {
  try {
    const { address } = req.body;
    if (!address) return res.status(400).json({ error: 'Address is required' });
    
    console.log(`Looking up: ${address}`);
    const geocodeResult = await geocodeAddress(address);
    console.log(`Found in ${geocodeResult.county} County`);
    
    const parcelData = await queryRegridParcel(geocodeResult.lat, geocodeResult.lon);
    console.log(`Retrieved parcel ${parcelData.parcelId}`);
    
    res.json({
      success: true,
      geocode: geocodeResult,
      parcel: parcelData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>PA Property Lookup - Horst Signs</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gradient-to-br from-blue-50 to-indigo-50 min-h-screen p-6">
    <div class="max-w-6xl mx-auto">
        <div class="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h1 class="text-3xl font-bold text-gray-800 mb-2">PA Property Lookup System</h1>
            <p class="text-sm text-gray-600 mb-6">Horst Signs - Automated Property Research</p>
            <div class="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <p class="text-sm text-blue-800"><strong>ℹ️ Demo Mode:</strong> Currently using demonstration data for Pennsylvania properties. Real data integration available upon Regrid API upgrade.</p>
            </div>
            <div class="mb-6">
                <label class="block text-sm font-medium text-gray-700 mb-2">Property Address</label>
                <div class="flex gap-4">
                    <input type="text" id="addressInput" placeholder="50 N Duke St, Lancaster, PA 17602" class="flex-1 px-4 py-3 border border-gray-300 rounded-lg"/>
                    <button id="lookupBtn" class="px-6 py-3 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700"><span id="btnText">Lookup Property</span></button>
                </div>
            </div>
            <div id="statusLog" class="hidden bg-gray-900 rounded-lg p-4 mb-6 max-h-48 overflow-y-auto"><h3 class="text-sm font-semibold text-gray-300 mb-2">System Log</h3><div id="logContent" class="space-y-1 text-xs font-mono text-gray-400"></div></div>
            <div id="errorDisplay" class="hidden bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6"><p class="font-semibold">Error</p><p id="errorText" class="text-sm"></p></div>
            <div id="resultsContainer" class="hidden space-y-6">
                <div class="bg-blue-50 rounded-lg p-6 border border-blue-200">
                    <h2 class="text-xl font-bold text-gray-800 mb-4">Property Details - <span id="countyBadge"></span></h2>
                    <div id="propertyGrid" class="grid grid-cols-2 gap-4"></div>
                </div>
                <div class="flex gap-4">
                    <button onclick="alert('Demo data displayed. Ready for production integration.')" class="flex-1 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700">Save Report</button>
                    <button onclick="window.print()" class="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700">Print</button>
                    <button onclick="clearResults()" class="px-6 py-3 bg-gray-400 text-white rounded-lg hover:bg-gray-500">Clear</button>
                </div>
            </div>
        </div>
        <div class="bg-white rounded-lg shadow-lg p-6">
            <h3 class="text-lg font-bold text-gray-800 mb-3">Example Addresses</h3>
            <div class="space-y-2 text-sm">
                <p class="cursor-pointer hover:text-indigo-600" onclick="useAddress('50 N Duke St, Lancaster, PA 17602')">• 50 N Duke St, Lancaster, PA 17602</p>
                <p class="cursor-pointer hover:text-indigo-600" onclick="useAddress('1 Park City Center, Lancaster, PA 17601')">• 1 Park City Center, Lancaster, PA 17601</p>
                <p class="cursor-pointer hover:text-indigo-600" onclick="useAddress('333 Market St, Harrisburg, PA 17101')">• 333 Market St, Harrisburg, PA 17101</p>
            </div>
        </div>
    </div>
    <script>
        function useAddress(addr){document.getElementById('addressInput').value=addr;}
        function addLog(msg,type='info'){const log=document.getElementById('logContent'),div=document.getElementById('statusLog');div.classList.remove('hidden');const colors={info:'text-blue-400',success:'text-green-400',error:'text-red-400'},entry=document.createElement('div');entry.className=colors[type]||'text-gray-400';entry.textContent='['+new Date().toLocaleTimeString()+'] '+msg;log.appendChild(entry);log.scrollTop=log.scrollHeight;}
        function showError(msg){document.getElementById('errorDisplay').classList.remove('hidden');document.getElementById('errorText').textContent=msg;addLog('Error: '+msg,'error');}
        function hideError(){document.getElementById('errorDisplay').classList.add('hidden');}
        async function lookupProperty(){const address=document.getElementById('addressInput').value.trim();if(!address){showError('Please enter an address');return;}hideError();document.getElementById('resultsContainer').classList.add('hidden');document.getElementById('logContent').innerHTML='';const btn=document.getElementById('lookupBtn'),btnText=document.getElementById('btnText');btn.disabled=true;btnText.textContent='Processing...';try{addLog('🚀 Starting lookup...','info');const response=await fetch('/api/lookup-property',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({address})});if(!response.ok){const errorData=await response.json();throw new Error(errorData.error||'Lookup failed');}const result=await response.json();if(!result.success)throw new Error(result.error||'Lookup failed');addLog('✓ Located in '+result.geocode.county+' County','success');addLog('✓ Retrieved parcel '+result.parcel.parcelId,'success');addLog('✅ Complete!','success');displayResults(result);}catch(error){showError(error.message);}finally{btn.disabled=false;btnText.textContent='Lookup Property';}}
        function displayResults(data){document.getElementById('countyBadge').textContent=data.geocode.county+' County';const details=[{label:'Address',value:data.parcel.situs},{label:'Township',value:data.parcel.municipality},{label:'Parcel ID',value:data.parcel.parcelId},{label:'Size',value:data.parcel.acres+' acres'},{label:'Zoning',value:data.parcel.zoning},{label:'Owner',value:data.parcel.owner},{label:'Land Use',value:data.parcel.landUse},{label:'Assessment',value:'$'+data.parcel.assessment.toLocaleString()}];document.getElementById('propertyGrid').innerHTML=details.map(item=>'<div><p class="text-sm text-gray-600">'+item.label+'</p><p class="font-semibold text-gray-800">'+item.value+'</p></div>').join('');document.getElementById('resultsContainer').classList.remove('hidden');}
        function clearResults(){document.getElementById('resultsContainer').classList.add('hidden');document.getElementById('addressInput').value='';document.getElementById('logContent').innerHTML='';document.getElementById('statusLog').classList.add('hidden');}
        document.getElementById('lookupBtn').addEventListener('click',lookupProperty);document.getElementById('addressInput').addEventListener('keypress',e=>{if(e.key==='Enter')lookupProperty();});
    </script>
</body>
</html>`);
});

app.listen(PORT, () => {
  console.log('='.repeat(60));
  console.log('🚀 PA Property Lookup Backend Server');
  console.log('='.repeat(60));
  console.log(`Server running on http://localhost:${PORT}`);
  console.log('Demo mode active for PA locations');
  console.log('='.repeat(60));
});
