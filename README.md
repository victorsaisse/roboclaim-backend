# RoboClaim Backend

## Overview

RoboClaim Backend is a NestJS application designed for processing and extracting data from documents.

## Tech Stack

- **Framework**: NestJS
- **Runtime**: Node.js
- **Containerization**: Docker

## Project Structure

```bash
src/
├── controllers/ # API route handlers that receive requests and return responses
├── decorators/ # Custom decorators for route handling, parameter extraction, etc.
├── entities/ # Database models/schemas
├── guards/ # Authentication and authorization guards
├── modules/ # Feature modules that organize related components
├── services/ # Business logic and application services
└── main.ts # Application entry point
```

## Installation

### Prerequisites

- Node.js (version +18)
- npm or yarn
- Docker (optional, for containerized deployment)

### Environment Setup

1. Rename `.env.template` to `.env`
2. Configure all required environment variables:

### Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run start:dev
```

### Docker Deployment

```bash
# Build the Docker image
docker build --platform linux/amd64 -t roboclaim-backend .

# Run the container
docker run --rm -p 3001:3001 roboclaim-backend
```
