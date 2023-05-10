const SteamUser = require('steam-user');
const { Game, GuildConfig } = require('../models');
const { EmbedBuilder, WebhookClient } = require('discord.js');
const { getSchemaForGame, fetchGame } = require('./steam');
const { retryAfter5min } = require('./utils');
let steamClient = new SteamUser();

// Charge les 'batch'
const loadBatch = async (client) => {
    loadSteamPICS(client);
}

const loadSteamPICS = async (client) => {
    console.log('.. init PICS');
    steamClient.setOption('enablePicsCache', true)
    //steamClient.setOption('changelistUpdateInterval', 1000)
    steamClient.logOn({ anonymous: true }); // Log onto Steam anonymously

    steamClient.on('changelist', async (changenumber, apps, packages) => {
        // console.log(' --- changelist ', changenumber);
        console.log("-- CHANGELIST " + apps.join(', '));
        apps
            // distinct
            .filter((value, index, array) => array.indexOf(value) === index)
            .forEach(async appid => {
                // console.log('--- changelist ', appid);
                // - recup jeu BDD
                let game = await Game.findOne({ appid: appid });
                
                if (!game) {
                    createNewGame(client, steamClient, appid);
                } else {
                    // - getProductInfo
                    let result = await steamClient.getProductInfo([appid], [], true); // Passing true as the third argument automatically requests access tokens, which are required for some apps
                    let appinfo = result.apps[appid].appinfo;

                    // si update est un jeu ou demo ?
                    if (appinfo?.common?.type === 'Game' || appinfo?.common?.type === 'Demo') {
                        // recup icon
                        await recupIcon(steamClient, appid, game);
                        
                        // - recup achievements (si présent)
                        recupAchievements(client, game);
                    }
                }
            });
        // console.log('--------');
    });

    steamClient.on('appUpdate', async (appid, data) => {
        console.log('-- UPDATE ', appid);
        // console.log(data);

        // si update est un jeu ou demo ?
        if (data?.appinfo?.common?.type === 'Game' || data?.appinfo?.common?.type === 'Demo') {
            // - recup jeu BDD
            // on le créé seulement, 
            let game = await Game.findOne({ appid: appid });
            if (!game) {
                createNewGame(client, steamClient, appid);
            } else {
                // recup icon
                await recupIcon(steamClient, appid, game);
                
                // - recup achievements (si présent)
                recupAchievements(client, game);
            }
        }
    });
}

const createNewGame = (client, steamClient, appid) => {
    console.log(` ** ${appid} pas dans bdd, on créé`);
    
    retryAfter5min(async function() {
        await fetchGame(appid, 'system', 'unknown', steamClient);

        // - recup GameDB récemment créé
        let game = await Game.findOne({ appid: appid });
        
        // si pas de succès, balek
        if (game.achievements.length !== 0) {
            let gamename = game.name;
    
            // - limit 80 caracteres
            if (gamename.length > 80)
                gamename = gamename.substring(0, 76) + "...";
        
            const gameUrlHeader = `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`;
            
            const links = createGameLinks(game.appid);
    
            const jeuEmbed = new EmbedBuilder()
                .setTitle(`🆕 ${gamename}`)
                .addFields({ name: 'Liens', value: links })
                .setThumbnail(gameUrlHeader)
                .setColor(0x00FFFF)
                .setTimestamp();
                
            const addedEmbed = new EmbedBuilder()
                .setTitle(`avec ${game.achievements.length} succès`)
                .setColor(0x00FFFF);
    
            sendToWebhook(client, game, [jeuEmbed, addedEmbed]);
        }
    });
}

const recupIcon = async (steamClient, appId, game) => {
    // recup icon
    // Passing true as the third argument automatically requests access tokens, which are required for some apps
    let result = await steamClient.getProductInfo([appId], [], true); 
    // if (result.apps[appId].appinfo?.common?.clienticon)
    // game.iconHash = result.apps[appId].appinfo.common.clienticon;
    // else 
    if (result.apps[appId].appinfo?.common?.icon)
        game.iconHash = result.apps[appId].appinfo.common.icon;

    await game.save();
}

