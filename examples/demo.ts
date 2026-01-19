/**
 * Example file demonstrating FlowDoc comment tags
 * Open the FlowDoc extension and run "FlowDoc: Pick Topic" to see this in action
 */

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
// Another topic: Payment Processing
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

export { showRegistrationForm, validateRegistrationForm, submitRegistration, redirectToDashboard, showRegistrationError, initializePayment, collectPaymentDetails, processPayment, confirmPayment };
