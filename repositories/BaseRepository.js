/**
 * Classe abstraite pour tous les repositories
 * Fournit les opérations CRUD de base
 */
class BaseRepository {
  constructor(Model) {
    this.Model = Model;
  }

  /**
   * Retourne tous les enregistrements
   */
  findAll() {
    return this.Model.query();
  }

  /**
   * Trouve un enregistrement par ID
   */
  findById(id) {
    return this.Model.query().findById(id);
  }

  /**
   * Crée un nouvel enregistrement
   */
  create(data) {
    return this.Model.query().insert(data);
  }

  /**
   * Crée plusieurs enregistrements en batch
   */
  createBatch(dataArray) {
    return this.Model.query().insert(dataArray);
  }

  /**
   * Met à jour un enregistrement
   */
  update(id, data) {
    return this.Model.query().findById(id).patch(data);
  }

  /**
   * Supprime un enregistrement
   */
  delete(id) {
    return this.Model.query().deleteById(id);
  }

  /**
   * Compte le nombre total d'enregistrements
   */
  count() {
    return this.Model.query().resultSize();
  }
}

module.exports = BaseRepository;
