/**
 * payment_webhook.js
 * Helix Forge - Webhook de confirmation de paiement (Stripe / PayPal)
 *
 * Reçoit les notifications de paiement réussi, vérifie l'intégrité de la transaction,
 * génère une licence via license_generator.js, la stocke via license_store.js,
 * et envoie la clé par email à l'acheteur.
 *
 * Endpoint exposé : POST /webhook/payment (configurable)
 */

const express = require('express');
const router = express.Router();
const licenseGenerator = require('./license_generator');
const licenseStore = require('./license_store');
const nodemailer = require('nodemailer'); // Pour l'envoi d'email
const crypto = require('crypto');

// ========== CONFIGURATION ==========
// Variables d'environnement recommandées :
// STRIPE_WEBHOOK_SECRET, PAYPAL_WEBHOOK_ID, PAYPAL_CLIENT_ID, PAYPAL_CLIENT_SECRET
// SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, EMAIL_FROM
// WEBHOOK_TOKEN (optionnel, pour sécurisation additionnelle)

const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_stripe';
const PAYPAL_WEBHOOK_ID = process.env.PAYPAL_WEBHOOK_ID || 'test-paypal-webhook-id';
// Pour la vérification PayPal, nous utiliserons une méthode simplifiée ou SDK.
// Dans cet exemple, nous vérifions un en-tête personnalisé ou le contenu.

// Mapping des IDs de produit Stripe/PayPal vers les types de licence
const PRODUCT_TO_LICENSE_TYPE = {
    // Stripe Product IDs (à remplacer par vos IDs réels)
    'prod_studio_annual': 'STUDIO',
    'prod_lifetime': 'LIFETIME',
    'prod_api_monthly': 'API',
    // PayPal Plan IDs (si utilisés)
    'P-XXX123': 'STUDIO',
    'P-YYY456': 'LIFETIME',
    'P-ZZZ789': 'API'
};

// Configuration du transporteur email (exemple avec SMTP)
let transporter = null;
if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
        }
    });
} else {
    console.warn("⚠️ SMTP non configuré. L'envoi d'email sera simulé (console log).");
}

/**
 * Envoie la clé de licence par email à l'utilisateur.
 * @param {string} toEmail - Adresse email du client
 * @param {string} licenseKey - Clé générée
 * @param {string} licenseType - Type de licence
 * @param {string|null} expiresAt - Date d'expiration (ISO)
 */
async function sendLicenseEmail(toEmail, licenseKey, licenseType, expiresAt) {
    const subject = `🔑 Votre licence Helix Forge - ${licenseType}`;
    const expirationText = expiresAt ? `Cette licence est valable jusqu'au ${new Date(expiresAt).toLocaleDateString('fr-FR')}.` : 'Licence à vie, sans expiration.';
    const html = `
        <h2>Merci pour votre achat sur Helix Forge !</h2>
        <p>Votre licence <strong>${licenseType}</strong> a été générée avec succès.</p>
        <p><strong>Clé d'activation :</strong></p>
        <pre style="background:#1e1e1e; padding:12px; border-radius:8px; font-size:1.1rem;">${licenseKey}</pre>
        <p>${expirationText}</p>
        <p>Pour activer Helix Forge, copiez cette clé dans l'écran d'activation (activate.html).</p>
        <p>Vous pouvez également consulter votre clé dans votre espace client.</p>
        <br>
        <p>— L'équipe Helix Forge</p>
    `;
    const text = `Merci pour votre achat !\nVotre clé Helix Forge (${licenseType}) : ${licenseKey}\n${expirationText}\nActivez-la sur votre logiciel.`;

    if (transporter) {
        try {
            await transporter.sendMail({
                from: process.env.EMAIL_FROM || 'no-reply@helixforge.ai',
                to: toEmail,
                subject: subject,
                text: text,
                html: html
            });
            console.log(`📧 Email envoyé à ${toEmail}`);
        } catch (err) {
            console.error("Erreur envoi email :", err);
            // On ne bloque pas le processus, la clé est déjà stockée
        }
    } else {
        console.log(`[SIMULATION] Email à ${toEmail} :\n${text}`);
    }
}

/**
 * Vérification de la signature Stripe
 * @param {Object} req - Requête Express
 * @returns {Object|null} Événement Stripe ou null si invalide
 */
function verifyStripeWebhook(req) {
    const sig = req.headers['stripe-signature'];
    if (!sig) return null;
    const rawBody = req.rawBody; // Nécessite express.raw({ type: 'application/json' })
    try {
        const event = stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET);
        return event;
    } catch (err) {
        console.error("Stripe signature invalide :", err.message);
        return null;
    }
}

/**
 * Vérification simplifiée pour PayPal (vérification d'un en-tête personnalisé et du corps)
 * En production, utilisez le SDK PayPal avec vérification du webhook.
 */
