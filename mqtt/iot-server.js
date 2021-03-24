const mqtt = require("mqtt");
const fs = require("fs");
const { v4: uuidv4 } = require("uuid");

const config = JSON.parse(fs.readFileSync(__dirname + "/config.json"));

console.log("STARTING MQTT IOT SERVER");

const client = mqtt.connect(config.broker, {
  clean: false,
  clientId: `mqtt-blog-example-iot-server`,
});

const dataTopicSub = config.dataTopic.replace("<DEVICE_ID>", "+");
const cmdRespTopicSub = config.commandResponseTopic.replace("<DEVICE_ID>", "+");
const registerTopic = config.registerTopic.replace("<DEVICE_ID>", "+");
const subscribeTopics = [dataTopicSub, cmdRespTopicSub, registerTopic];

client.on("connect", () => {
  console.log("CONNECTED TO MQTT BROKER");
  console.log(`SUBSCRIBING TO TOPICS ${subscribeTopics}`);
  client.subscribe(subscribeTopics, function (err) {
    if (!err) {
      console.log("SUCCESSFULLY SUBSCRIBED");
    }
  });
});

client.on("message", (topic, message) => {
  console.log(`RECEIVED MESSAGE "${message.toString()}" ON TOPIC ${topic}`);
  storeData(message);
});

// dummy function pretending to store data
function storeData(data) {
  console.log("Storing data...");
}
