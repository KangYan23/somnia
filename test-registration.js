// Test the price threshold registration with decimal prices
const testData = {
  phone: "0177163313",
  tokenSymbol: "STT", 
  minPrice: "0.3105",
  maxPrice: "0.3107"
};

console.log("Testing price threshold registration...");
console.log("Input data:", testData);

fetch("http://localhost:3000/api/register-price-threshold", {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
  body: JSON.stringify(testData)
})
.then(response => response.json())
.then(result => {
  console.log("✅ Registration result:", result);
})
.catch(error => {
  console.error("❌ Registration error:", error);
});