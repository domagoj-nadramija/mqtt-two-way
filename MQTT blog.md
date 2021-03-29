# Two-way communication with IoT devices using MQTT

## What you should know

In this article we will briefly discuss the problem of two-way IoT communication, why “traditional” solutions are not a good fit and why a technology like MQTT is. We will also go into more detail on exactly how MQTT works and provide code examples for 2-way communication with both TCP and MQTT. 

All examples are written using Node.js version 15.6.0 and are available at https://github.com/domagoj-nadramija/mqtt-two-way. I recommend using the provided docker compose file to run the examples. Configuration parameters are passed through environment variables. Read the README if you want to know more.

## Using TCP for two-way communication

My team and I work on services responsible for data collection from a wide variety of devices and servers used by our clients. Most of our challenges are related to wrangling different transports, protocols, encodings, and data formats and normalizing them into a unified data structure which is understood by the rest of our platform.

However, as IoT devices can be practically anything and can perform a multitude of roles, simply collecting data is not enough. To fully utilize their devices, our customers also need to be able to communicate with the devices themselves: whether to send commands or to change a configuration. As we are “closest” to the devices it is our responsibility to facilitate this 2-way communication, where possible.

However, in most cases this is not as simple as sending a HTTP request to a URL. Devices do not have fixed addresses, and are often not even capable of running HTTP servers. In fact, most communication with devices is done directly via TCP.

Fortunately, TCP connections are 2-way. This means that when a device establishes a TCP connection with our server to send some data, we can also send data back through that same TCP connection. That data would then hopefully be received and acted upon by the device.

Lets take a look at some examples how this would work using just TCP.

### TCP IoT server

First we need a TCP server which will listen for connections, receive data and store it somewhere. Since we want to demonstrate two-way communication, we are also going to add an interval which periodically sends commands via the open TCP socket. All data and commands will be JSON objects to keep it simple, but in real-world scenarios you usually have to deal with a binary protocol.

```javascript
const net = require("net");
const { v4: uuidv4 } = require("uuid");
const { getConfig, storeData } = require("../common");

const config = getConfig("tcp");
console.log(`STARTING TCP IOT SERVER ON PORT ${config.server.port}`);

const server = net.createServer((socket) => {
  const connPort = socket.remotePort;
  console.log(`NEW CONNECTION FROM ${connPort}`);

  // this simulates the user or an automated system sending commands to the device
  const commandSendInterval = setInterval(() => {
    const command = JSON.stringify({ uuid: uuidv4(), command: "PING" });
    console.log(`SENDING COMMAND TO ${connPort}: ${command}`);
    socket.write(command);
  }, 10000);

  socket.on("data", (data) => {
    console.log(`RECEIVED DATA FROM ${connPort}: ${data.toString()}`);
    storeData(data);
  });
  socket.on("close", () => {
    console.log(`CLOSING CONNECTION TO ${connPort}`);
    clearInterval(commandSendInterval);
  });
  socket.on("error", (error) => {
    console.log(`ERROR WITH CONNECTION TO ${connPort}:`, error.code);
    clearInterval(commandSendInterval);
  });
  socket.on("timeout", () => {
    console.log(`CONNECTION TO ${connPort} TIMED-OUT`);
    clearInterval(commandSendInterval);
  });
});

server.listen(config.server.port);
```

### TCP IoT device

We also need a simulated TCP device which will initiate the TCP connection and publish data. When it receives a command it should "execute" it and send the command execution result to the server.

