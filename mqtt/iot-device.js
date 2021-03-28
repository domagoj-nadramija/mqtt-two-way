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
