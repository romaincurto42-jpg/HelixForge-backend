// ============================================================================
// HF3 — Seed Manager
// Génère des seeds stables pour la reproductibilité biomorphique
// Version production — avec logging, validation, et utilitaires
// ============================================================================

/**
 * @typedef {Object} SeedManagerOptions
 * @property {number} [initialSeed=123456789] - Graine initiale
 * @property {boolean} [enableLogging=false] - Activer les logs
 * @property {string} [logLevel='info'] - Niveau de log ('error', 'warn', 'info', 'debug')
 */

/**
 * Gestionnaire de seeds déterministes pour la reproductibilité.
 * Utilise un générateur congruentiel linéaire (LCG) standard.
 */
class SeedManager {
    /** @type {number} */ #seed;
    /** @type {boolean} */ #logging;
    /** @type {Object} */ #logLevels;
    /** @type {string} */ #currentLogLevel;

    /**
     * Crée une instance du gestionnaire de seeds.
     * @param {SeedManagerOptions} [options] - Options de configuration
     */
    constructor(options = {}) {
        const {
            initialSeed = 123456789,
            enableLogging = false,
            logLevel = 'info'
        } = options;

        this.#seed = this.#validateSeed(initialSeed);
        this.#logging = enableLogging;
        this.#logLevels = { error: 0, warn: 1, info: 2, debug: 3 };
        this.#currentLogLevel = this.#logLevels[logLevel] ?? this.#logLevels.info;

        if (this.#logging) {
            this.#log('info', `SeedManager initialisé avec seed = ${this.#seed}`);
        }
    }

    /**
     * Valide et normalise une seed.
     * @param {any} seed - Valeur à valider
     * @returns {number} Seed valide (entier 32 bits non signé)
     * @throws {TypeError} Si la seed n'est pas un nombre valide
     * @private
     */
    #validateSeed(seed) {
        let num = Number(seed);
        if (isNaN(num)) {
            throw new TypeError(`Seed invalide: ${seed} n'est pas un nombre`);
        }
        // Conversion en entier 32 bits non signé
        num = Math.floor(Math.abs(num)) % 4294967296;
        if (num === 0) num = 123456789; // éviter seed zéro (provoque une période nulle)
        return num;
    }

    /**
     * Enregistre un message si le logging est activé.
     * @param {string} level - Niveau ('error', 'warn', 'info', 'debug')
     * @param {string} message - Message à logger
     * @param {any} [data] - Données optionnelles
     * @private
     */
    #log(level, message, data = null) {
        if (!this.#logging) return;
        if ((this.#logLevels[level] ?? 0) > this.#currentLogLevel) return;
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [SeedManager:${level.toUpperCase()}]`;
        if (data !== null) {
            console.log(prefix, message, data);
        } else {
            console.log(prefix, message);
        }
    }

    /**
     * Définit une nouvelle seed.
     * @param {number} seed - Nouvelle graine
     * @returns {void}
     */
    setSeed(seed) {
        try {
            const newSeed = this.#validateSeed(seed);
            if (newSeed === this.#seed) {
                this.#log('debug', `setSeed: seed inchangée (${newSeed})`);
                return;
            }
            this.#seed = newSeed;
            this.#log('info', `Seed modifiée : ${this.#seed}`);
        } catch (err) {
            this.#log('error', `setSeed échoué : ${err.message}`);
            throw err;
        }
    }

    /**
     * Retourne la seed courante.
     * @returns {number} Seed actuelle
     */
    getSeed() {
        return this.#seed;
    }

    /**
     * Génère un nombre pseudo-aléatoire dans [0, 1).
     * Met à jour la seed.
     * @returns {number} Nombre aléatoire entre 0 (inclus) et 1 (exclus)
     */
    random() {
        // LCG classique : seed = (seed * a + c) mod m
        // a = 1664525, c = 1013904223, m = 2^32
        this.#seed = (this.#seed * 1664525 + 1013904223) >>> 0;
        const result = this.#seed / 4294967296;
        this.#log('debug', `random() -> ${result} (seed interne ${this.#seed})`);
        return result;
    }

    /**
     * Génère un entier aléatoire entre min (inclus) et max (exclus).
     * @param {number} min - Borne inférieure (incluse)
     * @param {number} max - Borne supérieure (exclue)
     * @returns {number} Entier aléatoire
     * @throws {RangeError} Si min >= max
     */
    randomInt(min, max) {
        if (min >= max) {
            throw new RangeError(`randomInt: min (${min}) doit être < max (${max})`);
        }
        const range = max - min;
        const value = min + Math.floor(this.random() * range);
        this.#log('debug', `randomInt(${min}, ${max}) -> ${value}`);
        return value;
    }

    /**
     * Génère un nombre flottant aléatoire entre min (inclus) et max (exclus).
     * @param {number} min - Borne inférieure (incluse)
     * @param {number} max - Borne supérieure (exclue)
     * @returns {number} Nombre flottant
     * @throws {RangeError} Si min >= max
     */
    randomFloat(min, max) {
        if (min >= max) {
            throw new RangeError(`randomFloat: min (${min}) doit être < max (${max})`);
        }
        const value = min + this.random() * (max - min);
        this.#log('debug', `randomFloat(${min}, ${max}) -> ${value}`);
        return value;
    }

    /**
     * Retourne une copie indépendante du SeedManager (même seed).
     * @returns {SeedManager} Nouvelle instance avec la même seed
     */
    clone() {
        const clone = new SeedManager({ initialSeed: this.#seed, enableLogging: this.#logging });
        // Conserver le niveau de log
        clone.#currentLogLevel = this.#currentLogLevel;
        return clone;
    }

    /**
     * Réinitialise le générateur à la seed par défaut (123456789).
     */
    reset() {
        this.#seed = 123456789;
        this.#log('info', 'SeedManager réinitialisé à la valeur par défaut');
    }

    /**
     * Active ou désactive le logging.
     * @param {boolean} enabled - État du logging
     */
    setLogging(enabled) {
        this.#logging = enabled;
        if (enabled) {
            this.#log('info', 'Logging activé');
        }
    }

    /**
     * Définit le niveau de log.
     * @param {'error'|'warn'|'info'|'debug'} level - Niveau
     */
    setLogLevel(level) {
        const lvl = this.#logLevels[level];
        if (lvl !== undefined) {
            this.#currentLogLevel = lvl;
            this.#log('info', `Niveau de log changé à ${level}`);
        } else {
            this.#log('warn', `Niveau de log inconnu: ${level}`);
        }
    }

    /**
     * Retourne des statistiques sur le générateur.
     * @returns {{seed: number, logging: boolean, logLevel: string}}
     */
    getStats() {
        const levelName = Object.entries(this.#logLevels).find(([, v]) => v === this.#currentLogLevel)?.[0] || 'info';
        return {
            seed: this.#seed,
            logging: this.#logging,
            logLevel: levelName
        };
    }
}

// Singleton par défaut pour une compatibilité ascendante
const defaultSeedManager = new SeedManager({ enableLogging: false });

// Exporter la classe et le singleton
module.exports = {
    SeedManager,
    defaultSeedManager
};
