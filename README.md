# WhiskyPay SDK

A React SDK for integrating cryptocurrency payments on the Solana blockchain.

## Installation

```bash
npm install whisky-pay/whisky-pay-sdk
```

## Features

- Easy integration with React applications
- Multiple token support (SOL, USDC, JUP, BONK, USDT)
- Token swaps via Jupiter API
- Session-based payment flow
- Built-in payment modal UI component
- Automatic API URL detection (works across different environments)

## Usage

### 1. Create a payment session

```typescript
import { createSession } from '@whisky-pay/whisky-pay-sdk';

// Create a payment session
const sessionId = await createSession(
  "your-merchant-id",  // Your merchant/application ID
  "customer@example.com",  // Customer email
  "premium-plan"  // Plan identifier
  // The API URL is auto-detected from your application
);

// Or specify a custom API URL
const sessionIdWithCustomApi = await createSession(
  "your-merchant-id",
  "customer@example.com",
  "premium-plan",
  "https://your-custom-api.com"  // Optional custom API URL
);
```

### 2. Display payment modal

```typescript
import { PaymentModal } from '@whisky-pay/whisky-pay-sdk';

function CheckoutPage() {
  // After creating a session
  return (
    <PaymentModal 
      sessionId={sessionId} 
      RPC_URL="https://api.mainnet-beta.solana.com" 
      onRedirect={() => {
        // Handle payment completion/cancellation
        window.location.href = '/thank-you';
      }}
    />
  );
}
```

### 3. Verify payment (optional)

```typescript
import { verifyPayment } from '@whisky-pay/whisky-pay-sdk';

// Verify a transaction (API URL is auto-detected)
const isValid = await verifyPayment(
  sessionId,
  transactionSignature,
  userPublicKey
);

// Or specify a custom API URL
const isValidWithCustomApi = await verifyPayment(
  sessionId,
  transactionSignature,
  userPublicKey,
  "https://your-custom-api.com"  // Optional custom API URL
);
```

## Requirements

- React 18+
- Solana wallet adapter (compatible with Phantom, Solflare, etc.)
- Modern browser with Web3 support

## Development

1. Clone the repository
2. Install dependencies: `npm install`
3. Build the SDK: `npm run build`

## License

ISC