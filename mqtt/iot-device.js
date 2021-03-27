const mqtt = require("mqtt");
const { getConfig, execute } = require("../common");

const zeroPaddedNumStr = String(Math.floor(Math.random() * 9999 + 1)).padStart(4,"0");
const deviceId = `iot-device-${zeroPaddedNumStr}`;

const config = getConfig("mqtt");

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
  clientId: `${deviceId}-client`,
  // configures the last will and testament message
  will: {
    qos: 2,
    retain: true,
    topic: registerTopic,
    payload: "SIGN_OUT",
  },
};

// we need to send a sign-in message so that the server knows the device exists and can receive commands
console.log("SENDING SIGN IN MESSAGE");
const client = mqtt.connect(config.broker, mqttClientOpts);
client.publish(registerTopic, "SIGN_IN", { qos: 2, retain: true }, () => {
  client.end(false, { reasonCode: 0 });
});

// we want to simulate a IoT device which is only occasionally online, so we run this every 15 seconds
setInterval(() => connectAndPublish(), 15000);

// this function will connect to the broker, publish some data and sleep for 5 seconds after which it will disconnect from the broker
// while it is connected it will immediately receive commands. When it reconnects it will receive any missed commands
async function connectAndPublish() {
  const client = mqtt.connect(config.broker, mqttClientOpts);

  client.on("connect", (connack) => {
    console.log("CONNECTED TO MQTT BROKER");
    console.log(`SUBSCRIBING TO TOPICS ${subscribeTopics}`);
    client.subscribe(subscribeTopics, { qos: 2 }, (err) => {
      if (!err) {
        console.log("SUCCESSFULLY SUBSCRIBED");
      }
    });
    const data = JSON.stringify({
      deviceId,
      messageType: "DATA",
      temp: 23.6,
      lat: 48.015722,
      lng: -88.625528,
    });
    console.log(`SENDING DATA: ${data}`);
    client.publish(dataTopic, data, { qos: 2 }, async () => {
      console.log("WAITING FOR 5 SECONDS");
      await new Promise((res) => setTimeout(res, 5000));
      console.log("CLOSING CONNECTION TO MQTT BROKER");
      client.end(false, { reasonCode: 0 });
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
    client.publish(cmdRespTopic, commandResp, { qos: 2 });
  });
}

// if we terminate our device while it is disconnected we want to be sure that a sign-out message is sent
process.once("SIGINT", () => {
  console.log("SENDING SIGN OUT MESSAGE");
  const client = mqtt.connect(config.broker, mqttClientOpts);
  client.publish(registerTopic, "SIGN_OUT", { qos: 2, retain: true }, () => {
    client.end(false, { reasonCode: 0 }, () => process.exit(0));
  });
});
