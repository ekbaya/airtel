# Payment API Integration with RabbitMQ (NestJS)

## Overview

This project implements an integration with Airtel Africa's Collection API using NestJS. It includes authentication, payment request initiation, status checking, and handling of callback notifications. The solution also integrates RabbitMQ for publishing payment results.

## Features

- Airtel Africa API integration
- Secure authentication with token management
- Payment initiation and status retrieval
- Callback handling for asynchronous updates
- RabbitMQ messaging for payment result processing
- Docker-based deployment setup

## Technologies Used

- **NestJS** - NodeJS framework for scalable applications
- **RabbitMQ** - Message broker for asynchronous communication
- **Docker** - Containerized deployment
- **Jest** - Unit and integration testing

## Prerequisites

Ensure you have the following installed before running the application:

- Node.js (v16 or later)
- Docker & Docker Compose
- RabbitMQ (via Docker)
- Airtel Africa developer account ([Sign Up Here](https://developers.airtel.africa/user/signup))

## Installation & Setup

1. Clone the repository:
   ```sh
   git clone <repository-url>
   cd <project-folder>
   ```
2. Install dependencies:
   ```sh
   yarn install
   ```
3. Configure environment variables:

   - Create a `.env` file at the root of the project with the following variables:
     ```env
     PORT=3000
     AIRTEL_API_KEY=<your-api-key>
     AIRTEL_SECRET=<your-secret>
     AIRTEL_BASE_URL=https://openapi.airtel.africa
     RABBITMQ_URL=amqp://localhost
     ```

4. Start RabbitMQ using Docker Compose:
   ```sh
   docker-compose up -d
   ```
5. Run the application:
   ```sh
   yarn start:dev
   ```

## API Endpoints

| Method | Endpoint               | Description                            |
| ------ | ---------------------- | -------------------------------------- |
| POST   | `/payments/ussd`       | Initiates a payment request            |
| GET    | `/payments/status/:id` | Checks the payment status              |
| POST   | `/payments/callback`   | Handles payment callback notifications |

## RabbitMQ Integration

- A queue named **payment-result** is created.
- Payment results are published to the exchange with appropriate routing.

## Testing

Run unit and integration tests using:

```sh
yarn test
```

## Deployment

To run the service in a production-like environment:

```sh
docker-compose up --build
```

## License

MIT License.

## Author

Developed by Elias.
