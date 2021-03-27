const mqtt = require("mqtt");
const { v4: uuidv4 } = require("uuid");
const { getConfig, storeData } = require("../common");

const config = getConfig("mqtt");

console.log("STARTING MQTT IOT SERVER");

const zeroPaddedNumStr = String(Math.floor(Math.random() * 9999 + 1)).padStart(4,"0");
const client = mqtt.connect(config.broker, {
  // signals the broker we want a persistent session
  clean: false,
  // identifies the client to the broker for the persistent session
  clientId: `test-iot-server-${zeroPaddedNumStr}`,
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

client.on("message", (topic, message) => {
  const msgString = message.toString();
  console.log(`RECEIVED MESSAGE "${msgString}" ON TOPIC ${topic}`);
  const splitTopic = topic.split("/");
  const deviceId = splitTopic.pop();
  // after we stripped the device id, now we can match the topic against the ones we subscribed to
  switch (splitTopic.join("/")) {
    case config.dataTopic:
      storeData(msgString);
      break;
    case config.commandResponseTopic:
      storeData(msgString);
      break;
    case config.registerTopic:
      if (msgString === "SIGN_IN") commandSender.start(deviceId);
      if (msgString === "SIGN_OUT") commandSender.stop(deviceId);
      break;
    default:
      console.error("DATA RECEIVED FROM UNKNOWN TOPIC");
      break;
  }
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
