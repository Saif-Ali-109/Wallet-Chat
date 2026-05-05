# Project Documentation: Wallet-Based Decentralized Chat

This document tracks the progress, architectural decisions, and implementation details of the decentralized chat application.

## 1. Project Initialization & Core Features

### Monorepo Architecture
We have established a monorepo structure using **npm workspaces** to manage multiple packages within a single repository.

**Structure:**
- `apps/web`: Next.js frontend with Tailwind CSS, Solana wallet integration, and real-time chat UI.
- `apps/server`: Express.js backend with Socket.IO for real-time messaging and wallet-based authentication.
- `packages/contracts`: Solana smart contracts using the Anchor framework.
- `packages/types`: Shared TypeScript interfaces.

### Tech Stack Decisions
- **Next.js (App Router)**: Modern routing and SSR/CSR flexibility.
- **Express & Socket.IO**: Low-latency real-time communication.
- **Solana & Ethereum**: Support for both major ecosystems for identity and future on-chain features.
- **Mongoose**: MongoDB object modeling for users and message persistence.

### Progress Log
- [x] Root monorepo configuration (package.json, workspaces, tsconfig.base.json).
- [x] Frontend boilerplate with Next.js and Tailwind CSS.
- [x] Backend boilerplate with Express, Socket.IO, and Mongoose.
- [x] Shared types package.
- [x] Solana contract structure (Anchor).
- [x] **Secure Dual-Wallet Authentication System**
    - [x] Backend: Nonce generation for both MetaMask and Solana.
    - [x] Backend: Signature verification for Ethereum (ethers.js) and Solana (tweetnacl/bs58).
    - [x] Frontend: Unified login flow for MetaMask and Solana.
- [x] **Real-Time Messaging System**
    - [x] Backend: Message model with sender reference and persistence.
    - [x] Backend: Socket.IO event handling for broadcasting and room management.
    - [x] Frontend: Interactive Chat UI with message history and real-time updates.
- [x] **Configuration & Fixes**
    - [x] Resolved React version conflicts in monorepo using npm overrides.
    - [x] Established Solana Wallet Adapter context in the frontend.

## 2. Current State
The application now supports secure authentication for both Ethereum and Solana wallets. Once authenticated, users can participate in a real-time global chat room. Messages are persisted in MongoDB and broadcasted instantly to all connected clients.

## 3. Next Steps
- Implement room-based messaging (Private & Group Chats).
- Add user profiles/usernames linked to wallet addresses.
- Integrate Solana smart contracts for on-chain chat room ownership/management.
- Enhance UI with message timestamps, read receipts, and media support.
