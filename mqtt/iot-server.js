const mqtt = require("mqtt");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"));

console.log("STARTING MQTT IOT SERVER");

const client = mqtt.connect(config.broker, {
  clean: false,
  clientId: `mqtt-blog-example-iot-server`,
});

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
  }
};

// dummy function pretending to store data
function storeData(data) {
  console.log("Storing data...");
}
