# RoboClaim Backend

## Description

A NestJS application for processing PDFs.

## Installation

Important Setup Step:

Before running the application, make sure to rename the .env.template file to .env and fill in the required environment variables.

The application relies on these environment variables to function properly, so ensure all necessary values are configured correctly!

To install the application, run the following command:

```bash
npm install
```

To start the application in development mode, use:

```bash
npm run start:dev
```

Docker Setup

To build and run the application using Docker, execute the following commands:

```bash
docker build --platform linux/amd64 -t roboclaim-backend .
docker run --rm -p 3001:3001 roboclaim-backend
```
