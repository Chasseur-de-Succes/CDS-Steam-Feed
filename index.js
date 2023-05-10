const { Client, GatewayIntentBits, Collection, Events, EmbedBuilder } = require('discord.js');
const winston = require("winston");
const { loadBatch, sendToWebhook, recupAchievements } = require('./util/loader');
const { Game } = require('./models');
require('winston-daily-rotate-file');
require("dotenv").config();

var transport = new winston.transports.DailyRotateFile({
    filename: 'logs/app-%DATE%.log',
    datePattern: 'YYYY-MM-DD-HH',
    zippedArchive: true,
    maxSize: '20m',
    maxFiles: '14d'
  });
  global.logger = winston.createLogger({
    transports: [
      transport,
      new winston.transports.Console({
        level: 'silly',
        format: winston.format.combine(
                  winston.format.colorize(),
                  winston.format.simple()
        )
      })
    ],
    format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
    )
  });
//require('date.format');

const client = new Client({ intents: [
    GatewayIntentBits.GuildPresences, GatewayIntentBits.Guilds, GatewayIntentBits.GuildMembers, GatewayIntentBits.GuildBans, 
    GatewayIntentBits.GuildMessages, GatewayIntentBits.GuildMessageReactions, GatewayIntentBits.GuildMessageTyping, 
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages] });

client.mongoose = require("./util/mongoose");

// MONGO DB
client.mongoose.init();

client.on('error', console.error);
client.on('warn', console.warn);

client.login(process.env.TOKEN).then(c => {
    //loadBatch(client);
    //loadReactionGroup(client);
})

client.once(Events.ClientReady, async c => {
    console.log(`                                          
    _____ ____  _____    _____ _                    _____           _ 
    |     |    \|   __|  |   __| |_ ___ ___ _____   |   __|___ ___ _| |
    |   --|  |  |__   |  |__   |  _| -_| .'|     |  |   __| -_| -_| . |
    |_____|____/|_____|  |_____|_| |___|__,|_|_|_|  |__|  |___|___|___|
     
      `);
  
    logger.info(`Chargement des batchs ..`)
    await loadBatch(client);
    logger.info(`.. terminé`)

    // let game = await Game.findOne({ appid: 2310900 })
    // recupAchievements(client, game);
});