```javascript
const net = require("net");
const { getConfig, execute, getDataPayload } = require("../common");

const config = getConfig("tcp");

const deviceId = config.deviceId;

console.log(`STARTING TCP IOT DEVICE <${deviceId}>`);

console.log(`WILL CONNECT TO ${config.server.host}:${config.server.port}`);

const client = new net.Socket();

client.connect(config.server.port, config.server.host, function () {
  console.log("CONNECTED TO SERVER");
  client.write(JSON.stringify({ deviceId, messageType: "SIGNUP" }));
  // this simulates the device collecting and sending sensor data
  const dataSendInterval = setInterval(() => {
    const data = getDataPayload(deviceId);
    console.log(`SENDING DATA: ${data}`);
    client.write(data);
  }, 5000);

  client.on("data", (data) => {
    const command = JSON.parse(data.toString());
    console.log("RECEIVED COMMAND: " + data.toString());
    const commandResult = execute(command.command);
    const commandResp = JSON.stringify({
      deviceId,
      messageType: "commandResp",
      commandResult,
      ...command,
    });
    console.log(`SENDING COMMAND RESPONSE ${commandResp}`);
    client.write(commandResp);
  });

  client.on("close", () => {
    console.log("CONNECTION CLOSED");
    clearInterval(dataSendInterval);
  });
  client.on("error", (error) => {
    console.log(`ERROR WITH CONNECTION: ${error.code}`);
    clearInterval(dataSendInterval);
  });
  client.on("timeout", () => {
    console.log(`CONNECTION TIMED-OUT`);
    clearInterval(dataSendInterval);
  });
});
```

### Configuration

Our configuration is loaded from environment variables, so be sure to include those somehow, like in a .env file. This is the configuration we will be using

```json
DEVICE_ID=sim-iot-device-0001
SERVER_HOST=127.0.0.1
SERVER_PORT=30000
```

### Running our TCP example

Let go ahead and start our TCP server.

```shell
$ node tcp\iot-server.js
```

We should be greeted with

> STARTING TCP IOT SERVER ON PORT 30000

and nothing else since the server is waiting for incoming connections.

Once we start the device

```shell
$ node tcp\iot-device.js
```

It will output some basic configuration information and hopefully announce that it has successfully connected to the server:

> STARTING TCP IOT DEVICE <simulated-device-tcp-0001>
> WILL CONNECT TO 127.0.0.1:30000
> CONNECTED TO SERVER

And the server should receive a new connection and signup message which it will store:

> NEW CONNECTION FROM 51165
> RECEIVED DATA FROM 51165: {"deviceId":"simulated-device-tcp-0001","messageType":"SIGNUP"}
> Storing data...

After this the device will send data every 5 seconds and the server will send a command every 10 seconds for as long as the connection is maintained.

This is a small excerpt of the logs during which the device published data twice and received a command for the server which it executed and returned a response

