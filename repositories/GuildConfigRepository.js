const BaseRepository = require('./BaseRepository');
const { GuildConfig } = require('../models/objection');

class GuildConfigRepository extends BaseRepository {
  constructor() {
    super(GuildConfig);
  }

  /**
   * Retourne la config d'une guild
   */
  findByGuildId(guildId) {
    return this.Model.query()
      .where('guildId', guildId)
      .first();
  }
}

module.exports = new GuildConfigRepository();
