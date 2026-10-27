const BaseModel = require("./BaseModel");

/**
 * @typedef {Object} GameRow
 * @property {number} appid
 * @property {string | null} iconHash
 * @property {string} name
 * @property {string | null} type
 * @property {boolean} isMulti
 * @property {boolean} isCoop
 * @property {boolean} hasAchievements
 * @property {boolean} isRemoved
 */

class Game extends BaseModel {
    static get tableName() {
        return "Game";
    }

    static get idColumn() {
        return "appid";
    }

    static get relationMappings() {
        const Achievement = require("./Achievement");

        return {
            achievements: {
                relation: BaseModel.HasManyRelation,
                modelClass: Achievement,
                join: {
                    from: "Game.appid",
                    to: "Achievement.appid",
                },
            },
        };
    }
}

module.exports = Game;
