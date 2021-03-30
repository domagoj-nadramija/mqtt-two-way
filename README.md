# Code repository for "Two-way communication with IoT devices using MQTT"

This is the repository for the examples demonstrating two-way communication using TCP and MQTT.

## Setup

### Install Node.js

- Version 15.6.0 is recommended

### Install dependencies

- ```shell
  npm install
  ```

### Configure

All configuration should be passed via environment variables. Either set the variables in your environment or create a .env file. All of the variables are required. They are listed below with example values that you are free to use, but keep in mind that if you use the same client ID when connecting to a MQTT broker (the DEVICE_ID and SERVER_ID variables) as someone else, you will have broker connection issues.

#### TCP

```properties
DEVICE_ID=sim-iot-device-1234
SERVER_HOST=127.0.0.1
SERVER_PORT=30000
```

#### MQTT

```properties
DEVICE_ID=sim-iot-device-1234
BROKER=mqtt://broker.hivemq.com
DATA_TOPIC=mqtt/blog/examples/data
CMD_REQ_TOPIC=mqtt/blog/examples/cmd/req
CMD_RESP_TOPIC=mqtt/blog/examples/cmd/resp
REGISTER_TOPIC=mqtt/blog/examples/register
SERVER_ID=example-server-1234
```

## Running examples

Each example requires you to run 2 applications; one is the simulating an IoT device, the other an IoT server. Examples must be run from the root directory, as they depend on the `common.js` file which has some common functions.

### TCP 

Start the server first

```shell
node tcp/iot-server.js
```

Then start the device

```shell
node tcp/iot-device.js
```

They should start sending messages to each other immediately.

### MQTT

Start the server first

```shell
node mqtt/iot-server.js
```

Then start the device

```shell
node mqtt/iot-server.js
```

They should start sending messages to each other immediately.

## Using docker compose

Or simply use docker compose to run everything in docker containers

```shell
docker-compose -f "docker-compose.yml" up --build
```
