# Crypto Panic Button (Coin Escape)

Emergency withdrawal application for cryptocurrency exchanges.

## Overview

The Crypto Panic Button enables users to execute rapid, one-click withdrawals from multiple cryptocurrency exchanges simultaneously. This system provides a critical safety mechanism for users to quickly move assets during market emergencies, security threats, or exchange instability.

## Features

- **Multi-Exchange Support**: Connect to multiple exchanges (Binance, Coinbase, Kraken, and more)
- **Emergency Withdrawals**: One-click parallel withdrawals across all connected exchanges
- **Dry Run Mode**: Test withdrawals without executing actual transactions
- **Secure Credential Storage**: AES-256 encryption for API credentials
- **Comprehensive Audit Logging**: Track all operations with tamper-proof logs
- **Swipe-to-Confirm**: Prevent accidental activations with gesture confirmation

## Requirements

- Node.js 18.0.0 or higher
- npm or yarn

## Installation

```bash
npm install
```

## Project Structure

```
crypto-panic-button/
├── src/
│   ├── exchange/       # Exchange Manager and adapters
│   ├── withdrawal/     # Withdrawal Engine
│   ├── security/       # Security Layer (encryption, auth, audit)
│   ├── ui/             # UI Controller
│   ├── models/         # Data models
│   └── utils/          # Utility functions
├── tests/
│   ├── unit/           # Unit tests
│   ├── property/       # Property-based tests
│   └── integration/    # Integration tests
├── config/             # Configuration files
└── package.json
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Fix linting issues
npm run lint:fix

# Format code
npm run format

# Check formatting
npm run format:check
```

## Security

⚠️ **IMPORTANT**: Never commit API credentials or private keys to version control.

- API credentials are encrypted using AES-256-GCM
- All sensitive data is stored securely
- Comprehensive audit logging tracks all operations
- Session timeout after 15 minutes of inactivity

## License

MIT
