const superagent = require('superagent');
const { Game } = require('../models');
const { EmbedBuilder } = require('discord.js');

module.exports.getAppDetails = async appid => {
    const response = await superagent.get('https://store.steampowered.com/api/appdetails/?')
    .query({
        key: process.env.STEAM_API_KEY,
        appids: appid
    });

    return response;
};

module.exports.getCommunityApp = async appid => {
    // https://api.steampowered.com/ICommunityService/GetApps/v1/?key=xxx&appids[0]=xxx
    const search = await superagent.get('https://api.steampowered.com/ICommunityService/GetApps/v1/')
                                    .query({
                                        key: process.env.STEAM_API_KEY,
                                        appids: {appid},
                                        language: 'fr'
                                    })
                                    .query(`appids[0]=${appid}`);
    return search.body?.response?.apps
}

module.exports.getSchemaForGame = async (appid) => {
    // https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=FC01A70E34CC7AE7174C575FF8D8A07F&appid=220&l=french
    const reponse = await superagent.get('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?')
                                    .query({
                                        key: process.env.STEAM_API_KEY,
                                        appid: appid,
                                        l: 'french'
                                    });

    return reponse?.body?.game;
}

module.exports.fetchGame = async (appId, tag, nameTmp, steamClient) => {
    // TODO check error 
    const app = await this.getAppDetails(appId);
    // -- recup nom si pas trouvé
    const communitApps = await this.getCommunityApp(appId)
    // - recup achievements (si présent)
    const resp = await this.getSchemaForGame(appId);

    let gameName = '', type = '', iconHash = '';
    let lSucces = [];
    let isMulti = false, isCoop = false, hasAchievements = false, isRemoved = false;
    let update = {};

    if (!app?.body[appId]?.success) {
        // - chercher autre part car peut etre jeu "removed"
        if (communitApps[0]?.name) {
            isRemoved = true;
            gameName = communitApps[0]?.name;
            
            type = 'game'
        } else {
            gameName = nameTmp;
            type = 'unknown'
            //throw 'Jeu introuvable !'
        }
    } else {
        type = app.body[appId].data?.type
        gameName = app.body[appId].data?.name
        let tags = app.body[appId].data?.categories
        let totalAch = app.body[appId].data?.achievements?.total;
        // au cas où pas de tags ou undefined
        tags = tags ? tags : [];
        // on ne garde que les tags qui nous intéresse (MULTI, COOP et ACHIEVEMENTS)
        // TODO voir pour faire autrement ? récupérer tous les tags peu importe et faire recherche sur les tags via Mongo ?
        isMulti = tags.some(tag => tag.id === TAGS.MULTI.id);
        isCoop = tags.some(tag => tag.id === TAGS.COOP.id);
        hasAchievements = totalAch ? true : false;
    }

    // si jeu a des succès
    if (resp.availableGameStats?.achievements) {
        const achievements = resp.availableGameStats.achievements;
        
        // - ajout & save succes dans Game
        achievements.forEach(el => {
            el['apiName'] = el['name'];
            delete el.name;
            delete el.defaultvalue;
            delete el.hidden;
        });

        lSucces = achievements;
    } else {
        // - save tableau vide
        hasAchievements = false;
        lSucces = [];
    }

    // recup icon
    if (steamClient) {
        // Passing true as the third argument automatically requests access tokens, which are required for some apps
        let result = await steamClient.getProductInfo([appId], [], true); 
        // if (result.apps[appId].appinfo?.common?.clienticon)
        //     iconHash = result.apps[appId].appinfo.common.clienticon;
        if (result.apps[appId].appinfo?.common?.icon)
            iconHash = result.apps[appId].appinfo.common.icon;
    }
    
    // TODO icon plutot que l'image ? -> recup via API..
    const gameUrlHeader = `https://steamcdn-a.akamaihd.net/steam/apps/${appId}/header.jpg`;
    
    const query = { appid: appId };
    update = {
        name: gameName,
        type: type,
        iconHash: iconHash,
        isMulti: isMulti,
        isCoop: isCoop,
        hasAchievements: hasAchievements,
        isRemoved: isRemoved,
        achievements: lSucces
    };
    
    // on update ou créé le jeu
    await Game.findOneAndUpdate(query, update, { upsert: true });

    const msgCustom = `'${type}' trouvé et mis à jour !`;

    //createLogs(client, interaction.guildId, `${gameName}`, `${msgCustom}`, '', GREEN)

    const embed = new EmbedBuilder()
        .setColor("#4CA64C")
        .setTitle(gameName)
        .setDescription(`${msgCustom}`)
        .setThumbnail(gameUrlHeader)
        .addFields(
            { name: '🌐 Multi', value: isMulti ? "✅" : "❌", inline: true },
            { name: '🤝 Co-op', value: isCoop ? "✅" : "❌", inline: true },
            { name: '🏆 Succès', value: hasAchievements ? "✅" : "❌", inline: true },
            // TODO ajouter lien Steam, ASTATS, CME etc
        )
        .setFooter({ text: `par ${tag}`});
    
    if (isRemoved)
        embed.addFields({ name: '🚫 Removed', value: "✅" })

    return embed;
}