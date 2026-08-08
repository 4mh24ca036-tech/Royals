/**
 * Test script to verify API returns products
 */

async function testAPI() {
  try {
    console.log('Testing API at http://localhost:3030/api/products');
    const response = await fetch('http://localhost:3030/api/products');
    const data = await response.json();
    
    console.log(`Status: ${response.status}`);
    console.log(`Products received: ${Array.isArray(data) ? data.length : 'not an array'}`);
    
    if (Array.isArray(data) && data.length > 0) {
      console.log('\nFirst product sample:');
      console.log(JSON.stringify(data[0], null, 2));
    }
    
  } catch (error) {
    console.error('API test failed:', error);
  }
}

testAPI();
