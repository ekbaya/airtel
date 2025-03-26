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

   - Copy `.env.example` to `.env` and fill in the required configurations:

     ```sh
     cp .env.example .env
     ```

   - Edit `.env` with the following variables:
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

### Request Body Examples

#### `/payments/ussd`

```json
{
  "reference": "Testing transaction",
  "subscriber": {
    "country": "UG",
    "currency": "UGX",
    "msisdn": "123456789"
  },
  "transaction": {
    "amount": 1000,
    "country": "UG",
    "currency": "UGX",
    "id": "random-unique-id"
  }
}
```

#### `/payments/callback` (For Testing Purposes)

```json
{
  "transaction": {
    "id": "BBZMiscxy",
    "message": "Paid UGX 5,000 to TECHNOLOGIES LIMITED Charge UGX 140, Trans ID MP210603.1234.L06941.",
    "status_code": "TF",
    "airtel_money_id": "MP210603.1234.L06941"
  }
}
```

## Payments Service Overview

The Payments Service is responsible for managing USSD-based payments, transaction status retrieval, and callback handling. It integrates with Airtel Africa's API and RabbitMQ for real-time transaction processing.

### Key Functionalities:

1. **USSD Payment Initiation**:

   - Sends a payment request to Airtel Africa's API.
   - Includes country and currency headers.
   - Logs successful or failed transactions.

2. **Transaction Status Retrieval**:

   - Queries Airtel Africa for a transaction's status.
   - Logs and returns the current status of a payment.

3. **Payment Callback Handling**:

   - Processes asynchronous transaction updates from Airtel.
   - Validates content type and authenticates callback data.
   - Publishes transaction results to RabbitMQ for further processing.

4. **RabbitMQ Integration**:
   - Publishes successful and failed transactions to different RabbitMQ topics.
   - Ensures seamless communication between microservices.

## Airtel Service Overview

The Airtel service securely interacts with Airtel Africa's API to manage payments, authentication, and encryption:

- **Authentication & Token Management**: Retrieves and caches access tokens, ensuring minimal redundant API calls and preventing simultaneous refreshes using a distributed lock mechanism.
- **Secure API Communication**: Fetches RSA encryption keys, encrypts payloads using AES, and signs requests with RSA encryption for secure transactions.
- **Making API Requests**: Constructs authenticated requests, handles different HTTP methods (`GET`, `POST`), and ensures seamless interaction with Airtel's endpoints.
- **Concurrency & Caching**: Implements caching for tokens and encryption keys to optimize performance and reduce unnecessary API requests.

## RabbitMQ Integration

The RabbitMQ service is responsible for handling message-based communication within the payment system. It facilitates asynchronous processing of payment results.

### Key Features:

1. **Connection Management**:

   - Establishes a connection to the RabbitMQ server.
   - Creates a messaging channel for communication.

2. **Publishing Payment Results**:

   - Sends successful and failed transaction results to different topics within the RabbitMQ exchange.
   - Ensures message persistence for reliable delivery.

3. **Consuming Payment Messages**:

   - Listens for payment result messages from the queue.
   - Processes and acknowledges received messages.
   - Handles message failures with appropriate retries or rejections.

4. **Configuration & Setup**:
   - Uses environment variables to define the RabbitMQ connection parameters.
   - Supports flexible routing key patterns for topic-based message distribution.

## RabbitMQ Consumer Service

The RabbitMQ Consumer is responsible for processing incoming messages related to payment results. It ensures that messages are properly received and handled.

### Key Functionalities:

1. **Listening for Messages**:

   - Subscribes to the payment results queue.
   - Listens for messages with routing keys matching `payment.#`.

2. **Processing Messages**:

   - Parses received messages.
   - Logs and processes payment results.

3. **Acknowledging Messages**:
   - Confirms successful message processing to RabbitMQ.
   - Handles errors and applies retry or rejection strategies if necessary.

## Testing

Run unit and integration tests using:

```sh
yarn test
```

## Deployment

To run the RabbitMQ service in a production-like environment:

```sh
docker-compose up --build
```

## License

MIT License.

## Author

Developed by Elias.
