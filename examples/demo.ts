/**
 * Example file demonstrating FlowDoc comment tags
 * Open the FlowDoc extension and run "FlowDoc: Pick Topic" to see this in action
 */

// ============================================
// Topic: User Registration (Multi-line format)
// ============================================

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-001
// @flowdoc-step: User accesses the registration page and fills out the form with email and password

function showRegistrationForm() {
  // Implementation here
}

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-002
// @flowdoc-step: Frontend validates the form fields (email format, password strength)
// @flowdoc-dependency: REG-001

function validateRegistrationForm(email: string, password: string): boolean {
  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return false;
  }

  // Validate password strength
  if (password.length < 8) {
    return false;
  }

  return true;
}

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-003
// @flowdoc-step: Submit registration data to the backend API
// @flowdoc-dependency: REG-002 [Only if validation passes]
// @flowdoc-links: file:examples/demo.ts:55; url:https://api.example.com/docs/register

async function submitRegistration(email: string, password: string) {
  const response = await fetch("/api/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return response.json();
}

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-004A
// @flowdoc-step: Registration successful - redirect to dashboard
// @flowdoc-dependency: REG-003 [If API returns success]

function redirectToDashboard() {
  window.location.href = "/dashboard";
}

// @flowdoc-topic: user-registration
// @flowdoc-id: REG-004B
// @flowdoc-step: Registration failed - show error message to user
// @flowdoc-dependency: REG-003 [If API returns error]

function showRegistrationError(message: string) {
  alert(`Registration failed: ${message}`);
}

// ============================================
// Topic: Payment Processing (Multi-line format)
// ============================================

// @flowdoc-topic: payment-processing
// @flowdoc-id: PAY-001
// @flowdoc-step: User initiates payment by clicking "Pay Now" button

function initializePayment() {
  // Show payment modal
}

// @flowdoc-topic: payment-processing
// @flowdoc-id: PAY-002
// @flowdoc-step: Collect payment details (card number, expiry, CVV)
// @flowdoc-dependency: PAY-001

function collectPaymentDetails() {
  // Payment form logic
}

// @flowdoc-topic: payment-processing
// @flowdoc-id: PAY-003
// @flowdoc-step: Send payment request to payment gateway (Stripe)
// @flowdoc-dependency: PAY-002
// @flowdoc-links: url:https://stripe.com/docs/api/charges/create
// @flowdoc-children: PAY-004, analytics-service@track-payment

async function processPayment(amount: number, token: string) {
  // Stripe API call
}

// @flowdoc-topic: payment-processing
// @flowdoc-id: PAY-004
// @flowdoc-step: Payment confirmed - update order status and send receipt
// @flowdoc-dependency: PAY-003 [On successful charge]
// @flowdoc-links: symbol:OrderService@updateStatus; symbol:EmailService@sendReceipt

function confirmPayment(orderId: string) {
  // Update order and send email
}

// ============================================
// Topic: Order Fulfillment (One-liner format)
// Demonstrates the @flowdoc-line syntax
// Format: TOPIC | ID | STEP | links | dependency | children
// ============================================

// @flowdoc-line: order-fulfillment | ORDER-001 | Customer places order through checkout

function placeOrder() {
  // Order creation logic
}

// Minimal one-liner (only required fields: topic, id, step)
// @flowdoc-line: order-fulfillment | ORDER-002 | Order validation and inventory check

function validateOrder() {
  // Validation logic
}

// One-liner with dependency
// @flowdoc-line: order-fulfillment | ORDER-003 | Payment processing initiated | | ORDER-002

function initiatePayment() {
  // Payment initiation
}

// Full one-liner with all fields
// @flowdoc-line: order-fulfillment | ORDER-004 | Warehouse picks and packs items | file:examples/demo.ts:140 | ORDER-003 [After payment confirmed] | ORDER-005

function pickAndPack() {
  // Warehouse operations
}

// @flowdoc-line: order-fulfillment | ORDER-005 | Shipping label generated and carrier notified | url:https://shipping-api.example.com | ORDER-004

function generateShippingLabel() {
  // Shipping logic
}

// ============================================
// Topic: Auto-Sequence Demo
// Demonstrates automatic numeric dependency detection
// No explicit dependencies needed - FlowDoc auto-links by number!
// Handles mixed formats: 001, 2, 03 all recognized as numeric sequence
// ============================================

// @flowdoc-topic: auto-sequence-demo
// @flowdoc-id: STEP-001
// @flowdoc-step: First step - auto-detected as root (no previous number)

function autoStep1() {}

// @flowdoc-topic: auto-sequence-demo
// @flowdoc-id: STEP-2
// @flowdoc-step: Second step - auto-linked to STEP-001 (different format, same sequence)

function autoStep2() {}

// @flowdoc-topic: auto-sequence-demo
// @flowdoc-id: STEP-03
// @flowdoc-step: Third step - auto-linked to STEP-2

function autoStep3() {}

// @flowdoc-topic: auto-sequence-demo
// @flowdoc-id: STEP-4
// @flowdoc-step: Fourth step - auto-linked to STEP-03

function autoStep4() {}

// One-liner with auto-sequence (no dependency specified, will auto-link to STEP-4)
// @flowdoc-line: auto-sequence-demo | STEP-5 | Fifth step using one-liner format

function autoStep5() {}

export { showRegistrationForm, validateRegistrationForm, submitRegistration, redirectToDashboard, showRegistrationError, initializePayment, collectPaymentDetails, processPayment, confirmPayment, placeOrder, validateOrder, initiatePayment, pickAndPack, generateShippingLabel, autoStep1, autoStep2, autoStep3, autoStep4, autoStep5 };