> SENDING DATA: {"deviceId":"simulated-device-tcp-0001","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}
> RECEIVED COMMAND: {"uuid":"a87c0038-df85-4b73-b18e-9a0ba8088024","command":"PING"}
> SENDING COMMAND RESPONSE {"deviceId":"simulated-device-tcp-0001","messageType":"COMMAND_RESP","commandResult":"PONG","uuid":"a87c0038-df85-4b73-b18e-9a0ba8088024","command":"PING"}
> SENDING DATA: {"deviceId":"simulated-device-tcp-0001","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}

And this is what it looks like on the server side:

> RECEIVED DATA FROM 58237: {"deviceId":"simulated-device-tcp-0001","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}
> Storing data...
> SENDING COMMAND TO 58237: {"uuid":"a87c0038-df85-4b73-b18e-9a0ba8088024","command":"PING"}
> RECEIVED DATA FROM 58237: {"deviceId":"simulated-device-tcp-0001","messageType":"COMMAND_RESP","commandResult":"PONG","uuid":"a87c0038-df85-4b73-b18e-9a0ba8088024","command":"PING"}
> Storing data...
> RECEIVED DATA FROM 58237: {"deviceId":"simulated-device-tcp-0001","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}
> Storing data...

### What we learned

We can see that both data and commands are freely flowing from the device and the server, meaning that we have full bidirectional communication.

This is a simple demonstration of how we can communicate with devices in the field, as even the most basic devices are capable of communicating via TCP.

Unfortunately, there are a number of issues with this method, especially when working with IoT devices:

- The obvious drawback is that it requires the client to open the connection before we can send anything. Until that happens no communication is possible.

- Many IoT devices are constrained and have low-power consumption to be able to operate long-term exclusively on battery power. These devices are not interested in long-lived connections (through which we can send commands). They just open a connection, send their data, and close the connection as soon as possible, to save every milliampere.

- Even if a device does not need to worry about power consumption and can maintain TCP connections indefinitely, they rarely have a stable Internet connection, usually relying on an unreliable mobile network to access the Internet. This means that TCP connections can frequently be interrupted due to network issues.

- If both the power and network are not an issue, a serious problem would be the sheer scale of an average IoT ecosystem, with tens of thousands of devices and tens of thousands of connections.


But we all know that TCP is rather basic, so for the solution we would look towards some higher layer protocol. The most popular candidate would usually be HTTP, but in this case, it would make the problem even worse; creating new problems like requiring us to use heavy-weight headers and rules which are not a good fit for constrained IoT communication.


In fact, if we dig deeper, we can see that the typical request-response messaging pattern in general does not work well for the average IoT use-case. The 1 to 1 communication makes scaling much more difficult, and is typically one-way and synchronous which are both detrimental to our efforts to have two-way communication with our devices.

## Why MQTT 

**MQTT** (**M**essage **Q**ueuing **T**elemetry **T**ransport), to quote the specification, *is a Client Server publish/subscribe messaging transport protocol. It is light weight, open, simple, and designed to be easy to implement. These characteristics make it ideal for use in many situations, including constrained environments such as for communication in Machine to Machine (M2M) and Internet of Things (IoT) contexts where a small code footprint is required and/or network bandwidth is at a premium.*

*The protocol runs over TCP/IP, or over other network protocols that provide ordered, lossless, bi-directional connections. Its features include:*

- *Use of the publish/subscribe message pattern which provides one-to-many message distribution and decoupling of applications.*
- *A messaging transport that is agnostic to the content of the payload.*

- *Three qualities of service for message delivery:*
  - *"At most once", where messages are delivered according to the best efforts of the operating environment. Message loss can occur. This level could be used, for example, with ambient sensor data where it does not matter if an individual reading is lost as the next one will be published soon after.*
  - *"At least once", where messages are assured to arrive but duplicates can occur.*

  - *"Exactly once", where messages are assured to arrive exactly once. This level could be used, for example, with billing systems where duplicate or lost messages could lead to incorrect charges being applied.*

- *A small transport overhead and protocol exchanges minimized to reduce network traffic.*
- *A mechanism to notify interested parties when an abnormal disconnection occurs.*

So we can see that MQTT has several positive features important for us:

- Scalable for millions of connected devices
- Works well over unreliable networks due to 3 message delivery Quality of Service levels

- Lightweight and efficient so it requires minimal resources

### Publish-subscribe

MQTT uses the tried and true **publish-subscribe** (pub/sub) messaging pattern. In publish-subscribe, clients that send messages are called **publishers** and those that receive that data are called **subscribers**. Publishers and subscribers are loosely coupled and do not even need to know about each other. The data flow between publishers and subscribers is handled by a third component, the **broker**.

It is the responsibility of the broker to filter all incoming messages and distribute them to the correct subscribers. There are two common ways of filtering these messages, by content or by subject. MQTT uses subject filtering by having named logical channels called **topics**. Subscribers let the broker know which topics they are interested in and publishers are required to specify which topic they are publishing to, giving the broker everything it needs to route the messages to the correct recipients.

The decoupling provided by pub/sub and MQTT has several benefits which make it scale much better than the traditional request-response approach:

- The publisher and subscriber do not have to run at the same time. The MQTT broker can store messages for offline clients.

- Publishing and receiving messages is asynchronous by default, there is no need to interrupt normal operations.

- Publishers do not care about subscribers and vice-versa, they only need to have a common broker.


Of course, there’s always some kind of tradeoff. Now we have new drawbacks we must contend with:

- Publishers and subscribers need to agree beforehand on which topics to use
- The subscribers also need to be aware of how the published data is going to be structured
- Message delivery can only be guaranteed from client to broker and can become complex when looked at end to end. For example, the publisher can’t assume that someone is going to receive messages he is sending, as it is completely possible that no one is subscribed to the topic he is publishing to.

Before we get into the code, lets dive deeper into the MQTT connection and communication flow so we have a better idea of what is going on. We also want to take a look at several features we will be using in our example: persistent sessions, retained messages, and last will and testaments.

## How MQTT works

The important thing to keep in mind when working with MQTT is that we now have a new component, the **broker**, which is located between our device and our "server". The "server" is in quotation marks because per the specification "*MQTT is a Client Server publish/subscribe messaging transport protocol*", so in this context **the broker is actually the server**. Clients are publishers and subscribers, what we previously called our IoT device and IoT server. Of course, in our case our clients are going to be both publishers and subscribers, but they are still clients nonetheless.

Before they can subscribe or start publishing, clients first need to connect to the broker. To connect they send a connect message (CONNECT) in which they can set a number of options, like the keep-alive period, whether to use clean or persistent sessions and so on. Once they get an acknowledgement message (CONNACK) from the broker they are ready to start receiving or publishing data. MQTT connections also have built-in keep alive functionality to help detect half-open TCP connections. If clients are inactive for longer periods they are expected to send a keep alive message (PINGREQ) to the broker, which should response with a keep alive message of it's own (PINGRESP).

To start receiving data, a client needs to send a subscribe message (SUBSCRIBE) which contains a list of topics to subscribe to. Once the client receives a confirmation message (SUBACK), they know they will receive any new messages published to the topics specified.

After a device has connected to the broker and is ready to publish some data it sends a publish message (PUBLISH) which contains the data payload and the topic the data is being published to. Depending on the quality of service level used, additional confirmation messages may follow.

Below is a simple diagram examining the flow of messages with a single publisher and a single subscriber using the default quality of service (QoS) level, 0.

![mqtt message flow](https://i.postimg.cc/GtYSd0cc/mqtt-conn-flow.png)

### Quality of service

We can see that in this case no confirmation message was sent for the publish message. That is why QoS level 0 is also referred to as "at most once": messages can be received once or not at all.

To guarantee message delivery we're certainly going to want to increase our QoS level. At QoS 1 the receiver will be expected to respond with a confirmation message (PUBACK). This achieves "at least once", so messages will certainly be delivered, but duplicates are a possibility.

![qos 1 msg flow](https://i.postimg.cc/DzNvFQB6/msg-flow-qos-1.png)

Since we don't want to risk duplicate messages, we're going to be using QoS 2 which is "exactly once". QoS 2 uses a four-part handshake where for each published message there are at least 3 confirmation messages, making it the safest but slowest QoS level.

![qos 2 msg flow](https://i.postimg.cc/kXy7DPTB/msg-flow-qos-2.png)

### Topics

A crucial aspect of the message flow are topics, which, as previously mentioned, the broker uses to filter messages. Topics are simply a UTF-8 string which consists of one or more topic levels which are separated by a forward slash. MQTT topics are very lightweight, meaning we can easily have millions of them, and they do not require initialization before publishing or subscribing to them.

![topic basics](https://i.postimg.cc/9fHC45nw/topics-basics.png)

Of course, when starting a subscriber we don't want to have to list the hundreds or even thousands of topics we might want to subscribe to. It would not only be inconvenient, it would increase coupling and defeat the purpose of using MQTT in the first place. That is why subscribers can use single- and multi-level  wildcards when specifying topics.

Single-level wildcards are indicated with the plus character, **+**. They match anything in a single topic level, even an empty string.

![single level wildcard](https://i.postimg.cc/Bn3yWSL6/single-level-wildcard.png)

Multi-level wildcards are indicated with the hash character, **#**. They cover an arbitrary number of topic levels. They must be placed at the end and preceded by a forward slash.

![multi level wildcard](https://i.postimg.cc/jqZCn2KV/multi-wildcard.png)

### Useful features

Now that we have an understanding of the fundamentals of MQTT, there are 3 additional features we are going to want to make use of that should be mentioned:

- **Persistent sessions** 
  - By creating a session on the broker, the client can have the broker store messages if it is offline
  - Requires subscriptions and the messages to be published with a QoS of at least 1
  - Very useful if we do not want to miss any messages, even if we lose connection to the broker
- **Retained messages**
  - A normal message published with the "retain" flag which will be stored and sent to any new subscribers to it's topic
  - A new retained message on the same topic will overwrite the old one
  - Mainly used for things like status updates which aren't sent that often but can be important for new subscribers
- **Last will and testaments**
  - When connecting a client can specify a message to send in case it disconnects ungracefully
  - Very useful in IoT as we are often communicating over unreliable networks
  - Is often combined with retained messages to change the state of a device to "offline" if it disconnects ungracefully

## Using MQTT for two-way communication

It is finally time to start coding and actually tryout MQTT. We are going to be using the [Javascript mqtt library](https://www.npmjs.com/package/mqtt#client) and a [publicly available broker provided by HiveMQ](http://broker.mqtt-dashboard.com).

It might be a good idea to start a multi level subscriber to get an overview of all the messages being exchanged. If you've installed MQTT.js globally you can simply run this to get started:

```shell
$ mqtt sub -t 'mqtt/blog/examples/#' -h 'broker.hivemq.com' -v
```

Now, previously we had a very clear idea of what was a client and what was the server, but things are different in MQTT with the broker technically being the server. However, for lack of a better word I will still be referring to our application which is responsible for consuming device data and sending commands as our *server*.

### Topic structure

Another difference is that we no longer have a direct connection between the device and server. We instead have to rely on topics to organize data flows. This means that we are going to be using 4 topics per device:

- Data topic
  - device will publish data to this topic
  - server will subscribe to this topic
  - example: `mqtt/blog/examples/data/{device_id}`
- Command request topic
  - server will publish requests for commands  to this topic
  - device will subscribe to this topic
  - example: `mqtt/blog/examples/cmd/req/{device_id}`
- Command response topic
  - device will publish responses for commands to this topic
  - server will subscribe to this topic
  - example: `mqtt/blog/examples/cmd/resp/{device_id}`
- Registration topic 
  - device will register it's presence on this topic
  - server will subscribe to this topic
  - example: `mqtt/blog/examples/register/{device_id}`

### MQTT IoT server

As before, we're going to be looking at the server first. So the server needs to connect to the MQTT broker and subscribe to the data, command response and registration topics with a single level wildcard, so that it receives data from all devices. We're going to want to connect with a persistent session and subscribe with QoS 2 so that we don't miss any messages if we happen to disconnect from the broker. When we receive new messages from the data or command response topic we just want to store it. However, if we receive a new message from the registration topic that means that a device has either signed-up or signed-out. If a device has signed-in (by sending the "SIGN_IN" string) that means it is ready to receive commands, so we start an interval which will send commands to the appropriate command request topic every 10 seconds. If a device has signed-out (by sending the "SIGN_OUT" string) that means it is no longer willing or able to receive commands, so we need to clear the interval which is periodically sending commands.

```javascript
const mqtt = require("mqtt");
const { v4: uuidv4 } = require("uuid");
const { getConfig, storeData } = require("../common");

const config = getConfig("mqtt");

console.log("STARTING MQTT IOT SERVER");

const client = mqtt.connect(config.broker, {
  // signals the broker we want a persistent session
  clean: false,
  // identifies the client to the broker for the persistent session
  clientId: config.serverId,
});

// our server wants to receive data from multiple devices, so we will use the + wildcard
const dataTopicSub = `${config.dataTopic}/+`;
const cmdRespTopicSub = `${config.commandResponseTopic}/+`;
const registerTopic = `${config.registerTopic}/+`;
const subscribeTopics = [dataTopicSub, cmdRespTopicSub, registerTopic];

client.on("connect", () => {
  console.log("CONNECTED TO MQTT BROKER");
  console.log(`SUBSCRIBING TO TOPICS ${subscribeTopics}`);
  client.subscribe(subscribeTopics, { qos: 2 }, (err) => {
    if (!err) {
      console.log("SUCCESSFULLY SUBSCRIBED");
    }
  });
});

client.on("message", (rawTopic, message) => {
  const msgString = message.toString();
  console.log(`RECEIVED MESSAGE "${msgString}" ON TOPIC ${rawTopic}`);
  const splitRawTopic = rawTopic.split("/");
  // the last element is the device id
  const deviceId = splitRawTopic.pop();
  const topic = splitRawTopic.join("/");
  if (topic === config.dataTopic) return storeData(msgString);
  if (topic === config.commandResponseTopic) return storeData(msgString);
  if (topic === config.registerTopic) {
    if (msgString === "SIGN_IN") return commandSender.start(deviceId);
    if (msgString === "SIGN_OUT") return commandSender.stop(deviceId);
  }
  return console.error("DATA RECEIVED FROM UNKNOWN TOPIC");
});

// command sender object is basically just for starting, containing and clearing the intervals
const commandSender = {
  activeDevices: {},
  start: function (deviceId) {
    if (deviceId in this.activeDevices) return;
    this.activeDevices[deviceId] = setInterval(() => {
      const command = JSON.stringify({ uuid: uuidv4(), command: "PING" });
      console.log(`SENDING COMMAND TO ${deviceId}: ${command}`);
      client.publish(`${config.commandRequestTopic}/${deviceId}`, command, { qos: 2 });
    }, 10000);
  },
  stop: function (deviceId) {
    if (deviceId in this.activeDevices) {
      clearInterval(this.activeDevices[deviceId]);
      delete this.activeDevices[deviceId];
    }
  },
};
```

### MQTT IoT device

Our device likewise needs to start by connecting to the MQTT broker with a persistent connection, but it additionally specifies a last will and testament which will be sent automatically by the broker in case of an ungraceful disconnect. The first time we connect we want to subscribe to the command request topic, and send a retained sign-up message to the registration topic so that our server knows it can start sending commands. 

Now while we could just keep a constant connection open to the broker, that would be very similar to the TCP example and would be a poor demonstration of what MQTT offers. So we're going to simulate a device in the field that sends data every 15 seconds, but is only connected to the MQTT broker for 5 seconds. So every 15 seconds our device is going to connect to the broker, subscribe to the command request topic, publish some data and wait for 5 seconds before disconnecting from the broker. While connected it will execute any received commands and publish the command response to the proper topic. Also, to be on the safe side, we catch the SIGINT signal when the application is being shutdown and send a final retained sign-out message so that the server isn't sending commands that no one is listening to.

```javascript
const mqtt = require("mqtt");
const { getConfig, execute, getDataPayload } = require("../common");

const config = getConfig("mqtt");

const deviceId = config.deviceId;

console.log(`STARTING MQTT IOT DEVICE <${deviceId}>`);

// our device will be sending and subscribing only to its topics
const dataTopic = `${config.dataTopic}/${deviceId}`;
const cmdRespTopic = `${config.commandResponseTopic}/${deviceId}`;
const registerTopic = `${config.registerTopic}/${deviceId}`;
const cmdReqTopic = `${config.commandRequestTopic}/${deviceId}`;
const subscribeTopics = [cmdReqTopic];

const mqttClientOpts = {
  // signals the broker we want a persistent session
  clean: false,
  // identifies the client to the broker for the persistent session
  clientId: `${deviceId}`,
  // configures the last will and testament message
  will: {
    qos: 2,
    retain: true,
    topic: registerTopic,
    payload: "SIGN_OUT",
  },
};

const pubSubOpts = { qos: 2 };
const retainPubOpts = { qos: 2, retain: true, properties: { messageExpiryInterval: 60 * 5 } };

// we need to: - subscribe first so that the broker knows which messages to store
//             - send a sign-in message so that the server knows the device exists and can receive commands
console.log("SUBSCRIBING AND SENDING SIGN IN MESSAGE");
const client = mqtt.connect(config.broker, mqttClientOpts);
client.subscribe(subscribeTopics, pubSubOpts, (err) => {
  if (!err) {
    console.log("SUCCESSFULLY SUBSCRIBED");
    client.publish(registerTopic, "SIGN_IN", retainPubOpts, () => client.end());
  }
});

console.log("CONNECTING TO BROKER AND SENDING DATA EVERY 15 SECONDS");
// we want to simulate a IoT device which is only occasionally online, so we run this every 15 seconds
const intervalSender = setInterval(() => connectAndPublish(), 15000);

// this function will connect to the broker, publish some data and sleep for 5 seconds after which it will disconnect from the broker
// while it is connected it will immediately receive commands. When it reconnects it will receive any missed commands
async function connectAndPublish() {
  const client = mqtt.connect(config.broker, mqttClientOpts);

  client.on("connect", (connack) => {
    console.log("CONNECTED TO MQTT BROKER");
    console.log(`SUBSCRIBING TO TOPICS ${subscribeTopics}`);
    client.subscribe(subscribeTopics, pubSubOpts, (err) => {
      if (!err) {
        console.log("SUCCESSFULLY SUBSCRIBED");
      }
    });
    const data = getDataPayload(deviceId);
    console.log(`SENDING DATA: ${data}`);
    client.publish(dataTopic, data, pubSubOpts, async () => {
      console.log("WAITING FOR 5 SECONDS");
      await new Promise((res) => setTimeout(res, 5000));
      console.log("CLOSING CONNECTION TO MQTT BROKER");
      client.end();
    });
  });

  client.on("message", (topic, message) => {
    console.log(`RECEIVED COMMAND "${message.toString()}"`);
    const command = JSON.parse(message);
    const commandResult = execute(command.command);
    const commandResp = JSON.stringify({
      deviceId,
      messageType: "commandResp",
      commandResult,
      ...command,
    });
    console.log(`SENDING COMMAND RESPONSE ${commandResp}`);
    client.publish(cmdRespTopic, commandResp, pubSubOpts);
  });
}

// if we terminate our device while it is disconnected we want to be sure that a sign-out message is sent
process.once("SIGINT", () => {
  clearInterval(intervalSender);
  console.log("SENDING SIGN OUT MESSAGE");
  const client = mqtt.connect(config.broker, mqttClientOpts);
  client.publish(registerTopic, "SIGN_OUT", retainPubOpts, () => {
    client.end(() => process.exit(0));
  });
});
```

### Configuration

The configuration is, again, stored in environment variables. This is the configuration we will be using

```json
DEVICE_ID=sim-iot-device-0001
BROKER=mqtt://broker.hivemq.com
DATA_TOPIC=mqtt/blog/examples/data
CMD_REQ_TOPIC=mqtt/blog/examples/cmd/req
CMD_RESP_TOPIC=mqtt/blog/examples/cmd/resp
REGISTER_TOPIC=mqtt/blog/examples/register
SERVER_ID=example-server-0001
```

### Running our MQTT example

Starting our server 

```shell
$ node mqtt\iot-server.js
```

Will output

> [SERVER] STARTING MQTT IOT SERVER
> [SERVER] CONNECTED TO MQTT BROKER
> [SERVER] SUBSCRIBING TO TOPICS mqtt/blog/examples/data/+,mqtt/blog/examples/cmd/resp/+,mqtt/blog/examples/register/+
> [SERVER] SUCCESSFULLY SUBSCRIBED

To start seeing some more action we're going to have to start the device

```shell
$ node mqtt\iot-device.js
```

Which will output

> [DEVICE] STARTING MQTT IOT DEVICE <sim-iot-device-0001>
> [DEVICE] SUBSCRIBING AND SENDING SIGN IN MESSAGE
> [DEVICE] CONNECTING TO BROKER AND SENDING DATA EVERY 15 SECONDS
> [DEVICE] SUCCESSFULLY SUBSCRIBED

The server will only receive the register message for now

> [SERVER] RECEIVED MESSAGE "SIGN_IN" ON TOPIC mqtt/blog/examples/register/sim-iot-device-0001

But it will soon send a command to the device, before the device is actually connected

> [SERVER] SENDING COMMAND TO sim-iot-device-0011: {"uuid":"37e0c761-0320-435a-8011-013859544c00","command":"PING"}

Once the 15 seconds are up, the device will connect and attempt to subscribe and publish data, but it will also immediately receive the command that was published while it was offline.

> [DEVICE] CONNECTED TO MQTT BROKER
> [DEVICE] SUBSCRIBING TO TOPICS mqtt/blog/examples/cmd/req/sim-iot-device-0011
> [DEVICE] SENDING DATA: {"deviceId":"sim-iot-device-0011","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}
> [DEVICE] SUCCESSFULLY SUBSCRIBED
> [DEVICE] RECEIVED COMMAND "{"uuid":"37e0c761-0320-435a-8011-013859544c00","command":"PING"}"
> [DEVICE] SENDING COMMAND RESPONSE {"deviceId":"sim-iot-device-0011", "messageType":"commandResp","commandResult":"PONG","uuid":"37e0c761-0320-435a-8011-013859544c00","command":"PING"}
> [DEVICE] WAITING FOR 5 SECONDS
> [DEVICE] CLOSING CONNECTION TO MQTT BROKER

On the server side we can see that we receive both the data and command response message

> [SERVER] RECEIVED MESSAGE "{"deviceId":"sim-iot-device-0011","messageType":"DATA","temp":23.6,"lat":48.015722,"lng":-88.625528}" ON TOPIC mqtt/blog/examples/data/sim-iot-device-0011
> [SERVER] Storing data...
> [SERVER] RECEIVED MESSAGE "{"deviceId":"sim-iot-device-0011","messageType":"commandResp","commandResult":"PONG","uuid":"37e0c761-0320-435a-8011-013859544c00","command":"PING"}" ON TOPIC mqtt/blog/examples/cmd/resp/sim-iot-device-0011
> [SERVER] Storing data...

And soon after that the server will again send a command. The device may already be offline by then, but it doesn't matter as we know it is connected with a persistent session and will receive the command when it reconnects.

Once we stop our device (using Ctrl+C) we can see the device sending a sign-out message and the server receiving it.

> [DEVICE] ENDING SIGN OUT MESSAGE
>
> [SERVER] RECEIVED MESSAGE "SIGN_OUT" ON TOPIC mqtt/blog/examples/register/sim-iot-device-0001

In fact, if we stopped the device while it was connected to the broker we will get the second output twice. Once because we're manually sending it after catching the SIGINT signal and once by the broker since the connection was not closed gracefully.

## Conclusion

We can see that there is a much better way of enabling two-way communication for IoT devices than just plain TCP. While only being marginally more complex to implement, MQTT has most of the benefits of plain TCP but can also send commands while a device is offline, safe in the knowledge that the broker will send it to the device once it reconnects. We also have a fairly accurate constantly available device status thanks to retained messages and last will and testaments. That's without even getting into the plethora of other features offered by MQTT that was out-of-scope for this blog post.

Of course, some things have become difficult. With a direct TCP connection we didn't need to know a device existed until it connected to the server. With MQTT knowing when a command-capable device even exists has become more complicated, requiring it to send a registration message to a topic before the server would start relaying commands. The issue of topic management has also appeared, as we can see that even for this relatively simple demonstration we needed 4 topics. Luckily this is not much of a technical burden as we know that topics are cheap, but it is still a cognitive one.

However, despite these few drawbacks, the benefits are evident. That is why MQTT is a proven protocol in the IoT ecosystem and the number of devices and platforms supporting it is growing every day. It can even be used in the browser by using a broker that supports MQTT over Websockets.

If you are interested in more information about MQTT, how it works and what other features it supports, I recommend you take a look at [MQTT Essentials](https://www.hivemq.com/mqtt-essentials/ created), a series of a articles written by the engineers at HiveMQ.

