// Test sell response parsing
const exampleResponse = {
  "status": "success",
  "response": {
    "errorMsg": "",
    "orderID": "0x71e5042050c723571bf3b7b07c42fd12d40484e642637fc01f1946737d3b2ea5",
    "takingAmount": "4.99372",
    "makingAmount": "5.24",
    "status": "matched",
    "transactionsHashes": ["0x766f17550c72a32edc853db920ab2924351eb0b043b982e14cbd67ed00945fb6"],
    "success": true,
    "actual_status": "MATCHED",
    "size_matched": "5.24"
  }
};

console.log('Testing sell response parsing...\n');
console.log('Raw response:', JSON.stringify(exampleResponse, null, 2));

// Check if it's a success (our new logic)
const isSuccess = exampleResponse.status === 'success' &&
                 exampleResponse.response?.success === true &&
                 (!exampleResponse.response?.errorMsg || exampleResponse.response.errorMsg === '');

console.log('\n✅ Is Success:', isSuccess);
console.log('Status:', exampleResponse.status);
console.log('Response Success:', exampleResponse.response?.success);
console.log('Error Message:', exampleResponse.response?.errorMsg || '(empty)');
console.log('Size Matched:', exampleResponse.response?.size_matched);

// Normalized response (what our API will return)
const normalizedResponse = {
  success: isSuccess,
  status: exampleResponse.status,
  response: exampleResponse.response,
  error: exampleResponse.response?.errorMsg || null,
  orderID: exampleResponse.response?.orderID,
  size_matched: exampleResponse.response?.size_matched,
  actual_status: exampleResponse.response?.actual_status
};

console.log('\n📦 Normalized Response:', JSON.stringify(normalizedResponse, null, 2));

// What the UI will display
if (normalizedResponse.success) {
  const sizeMatched = normalizedResponse.size_matched ? parseFloat(normalizedResponse.size_matched).toFixed(2) : '0.00';
  console.log(`\n✅ UI Message: Successfully sold ${sizeMatched} shares`);
} else {
  const errorDetail = normalizedResponse.error && normalizedResponse.error !== ''
    ? normalizedResponse.error
    : 'Unknown error';
  console.log(`\n❌ UI Message: Failed to sell: ${errorDetail}`);
}