function verifyPaypalWebhook(req) {
    // PayPal envoie généralement un en-tête "paypal-transmission-id"
    const transmissionId = req.headers['paypal-transmission-id'];
    if (!transmissionId) return false;
    // Ici vous pourriez appeler l'API PayPal pour valider le webhook.
    // Pour l'exemple, on accepte si le contenu contient "COMPLETED" et que l'ID est présent.
    // En vrai, il faut vérifier la signature avec le certificat PayPal.
    return true; // À renforcer en production
}

/**
 * Extrait les informations du webhook Stripe
 */
function extractStripeData(event) {
    const session = event.data.object;
    // Pour checkout.session.completed
    const amountTotal = session.amount_total / 100; // en centimes -> euros
    const productId = session.metadata?.product_id || session.lines?.data[0]?.price?.product;
    const customerEmail = session.customer_details?.email || session.customer_email;
    return { amount: amountTotal, productId, email: customerEmail };
}

/**
 * Extrait les informations du webhook PayPal (pour v2 Webhooks)
 */
function extractPaypalData(reqBody) {
    // Exemple de structure d'un webhook PayPal pour "PAYMENT.CAPTURE.COMPLETED"
    const resource = reqBody.resource;
    const amount = resource.amount?.value ? parseFloat(resource.amount.value) : null;
    const productId = reqBody.resource?.custom_id || reqBody.resource?.plan_id; // Selon votre intégration
    const email = resource.payer?.email_address;
    return { amount, productId, email };
}

/**
 * Endpoint principal qui reçoit les webhooks Stripe et PayPal.
 * On détermine le type de webhook via l'URL ou l'en-tête.
 */
router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        const userAgent = req.headers['user-agent'] || '';
        let eventData = null;
        let gateway = null;

        // Détection Stripe (en-tête stripe-signature)
        if (req.headers['stripe-signature']) {
            const event = verifyStripeWebhook(req);
            if (!event) {
                return res.status(400).send('Signature Stripe invalide');
            }
            if (event.type === 'checkout.session.completed') {
                eventData = extractStripeData(event);
                gateway = 'stripe';
            } else {
                // Ignorer les autres événements
                return res.status(200).send('Événement ignoré');
            }
        }
        // Détection PayPal (via en-tête personnalisé ou user-agent)
        else if (req.headers['paypal-transmission-id'] || userAgent.includes('PayPal')) {
            if (!verifyPaypalWebhook(req)) {
                return res.status(400).send('Signature PayPal invalide');
            }
            const body = req.body;
            if (body.event_type === 'PAYMENT.CAPTURE.COMPLETED' || body.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
                eventData = extractPaypalData(body);
                gateway = 'paypal';
            } else {
                return res.status(200).send('Événement PayPal ignoré');
            }
        }
        else {
            return res.status(400).send('Webhook non reconnu (ni Stripe ni PayPal)');
        }

        // Validation des données essentielles
        if (!eventData || !eventData.email || !eventData.productId) {
            console.warn('Données manquantes dans le webhook :', eventData);
            return res.status(400).send('Données incomplètes');
        }

        // Déterminer le type de licence à partir du productId
        const licenseType = PRODUCT_TO_LICENSE_TYPE[eventData.productId];
        if (!licenseType) {
            console.error(`Produit non mappé : ${eventData.productId}`);
            return res.status(400).send('Type de licence inconnu');
        }

        // Optionnel : vérifier le montant pour éviter les fraudes
        const expectedPrices = { STUDIO: 149, LIFETIME: 449, API: 59 };
        if (eventData.amount && Math.abs(eventData.amount - expectedPrices[licenseType]) > 0.01) {
            console.error(`Montant inattendu : ${eventData.amount} au lieu de ${expectedPrices[licenseType]}`);
            return res.status(400).send('Montant invalide');
        }

        // Générer la licence
        const license = await licenseGenerator.generateLicense(licenseType, {
            metadata: {
                gateway: gateway,
                transactionId: req.body.id || req.body.resource?.id,
                email: eventData.email
            },
            email: eventData.email
        });

        // Stocker la licence (déjà fait dans generateLicense, mais on sauvegarde explicitement si besoin)
        // licenseStore.saveLicense(license); // generateLicense appelle déjà saveLicense

        // Envoyer la clé par email
        await sendLicenseEmail(eventData.email, license.licenseKey, licenseType, license.expiresAt);

        // Répondre à Stripe/PayPal (succès)
        res.status(200).json({ received: true, license_key: license.licenseKey });
    } catch (err) {
        console.error('Erreur lors du traitement du webhook :', err);
        res.status(500).send('Erreur interne');
    }
});

module.exports = router;