const recupAchievements = (client, game) => {
    // - si trop de requete (error 429) => timeout 5min, et on recommence
    retryAfter5min(async function() {
        const resp = await getSchemaForGame(game.appid);
        
        console.log(` ** ${resp.availableGameStats?.achievements?.length} ?`);

        // if (resp.availableGameStats?.achievements) {
        //     console.log('ok 1')
        // } else {
        //     console.log('not ok 1')
        // }
        // console.log('--')
        // if (resp.availableGameStats?.achievements?.length) {
        //     console.log('ok 2')
        // } else {
        //     console.log('not ok 2')
        // }
        // console.log('--')
        // if (Array.isArray(resp.availableGameStats?.achievements)) {
        //     console.log('ok 3')
        // } else {
        //     console.log('not ok 3')
        // }
        // console.log('--')
        // if (Array.isArray(resp.availableGameStats?.achievements) && resp.availableGameStats?.achievements.length) {
        //     console.log('ok 4')
        // } else {
        //     console.log('not ok 4')
        // }
        // console.log('--')

        // si jeu a des succès
        if (resp.availableGameStats?.achievements) {
            console.log(" - " + game.appid + " a des succes");
            const achievementsDB = game.achievements;
            const achievements = resp.availableGameStats.achievements;

            // - ajout & save succes dans Game
            achievements.forEach(el => {
                el['apiName'] = el['name'];
                delete el.name;
                delete el.defaultvalue;
                delete el.hidden;
            });

            // - comparer succès
            console.log(" - compare succes");
                // - ajouté (difference entre PICS et DB)
            const deleted = achievementsDB.filter(({ apiName: api1 }) => !achievements.some(({ apiName: api2 }) => api2 === api1));
                // - supprimé (difference entre DB et PICS)
            const added = achievements.filter(({ apiName: api1 }) => !achievementsDB.some(({ apiName: api2 }) => api2 === api1));
            console.log(" --- new " + (game.achievements.length === 0));
            console.log(" --- deleted " + deleted.length);
            console.log(" --- added " + added.length);

            let deletedStr = deleted.map(a => `**${a.displayName}** : ${a.description ?? ''}`).join('\n');
            // - limit 4096 caracteres
            if (deletedStr.length > 4000)
                deletedStr = deletedStr.substring(0, 4000) + "...";
            let addedStr = added.map(a => `**${a.displayName}** : ${a.description ?? ''}`).join('\n');
            // - limit 4096 caracteres
            if (addedStr.length > 4000)
                addedStr = addedStr.substring(0, 4000) + "...";

            const gameUrlHeader = `https://steamcdn-a.akamaihd.net/steam/apps/${game.appid}/header.jpg`;
            const links = createGameLinks(game.appid);

            // - embed info jeu
            const embeds = [];
            const jeuEmbed = new EmbedBuilder()
                .setTitle(`${game.name}`)
                .addFields({ name: 'Liens', value: links })
                .setThumbnail(gameUrlHeader)
                .setColor(0x00FFFF)
                .setTimestamp();
            embeds.push(jeuEmbed);

            // - embed deleted / added succès
            const deletedEmbed = new EmbedBuilder()
                .setTitle('❌ Supprimé')
                .setColor("#cc0000");
                // - nouveau ? (ssi 0 succes dans game) 
            const newSucces = game.achievements.length === 0;
            const addedEmbed = new EmbedBuilder()
                .setTitle(newSucces ? '✅ Nouveau' : '➕ Ajouté')
                .setColor(newSucces ? "#ffa500" : "#4CA64C");

            if (deleted.length > 0) {
                console.log(" - DELETED");
                deletedEmbed.setDescription(`${deleted.length} succès supprimé${deleted.length > 1 ? 's' : ''}
                    ${deletedStr}`);
                embeds.push(deletedEmbed);
            }
            if (added.length > 0) {
                if (newSucces) {
                    console.log(" - NEW");
                    addedEmbed.setDescription(`**${added.length}** nouveau${added.length > 1 ? 'x' : ''} succès !`);
                } else {
                    console.log(" - ADDED");
                    addedEmbed.setDescription(`${added.length} nouveau${added.length > 1 ? 'x' : ''} succès (${achievements.length} au total)
                        ${addedStr}`);
                }
                embeds.push(addedEmbed);
            }

            if (deleted.length > 0 || added.length > 0) {
                sendToWebhook(client, game, embeds, jeuEmbed, deletedEmbed, addedEmbed, {nouveau: newSucces, ajout: added.length > 0, suppr: deleted.length > 0});
            }

            // et on save
            console.log(" - save");
            game.achievements = achievements;
            await game.save();
        } else {
            // TODO si genre tout supprimer ? tester si game a des succes du coup
        }
    });
}

