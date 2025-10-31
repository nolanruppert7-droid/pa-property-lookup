async function queryRegridParcel(lat, lon) {
  // Check if this is a PA location (approximate bounds)
  const isPA = lat >= 39.5 && lat <= 42.5 && lon >= -80.5 && lon <= -74.5;
  
  if (isPA) {
    // Use demo mode for PA since trial doesn't cover PA
    console.log('Using DEMO mode for PA location');
    return generateDemoParcelData(lat, lon);
  }
  
  // Try real Regrid API for non-PA locations
  const url = `https://app.regrid.com/api/v2/parcels/point?lat=${lat}&lon=${lon}&token=${REGRID_API_KEY}&return_geometry=false`;
  
  console.log('Calling Regrid API');
  
  const response = await fetch(url, {
    headers: { 'User-Agent': 'HorstSigns-PropertyLookup/1.0' }
  });
  
  console.log('Regrid response status:', response.status);
  
  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(`Regrid API failed with status ${response.status}`);
  }
  
  if (!data.parcels || !data.parcels.features || data.parcels.features.length === 0) {
    throw new Error('No parcel found at this location');
  }
  
  const parcel = data.parcels.features[0];
  const props = parcel.properties;
  const fields = props.fields || {};
  
  return {
    parcelId: fields.parcelnumb || fields.parcel_id || 'N/A',
    owner: fields.owner || 'N/A',
    acres: fields.ll_gisacre || fields.acres || null,
    zoning: fields.zoning || 'N/A',
    municipality: fields.city || fields.usps_city || props.context?.name || 'Unknown',
    situs: fields.address || props.headline || 'N/A',
    landUse: fields.usedesc || fields.usecd || 'N/A',
    assessment: fields.saleprice || null,
    county: props.context?.name || 'Unknown',
    rawAttributes: fields
  };
}

function generateDemoParcelData(lat, lon) {
  // Generate realistic demo data based on coordinates
  const parcelNum = Math.floor(100000 + Math.random() * 900000);
  const acres = (Math.random() * 5 + 0.5).toFixed(2);
  
  const owners = ['ABC Development LLC', 'Lancaster Properties Inc', 'Smith Family Trust', 'Johnson & Associates', 'Heritage Realty Group', 'Keystone Holdings LLC'];
  const zoningTypes = ['C-2 (General Commercial)', 'C-1 (Neighborhood Commercial)', 'R-2 (Medium Density Residential)', 'R-3 (High Density Residential)', 'I-1 (Light Industrial)', 'M-1 (Manufacturing)'];
  const landUses = ['Commercial', 'Residential', 'Industrial', 'Mixed Use', 'Retail', 'Office'];
  
  // Determine likely municipality based on lat/lon
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
