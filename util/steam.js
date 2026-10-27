const superagent = require('superagent');
const { GameRepository } = require('../repositories');
const { TAGS } = require('./constants');

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
    // https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?key=xxx&appid=220&l=french
    const reponse = await superagent.get('https://api.steampowered.com/ISteamUserStats/GetSchemaForGame/v2/?')
                                    .query({
                                        key: process.env.STEAM_API_KEY,
                                        appid: appid,
                                        l: 'french'
                                    });

    return reponse?.body?.game;
}

module.exports.fetchGame = async (appId, tag, nameTmp, steamClient) => {
    const app = await this.getAppDetails(appId);
    // -- recup nom si pas trouvé
    const communitApps = await this.getCommunityApp(appId)
    // - recup achievements (si présent)
    const resp = await this.getSchemaForGame(appId);

    let gameName = '', type = '', iconHash = '';
    let lSucces = [];
    let isMulti = false, isCoop = false, hasAchievements = false, isRemoved = false;

    if (!app?.body[appId]?.success) {
        // - chercher autre part car peut etre jeu "removed"
        if (communitApps?.[0]?.name) {
            isRemoved = true;
            gameName = communitApps[0]?.name;

            type = 'game'
        } else {
            gameName = nameTmp;
            type = 'unknown'
        }
    } else {
        type = app.body[appId].data?.type
        gameName = app.body[appId].data?.name
        let tags = app.body[appId].data?.categories
        let totalAch = app.body[appId].data?.achievements?.total;
        // au cas où pas de tags ou undefined
        tags = tags ? tags : [];
        // on ne garde que les tags qui nous intéresse (MULTI, COOP et ACHIEVEMENTS)
        isMulti = tags.some(tag => tag.id === TAGS.MULTI.id);
        isCoop = tags.some(tag => tag.id === TAGS.COOP.id);
        hasAchievements = totalAch ? true : false;
    }

    // si jeu a des succès
    if (resp?.availableGameStats?.achievements) {
        const achievements = resp.availableGameStats.achievements;

        lSucces = achievements.map(el => ({
            apiName: el.name,
            displayName: el.displayName,
            description: el.description,
            icon: el.icon,
            icongray: el.icongray
        }));
    } else {
        // - save tableau vide
        hasAchievements = false;
        lSucces = [];
    }

    // recup icon
    if (steamClient) {
        // Passing true as the third argument automatically requests access tokens, which are required for some apps
        let result = await steamClient.getProductInfo([appId], [], true);
        if (result.apps[appId].appinfo?.common?.icon)
            iconHash = result.apps[appId].appinfo.common.icon;

        // si nom unknown
        if (gameName === nameTmp && result.apps[appId].appinfo?.common?.name) {
            gameName = result.apps[appId].appinfo?.common?.name;
        }
    }

    // on update ou créé le jeu
    await GameRepository.upsertFromSteam({
        appid: appId,
        name: gameName,
        type: type,
        iconHash: iconHash,
        isMulti: isMulti,
        isCoop: isCoop,
        hasAchievements: hasAchievements,
        isRemoved: isRemoved,
        achievements: lSucces
    });

    return { gameName, type, isMulti, isCoop, hasAchievements, isRemoved };
}
