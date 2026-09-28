/**
 * @author Luuxis
 * Luuxis License v1.0 (voir fichier LICENSE pour les détails en FR/EN)
 *
 * Facade sur la base du launcher. Le stockage reel (electron-store, cle de
 * chiffrement, fichiers) vit desormais dans le main process ; cette classe ne
 * fait que relayer, en gardant la meme signature qu'avant pour les appelants.
 */

class database {
    async createData(tableName, data) {
        return await window.luuxAPI.db.create(tableName, data);
    }

    async readData(tableName, key = 1) {
        return await window.luuxAPI.db.read(tableName, key);
    }

    async readAllData(tableName) {
        return await window.luuxAPI.db.readAll(tableName);
    }

    async updateData(tableName, data, key = 1) {
        return await window.luuxAPI.db.update(tableName, data, key);
    }

    async deleteData(tableName, key = 1) {
        return await window.luuxAPI.db.delete(tableName, key);
    }

    async initDefaultData() {
        return await window.luuxAPI.db.initDefault();
    }
}

export default database;