const createGameLinks = (appid) => {
    const steamLink = `[Steam](https://steamcommunity.com/app/${appid})`;
    const astatLink = `[AStats](https://astats.astats.nl/astats/Steam_Game_Info.php?AppID=${appid})`;
    const shLink = `[SteamHunters](https://steamhunters.com/apps/${appid}/achievements)`;
    const cmeLink = `[Completionist](https://completionist.me/steam/app/${appid})`;

    return `${steamLink} | ${astatLink} | ${shLink} | ${cmeLink}`;
}



const sendToWebhook = (client, game, embeds, jeuEmbed, deletedEmbed, addedEmbed, {nouveau = false, ajout = false, suppr = false} = {}) => {
    
    console.log(" - send webhook : " + nouveau + ", " + ajout + ", " + suppr);

    client.guilds.cache.forEach(async guild => {
        const guildDB = await GuildConfig.findOne({guildId: guild.id});
        const webhookUrl = guildDB?.webhook["feed_achievement"];
        const idFeedChannel = guildDB?.channels["feed_achievement"];
        const feedChannel = await client.channels.cache.get(idFeedChannel);

        if (webhookUrl && feedChannel) {
            console.log("   - ok go");
            const webhookClient = new WebhookClient({ url: webhookUrl });
            
            let avatarURL = '';
            if (game.iconHash) {
                // avatarURL = `http://media.steampowered.com/steamcommunity/public/images/apps/${game.appid}/${game.iconHash}.ico`;
                avatarURL = `https://cdn.cloudflare.steamstatic.com/steamcommunity/public/images/apps/${game.appid}/${game.iconHash}.jpg`;
            } else {
                avatarURL = 'https://avatars.cloudflare.steamstatic.com/cc288975bf62c132f5132bc3452960f3341b665c_full.jpg';
            }
            
            // envoi vers thread
            // cas particulier
            if (ajout && suppr) {
                console.log("   - AJOUT & SUPPR");
                let threadAdd = await getThread(feedChannel, "Ajouts")
                let threadDel = await getThread(feedChannel, "Supprimés")

                await webhookClient.send({
                    username: game.name,
                    avatarURL: avatarURL,
                    embeds: [jeuEmbed, addedEmbed],
                    threadId: threadAdd.id
                });
                console.log("   - AJOUT send");

                await webhookClient.send({
                    username: game.name,
                    avatarURL: avatarURL,
                    embeds: [jeuEmbed, deletedEmbed],
                    threadId: threadDel.id
                });
                console.log("   - DELETE send");
            } else {      
                // nom thread
                let threadName = nouveau ? "Nouveaux" : (ajout ? "Ajouts" : ( suppr ? "Supprimés" : "Error"));
                console.log("   - thread " + threadName);
    
                // déplacement vers thread
                let thread = await getThread(feedChannel, threadName)

                await webhookClient.send({
                    username: game.name,
                    avatarURL: avatarURL,
                    embeds: embeds,
                    threadId: thread.id
                });
                console.log("   - " + threadName + " send");
            }
        } else {
            logger.warn('URL Webhook ou salon feed non défini !');
        }
    });
}

const getThread = async (feedChannel, threadName) => {
    let archived = await feedChannel.threads.fetchArchived();
    let thread = archived.threads.filter(x => x.name === threadName);

    // si pas archivé, on regarde s'il est actif
    if (thread.size === 0) {
        let active = await feedChannel.threads.fetchActive();
        thread = active.threads.filter(x => x.name === threadName);
    }

    // si tjs pas actif, on le créé
    if (thread.size === 0) {
        logger.info('.. création thread feed ' + threadName)
        
        thread = await feedChannel.threads.create({
            name: threadName,
            //autoArchiveDuration: 60,
            reason: 'Feed ' + threadName + ' succès.',
        });
    } else {
        thread = thread.first();
    }

    return thread;
}

module.exports = {
    loadBatch,
    sendToWebhook,
    recupAchievements
}