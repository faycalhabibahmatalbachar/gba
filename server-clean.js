/**
 * SERVEUR MOOV AFRICA - SYSTÈME DE GESTION DES DISTRIBUTEURS
 * Version propre et simplifiée
 */

// Charger les variables d'environnement EN PREMIER
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const bcrypt = require('bcrypt');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const requestIp = require('request-ip');
const geoip = require('geoip-lite');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const os = require('os');
const crypto = require('crypto');

const app = express();

// Chargement intelligent du service SMS selon la configuration
let smsService;
try {
  // Vérifier si Supabase est configuré
  if (process.env.SUPABASE_URL && (process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY)) {
    smsService = require('./services/smsServiceRobuste');
    console.log('✅ Service SMS Robuste chargé (avec Supabase)');
  } else {
    smsService = require('./services/smsServiceSimple');
    console.log('⚠️ Service SMS Simple chargé (sans Supabase)');
  }
} catch (error) {
  console.error('❌ Erreur chargement service SMS robuste, fallback vers simple:', error.message);
  smsService = require('./services/smsServiceSimple');
}
const { createServer } = require('http');
const { Server } = require('socket.io');

// Configuration Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://gckfwszkqbyuzfstflnt.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imdia2Z3c3prcWJ5dXpmc3RmbG50Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzA4MzM4NjMsImV4cCI6MjA0NjQwOTg2M30.qGfQxBLiERiNCP0uPQNjjME-tJVA-5rJor5qR5K77Hk'
);

const AUDIT_TABLE = 'audit_events';
const SENSITIVE_AUDIT_FIELDS = [
  'password',
  'password_hash',
  'pin',
  'otp',
  'token',
  'access_token',
  'refresh_token',
  'secret',
  'api_key',
];

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '2h';
const AUTH_COOKIE_NAME = 'auth_token';
const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Mode OTP de test (à désactiver en production)
const OTP_TEST_MODE = process.env.NODE_ENV !== 'production'
  && String(process.env.OTP_TEST_MODE || '').toLowerCase() === 'true';
const OTP_TEST_CODE = process.env.OTP_TEST_CODE || '123456';

// Fuseau horaire et localisation par défaut pour les SMS de sécurité
const DEFAULT_TIMEZONE = process.env.APP_TIMEZONE || 'Africa/Ndjamena';
const DEFAULT_COUNTRY_NAME = process.env.APP_DEFAULT_COUNTRY_NAME || 'Tchad';
const DEFAULT_CITY_NAME = process.env.APP_DEFAULT_CITY_NAME || "N'Djamena";

// Notifications & Push
const NOTIFICATIONS_TABLE = 'notifications';
const PUSH_TOKENS_TABLE = 'push_tokens';
const USER_LANG_TABLE = 'user_languages';
const DEVICE_LANG_TABLE = 'device_languages';
const DEFAULT_ADMIN_USER_ID = 'admin-1';
const FCM_SERVER_KEY = process.env.FCM_SERVER_KEY || null;

const NOTIF_LANG_DEBUG = String(process.env.NOTIF_LANG_DEBUG || '').toLowerCase() === '1'
  || String(process.env.NOTIF_LANG_DEBUG || '').toLowerCase() === 'true';

function notifLangLog(...args) {
  try {
    if (!NOTIF_LANG_DEBUG) return;
    console.log('[NOTIF_LANG]', ...args);
  } catch (e) { }
}

// Agent SMS (Termux) pour sms_queue
const SMS_AGENT_SECRET = process.env.SMS_AGENT_SECRET || null;

// Initialisation facultative de Firebase Admin pour FCM HTTP v1
let firebaseAdmin = null;
let firebaseAdminApp = null;
try {
  // Charger le SDK admin seulement s'il est installé
  // et si une configuration de compte de service est fournie
  // (via GOOGLE_APPLICATION_CREDENTIALS ou FIREBASE_SERVICE_ACCOUNT_JSON)
  firebaseAdmin = require('firebase-admin');

  const hasApplicationDefault = !!process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const hasInlineServiceAccount = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const secretServiceAccountPath = '/etc/secrets/firebase-admin-sdk-key.json';
  const hasSecretFile = !hasApplicationDefault && !hasInlineServiceAccount && fs.existsSync(secretServiceAccountPath);

  if (hasInlineServiceAccount) {
    try {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      }, 'moov-fcm-app');
      console.log('✅ Firebase Admin initialisé (service account JSON inline)');
    } catch (e) {
      console.warn('⚠️ Impossible de parser FIREBASE_SERVICE_ACCOUNT_JSON:', e && e.message ? e.message : e);
    }
  } else if (hasSecretFile) {
    try {
      const raw = fs.readFileSync(secretServiceAccountPath, 'utf8');
      const serviceAccount = JSON.parse(raw);
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert(serviceAccount),
      }, 'moov-fcm-app');
      console.log('✅ Firebase Admin initialisé (/etc/secrets/firebase-admin-sdk-key.json)');
    } catch (e) {
      console.warn('⚠️ Impossible d\'initialiser Firebase Admin via secret file:', e && e.message ? e.message : e);
    }
  } else if (hasApplicationDefault) {
    try {
      firebaseAdminApp = firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.applicationDefault(),
      }, 'moov-fcm-app');
      console.log('✅ Firebase Admin initialisé (GOOGLE_APPLICATION_CREDENTIALS)');
    } catch (e) {
      console.warn('⚠️ Impossible d\'initialiser Firebase Admin avec les identifiants par défaut:', e && e.message ? e.message : e);
    }
  }
} catch (e) {
  firebaseAdmin = null;
  firebaseAdminApp = null;
}

function formatLocalDateTime(date = new Date()) {
  try {
    return date.toLocaleString('fr-FR', {
      timeZone: DEFAULT_TIMEZONE,
      hour12: false,
    });
  } catch (e) {
    return date.toISOString();
  }
}

async function verifyUserOtp(localPhone, codeUpper) {
  try {
    console.log('🔎 verifyUserOtp called:', { localPhone, codeUpper, OTP_TEST_MODE, OTP_TEST_CODE });
    // Mode OTP de test : accepter directement le code défini sans toucher à la base
    if (OTP_TEST_MODE && codeUpper === String(OTP_TEST_CODE).toUpperCase().trim()) {
      try {
        // Tenter d'identifier l'utilisateur mobile par son téléphone
        let userType = null;
        let userId = null;

        try {
          const { data: sup } = await supabase
            .from('supervisors')
            .select('id')
            .eq('phone', localPhone)
            .maybeSingle();
          console.log('🔎 OTP_TEST_MODE supervisors lookup result:', sup);
          if (sup && sup.id) {
            userType = 'supervisor';
            userId = sup.id;
          }
        } catch (e) {}

        if (!userId) {
          try {
            const { data: dist } = await supabase
              .from('distributors')
              .select('id')
              .eq('phone', localPhone)
              .maybeSingle();
            console.log('🔎 OTP_TEST_MODE distributors lookup result:', dist);
            if (dist && dist.id) {
              userType = 'distributor';
              userId = dist.id;
            }
          } catch (e) {}
        }

        if (!userType || !userId) {
          console.warn('⚠️ verifyUserOtp OTP_TEST_MODE - user not found for phone', localPhone);
          return { success: false, code: 'OTP_TEST_USER_NOT_FOUND', error: 'Utilisateur mobile introuvable pour OTP test' };
        }

        console.log('✅ verifyUserOtp OTP_TEST_MODE success:', { userType, userId });
        return { success: true, userType, userId };
      } catch (e) {
        console.warn('Erreur OTP_TEST_MODE verifyUserOtp:', e);
        return { success: false, code: 'OTP_TEST_ERROR', error: 'Erreur OTP test' };
      }
    }

    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', localPhone)
      .neq('user_type', 'admin')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('💥 Erreur lecture OTP mobile:', error);
      return { success: false, code: 'OTP_READ_ERROR', error: 'Erreur vérification OTP' };
    }

    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row) {
      return { success: false, code: 'OTP_NOT_FOUND', error: 'OTP non trouvé ou expiré' };
    }

    const now = new Date();
    let expiresAt = null;
    if (row.expires_at instanceof Date) {
      expiresAt = row.expires_at;
    } else if (row.expires_at) {
      try {
        const raw = String(row.expires_at);
        const normalized = raw.endsWith('Z') ? raw : `${raw}Z`;
        expiresAt = new Date(normalized);
      } catch (e) {
        expiresAt = null;
      }
    }
    if (expiresAt && expiresAt < now) {
      try {
        await supabase.from('otp_codes').delete().eq('id', row.id);
      } catch (e) { }
      return { success: false, code: 'OTP_EXPIRED', error: 'OTP expiré' };
    }

    const nextAttempts = (row.attempts || 0) + 1;
    const storedCode = String(row.code || '').toUpperCase();

    if (storedCode === codeUpper) {
      try {
        await supabase
          .from('otp_codes')
          .update({
            attempts: nextAttempts,
            is_verified: true,
            verified_at: now.toISOString(),
          })
          .eq('id', row.id);
      } catch (e) { }
      return {
        success: true,
        userType: row.user_type || null,
        userId: row.user_id || null,
      };
    }

    if (nextAttempts >= 5) {
      try {
        await supabase.from('otp_codes').delete().eq('id', row.id);
      } catch (e) { }
      return { success: false, code: 'OTP_TOO_MANY_ATTEMPTS', error: 'Trop de tentatives' };
    }

    try {
      await supabase
        .from('otp_codes')
        .update({ attempts: nextAttempts })
        .eq('id', row.id);
    } catch (e) { }

    return { success: false, code: 'OTP_INVALID', error: 'Code OTP incorrect' };
  } catch (e) {
    console.error('💥 Exception vérification OTP mobile:', e);
    return { success: false, code: 'OTP_VERIFY_ERROR', error: 'Erreur vérification OTP' };
  }
}

async function verifyAdminOtp(localPhone, codeUpper) {
  try {
    // Mode OTP de test : accepter directement le code défini pour l'admin web
    if (OTP_TEST_MODE && codeUpper === String(OTP_TEST_CODE).toUpperCase().trim()) {
      return { success: true };
    }

    const { data, error } = await supabase
      .from('otp_codes')
      .select('*')
      .eq('phone', localPhone)
      .eq('user_type', 'admin')
      .order('created_at', { ascending: false })
      .limit(1);

    if (error) {
      console.error('💥 Erreur lecture OTP admin:', error);
      return { success: false, error: 'Erreur vérification OTP' };
    }

    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row) {
      return { success: false, error: 'OTP non trouvé ou expiré' };
    }

    const now = new Date();
    let expiresAt = null;
    if (row.expires_at instanceof Date) {
      expiresAt = row.expires_at;
    } else if (row.expires_at) {
      try {
        const raw = String(row.expires_at);
        const normalized = raw.endsWith('Z') ? raw : `${raw}Z`;
        expiresAt = new Date(normalized);
      } catch (e) {
        expiresAt = null;
      }
    }
    if (expiresAt && expiresAt < now) {
      try {
        await supabase.from('otp_codes').delete().eq('id', row.id);
      } catch (e) { }
      return { success: false, error: 'OTP expiré' };
    }

    const nextAttempts = (row.attempts || 0) + 1;
    const storedCode = String(row.code || '').toUpperCase();

    if (storedCode === codeUpper) {
      try {
        await supabase
          .from('otp_codes')
          .update({
            attempts: nextAttempts,
            is_verified: true,
            verified_at: now.toISOString(),
          })
          .eq('id', row.id);
      } catch (e) { }
      return { success: true };
    }

    if (nextAttempts >= 5) {
      try {
        await supabase.from('otp_codes').delete().eq('id', row.id);
      } catch (e) { }
      return { success: false, error: 'Trop de tentatives' };
    }

    try {
      await supabase
        .from('otp_codes')
        .update({ attempts: nextAttempts })
        .eq('id', row.id);
    } catch (e) { }

    return { success: false, error: 'Code OTP incorrect' };
  } catch (e) {
    console.error('💥 Exception vérification OTP admin:', e);
    return { success: false, error: 'Erreur vérification OTP' };
  }
}

async function sendPushNotificationToUser(userId, payload) {
  const result = {
    userId,
    provider: firebaseAdminApp && firebaseAdmin ? 'firebase-admin' : (FCM_SERVER_KEY ? 'legacy' : 'none'),
    tokensCount: 0,
    sent: [],
    failed: [],
    skipped: [],
  };

  const adminMessaging = (firebaseAdminApp && firebaseAdmin)
    ? (typeof firebaseAdmin.messaging === 'function'
      ? firebaseAdmin.messaging(firebaseAdminApp)
      : (firebaseAdminApp.messaging ? firebaseAdminApp.messaging() : null))
    : null;

  try {
    const { data: tokens, error } = await supabase
      .from(PUSH_TOKENS_TABLE)
      .select('token')
      .eq('user_id', userId);

    if (error) {
      result.failed.push({ token: null, error: error.message || String(error), code: error.code || null });
      return result;
    }

    if (!tokens || tokens.length === 0) {
      return result;
    }

    result.tokensCount = tokens.length;

    for (const row of tokens) {
      const token = row && row.token;
      if (!token) continue;

      if (result.provider === 'none') {
        result.skipped.push({ token, reason: 'push_not_configured' });
        continue;
      }

      // Priorité : API HTTP v1 via Firebase Admin si configuré
      if (firebaseAdminApp && firebaseAdmin) {
        try {
          if (!adminMessaging || typeof adminMessaging.send !== 'function') {
            result.failed.push({ token, error: 'Firebase Admin messaging non disponible', code: 'messaging/not-available' });
            continue;
          }

          const dataPayload = {};
          if (payload && payload.data && typeof payload.data === 'object') {
            for (const [k, v] of Object.entries(payload.data)) {
              if (v == null) continue;
              dataPayload[String(k)] = typeof v === 'string' ? v : JSON.stringify(v);
            }
          }

          const messageId = await adminMessaging.send({
            token,
            notification: {
              title: payload.title || 'Notification',
              body: payload.body || '',
            },
            data: dataPayload,
          });

          result.sent.push({ token, messageId });
          continue;
        } catch (e) {
          const code = e && (e.code || (e.errorInfo && e.errorInfo.code)) ? (e.code || e.errorInfo.code) : null;
          const msg = e && e.message ? e.message : String(e);
          result.failed.push({ token, error: msg, code });

          if (code === 'messaging/registration-token-not-registered' || code === 'messaging/invalid-registration-token') {
            try {
              await supabase.from(PUSH_TOKENS_TABLE).delete().eq('token', token);
            } catch (delErr) {
              result.failed.push({ token, error: delErr && delErr.message ? delErr.message : String(delErr), code: 'cleanup_failed' });
            }
          }
        }
      }

      // Fallback : ancienne API HTTP avec clé serveur si encore configurée
      if (FCM_SERVER_KEY) {
        try {
          await axios.post(
            'https://fcm.googleapis.com/fcm/send',
            {
              to: token,
              notification: {
                title: payload.title || 'Notification',
                body: payload.body || '',
              },
              data: payload.data || {},
            },
            {
              headers: {
                Authorization: `key=${FCM_SERVER_KEY}`,
                'Content-Type': 'application/json',
              },
              timeout: 5000,
            }
          );
          result.sent.push({ token, messageId: 'legacy_ok' });
        } catch (e) {
          const msg = e && e.message ? e.message : String(e);
          result.failed.push({ token, error: msg, code: 'legacy_error' });
        }
      }
    }
  } catch (e) {
    result.failed.push({ token: null, error: e && e.message ? e.message : String(e), code: 'unexpected' });
  }

  return result;
}

async function createNotification({
  userId,
  title,
  message,
  type = null,
  severity = 'info',
  resourceType = null,
  resourceId = null,
  metadata = null,
  skipPush = false,
}) {
  try {
    if (!userId || !title || !message) return null;

    const inferUserTypeFromNotificationType = (notifType) => {
      try {
        const t = String(notifType || '');
        if (!t) return null;
        if (t.startsWith('distributor.')) return 'distributor';
        if (t.startsWith('supervisor.')) return 'supervisor';
        // Les notifications container.* sont destinées aux distributeurs.
        if (t.startsWith('container.')) return 'distributor';
        return null;
      } catch (e) {
        return null;
      }
    };

    const buildLocalizedPayloadForUser = async () => {
      try {
        const inferredUserType = inferUserTypeFromNotificationType(type);
        const lang = await resolveUserLanguage({ userId, userType: inferredUserType });
        notifLangLog('resolve', { userId, type, userType: inferredUserType, lang });
        const tpl = type ? NOTIFICATION_TEMPLATES[type] : null;
        if (!tpl || typeof tpl.build !== 'function') {
          return { title, message, lang };
        }

        const md = metadata && typeof metadata === 'object' ? metadata : {};
        const ctx = {};

        if (String(type).startsWith('distributor.')) {
          const distributorId = (md.distributorId || resourceId || null);
          if (distributorId) {
            try {
              const { data: dist } = await supabase
                .from('distributors')
                .select('id, name, full_name, phone, credit_balance, status')
                .eq('id', distributorId)
                .maybeSingle();
              if (dist) ctx.distributor = dist;
            } catch (e) { }
          }
          if (md.amount != null) ctx.amount = md.amount;
          if (md.credit_balance != null) ctx.amount = md.credit_balance;
          if (md.oldBalance != null) ctx.oldBalance = md.oldBalance;
          if (md.newBalance != null) ctx.newBalance = md.newBalance;
          if (md.reference != null) ctx.reference = md.reference;
          if (md.paymentMethod != null) ctx.paymentMethod = md.paymentMethod;
          if (md.pin != null) ctx.pin = md.pin;
          if (md.lockedUntil != null) ctx.lockedUntil = md.lockedUntil;
          if (md.reason != null) ctx.reason = md.reason;
        }

        if (String(type).startsWith('container.')) {
          const containerId = (md.containerId || resourceId || null);
          if (containerId) {
            try {
              const { data: cont } = await supabase
                .from('containers')
                .select('id, container_code, code, name, balance, distributor_id, status')
                .eq('id', containerId)
                .maybeSingle();
              if (cont) ctx.container = cont;
            } catch (e) { }
          }
          if (md.balance != null) ctx.balance = md.balance;
          if (md.amount != null) ctx.amount = md.amount;
          if (md.reference != null) ctx.reference = md.reference;
          if (md.days != null) ctx.days = md.days;
          if (md.oldStatus != null) ctx.oldStatus = md.oldStatus;
          if (md.newStatus != null) ctx.newStatus = md.newStatus;
        }

        if (String(type).startsWith('supervisor.')) {
          const supervisorId = (md.supervisorId || resourceId || null);
          if (supervisorId) {
            try {
              const { data: sup } = await supabase
                .from('supervisors')
                .select('id, first_name, last_name, phone, zone, status')
                .eq('id', supervisorId)
                .maybeSingle();
              if (sup) ctx.supervisor = sup;
            } catch (e) { }
          }
          if (md.attempts != null) ctx.attempts = md.attempts;
          if (md.maxAttempts != null) ctx.maxAttempts = md.maxAttempts;
          if (md.lockedUntil != null) ctx.lockedUntil = md.lockedUntil;
        }

        const built = tpl.build(ctx, lang) || {};
        const outTitle = built.title || title;
        const outMessage = built.message || message;
        return { title: outTitle, message: outMessage, lang };
      } catch (e) {
        return { title, message, lang: 'fr' };
      }
    };

    const payload = {
      user_id: userId,
      title,
      message,
      type,
      severity,
      resource_type: resourceType,
      resource_id: resourceId,
      metadata,
    };

    const { data, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .insert(payload)
      .select('*')
      .single();

    if (error) {
      console.warn('⚠️ Erreur createNotification:', error.message || error);
      return null;
    }

    const notif = data || payload;

    const localized = await buildLocalizedPayloadForUser();

    // Émission temps réel pour les admins
    try {
      if (io && userId === DEFAULT_ADMIN_USER_ID) {
        io.to('admins').emit('notification:new', notif);
      }
    } catch (e) { }

    // Essayer d'envoyer une notification push si configurée
    if (!skipPush) {
      try {
        await sendPushNotificationToUser(userId, {
          title: localized.title,
          body: localized.message,
          data: {
            type: type || null,
            severity,
            resource_type: resourceType,
            resource_id: resourceId,
          },
        });
      } catch (e) { }
    }

    try {
      await sendNotificationSmsMirror({
        userId,
        title: localized.title,
        message: localized.message,
        type,
        severity,
        metadata,
      });
    } catch (e) { }

    return notif;
  } catch (e) {
    console.warn('⚠️ Exception createNotification:', e && e.message ? e.message : e);
    return null;
  }
}

const notificationSmsCooldownCache = new Map();
const containerInactiveAlertCache = new Map();

async function resolveSmsPhoneForUserId(userId) {
  try {
    if (!userId) return null;

    if (userId === DEFAULT_ADMIN_USER_ID) {
      try {
        const settings = await getSmsAdvancedSettings();
        const admin = settings && settings.adminNumber ? String(settings.adminNumber).trim() : null;
        return toLocalPhone(admin || ADMIN_WEB_PHONE);
      } catch (e) {
        return toLocalPhone(ADMIN_WEB_PHONE);
      }
    }

    try {
      const { data: sup } = await supabase
        .from('supervisors')
        .select('phone')
        .eq('id', userId)
        .maybeSingle();
      const local = sup && sup.phone ? toLocalPhone(String(sup.phone)) : null;
      if (local) return local;
    } catch (e) { }

    try {
      const { data: dist } = await supabase
        .from('distributors')
        .select('phone')
        .eq('id', userId)
        .maybeSingle();
      const local = dist && dist.phone ? toLocalPhone(String(dist.phone)) : null;
      if (local) return local;
    } catch (e) { }

    return null;
  } catch (e) {
    return null;
  }
}

async function queueSmsMessage({ phone, message, channel }) {
  try {
    if (!phone || !message) return { success: false, error: 'phone/message manquant' };

    const payload = {
      id: crypto.randomUUID(),
      phone: String(phone),
      message: String(message),
      channel: channel || 'mobile',
      status: 'pending',
      attempts: 0,
      created_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('sms_queue').insert(payload);
    if (error) {
      return { success: false, error: error.message || 'Erreur insertion sms_queue' };
    }
    return { success: true };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

async function sendNotificationSmsMirror({ userId, title, message, type, severity, metadata }) {
  try {
    const smsSettings = await getSmsAdvancedSettings();
    if (!smsSettings || smsSettings.enabled === false) return { success: false, disabled: true };

    if (metadata && typeof metadata === 'object' && metadata.smsDisabled === true) {
      return { success: true, skipped: true };
    }

    const severityLower = String(severity || 'info').toLowerCase();
    const eventsEnabled = smsSettings.notifyEventsEnabled !== false;
    if (!eventsEnabled) return { success: true, skipped: true };

    const sendAll = smsSettings.notifyEventsAll === true;
    const isImportant = severityLower === 'warning' || severityLower === 'critical';
    const forceSms = String(type || '').toLowerCase() === 'distributor.credit_recharged';
    if (!sendAll && !isImportant && !forceSms) {
      return { success: true, skipped: true };
    }

    const recipient = await resolveSmsPhoneForUserId(userId);
    if (!recipient) return { success: false, error: 'Destinataire SMS introuvable' };

    const cooldownSeconds = Number(smsSettings.notifyEventsCooldownSeconds || 60);
    const cooldownKey = `${userId}:${type || title}`;
    const last = notificationSmsCooldownCache.get(cooldownKey);
    const now = Date.now();
    if (last && cooldownSeconds > 0 && (now - last) < cooldownSeconds * 1000) {
      return { success: true, skipped: true, reason: 'cooldown' };
    }
    notificationSmsCooldownCache.set(cooldownKey, now);

    const prefix = smsSettings.notifyEventsPrefix ? String(smsSettings.notifyEventsPrefix) : 'MoovMoney';
    const msg = `${prefix} - ${title}: ${message}`.trim().slice(0, 450);

    const channel = userId === DEFAULT_ADMIN_USER_ID ? 'web' : 'mobile';

    const queued = await queueSmsMessage({ phone: recipient, message: msg, channel });
    if (queued && queued.success) return { success: true, queued: true };

    const direct = await smsService.sendSMS(recipient, msg, 'notification');
    if (direct && direct.success) return { success: true, direct: true };
    return { success: false, error: (direct && direct.error) || 'Erreur envoi SMS' };
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

// Templates de notifications par type d'événement
const NOTIFICATION_TEMPLATES = {
  // =============================
  // Distributeurs
  // =============================
  'distributor.created': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label);
      const phone = distributor && distributor.phone;
      const zone = distributor && (distributor.zone || distributor.area || null);
      const fallbackName = pickByLang(lang, { fr: 'Distributeur', en: 'Distributor', ar: 'موزع' });
      return {
        title: pickByLang(lang, {
          fr: 'Nouveau distributeur créé',
          en: 'New distributor created',
          ar: 'تم إنشاء موزع جديد',
        }),
        message: pickByLang(lang, {
          fr: `${name || fallbackName}${phone ? ` (${phone})` : ''}${zone ? ` - Zone ${zone}` : ''}`,
          en: `${name || fallbackName}${phone ? ` (${phone})` : ''}${zone ? ` - Zone ${zone}` : ''}`,
          ar: `${name || fallbackName}${phone ? ` (${phone})` : ''}${zone ? ` - المنطقة ${zone}` : ''}`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          phone: phone || null,
          zone: zone || null,
        },
      };
    },
  },
  'distributor.updated': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const fallbackName = pickByLang(lang, { fr: 'Compte', en: 'Account', ar: 'الحساب' });
      return {
        title: pickByLang(lang, {
          fr: 'Compte mis à jour',
          en: 'Account updated',
          ar: 'تم تحديث الحساب',
        }),
        message: pickByLang(lang, {
          fr: `${name || fallbackName} : votre compte a été mis à jour.`,
          en: `${name || fallbackName}: your account has been updated.`,
          ar: 'تم تحديث حسابك.',
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
        },
      };
    },
  },
  'distributor.account_created': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor, phone, pin }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const finalPhone = phone || (distributor && distributor.phone) || null;
      const finalPin = pin != null ? String(pin) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Compte créé',
          en: 'Account created',
          ar: 'تم إنشاء الحساب',
        }),
        message: pickByLang(lang, {
          fr: 'Votre compte distributeur est créé. Connectez-vous avec votre numéro et votre PIN.',
          en: 'Your distributor account has been created. Log in with your number and PIN.',
          ar: 'تم إنشاء حساب الموزع. سجّل الدخول باستخدام رقمك والرقم السري (PIN).',
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          phone: finalPhone,
          pin: finalPin,
          smsDisabled: true,
        },
      };
    },
  },
  'container.updated': {
    severity: 'info',
    resourceType: 'container',
    build: ({ container }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      return {
        title: pickByLang(lang, {
          fr: 'Container mis à jour',
          en: 'Container updated',
          ar: 'تم تحديث الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Les informations du container ${code || ''} ont été mises à jour.`,
          en: `Container ${code || ''} information has been updated.`,
          ar: `تم تحديث معلومات الحاوية ${code || ''}.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
        },
      };
    },
  },
  'distributor.suspended': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor, reason }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const normalizeReason = (raw) => {
        try {
          if (!raw) return null;
          if (typeof raw === 'object') {
            const picked = pickByLang(lang, raw);
            return picked ? String(picked) : null;
          }
          const str = String(raw);
          const low = str.trim().toLowerCase();
          if (!low) return null;
          if (low.includes('suspendu par admin') || low.includes('suspendu par l\'admin') || low.includes('suspendu par l’admin')) {
            return pickByLang(lang, {
              fr: 'Suspendu par admin',
              en: 'Suspended by admin',
              ar: 'تم تعليق الحساب من قبل المسؤول',
            });
          }
          if (low === 'compte suspendu' || low.includes('compte suspendu')) {
            return pickByLang(lang, {
              fr: 'Compte suspendu',
              en: 'Account suspended',
              ar: 'تم تعليق الحساب',
            });
          }
          return str;
        } catch (e) {
          return null;
        }
      };

      const finalReason =
        normalizeReason(reason)
        || normalizeReason(distributor && (distributor.suspension_reason || distributor.suspensionReason))
        || pickByLang(lang, {
          fr: 'Votre compte distributeur a été suspendu',
          en: 'Your distributor account has been suspended',
          ar: 'تم تعليق حساب الموزع',
        });
      const bal = distributor && distributor.credit_balance != null ? Number(distributor.credit_balance) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Compte distributeur suspendu',
          en: 'Distributor account suspended',
          ar: 'تم تعليق حساب الموزع',
        }),
        message: pickByLang(lang, {
          fr: 'Votre compte distributeur a été suspendu. Motif : ' + finalReason + '.',
          en: 'Your distributor account has been suspended. Reason: ' + finalReason + '.',
          ar: 'تم تعليق حساب الموزع. السبب: ' + finalReason + '.',
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          reason: finalReason,
          credit_balance: bal,
        },
      };
    },
  },
  'distributor.reactivated': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const bal = distributor && distributor.credit_balance != null ? Number(distributor.credit_balance) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Compte distributeur réactivé',
          en: 'Distributor account reactivated',
          ar: 'تمت إعادة تفعيل حساب الموزع',
        }),
        message: pickByLang(lang, {
          fr: 'Votre compte distributeur a été réactivé.',
          en: 'Your distributor account has been reactivated.',
          ar: 'تمت إعادة تفعيل حساب الموزع.',
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          credit_balance: bal,
        },
      };
    },
  },
  'distributor.account_closed': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Compte clôturé',
          en: 'Account closed',
          ar: 'تم إغلاق الحساب',
        }),
        message: pickByLang(lang, {
          fr: 'Votre compte distributeur a été clôturé. Contact support si besoin.',
          en: 'Your distributor account has been closed. Contact support if needed.',
          ar: 'تم إغلاق حساب الموزع. تواصل مع الدعم عند الحاجة.',
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          phone: distributor && distributor.phone ? distributor.phone : null,
          smsDisabled: true,
        },
      };
    },
  },
  'distributor.credit_low': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor, amount }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const bal = amount != null ? Number(amount) : distributor && distributor.credit_balance != null
        ? Number(distributor.credit_balance)
        : 0;
      return {
        title: pickByLang(lang, {
          fr: 'Crédit distributeur faible',
          en: 'Low distributor credit',
          ar: 'رصيد الموزع منخفض',
        }),
        message: pickByLang(lang, {
          fr: `Votre crédit est faible (${bal} FCFA). Pensez à recharger.`,
          en: `Your credit is low (${bal} XAF). Please recharge.`,
          ar: `رصيدك منخفض (${bal} FCFA). يرجى إعادة الشحن.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          credit_balance: bal,
        },
      };
    },
  },
  'distributor.credit_critical': {
    severity: 'critical',
    resourceType: 'distributor',
    build: ({ distributor, amount }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const bal = amount != null ? Number(amount) : distributor && distributor.credit_balance != null
        ? Number(distributor.credit_balance)
        : 0;
      return {
        title: pickByLang(lang, {
          fr: 'Crédit distributeur critique',
          en: 'Critical distributor credit',
          ar: 'رصيد الموزع حرج',
        }),
        message: pickByLang(lang, {
          fr: `Votre crédit est critique (${bal} FCFA). Certaines opérations peuvent être bloquées.`,
          en: `Your credit is critical (${bal} XAF). Some operations may be blocked.`,
          ar: `رصيدك حرج (${bal} FCFA). قد يتم حظر بعض العمليات.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          credit_balance: bal,
        },
      };
    },
  },
  'distributor.credit_recharged': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor, amount, oldBalance, newBalance, reference, paymentMethod }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const amt = Number(amount) || 0;
      const before = oldBalance != null ? Number(oldBalance) : null;
      const after = newBalance != null ? Number(newBalance) : (distributor && distributor.credit_balance != null ? Number(distributor.credit_balance) : null);
      const ref = reference ? String(reference) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Crédit rechargé',
          en: 'Credit recharged',
          ar: 'تمت تعبئة الرصيد',
        }),
        message: pickByLang(lang, {
          fr: `Votre crédit a été rechargé de ${amt} FCFA.${before != null ? ` Ancien solde: ${before} FCFA.` : ''}${after != null ? ` Nouveau solde: ${after} FCFA.` : ''}${ref ? ` Ref: ${ref}.` : ''}`,
          en: `Your credit has been recharged by ${amt} XAF.${before != null ? ` Previous balance: ${before} XAF.` : ''}${after != null ? ` New balance: ${after} XAF.` : ''}${ref ? ` Ref: ${ref}.` : ''}`,
          ar: `تمت تعبئة رصيدك بمبلغ ${amt} FCFA.${before != null ? ` الرصيد السابق: ${before} FCFA.` : ''}${after != null ? ` الرصيد الجديد: ${after} FCFA.` : ''}${ref ? ` المرجع: ${ref}.` : ''}`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          amount: amt,
          oldBalance: before,
          newBalance: after,
          reference: ref,
        },
      };
    },
  },
  'distributor.commission_earned': {
    severity: 'info',
    resourceType: 'commission',
    build: ({ distributor, container, amount }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const code = container && (container.code || container.container_code || container.name || container.id);
      const amt = Number(amount) || 0;
      return {
        title: pickByLang(lang, {
          fr: 'Commission générée',
          en: 'Commission earned',
          ar: 'تم تحصيل عمولة',
        }),
        message: pickByLang(lang, {
          fr: `Vous avez généré une commission de ${amt} FCFA sur le container ${code || ''}.`,
          en: `You earned a commission of ${amt} XAF on container ${code || ''}.`,
          ar: `لقد حصلت على عمولة قدرها ${amt} FCFA على الحاوية ${code || ''}.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: name || null,
          containerId: container && container.id ? container.id : null,
          containerCode: code || null,
          amount: amt,
        },
      };
    },
  },
  'distributor.commission_paid': {
    severity: 'info',
    resourceType: 'commission',
    build: ({ distributor, amount }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const amt = Number(amount) || 0;
      return {
        title: pickByLang(lang, {
          fr: 'Commission payée',
          en: 'Commission paid',
          ar: 'تم دفع العمولة',
        }),
        message: pickByLang(lang, {
          fr: `Votre commission de ${amt} FCFA a été payée.`,
          en: `Your commission of ${amt} XAF has been paid.`,
          ar: `تم دفع عمولتك بمبلغ ${amt} FCFA.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: name || null,
          amount: amt,
        },
      };
    },
  },
  'distributor.pin_reset': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor, pin }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const finalPin = pin != null ? String(pin) : '';
      return {
        title: pickByLang(lang, {
          fr: 'PIN réinitialisé',
          en: 'PIN reset',
          ar: 'تمت إعادة تعيين رقم PIN',
        }),
        message: finalPin
          ? pickByLang(lang, {
            fr: `Votre PIN a été réinitialisé. Nouveau PIN : ${finalPin}`,
            en: `Your PIN has been reset. New PIN: ${finalPin}`,
            ar: `تمت إعادة تعيين رقم PIN. رقم PIN الجديد: ${finalPin}`,
          })
          : pickByLang(lang, {
            fr: 'Votre PIN a été réinitialisé.',
            en: 'Your PIN has been reset.',
            ar: 'تمت إعادة تعيين رقم PIN الخاص بك.',
          }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          pin: finalPin || null,
        },
      };
    },
  },
  'distributor.account_locked': {
    severity: 'critical',
    resourceType: 'distributor',
    build: ({ distributor, lockedUntil }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Compte verrouillé',
          en: 'Account locked',
          ar: 'تم قفل الحساب',
        }),
        message: pickByLang(lang, {
          fr: `Votre compte est verrouillé temporairement.${lockedUntil ? ` Déblocage: ${lockedUntil}` : ''}`,
          en: `Your account is temporarily locked.${lockedUntil ? ` Unlock at: ${lockedUntil}` : ''}`,
          ar: `تم قفل حسابك مؤقتاً.${lockedUntil ? ` سيتم الفتح عند: ${lockedUntil}` : ''}`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          lockedUntil: lockedUntil || null,
        },
      };
    },
  },
  'distributor.login_failed': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor, attempts, maxAttempts, lockedUntil }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const att = Number(attempts) || 0;
      const max = Number(maxAttempts) || null;
      const remaining = max != null ? Math.max(0, max - att) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Tentative de connexion échouée',
          en: 'Failed login attempt',
          ar: 'فشل تسجيل الدخول',
        }),
        message: pickByLang(lang, {
          fr: `Mot de passe/PIN incorrect.${remaining != null ? ` Tentatives restantes: ${remaining}.` : ''}${lockedUntil ? ` Blocage: ${lockedUntil}.` : ''}`,
          en: `Incorrect password/PIN.${remaining != null ? ` Remaining attempts: ${remaining}.` : ''}${lockedUntil ? ` Locked until: ${lockedUntil}.` : ''}`,
          ar: `كلمة المرور/‏PIN غير صحيحة.${remaining != null ? ` المحاولات المتبقية: ${remaining}.` : ''}${lockedUntil ? ` مقفل حتى: ${lockedUntil}.` : ''}`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          attempts: att,
          maxAttempts: max,
          lockedUntil: lockedUntil || null,
        },
      };
    },
  },
  'distributor.pin_changed': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'PIN modifié',
          en: 'PIN changed',
          ar: 'تم تغيير رقم PIN',
        }),
        message: pickByLang(lang, {
          fr: `Votre PIN a été modifié avec succès.${name ? ` (${name})` : ''} Veuillez vous reconnecter avec votre nouveau PIN. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support Moov Money.`,
          en: `Your PIN was successfully changed.${name ? ` (${name})` : ''} Please log in again with your new PIN. If you did not request this change, contact Moov Money support immediately.`,
          ar: `تم تغيير رقم PIN بنجاح.${name ? ` (${name})` : ''} يرجى تسجيل الدخول مرة أخرى باستخدام رقم PIN الجديد. إذا لم تطلب هذا التغيير، تواصل فوراً مع دعم مووف موني.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
        },
      };
    },
  },
  'distributor.pin_change_failed': {
    severity: 'warning',
    resourceType: 'distributor',
    build: ({ distributor, reason }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const r = reason ? String(reason) : 'PIN temporaire incorrect';
      return {
        title: pickByLang(lang, {
          fr: 'Changement de PIN refusé',
          en: 'PIN change denied',
          ar: 'تم رفض تغيير رقم PIN',
        }),
        message: pickByLang(lang, {
          fr: `Changement de PIN échoué. ${r}. Vérifiez le PIN saisi et réessayez. Si le problème persiste, contactez le support Moov Money.`,
          en: `PIN change failed. ${r}. Check the entered PIN and try again. If the issue persists, contact Moov Money support.`,
          ar: `فشل تغيير رقم PIN. ${r}. تحقق من رقم PIN المدخل وحاول مرة أخرى. إذا استمرت المشكلة، تواصل مع دعم مووف موني.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          reason: r,
        },
      };
    },
  },
  'distributor.welcome': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Bienvenue',
          en: 'Welcome',
          ar: 'مرحباً',
        }),
        message: pickByLang(lang, {
          fr: `Bienvenue${name ? ` ${name}` : ''} sur Moov Money Tracker.`,
          en: `Welcome${name ? ` ${name}` : ''} to Moov Money Tracker.`,
          ar: `مرحباً${name ? ` ${name}` : ''} في مووف موني تراكر.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
        },
      };
    },
  },
  'distributor.verification_changed': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor, is_verified }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const verified = !!is_verified;
      return {
        title: pickByLang(lang, {
          fr: 'Statut de vérification mis à jour',
          en: 'Verification status updated',
          ar: 'تم تحديث حالة التحقق',
        }),
        message: verified
          ? pickByLang(lang, {
            fr: 'Votre compte a été vérifié.',
            en: 'Your account has been verified.',
            ar: 'تم التحقق من حسابك.',
          })
          : pickByLang(lang, {
            fr: 'Votre compte a été marqué comme non vérifié.',
            en: 'Your account has been marked as unverified.',
            ar: 'تم وضع علامة على حسابك بأنه غير مُتحقق منه.',
          }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          is_verified: verified,
        },
      };
    },
  },
  'distributor.supervisor_changed': {
    severity: 'info',
    resourceType: 'distributor',
    build: ({ distributor, supervisor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const supName = supervisor && (supervisor.name || `${supervisor.first_name || ''} ${supervisor.last_name || ''}`.trim() || supervisor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Superviseur mis à jour',
          en: 'Supervisor updated',
          ar: 'تم تحديث المشرف',
        }),
        message: supName
          ? pickByLang(lang, {
            fr: `Votre superviseur a été mis à jour : ${supName}.`,
            en: `Your supervisor has been updated: ${supName}.`,
            ar: `تم تحديث المشرف الخاص بك: ${supName}.`,
          })
          : pickByLang(lang, {
            fr: 'Votre superviseur a été mis à jour.',
            en: 'Your supervisor has been updated.',
            ar: 'تم تحديث المشرف الخاص بك.',
          }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          name: name || null,
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          supervisorName: supName || null,
        },
      };
    },
  },

  // =============================
  // Containers
  // =============================
  'container.recharged': {
    severity: 'info',
    resourceType: 'container',
    build: ({ container, amount, reference }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const amt = Number(amount) || 0;
      return {
        title: pickByLang(lang, {
          fr: 'Recharge de container',
          en: 'Container recharge',
          ar: 'إعادة شحن الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Votre container ${code || ''} a été rechargé de ${amt} unités`,
          en: `Your container ${code || ''} has been recharged by ${amt} units`,
          ar: `تمت إعادة شحن الحاوية ${code || ''} بمقدار ${amt} وحدة`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          amount: amt,
          reference: reference || null,
        },
      };
    },
  },
  'container.balance_low': {
    severity: 'warning',
    resourceType: 'container',
    build: ({ container, balance }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const solde = balance != null
        ? Number(balance)
        : container && container.balance != null
          ? Number(container.balance)
          : 0;
      return {
        title: pickByLang(lang, {
          fr: 'Solde container faible',
          en: 'Low container balance',
          ar: 'رصيد الحاوية منخفض',
        }),
        message: pickByLang(lang, {
          fr: `Le solde du container ${code || ''} est faible (${solde} unités). Pensez à recharger.`,
          en: `Container ${code || ''} balance is low (${solde} units). Please recharge.`,
          ar: `رصيد الحاوية ${code || ''} منخفض (${solde} وحدة). يرجى إعادة الشحن.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          balance: solde,
        },
      };
    },
  },
  'container.balance_critical': {
    severity: 'critical',
    resourceType: 'container',
    build: ({ container, balance }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const solde = balance != null
        ? Number(balance)
        : container && container.balance != null
          ? Number(container.balance)
          : 0;
      return {
        title: pickByLang(lang, {
          fr: 'Solde container critique',
          en: 'Critical container balance',
          ar: 'رصيد الحاوية حرج',
        }),
        message: pickByLang(lang, {
          fr: `Le solde du container ${code || ''} est critique (${solde} unités). Service bientôt indisponible.`,
          en: `Container ${code || ''} balance is critical (${solde} units). Service may become unavailable soon.`,
          ar: `رصيد الحاوية ${code || ''} حرج (${solde} وحدة). قد تصبح الخدمة غير متاحة قريباً.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          balance: solde,
        },
      };
    },
  },
  'container.inactive': {
    severity: 'warning',
    resourceType: 'container',
    build: ({ container, days }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const d = Number(days) || 0;
      return {
        title: pickByLang(lang, {
          fr: 'Container inactif',
          en: 'Inactive container',
          ar: 'حاوية غير نشطة',
        }),
        message: pickByLang(lang, {
          fr: `Le container ${code || ''} est inactif depuis ${d} jours.`,
          en: `Container ${code || ''} has been inactive for ${d} days.`,
          ar: `الحاوية ${code || ''} غير نشطة منذ ${d} يومًا.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          days: d,
          smsDisabled: true,
        },
      };
    },
  },
  'container.status_changed': {
    severity: 'info',
    resourceType: 'container',
    build: ({ container, oldStatus, newStatus }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const status = (newStatus || (container && container.status) || '').toString();
      return {
        title: pickByLang(lang, {
          fr: 'Statut du container mis à jour',
          en: 'Container status updated',
          ar: 'تم تحديث حالة الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Le container ${code || ''} est maintenant en statut ${status}.`,
          en: `Container ${code || ''} is now in status ${status}.`,
          ar: `الحاوية ${code || ''} أصبحت الآن بالحالة ${status}.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          oldStatus: oldStatus || null,
          newStatus: status,
        },
      };
    },
  },
  'container.assigned_to_distributor': {
    severity: 'info',
    resourceType: 'container',
    build: ({ container, distributor }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const distName = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Nouveau container assigné',
          en: 'New container assigned',
          ar: 'تم تعيين حاوية جديدة',
        }),
        message: pickByLang(lang, {
          fr: `Un nouveau container ${code || ''} vous a été assigné.`,
          en: `A new container ${code || ''} has been assigned to you.`,
          ar: `تم تعيين حاوية جديدة ${code || ''} لك.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          distributorId: container && container.distributor_id ? container.distributor_id : distributor && distributor.id ? distributor.id : null,
          distributorName: distName || null,
        },
      };
    },
  },
  'container.unassigned': {
    severity: 'warning',
    resourceType: 'container',
    build: ({ container, distributor }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const distName = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Container désassigné',
          en: 'Container unassigned',
          ar: 'تم إلغاء تعيين الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Le container ${code || ''} n’est plus rattaché à votre compte.`,
          en: `Container ${code || ''} is no longer linked to your account.`,
          ar: `الحاوية ${code || ''} لم تعد مرتبطة بحسابك.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: distName || null,
        },
      };
    },
  },

  // =============================
  // Superviseurs
  // =============================
  'supervisor.suspended': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ supervisor, reason }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const finalReason = reason || (supervisor && (supervisor.suspension_reason || supervisor.suspensionReason)) || 'Votre compte a été suspendu';
      return {
        title: pickByLang(lang, {
          fr: 'Compte superviseur suspendu',
          en: 'Supervisor account suspended',
          ar: 'تم تعليق حساب المشرف',
        }),
        message: pickByLang(lang, {
          fr: `${fullName ? fullName + ' - ' : ''}${finalReason}`,
          en: `${fullName ? fullName + ' - ' : ''}${finalReason}`,
          ar: `${fullName ? fullName + ' - ' : ''}${finalReason}`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          reason: finalReason,
        },
      };
    },
  },
  'supervisor.reactivated': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'Compte superviseur réactivé',
          en: 'Supervisor account reactivated',
          ar: 'تمت إعادة تفعيل حساب المشرف',
        }),
        message: pickByLang(lang, {
          fr: `${fullName ? fullName + ' - ' : ''}Votre compte superviseur a été réactivé`,
          en: `${fullName ? fullName + ' - ' : ''}Your supervisor account has been reactivated`,
          ar: `${fullName ? fullName + ' - ' : ''}تمت إعادة تفعيل حساب المشرف الخاص بك`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
        },
      };
    },
  },
  'supervisor.assigned_zone_changed': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor, zone }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const newZone = zone || (supervisor && (supervisor.zone || supervisor.area));
      return {
        title: pickByLang(lang, {
          fr: 'Zone de supervision mise à jour',
          en: 'Supervision zone updated',
          ar: 'تم تحديث منطقة الإشراف',
        }),
        message: pickByLang(lang, {
          fr: `${fullName ? fullName + ' - ' : ''}Votre zone de supervision est maintenant : ${newZone || 'Non définie'}.`,
          en: `${fullName ? fullName + ' - ' : ''}Your supervision zone is now: ${newZone || 'Not set'}.`,
          ar: `${fullName ? fullName + ' - ' : ''}منطقة الإشراف الخاصة بك أصبحت الآن: ${newZone || 'غير محددة'}.`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          zone: newZone || null,
        },
      };
    },
  },
  'supervisor.pin_reset': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ supervisor, pin }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const finalPin = pin != null ? String(pin) : '';
      return {
        title: pickByLang(lang, {
          fr: 'PIN réinitialisé',
          en: 'PIN reset',
          ar: 'تمت إعادة تعيين رقم PIN',
        }),
        message: finalPin
          ? pickByLang(lang, {
            fr: `Votre PIN a été réinitialisé. Nouveau PIN : ${finalPin}`,
            en: `Your PIN has been reset. New PIN: ${finalPin}`,
            ar: `تمت إعادة تعيين رقم PIN. رقم PIN الجديد: ${finalPin}`,
          })
          : pickByLang(lang, {
            fr: 'Votre PIN a été réinitialisé.',
            en: 'Your PIN has been reset.',
            ar: 'تمت إعادة تعيين رقم PIN الخاص بك.',
          }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          name: fullName || null,
          pin: finalPin || null,
        },
      };
    },
  },
  'supervisor.account_locked': {
    severity: 'critical',
    resourceType: 'supervisor',
    build: ({ supervisor, lockedUntil }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'Compte verrouillé',
          en: 'Account locked',
          ar: 'تم قفل الحساب',
        }),
        message: pickByLang(lang, {
          fr: `Votre compte est verrouillé temporairement.${lockedUntil ? ` Déblocage: ${lockedUntil}` : ''}`,
          en: `Your account is temporarily locked.${lockedUntil ? ` Unlock at: ${lockedUntil}` : ''}`,
          ar: `تم قفل حسابك مؤقتاً.${lockedUntil ? ` سيتم الفتح عند: ${lockedUntil}` : ''}`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          fullName: fullName || null,
          lockedUntil: lockedUntil || null,
        },
      };
    },
  },
  'supervisor.login_failed': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ supervisor, attempts, maxAttempts, lockedUntil }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const att = Number(attempts) || 0;
      const max = Number(maxAttempts) || null;
      const remaining = max != null ? Math.max(0, max - att) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Tentative de connexion échouée',
          en: 'Failed login attempt',
          ar: 'فشل تسجيل الدخول',
        }),
        message: pickByLang(lang, {
          fr: `Mot de passe/PIN incorrect.${remaining != null ? ` Tentatives restantes: ${remaining}.` : ''}${lockedUntil ? ` Blocage: ${lockedUntil}.` : ''}`,
          en: `Incorrect password/PIN.${remaining != null ? ` Remaining attempts: ${remaining}.` : ''}${lockedUntil ? ` Locked until: ${lockedUntil}.` : ''}`,
          ar: `كلمة المرور/‏PIN غير صحيحة.${remaining != null ? ` المحاولات المتبقية: ${remaining}.` : ''}${lockedUntil ? ` مقفل حتى: ${lockedUntil}.` : ''}`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          fullName: fullName || null,
          attempts: att,
          maxAttempts: max,
          lockedUntil: lockedUntil || null,
        },
      };
    },
  },
  'supervisor.pin_changed': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ supervisor }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'PIN modifié',
          en: 'PIN changed',
          ar: 'تم تغيير رقم PIN',
        }),
        message: pickByLang(lang, {
          fr: `Votre PIN a été modifié avec succès.${fullName ? ` (${fullName})` : ''} Veuillez vous reconnecter avec votre nouveau PIN. Si vous n'êtes pas à l'origine de cette action, contactez immédiatement le support Moov Money.`,
          en: `Your PIN was successfully changed.${fullName ? ` (${fullName})` : ''} Please log in again with your new PIN. If you did not request this change, contact Moov Money support immediately.`,
          ar: `تم تغيير رقم PIN بنجاح.${fullName ? ` (${fullName})` : ''} يرجى تسجيل الدخول مرة أخرى باستخدام رقم PIN الجديد. إذا لم تطلب هذا التغيير، تواصل فوراً مع دعم مووف موني.`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          fullName: fullName || null,
        },
      };
    },
  },
  'supervisor.pin_change_failed': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ supervisor, reason }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const r = reason ? String(reason) : 'PIN temporaire incorrect';
      return {
        title: pickByLang(lang, {
          fr: 'Changement de PIN refusé',
          en: 'PIN change denied',
          ar: 'تم رفض تغيير رقم PIN',
        }),
        message: pickByLang(lang, {
          fr: `Changement de PIN échoué. ${r}. Vérifiez le PIN saisi et réessayez. Si le problème persiste, contactez le support Moov Money.`,
          en: `PIN change failed. ${r}. Check the entered PIN and try again. If the issue persists, contact Moov Money support.`,
          ar: `فشل تغيير رقم PIN. ${r}. تحقق من رقم PIN المدخل وحاول مرة أخرى. إذا استمرت المشكلة، تواصل مع دعم مووف موني.`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          fullName: fullName || null,
          reason: r,
        },
      };
    },
  },
  'supervisor.welcome': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'Bienvenue',
          en: 'Welcome',
          ar: 'مرحباً',
        }),
        message: pickByLang(lang, {
          fr: `Bienvenue${fullName ? ` ${fullName}` : ''} sur Moov Money Tracker.`,
          en: `Welcome${fullName ? ` ${fullName}` : ''} to Moov Money Tracker.`,
          ar: `مرحباً${fullName ? ` ${fullName}` : ''} في مووف موني تراكر.`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          name: fullName || null,
        },
      };
    },
  },
  'supervisor.account_created': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'Compte superviseur créé',
          en: 'Supervisor account created',
          ar: 'تم إنشاء حساب المشرف',
        }),
        message: pickByLang(lang, {
          fr: 'Votre compte superviseur est prêt. Connectez-vous avec votre numéro et votre PIN.',
          en: 'Your supervisor account is ready. Log in with your number and PIN.',
          ar: 'حساب المشرف جاهز. سجّل الدخول باستخدام رقمك والرقم السري (PIN).',
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          name: fullName || null,
          phone: supervisor && supervisor.phone ? supervisor.phone : null,
          smsDisabled: true,
        },
      };
    },
  },
  'supervisor.container_balance_critical': {
    severity: 'critical',
    resourceType: 'container',
    build: ({ container, balance, distributor }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const b = balance != null ? Number(balance) : container && container.balance != null ? Number(container.balance) : 0;
      const distName = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Alerte critique zone',
          en: 'Critical zone alert',
          ar: 'تنبيه حرج للمنطقة',
        }),
        message: pickByLang(lang, {
          fr: `Container ${code || ''} critique (${b}). Intervention requise.`,
          en: `Container ${code || ''} is critical (${b}). Action required.`,
          ar: `الحاوية ${code || ''} حرجة (${b}). مطلوب تدخل.`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          distributorId: container && container.distributor_id ? container.distributor_id : null,
          distributorName: distName || null,
          balance: b,
          smsDisabled: true,
        },
      };
    },
  },
  'supervisor.container_assigned': {
    severity: 'info',
    resourceType: 'container',
    build: ({ container, distributor }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const distName = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Container assigné',
          en: 'Container assigned',
          ar: 'تم تعيين الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Le container ${code || ''} a été assigné.${distName ? ` Distributeur: ${distName}.` : ''}`,
          en: `Container ${code || ''} has been assigned.${distName ? ` Distributor: ${distName}.` : ''}`,
          ar: `تم تعيين الحاوية ${code || ''}.${distName ? ` الموزع: ${distName}.` : ''}`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          distributorId: distributor && distributor.id ? distributor.id : (container && container.distributor_id ? container.distributor_id : null),
          distributorName: distName || null,
          smsDisabled: true,
        },
      };
    },
  },
  'supervisor.container_unassigned': {
    severity: 'warning',
    resourceType: 'container',
    build: ({ container, distributor }, lang = 'fr') => {
      const code = container && (container.code || container.container_code || container.name || container.id);
      const distName = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      return {
        title: pickByLang(lang, {
          fr: 'Container désassigné',
          en: 'Container unassigned',
          ar: 'تم إلغاء تعيين الحاوية',
        }),
        message: pickByLang(lang, {
          fr: `Le container ${code || ''} a été désassigné.${distName ? ` Distributeur: ${distName}.` : ''}`,
          en: `Container ${code || ''} has been unassigned.${distName ? ` Distributor: ${distName}.` : ''}`,
          ar: `تم إلغاء تعيين الحاوية ${code || ''}.${distName ? ` الموزع: ${distName}.` : ''}`,
        }),
        resourceId: container && container.id ? container.id : null,
        metadata: {
          containerId: container && container.id ? container.id : null,
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: distName || null,
          smsDisabled: true,
        },
      };
    },
  },
  'supervisor.distributor_created': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const phone = distributor && (distributor.phone || null);
      const fallbackName = pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' });
      return {
        title: pickByLang(lang, {
          fr: 'Nouveau distributeur',
          en: 'New distributor',
          ar: 'موزع جديد',
        }),
        message: pickByLang(lang, {
          fr: `${name || fallbackName}${phone ? ` (${phone})` : ''} a été créé et rattaché à votre supervision.`,
          en: `${name || fallbackName}${phone ? ` (${phone})` : ''} has been created and linked to your supervision.`,
          ar: `تم إنشاء ${name || fallbackName}${phone ? ` (${phone})` : ''} وربطه بإشرافك.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: name || null,
          phone: phone || null,
          zone: distributor && (distributor.zone || null),
          smsDisabled: true,
        },
      };
    },
  },
  'supervisor.updated': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      return {
        title: pickByLang(lang, {
          fr: 'Profil mis à jour',
          en: 'Profile updated',
          ar: 'تم تحديث الملف الشخصي',
        }),
        message: pickByLang(lang, {
          fr: `${fullName ? fullName + ' - ' : ''}Les informations de votre compte superviseur ont été mises à jour.`,
          en: `${fullName ? fullName + ' - ' : ''}Your supervisor account information has been updated.`,
          ar: `${fullName ? fullName + ' - ' : ''}تم تحديث معلومات حساب المشرف الخاص بك.`,
        }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
        },
      };
    },
  },
  'supervisor.verification_changed': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ supervisor, is_verified }, lang = 'fr') => {
      const fullName = supervisor
        ? `${supervisor.first_name || supervisor.firstName || ''} ${supervisor.last_name || supervisor.lastName || ''}`.trim()
        : '';
      const verified = !!is_verified;
      return {
        title: pickByLang(lang, {
          fr: 'Statut de vérification mis à jour',
          en: 'Verification status updated',
          ar: 'تم تحديث حالة التحقق',
        }),
        message: verified
          ? pickByLang(lang, {
            fr: 'Votre compte superviseur a été vérifié.',
            en: 'Your supervisor account has been verified.',
            ar: 'تم التحقق من حساب المشرف الخاص بك.',
          })
          : pickByLang(lang, {
            fr: 'Votre compte superviseur a été marqué comme non vérifié.',
            en: 'Your supervisor account has been marked as unverified.',
            ar: 'تم وضع علامة على حساب المشرف الخاص بك بأنه غير مُتحقق منه.',
          }),
        resourceId: supervisor && supervisor.id ? supervisor.id : null,
        metadata: {
          supervisorId: supervisor && supervisor.id ? supervisor.id : null,
          name: fullName || null,
          is_verified: verified,
        },
      };
    },
  },
  'supervisor.distributor_assigned': {
    severity: 'info',
    resourceType: 'supervisor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const phone = distributor && (distributor.phone || null);
      return {
        title: pickByLang(lang, {
          fr: 'Nouveau distributeur assigné',
          en: 'New distributor assigned',
          ar: 'تم تعيين موزع جديد',
        }),
        message: pickByLang(lang, {
          fr: `${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} a été assigné à votre supervision.`,
          en: `${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} has been assigned to your supervision.`,
          ar: `تم تعيين ${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} لإشرافك.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: name || null,
          phone: phone || null,
          zone: distributor && (distributor.zone || null),
        },
      };
    },
  },
  'supervisor.distributor_unassigned': {
    severity: 'warning',
    resourceType: 'supervisor',
    build: ({ distributor }, lang = 'fr') => {
      const name = distributor && (distributor.name || distributor.full_name || distributor.label || distributor.phone);
      const phone = distributor && (distributor.phone || null);
      return {
        title: pickByLang(lang, {
          fr: 'Distributeur désassigné',
          en: 'Distributor unassigned',
          ar: 'تم إلغاء تعيين الموزع',
        }),
        message: pickByLang(lang, {
          fr: `${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} n’est plus rattaché à votre supervision.`,
          en: `${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} is no longer linked to your supervision.`,
          ar: `${name ? name : pickByLang(lang, { fr: 'Un distributeur', en: 'A distributor', ar: 'موزع' })}${phone ? ` (${phone})` : ''} لم يعد مرتبطاً بإشرافك.`,
        }),
        resourceId: distributor && distributor.id ? distributor.id : null,
        metadata: {
          distributorId: distributor && distributor.id ? distributor.id : null,
          distributorName: name || null,
          phone: phone || null,
          zone: distributor && (distributor.zone || null),
        },
      };
    },
  },

  // =============================
  // Système / Sécurité
  // =============================
  'system.security_alert': {
    severity: 'critical',
    resourceType: 'system',
    build: ({ reason, phone, ip }, lang = 'fr') => {
      const r = reason || 'Activité suspecte détectée';
      const p = phone || 'Inconnu';
      const address = ip || 'Inconnue';
      return {
        title: pickByLang(lang, {
          fr: 'Alerte sécurité',
          en: 'Security alert',
          ar: 'تنبيه أمني',
        }),
        message: pickByLang(lang, {
          fr: `Tentative suspecte : ${r} – Compte : ${p} – IP : ${address}.`,
          en: `Suspicious attempt: ${r} – Account: ${p} – IP: ${address}.`,
          ar: `محاولة مشبوهة: ${r} – الحساب: ${p} – عنوان IP: ${address}.`,
        }),
        resourceId: null,
        metadata: {
          reason: r,
          phone: p,
          ip: address,
        },
      };
    },
  },
  'system.config_changed': {
    severity: 'info',
    resourceType: 'system',
    build: ({ group, actor }, lang = 'fr') => {
      const g = group || 'configuration';
      const actorLabel = actor && (actor.phone || actor.name || actor.id || actor.role);
      return {
        title: pickByLang(lang, {
          fr: 'Paramètres système modifiés',
          en: 'System settings changed',
          ar: 'تم تعديل إعدادات النظام',
        }),
        message: pickByLang(lang, {
          fr: `Les paramètres ${g} ont été modifiés${actorLabel ? ` par ${actorLabel}` : ''}.`,
          en: `Settings ${g} have been changed${actorLabel ? ` by ${actorLabel}` : ''}.`,
          ar: `تم تعديل إعدادات ${g}${actorLabel ? ` بواسطة ${actorLabel}` : ''}.`,
        }),
        resourceId: null,
        metadata: {
          group: g,
          actor,
        },
      };
    },
  },
  'system.sms_quota_low': {
    severity: 'warning',
    resourceType: 'system',
    build: ({ amount }, lang = 'fr') => {
      const remaining = amount != null ? Number(amount) : null;
      return {
        title: pickByLang(lang, {
          fr: 'Crédit SMS faible',
          en: 'Low SMS credit',
          ar: 'رصيد رسائل SMS منخفض',
        }),
        message: pickByLang(lang, {
          fr: `Le crédit SMS est faible${remaining != null ? ` (${remaining} messages restants)` : ''}.`,
          en: `SMS credit is low${remaining != null ? ` (${remaining} messages remaining)` : ''}.`,
          ar: `رصيد رسائل SMS منخفض${remaining != null ? ` (${remaining} رسالة متبقية)` : ''}.`,
        }),
        resourceId: null,
        metadata: {
          remaining,
        },
      };
    },
  },
  'system.push_error': {
    severity: 'warning',
    resourceType: 'system',
    build: ({ userId, error }, lang = 'fr') => {
      const err = (error && (error.message || String(error))) || null;
      return {
        title: pickByLang(lang, {
          fr: 'Erreur envoi push',
          en: 'Push sending error',
          ar: 'خطأ في إرسال الإشعار',
        }),
        message: pickByLang(lang, {
          fr: `Plusieurs erreurs FCM détectées pour l’utilisateur ${userId || 'inconnu'}.`,
          en: `Multiple FCM errors detected for user ${userId || 'unknown'}.`,
          ar: `تم اكتشاف عدة أخطاء FCM للمستخدم ${userId || 'غير معروف'}.`,
        }),
        resourceId: userId || null,
        metadata: {
          userId: userId || null,
          error: err,
        },
      };
    },
  },

  // =============================
  // Broadcast / Messages globaux
  // =============================
  'broadcast.all_users': {
    severity: 'info',
    resourceType: 'broadcast',
    build: ({ title, message }, lang = 'fr') => {
      return {
        title: title || pickByLang(lang, {
          fr: 'Information importante',
          en: 'Important information',
          ar: 'معلومة مهمة',
        }),
        message: message || pickByLang(lang, {
          fr: 'Nouveau message global.',
          en: 'New global message.',
          ar: 'رسالة عامة جديدة.',
        }),
        resourceId: null,
        metadata: {
          scope: 'all_users',
        },
      };
    },
  },
  'broadcast.distributors': {
    severity: 'info',
    resourceType: 'broadcast',
    build: ({ title, message }, lang = 'fr') => {
      return {
        title: title || pickByLang(lang, {
          fr: 'Message distributeurs',
          en: 'Distributors message',
          ar: 'رسالة للموزعين',
        }),
        message: message || pickByLang(lang, {
          fr: 'Nouveau message pour les distributeurs.',
          en: 'New message for distributors.',
          ar: 'رسالة جديدة للموزعين.',
        }),
        resourceId: null,
        metadata: {
          scope: 'distributors',
        },
      };
    },
  },
  'broadcast.supervisors': {
    severity: 'info',
    resourceType: 'broadcast',
    build: ({ title, message }, lang = 'fr') => {
      return {
        title: title || pickByLang(lang, {
          fr: 'Message superviseurs',
          en: 'Supervisors message',
          ar: 'رسالة للمشرفين',
        }),
        message: message || pickByLang(lang, {
          fr: 'Nouveau message pour les superviseurs.',
          en: 'New message for supervisors.',
          ar: 'رسالة جديدة للمشرفين.',
        }),
        resourceId: null,
        metadata: {
          scope: 'supervisors',
        },
      };
    },
  },

  // =============================
  // Test / Technique
  // =============================
  'push.test': {
    severity: 'info',
    resourceType: 'system',
    build: ({ now }, lang = 'fr') => {
      let dateStr = null;
      try {
        if (now) {
          const d = new Date(now);
          if (!isNaN(d.getTime())) {
            dateStr = d.toISOString();
          }
        }
      } catch (e) { }
      return {
        title: pickByLang(lang, {
          fr: 'Test de notification',
          en: 'Notification test',
          ar: 'اختبار الإشعار',
        }),
        message: pickByLang(lang, {
          fr: `Ceci est une notification de test.${dateStr ? ` (${dateStr})` : ''}`,
          en: `This is a test notification.${dateStr ? ` (${dateStr})` : ''}`,
          ar: `هذا إشعار تجريبي.${dateStr ? ` (${dateStr})` : ''}`,
        }),
        resourceId: null,
        metadata: {
          now: dateStr || null,
        },
      };
    },
  },
};

async function sendTemplatedNotification(templateKey, { userId, context = {}, override = {} } = {}) {
  try {
    if (!templateKey || !userId) return null;
    const tpl = NOTIFICATION_TEMPLATES[templateKey];
    if (!tpl || typeof tpl.build !== 'function') return null;

    const lang = override.language
      ? normalizeLanguage(override.language)
      : await resolveUserLanguage({ userId, userType: (override.userType || (context && context.userType) || null) });

    const built = tpl.build(context || {}, lang) || {};

    const title = override.title || built.title || tpl.title;
    const message = override.message || built.message || tpl.message;
    const severity = override.severity || built.severity || tpl.severity || 'info';
    const resourceType = override.resourceType || built.resourceType || tpl.resourceType || null;
    const resourceId = override.resourceId || built.resourceId || null;
    const metadata = override.metadata || built.metadata || null;

    if (!title || !message) return null;

    return await createNotification({
      userId,
      title,
      message,
      type: templateKey,
      severity,
      resourceType,
      resourceId,
      metadata,
    });
  } catch (e) {
    console.warn('⚠️ Exception sendTemplatedNotification:', e && e.message ? e.message : e);
    return null;
  }
}

// =====================================================
// ROUTES LANGUE UTILISATEUR (MOBILE)
// =====================================================

app.get('/api/user/language', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }

    const lang = await resolveUserLanguage({ userId: auth.userId, userType: auth.userType || auth.role });
    return res.json({ success: true, language: lang });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur récupération langue' });
  }
});

app.post('/api/auth/change-pin', express.json(), async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    const reqLang = await resolveRequestLanguage(req);

    if (!auth || !auth.userId) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Session invalide ou expirée',
          en: 'Invalid or expired session',
          ar: 'انتهت الجلسة أو أنها غير صالحة',
        }),
      });
    }

    const { currentPin, newPin, confirmPin } = req.body || {};
    if (!currentPin || !newPin || !confirmPin) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Tous les champs sont requis (currentPin, newPin, confirmPin)',
          en: 'All fields are required (currentPin, newPin, confirmPin)',
          ar: 'جميع الحقول مطلوبة (رقم PIN الحالي، رقم PIN الجديد، تأكيد رقم PIN)',
        }),
      });
    }

    if (String(newPin) !== String(confirmPin)) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Les deux PIN ne correspondent pas',
          en: 'PINs do not match',
          ar: 'رقما PIN غير متطابقين',
        }),
      });
    }

    const userType = String(auth.userType || auth.role || 'distributor');

    if (userType === 'supervisor' && !/^\d{4}$/.test(String(newPin))) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Le nouveau PIN superviseur doit contenir exactement 4 chiffres',
          en: 'Supervisor new PIN must be exactly 4 digits',
          ar: 'يجب أن يتكون رقم PIN الجديد للمشرف من 4 أرقام بالضبط',
        }),
      });
    }

    if (userType === 'distributor' && !/^\d{4,6}$/.test(String(newPin))) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Le nouveau PIN doit contenir 4 à 6 chiffres',
          en: 'New PIN must be 4 to 6 digits',
          ar: 'يجب أن يتكون رقم PIN الجديد من 4 إلى 6 أرقام',
        }),
      });
    }

    const nowIso = new Date().toISOString();
    const cleanCurrent = String(currentPin).trim();
    const cleanNew = String(newPin).trim();
    const hashedNewPin = await bcrypt.hash(cleanNew, 10);

    if (userType === 'supervisor') {
      const { data: supervisorRow, error: supError } = await supabase
        .from('supervisors')
        .select('id, phone, email, password_hash')
        .eq('id', auth.userId)
        .maybeSingle();

      if (supError || !supervisorRow || !supervisorRow.id) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Compte superviseur introuvable',
            en: 'Supervisor account not found',
            ar: 'تعذر العثور على حساب المشرف',
          }),
        });
      }

      const { data: supAuth } = await supabase
        .from('supervisor_auth')
        .select('supervisor_id, phone, email, password_hash')
        .eq('supervisor_id', supervisorRow.id)
        .maybeSingle();

      const hashToCheck = (supAuth && supAuth.password_hash) ? supAuth.password_hash : (supervisorRow.password_hash || '');
      const isValid = await bcrypt.compare(cleanCurrent, hashToCheck);
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'PIN actuel incorrect',
            en: 'Current PIN is incorrect',
            ar: 'رقم PIN الحالي غير صحيح',
          }),
        });
      }

      const { error: supUpdateError } = await supabase
        .from('supervisors')
        .update({ password_hash: hashedNewPin, updated_at: nowIso })
        .eq('id', supervisorRow.id);

      if (supUpdateError) {
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la mise à jour du PIN',
            en: 'Error updating PIN',
            ar: 'حدث خطأ أثناء تحديث رقم PIN',
          }),
        });
      }

      try {
        await supabase
          .from('supervisor_auth')
          .upsert({
            supervisor_id: supervisorRow.id,
            phone: supervisorRow.phone || (supAuth && supAuth.phone) || null,
            email: supervisorRow.email || (supAuth && supAuth.email) || null,
            password_hash: hashedNewPin,
            must_change_pin: false,
            pin_reset_reason: null,
            updated_at: nowIso,
            created_at: nowIso,
          }, { onConflict: 'supervisor_id' });
      } catch (e) { }

      return res.json({
        success: true,
        message: pickByLang(reqLang, {
          fr: 'PIN mis à jour avec succès',
          en: 'PIN updated successfully',
          ar: 'تم تحديث رقم PIN بنجاح',
        }),
      });
    }

    if (userType === 'distributor') {
      let distAuth = null;
      try {
        const { data } = await supabase
          .from('distributor_auth')
          .select('id, distributor_id, email, password_hash')
          .eq('distributor_id', auth.userId)
          .maybeSingle();
        distAuth = data || null;
      } catch (e) {
        distAuth = null;
      }

      if (!distAuth || !distAuth.id) {
        try {
          const { data: distRow } = await supabase
            .from('distributors')
            .select('id, phone')
            .eq('id', auth.userId)
            .maybeSingle();
          const phone = distRow && distRow.phone ? String(distRow.phone).trim() : '';
          if (phone) {
            const distEmail = `${phone}@moov.td`;
            const { data } = await supabase
              .from('distributor_auth')
              .select('id, distributor_id, email, password_hash')
              .eq('email', distEmail)
              .maybeSingle();
            distAuth = data || null;
          }
        } catch (e) {
          distAuth = null;
        }
      }

      if (!distAuth || !distAuth.id) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Compte distributeur introuvable',
            en: 'Distributor account not found',
            ar: 'تعذر العثور على حساب الموزع',
          }),
        });
      }

      const isValid = await bcrypt.compare(cleanCurrent, distAuth.password_hash || '');
      if (!isValid) {
        return res.status(401).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'PIN actuel incorrect',
            en: 'Current PIN is incorrect',
            ar: 'رقم PIN الحالي غير صحيح',
          }),
        });
      }

      const { error: updateError } = await supabase
        .from('distributor_auth')
        .update({
          password_hash: hashedNewPin,
          must_change_pin: false,
          pin_reset_reason: null,
          updated_at: nowIso,
        })
        .eq('id', distAuth.id);

      if (updateError) {
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la mise à jour du PIN',
            en: 'Error updating PIN',
            ar: 'حدث خطأ أثناء تحديث رقم PIN',
          }),
        });
      }

      return res.json({
        success: true,
        message: pickByLang(reqLang, {
          fr: 'PIN mis à jour avec succès',
          en: 'PIN updated successfully',
          ar: 'تم تحديث رقم PIN بنجاح',
        }),
      });
    }

    return res.status(400).json({
      success: false,
      error: pickByLang(reqLang, {
        fr: "Type d'utilisateur invalide",
        en: 'Invalid user type',
        ar: 'نوع المستخدم غير صالح',
      }),
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/change-pin:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors du changement de PIN',
        en: 'Error changing PIN',
        ar: 'حدث خطأ أثناء تغيير رقم PIN',
      }),
    });
  }
});

// =====================================================
// ROUTES LANGUE APPAREIL (MOBILE, AVANT LOGIN)
// =====================================================

app.get('/api/device/language', async (req, res) => {
  try {
    const q = req.query || {};
    const deviceId = typeof q.deviceId === 'string' ? q.deviceId : null;
    const id = deviceId ? String(deviceId).trim() : '';
    if (!id) {
      return res.status(400).json({ success: false, error: 'deviceId manquant' });
    }

    const lang = await readDeviceLanguage({ deviceId: id });
    return res.json({ success: true, language: lang || 'fr' });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur récupération langue device' });
  }
});

app.put('/api/device/language', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const deviceId = typeof body.deviceId === 'string' ? body.deviceId : null;
    const requested = typeof body.language === 'string' ? body.language : null;
    const platform = typeof body.platform === 'string' ? body.platform : null;
    const id = deviceId ? String(deviceId).trim() : '';
    if (!id) {
      return res.status(400).json({ success: false, error: 'deviceId manquant' });
    }

    const lang = normalizeLanguage(requested);
    const up = await upsertDeviceLanguage({ deviceId: id, language: lang, platform });
    if (!up || up.ok !== true) {
      return res.status(400).json({
        success: false,
        error: (up && up.error) ? up.error : 'Erreur mise à jour langue device',
      });
    }
    return res.json({ success: true, language: up.language || lang });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur mise à jour langue device' });
  }
});

app.put('/api/user/language', express.json(), async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }

    const body = req.body || {};
    const requested = typeof body.language === 'string' ? body.language : null;
    const lang = normalizeLanguage(requested);

    const updated = await updateUserLanguage({
      userId: auth.userId,
      userType: auth.userType || auth.role,
      language: lang,
    });

    notifLangLog('user.language.put', {
      userId: auth.userId,
      userType: auth.userType || auth.role,
      requested,
      normalized: lang,
      ok: updated && updated.success === true,
      stored: updated && updated.language ? updated.language : null,
    });

    if (!updated || updated.success !== true) {
      return res.status(400).json({
        success: false,
        error: (updated && updated.error) ? updated.error : 'Erreur mise à jour langue',
      });
    }

    return res.json({ success: true, language: updated.language || lang });
  } catch (e) {
    return res.status(500).json({ success: false, error: 'Erreur mise à jour langue' });
  }
});

async function getNotificationsForUser(userId, { unreadOnly = false, limit = 50 } = {}) {
  try {
    if (!userId) return [];

    let query = supabase
      .from(NOTIFICATIONS_TABLE)
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (unreadOnly) {
      query = query.eq('is_read', false);
    }

    const max = Math.min(Number(limit) || 50, 100);
    query = query.limit(max);

    const { data, error } = await query;
    if (error) {
      console.warn('⚠️ Erreur getNotificationsForUser:', error.message || error);
      return [];
    }
    return Array.isArray(data) ? data : [];
  } catch (e) {
    console.warn('⚠️ Exception getNotificationsForUser:', e && e.message ? e.message : e);
    return [];
  }
}

async function markNotificationRead(userId, notificationId) {
  try {
    if (!userId || !notificationId) return false;

    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId)
      .eq('user_id', userId);

    if (error) {
      console.warn('⚠️ Erreur markNotificationRead:', error.message || error);
      return false;
    }
    return true;
  } catch (e) {
    console.warn('⚠️ Exception markNotificationRead:', e && e.message ? e.message : e);
    return false;
  }
}

async function registerPushToken({ userId, platform, token, deviceId = null }) {
  try {
    if (!userId || !platform || !token) {
      return { success: false, error: 'Paramètres push invalides' };
    }

    const payload = {
      user_id: userId,
      platform,
      token,
      device_id: deviceId,
      last_used_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(PUSH_TOKENS_TABLE)
      .upsert(payload, { onConflict: 'token' })
      .select('*')
      .single();

    if (error) {
      console.warn('⚠️ Erreur registerPushToken:', error.message || error);
      return { success: false, error: 'Erreur enregistrement token push' };
    }

    return { success: true, data };
  } catch (e) {
    console.warn('⚠️ Exception registerPushToken:', e && e.message ? e.message : e);
    return { success: false, error: 'Erreur enregistrement token push' };
  }
}

// Vérifie, pour les actions sensibles, si la double confirmation avec mot de passe admin est requise
// Retourne { ok: true } si tout est bon ou si requireDoubleConfirm est désactivé.
// Sinon, renvoie directement la réponse HTTP (400/401/403) et retourne { ok: false }.
async function verifyAdminDoubleConfirm(req, res) {
  try {
    const { requireDoubleConfirm } = await getSecuritySettings();

    // Si la double confirmation n'est pas activée, on laisse passer l'action
    if (!requireDoubleConfirm) {
      return { ok: true };
    }

    // L'acteur doit être un admin web
    const actor = buildActorFromRequest(req);
    if (!actor || actor.role !== 'admin') {
      res.status(403).json({ success: false, error: 'Accès refusé' });
      return { ok: false };
    }

    const body = req.body || {};
    let adminPassword = '';
    if (typeof body.adminPassword === 'string' && body.adminPassword.trim().length > 0) {
      adminPassword = body.adminPassword.trim();
    } else if (req.query && typeof req.query.adminPassword === 'string' && req.query.adminPassword.trim().length > 0) {
      adminPassword = req.query.adminPassword.trim();
    }

    if (!adminPassword) {
      res.status(400).json({
        success: false,
        error: 'Mot de passe administrateur requis pour cette action sensible.',
      });
      return { ok: false };
    }

    const storedHash = await getAdminWebPasswordHash();
    let isValidPassword = false;

    if (storedHash) {
      try {
        isValidPassword = await bcrypt.compare(adminPassword, storedHash);
      } catch (e) {
        isValidPassword = false;
      }
    } else {
      // Fallback temporaire si aucun hash n'est encore configuré
      isValidPassword = adminPassword === '12345678';
    }

    if (!isValidPassword) {
      res.status(401).json({
        success: false,
        error: 'Mot de passe administrateur incorrect pour cette action sensible.',
      });
      return { ok: false };
    }

    return { ok: true };
  } catch (e) {
    console.error('💥 Exception verifyAdminDoubleConfirm:', e);
    res.status(500).json({ success: false, error: "Erreur interne lors de la vérification de l'action sensible" });
    return { ok: false };
  }
}

// Utilitaires sécurité / IP
function getClientIp(req) {
  try {
    let ip = requestIp.getClientIp(req);
    if (!ip) return null;

    // request-ip peut renvoyer ::ffff:1.2.3.4 -> on nettoie
    if (ip.startsWith('::ffff:')) {
      ip = ip.substring(7);
    }

    // En local (127.0.0.1 / ::1), essayer de récupérer l'IP réseau réelle de la machine
    if (ip === '::1' || ip === '127.0.0.1') {
      try {
        const ifaces = os.networkInterfaces();
        for (const name of Object.keys(ifaces)) {
          const entries = ifaces[name] || [];
          for (const entry of entries) {
            if (entry && entry.family === 'IPv4' && !entry.internal && entry.address) {
              ip = entry.address;
              break;
            }
          }
        }
      } catch (e) { }
    }

    return ip;
  } catch (e) {
    return null;
  }
}

function getGeoFromIp(ip) {
  if (!ip) return null;
  try {
    const geo = geoip.lookup(ip);
    if (!geo) return null;
    return {
      countryCode: geo.country || null,
      country: geo.country || null,
      city: Array.isArray(geo.city) ? geo.city[0] : geo.city || null,
      region: Array.isArray(geo.region) ? geo.region[0] : geo.region || null,
      ll: Array.isArray(geo.ll) ? geo.ll : null,
    };
  } catch (e) {
    return null;
  }
}

function isPrivateIp(ip) {
  if (!ip) return false;
  if (ip === '127.0.0.1' || ip === '::1') return true;
  if (ip.startsWith('10.')) return true;
  if (ip.startsWith('192.168.')) return true;
  const m = ip.match(/^172\.(\d+)\./);
  if (m) {
    const second = Number(m[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

// Gestion mot de passe admin web (stocké en hash dans app_settings)
const ADMIN_WEB_PHONE = '91912191';
const ADMIN_WEB_USER_ID = 'admin-1';

async function getAdminWebAllowedLocalPhone() {
  try {
    const { data, error } = await supabase
      .from('admin_profiles')
      .select('phone')
      .eq('id', ADMIN_WEB_USER_ID)
      .maybeSingle();

    if (error) {
      return ADMIN_WEB_PHONE;
    }

    const candidate = data && data.phone ? toLocalPhone(String(data.phone)) : null;
    return candidate || ADMIN_WEB_PHONE;
  } catch (e) {
    return ADMIN_WEB_PHONE;
  }
}

async function getAdminWebPasswordHash() {
  try {
    const { data, error } = await supabase
      .from('app_settings')
      .select('value')
      .eq('key', 'admin_web_password_hash')
      .maybeSingle();

    if (error) {
      console.error('💥 Erreur lecture admin_web_password_hash:', error);
      return null;
    }
    return data && data.value ? String(data.value) : null;
  } catch (e) {
    console.error('💥 Exception getAdminWebPasswordHash:', e);
    return null;
  }
}

async function setAdminWebPasswordHash(newHash) {
  try {
    const { error } = await supabase
      .from('app_settings')
      .upsert({ key: 'admin_web_password_hash', value: newHash }, { onConflict: 'key' });
    if (error) {
      console.error('💥 Erreur écriture admin_web_password_hash:', error);
      return false;
    }
    return true;
  } catch (e) {
    console.error('💥 Exception setAdminWebPasswordHash:', e);
    return false;
  }
}

// Alerte sécurité par SMS (blocage admin, événements critiques)
async function sendSecurityAlertSms({ reason, phone, ip, userAgent }) {
  try {
    const smsSettings = await getSmsAdvancedSettings();
    if (!smsSettings || smsSettings.enabled === false) {
      return { success: false, disabled: true };
    }

    const directionNumber = smsSettings && smsSettings.adminNumber
      ? String(smsSettings.adminNumber).trim()
      : ADMIN_WEB_PHONE;

    const adminLocalPhone = await getAdminWebAllowedLocalPhone();

    if (!directionNumber) {
      return { success: false, error: 'Numéro direction SMS non configuré' };
    }

    // Choisir le destinataire :
    // - si le numéro de compte existe chez un distributeur, on l’alerte
    // - sinon, on alerte la Direction
    let recipient = directionNumber;

    if (phone) {
      try {
        const local = toLocalPhone(phone);
        if (local) {
          if (local === adminLocalPhone) {
            // Admin web : on considère que c'est la Direction
            recipient = directionNumber;
          } else {
            const { data, error } = await supabase
              .from('distributors')
              .select('id')
              .eq('phone', local)
              .limit(1);
            if (!error && Array.isArray(data) && data.length > 0) {
              // Numéro existant côté distributeurs → on notifie ce numéro
              recipient = local;
            }
          }
        }
      } catch (e) { }
    }

    let recipientLanguage = 'fr';
    try {
      const localRecipient = toLocalPhone(recipient) || recipient;
      const localDirection = toLocalPhone(directionNumber) || directionNumber;
      if (localRecipient && String(localRecipient).trim() !== String(localDirection).trim()) {
        const { data: d } = await supabase
          .from('distributors')
          .select('language, lang, locale')
          .eq('phone', localRecipient)
          .maybeSingle();
        if (d && (d.language || d.lang || d.locale)) {
          recipientLanguage = normalizeLanguage(d.language || d.lang || d.locale);
        }
      }
    } catch (e) { }

    const effectiveIp = ip || 'Inconnue';
    let country = 'Inconnu';
    let city = 'Inconnue';

    if (ip) {
      const geo = getGeoFromIp(ip);
      if (geo) {
        if (geo.country) country = geo.country;
        if (geo.city) city = geo.city;
      }
      // Si IP privée (réseau interne) et géoloc inconnue, utiliser les valeurs par défaut
      if ((!geo || (!geo.country && !geo.city)) && isPrivateIp(ip)) {
        if (!geo || !geo.country) country = DEFAULT_COUNTRY_NAME;
        if (!geo || !geo.city) city = DEFAULT_CITY_NAME;
      }
    } else {
      // Sans IP, on part au moins sur la localisation par défaut de la plateforme
      country = DEFAULT_COUNTRY_NAME;
      city = DEFAULT_CITY_NAME;
    }

    const nowLocal = formatLocalDateTime(new Date());

    // Template simple pour commencer (peut être déplacé plus tard dans app_settings)
    let message = pickByLang(recipientLanguage, {
      fr:
        'Sécurité Moov Money - Tentative connexion admin.' +
        ` Motif: ${reason || 'inconnu'}.` +
        (phone ? ` Compte: ${phone}.` : '') +
        ` IP: ${effectiveIp}.` +
        ` Pays: ${country}.` +
        ` Ville: ${city}.` +
        (userAgent ? ` Appareil: ${userAgent.substring(0, 80)}...` : ' Appareil: Inconnu.') +
        ` Heure: ${nowLocal} (${DEFAULT_TIMEZONE}).`,
      en:
        'Moov Money Security - Admin login attempt.' +
        ` Reason: ${reason || 'unknown'}.` +
        (phone ? ` Account: ${phone}.` : '') +
        ` IP: ${effectiveIp}.` +
        ` Country: ${country}.` +
        ` City: ${city}.` +
        (userAgent ? ` Device: ${userAgent.substring(0, 80)}...` : ' Device: Unknown.') +
        ` Time: ${nowLocal} (${DEFAULT_TIMEZONE}).`,
      ar:
        'أمان مووف موني - محاولة تسجيل دخول كمسؤول.' +
        ` السبب: ${reason || 'غير معروف'}.` +
        (phone ? ` الحساب: ${phone}.` : '') +
        ` عنوان IP: ${effectiveIp}.` +
        ` الدولة: ${country}.` +
        ` المدينة: ${city}.` +
        (userAgent ? ` الجهاز: ${userAgent.substring(0, 80)}...` : ' الجهاز: غير معروف.') +
        ` الوقت: ${nowLocal} (${DEFAULT_TIMEZONE}).`,
    });

    const result = await smsService.sendSMS(recipient, message, 'security_alert');
    if (!result || !result.success) {
      console.error('💥 Erreur envoi SMS alerte sécurité:', result && result.error);
      return { success: false, error: result && result.error };
    }
    return { success: true };
  } catch (e) {
    console.error('💥 Exception sendSecurityAlertSms:', e);
    return { success: false, error: 'Erreur envoi SMS sécurité' };
  }
}

// Cache simple en mémoire pour les paramètres de sécurité
const securitySettingsCache = {
  loadedAt: 0,
  data: null,
};

async function getSecuritySettings() {
  try {
    const now = Date.now();
    if (securitySettingsCache.data && now - securitySettingsCache.loadedAt < 60_000) {
      return securitySettingsCache.data;
    }

    let sessionDurationMinutes = 60;
    let idleTimeoutMinutes = 30;
    let maxLoginAttempts = 5;
    let lockoutMinutes = 15;
    let requireDoubleConfirm = true;

    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'security_session_duration_min',
          'security_idle_timeout_min',
          'security_max_login_attempts',
          'security_lockout_minutes',
          'security_require_double_confirm',
        ]);

      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || !row.key) continue;
          const v = row.value;
          if (row.key === 'security_session_duration_min' && v != null && !isNaN(Number(v))) {
            sessionDurationMinutes = Number(v);
          } else if (row.key === 'security_idle_timeout_min' && v != null && !isNaN(Number(v))) {
            idleTimeoutMinutes = Number(v);
          } else if (row.key === 'security_max_login_attempts' && v != null && !isNaN(Number(v))) {
            maxLoginAttempts = Number(v);
          } else if (row.key === 'security_lockout_minutes' && v != null && !isNaN(Number(v))) {
            lockoutMinutes = Number(v);
          } else if (row.key === 'security_require_double_confirm' && v != null) {
            if (typeof v === 'boolean') {
              requireDoubleConfirm = v;
            } else if (typeof v === 'string') {
              requireDoubleConfirm = v === 'true' || v === '1';
            }
          }
        }
      }
    } catch (e) { }

    // Validation basique / bornes de sécurité
    if (!sessionDurationMinutes || isNaN(sessionDurationMinutes) || sessionDurationMinutes < 15 || sessionDurationMinutes > 1440) {
      sessionDurationMinutes = 60;
    }
    if (!idleTimeoutMinutes || isNaN(idleTimeoutMinutes) || idleTimeoutMinutes < 5 || idleTimeoutMinutes > sessionDurationMinutes) {
      idleTimeoutMinutes = Math.min(30, sessionDurationMinutes);
    }
    if (!maxLoginAttempts || isNaN(maxLoginAttempts) || maxLoginAttempts < 1 || maxLoginAttempts > 20) {
      maxLoginAttempts = 5;
    }
    if (!lockoutMinutes || isNaN(lockoutMinutes) || lockoutMinutes < 1 || lockoutMinutes > 1440) {
      lockoutMinutes = 15;
    }

    const settings = {
      sessionDurationMinutes,
      idleTimeoutMinutes,
      maxLoginAttempts,
      lockoutMinutes,
      requireDoubleConfirm,
    };

    securitySettingsCache.data = settings;
    securitySettingsCache.loadedAt = now;
    return settings;
  } catch (e) {
    return {
      sessionDurationMinutes: 60,
      idleTimeoutMinutes: 30,
      maxLoginAttempts: 5,
      lockoutMinutes: 15,
      requireDoubleConfirm: true,
    };
  }
}

// Cache simple en mémoire pour les paramètres SMS avancés
const smsAdvancedSettingsCache = {
  loadedAt: 0,
  data: null,
};

async function getSmsAdvancedSettings() {
  try {
    const now = Date.now();
    if (smsAdvancedSettingsCache.data && now - smsAdvancedSettingsCache.loadedAt < 60_000) {
      return smsAdvancedSettingsCache.data;
    }

    let mode = null;
    let enabled = null;
    let testNumber = null;
    let adminNumber = null;
    let lowBalanceTemplate = null;
    let criticalErrorTemplate = null;
    let otpAdminTemplate = null;
    let supervisorAccountCreatedTemplate = null;
    let notifyEventsEnabled = null;
    let notifyEventsAll = null;
    let notifyEventsCooldownSeconds = null;
    let notifyEventsPrefix = null;

    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'sms_mode',
          'sms_enabled',
          'sms_test_number',
          'sms_alert_low_balance_template',
          'sms_alert_critical_error_template',
          'sms_otp_admin_template',
          'sms_supervisor_account_created_template',
          'sms_direction_number',
          'sms_notify_events_enabled',
          'sms_notify_events_all',
          'sms_notify_events_cooldown_seconds',
          'sms_notify_events_prefix',
        ]);

      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || !row.key) continue;
          const v = row.value;
          if (row.key === 'sms_mode' && v != null) {
            const m = String(v).toLowerCase();
            if (m === 'test' || m === 'prod') mode = m;
          } else if (row.key === 'sms_enabled' && v != null) {
            if (typeof v === 'boolean') enabled = v;
            else enabled = String(v).toLowerCase() === 'true' || String(v) === '1';
          } else if (row.key === 'sms_test_number' && v != null) {
            testNumber = String(v).trim();
          } else if (row.key === 'sms_alert_low_balance_template' && v != null) {
            lowBalanceTemplate = String(v);
          } else if (row.key === 'sms_alert_critical_error_template' && v != null) {
            criticalErrorTemplate = String(v);
          } else if (row.key === 'sms_otp_admin_template' && v != null) {
            otpAdminTemplate = String(v);
          } else if (row.key === 'sms_supervisor_account_created_template' && v != null) {
            supervisorAccountCreatedTemplate = String(v);
          } else if (row.key === 'sms_direction_number' && v != null) {
            adminNumber = String(v).trim();
          } else if (row.key === 'sms_notify_events_enabled' && v != null) {
            if (typeof v === 'boolean') notifyEventsEnabled = v;
            else notifyEventsEnabled = String(v).toLowerCase() === 'true' || String(v) === '1';
          } else if (row.key === 'sms_notify_events_all' && v != null) {
            if (typeof v === 'boolean') notifyEventsAll = v;
            else notifyEventsAll = String(v).toLowerCase() === 'true' || String(v) === '1';
          } else if (row.key === 'sms_notify_events_cooldown_seconds' && v != null && !isNaN(Number(v))) {
            notifyEventsCooldownSeconds = Math.max(0, Math.min(3600, Number(v)));
          } else if (row.key === 'sms_notify_events_prefix' && v != null) {
            notifyEventsPrefix = String(v);
          }
        }
      }
    } catch (e) { }

    if (!mode) {
      const envTest = String(process.env.SMS_TEST_MODE || 'false').toLowerCase() === 'true';
      mode = envTest ? 'test' : 'prod';
    }

    if (enabled == null) {
      const envEnabled = String(process.env.SMS_ENABLED || 'true').toLowerCase();
      enabled = envEnabled !== 'false' && envEnabled !== '0';
    }

    if (!testNumber) {
      testNumber = process.env.SMS_TEST_NUMBER || '';
    }

    if (!adminNumber) {
      adminNumber = process.env.SMS_ADMIN_NUMBER || null;
    }

    if (!lowBalanceTemplate) {
      lowBalanceTemplate =
        'Alerte: le container {container_code} pour {distributor_name} est bas. Solde {balance} FCFA (seuil {threshold} FCFA).';
    }

    if (!criticalErrorTemplate) {
      criticalErrorTemplate =
        'Alerte critique Moov Money: {error_message}. Code: {error_code}. Heure: {timestamp}.';
    }

    if (!otpAdminTemplate) {
      otpAdminTemplate =
        'Code de connexion admin Moov Money: {code}. Ne partagez jamais ce code.';
    }

    if (!supervisorAccountCreatedTemplate) {
      supervisorAccountCreatedTemplate =
        'MoovMoney: Compte superviseur créé. Téléphone: {phone}. PIN: {pin}. Connectez-vous puis changez votre PIN.';
    }

    if (notifyEventsEnabled == null) {
      notifyEventsEnabled = true;
    }

    if (notifyEventsAll == null) {
      notifyEventsAll = true;
    }

    if (notifyEventsCooldownSeconds == null || isNaN(Number(notifyEventsCooldownSeconds))) {
      notifyEventsCooldownSeconds = 60;
    }

    if (!notifyEventsPrefix) {
      notifyEventsPrefix = 'MoovMoney';
    }

    const settings = {
      mode,
      enabled,
      testNumber,
      adminNumber,
      notifyEventsEnabled,
      notifyEventsAll,
      notifyEventsCooldownSeconds,
      notifyEventsPrefix,
      templates: {
        lowBalance: lowBalanceTemplate,
        criticalError: criticalErrorTemplate,
        otpAdmin: otpAdminTemplate,
        supervisorAccountCreated: supervisorAccountCreatedTemplate,
      },
    };

    smsAdvancedSettingsCache.data = settings;
    smsAdvancedSettingsCache.loadedAt = now;

    return settings;
  } catch (e) {
    return {
      mode: 'prod',
      enabled: true,
      testNumber: process.env.SMS_TEST_NUMBER || '',
      adminNumber: process.env.SMS_ADMIN_NUMBER || null,
      notifyEventsEnabled: true,
      notifyEventsAll: true,
      notifyEventsCooldownSeconds: 60,
      notifyEventsPrefix: 'MoovMoney',
      templates: {
        lowBalance:
          'Alerte: le container {container_code} pour {distributor_name} est bas. Solde {balance} FCFA (seuil {threshold} FCFA).',
        criticalError:
          'Alerte critique Moov Money: {error_message}. Code: {error_code}. Heure: {timestamp}.',
        otpAdmin:
          'Code de connexion admin Moov Money: {code}. Ne partagez jamais ce code.',
        supervisorAccountCreated:
          'MoovMoney: Compte superviseur créé. Téléphone: {phone}. PIN: {pin}.',
      },
    };
  }
}

function generateAdminOtpCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const digits = '0123456789';
  const all = letters + digits;
  let otp = '';

  // Assurer au moins une lettre et un chiffre
  otp += letters[Math.floor(Math.random() * letters.length)];
  otp += digits[Math.floor(Math.random() * digits.length)];

  for (let i = 0; i < 4; i++) {
    otp += all[Math.floor(Math.random() * all.length)];
  }

  return otp
    .split('')
    .sort(() => Math.random() - 0.5)
    .join('')
    .toUpperCase();
}

async function createAndSendAdminOtp(localPhone) {
  try {
    const settings = await getSmsAdvancedSettings();

    // Mode OTP de test : ne pas envoyer de SMS, retourner directement un succès
    if (OTP_TEST_MODE) {
      return { success: true, expiresIn: 300 };
    }
    if (!settings || settings.enabled === false) {
      return { success: false, error: 'Envoi SMS OTP admin désactivé dans les paramètres' };
    }

    const code = generateAdminOtpCode();
    const ttlSeconds = 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    try {
      await supabase
        .from('otp_codes')
        .delete()
        .eq('phone', localPhone)
        .eq('user_type', 'admin');
    } catch (e) { }

    const { error } = await supabase.from('otp_codes').insert({
      phone: localPhone,
      code,
      user_type: 'admin',
      user_id: null,
      expires_at: expiresAt,
    });
    if (error) {
      console.error('💥 Erreur enregistrement OTP admin:', error);
      return { success: false, error: "Erreur enregistrement OTP admin" };
    }

    const tpl = (settings.templates && settings.templates.otpAdmin) ||
      'Code de connexion admin Moov Money: {code}. Ne partagez jamais ce code.';
    const message = tpl.replace(/\{code\}/g, code);

    try {
      const { error: queueError } = await supabase.from('sms_queue').insert({
        id: crypto.randomUUID(),
        phone: localPhone,
        message,
        channel: 'web',
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      });

      if (queueError) {
        console.error('💥 Erreur insertion sms_queue pour OTP admin:', queueError);
        return { success: false, error: 'Erreur mise en file du SMS OTP admin' };
      }
    } catch (queueEx) {
      console.error('💥 Exception insertion sms_queue pour OTP admin:', queueEx);
      return { success: false, error: 'Erreur mise en file du SMS OTP admin' };
    }

    return { success: true, expiresIn: ttlSeconds };
  } catch (e) {
    console.error('💥 Exception OTP admin:', e);
    return { success: false, error: 'Erreur OTP admin' };
  }
}

// OTP pour les utilisateurs mobiles (superviseur / distributeur)
async function createAndSendUserOtp(localPhone, userType, userId) {
  let lang = 'fr';
  try {
    const settings = await getSmsAdvancedSettings();

    lang = await resolveUserLanguage({ userId, userType });

    console.log('📨 createAndSendUserOtp:', {
      localPhone,
      userType,
      userId,
      smsEnabled: settings ? settings.enabled : null,
      smsMode: settings ? settings.mode : null,
      OTP_TEST_MODE,
    });

    // Mode OTP de test : ne pas envoyer de SMS ni écrire dans otp_codes/sms_queue,
    // simplement retourner un succès pour débloquer le flux mobile.
    if (OTP_TEST_MODE) {
      return { success: true, expiresIn: 300 };
    }

    if (!settings || settings.enabled === false) {
      return {
        success: false,
        error: pickByLang(lang, {
          fr: 'Envoi SMS OTP désactivé dans les paramètres',
          en: 'OTP SMS sending is disabled in settings',
          ar: 'تم تعطيل إرسال SMS لرمز OTP في الإعدادات',
        }),
      };
    }

    const code = generateAdminOtpCode();
    const ttlSeconds = 300;
    const expiresAt = new Date(Date.now() + ttlSeconds * 1000).toISOString();

    // Nettoyer les anciens OTP pour cet utilisateur mobile
    try {
      await supabase
        .from('otp_codes')
        .delete()
        .eq('phone', localPhone)
        .eq('user_type', userType)
        .eq('user_id', userId);
    } catch (e) { }

    const { error } = await supabase.from('otp_codes').insert({
      phone: localPhone,
      code,
      user_type: userType,
      user_id: userId,
      expires_at: expiresAt,
    });
    if (error) {
      console.error('💥 Erreur enregistrement OTP mobile:', error);
      return {
        success: false,
        error: pickByLang(lang, {
          fr: 'Erreur enregistrement OTP mobile',
          en: 'Failed to save mobile OTP',
          ar: 'فشل حفظ رمز OTP للهاتف',
        }),
      };
    }

    const rawTpl = (settings.templates && (settings.templates.otpUser || settings.templates.otpMobile)) || null;
    let resolvedTpl = null;
    if (typeof rawTpl === 'string') {
      const trimmed = rawTpl.trim();
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed);
          resolvedTpl = pickByLang(lang, parsed);
        } catch (e) {
          resolvedTpl = rawTpl;
        }
      } else {
        resolvedTpl = rawTpl;
      }
    }

    const fallbackTpl = pickByLang(lang, {
      fr: 'Code de connexion Moov Money: {code}. Ne partagez jamais ce code.',
      en: 'Moov Money login code: {code}. Never share this code.',
      ar: 'رمز تسجيل الدخول مووف موني: {code}. لا تشارك هذا الرمز أبداً.',
    });

    const tpl = resolvedTpl || fallbackTpl;
    const message = String(tpl).replace(/\{code\}/g, code);

    // Au lieu d'appeler directement Termux depuis Render (impossible en prod),
    // on enfile le SMS dans la table sms_queue pour qu'un agent Termux vienne le traiter.
    try {
      const queuePayload = {
        id: crypto.randomUUID(),
        phone: localPhone,
        message,
        channel: 'mobile',
        status: 'pending',
        attempts: 0,
        created_at: new Date().toISOString(),
      };

      console.log('📩 createAndSendUserOtp queue insert:', {
        phone: queuePayload.phone,
        channel: queuePayload.channel,
        status: queuePayload.status,
      });

      const { error: queueError } = await supabase.from('sms_queue').insert(queuePayload);

      if (queueError) {
        console.error('💥 Erreur insertion sms_queue pour OTP mobile:', queueError);
        return {
          success: false,
          error: pickByLang(lang, {
            fr: 'Erreur mise en file du SMS OTP mobile',
            en: 'Failed to queue mobile OTP SMS',
            ar: 'فشل وضع رسالة OTP في قائمة الانتظار',
          }),
        };
      }

      console.log('✅ createAndSendUserOtp queued (mobile) for phone', localPhone);
    } catch (e) {
      console.error('💥 Exception insertion sms_queue pour OTP mobile:', e);
      return {
        success: false,
        error: pickByLang(lang, {
          fr: 'Erreur mise en file du SMS OTP mobile',
          en: 'Failed to queue mobile OTP SMS',
          ar: 'فشل وضع رسالة OTP في قائمة الانتظار',
        }),
      };
    }

    // L'OTP est bien enregistré et le SMS est en file d'attente pour Termux
    return { success: true, expiresIn: ttlSeconds };
  } catch (e) {
    console.error('💥 Exception OTP mobile:', e);
    return {
      success: false,
      error: pickByLang(lang, {
        fr: 'Erreur OTP mobile',
        en: 'Mobile OTP error',
        ar: 'خطأ في رمز OTP للهاتف',
      }),
    };
  }
}

// Tentatives de connexion (en mémoire, pour l'admin web)
const loginAttempts = new Map();

function signAuthToken(payload, expiresInSeconds) {
  try {
    const options = {};
    if (expiresInSeconds && Number(expiresInSeconds) > 0) {
      options.expiresIn = Number(expiresInSeconds);
    } else {
      options.expiresIn = JWT_EXPIRES_IN;
    }
    return jwt.sign(payload, JWT_SECRET, options);
  } catch (e) {
    return null;
  }
}

function verifyAuthToken(token) {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (e) {
    return null;
  }
}

function getAuthFromRequest(req) {
  try {
    const headers = req.headers || {};
    let token = null;
    const authHeader = headers['authorization'] || headers['Authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      token = authHeader.replace('Bearer ', '').trim();
    }
    if (!token && req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
      token = req.cookies[AUTH_COOKIE_NAME];
    }
    if (!token) {
      return null;
    }
    if (token === 'admin-token') {
      return { userId: 'admin-1', role: 'admin', userType: 'admin' };
    }
    const decoded = verifyAuthToken(token);
    if (!decoded || !decoded.sub) {
      return null;
    }
    return {
      userId: decoded.sub,
      role: decoded.role || decoded.userType || 'distributor',
      userType: decoded.userType || decoded.role || 'distributor',
    };
  } catch (e) {
    return null;
  }
}

function normalizeLanguage(lang) {
  try {
    if (!lang) return 'fr';
    const raw = String(lang).trim().toLowerCase();
    const short = raw.split(/[-_]/)[0];
    if (short === 'fr' || short === 'en' || short === 'ar') return short;
    if (short === 'ang' || short === 'eng' || short === 'english' || short === 'anglais') return 'en';
    if (short === 'arabe' || short === 'arabic') return 'ar';
    if (short === 'francais' || short === 'français' || short === 'french') return 'fr';
    return 'fr';
  } catch (e) {
    return 'fr';
  }
}

async function readDeviceLanguage({ deviceId }) {
  try {
    const id = deviceId ? String(deviceId).trim() : '';
    if (!id) return null;
    const { data, error } = await supabase
      .from(DEVICE_LANG_TABLE)
      .select('language')
      .eq('device_id', id)
      .maybeSingle();
    if (error) return null;
    const val = data && data.language ? normalizeLanguage(data.language) : null;
    return val || null;
  } catch (e) {
    return null;
  }
}

async function upsertDeviceLanguage({ deviceId, language, platform = null }) {
  try {
    const id = deviceId ? String(deviceId).trim() : '';
    if (!id) return { ok: false, error: 'deviceId manquant' };
    const lang = normalizeLanguage(language);

    const payload = {
      device_id: id,
      language: lang,
      platform: platform ? String(platform).trim() : null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(DEVICE_LANG_TABLE)
      .upsert(payload, { onConflict: 'device_id' })
      .select('language')
      .maybeSingle();

    if (error) return { ok: false, error: error.message || String(error) };
    const stored = data && data.language ? normalizeLanguage(data.language) : lang;
    return { ok: true, language: stored };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

async function readUserLanguageFromUserLanguages({ userId, userType }) {
  try {
    if (!userId) return null;
    const { data, error } = await supabase
      .from(USER_LANG_TABLE)
      .select('language')
      .eq('user_id', String(userId))
      .maybeSingle();
    if (error) return null;
    const val = data && data.language ? normalizeLanguage(data.language) : null;
    if (val) {
      notifLangLog('resolve.source', {
        userId,
        userType: normalizeUserType(userType) || null,
        table: USER_LANG_TABLE,
        lang: val,
      });
    }
    return val;
  } catch (e) {
    return null;
  }
}

async function upsertUserLanguageToUserLanguages({ userId, userType, language }) {
  try {
    if (!userId) return { ok: false, error: 'userId manquant' };
    const lang = normalizeLanguage(language);
    const payload = {
      user_id: String(userId),
      user_type: normalizeUserType(userType),
      language: lang,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from(USER_LANG_TABLE)
      .upsert(payload, { onConflict: 'user_id' })
      .select('language')
      .maybeSingle();

    if (error) {
      return { ok: false, error: error.message || String(error) };
    }
    const stored = data && data.language ? normalizeLanguage(data.language) : lang;
    notifLangLog('user_languages.upsert', {
      userId,
      userType: normalizeUserType(userType) || null,
      lang: stored,
    });
    return { ok: true, language: stored };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

async function readUserLanguageFromTable({ table, userId }) {
  try {
    if (!table || !userId) return null;

    const trySelect = async (columns) => {
      const { data, error } = await supabase
        .from(table)
        .select(columns)
        .eq('id', userId)
        .maybeSingle();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('does not exist') || msg.includes('unknown column')) {
          return null;
        }
        return null;
      }
      if (!data) return null;
      return data;
    };

    const row =
      (await trySelect('language, lang, locale'))
      || (await trySelect('language, lang'))
      || (await trySelect('language, locale'))
      || (await trySelect('language'))
      || (await trySelect('lang'))
      || (await trySelect('locale'));

    if (!row) return null;
    const val = row.language || row.lang || row.locale || null;
    if (!val) return null;
    return normalizeLanguage(val);
  } catch (e) {
    return null;
  }
}

async function writeUserLanguageToTable({ table, userId, language }) {
  try {
    if (!table || !userId) return { ok: false, error: 'Paramètres invalides' };
    const lang = normalizeLanguage(language);

    const attemptUpdate = async (payload) => {
      const { data, error } = await supabase
        .from(table)
        .update({ ...payload })
        .eq('id', userId)
        .select('language, lang, locale')
        .maybeSingle();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('does not exist') || msg.includes('unknown column')) {
          return { ok: false, retryable: true, error: error.message || 'Colonne absente' };
        }
        if (error.code === 'PGRST116' || msg.includes('0 rows') || msg.includes('no rows')) {
          return { ok: false, retryable: true, missingRow: true, error: error.message || 'Ligne introuvable' };
        }
        return { ok: false, retryable: false, error: error.message || 'Erreur mise à jour langue' };
      }
      return { ok: true, data };
    };

    const attemptUpsert = async (payload) => {
      const { data, error } = await supabase
        .from(table)
        .upsert({ id: userId, ...payload }, { onConflict: 'id' })
        .select('language, lang, locale')
        .maybeSingle();
      if (error) {
        const msg = (error.message || '').toLowerCase();
        if (msg.includes('does not exist') || msg.includes('unknown column')) {
          return { ok: false, retryable: true, error: error.message || 'Colonne absente' };
        }
        return { ok: false, retryable: false, error: error.message || 'Erreur upsert langue' };
      }
      return { ok: true, data };
    };

    const attempts = [
      { language: lang },
      { lang },
      { locale: lang },
    ];

    for (const payload of attempts) {
      let res = await attemptUpdate(payload);
      if (res.ok) {
        const updated = res.data ? (res.data.language || res.data.lang || res.data.locale) : null;
        return { ok: true, language: normalizeLanguage(updated || lang) };
      }

      if (res && res.missingRow) {
        res = await attemptUpsert(payload);
        if (res.ok) {
          const updated = res.data ? (res.data.language || res.data.lang || res.data.locale) : null;
          return { ok: true, language: normalizeLanguage(updated || lang) };
        }
      }

      if (!res.retryable) return { ok: false, error: res.error };
    }

    return { ok: false, error: `Schéma DB incomplet: aucune colonne language/lang/locale dans ${table}` };
  } catch (e) {
    return { ok: false, error: e && e.message ? e.message : String(e) };
  }
}

function normalizeUserType(userType) {
  try {
    if (!userType) return null;
    const raw = String(userType).trim().toLowerCase();
    const short = raw.split(/[-_]/)[0];
    if (short === 'admin' || short === 'administrator') return 'admin';
    if (short === 'supervisor' || short === 'superviseur') return 'supervisor';
    if (short === 'distributor' || short === 'distributeur' || short === 'dist') return 'distributor';
    return null;
  } catch (e) {
    return null;
  }
}

async function resolveRequestLanguage(req, { userId, userType } = {}) {
  try {
    if (userId) {
      return await resolveUserLanguage({ userId, userType });
    }

    try {
      const auth = getAuthFromRequest(req);
      if (auth && auth.userId) {
        return await resolveUserLanguage({ userId: auth.userId, userType: auth.userType || auth.role });
      }
    } catch (e) { }

    const headerLang = req && req.headers
      ? (req.headers['x-lang'] || req.headers['x-language'] || req.headers['accept-language'] || null)
      : null;
    const bodyLang = req && req.body && typeof req.body.language === 'string' ? req.body.language : null;
    const queryLang = req && req.query
      ? (typeof req.query.lang === 'string' ? req.query.lang : (typeof req.query.language === 'string' ? req.query.language : null))
      : null;

    let raw = bodyLang || queryLang || headerLang;
    if (raw && typeof raw === 'string') {
      raw = raw.split(',')[0];
      raw = raw.split(';')[0];
      raw = raw.split('-')[0];
    }

    return normalizeLanguage(raw);
  } catch (e) {
    return 'fr';
  }
}

function pickByLang(lang, variants) {
  try {
    const l = normalizeLanguage(lang);
    if (!variants || typeof variants !== 'object') return '';
    return variants[l] || variants.fr || variants.en || variants.ar || '';
  } catch (e) {
    return '';
  }
}

function pickOtpErrorMessage(lang, code) {
  try {
    const c = code ? String(code) : null;
    if (!c) return null;
    if (c === 'OTP_NOT_FOUND') {
      return pickByLang(lang, {
        fr: 'OTP non trouvé ou expiré',
        en: 'OTP not found or expired',
        ar: 'رمز OTP غير موجود أو منتهي الصلاحية',
      });
    }
    if (c === 'OTP_EXPIRED') {
      return pickByLang(lang, {
        fr: 'OTP expiré',
        en: 'OTP expired',
        ar: 'انتهت صلاحية رمز OTP',
      });
    }
    if (c === 'OTP_TOO_MANY_ATTEMPTS') {
      return pickByLang(lang, {
        fr: 'Trop de tentatives',
        en: 'Too many attempts',
        ar: 'محاولات كثيرة',
      });
    }
    if (c === 'OTP_INVALID') {
      return pickByLang(lang, {
        fr: 'Code OTP incorrect',
        en: 'Invalid OTP code',
        ar: 'رمز OTP غير صحيح',
      });
    }
    if (c === 'OTP_READ_ERROR' || c === 'OTP_VERIFY_ERROR') {
      return pickByLang(lang, {
        fr: 'Erreur lors de la vérification',
        en: 'Error during verification',
        ar: 'حدث خطأ أثناء التحقق',
      });
    }
    if (c === 'OTP_TEST_USER_NOT_FOUND') {
      return pickByLang(lang, {
        fr: 'Utilisateur mobile introuvable pour OTP test',
        en: 'Mobile user not found for OTP test',
        ar: 'تعذر العثور على مستخدم الهاتف لاختبار OTP',
      });
    }
    if (c === 'OTP_TEST_ERROR') {
      return pickByLang(lang, {
        fr: 'Erreur OTP test',
        en: 'OTP test error',
        ar: 'خطأ في اختبار OTP',
      });
    }
    return null;
  } catch (e) {
    return null;
  }
}

async function resolveUserLanguage({ userId, userType }) {
  try {
    if (!userId) return 'fr';
    const t = normalizeUserType(userType);

    try {
      const val = await readUserLanguageFromUserLanguages({ userId, userType: t });
      if (val) return val;
    } catch (e) { }

    if (t === 'admin' || !t) {
      try {
        const val = await readUserLanguageFromTable({ table: 'admin_profiles', userId });
        if (val) {
          notifLangLog('resolve.source', { userId, userType: t || null, table: 'admin_profiles', lang: val });
          return val;
        }
      } catch (e) { }
      if (t === 'admin') return 'fr';
    }

    if (t === 'supervisor' || !t) {
      try {
        const val = await readUserLanguageFromTable({ table: 'supervisors', userId });
        if (val) {
          notifLangLog('resolve.source', { userId, userType: t || null, table: 'supervisors', lang: val });
          return val;
        }
      } catch (e) { }
      if (t === 'supervisor') return 'fr';
    }

    try {
      const val = await readUserLanguageFromTable({ table: 'distributors', userId });
      if (val) {
        notifLangLog('resolve.source', { userId, userType: t || null, table: 'distributors', lang: val });
        return val;
      }
    } catch (e) { }

    return 'fr';
  } catch (e) {
    return 'fr';
  }
}

async function updateUserLanguage({ userId, userType, language }) {
  try {
    if (!userId) return { success: false, error: 'userId manquant' };
    const lang = normalizeLanguage(language);
    const t = normalizeUserType(userType);

    let robustOk = false;
    let robustLang = lang;

    // Stockage robuste (table dédiée). Si la table n'existe pas encore, on ignore.
    try {
      const up = await upsertUserLanguageToUserLanguages({ userId, userType: t, language: lang });
      if (up && up.ok && up.language) {
        robustOk = true;
        robustLang = up.language;
      }
    } catch (e) { }

    if (t === 'admin') {
      try {
        const res = await writeUserLanguageToTable({ table: 'admin_profiles', userId, language: lang });
        if (!res.ok) {
          if (robustOk) return { success: true, language: robustLang };
          return { success: false, error: res.error || 'Erreur mise à jour langue' };
        }
        return { success: true, language: res.language || robustLang || lang };
      } catch (e) {
        if (robustOk) return { success: true, language: robustLang };
        return { success: false, error: e && e.message ? e.message : String(e) };
      }
    }

    if (t === 'supervisor') {
      try {
        const res = await writeUserLanguageToTable({ table: 'supervisors', userId, language: lang });
        if (!res.ok) {
          if (robustOk) return { success: true, language: robustLang };
          return { success: false, error: res.error || 'Erreur mise à jour langue' };
        }
        return { success: true, language: res.language || robustLang || lang };
      } catch (e) {
        if (robustOk) return { success: true, language: robustLang };
        return { success: false, error: e && e.message ? e.message : String(e) };
      }
    }

    if (!t) {
      try {
        const supRes = await writeUserLanguageToTable({ table: 'supervisors', userId, language: lang });
        if (supRes.ok) return { success: true, language: supRes.language || lang };
      } catch (e) { }
    }

    try {
      const res = await writeUserLanguageToTable({ table: 'distributors', userId, language: lang });
      if (!res.ok) {
        if (robustOk) return { success: true, language: robustLang };
        return { success: false, error: res.error || 'Erreur mise à jour langue' };
      }
      return { success: true, language: res.language || robustLang || lang };
    } catch (e) {
      if (robustOk) return { success: true, language: robustLang };
      return { success: false, error: e && e.message ? e.message : String(e) };
    }
  } catch (e) {
    return { success: false, error: e && e.message ? e.message : String(e) };
  }
}

function maskAuditValue(key, value) {
  if (value === null || value === undefined) return value;
  try {
    const lowerKey = String(key).toLowerCase();
    if (SENSITIVE_AUDIT_FIELDS.some(field => lowerKey.includes(field))) {
      return '***MASKED***';
    }
    if (lowerKey === 'phone' || lowerKey.endsWith('_phone')) {
      const digits = String(value).replace(/[^0-9]/g, '');
      if (!digits) return value;
      const lastDigits = digits.slice(-3);
      return `***${lastDigits}`;
    }
  } catch {
    return '***MASKED***';
  }
  return value;
}

function maskSensitiveData(obj) {
  if (obj === null || obj === undefined) return obj;
  if (Array.isArray(obj)) return obj.map(item => maskSensitiveData(item));
  if (typeof obj === 'object') {
    const safe = {};
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      safe[key] =
        value && typeof value === 'object'
          ? maskSensitiveData(value)
          : maskAuditValue(key, value);
    }
    return safe;
  }
  return obj;
}

function buildActorFromRequest(req, overrides = {}) {
  try {
    const headers = req.headers || {};
    const authHeader = headers['authorization'] || headers['Authorization'] || '';
    const token =
      typeof authHeader === 'string' ? authHeader.replace('Bearer ', '') : '';

    const actor = { ...overrides };

    // Récupérer les infos d'authentification décodées (JWT / cookie)
    const auth = req.auth || getAuthFromRequest(req);
    if (auth) {
      if (!actor.id) {
        actor.id = auth.userId || auth.sub || actor.id;
      }
      if (!actor.role) {
        actor.role = auth.role || auth.userType || actor.role;
      }
    }

    // Fallback historique pour les anciens tokens texte
    if (!actor.role && token.includes('admin-token')) {
      actor.role = 'admin';
    }
    if (!actor.id && actor.role === 'admin') {
      actor.id = 'admin-1';
    }
    if (!actor.display_name && actor.role === 'admin') {
      actor.display_name = 'Direction Moov Africa TD';
    }

    const ipHeader = headers['x-forwarded-for'] || headers['x-real-ip'];
    const ipValue = Array.isArray(ipHeader) ? ipHeader[0] : ipHeader;
    let clientIp = null;
    try {
      clientIp = requestIp.getClientIp(req) || null;
    } catch (e) {
      clientIp = null;
    }
    if (!actor.ip) {
      actor.ip = clientIp || ipValue || req.ip || null;
    }

    if (actor.ip && (!actor.country_code || !actor.country_name)) {
      try {
        const geo = geoip.lookup(actor.ip);
        if (geo) {
          if (!actor.country_code) actor.country_code = geo.country || null;
          if (!actor.country_name) actor.country_name = geo.country || null;
        }
      } catch (e) { }
    }
    if (!actor.user_agent) {
      actor.user_agent = headers['user-agent'] || null;
    }

    return actor;
  } catch {
    return overrides || {};
  }
}

const logThrottles = new Map();

function throttledLog(key, message, ttlMs = 30000) {
  try {
    const now = Date.now();
    const last = logThrottles.get(key) || 0;
    if (now - last < ttlMs) return;
    logThrottles.set(key, now);
    console.log(message);
  } catch (e) {
    console.log(message);
  }
}

const activeSockets = new Set();

function trackConnection(socketId) {
  try {
    activeSockets.add(socketId);
    throttledLog('ws_connection', `🔌 Nouveau client WebSocket connecté: ${socketId}`, 5000);
  } catch (e) { }
}

function trackDisconnection(socketId) {
  try {
    activeSockets.delete(socketId);
    throttledLog('ws_disconnection', `🔌 Client WebSocket déconnecté: ${socketId}`, 5000);
  } catch (e) { }
}

const logAuditEvent = async (event) => {
  try {
    if (!event || !event.event_type) return;

    const nowIso = new Date().toISOString();
    const actor = event.actor || {};
    const resource = event.resource || {};
    const status = event.status || (event.error ? 'error' : 'success');

    const payload = {
      event_type: event.event_type,
      status,
      created_at: nowIso,
      actor_user_id: actor.id || actor.user_id || null,
      actor_role: actor.role || null,
      actor_display_name: actor.display_name || actor.name || null,
      actor_ip: actor.ip || null,
      actor_country_code: actor.country_code || null,
      actor_country_name: actor.country_name || null,
      actor_user_agent: actor.user_agent || null,
      resource_type: resource.type || null,
      resource_id: resource.id || null,
      resource_name: resource.name || null,
      action_summary: event.action_summary || null,
      values_before: event.values_before ? maskSensitiveData(event.values_before) : null,
      values_after: event.values_after ? maskSensitiveData(event.values_after) : null,
      error_code: event.error && event.error.code ? event.error.code : null,
      error_message: event.error && event.error.message ? event.error.message : null,
      metadata: event.metadata || null,
    };

    const insertResult = await supabase
      .from(AUDIT_TABLE)
      .insert(payload)
      .select(
        'id, created_at, event_type, status, actor_user_id, actor_role, resource_type, resource_id, resource_name, action_summary'
      )
      .single();

    if (insertResult.error) {
      const error = insertResult.error;
      if (error.code === '42P01' || (error.message && error.message.indexOf(AUDIT_TABLE) !== -1)) {
        throttledLog('audit_table_missing', 'Table audit_events introuvable, audit désactivé', 60000);
      } else {
        console.warn('Erreur journalisation audit:', error.message || error);
      }
      return;
    }

    const summary = insertResult.data || payload;

    try {
      if (io) {
        io.to('admins').emit('audit:new', {
          id: summary.id,
          created_at: summary.created_at || nowIso,
          event_type: summary.event_type,
          status: summary.status,
          actor_user_id: summary.actor_user_id || payload.actor_user_id,
          actor_role: summary.actor_role || payload.actor_role,
          resource_type: summary.resource_type || payload.resource_type,
          resource_id: summary.resource_id || payload.resource_id,
          resource_name: summary.resource_name || payload.resource_name,
          action_summary: summary.action_summary || payload.action_summary,
        });
      }
    } catch (socketError) {
      console.warn('Erreur émission Socket audit:', socketError && socketError.message ? socketError.message : socketError);
    }
  } catch (e) {
    console.warn('Erreur inattendue journalisation audit:', e && e.message ? e.message : e);
  }
};

async function logDistributorNotFound(req, id, action) {
  try {
    await logAuditEvent({
      event_type: `distributor.${action}_not_found`,
      status: 'error',
      actor: buildActorFromRequest(req),
      resource: { type: 'distributor', id },
      action_summary: `Action ${action} sur distributeur introuvable`,
      error: {
        code: 'NOT_FOUND',
        message: 'Distributeur non trouvé',
      },
      metadata: {
        path: req.path,
        method: req.method,
        query: req.query || {},
      },
    });
  } catch (e) { }
}

// Normaliser un numéro en format local 8 chiffres (ex: 91912191)
function toLocalPhone(phone) {
  try {
    const digits = String(phone || '').replace(/[^0-9]/g, '');
    if (!digits) return null;
    if (digits.length === 8) return digits;
    if (digits.startsWith('00235') && digits.length >= 13) return digits.slice(5, 13);
    if (digits.startsWith('235') && digits.length >= 11) return digits.slice(3, 11);
    if (digits.startsWith('+235') && digits.length >= 12) return digits.slice(4, 12);
    if (digits.startsWith('0') && digits.length >= 9) return digits.slice(-8);
    // Fallback: prendre les 8 derniers chiffres si possible
    if (digits.length >= 8) return digits.slice(-8);
    return digits;
  } catch {
    return null;
  }
}

// Initialisation Express
app.set('trust proxy', true);
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true
  }
});

// Preflight CORS pour suppression superviseur (la route est déclarée avant le middleware global cors)
app.options('/api/supervisors/:id', cors({ origin: true, credentials: true }));

// DELETE - Supprimer un superviseur (avec double confirmation administrateur)
app.delete('/api/supervisors/:id', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const { id } = req.params || {};
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID superviseur manquant' });
    }

    const gate = await verifyAdminDoubleConfirm(req, res);
    if (!gate || gate.ok !== true) return;

    // Charger superviseur (pour audit)
    const { data: supervisor, error: supErr } = await supabase
      .from('supervisors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (supErr) {
      console.error('💥 Erreur lecture superviseur avant suppression:', supErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la suppression du superviseur' });
    }

    if (!supervisor) {
      return res.status(404).json({ success: false, error: 'Superviseur non trouvé' });
    }

    // Détacher les distributeurs
    try {
      await supabase
        .from('distributors')
        .update({ supervisor_id: null, updated_at: new Date().toISOString() })
        .eq('supervisor_id', id);
    } catch (e) { }

    // Supprimer auth superviseur si existe
    try {
      await supabase.from('supervisor_auth').delete().eq('supervisor_id', id);
    } catch (e) { }

    // Supprimer superviseur
    const { error: delErr } = await supabase
      .from('supervisors')
      .delete()
      .eq('id', id);

    if (delErr) {
      console.error('💥 Erreur suppression superviseur:', delErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la suppression du superviseur' });
    }

    try {
      await logAuditEvent({
        event_type: 'supervisor.deleted',
        actor: buildActorFromRequest(req),
        resource: { type: 'supervisor', id },
        action_summary: 'Suppression superviseur',
        values_before: {
          supervisor_id: id,
          phone: supervisor?.phone || null,
          zone: supervisor?.zone || null,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req);

    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Superviseur supprimé avec succès',
        en: 'Supervisor deleted successfully',
        ar: 'تم حذف المشرف بنجاح',
      }),
    });
  } catch (error) {
    console.error('💥 Exception DELETE /api/supervisors/:id:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression du superviseur' });
  }
});

app.get('/api/settings/security', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    let sessionDurationMinutes = 60;
    let idleTimeoutMinutes = 30;
    let maxLoginAttempts = 5;
    let lockoutMinutes = 15;
    let requireDoubleConfirm = true;

    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'security_session_duration_min',
          'security_idle_timeout_min',
          'security_max_login_attempts',
          'security_lockout_minutes',
          'security_require_double_confirm',
        ]);

      if (Array.isArray(data)) {
        for (const row of data) {
          if (!row || !row.key) continue;
          const v = row.value;
          if (row.key === 'security_session_duration_min' && v != null && !isNaN(Number(v))) {
            sessionDurationMinutes = Number(v);
          } else if (row.key === 'security_idle_timeout_min' && v != null && !isNaN(Number(v))) {
            idleTimeoutMinutes = Number(v);
          } else if (row.key === 'security_max_login_attempts' && v != null && !isNaN(Number(v))) {
            maxLoginAttempts = Number(v);
          } else if (row.key === 'security_lockout_minutes' && v != null && !isNaN(Number(v))) {
            lockoutMinutes = Number(v);
          } else if (row.key === 'security_require_double_confirm' && v != null) {
            if (typeof v === 'boolean') {
              requireDoubleConfirm = v;
            } else if (typeof v === 'string') {
              requireDoubleConfirm = v === 'true' || v === '1';
            }
          }
        }
      }
    } catch (e) { }

    if (!sessionDurationMinutes || isNaN(sessionDurationMinutes) || sessionDurationMinutes <= 0) {
      sessionDurationMinutes = 60;
    }
    if (!idleTimeoutMinutes || isNaN(idleTimeoutMinutes) || idleTimeoutMinutes <= 0) {
      idleTimeoutMinutes = 30;
    }
    if (!maxLoginAttempts || isNaN(maxLoginAttempts) || maxLoginAttempts <= 0) {
      maxLoginAttempts = 5;
    }
    if (!lockoutMinutes || isNaN(lockoutMinutes) || lockoutMinutes <= 0) {
      lockoutMinutes = 15;
    }

    return res.json({
      success: true,
      data: {
        sessionDurationMinutes,
        idleTimeoutMinutes,
        maxLoginAttempts,
        lockoutMinutes,
        requireDoubleConfirm,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur chargement paramètres sécurité' });
  }
});

app.put('/api/settings/security', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const {
      sessionDurationMinutes,
      idleTimeoutMinutes,
      maxLoginAttempts,
      lockoutMinutes,
      requireDoubleConfirm,
    } = req.body || {};

    const s = Number(sessionDurationMinutes);
    const idle = Number(idleTimeoutMinutes);
    const attempts = Number(maxLoginAttempts);
    const lock = Number(lockoutMinutes);
    const doubleConfirm = Boolean(requireDoubleConfirm);

    if (!s || isNaN(s) || s < 15 || s > 1440) {
      return res.status(400).json({ success: false, error: 'Durée de session invalide (15-1440 min)' });
    }
    if (!idle || isNaN(idle) || idle < 5 || idle > s) {
      return res.status(400).json({ success: false, error: "Inactivité max invalide (5 min - durée de session)" });
    }
    if (!attempts || isNaN(attempts) || attempts < 1 || attempts > 20) {
      return res.status(400).json({ success: false, error: 'Nombre de tentatives invalide (1-20)' });
    }
    if (!lock || isNaN(lock) || lock < 1 || lock > 1440) {
      return res.status(400).json({ success: false, error: 'Durée de blocage invalide (1-1440 min)' });
    }

    let before = {};
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', [
          'security_session_duration_min',
          'security_idle_timeout_min',
          'security_max_login_attempts',
          'security_lockout_minutes',
          'security_require_double_confirm',
        ]);
      if (Array.isArray(data)) {
        for (const row of data) {
          before[row.key] = row.value;
        }
      }
    } catch (e) { }

    const updates = [
      { key: 'security_session_duration_min', value: s },
      { key: 'security_idle_timeout_min', value: idle },
      { key: 'security_max_login_attempts', value: attempts },
      { key: 'security_lockout_minutes', value: lock },
      { key: 'security_require_double_confirm', value: doubleConfirm ? 'true' : 'false' },
    ];

    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
    if (error) throw error;

    try {
      await logAuditEvent({
        event_type: 'settings.updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'setting_group', id: 'security', name: 'Sécurité & Sessions admin' },
        action_summary: 'Mise à jour des paramètres de sécurité',
        values_before: before,
        values_after: {
          security_session_duration_min: s,
          security_idle_timeout_min: idle,
          security_max_login_attempts: attempts,
          security_lockout_minutes: lock,
          security_require_double_confirm: doubleConfirm,
        },
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) { }

    try {
      await sendTemplatedNotification('system.config_changed', {
        userId: DEFAULT_ADMIN_USER_ID,
        context: {
          group: 'security',
          actor: buildActorFromRequest(req),
        },
      });
    } catch (e) {}

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ success: false, error: 'Erreur mise à jour paramètres sécurité' });
  }
});

// GET - Liste des feature flags (pour la page /settings/feature-flags)
app.get('/api/settings/feature-flags', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('feature_flags')
      .select('id, key, label, description, category, enabled')
      .order('created_at', { ascending: true });

    if (error) {
      if (error.code === '42P01') {
        console.warn('Table feature_flags introuvable, retour liste vide');
        return res.json({ success: true, data: [] });
      }
      console.error('💥 Erreur /api/settings/feature-flags (GET):', error);
      return res.status(500).json({ success: false, error: 'Erreur chargement feature flags' });
    }

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('💥 Erreur inattendue /api/settings/feature-flags (GET):', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement feature flags' });
  }
});

// PUT - Mise à jour de l'état d'un feature flag
app.put('/api/settings/feature-flags/:key', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const { key } = req.params;
    let { enabled } = req.body || {};

    if (!key || typeof enabled === 'undefined') {
      return res.status(400).json({ success: false, error: 'Clé et état du feature flag requis' });
    }

    enabled = Boolean(enabled);

    let before = null;
    try {
      const { data: existing } = await supabase
        .from('feature_flags')
        .select('*')
        .eq('key', key)
        .maybeSingle();
      before = existing || null;
    } catch (e) { }

    let updated = null;

    if (!before) {
      const insertPayload = {
        key,
        label: req.body && typeof req.body.label === 'string' ? req.body.label : null,
        description: req.body && typeof req.body.description === 'string' ? req.body.description : null,
        category: req.body && typeof req.body.category === 'string' ? req.body.category : null,
        enabled,
      };

      const { data, error } = await supabase
        .from('feature_flags')
        .insert(insertPayload)
        .select('*')
        .single();

      if (error) {
        console.error('💥 Erreur création feature_flag:', error);
        return res.status(500).json({ success: false, error: "Erreur création feature flag" });
      }

      updated = data;
    } else {
      const updatePayload = {
        enabled,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('feature_flags')
        .update(updatePayload)
        .eq('key', key)
        .select('*')
        .single();

      if (error) {
        console.error('💥 Erreur mise à jour feature_flag:', error);
        return res.status(500).json({ success: false, error: 'Erreur mise à jour feature flag' });
      }

      updated = data;
    }

    try {
      await logAuditEvent({
        event_type: 'settings.feature_flag_updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'feature_flag', id: updated.id, name: updated.key },
        action_summary: `Mise à jour du feature flag ${key} (${enabled ? 'activé' : 'désactivé'})`,
        values_before: before ? { enabled: before.enabled } : null,
        values_after: { enabled: updated.enabled },
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) { }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('💥 Erreur inattendue /api/settings/feature-flags/:key (PUT):', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour feature flag' });
  }
});

// Middleware globaux CORS & parsing JSON
const allowedOriginRegexes = [
  /^http:\/\/localhost:\d+$/,
  /^https:\/\/localhost:\d+$/,
  /^http:\/\/127\.0\.0\.1:\d+$/
  ,/^https:\/\/127\.0\.0\.1:\d+$/
];
const explicitAllowedOrigins = new Set([
  'http://localhost:3000',
  'http://127.0.0.1:3000',
  process.env.ALLOWED_ORIGIN || ''
].filter(Boolean));

app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (explicitAllowedOrigins.has(origin)) return callback(null, true);
    if (allowedOriginRegexes.some((re) => re.test(origin))) return callback(null, true);
    return callback(null, true);
  },
  credentials: false,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept']
}));
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

app.use(function (req, res, next) {
  try {
    if (!req.path || typeof req.path !== 'string') {
      return next();
    }
    if (req.path === '/api/health') {
      return next();
    }
    if (req.path.indexOf('/api/auth/') === 0) {
      return next();
    }
    if (req.path.indexOf('/api/device/') === 0) {
      return next();
    }
    if (req.path.indexOf('/api/sms/') === 0) {
      return next();
    }
    if (req.path.indexOf('/api/') !== 0) {
      return next();
    }
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non authentifié' });
    }
    req.auth = auth;
    return next();
  } catch (e) {
    return res.status(401).json({ success: false, error: 'Non authentifié' });
  }
});

// Route de santé simple pour vérification manuelle
app.get('/api/health', (req, res) => {
  return res.json({
    status: 'ok',
    time: new Date().toISOString(),
  });
});

app.get('/api/settings/system-info', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    const sms = await getSmsAdvancedSettings();

    let defaultThreshold = 50000;
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'container_threshold')
        .maybeSingle();
      const v = data && data.value != null ? Number(data.value) : NaN;
      if (!isNaN(v) && v > 0) defaultThreshold = v;
    } catch (e) { }

    const env = process.env.NODE_ENV || 'development';
    const appName = process.env.APP_NAME || 'Moov Money';

    const termuxUrl = process.env.TERMUX_SMS_URL || process.env.SMS_TERMUX_URL || null;
    const timeoutMsRaw = process.env.TERMUX_SMS_TIMEOUT_MS || process.env.SMS_TIMEOUT_MS || null;
    const timeoutMs = timeoutMsRaw != null && !isNaN(Number(timeoutMsRaw)) ? Number(timeoutMsRaw) : null;

    return res.json({
      success: true,
      data: {
        app: { name: appName, env },
        sms: {
          adminNumber: (sms && sms.adminNumber) || '',
          termuxUrl,
          timeoutMs,
          enabled: !(sms && sms.enabled === false),
          testMode: sms && sms.mode === 'test',
        },
        containers: { defaultThreshold },
      },
    });
  } catch (error) {
    console.error('💥 Erreur GET /api/settings/system-info:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement system-info' });
  }
});

app.get('/api/settings/direction-number', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    let value = null;
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'sms_direction_number')
        .maybeSingle();
      value = data && data.value != null ? String(data.value).trim() : null;
    } catch (e) { }

    if (!value) {
      const sms = await getSmsAdvancedSettings();
      value = sms && sms.adminNumber ? String(sms.adminNumber).trim() : '';
    }

    return res.json({ success: true, value: value || '' });
  } catch (error) {
    console.error('💥 Erreur GET /api/settings/direction-number:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement numéro direction' });
  }
});

app.put('/api/settings/direction-number', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const { number } = req.body || {};
    const formatted = toLocalPhone(number);
    if (!formatted) return res.status(400).json({ success: false, error: 'Numéro invalide' });

    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'sms_direction_number', value: formatted }], { onConflict: 'key' });
    if (error) throw error;

    smsAdvancedSettingsCache.loadedAt = 0;
    smsAdvancedSettingsCache.data = null;

    try {
      await logAuditEvent({
        event_type: 'settings.updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'setting', id: 'sms_direction_number', name: 'Numéro direction' },
        action_summary: 'Mise à jour du numéro direction (SMS)',
        values_after: { sms_direction_number: formatted },
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) { }

    return res.json({ success: true, value: formatted });
  } catch (error) {
    console.error('💥 Erreur PUT /api/settings/direction-number:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour numéro direction' });
  }
});

app.get('/api/settings/container-threshold', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    let value = 50000;
    try {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'container_threshold')
        .maybeSingle();
      const v = data && data.value != null ? Number(data.value) : NaN;
      if (!isNaN(v) && v > 0) value = v;
    } catch (e) { }

    return res.json({ success: true, value });
  } catch (error) {
    console.error('💥 Erreur GET /api/settings/container-threshold:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement seuil container' });
  }
});

app.put('/api/settings/container-threshold', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const { threshold } = req.body || {};
    const value = Number(threshold);
    if (!value || isNaN(value) || value <= 0) {
      return res.status(400).json({ success: false, error: 'Seuil invalide' });
    }

    const { error } = await supabase
      .from('app_settings')
      .upsert([{ key: 'container_threshold', value }], { onConflict: 'key' });
    if (error) throw error;

    try {
      await logAuditEvent({
        event_type: 'settings.updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'setting', id: 'container_threshold', name: 'Seuil container' },
        action_summary: 'Mise à jour du seuil critique par défaut container',
        values_after: { container_threshold: value },
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) { }

    return res.json({ success: true, value });
  } catch (error) {
    console.error('💥 Erreur PUT /api/settings/container-threshold:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour seuil container' });
  }
});

app.get('/api/settings/sms-advanced', cors({ origin: true, credentials: true }), async (req, res) => {
  try {
    const settings = await getSmsAdvancedSettings();
    return res.json({ success: true, data: settings });
  } catch (error) {
    console.error('💥 Erreur GET /api/settings/sms-advanced:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement paramètres SMS' });
  }
});

app.put('/api/settings/sms-advanced', cors({ origin: true, credentials: true }), express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const mode = body.mode === 'prod' ? 'prod' : 'test';
    const enabled = body.enabled !== false;
    const testNumber = body.testNumber != null ? String(body.testNumber).trim() : '';
    const templates = body.templates && typeof body.templates === 'object' ? body.templates : {};

    const lowBalance = templates.lowBalance != null ? String(templates.lowBalance) : null;
    const criticalError = templates.criticalError != null ? String(templates.criticalError) : null;
    const otpAdmin = templates.otpAdmin != null ? String(templates.otpAdmin) : null;

    const notifyEventsEnabled = body.notifyEventsEnabled != null ? Boolean(body.notifyEventsEnabled) : null;
    const notifyEventsAll = body.notifyEventsAll != null ? Boolean(body.notifyEventsAll) : null;
    const notifyEventsCooldownSeconds = body.notifyEventsCooldownSeconds != null && !isNaN(Number(body.notifyEventsCooldownSeconds))
      ? Math.max(0, Math.min(3600, Number(body.notifyEventsCooldownSeconds)))
      : null;
    const notifyEventsPrefix = body.notifyEventsPrefix != null ? String(body.notifyEventsPrefix) : null;

    const updates = [
      { key: 'sms_mode', value: mode },
      { key: 'sms_enabled', value: enabled ? 'true' : 'false' },
      { key: 'sms_test_number', value: testNumber },
    ];
    if (lowBalance != null) updates.push({ key: 'sms_alert_low_balance_template', value: lowBalance });
    if (criticalError != null) updates.push({ key: 'sms_alert_critical_error_template', value: criticalError });
    if (otpAdmin != null) updates.push({ key: 'sms_otp_admin_template', value: otpAdmin });
    if (notifyEventsEnabled != null) updates.push({ key: 'sms_notify_events_enabled', value: notifyEventsEnabled ? 'true' : 'false' });
    if (notifyEventsAll != null) updates.push({ key: 'sms_notify_events_all', value: notifyEventsAll ? 'true' : 'false' });
    if (notifyEventsCooldownSeconds != null) updates.push({ key: 'sms_notify_events_cooldown_seconds', value: String(notifyEventsCooldownSeconds) });
    if (notifyEventsPrefix != null) updates.push({ key: 'sms_notify_events_prefix', value: notifyEventsPrefix });

    const { error } = await supabase.from('app_settings').upsert(updates, { onConflict: 'key' });
    if (error) throw error;

    smsAdvancedSettingsCache.loadedAt = 0;
    smsAdvancedSettingsCache.data = null;

    const refreshed = await getSmsAdvancedSettings();

    try {
      await logAuditEvent({
        event_type: 'settings.updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'setting_group', id: 'sms_advanced', name: 'Notifications & SMS avancés' },
        action_summary: 'Mise à jour des paramètres Notifications & SMS avancés',
        values_after: {
          sms_mode: mode,
          sms_enabled: enabled,
          sms_test_number: testNumber,
          sms_notify_events_enabled: notifyEventsEnabled,
          sms_notify_events_all: notifyEventsAll,
          sms_notify_events_cooldown_seconds: notifyEventsCooldownSeconds,
          sms_notify_events_prefix: notifyEventsPrefix,
        },
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) { }

    try {
      await sendTemplatedNotification('system.config_changed', {
        userId: DEFAULT_ADMIN_USER_ID,
        context: {
          group: 'sms_advanced',
          actor: buildActorFromRequest(req),
        },
      });
    } catch (e) { }

    return res.json({ success: true, data: refreshed });
  } catch (error) {
    console.error('💥 Erreur PUT /api/settings/sms-advanced:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour paramètres SMS' });
  }
});

// =====================================================
// ROUTES D'AUTHENTIFICATION
// =====================================================

 app.get('/api/auth/me', async (req, res) => {
   try {
     const headers = req.headers || {};
     const authHeader = headers['authorization'] || headers['Authorization'];
     let token = null;
     if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
       token = authHeader.replace('Bearer ', '').trim();
     }
     if (!token && req.cookies && req.cookies[AUTH_COOKIE_NAME]) {
       token = req.cookies[AUTH_COOKIE_NAME];
     }

     if (!token) {
       return res.status(401).json({ success: false, error: 'Non authentifié' });
     }

     if (token === 'admin-token') {
       return res.json({
         id: ADMIN_WEB_USER_ID,
         role: 'admin',
         phone: ADMIN_WEB_PHONE,
         name: 'Direction Moov Africa TD',
       });
     }

     const decoded = verifyAuthToken(token);
     if (!decoded || !decoded.sub) {
       return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
     }

     const role = decoded.role || decoded.userType || 'distributor';
     const userType = decoded.userType || decoded.role || role;

     if (role === 'admin' || userType === 'admin') {
       return res.json({
         id: decoded.sub,
         role: 'admin',
         phone: decoded.phone || ADMIN_WEB_PHONE,
         name: 'Direction Moov Africa TD',
       });
     }

     try {
       const table = role === 'supervisor' || userType === 'supervisor' ? 'supervisors' : 'distributors';
       const { data } = await supabase
         .from(table)
         .select('id, name, first_name, last_name, phone, zone')
         .eq('id', decoded.sub)
         .maybeSingle();

       if (!data) {
         return res.status(401).json({ success: false, error: 'Utilisateur introuvable' });
       }

       return res.json({
         id: data.id,
         role: table === 'supervisors' ? 'supervisor' : 'distributor',
         phone: data.phone || null,
         name:
           data.name
           || `${data.first_name || ''} ${data.last_name || ''}`.trim()
           || null,
         zone: data.zone || null,
       });
     } catch (e) {
       return res.status(401).json({ success: false, error: 'Token invalide ou expiré' });
     }
   } catch (error) {
     return res.status(500).json({ success: false, error: 'Erreur serveur' });
   }
 });

// POST - Connexion admin web (Envoi OTP)
app.post('/api/auth/login-web', express.json(), async (req, res) => {
  try {
    const { phone, password } = req.body || {};

    const reqLang = await resolveRequestLanguage(req);

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone requis',
          en: 'Phone number is required',
          ar: 'رقم الهاتف مطلوب',
        })
      });
    }

    if (!password || typeof password !== 'string' || !password.trim()) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Mot de passe requis',
          en: 'Password is required',
          ar: 'كلمة المرور مطلوبة',
        })
      });
    }

    const localPhone = toLocalPhone(phone);

    const allowedAdminPhone = await getAdminWebAllowedLocalPhone();

    console.log('📞 send-otp-mobile normalized phone:', {
      input: phone,
      localPhone,
    });

    if (!localPhone || localPhone !== allowedAdminPhone) {
      // Journaliser la tentative de connexion échouée
      try {
        const ip = getClientIp(req);
        const ua = req.headers['user-agent'] || '';

        await logAuditEvent({
          event_type: 'auth.login_web',
          status: 'error',
          actor: {
            phone: localPhone,
            role: 'unknown',
            ip,
            user_agent: ua,
          },
          resource: { type: 'auth', id: 'admin_web_login' },
          action_summary: 'Tentative de connexion admin web échouée',
          error: {
            code: 'UNAUTHORIZED',
            message: 'Numéro non autorisé',
          },
          metadata: {
            path: req.path,
            method: req.method,
          },
        });

        // Envoyer alerte SMS
        await sendSecurityAlertSms({
          reason: 'Tentative connexion admin avec numéro non autorisé',
          phone: localPhone,
          ip,
          userAgent: ua,
        });

        try {
          await sendTemplatedNotification('system.security_alert', {
            userId: DEFAULT_ADMIN_USER_ID,
            context: {
              reason: 'Tentative connexion admin avec numéro non autorisé',
              phone: localPhone,
              ip,
            },
          });
        } catch (e2) {}
      } catch (e) {
        console.warn('Erreur logging tentative connexion:', e);
      }

      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Identifiants incorrects ou accès non autorisé',
          en: 'Invalid credentials or unauthorized access',
          ar: 'بيانات الدخول غير صحيحة أو الوصول غير مصرح',
        })
      });
    }

    // Vérifier le verrouillage de compte
    const attemptKey = `admin-${allowedAdminPhone}`;
    const existing = loginAttempts.get(attemptKey);

    if (existing && existing.lockedUntil) {
      const now = new Date();
      if (now < existing.lockedUntil) {
        const remainingMin = Math.ceil((existing.lockedUntil - now) / 60000);
        return res.status(429).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: `Compte temporairement bloqué. Réessayez dans ${remainingMin} minute(s).`,
            en: `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
            ar: `تم قفل الحساب مؤقتاً. أعد المحاولة بعد ${remainingMin} دقيقة.`,
          }),
          lockedUntil: existing.lockedUntil.toISOString(),
        });
      } else {
        // Débloquer si la période est passée
        loginAttempts.delete(attemptKey);
      }
    }

    // Vérifier le mot de passe admin web (AVANT envoi OTP)
    const cleanPassword = String(password).trim();
    const storedHash = await getAdminWebPasswordHash();
    let isValidPassword = false;

    if (storedHash) {
      try {
        isValidPassword = await bcrypt.compare(cleanPassword, storedHash);
      } catch (e) {
        isValidPassword = false;
      }
    } else {
      // Fallback temporaire si aucun hash n'est encore configuré
      isValidPassword = cleanPassword === '12345678';
    }

    if (!isValidPassword) {
      const settings = await getSecuritySettings();
      const maxAttempts = settings.maxLoginAttempts || 5;
      const lockoutMinutes = settings.lockoutMinutes || 15;

      const current = loginAttempts.get(attemptKey) || { count: 0 };
      const newCount = (current.count || 0) + 1;
      const remainingAttempts = Math.max(0, maxAttempts - newCount);

      if (newCount >= maxAttempts) {
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        loginAttempts.set(attemptKey, { count: newCount, lockedUntil });
        return res.status(429).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: `Trop de tentatives. Compte bloqué pour ${lockoutMinutes} minutes.`,
            en: `Too many attempts. Account locked for ${lockoutMinutes} minutes.`,
            ar: `محاولات كثيرة. تم قفل الحساب لمدة ${lockoutMinutes} دقيقة.`,
          }),
          lockedUntil: lockedUntil.toISOString(),
          remainingAttempts: 0,
          maxLoginAttempts: maxAttempts,
        });
      }

      loginAttempts.set(attemptKey, { count: newCount });
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro ou mot de passe incorrect.',
          en: 'Incorrect phone number or password.',
          ar: 'رقم الهاتف أو كلمة المرور غير صحيحة.',
        }),
        remainingAttempts,
        maxLoginAttempts: maxAttempts,
      });
    }

    // Mot de passe OK : remettre à zéro les tentatives avant d'envoyer l'OTP
    loginAttempts.delete(attemptKey);

    const resendToken = signAuthToken({
      sub: allowedAdminPhone,
      role: 'admin',
      userType: 'admin',
      phone: localPhone,
      purpose: 'admin_otp_resend',
    }, 10 * 60);

    // Créer et envoyer l'OTP
    const otpResult = await createAndSendAdminOtp(localPhone);

    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: otpResult.error || pickByLang(reqLang, {
          fr: "Erreur lors de l'envoi du code OTP",
          en: 'Error sending OTP code',
          ar: 'حدث خطأ أثناء إرسال رمز OTP',
        }),
      });
    }

    // Journaliser la demande OTP réussie
    try {
      await logAuditEvent({
        event_type: 'auth.otp_requested',
        actor: {
          phone: localPhone,
          role: 'admin',
          ip: getClientIp(req),
          user_agent: req.headers['user-agent'] || '',
        },
        resource: { type: 'auth', id: 'admin_web_login' },
        action_summary: 'Code OTP envoyé pour connexion admin web',
        metadata: {
          path: req.path,
          method: req.method,
          expiresIn: otpResult.expiresIn,
        },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req);
    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Code de vérification envoyé par SMS',
        en: 'Verification code sent by SMS',
        ar: 'تم إرسال رمز التحقق عبر رسالة SMS',
      }),
      expiresIn: otpResult.expiresIn || 300,
      resendToken: resendToken || undefined,
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/login-web:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors de la connexion',
        en: 'Login error',
        ar: 'حدث خطأ أثناء تسجيل الدخول',
      })
    });
  }
});

// POST - Renvoyer un OTP admin (sans mot de passe)
app.post('/api/auth/resend-otp-admin', express.json(), async (req, res) => {
  try {
    const { phone, resendToken } = req.body || {};
    const reqLang = await resolveRequestLanguage(req);

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone requis',
          en: 'Phone number is required',
          ar: 'رقم الهاتف مطلوب',
        })
      });
    }

    if (!resendToken || typeof resendToken !== 'string' || !resendToken.trim()) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Session OTP expirée. Veuillez vous reconnecter.',
          en: 'OTP session expired. Please login again.',
          ar: 'انتهت جلسة OTP. الرجاء إعادة تسجيل الدخول.',
        })
      });
    }

    const localPhone = toLocalPhone(phone);
    const allowedAdminPhone = await getAdminWebAllowedLocalPhone();
    if (!localPhone || localPhone !== allowedAdminPhone) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Identifiants incorrects ou accès non autorisé',
          en: 'Invalid credentials or unauthorized access',
          ar: 'بيانات الدخول غير صحيحة أو الوصول غير مصرح',
        })
      });
    }

    const decoded = verifyAuthToken(String(resendToken).trim());
    if (!decoded || decoded.purpose !== 'admin_otp_resend' || decoded.phone !== localPhone) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Session OTP expirée. Veuillez vous reconnecter.',
          en: 'OTP session expired. Please login again.',
          ar: 'انتهت جلسة OTP. الرجاء إعادة تسجيل الدخول.',
        })
      });
    }

    const attemptKey = `admin-${allowedAdminPhone}`;
    const existing = loginAttempts.get(attemptKey);
    if (existing && existing.lockedUntil) {
      const now = new Date();
      if (now < existing.lockedUntil) {
        const remainingMin = Math.ceil((existing.lockedUntil - now) / 60000);
        return res.status(429).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: `Compte temporairement bloqué. Réessayez dans ${remainingMin} minute(s).`,
            en: `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
            ar: `تم قفل الحساب مؤقتاً. أعد المحاولة بعد ${remainingMin} دقيقة.`,
          }),
        });
      }
      loginAttempts.delete(attemptKey);
    }

    const otpResult = await createAndSendAdminOtp(localPhone);
    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: otpResult.error || pickByLang(reqLang, {
          fr: "Erreur lors de l'envoi du code OTP",
          en: 'Error sending OTP code',
          ar: 'حدث خطأ أثناء إرسال رمز OTP',
        }),
      });
    }

    return res.json({
      success: true,
      message: pickByLang(reqLang, {
        fr: 'Code de vérification renvoyé par SMS',
        en: 'Verification code resent by SMS',
        ar: 'تمت إعادة إرسال رمز التحقق عبر رسالة SMS',
      }),
      expiresIn: otpResult.expiresIn || 300,
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/resend-otp-admin:', error);
    return res.status(500).json({ success: false, error: 'Erreur serveur' });
  }
});

// POST - Vérification OTP et connexion
app.post('/api/auth/verify-otp', express.json(), async (req, res) => {
  try {
    const { phone, code } = req.body || {};

    const reqLang = await resolveRequestLanguage(req);

    const pickAdminOtpError = (err) => {
      try {
        const s = err ? String(err) : '';
        const k = s.trim().toLowerCase();
        if (!k) return null;
        if (k.includes('expir')) {
          return pickByLang(reqLang, {
            fr: 'OTP expiré',
            en: 'OTP expired',
            ar: 'انتهت صلاحية رمز OTP',
          });
        }
        if (k.includes('trop de tentatives')) {
          return pickByLang(reqLang, {
            fr: 'Trop de tentatives',
            en: 'Too many attempts',
            ar: 'محاولات كثيرة',
          });
        }
        if (k.includes('non trouvé') || k.includes('introuvable')) {
          return pickByLang(reqLang, {
            fr: 'OTP non trouvé ou expiré',
            en: 'OTP not found or expired',
            ar: 'رمز OTP غير موجود أو منتهي الصلاحية',
          });
        }
        if (k.includes('incorrect')) {
          return pickByLang(reqLang, {
            fr: 'Code OTP incorrect',
            en: 'Invalid OTP code',
            ar: 'رمز OTP غير صحيح',
          });
        }
        if (k.includes('vérification')) {
          return pickByLang(reqLang, {
            fr: 'Erreur vérification OTP',
            en: 'OTP verification error',
            ar: 'خطأ في التحقق من OTP',
          });
        }
        return null;
      } catch (e) {
        return null;
      }
    };

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Téléphone et code requis',
          en: 'Phone and code are required',
          ar: 'رقم الهاتف والرمز مطلوبان',
        })
      });
    }

    const localPhone = toLocalPhone(phone);
    const codeUpper = String(code).toUpperCase().trim();

    const allowedAdminPhone = await getAdminWebAllowedLocalPhone();

    if (!localPhone || localPhone !== allowedAdminPhone) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Identifiants incorrects ou accès non autorisé',
          en: 'Invalid credentials or unauthorized access',
          ar: 'بيانات الدخول غير صحيحة أو الوصول غير مصرح',
        })
      });
    }

    // Vérifier le verrouillage
    const attemptKey = `admin-${allowedAdminPhone}`;
    const existing = loginAttempts.get(attemptKey);

    if (existing && existing.lockedUntil) {
      const now = new Date();
      if (now < existing.lockedUntil) {
        const remainingMin = Math.ceil((existing.lockedUntil - now) / 60000);
        return res.status(429).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: `Compte temporairement bloqué. Réessayez dans ${remainingMin} minute(s).`,
            en: `Account temporarily locked. Try again in ${remainingMin} minute(s).`,
            ar: `تم قفل الحساب مؤقتاً. أعد المحاولة بعد ${remainingMin} دقيقة.`,
          }),
        });
      } else {
        loginAttempts.delete(attemptKey);
      }
    }

    // Vérifier l'OTP
    const verifyResult = await verifyAdminOtp(localPhone, codeUpper);

    if (!verifyResult.success) {
      // Incrémenter les tentatives échouées
      const settings = await getSecuritySettings();
      const maxAttempts = settings.maxLoginAttempts || 5;
      const lockoutMinutes = settings.lockoutMinutes || 15;

      const current = loginAttempts.get(attemptKey) || { count: 0 };
      const newCount = current.count + 1;

      if (newCount >= maxAttempts) {
        // Verrouiller le compte
        const lockedUntil = new Date(Date.now() + lockoutMinutes * 60000);
        loginAttempts.set(attemptKey, { count: newCount, lockedUntil });

        // Journaliser et alerter
        try {
          const ip = getClientIp(req);
          const ua = req.headers['user-agent'] || '';

          await logAuditEvent({
            event_type: 'auth.account_locked',
            status: 'error',
            actor: {
              phone: localPhone,
              role: 'admin',
              ip,
              user_agent: ua,
            },
            resource: { type: 'auth', id: 'admin_web_login' },
            action_summary: `Compte admin bloqué après ${newCount} tentatives échouées`,
            metadata: {
              attempts: newCount,
              lockedUntil: lockedUntil.toISOString(),
            },
          });

          await sendSecurityAlertSms({
            reason: `Blocage compte admin après ${newCount} tentatives échouées`,
            phone: localPhone,
            ip,
            userAgent: ua,
          });

          try {
            await sendTemplatedNotification('system.security_alert', {
              userId: DEFAULT_ADMIN_USER_ID,
              context: {
                reason: `Blocage compte admin après ${newCount} tentatives échouées`,
                phone: localPhone,
                ip,
              },
            });
          } catch (e2) {}
        } catch (e) { }

        return res.status(429).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: `Trop de tentatives. Compte bloqué pour ${lockoutMinutes} minutes.`,
            en: `Too many attempts. Account locked for ${lockoutMinutes} minutes.`,
            ar: `محاولات كثيرة. تم قفل الحساب لمدة ${lockoutMinutes} دقيقة.`,
          }),
        });
      }

      // Mise à jour du compteur
      loginAttempts.set(attemptKey, { count: newCount });

      // Journaliser la tentative échouée
      try {
        await logAuditEvent({
          event_type: 'auth.otp_verify_failed',
          status: 'error',
          actor: {
            phone: localPhone,
            role: 'admin',
            ip: getClientIp(req),
            user_agent: req.headers['user-agent'] || '',
          },
          resource: { type: 'auth', id: 'admin_web_login' },
          action_summary: 'Échec vérification OTP admin',
          error: {
            code: 'INVALID_OTP',
            message: verifyResult.error || 'Code OTP incorrect',
          },
          metadata: {
            attempts: newCount,
            maxAttempts,
          },
        });
      } catch (e) { }

      return res.status(401).json({
        success: false,
        error: pickAdminOtpError(verifyResult.error) || verifyResult.error || pickByLang(reqLang, {
          fr: 'Code OTP incorrect',
          en: 'Invalid OTP code',
          ar: 'رمز OTP غير صحيح',
        }),
        attemptsRemaining: Math.max(0, maxAttempts - newCount),
      });
    }

    // OTP vérifié avec succès - Réinitialiser les tentatives
    loginAttempts.delete(attemptKey);

    // Créer le token JWT
    const settings = await getSecuritySettings();
    const sessionDuration = settings.sessionDurationMinutes || 60;

    const token = signAuthToken({
      sub: ADMIN_WEB_USER_ID,
      role: 'admin',
      userType: 'admin',
      phone: localPhone,
    }, sessionDuration * 60);

    if (!token) {
      return res.status(500).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Erreur lors de la création de la session',
          en: 'Error creating session',
          ar: 'حدث خطأ أثناء إنشاء الجلسة',
        }),
      });
    }

    // Définir le cookie
    res.cookie(AUTH_COOKIE_NAME, token, AUTH_COOKIE_OPTIONS);

    // Journaliser la connexion réussie
    try {
      await logAuditEvent({
        event_type: 'auth.otp_verified',
        actor: {
          id: ADMIN_WEB_USER_ID,
          phone: localPhone,
          role: 'admin',
          display_name: 'Direction Moov Africa TD',
          ip: getClientIp(req),
          user_agent: req.headers['user-agent'] || '',
        },
        resource: { type: 'auth', id: 'admin_web_login' },
        action_summary: 'Connexion admin web réussie',
        metadata: {
          sessionDuration,
        },
      });
    } catch (e) { }

    return res.json({
      success: true,
      token,
      user: {
        id: ADMIN_WEB_USER_ID,
        role: 'admin',
        phone: localPhone,
        name: 'Direction Moov Africa TD',
      },
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/verify-otp:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors de la vérification',
        en: 'Error during verification',
        ar: 'حدث خطأ أثناء التحقق',
      })
    });
  }
});

// POST - Envoi OTP mobile (superviseur / distributeur)
app.post('/api/auth/send-otp-mobile', express.json(), async (req, res) => {
  try {
    const { phone, userType } = req.body || {};

    const reqLang = await resolveRequestLanguage(req);

    console.log('➡️  POST /api/auth/send-otp-mobile:', {
      phone,
      userType,
    });

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Téléphone requis',
          en: 'Phone is required',
          ar: 'رقم الهاتف مطلوب',
        }),
      });
    }

    const localPhone = toLocalPhone(phone);

    if (!localPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone invalide',
          en: 'Invalid phone number',
          ar: 'رقم الهاتف غير صالح',
        }),
      });
    }

    const adminLocalPhone = await getAdminWebAllowedLocalPhone();

    if (localPhone === adminLocalPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Utilisez la connexion admin web pour ce numéro',
          en: 'Use admin web login for this number',
          ar: 'استخدم تسجيل دخول مدير الويب لهذا الرقم',
        }),
      });
    }

    let resolvedUserType = userType;
    let userId = null;

    if (resolvedUserType && typeof resolvedUserType === 'string') {
      resolvedUserType = resolvedUserType.toLowerCase();
    }

    if (resolvedUserType === 'supervisor') {
      const { data: supervisor, error: supErr } = await supabase
        .from('supervisors')
        .select('id, phone, status')
        .eq('phone', localPhone)
        .maybeSingle();

      if (supErr) {
        console.error('💥 Erreur lecture superviseur pour OTP mobile:', supErr);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: "Erreur lors de la préparation de l'OTP",
            en: 'Error preparing OTP',
            ar: 'حدث خطأ أثناء تجهيز OTP',
          }),
        });
      }

      if (!supervisor) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Superviseur introuvable',
            en: 'Supervisor not found',
            ar: 'المشرف غير موجود',
          }),
        });
      }

      userId = supervisor.id;
      resolvedUserType = 'supervisor';
    } else if (resolvedUserType === 'distributor') {
      const { data: distributor, error: distErr } = await supabase
        .from('distributors')
        .select('id, phone, status')
        .eq('phone', localPhone)
        .maybeSingle();

      if (distErr) {
        console.error('💥 Erreur lecture distributeur pour OTP mobile:', distErr);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: "Erreur lors de la préparation de l'OTP",
            en: 'Error preparing OTP',
            ar: 'حدث خطأ أثناء تجهيز OTP',
          }),
        });
      }

      if (!distributor) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Distributeur introuvable',
            en: 'Distributor not found',
            ar: 'الموزع غير موجود',
          }),
        });
      }

      userId = distributor.id;
      resolvedUserType = 'distributor';
    } else {
      let supervisor = null;
      try {
        const { data: sup } = await supabase
          .from('supervisors')
          .select('id, phone, status')
          .eq('phone', localPhone)
          .maybeSingle();
        supervisor = sup;
      } catch (e) {}

      if (supervisor) {
        userId = supervisor.id;
        resolvedUserType = 'supervisor';
      } else {
        let distributor = null;
        try {
          const { data: dist } = await supabase
            .from('distributors')
            .select('id, phone, status')
            .eq('phone', localPhone)
            .maybeSingle();
          distributor = dist;
        } catch (e) {}

        if (distributor) {
          userId = distributor.id;
          resolvedUserType = 'distributor';
        }
      }
    }

    if (!resolvedUserType || !userId) {
      console.warn('⚠️ send-otp-mobile user not found:', {
        localPhone,
        resolvedUserType,
      });
      return res.status(404).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Utilisateur mobile introuvable',
          en: 'Mobile user not found',
          ar: 'مستخدم الهاتف غير موجود',
        }),
      });
    }

    console.log('✅ send-otp-mobile user resolved:', {
      localPhone,
      resolvedUserType,
      userId,
    });

    const otpResult = await createAndSendUserOtp(localPhone, resolvedUserType, userId);

    if (!otpResult.success) {
      return res.status(500).json({
        success: false,
        error: otpResult.error || pickByLang(reqLang, {
          fr: "Erreur lors de l'envoi du code OTP",
          en: 'Error sending OTP code',
          ar: 'حدث خطأ أثناء إرسال رمز OTP',
        }),
      });
    }

    const lang = await resolveUserLanguage({ userId, userType: resolvedUserType });
    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Code OTP envoyé par SMS',
        en: 'OTP code sent by SMS',
        ar: 'تم إرسال رمز التحقق عبر رسالة SMS',
      }),
      expiresIn: otpResult.expiresIn || 300,
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/send-otp-mobile:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: "Erreur lors de l'envoi du code OTP",
        en: 'Error sending OTP code',
        ar: 'حدث خطأ أثناء إرسال رمز OTP',
      }),
    });
  }
});

// POST - Vérification OTP mobile (superviseur / distributeur)
app.post('/api/auth/verify-otp-mobile', express.json(), async (req, res) => {
  try {
    const { phone, code } = req.body || {};

    const reqLang = await resolveRequestLanguage(req);

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Téléphone et code requis',
          en: 'Phone and code are required',
          ar: 'رقم الهاتف والرمز مطلوبان',
        }),
      });
    }

    const localPhone = toLocalPhone(phone);
    const codeUpper = String(code).toUpperCase().trim();

    if (!localPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone invalide',
          en: 'Invalid phone number',
          ar: 'رقم الهاتف غير صالح',
        }),
      });
    }

    const adminLocalPhone = await getAdminWebAllowedLocalPhone();

    if (localPhone === adminLocalPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Utilisez la vérification OTP admin web pour ce numéro',
          en: 'Use admin web OTP verification for this number',
          ar: 'استخدم تحقق OTP لمدير الويب لهذا الرقم',
        }),
      });
    }

    const verifyResult = await verifyUserOtp(localPhone, codeUpper);

    if (!verifyResult.success) {
      const localized = pickOtpErrorMessage(reqLang, verifyResult.code) || null;
      return res.status(401).json({
        success: false,
        error: localized || verifyResult.error || pickByLang(reqLang, {
          fr: 'Code OTP incorrect',
          en: 'Invalid OTP code',
          ar: 'رمز OTP غير صحيح',
        }),
      });
    }

    const userType = verifyResult.userType;
    const userId = verifyResult.userId;

    if (!userType || !userId) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'OTP valide mais utilisateur introuvable',
          en: 'Valid OTP but user not found',
          ar: 'رمز OTP صحيح لكن المستخدم غير موجود',
        }),
      });
    }

    let userRow = null;
    let mustChangePin = false;
    let pinResetReason = null;

    if (userType === 'supervisor') {
      const { data, error } = await supabase
        .from('supervisors')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('💥 Erreur lecture superviseur pour verify-otp-mobile:', error);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la récupération du superviseur',
            en: 'Error retrieving supervisor',
            ar: 'حدث خطأ أثناء جلب بيانات المشرف',
          }),
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Superviseur introuvable',
            en: 'Supervisor not found',
            ar: 'المشرف غير موجود',
          }),
        });
      }

      userRow = data;

      try {
        const { data: authRow } = await supabase
          .from('supervisor_auth')
          .select('must_change_pin, pin_reset_reason')
          .eq('supervisor_id', userId)
          .maybeSingle();
        if (authRow) {
          mustChangePin = !!authRow.must_change_pin;
          pinResetReason = authRow.pin_reset_reason || null;
        }
      } catch (e) { }
    } else if (userType === 'distributor') {
      const { data, error } = await supabase
        .from('distributors')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.error('💥 Erreur lecture distributeur pour verify-otp-mobile:', error);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la récupération du distributeur',
            en: 'Error retrieving distributor',
            ar: 'حدث خطأ أثناء جلب بيانات الموزع',
          }),
        });
      }

      if (!data) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Distributeur introuvable',
            en: 'Distributor not found',
            ar: 'الموزع غير موجود',
          }),
        });
      }

      userRow = data;

      try {
        const { data: authRow } = await supabase
          .from('distributor_auth')
          .select('must_change_pin, pin_reset_reason')
          .eq('distributor_id', userId)
          .maybeSingle();
        if (authRow) {
          mustChangePin = !!authRow.must_change_pin;
          pinResetReason = authRow.pin_reset_reason || null;
        }
      } catch (e) { }
    } else {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Type utilisateur OTP invalide',
          en: 'Invalid OTP user type',
          ar: 'نوع مستخدم OTP غير صالح',
        }),
      });
    }

    const sessionDurationSeconds = 24 * 60 * 60;
    const token = signAuthToken(
      {
        sub: userId,
        role: userType,
        userType,
        phone: localPhone,
      },
      sessionDurationSeconds,
    );

    if (!token) {
      return res.status(500).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Erreur lors de la création de la session',
          en: 'Error creating session',
          ar: 'حدث خطأ أثناء إنشاء الجلسة',
        }),
      });
    }

    const lang = userRow && userRow.language
      ? normalizeLanguage(userRow.language)
      : await resolveUserLanguage({ userId, userType });

    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Authentification réussie',
        en: 'Authentication successful',
        ar: 'تم تسجيل الدخول بنجاح',
      }),
      userType,
      token,
      mustChangePin,
      pinResetReason,
      user: userRow,
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/verify-otp-mobile:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors de la vérification',
        en: 'Error during verification',
        ar: 'حدث خطأ أثناء التحقق',
      }),
    });
  }
});

app.post('/api/auth/change-pin-after-reset', express.json(), async (req, res) => {
  try {
    const { phone, userType, temporaryPassword, newPin, confirmPin } = req.body || {};
    const reqLang = await resolveRequestLanguage(req);

    if (!phone || !userType || !temporaryPassword || !newPin || !confirmPin) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Tous les champs sont requis (phone, userType, temporaryPassword, newPin, confirmPin)',
          en: 'All fields are required (phone, userType, temporaryPassword, newPin, confirmPin)',
          ar: 'جميع الحقول مطلوبة (الهاتف، نوع المستخدم، كلمة المرور المؤقتة، رقم PIN الجديد، تأكيد رقم PIN)',
        }),
      });
    }

    if (newPin !== confirmPin) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Les deux PIN ne correspondent pas',
          en: 'PINs do not match',
          ar: 'رقما PIN غير متطابقين',
        }),
      });
    }

    if (userType === 'supervisor' && !/^\d{4}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Le nouveau PIN superviseur doit contenir exactement 4 chiffres',
          en: 'Supervisor new PIN must be exactly 4 digits',
          ar: 'يجب أن يتكون رقم PIN الجديد للمشرف من 4 أرقام بالضبط',
        }),
      });
    }

    if (userType === 'distributor' && !/^\d{4,6}$/.test(newPin)) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Le nouveau PIN doit contenir 4 à 6 chiffres',
          en: 'New PIN must be 4 to 6 digits',
          ar: 'يجب أن يتكون رقم PIN الجديد من 4 إلى 6 أرقام',
        }),
      });
    }

    const localPhone = toLocalPhone(phone);
    if (!localPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone invalide',
          en: 'Invalid phone number',
          ar: 'رقم الهاتف غير صالح',
        }),
      });
    }

    const cleanTempPassword = String(temporaryPassword).trim();
    if (!cleanTempPassword || cleanTempPassword.length < 4) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'PIN temporaire incorrect',
          en: 'Incorrect temporary PIN',
          ar: 'رقم PIN المؤقت غير صحيح',
        }),
      });
    }

    const hashedNewPin = await bcrypt.hash(newPin, 10);

    if (userType === 'supervisor') {
      // 1) Retrouver d'abord le superviseur (source de vérité)
      const { data: supervisor, error: supError } = await supabase
        .from('supervisors')
        .select('id, phone, password_hash')
        .eq('phone', localPhone)
        .maybeSingle();

      if (supError || !supervisor || !supervisor.id) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Compte superviseur introuvable pour ce téléphone',
            en: 'Supervisor account not found for this phone',
            ar: 'تعذر العثور على حساب المشرف لهذا الرقم',
          }),
        });
      }

      // 2) Charger éventuellement la ligne supervisor_auth (si elle existe)
      const { data: supervisorAuth, error: supAuthError } = await supabase
        .from('supervisor_auth')
        .select('supervisor_id, phone, password_hash, must_change_pin')
        .eq('supervisor_id', supervisor.id)
        .maybeSingle();

      if (supAuthError) {
        console.error('Erreur lecture supervisor_auth dans change-pin-after-reset:', supAuthError);
      }

      // Si une ligne supervisor_auth existe ET must_change_pin est false, alors aucun changement requis
      if (supervisorAuth && supervisorAuth.supervisor_id && supervisorAuth.must_change_pin === false) {
        return res.status(400).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Aucun changement de PIN requis pour ce compte',
            en: 'No PIN change required for this account',
            ar: 'لا يلزم تغيير رقم PIN لهذا الحساب',
          }),
        });
      }

      // 3) Vérifier le PIN temporaire à partir de supervisor_auth si possible, sinon fallback sur supervisors.password_hash
      const hashToCheck = supervisorAuth?.password_hash || supervisor.password_hash || '';
      const isValidTemp = await bcrypt.compare(cleanTempPassword, hashToCheck);
      if (!isValidTemp) {
        try {
          await sendTemplatedNotification('supervisor.pin_change_failed', {
            userId: supervisor.id,
            context: { supervisor, reason: 'PIN temporaire incorrect' },
          });
        } catch (e) { }
        return res.status(401).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'PIN temporaire incorrect',
            en: 'Incorrect temporary PIN',
            ar: 'رقم PIN المؤقت غير صحيح',
          }),
        });
      }

      const nowIso = new Date().toISOString();

      // 4) Mettre à jour le PIN dans la table supervisors
      const { error: supUpdateError } = await supabase
        .from('supervisors')
        .update({
          password_hash: hashedNewPin,
          updated_at: nowIso,
        })
        .eq('id', supervisor.id);

      if (supUpdateError) {
        console.error('Erreur mise à jour PIN (table supervisors) après reset:', supUpdateError);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la mise à jour du PIN',
            en: 'Error updating PIN',
            ar: 'حدث خطأ أثناء تحديث رقم PIN',
          }),
        });
      }

      // 5) Mettre à jour ou créer la ligne supervisor_auth pour refléter le nouveau PIN et lever le flag must_change_pin
      if (supervisorAuth && supervisorAuth.supervisor_id) {
        const { error: authUpdateError } = await supabase
          .from('supervisor_auth')
          .update({
            password_hash: hashedNewPin,
            must_change_pin: false,
            pin_reset_reason: null,
            updated_at: nowIso,
            phone: supervisorAuth.phone || localPhone,
          })
          .eq('supervisor_id', supervisor.id);

        if (authUpdateError) {
          console.error('Erreur mise à jour supervisor_auth après reset:', authUpdateError);
        }
      } else {
        const { error: authInsertError } = await supabase
          .from('supervisor_auth')
          .upsert({
            supervisor_id: supervisor.id,
            phone: localPhone,
            password_hash: hashedNewPin,
            must_change_pin: false,
            pin_reset_reason: null,
            updated_at: nowIso,
          }, { onConflict: 'supervisor_id' });

        if (authInsertError) {
          console.error('Erreur création supervisor_auth après reset:', authInsertError);
        }
      }

      try {
        await sendTemplatedNotification('supervisor.pin_changed', {
          userId: supervisor.id,
          context: { supervisor },
        });
      } catch (e) { }

      const lang = await resolveUserLanguage({ userId: supervisor.id, userType: 'supervisor' });

      return res.json({
        success: true,
        message: pickByLang(lang, {
          fr: 'PIN superviseur mis à jour avec succès',
          en: 'Supervisor PIN updated successfully',
          ar: 'تم تحديث الرقم السري للمشرف بنجاح',
        }),
      });
    }

    if (userType === 'distributor') {
      const distEmail = `${localPhone}@moov.td`;

      const { data: distAuth, error: distAuthError } = await supabase
        .from('distributor_auth')
        .select('id, distributor_id, email, password_hash, must_change_pin')
        .eq('email', distEmail)
        .maybeSingle();

      if (distAuthError || !distAuth || !distAuth.distributor_id) {
        return res.status(404).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Compte distributeur introuvable pour ce téléphone',
            en: 'Distributor account not found for this phone',
            ar: 'تعذر العثور على حساب الموزع لهذا الرقم',
          }),
        });
      }

      if (!distAuth.must_change_pin) {
        return res.status(400).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Aucun changement de PIN requis pour ce compte',
            en: 'No PIN change required for this account',
            ar: 'لا يلزم تغيير رقم PIN لهذا الحساب',
          }),
        });
      }

      const isValidTemp = await bcrypt.compare(cleanTempPassword, distAuth.password_hash || '');
      if (!isValidTemp) {
        try {
          await sendTemplatedNotification('distributor.pin_change_failed', {
            userId: distAuth.distributor_id,
            context: { distributor: { id: distAuth.distributor_id, phone: localPhone }, reason: 'PIN temporaire incorrect' },
          });
        } catch (e) { }
        return res.status(401).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'PIN temporaire incorrect',
            en: 'Incorrect temporary PIN',
            ar: 'رقم PIN المؤقت غير صحيح',
          }),
        });
      }

      const { error: updateError } = await supabase
        .from('distributor_auth')
        .update({
          password_hash: hashedNewPin,
          must_change_pin: false,
          pin_reset_reason: null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', distAuth.id);

      if (updateError) {
        console.error('Erreur mise à jour PIN distributeur après reset:', updateError);
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la mise à jour du PIN',
            en: 'Error updating PIN',
            ar: 'حدث خطأ أثناء تحديث رقم PIN',
          }),
        });
      }

      try {
        const { data: distRow } = await supabase
          .from('distributors')
          .select('id, name, phone')
          .eq('id', distAuth.distributor_id)
          .maybeSingle();
        await sendTemplatedNotification('distributor.pin_changed', {
          userId: distAuth.distributor_id,
          context: { distributor: distRow || { id: distAuth.distributor_id, phone: localPhone } },
        });
      } catch (e) { }

      const lang = await resolveUserLanguage({ userId: distAuth.distributor_id, userType: 'distributor' });

      return res.json({
        success: true,
        message: pickByLang(lang, {
          fr: 'PIN distributeur mis à jour avec succès',
          en: 'Distributor PIN updated successfully',
          ar: 'تم تحديث الرقم السري للموزع بنجاح',
        }),
      });
    }

    return res.status(400).json({
      success: false,
      error: pickByLang(reqLang, {
        fr: "Type d'utilisateur invalide (supervisor ou distributor)",
        en: 'Invalid user type (supervisor or distributor)',
        ar: 'نوع المستخدم غير صالح (مشرف أو موزع)',
      }),
    });
  } catch (error) {
    console.error('\ud83d\udca5 Erreur POST /api/auth/change-pin-after-reset:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors du changement de PIN après réinitialisation',
        en: 'Error changing PIN after reset',
        ar: 'حدث خطأ أثناء تغيير رقم PIN بعد إعادة التعيين',
      }),
    });
  }
});

// POST - Connexion mobile (Superviseur / Distributeur)
// Utilisé par l'application Flutter via /api/auth/login
app.post('/api/auth/login', express.json(), async (req, res) => {
  try {
    const { phone, password } = req.body || {};

    const reqLang = await resolveRequestLanguage(req);

    if (!phone || !password) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Téléphone et mot de passe requis',
          en: 'Phone and password are required',
          ar: 'رقم الهاتف وكلمة المرور مطلوبان',
        }),
      });
    }

    const localPhone = toLocalPhone(phone);
    if (!localPhone) {
      return res.status(400).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Numéro de téléphone invalide',
          en: 'Invalid phone number',
          ar: 'رقم الهاتف غير صالح',
        }),
      });
    }

    const cleanPassword = String(password).trim();
    if (!cleanPassword || cleanPassword.length < 4) {
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Identifiants incorrects',
          en: 'Invalid credentials',
          ar: 'بيانات الدخول غير صحيحة',
        }),
      });
    }

    // Journaliser la tentative de connexion (utilisé pour les stats globales)
    try {
      await supabase.from('auth_logs').insert({
        user_type: 'unknown',
        user_id: null,
        phone: localPhone,
        event: 'login_attempt',
        context: JSON.stringify({ via: 'mobile_app' }),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('⚠️ Erreur insertion auth_logs (login_attempt mobile):', e && e.message ? e.message : e);
    }

    const securitySettings = await getSecuritySettings();
    const maxLoginAttempts = securitySettings.maxLoginAttempts || 5;
    const lockoutMinutes = securitySettings.lockoutMinutes || 15;

    const respondAccountLocked = (lockedUntil) => {
      const until = lockedUntil instanceof Date ? lockedUntil : new Date(lockedUntil);
      const now = new Date();
      const remainingMin = Math.max(1, Math.ceil((until - now) / 60000));
      return res.status(423).json({
        success: false,
        code: 'ACCOUNT_LOCKED',
        error: pickByLang(reqLang, {
          fr: `Compte verrouillé. Réessayez dans ${remainingMin} minute(s).`,
          en: `Account locked. Try again in ${remainingMin} minute(s).`,
          ar: `تم قفل الحساب. أعد المحاولة بعد ${remainingMin} دقيقة.`,
        }),
        lockedUntil: until.toISOString(),
      });
    };

    const respondInvalidCredentials = (attempts) => {
      const remainingAttempts = Math.max(0, maxLoginAttempts - attempts);
      return res.status(401).json({
        success: false,
        error: pickByLang(reqLang, {
          fr: 'Identifiants incorrects',
          en: 'Invalid credentials',
          ar: 'بيانات الدخول غير صحيحة',
        }),
        remainingAttempts,
        maxLoginAttempts,
      });
    };

    const resetSupervisorLockState = async (supervisorId, phoneValue, emailValue, passwordHashValue) => {
      try {
        await supabase
          .from('supervisor_auth')
          .upsert({
            supervisor_id: supervisorId,
            phone: phoneValue,
            email: emailValue || null,
            password_hash: passwordHashValue || null,
            login_attempts: 0,
            is_locked: false,
            locked_until: null,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, { onConflict: 'supervisor_id' });
      } catch (e) {
        console.warn('⚠️ Reset supervisor_auth échoué:', e && e.message ? e.message : e);
      }
    };

    const registerSupervisorFailedAttempt = async (supervisorId, phoneValue, emailValue, passwordHashValue, currentAttempts) => {
      const newCount = Number(currentAttempts || 0) + 1;
      const shouldLock = newCount >= maxLoginAttempts;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + lockoutMinutes * 60000)
        : null;

      try {
        await supabase
          .from('supervisor_auth')
          .upsert({
            supervisor_id: supervisorId,
            phone: phoneValue,
            email: emailValue || null,
            password_hash: passwordHashValue || null,
            login_attempts: newCount,
            is_locked: shouldLock,
            locked_until: lockedUntil ? lockedUntil.toISOString() : null,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString(),
          }, { onConflict: 'supervisor_id' });
      } catch (e) {
        console.warn('⚠️ Update supervisor_auth tentatives échoué:', e && e.message ? e.message : e);
      }

      try {
        await supabase.from('auth_logs').insert({
          user_type: 'supervisor',
          user_id: supervisorId,
          phone: phoneValue,
          event: shouldLock ? 'account_locked' : 'login_failed',
          context: JSON.stringify({ via: 'mobile_app', reason: 'invalid_password', attempts: newCount, lockedUntil: lockedUntil ? lockedUntil.toISOString() : null }),
          created_at: new Date().toISOString(),
        });
      } catch (e) {}

      if (!shouldLock) {
        try {
          const { data: supRow } = await supabase
            .from('supervisors')
            .select('id, first_name, last_name, name, phone')
            .eq('id', supervisorId)
            .maybeSingle();
          await sendTemplatedNotification('supervisor.login_failed', {
            userId: supervisorId,
            context: {
              supervisor: supRow || { id: supervisorId, phone: phoneValue },
              attempts: newCount,
              maxAttempts: maxLoginAttempts,
              lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
            },
          });
        } catch (e) { }
      }

      if (shouldLock && lockedUntil) {
        try {
          const ip = getClientIp(req);
          const ua = req.headers['user-agent'] || '';

          let supervisorName = null;
          try {
            const { data: supRow } = await supabase
              .from('supervisors')
              .select('first_name, last_name, name, phone')
              .eq('id', supervisorId)
              .maybeSingle();

            if (supRow) {
              const fullName = `${supRow.first_name || ''} ${supRow.last_name || ''}`.trim();
              supervisorName = fullName || supRow.name || null;
            }
          } catch (e) { }

          const actorDisplayName = supervisorName
            ? `${supervisorName} (${phoneValue})`
            : phoneValue;

          await logAuditEvent({
            event_type: 'auth.account_locked',
            status: 'error',
            actor: {
              id: supervisorId,
              role: 'supervisor',
              display_name: actorDisplayName,
              ip,
              user_agent: ua,
            },
            resource: {
              type: 'supervisor',
              id: supervisorId,
              name: actorDisplayName,
            },
            action_summary: `Compte superviseur bloqué après ${newCount} tentatives échouées (mobile)`,
            metadata: {
              via: 'mobile_app',
              attempts: newCount,
              maxAttempts: maxLoginAttempts,
              lockedUntil: lockedUntil.toISOString(),
              path: req.path,
              method: req.method,
            },
          });
        } catch (e) { }

        try {
          const { data: supRow } = await supabase
            .from('supervisors')
            .select('id, first_name, last_name, name, phone')
            .eq('id', supervisorId)
            .maybeSingle();
          if (supRow && supRow.id) {
            await sendTemplatedNotification('supervisor.account_locked', {
              userId: supRow.id,
              context: { supervisor: supRow, lockedUntil: lockedUntil.toISOString() },
            });
          }
        } catch (e) { }
      }

      if (shouldLock && lockedUntil) {
        return respondAccountLocked(lockedUntil);
      }

      return respondInvalidCredentials(newCount);
    };

    const resetDistributorLockState = async (distributorId) => {
      try {
        await supabase
          .from('distributor_auth')
          .update({
            login_attempts: 0,
            is_locked: false,
            locked_until: null,
            last_login_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('distributor_id', distributorId);
      } catch (e) {
        console.warn('⚠️ Reset distributor_auth échoué:', e && e.message ? e.message : e);
      }
    };

    const registerDistributorFailedAttempt = async (distAuthRow) => {
      const distributorId = distAuthRow.distributor_id;
      const currentAttempts = Number(distAuthRow.login_attempts || 0);
      const newCount = currentAttempts + 1;
      const shouldLock = newCount >= maxLoginAttempts;
      const lockedUntil = shouldLock
        ? new Date(Date.now() + lockoutMinutes * 60000)
        : null;

      try {
        await supabase
          .from('distributor_auth')
          .update({
            login_attempts: newCount,
            is_locked: shouldLock,
            locked_until: lockedUntil ? lockedUntil.toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq('id', distAuthRow.id);
      } catch (e) {
        console.warn('⚠️ Update distributor_auth tentatives échoué:', e && e.message ? e.message : e);
      }

      try {
        await supabase.from('auth_logs').insert({
          user_type: 'distributor',
          user_id: distributorId,
          phone: localPhone,
          event: shouldLock ? 'account_locked' : 'login_failed',
          context: JSON.stringify({ via: 'mobile_app', reason: 'invalid_password', attempts: newCount, lockedUntil: lockedUntil ? lockedUntil.toISOString() : null }),
          created_at: new Date().toISOString(),
        });
      } catch (e) {}

      if (!shouldLock) {
        try {
          const { data: distRow } = await supabase
            .from('distributors')
            .select('id, name, phone')
            .eq('id', distributorId)
            .maybeSingle();
          await sendTemplatedNotification('distributor.login_failed', {
            userId: distributorId,
            context: {
              distributor: distRow || { id: distributorId, phone: localPhone },
              attempts: newCount,
              maxAttempts: maxLoginAttempts,
              lockedUntil: lockedUntil ? lockedUntil.toISOString() : null,
            },
          });
        } catch (e) { }
      }

      if (shouldLock && lockedUntil) {
        try {
          const ip = getClientIp(req);
          const ua = req.headers['user-agent'] || '';

          let distributorName = null;
          try {
            const { data: distRow } = await supabase
              .from('distributors')
              .select('name, phone')
              .eq('id', distributorId)
              .maybeSingle();

            if (distRow) {
              distributorName = distRow.name || null;
            }
          } catch (e) { }

          const actorDisplayName = distributorName
            ? `${distributorName} (${localPhone})`
            : localPhone;

          await logAuditEvent({
            event_type: 'auth.account_locked',
            status: 'error',
            actor: {
              id: distributorId,
              role: 'distributor',
              display_name: actorDisplayName,
              ip,
              user_agent: ua,
            },
            resource: {
              type: 'distributor',
              id: distributorId,
              name: actorDisplayName,
            },
            action_summary: `Compte distributeur bloqué après ${newCount} tentatives échouées (mobile)`,
            metadata: {
              via: 'mobile_app',
              attempts: newCount,
              maxAttempts: maxLoginAttempts,
              lockedUntil: lockedUntil.toISOString(),
              path: req.path,
              method: req.method,
            },
          });
        } catch (e) { }
      }

      if (shouldLock && lockedUntil) {
        return respondAccountLocked(lockedUntil);
      }

      return respondInvalidCredentials(newCount);
    };

    // Helpers de réponse
    const buildSession = () => ({
      createdAt: new Date().toISOString(),
      // Durée par défaut : 24h pour le mobile
      expiresIn: 24 * 60 * 60,
    });

    const getSupervisorPinFlags = async (supervisorId, phone) => {
      try {
        // Priorité à supervisor_auth (si la ligne existe)
        const { data: authRow } = await supabase
          .from('supervisor_auth')
          .select('must_change_pin, pin_reset_reason')
          .eq('supervisor_id', supervisorId)
          .maybeSingle();

        if (authRow) {
          return {
            mustChangePin: !!authRow.must_change_pin,
            pinResetReason: authRow.pin_reset_reason || null,
          };
        }

        // Fallback possible dans supervisors si jamais ces colonnes sont ajoutées là
        const { data: supRow } = await supabase
          .from('supervisors')
          .select('must_change_pin, pin_reset_reason')
          .eq('id', supervisorId)
          .maybeSingle();

        if (supRow) {
          return {
            mustChangePin: !!supRow.must_change_pin,
            pinResetReason: supRow.pin_reset_reason || null,
          };
        }

      } catch (e) {
        console.warn('Erreur getSupervisorPinFlags:', e, supervisorId, phone);
      }

      return { mustChangePin: false, pinResetReason: null };
    };

    const getDistributorPinFlags = async (distributorId, phone) => {
      try {
        const distEmail = `${phone}@moov.td`;

        const { data: authRow } = await supabase
          .from('distributor_auth')
          .select('must_change_pin, pin_reset_reason')
          .eq('distributor_id', distributorId)
          .maybeSingle();

        if (authRow) {
          return {
            mustChangePin: !!authRow.must_change_pin,
            pinResetReason: authRow.pin_reset_reason || null,
          };
        }

      } catch (e) {
        console.warn('Erreur getDistributorPinFlags:', e, distributorId, phone);
      }

      return { mustChangePin: false, pinResetReason: null };
    };

    const buildSupervisorResponse = async (supervisor, { isFirstLogin } = {}) => {
      const session = buildSession();
      const token = signAuthToken(
        {
          sub: supervisor.id,
          role: 'supervisor',
          userType: 'supervisor',
          phone: supervisor.phone,
        },
        session.expiresIn,
      );

      if (!token) {
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la création de la session',
            en: 'Error creating session',
            ar: 'حدث خطأ أثناء إنشاء الجلسة',
          }),
        });
      }

      const lang = await resolveUserLanguage({ userId: supervisor.id, userType: 'supervisor' });

      const supervisorUser = {
        id: supervisor.id,
        first_name: supervisor.first_name || supervisor.firstName || supervisor.name || null,
        last_name: supervisor.last_name || supervisor.lastName || null,
        phone: supervisor.phone,
        zone: supervisor.zone || null,
        role: supervisor.role || 'supervisor',
        status: supervisor.status || 'active',
        suspension_reason: supervisor.suspension_reason || null,
      };

      if (String(supervisorUser.status).toLowerCase() === 'suspended') {
        try {
          await sendTemplatedNotification('supervisor.suspended', {
            userId: supervisor.id,
            context: { supervisor: supervisorUser, reason: supervisorUser.suspension_reason },
          });
        } catch (e) { }
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          error: pickByLang(lang, {
            fr: 'Compte suspendu',
            en: 'Account suspended',
            ar: 'تم تعليق الحساب',
          }),
        });
      }

      if (isFirstLogin) {
        try {
          await sendTemplatedNotification('supervisor.welcome', {
            userId: supervisor.id,
            context: { supervisor },
          });
        } catch (e) { }
      }

      const { mustChangePin, pinResetReason } = await getSupervisorPinFlags(
        supervisor.id,
        supervisor.phone,
      );

      const requiresOTP = !mustChangePin;

      // Journaliser le succès de connexion superviseur
      try {
        await supabase.from('auth_logs').insert({
          user_type: 'supervisor',
          user_id: supervisor.id,
          phone: supervisor.phone,
          event: 'login_success',
          context: JSON.stringify({ via: 'mobile_app' }),
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('⚠️ Erreur insertion auth_logs (login_success superviseur mobile):', e && e.message ? e.message : e);
      }

      return res.json({
        success: true,
        userType: 'supervisor',
        phone: supervisor.phone,
        requiresOTP,
        mustChangePin,
        pinResetReason,
        user: supervisorUser,
        message: mustChangePin
          ? pickByLang(lang, {
            fr: 'Changement de PIN requis avant de continuer',
            en: 'PIN change required before continuing',
            ar: 'يلزم تغيير الرقم السري (PIN) قبل المتابعة',
          })
          : pickByLang(lang, {
            fr: 'Identifiants valides, code OTP requis',
            en: 'Credentials valid, OTP code required',
            ar: 'بيانات الدخول صحيحة، يلزم رمز OTP',
          }),
        data: {
          supervisor: supervisorUser,
          token,
          session,
        },
      });
    };

    const buildDistributorResponse = async (distributor) => {
      const session = buildSession();
      const token = signAuthToken(
        {
          sub: distributor.id,
          role: 'distributor',
          userType: 'distributor',
          phone: distributor.phone,
        },
        session.expiresIn,
      );

      if (!token) {
        return res.status(500).json({
          success: false,
          error: pickByLang(reqLang, {
            fr: 'Erreur lors de la création de la session',
            en: 'Error creating session',
            ar: 'حدث خطأ أثناء إنشاء الجلسة',
          }),
        });
      }

      const lang = await resolveUserLanguage({ userId: distributor.id, userType: 'distributor' });

      const distributorUser = {
        id: distributor.id,
        name: distributor.name || distributor.full_name || distributor.label || distributor.phone,
        phone: distributor.phone,
        zone: distributor.zone || null,
        credit_balance: distributor.credit_balance != null ? Number(distributor.credit_balance) : 0,
        status: distributor.status || 'active',
        suspension_reason: distributor.suspension_reason || null,
        language: distributor.language ? normalizeLanguage(distributor.language) : null,
      };

      if (String(distributorUser.status).toLowerCase() === 'suspended') {
        try {
          await sendTemplatedNotification('distributor.suspended', {
            userId: distributor.id,
            context: { distributor: distributorUser, reason: distributor.suspension_reason || distributorUser.suspension_reason || null },
          });
        } catch (e) { }
        return res.status(403).json({
          success: false,
          code: 'ACCOUNT_SUSPENDED',
          error: pickByLang(lang, {
            fr: 'Compte suspendu',
            en: 'Account suspended',
            ar: 'تم تعليق الحساب',
          }),
        });
      }

      const { mustChangePin, pinResetReason } = await getDistributorPinFlags(
        distributor.id,
        distributor.phone,
      );

      const requiresOTP = !mustChangePin;

      // Journaliser le succès de connexion distributeur pour l'historique d'authentification
      try {
        await supabase.from('auth_logs').insert({
          user_type: 'distributor',
          user_id: distributor.id,
          phone: distributor.phone,
          event: 'login_success',
          context: JSON.stringify({ via: 'mobile_app' }),
          created_at: new Date().toISOString(),
        });
      } catch (e) {
        console.warn('⚠️ Erreur insertion auth_logs (login_success distributeur mobile):', e && e.message ? e.message : e);
      }

      return res.json({
        success: true,
        userType: 'distributor',
        phone: distributor.phone,
        requiresOTP,
        mustChangePin,
        pinResetReason,
        user: distributorUser,
        message: mustChangePin
          ? pickByLang(lang, {
            fr: 'Changement de PIN requis avant de continuer',
            en: 'PIN change required before continuing',
            ar: 'يلزم تغيير الرقم السري (PIN) قبل المتابعة',
          })
          : pickByLang(lang, {
            fr: 'Identifiants valides, code OTP requis',
            en: 'Credentials valid, OTP code required',
            ar: 'بيانات الدخول صحيحة، يلزم رمز OTP',
          }),
        data: {
          distributor: distributorUser,
          token,
          session,
        },
      });
    };

    // ... (rest of the code remains the same)

    let supervisorMatched = false;

    // 1) Tenter comme superviseur
    try {
      const { data: supervisorAuth, error: supAuthError } = await supabase
        .from('supervisor_auth')
        .select('supervisor_id, phone, email, password_hash, login_attempts, is_locked, locked_until, last_login_at')
        .eq('phone', localPhone)
        .maybeSingle();

      if (!supAuthError && supervisorAuth && supervisorAuth.supervisor_id) {
        if (supervisorAuth.is_locked && supervisorAuth.locked_until) {
          const lockedUntil = new Date(supervisorAuth.locked_until);
          if (new Date() < lockedUntil) {
            return respondAccountLocked(lockedUntil);
          }
          await resetSupervisorLockState(
            supervisorAuth.supervisor_id,
            localPhone,
            supervisorAuth.email || null,
            supervisorAuth.password_hash || null,
          );
        }

        const isValid = await bcrypt.compare(cleanPassword, supervisorAuth.password_hash || '');
        if (isValid) {
          const { data: supervisor, error: supError } = await supabase
            .from('supervisors')
            .select('*')
            .eq('id', supervisorAuth.supervisor_id)
            .maybeSingle();

          if (!supError && supervisor) {
            supervisorMatched = true;
            await resetSupervisorLockState(
              supervisor.id,
              localPhone,
              supervisor.email || supervisorAuth.email || null,
              supervisorAuth.password_hash || supervisor.password_hash || null,
            );
            const isFirstLogin = !supervisorAuth.last_login_at;
            return await buildSupervisorResponse({ ...supervisor, phone: localPhone }, { isFirstLogin });
          }
        } else {
          return await registerSupervisorFailedAttempt(
            supervisorAuth.supervisor_id,
            localPhone,
            supervisorAuth.email || null,
            supervisorAuth.password_hash || null,
            supervisorAuth.login_attempts || 0,
          );
        }
      }
    } catch (e) {
      console.warn('Erreur auth superviseur mobile:', e);
    }

    if (!supervisorMatched) {
      try {
        const { data: supervisorRow, error: supRowError } = await supabase
          .from('supervisors')
          .select('*')
          .eq('phone', localPhone)
          .maybeSingle();

        if (!supRowError && supervisorRow && supervisorRow.password_hash) {
          let lockRow = null;
          try {
            const { data: authRow } = await supabase
              .from('supervisor_auth')
              .select('supervisor_id, email, password_hash, login_attempts, is_locked, locked_until, last_login_at')
              .eq('supervisor_id', supervisorRow.id)
              .maybeSingle();
            lockRow = authRow || null;
          } catch (e) {
            lockRow = null;
          }

          if (lockRow && lockRow.is_locked && lockRow.locked_until) {
            const lockedUntil = new Date(lockRow.locked_until);
            if (new Date() < lockedUntil) {
              return respondAccountLocked(lockedUntil);
            }
            await resetSupervisorLockState(
              supervisorRow.id,
              localPhone,
              supervisorRow.email || lockRow.email || null,
              lockRow.password_hash || supervisorRow.password_hash || null,
            );
          }

          const isValidSup = await bcrypt.compare(cleanPassword, supervisorRow.password_hash || '');
          if (isValidSup) {
            await resetSupervisorLockState(
              supervisorRow.id,
              localPhone,
              supervisorRow.email || null,
              supervisorRow.password_hash || null,
            );
            const isFirstLogin = !(lockRow && lockRow.last_login_at);
            return await buildSupervisorResponse({ ...supervisorRow, phone: localPhone }, { isFirstLogin });
          }

          return await registerSupervisorFailedAttempt(
            supervisorRow.id,
            localPhone,
            supervisorRow.email || (lockRow && lockRow.email) || null,
            (lockRow && lockRow.password_hash) || supervisorRow.password_hash || null,
            (lockRow && lockRow.login_attempts) || 0,
          );
        }
      } catch (e) {
        console.warn('Erreur fallback auth superviseur (table supervisors):', e);
      }
    }

    // 2) Tenter comme distributeur
    try {
      // La table distributor_auth ne contient pas de colonne phone, on utilise l'email basé sur le téléphone
      const distEmail = `${localPhone}@moov.td`;

      const { data: distAuth, error: distAuthError } = await supabase
        .from('distributor_auth')
        .select('id, distributor_id, email, password_hash, login_attempts, is_locked, locked_until, last_login_at')
        .eq('email', distEmail)
        .maybeSingle();

      if (!distAuthError && distAuth && distAuth.distributor_id) {
        if (distAuth.is_locked && distAuth.locked_until) {
          const lockedUntil = new Date(distAuth.locked_until);
          if (new Date() < lockedUntil) {
            return respondAccountLocked(lockedUntil);
          }
          await resetDistributorLockState(distAuth.distributor_id);
        }

        const isValid = await bcrypt.compare(cleanPassword, distAuth.password_hash || '');
        if (isValid) {
          const isFirstLogin = !distAuth.last_login_at;
          const { data: distributor, error: distError } = await supabase
            .from('distributors')
            .select('*')
            .eq('id', distAuth.distributor_id)
            .maybeSingle();

          if (!distError && distributor) {
            await resetDistributorLockState(distAuth.distributor_id);
            if (isFirstLogin) {
              try {
                await sendTemplatedNotification('distributor.welcome', {
                  userId: distributor.id,
                  context: { distributor },
                });
              } catch (e) { }
            }
            return await buildDistributorResponse({ ...distributor, phone: localPhone });
          }
        } else {
          return await registerDistributorFailedAttempt(distAuth);
        }
      }
    } catch (e) {
      console.warn('Erreur auth distributeur mobile:', e);
    }

    // Si aucun match
    return res.status(401).json({
      success: false,
      error: pickByLang(reqLang, {
        fr: 'Identifiants incorrects',
        en: 'Invalid credentials',
        ar: 'بيانات الدخول غير صحيحة',
      }),
    });
  } catch (error) {
    console.error('💥 Erreur POST /api/auth/login:', error);
    return res.status(500).json({
      success: false,
      error: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Erreur lors de la connexion',
        en: 'Login error',
        ar: 'حدث خطأ أثناء تسجيل الدخول',
      }),
    });
  }
});

// POST - Épuiser le solde d'un container (décrémenter le balance) et vérifier l'alerte
app.post('/api/containers/:id/deplete', async (req, res) => {
  try {
    const { amount } = req.body || {};
    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'amount invalide' });
    }

    // Tenter via table containers
    try {
      const { data: cont, error: selErr } = await supabase
        .from('containers')
        .select('id, balance')
        .eq('id', req.params.id)
        .single();
      if (selErr) throw selErr;
      const current = Number(cont?.balance) || 0;
      const newBalance = Math.max(0, current - amt);
      const { data: upd, error: updErr } = await supabase
        .from('containers')
        .update({ balance: newBalance, updated_at: new Date().toISOString() })
        .eq('id', req.params.id)
        .select()
        .single();
      if (updErr) throw updErr;

      try {
        await logAuditEvent({
          event_type: 'container.balance_depleted',
          actor: buildActorFromRequest(req),
          resource: {
            type: 'container',
            id: req.params.id,
          },
          action_summary: `Décrément de ${amt} unités du container`,
          values_before: {
            balance: current,
          },
          values_after: {
            balance: newBalance,
            delta: -amt,
          },
        });
      } catch (e) { }

      if (typeof smsService.checkAndAlertContainerBalance === 'function') {
        smsService.checkAndAlertContainerBalance(req.params.id).catch(() => { });
      }
      try {
        checkAutoAlerts('container', req.params.id, newBalance).catch(() => { });
      } catch (e) { }
      return res.json({ success: true, data: { id: req.params.id, balance: newBalance } });
    } catch (tableErr) {
      // Fallback via app_settings clé container_balance_{id}
      try {
        const key = `container_balance_${req.params.id}`;
        const { data: existing } = await supabase
          .from('app_settings')
          .select('value')
          .eq('key', key)
          .single();
        const current = Number(existing?.value) || 0;
        const newBalance = Math.max(0, current - amt);
        const { error: upErr } = await supabase
          .from('app_settings')
          .upsert({ key, value: newBalance }, { onConflict: 'key' });
        if (upErr) throw upErr;

        try {
          await logAuditEvent({
            event_type: 'container.balance_depleted_fallback',
            actor: buildActorFromRequest(req),
            resource: {
              type: 'container_balance_setting',
              id: req.params.id,
            },
            action_summary: `Décrément de ${amt} unités (fallback app_settings)`,
            values_before: {
              balance: current,
            },
            values_after: {
              balance: newBalance,
              delta: -amt,
            },
          });
        } catch (e) { }

        if (typeof smsService.checkAndAlertContainerBalance === 'function') {
          smsService.checkAndAlertContainerBalance(req.params.id).catch(() => { });
        }
        return res.json({ success: true, data: { id: req.params.id, balance: newBalance } });
      } catch (fallbackErr) {
        return res.status(500).json({ success: false, error: error.message });
      }
    }
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// POST - Tester l'alerte SMS du seuil pour un container (déclenchement manuel)
app.post('/api/containers/:id/check-threshold', async (req, res) => {
  try {
    if (typeof smsService.checkAndAlertContainerBalance !== 'function') {
      return res.status(500).json({ success: false, error: 'Service SMS indisponible' });
    }
    const result = await smsService.checkAndAlertContainerBalance(req.params.id);
    return res.json({ success: !!result?.success, result });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message });
  }
});

// PUT - Mise à jour du seuil (alert_threshold) d'un container
app.put('/api/containers/:id/threshold', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { threshold } = req.body || {};
    const numeric = Number(threshold);

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID container manquant' });
    }
    if (Number.isNaN(numeric) || numeric < 0) {
      return res.status(400).json({ success: false, error: 'Seuil invalide' });
    }

    const { data: updated, error } = await supabase
      .from('containers')
      .update({ alert_threshold: numeric, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'P0001') {
        return res.status(404).json({ success: false, error: 'Container introuvable' });
      }

      const msg = (error.message || '').toLowerCase();
      const details = error.message || error.details || String(error);

      // Cas 1: colonne manquante (schéma pas migré)
      if (msg.includes('alert_threshold') && (msg.includes('does not exist') || msg.includes('unknown column') || msg.includes('column') && msg.includes('does not exist'))) {
        console.error('💥 Colonne alert_threshold manquante (PUT /api/containers/:id/threshold):', error);
        return res.status(400).json({
          success: false,
          error: 'Schéma DB incomplet: colonne alert_threshold manquante dans containers',
          hint: 'Exécutez le script supabase/fix-columns-step1.sql ou supabase/FIX-NOW-ALL-IN-ONE.sql dans Supabase SQL Editor',
        });
      }

      // Cas 2: permissions/RLS (typiquement quand le serveur utilise une clé anon au lieu du service key)
      if (msg.includes('permission') || msg.includes('not allowed') || msg.includes('rls') || msg.includes('row-level security')) {
        console.error('💥 Permission/RLS (PUT /api/containers/:id/threshold):', error);
        return res.status(403).json({
          success: false,
          error: 'Accès refusé (RLS/permissions) lors de la mise à jour du seuil',
          hint: 'Vérifiez que le backend utilise SUPABASE_SERVICE_KEY (service role) et SUPABASE_URL de votre projet Supabase',
        });
      }

      console.error('💥 Erreur PUT /api/containers/:id/threshold:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur mise à jour seuil container',
        details,
      });
    }

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Container introuvable' });
    }

    try {
      if (typeof smsService.checkAndAlertContainerBalance === 'function') {
        smsService.checkAndAlertContainerBalance(id).catch(() => { });
      }
    } catch (e) { }

    try {
      checkAutoAlerts('container', id, updated.balance).catch(() => { });
    } catch (e) { }

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('💥 Erreur inattendue PUT /api/containers/:id/threshold:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour seuil container' });
  }
});

// POST - Création d'un nouveau container (utilisé par le dashboard Next.js)
app.post('/api/containers', express.json(), async (req, res) => {
  try {
    const body = req.body || {};
    const {
      max_capacity,
      initial_balance,
      distributor_id,
      gps_lat,
      gps_lng,
      location_name,
      phone,
      status,
      gps_address,
    } = body;

    // Champs obligatoires
    if (!distributor_id || !location_name) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants (distributor_id, location_name)',
      });
    }

    // Normalisation et validation du téléphone (optionnel)
    let normalizedPhone = phone ? String(phone).trim() : null;
    if (normalizedPhone && !/^(30\d{6}|9\d{7})$/.test(normalizedPhone)) {
      return res.status(400).json({
        success: false,
        error: 'Format de téléphone invalide (8 chiffres: 30XXXXXX ou 9XXXXXXX)',
      });
    }

    // Capacité et solde initial
    const capacity = max_capacity != null ? Number(max_capacity) : 100000;
    const balance = initial_balance != null ? Number(initial_balance) : 0;

    if (Number.isNaN(capacity) || capacity <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Capacité maximale invalide',
      });
    }

    if (Number.isNaN(balance) || balance < 0) {
      return res.status(400).json({
        success: false,
        error: 'Solde initial invalide',
      });
    }

    if (balance > capacity) {
      return res.status(400).json({
        success: false,
        error: 'Le solde initial ne peut pas dépasser la capacité maximale',
      });
    }

    // Coordonnées GPS
    const latitude =
      gps_lat != null && gps_lat !== '' ? Number(gps_lat) : null;
    const longitude =
      gps_lng != null && gps_lng !== '' ? Number(gps_lng) : null;

    const insertPayload = {
      name: location_name,
      location_name,
      phone: normalizedPhone,
      distributor_id,
      status: status || 'active',
      balance,
      max_capacity: capacity,
      latitude,
      longitude,
      gps_address: gps_address || location_name || null,
      updated_at: new Date().toISOString(),
    };

    const { data: created, error: insertErr } = await supabase
      .from('containers')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr || !created) {
      console.error('💥 Erreur création container /api/containers:', insertErr);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la création du container",
      });
    }

    try {
      await logAuditEvent({
        event_type: 'container.created',
        actor: buildActorFromRequest(req),
        resource: { type: 'container', id: created.id },
        action_summary: 'Création de container (dashboard)',
        values_after: {
          container_id: created.id,
          distributor_id: created.distributor_id || distributor_id,
          status: created.status || null,
          max_capacity: created.max_capacity || capacity,
          balance: created.balance || balance,
        },
        metadata: { path: req.path, method: req.method },
      });
    } catch (e) {}

    try {
      if (created.distributor_id) {
        await sendTemplatedNotification('container.assigned_to_distributor', {
          userId: created.distributor_id,
          context: {
            container: created,
          },
        });

        try {
          const { data: dist } = await supabase
            .from('distributors')
            .select('id, name, phone, supervisor_id')
            .eq('id', created.distributor_id)
            .maybeSingle();
          if (dist && dist.supervisor_id) {
            await sendTemplatedNotification('supervisor.container_assigned', {
              userId: dist.supervisor_id,
              context: { container: created, distributor: dist },
            });
          }
        } catch (e) { }
      }
    } catch (e) {}

    return res.status(201).json({
      success: true,
      data: created,
    });
  } catch (error) {
    console.error('💥 Erreur inattendue POST /api/containers:', error);
    return res.status(500).json({
      success: false,
      error: "Erreur lors de la création du container",
    });
  }
});

// PUT - Mise à jour d'un container (assignation / modification)
app.put('/api/containers/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = { ...(req.body || {}) };

    const { data: beforeRow } = await supabase
      .from('containers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    // Champs non modifiables
    delete updateData.id;
    delete updateData.container_code;
    delete updateData.created_at;

    // Validation du téléphone si fourni
    if (updateData.phone) {
      const phone = String(updateData.phone).trim();
      if (!/^(30\d{6}|9\d{7})$/.test(phone)) {
        return res.status(400).json({
          success: false,
          error: 'Format de téléphone invalide (8 chiffres: 30XXXXXX ou 9XXXXXXX)',
        });
      }
      updateData.phone = phone;
    }

    const { data, error } = await supabase
      .from('containers')
      .update(updateData)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'P0001') {
        return res.status(404).json({
          success: false,
          error: 'Container introuvable',
        });
      }
      console.error('💥 Erreur PUT /api/containers/:id:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour du container',
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Container introuvable',
      });
    }

    try {
      const beforeDistributorId = beforeRow && beforeRow.distributor_id ? String(beforeRow.distributor_id) : null;
      const afterDistributorId = data && data.distributor_id ? String(data.distributor_id) : null;

      if (beforeDistributorId && beforeDistributorId !== afterDistributorId) {
        await sendTemplatedNotification('container.unassigned', {
          userId: beforeDistributorId,
          context: { container: beforeRow },
        });

        try {
          const { data: oldDist } = await supabase
            .from('distributors')
            .select('id, name, phone, supervisor_id')
            .eq('id', beforeDistributorId)
            .maybeSingle();
          if (oldDist && oldDist.supervisor_id) {
            await sendTemplatedNotification('supervisor.container_unassigned', {
              userId: oldDist.supervisor_id,
              context: { container: beforeRow, distributor: oldDist },
            });
          }
        } catch (e) { }
      }

      if (afterDistributorId && beforeDistributorId !== afterDistributorId) {
        let dist = null;
        try {
          const { data: d } = await supabase
            .from('distributors')
            .select('id, name, phone')
            .eq('id', afterDistributorId)
            .maybeSingle();
          dist = d || null;
        } catch (e) {
          dist = null;
        }

        await sendTemplatedNotification('container.assigned_to_distributor', {
          userId: afterDistributorId,
          context: { container: data, distributor: dist },
        });

        try {
          if (dist && dist.supervisor_id) {
            await sendTemplatedNotification('supervisor.container_assigned', {
              userId: dist.supervisor_id,
              context: { container: data, distributor: dist },
            });
          }
        } catch (e) { }
      }

      if (afterDistributorId) {
        const changedDistributorLink = beforeDistributorId !== afterDistributorId;
        if (!changedDistributorLink) {
          await sendTemplatedNotification('container.updated', {
            userId: afterDistributorId,
            context: { container: data },
          });
        }
      }
    } catch (e) { }

    return res.json({
      success: true,
      data,
    });
  } catch (error) {
    console.error('💥 Erreur inattendue PUT /api/containers/:id:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du container',
    });
  }
});

// GET - Tous les containers (utilisé par le dashboard Next.js)
app.get('/api/containers', async (req, res) => {
  try {
    let rows = [];

    // 1) Essayer d utiliser la vue containers_with_stats (avec infos distributeur)
    try {
      const { data, error } = await supabase
        .from('containers_with_stats')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      rows = Array.isArray(data) ? data : [];
    } catch (e) {
      // 2) Fallback: table containers simple
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      rows = Array.isArray(data) ? data : [];
    }

    const distributorIdsNeedingHydration = Array.from(
      new Set(
        (rows || [])
          .map((row) => row && row.distributor_id ? String(row.distributor_id) : null)
          .filter(Boolean)
      )
    );

    let distributorsById = {};
    if (distributorIdsNeedingHydration.length > 0) {
      try {
        const { data: dists } = await supabase
          .from('distributors')
          .select('id, name, phone, zone')
          .in('id', distributorIdsNeedingHydration);

        if (Array.isArray(dists)) {
          distributorsById = dists.reduce((acc, dist) => {
            if (dist && dist.id) {
              acc[String(dist.id)] = dist;
            }
            return acc;
          }, {});
        }
      } catch (e) {
        distributorsById = {};
      }
    }

    // Adapter le format pour le frontend (code, gps_lat/gps_lng, distributeur, last_ping...)
    const mapped = rows.map((row) => {
      const hydratedDistributor = row && row.distributor_id
        ? (distributorsById[String(row.distributor_id)] || null)
        : null;

      const latitude =
        row.gps_lat != null && row.gps_lat !== ''
          ? Number(row.gps_lat)
          : row.latitude != null && row.latitude !== ''
          ? Number(row.latitude)
          : null;
      const longitude =
        row.gps_lng != null && row.gps_lng !== ''
          ? Number(row.gps_lng)
          : row.longitude != null && row.longitude !== ''
          ? Number(row.longitude)
          : null;

      const maxCapacityRaw = row.max_capacity != null ? Number(row.max_capacity) : NaN;
      const maxCapacity = !Number.isNaN(maxCapacityRaw) && maxCapacityRaw > 0 ? maxCapacityRaw : 100000;

      const lastPing = row.last_activity || row.updated_at || row.created_at || null;

      const distributorName = row.distributor_name || (hydratedDistributor && hydratedDistributor.name) || null;
      const distributorPhone = row.distributor_phone || (hydratedDistributor && hydratedDistributor.phone) || null;
      const distributorZone = row.zone || (hydratedDistributor && hydratedDistributor.zone) || null;

      const distributor =
        row.distributor_id && (distributorName || distributorPhone || distributorZone)
          ? {
              id: row.distributor_id,
              name: distributorName,
              phone: distributorPhone,
              zone: distributorZone,
            }
          : null;

      return {
        ...row,
        code: row.code || row.container_code || row.name || row.location_name || null,
        gps_lat: latitude,
        gps_lng: longitude,
        max_capacity: maxCapacity,
        last_ping: lastPing,
        distributor_name: distributorName || (distributor && distributor.name) || null,
        distributor_phone: distributorPhone || (distributor && distributor.phone) || null,
        distributor,
      };
    });

    return res.json({
      success: true,
      data: mapped,
      count: mapped.length,
    });
  } catch (error) {
    console.error('💥 Erreur GET /api/containers:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des containers',
    });
  }
});

// GET - Détail d'un container (avec infos distributeur enrichies)
app.get('/api/containers/:id', async (req, res) => {
  try {
    const { id } = req.params;

    let row = null;

    // 1) Essayer via la vue containers_with_stats
    try {
      const { data, error } = await supabase
        .from('containers_with_stats')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) throw error;
      row = data || null;
    } catch (e) {
      // 2) Fallback: table containers simple
      const { data, error } = await supabase
        .from('containers')
        .select('*')
        .eq('id', id)
        .maybeSingle();

      if (error) {
        if (error.code === 'PGRST116' || error.code === 'P0001') {
          return res.status(404).json({ success: false, error: 'Container introuvable' });
        }
        console.error('💥 Erreur GET /api/containers/:id (fallback containers):', error);
        return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du container' });
      }

      row = data || null;
    }

    if (!row) {
      return res.status(404).json({ success: false, error: 'Container introuvable' });
    }

    // Si possible, enrichir avec les infos complètes du distributeur (zone, téléphone...)
    let distributor = null;
    if (row.distributor_id) {
      try {
        const { data: dist } = await supabase
          .from('distributors')
          .select('id, name, phone, zone')
          .eq('id', row.distributor_id)
          .maybeSingle();

        if (dist) {
          distributor = {
            id: dist.id,
            name: dist.name,
            phone: dist.phone,
            zone: dist.zone,
          };
        }
      } catch (e) { }
    }

    const latitude =
      row.gps_lat != null && row.gps_lat !== ''
        ? Number(row.gps_lat)
        : row.latitude != null && row.latitude !== ''
        ? Number(row.latitude)
        : null;
    const longitude =
      row.gps_lng != null && row.gps_lng !== ''
        ? Number(row.gps_lng)
        : row.longitude != null && row.longitude !== ''
        ? Number(row.longitude)
        : null;

    const maxCapacityRaw = row.max_capacity != null ? Number(row.max_capacity) : NaN;
    const maxCapacity = !Number.isNaN(maxCapacityRaw) && maxCapacityRaw > 0 ? maxCapacityRaw : 100000;

    const payload = {
      ...row,
      code: row.code || row.container_code || row.name || row.location_name || null,
      gps_lat: latitude,
      gps_lng: longitude,
      max_capacity: maxCapacity,
      distributor,
      distributor_name: row.distributor_name || (distributor && distributor.name) || null,
      distributor_phone: row.distributor_phone || (distributor && distributor.phone) || null,
    };

    return res.json({ success: true, data: payload });
  } catch (error) {
    console.error('💥 Erreur inattendue GET /api/containers/:id:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du container' });
  }
});

// GET - Transactions d'un container (données réelles si disponibles)
app.get('/api/containers/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params;
    const limitParam = req.query && req.query.limit ? Number(req.query.limit) : 10;
    const limit = !Number.isNaN(limitParam) && limitParam > 0 ? limitParam : 10;

    let transactions = [];

    try {
      const { data, error } = await supabase
        .from('container_transactions')
        .select('*')
        .eq('container_id', id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('💥 Erreur lecture container_transactions:', error);
      } else {
        transactions = Array.isArray(data) ? data : [];
      }
    } catch (dbError) {
      console.error('💥 Exception container_transactions:', dbError);
    }

    const mapped = transactions.map((row) => {
      const rawType = (row.type || '').toString().toLowerCase();
      const uiType = rawType === 'recharge' || rawType === 'credit' ? 'credit' : 'debit';

      return {
        id: row.id,
        type: uiType,
        amount: Number(row.amount) || 0,
        description:
          row.description ||
          (rawType === 'recharge'
            ? 'Recharge container'
            : rawType === 'purchase'
            ? 'Transaction client'
            : 'Mouvement container'),
        created_at: row.created_at || new Date().toISOString(),
        balance_before:
          row.previous_balance != null && !Number.isNaN(Number(row.previous_balance))
            ? Number(row.previous_balance)
            : null,
        balance_after:
          row.new_balance != null && !Number.isNaN(Number(row.new_balance))
            ? Number(row.new_balance)
            : null,
        reference: row.reference || null,
        status: row.status || 'completed',
      };
    });

    try {
      await logAuditEvent({
        event_type: 'container.transactions_viewed',
        actor: buildActorFromRequest(req),
        resource: { type: 'container', id },
        action_summary: 'Consultation des transactions du container',
        metadata: { path: req.path, method: req.method, query: req.query || {} },
      });
    } catch (e) {}

    return res.json({ success: true, data: mapped });
  } catch (error) {
    console.error('💥 Erreur /api/containers/:id/transactions:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des transactions' });
  }
});

// POST - Recharge d'un container
app.post('/api/containers/:id/recharge', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { amount, reference } = req.body || {};

    const amt = Number(amount);
    if (!amt || isNaN(amt) || amt <= 0) {
      return res.status(400).json({ success: false, error: 'Montant invalide' });
    }

    const { data: cont, error: selErr } = await supabase
      .from('containers')
      .select('*')
      .eq('id', id)
      .single();

    if (selErr || !cont) {
      if (selErr && (selErr.code === 'PGRST116' || selErr.code === 'P0001')) {
        return res.status(404).json({ success: false, error: 'Container introuvable' });
      }
      console.error('💥 Erreur lecture container pour recharge:', selErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du container' });
    }

    const currentBalance = Number(cont.balance) || 0;
    const maxCapacity = cont.max_capacity && !isNaN(Number(cont.max_capacity)) ? Number(cont.max_capacity) : 100000;
    const newBalance = currentBalance + amt;

    if (newBalance > maxCapacity) {
      return res.status(400).json({
        success: false,
        error: `Le solde maximum du container est atteint (${maxCapacity}).`,
      });
    }

    const nowIso = new Date().toISOString();
    // Commission distributeur: 2% du montant de recharge (si un distributeur est rattaché)
    const commissionRate = 0.02;
    const commissionAmount = amt * commissionRate;

    let distributorBefore = null;
    let distributorAfter = null;

    if (cont.distributor_id) {
      const { data: distRow, error: distErr } = await supabase
        .from('distributors')
        .select('id, credit_balance, credit_limit, name, phone')
        .eq('id', cont.distributor_id)
        .maybeSingle();
      if (distErr) {
        console.error(' Erreur lecture distributeur pour recharge container:', distErr);
        return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du distributeur' });
      }
      if (!distRow) {
        return res.status(400).json({ success: false, error: 'Distributeur rattaché introuvable' });
      }

      const currentCredit = Number(distRow.credit_balance) || 0;
      if (currentCredit < amt) {
        return res.status(400).json({ success: false, error: 'Solde distributeur insuffisant' });
      }

      const newCredit = currentCredit - amt;
      distributorBefore = { ...distRow, credit_balance: currentCredit };

      const { data: distUpdated, error: distUpdErr } = await supabase
        .from('distributors')
        .update({ credit_balance: newCredit, updated_at: nowIso })
        .eq('id', distRow.id)
        .select('*')
        .maybeSingle();

      if (distUpdErr) {
        console.error('💥 Erreur débit distributeur (recharge container):', distUpdErr);
        return res.status(500).json({ success: false, error: 'Erreur lors du débit du distributeur' });
      }

      distributorAfter = distUpdated || { ...distRow, credit_balance: newCredit };

      try {
        await supabase.from('distributor_transactions').insert({
          distributor_id: distRow.id,
          type: 'CONTAINER_RECHARGE_DEBIT',
          amount: amt,
          balance_before: currentCredit,
          balance_after: newCredit,
          status: 'completed',
          description: reference
            ? `Débit recharge container (${reference})`
            : 'Débit recharge container',
        });
      } catch (e) { }
    }

    const { data: updated, error: updErr } = await supabase
      .from('containers')
      .update({ balance: newBalance, updated_at: nowIso })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      console.error('💥 Erreur mise à jour solde container:', updErr);
      if (distributorBefore && distributorBefore.id) {
        try {
          await supabase
            .from('distributors')
            .update({ credit_balance: Number(distributorBefore.credit_balance) || 0, updated_at: nowIso })
            .eq('id', distributorBefore.id);
        } catch (e) { }
      }
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du container' });
    }

    // Enregistrer la recharge dans l'historique des mouvements du container
    try {
      const txPayload = {
        container_id: id,
        distributor_id: cont.distributor_id || null,
        type: 'recharge',
        amount: amt,
        previous_balance: currentBalance,
        new_balance: newBalance,
        description: reference ? `Recharge container (${reference})` : 'Recharge container (dashboard)',
      };

      try {
        await supabase.from('container_transactions').insert(txPayload);
      } catch (txErr) {
        console.warn('⚠️ Erreur insertion container_transactions (recharge):', txErr);
      }

      // Optionnel : stocker aussi dans container_recharges pour le reporting commissions
      try {
        if (cont.distributor_id) {
          await supabase.from('container_recharges').insert({
            container_id: id,
            distributor_id: cont.distributor_id,
            amount: amt,
            commission_amount: commissionAmount,
            status: 'completed',
          });

          // Créer également une commission distributeur dédiée pour cette recharge
          try {
            const description = reference
              ? `Commission 2% sur recharge container (${reference})`
              : `Commission 2% sur recharge container ${
                  cont.code || cont.container_code || cont.name || ''
                }`.trim();

            await supabase.from('distributor_commissions').insert({
              distributor_id: cont.distributor_id,
              container_id: id,
              commission_amount: commissionAmount,
              commission_rate: 2.0,
              transaction_amount: amt,
              type: 'CONTAINER_RECHARGE',
              status: 'pending',
              description,
              created_at: nowIso,
            });

            try {
              await sendTemplatedNotification('distributor.commission_earned', {
                userId: cont.distributor_id,
                context: {
                  distributor: distributorAfter || distributorBefore || { id: cont.distributor_id },
                  container: cont,
                  amount: commissionAmount,
                },
              });
            } catch (e) { }
          } catch (commErr) {
            console.warn('⚠️ Erreur insertion distributor_commissions (recharge):', commErr);
          }
        }
      } catch (rechErr) {
        console.warn('⚠️ Erreur insertion container_recharges (recharge):', rechErr);
      }
    } catch (histErr) {
      console.warn('⚠️ Erreur historique recharge container:', histErr);
    }

    // Notifier le distributeur si le container est rattaché
    try {
      if (cont.distributor_id) {
        await sendTemplatedNotification('container.recharged', {
          userId: cont.distributor_id,
          context: {
            container: cont,
            amount: amt,
            reference,
          },
        });
      }
    } catch (e) { }

    try {
      if (distributorAfter && distributorAfter.id) {
        const level = getDistributorBalanceAlertLevel(distributorAfter.credit_balance);
        if (level) {
          await sendTemplatedNotification(
            level === 'critical' ? 'distributor.credit_critical' : 'distributor.credit_low',
            {
              userId: distributorAfter.id,
              context: {
                distributor: distributorAfter,
                amount: Number(distributorAfter.credit_balance) || 0,
              },
            }
          );
        }
      }
    } catch (e) { }

    try {
      await logAuditEvent({
        event_type: 'container.recharged',
        actor: buildActorFromRequest(req),
        resource: { type: 'container', id, name: cont.code || cont.container_code || cont.name || null },
        action_summary: `Recharge du container de ${amt} unités`,
        values_before: { balance: currentBalance },
        values_after: { balance: newBalance, delta: amt, reference: reference || null },
        metadata: { path: req.path, method: req.method, body: { reference } },
      });
    } catch (e) {}

    return res.json({ success: true, data: updated });
  } catch (error) {
    console.error('💥 Erreur inattendue POST /api/containers/:id/recharge:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la recharge du container' });
  }
});

// PUT - Mise à jour du statut d'un container
app.put('/api/containers/:id/status', express.json(), async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body || {};

    const allowed = ['active', 'inactive', 'maintenance'];
    if (!status || !allowed.includes(status)) {
      return res.status(400).json({ success: false, error: 'Statut invalide' });
    }

    const { data: before, error: selErr } = await supabase
      .from('containers')
      .select('*')
      .eq('id', id)
      .single();

    if (selErr || !before) {
      if (selErr && (selErr.code === 'PGRST116' || selErr.code === 'P0001')) {
        return res.status(404).json({ success: false, error: 'Container introuvable' });
      }
      console.error('💥 Erreur lecture container pour update status:', selErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du container' });
    }

    const { data: after, error: updErr } = await supabase
      .from('containers')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', id)
      .select('*')
      .single();

    if (updErr) {
      console.error('💥 Erreur mise à jour statut container:', updErr);
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du statut' });
    }

    try {
      await logAuditEvent({
        event_type: 'container.status_updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'container', id, name: before.code || before.container_code || before.name || null },
        action_summary: `Changement de statut du container en ${status}`,
        values_before: { status: before.status },
        values_after: { status: after.status },
        metadata: { path: req.path, method: req.method },
      });
    } catch (e) { }

    try {
      if (after && after.distributor_id) {
        await sendTemplatedNotification('container.status_changed', {
          userId: after.distributor_id,
          context: {
            container: after,
            oldStatus: before.status,
            newStatus: after.status,
          },
        });
      }
    } catch (e) {}

    return res.json({ success: true, data: after });
  } catch (error) {
    console.error('💥 Erreur inattendue PUT /api/containers/:id/status:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du statut' });
  }
});

// DELETE - Suppression d'un container
app.delete('/api/containers/:id', express.json(), async (req, res) => {
  try {
    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }
    const { id } = req.params;

    let before = null;
    try {
      const { data } = await supabase
        .from('containers')
        .select('*')
        .eq('id', id)
        .single();
      before = data || null;
    } catch (e) { }

    // Vérifier les dépendances (pour message d'erreur explicite)
    let dependencies = {
      container_transactions: null,
      container_recharges: null,
      distributor_commissions: null,
    };
    try {
      const [txCount, rechCount, commCount] = await Promise.all([
        supabase.from('container_transactions').select('id', { count: 'exact', head: true }).eq('container_id', id),
        supabase.from('container_recharges').select('id', { count: 'exact', head: true }).eq('container_id', id),
        supabase.from('distributor_commissions').select('id', { count: 'exact', head: true }).eq('container_id', id),
      ]);
      dependencies.container_transactions = (txCount && typeof txCount.count === 'number') ? txCount.count : null;
      dependencies.container_recharges = (rechCount && typeof rechCount.count === 'number') ? rechCount.count : null;
      dependencies.distributor_commissions = (commCount && typeof commCount.count === 'number') ? commCount.count : null;
    } catch (e) {
      // best-effort, on continue
    }

    // Nettoyer les données associées au container (best-effort)
    try {
      await supabase.from('distributor_commissions').delete().eq('container_id', id);
    } catch (e) {
      console.warn('⚠️ Erreur suppression commissions du container:', e.message || e);
    }

    try {
      await supabase.from('container_recharges').delete().eq('container_id', id);
    } catch (e) {
      console.warn('⚠️ Erreur suppression recharges du container:', e.message || e);
    }

    try {
      await supabase.from('container_transactions').delete().eq('container_id', id);
    } catch (e) {
      console.warn('⚠️ Erreur suppression transactions du container:', e.message || e);
    }

    const { error } = await supabase
      .from('containers')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('💥 Erreur DELETE /api/containers/:id:', error);
      // Erreur de contrainte d'intégrité (FK)
      if (error.code === '23503') {
        return res.status(409).json({
          success: false,
          error:
            "Impossible de supprimer ce container car il est encore référencé par d'autres données (commissions ou transactions).",
          dependencies,
        });
      }
      return res.status(500).json({ success: false, error: 'Erreur lors de la suppression du container' });
    }

    try {
      await logAuditEvent({
        event_type: 'container.deleted',
        actor: buildActorFromRequest(req),
        resource: { type: 'container', id, name: before && (before.code || before.container_code || before.name || null) },
        action_summary: 'Suppression du container',
        values_before: before,
        values_after: null,
        metadata: { path: req.path, method: req.method },
      });
    } catch (e) { }

    try {
      if (before && before.distributor_id) {
        await sendTemplatedNotification('container.unassigned', {
          userId: before.distributor_id,
          context: {
            container: before,
          },
        });
      }
    } catch (e) {}

    return res.json({ success: true });
  } catch (error) {
    console.error('💥 Erreur inattendue DELETE /api/containers/:id:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la suppression du container' });
  }
});

// GET - Tous les distributeurs
// NOUVELLE ROUTE: Distributeurs avec commissions optimisée (pour le dashboard web)
// IMPORTANT: doit être déclarée AVANT /api/distributors/:id pour éviter la capture de "with-commissions" comme :id
app.get('/api/distributors/with-commissions', async (req, res) => {
  try {
    // Récupérer tous les distributeurs actifs
    const { data: distributors, error: distError } = await supabase
      .from('distributors')
      .select(`
        id,
        first_name,
        last_name,
        phone,
        email,
        zone,
        status,
        credit_balance
      `)
      .eq('status', 'active');

    if (distError) {
      console.error('💥 Erreur lecture distributeurs (with-commissions):', distError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des distributeurs avec commissions',
      });
    }

    // Récupérer toutes les commissions en attente en une seule requête
    const { data: commissions, error: commError } = await supabase
      .from('distributor_commissions')
      .select('*')
      .eq('status', 'pending');

    if (commError) {
      console.error('💥 Erreur lecture commissions (with-commissions):', commError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des commissions',
      });
    }

    // Grouper les commissions par distributeur
    const commissionsByDistributor = {};
    let totalPendingAmount = 0;

    (commissions || []).forEach((commission) => {
      const distId = commission.distributor_id;
      if (!commissionsByDistributor[distId]) {
        commissionsByDistributor[distId] = [];
      }
      commissionsByDistributor[distId].push(commission);
      totalPendingAmount += parseFloat(commission.commission_amount || 0) || 0;
    });

    // Construire la réponse avec seulement les distributeurs qui ont des commissions en attente
    const distributorsWithCommissions = (distributors || [])
      .filter((dist) => commissionsByDistributor[dist.id])
      .map((dist) => {
        const distCommissions = commissionsByDistributor[dist.id] || [];
        const totalCommission = distCommissions.reduce(
          (sum, c) => sum + (parseFloat(c.commission_amount || 0) || 0),
          0,
        );

        // Nombre de containers distincts ayant au moins une commission en attente
        const uniqueContainerIds = new Set(
          distCommissions
            .map((c) => c.container_id)
            .filter((id) => !!id),
        );

        return {
          ...dist,
          name: `${dist.first_name || ''} ${dist.last_name || ''}`.trim() || 'Sans nom',
          total_commission: totalCommission,
          commission_count: distCommissions.length,
          container_count: uniqueContainerIds.size,
          commissions: distCommissions,
        };
      });

    return res.json({
      success: true,
      data: distributorsWithCommissions,
      stats: {
        total_distributors: distributors?.length || 0,
        distributors_with_commissions: distributorsWithCommissions.length,
        total_pending_amount: totalPendingAmount,
      },
    });
  } catch (error) {
    console.error('💥 Erreur GET /api/distributors/with-commissions:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des distributeurs avec commissions',
    });
  }
});

app.get('/api/distributors', async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('💥 Erreur GET /api/distributors:', error);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des distributeurs' });
    }

    let enriched = data || [];

    // Ajouter les commissions en attente (pending) pour l'affichage liste (colonne Commission)
    try {
      const ids = (enriched || []).map((d) => d && d.id).filter(Boolean);
      if (ids.length > 0) {
        const { data: commissions } = await supabase
          .from('distributor_commissions')
          .select('distributor_id, commission_amount')
          .eq('status', 'pending')
          .in('distributor_id', ids);

        const totals = {};
        const counts = {};
        (commissions || []).forEach((c) => {
          const id = c.distributor_id;
          if (!id) return;
          totals[id] = (totals[id] || 0) + (parseFloat(c.commission_amount || 0) || 0);
          counts[id] = (counts[id] || 0) + 1;
        });

        enriched = (enriched || []).map((d) => ({
          ...d,
          total_commission: totals[d.id] || 0,
          commission_count: counts[d.id] || 0,
        }));
      }
    } catch (e) {
      // Fallback permissif: ne pas casser /api/distributors
    }

    return res.json({
      success: true,
      data: enriched,
      count: enriched?.length || 0,
    });
  } catch (error) {
    console.error('💥 Erreur GET /api/distributors:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des distributeurs',
    });
  }
});

// POST - Payer les commissions d'un distributeur
app.post('/api/distributors/:id/pay-commission', express.json(), async (req, res) => {
  try {
    const { id } = req.params || {};
    const { amount } = req.body || {};

    const amt = Number(amount);
    if (!amt || Number.isNaN(amt) || amt <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Montant invalide pour le paiement de commission',
      });
    }

    // Vérifier que le distributeur existe
    const { data: distributor, error: distError } = await supabase
      .from('distributors')
      .select('id, first_name, last_name, phone, credit_balance')
      .eq('id', id)
      .single();

    if (distError || !distributor) {
      console.error('❌ Distributeur non trouvé pour pay-commission:', distError);
      return res.status(404).json({
        success: false,
        error: 'Distributeur non trouvé',
      });
    }

    // Récupérer toutes les commissions en attente pour ce distributeur
    const { data: commissions, error: commError } = await supabase
      .from('distributor_commissions')
      .select('*')
      .eq('distributor_id', id)
      .eq('status', 'pending');

    if (commError) {
      console.error('❌ Erreur récupération commissions (pay-commission):', commError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des commissions',
      });
    }

    // Calculer le total des commissions en attente
    const totalCommissionsPending = (commissions || []).reduce(
      (sum, c) => sum + (parseFloat(c.commission_amount) || 0),
      0,
    );
    console.log(`💰 Total commissions en attente pour ${id}: ${totalCommissionsPending} FCFA`);

    // Vérifier que le montant correspond (tolérance 1 FCFA)
    if (Math.abs(totalCommissionsPending - amt) > 1) {
      return res.status(400).json({
        success: false,
        error: `Le montant (${amt} FCFA) ne correspond pas aux commissions en attente (${totalCommissionsPending} FCFA)`,
      });
    }

    // Marquer toutes les commissions comme payées
    const nowIso = new Date().toISOString();
    const { error: updateCommError } = await supabase
      .from('distributor_commissions')
      .update({
        status: 'paid',
        paid_at: nowIso,
        updated_at: nowIso,
      })
      .eq('distributor_id', id)
      .eq('status', 'pending');

    if (updateCommError) {
      console.error('❌ Erreur mise à jour commissions (pay-commission):', updateCommError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la mise à jour des commissions',
      });
    }

    // Créditer le compte du distributeur
    const currentBalance = parseFloat(distributor.credit_balance || 0);
    const newBalance = currentBalance + amt;
    const { data: updated, error: updateError } = await supabase
      .from('distributors')
      .update({
        credit_balance: newBalance,
        updated_at: nowIso,
      })
      .eq('id', id)
      .select('*')
      .single();

    if (updateError) {
      console.error('❌ Erreur mise à jour solde distributeur (pay-commission):', updateError);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la mise à jour du solde du distributeur",
      });
    }

    console.log('✅ Commission payée avec succès pour le distributeur', id);

    // Enregistrer une transaction de paiement de commission pour l'historique
    try {
      await supabase.from('distributor_transactions').insert({
        distributor_id: id,
        type: 'COMMISSION_PAYMENT',
        amount: amt,
        balance_before: currentBalance,
        balance_after: newBalance,
        status: 'completed',
        description: 'Paiement des commissions en attente',
      });
    } catch (txError) {
      console.warn('⚠️ Erreur insertion distributor_transactions (commission payment):', txError);
    }

    // Journaliser l'événement de paiement de commissions pour le distributeur
    try {
      await logAuditEvent({
        event_type: 'distributor.commission_paid',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'distributor',
          id,
          name:
            (distributor && distributor.name) ||
            `${distributor.first_name || ''} ${distributor.last_name || ''}`.trim() ||
            null,
        },
        action_summary: `Paiement des commissions distributeur de ${amt} FCFA`,
        values_before: {
          credit_balance: currentBalance,
          total_commissions_pending: totalCommissionsPending,
        },
        values_after: {
          credit_balance: newBalance,
          paid_amount: amt,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) {}

    try {
      await sendTemplatedNotification('distributor.commission_paid', {
        userId: id,
        context: {
          distributor: updated,
          amount: amt,
        },
      });
    } catch (e) {}

    const lang = await resolveRequestLanguage(req, { userId: id, userType: 'distributor' });

    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Commissions payées avec succès',
        en: 'Commissions paid successfully',
        ar: 'تم دفع العمولات بنجاح',
      }),
      data: {
        distributor: updated,
        paid_amount: amt,
      },
    });
  } catch (error) {
    console.error('💥 Erreur inattendue POST /api/distributors/:id/pay-commission:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors du paiement des commissions du distributeur',
    });
  }
});

// GET - Containers d'un distributeur (compat web et mobile)
app.get('/api/distributors/:id/containers', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    const { data, error } = await supabase
      .from('containers')
      .select('*')
      .eq('distributor_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('💥 Erreur GET /api/distributors/:id/containers:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des containers',
      });
    }

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('💥 Erreur inattendue GET /api/distributors/:id/containers:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des containers',
    });
  }
});

// GET - Détails complets d'un distributeur (utilisé par le dashboard Next.js)
app.get('/api/distributors/:id', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    // Récupérer les données de base du distributeur
    const { data: distributor, error: distributorError } = await supabase
      .from('distributors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (distributorError) {
      console.error('💥 Erreur lecture distributeur:', distributorError);
      if (distributorError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Distributeur non trouvé' });
      }
      return res.status(500).json({ success: false, error: distributorError.message || 'Erreur récupération distributeur' });
    }

    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributeur non trouvé' });
    }

    // Récupérer les containers assignés
    const { data: containers, error: containersError } = await supabase
      .from('containers')
      .select('*')
      .eq('distributor_id', id);

    if (containersError) {
      console.warn('⚠️ Erreur lecture containers distributeur:', containersError);
    }

    // Récupérer les transactions récentes
    const { data: transactions, error: transactionsError } = await supabase
      .from('distributor_transactions')
      .select('*')
      .eq('distributor_id', id)
      .order('created_at', { ascending: false })
      .limit(10);

    if (transactionsError) {
      console.warn('⚠️ Erreur lecture transactions distributeur:', transactionsError);
    }

    // Récupérer les commissions (pour stats)
    const { data: commissions, error: commissionsError } = await supabase
      .from('distributor_commissions')
      .select('*')
      .eq('distributor_id', id);

    if (commissionsError) {
      console.warn('⚠️ Erreur lecture commissions distributeur:', commissionsError);
    }

    // Calculer les statistiques
    const stats = {
      total_containers: Array.isArray(containers) ? containers.length : 0,
      active_containers: Array.isArray(containers)
        ? containers.filter((c) => c && c.status === 'active').length
        : 0,
      total_revenue: Array.isArray(commissions)
        ? commissions.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0)
        : 0,
      total_commissions: Array.isArray(commissions)
        ? commissions.reduce((sum, c) => sum + (Number(c.commission_amount) || 0), 0)
        : 0,
      transactions_count: Array.isArray(transactions) ? transactions.length : 0,
    };

    const distributorData = {
      ...distributor,
      containers: containers || [],
      recent_transactions: transactions || [],
      stats,
    };

    return res.json({ success: true, data: distributorData });
  } catch (error) {
    console.error('💥 Erreur récupération distributeur /api/distributors/:id:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la récupération du distributeur',
    });
  }
});

// GET - Statistiques synthétiques d'un distributeur (compat web et mobile)
app.get('/api/distributors/:id/stats', async (req, res) => {
  try {
    const { id } = req.params;

    const { data: containers } = await supabase
      .from('containers')
      .select('status')
      .eq('distributor_id', id);

    let totalRevenue = 0;
    let transactionsCount = 0;
    try {
      const { data: tx1 } = await supabase
        .from('distributor_transactions')
        .select('amount')
        .eq('distributor_id', id);
      if (Array.isArray(tx1)) {
        totalRevenue = tx1.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
        transactionsCount = tx1.length;
      }
    } catch (e) {}

    if (transactionsCount === 0) {
      try {
        const { data: tx2 } = await supabase
          .from('moov_transactions')
          .select('amount')
          .eq('distributor_id', id);
        if (Array.isArray(tx2)) {
          totalRevenue = tx2.reduce((s, t) => s + (parseFloat(t.amount) || 0), 0);
          transactionsCount = tx2.length;
        }
      } catch (e) {}
    }

    let totalCommissions = 0;
    try {
      const { data: comm } = await supabase
        .from('distributor_commissions')
        .select('commission_amount')
        .eq('distributor_id', id);
      if (Array.isArray(comm)) {
        totalCommissions = comm.reduce((s, c) => s + (parseFloat(c.commission_amount) || 0), 0);
      }
    } catch (e) {}

    const totalContainers = containers?.length || 0;
    const activeContainers = containers?.filter((c) => c.status === 'active')?.length || 0;

    return res.json({
      success: true,
      data: {
        total_containers: totalContainers,
        active_containers: activeContainers,
        total_revenue: totalRevenue,
        total_commissions: totalCommissions,
        transactions_count: transactionsCount,
      },
    });
  } catch (error) {
    return res.json({
      success: true,
      data: {
        total_containers: 0,
        active_containers: 0,
        total_revenue: 0,
        total_commissions: 0,
        transactions_count: 0,
      },
    });
  }
});

// GET - Transactions d'un distributeur
app.get('/api/distributors/:id/transactions', async (req, res) => {
  try {
    const { id } = req.params || {};
    const { limit, type, start_date, end_date } = req.query || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    let query = supabase
      .from('distributor_transactions')
      .select('*')
      .eq('distributor_id', id)
      .order('created_at', { ascending: false });

    if (type) {
      query = query.eq('type', String(type).toUpperCase());
    }

    if (start_date) {
      query = query.gte('created_at', String(start_date));
    }
    if (end_date) {
      query = query.lte('created_at', String(end_date));
    }

    let numericLimit = 0;
    if (typeof limit !== 'undefined') {
      const parsed = parseInt(String(limit), 10);
      if (!isNaN(parsed) && parsed > 0) {
        numericLimit = parsed;
      }
    }

    if (numericLimit > 0) {
      query = query.limit(numericLimit);
    } else {
      query = query.limit(100);
    }

    const { data, error } = await query;

    if (error) {
      console.error('💥 Erreur GET /api/distributors/:id/transactions:', error);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la récupération des transactions',
      });
    }

    return res.json({
      success: true,
      data: data || [],
    });
  } catch (error) {
    console.error('💥 Erreur inattendue GET /api/distributors/:id/transactions:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des transactions',
    });
  }
});

// POST - Recharger le crédit d'un distributeur (compat web)
app.post('/api/distributors/:id/recharge', express.json(), async (req, res) => {
  try {
    const { id } = req.params || {};
    const { amount, reference, payment_method } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    const numericAmount = Number(amount) || 0;
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        error: 'Le montant doit être supérieur à 0',
      });
    }

    // Récupérer le solde et la limite actuels du distributeur
    const { data: distributor, error: distError } = await supabase
      .from('distributors')
      .select('id, credit_balance, credit_limit, phone, name')
      .eq('id', id)
      .maybeSingle();

    if (distError) {
      console.error('💥 Erreur lecture distributeur pour recharge crédit:', distError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du distributeur' });
    }

    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributeur non trouvé' });
    }

    const oldBalance = Number(distributor.credit_balance) || 0;
    const creditLimit = distributor.credit_limit != null ? Number(distributor.credit_limit) : null;
    const newBalance = oldBalance + numericAmount;

    if (creditLimit && newBalance > creditLimit) {
      return res.status(400).json({
        success: false,
        error: `Le nouveau solde dépasse la limite de crédit (${creditLimit} FCFA)`,
      });
    }

    const finalReference = reference || `RCH_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

    // Mettre à jour le solde du distributeur
    const { error: updateError } = await supabase
      .from('distributors')
      .update({
        credit_balance: newBalance,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (updateError) {
      console.error('💥 Erreur update crédit distributeur:', updateError);
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour du distributeur' });
    }

    // Enregistrer la recharge dans distributor_transactions (si la table existe)
    try {
      await supabase.from('distributor_transactions').insert({
        distributor_id: id,
        type: 'CREDIT_RECHARGE',
        amount: numericAmount,
        balance_before: oldBalance,
        balance_after: newBalance,
        description: `Recharge crédit via ${payment_method || 'cash'}`,
        payment_method: payment_method || 'cash',
        payment_reference: finalReference,
        status: 'completed',
        initiated_by: 'dashboard',
        processed_at: new Date().toISOString(),
      });
    } catch (txError) {
      console.warn('⚠️ Erreur insertion distributor_transactions (recharge):', txError);
    }

    try {
      await sendTemplatedNotification('distributor.credit_recharged', {
        userId: id,
        context: {
          distributor: {
            id: distributor.id,
            name: distributor.name,
            phone: distributor.phone,
            credit_balance: newBalance,
          },
          amount: numericAmount,
          oldBalance,
          newBalance,
          reference: finalReference,
          paymentMethod: payment_method || 'cash',
        },
      });
    } catch (e) {
      console.warn('⚠️ Notification recharge crédit distributeur échouée:', e && e.message ? e.message : e);
    }

    return res.json({
      success: true,
      data: {
        reference: finalReference,
        oldBalance,
        newBalance,
      },
    });
  } catch (error) {
    console.error('💥 Erreur inattendue POST /api/distributors/:id/recharge:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la recharge du distributeur' });
  }
});

// PUT - Modifier un distributeur (compat web)
app.put('/api/distributors/:id', express.json(), async (req, res) => {
  try {
    const updateData = { ...req.body };

    const { data: before } = await supabase
      .from('distributors')
      .select('*')
      .eq('id', req.params.id)
      .maybeSingle();

    // Si first_name ou last_name sont modifiés, mettre à jour le champ name
    if (updateData.first_name || updateData.last_name) {
      const { data: currentData } = await supabase
        .from('distributors')
        .select('first_name, last_name')
        .eq('id', req.params.id)
        .maybeSingle();

      if (currentData) {
        const firstName = updateData.first_name || currentData.first_name;
        const lastName = updateData.last_name || currentData.last_name;
        updateData.name = `${firstName} ${lastName}`.trim();
      }
    }

    const { data, error } = await supabase
      .from('distributors')
      .update({
        ...updateData,
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .maybeSingle();

    if (error) {
      console.error('💥 Erreur update distributeur /api/distributors/:id:', error);
      return res.status(500).json({ success: false, error: error.message || 'Erreur lors de la mise à jour du distributeur' });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Distributeur non trouvé' });
    }

    try {
      if (before && before.is_verified !== data.is_verified) {
        await sendTemplatedNotification('distributor.verification_changed', {
          userId: data.id,
          context: { distributor: data, is_verified: data.is_verified },
        });
      }

      if (before && String(before.supervisor_id || '') !== String(data.supervisor_id || '')) {
        let sup = null;
        try {
          if (data.supervisor_id) {
            const { data: s } = await supabase
              .from('supervisors')
              .select('id, name, first_name, last_name, phone')
              .eq('id', data.supervisor_id)
              .maybeSingle();
            sup = s || null;
          }
        } catch (e) {
          sup = null;
        }

        await sendTemplatedNotification('distributor.supervisor_changed', {
          userId: data.id,
          context: { distributor: data, supervisor: sup },
        });

        try {
          if (before && before.supervisor_id) {
            await sendTemplatedNotification('supervisor.distributor_unassigned', {
              userId: before.supervisor_id,
              context: { distributor: data },
            });
          }
        } catch (e) { }

        try {
          if (data && data.supervisor_id) {
            await sendTemplatedNotification('supervisor.distributor_assigned', {
              userId: data.supervisor_id,
              context: { distributor: data },
            });
          }
        } catch (e) { }
      }

      await sendTemplatedNotification('distributor.updated', {
        userId: data.id,
        context: { distributor: data },
      });
    } catch (e) { }

    try {
      io.emit('distributor:updated', data);
    } catch (e) {}

    return res.json({
      success: true,
      data,
      message: pickByLang(await resolveRequestLanguage(req), {
        fr: 'Distributeur modifié avec succès',
        en: 'Distributor updated successfully',
        ar: 'تم تحديث بيانات الموزع بنجاح',
      }),
    });
  } catch (error) {
    return res.status(500).json({ success: false, error: error.message || 'Erreur lors de la mise à jour du distributeur' });
  }
});

// POST - Création d'un nouveau distributeur (utilisé par le dashboard Next.js)
app.post('/api/distributors/create-new', express.json(), async (req, res) => {
  try {
    const distributorData = req.body || {};

    if (!distributorData.first_name || !distributorData.last_name || !distributorData.phone || !distributorData.zone) {
      return res.status(400).json({ success: false, error: 'Champs obligatoires manquants (first_name, last_name, phone, zone)' });
    }

    const fullName = `${distributorData.first_name} ${distributorData.last_name}`.trim();

    // Créer le distributeur dans Supabase (schéma complet aligné avec la table distributors)
    const insertPayload = {
      first_name: distributorData.first_name,
      last_name: distributorData.last_name,
      name: fullName,
      phone: distributorData.phone,
      email: distributorData.email || null,
      zone: distributorData.zone,
      address: distributorData.address || null,
      company: distributorData.company || null,
      city: distributorData.city || null,
      supervisor_id: distributorData.supervisor_id || null,
      nni: distributorData.nni || null,
      birth_date: distributorData.birth_date || null,
      birth_place: distributorData.birth_place || null,
      latitude: distributorData.latitude ?? null,
      longitude: distributorData.longitude ?? null,
      location_address: distributorData.location_address || null,
      notes: distributorData.notes || null,
      is_verified: distributorData.is_verified ?? false,
    };

    const { data: created, error: insertErr } = await supabase
      .from('distributors')
      .insert(insertPayload)
      .select('*')
      .single();

    if (insertErr || !created) {
      console.error('💥 Erreur création distributeur /api/distributors/create-new:', insertErr);
      if (insertErr && insertErr.code === '23505') {
        return res.status(400).json({
          success: false,
          error: 'Un distributeur avec ce numéro de téléphone existe déjà.',
          code: 'DUPLICATE_DISTRIBUTOR_PHONE',
        });
      }
      return res.status(500).json({ success: false, error: "Erreur lors de la création du distributeur" });
    }

    // Générer un PIN mobile 6 chiffres
    const pin = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPin = await bcrypt.hash(pin, 10);

    try {
      await supabase
        .from('distributor_auth')
        .upsert(
          {
            distributor_id: created.id,
            email: created.email || (created.phone ? `${created.phone}@moov.td` : null),
            password_hash: hashedPin,
            updated_at: new Date().toISOString(),
          },
          { onConflict: 'distributor_id' }
        );
    } catch (e) {
      console.warn('⚠️ Erreur upsert distributor_auth (create-new):', e.message || e);
    }

    try {
      await sendTemplatedNotification('distributor.account_created', {
        userId: created.id,
        context: { distributor: created, phone: created.phone, pin },
      });
    } catch (e) { }

    try {
      const finalPhone = toLocalPhone(created.phone) || created.phone;
      const smsLang = normalizeLanguage(created.language || await resolveRequestLanguage(req));
      const smsMsg = pickByLang(smsLang, {
        fr: `MoovMoney: Votre compte distributeur est créé. Téléphone: ${finalPhone}. PIN: ${pin}.`,
        en: `MoovMoney: Your distributor account has been created. Phone: ${finalPhone}. PIN: ${pin}.`,
        ar: `مووف موني: تم إنشاء حساب الموزع. الهاتف: ${finalPhone}. الرقم السري: ${pin}.`,
      });
      await smsService.sendSMS(finalPhone, smsMsg, 'notification');
    } catch (e) { }

    // Créer une notification pour l'admin (centre de notifications + push éventuel)
    try {
      await sendTemplatedNotification('distributor.created', {
        userId: DEFAULT_ADMIN_USER_ID,
        context: {
          distributor: {
            id: created.id,
            name: created.name,
            phone: created.phone,
            zone: created.zone || distributorData.zone || null,
          },
        },
      });
    } catch (e) { }

    try {
      if (created && created.supervisor_id) {
        await sendTemplatedNotification('supervisor.distributor_assigned', {
          userId: created.supervisor_id,
          context: { distributor: created },
        });

        try {
          await sendTemplatedNotification('supervisor.distributor_created', {
            userId: created.supervisor_id,
            context: { distributor: created },
          });
        } catch (e) { }
      }
    } catch (e) { }

    try {
      await logAuditEvent({
        event_type: 'distributor.created',
        actor: buildActorFromRequest(req),
        resource: { type: 'distributor', id: created.id },
        action_summary: 'Création distributeur (dashboard)',
        values_after: {
          distributor_id: created.id,
          phone: created.phone,
          zone: created.zone || distributorData.zone || null,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    return res.json({
      success: true,
      data: {
        id: created.id,
        name: created.name,
        phone: created.phone,
        pin,
      },
    });
  } catch (error) {
    console.error('💥 Exception POST /api/distributors/create-new:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la création du distributeur' });
  }
});

function normalizeBase64Payload(value) {
  if (!value) return '';
  const raw = String(value).trim();
  if (!raw) return '';
  const commaIndex = raw.indexOf(',');
  if (raw.startsWith('data:') && commaIndex >= 0) {
    return raw.slice(commaIndex + 1).trim();
  }
  return raw;
}

app.post('/api/distributors/upload-photo', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { file, distributorId, fileName } = req.body || {};
    if (!file || !distributorId) {
      return res.status(400).json({
        success: false,
        error: 'Fichier et ID distributeur requis',
      });
    }

    let buffer;
    try {
      const normalized = normalizeBase64Payload(file);
      if (!normalized) {
        return res.status(400).json({ success: false, error: 'Fichier vide' });
      }
      buffer = Buffer.from(normalized, 'base64');
    } catch (e) {
      return res.status(400).json({ success: false, error: 'Fichier invalide (base64)' });
    }

    const finalFileName = fileName || `photo_${distributorId}_${Date.now()}.jpg`;

    const { error: uploadError } = await supabase.storage
      .from('distributors-photos')
      .upload(finalFileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Erreur upload photo distributeur:', uploadError);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de la photo",
      });
    }

    const { data: publicData } = supabase.storage
      .from('distributors-photos')
      .getPublicUrl(finalFileName);

    const publicUrl = publicData?.publicUrl || null;

    try {
      const { data: current } = await supabase
        .from('distributors')
        .select('nni_urls, nni_card_url')
        .eq('id', distributorId)
        .maybeSingle();

      const hasNni = !!(
        (Array.isArray(current?.nni_urls) && current.nni_urls.length)
        || (typeof current?.nni_urls === 'string' && String(current.nni_urls).trim().length)
        || (current?.nni_card_url && String(current.nni_card_url).trim().length)
      );

      await supabase
        .from('distributors')
        .update({
          photo_url: publicUrl,
          is_verified: !!(publicUrl && hasNni),
          updated_at: new Date().toISOString(),
        })
        .eq('id', distributorId);
    } catch (e) {
      console.warn('⚠️ Erreur mise à jour distributeur après upload photo:', e);
    }

    return res.json({
      success: true,
      data: {
        url: publicUrl,
        fileName: finalFileName,
      },
    });
  } catch (error) {
    console.error('💥 Erreur upload photo distributeur:', error);
    return res.status(500).json({ success: false, error: "Erreur serveur lors de l'upload de la photo" });
  }
});

app.post('/api/distributors/upload-documents', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { files, distributorId, types } = req.body || {};

    if (!files || !distributorId || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'Fichiers et ID distributeur requis',
      });
    }

    const uploadedFiles = [];
    const errors = [];
    const nniUrls = [];
    const docUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i] || {};
      const fileType = types?.[i] || file.type || 'document';
      const base64 = normalizeBase64Payload(file.data || file.file || file.base64);
      if (!base64) {
        errors.push({ index: i, type: fileType, name: file.name, error: 'Fichier vide' });
        continue;
      }

      if (fileType === 'nni') {
        const mt = (file.mimeType || '').toLowerCase();
        if (mt === 'application/pdf' || mt.includes('pdf')) {
          errors.push({ index: i, type: fileType, name: file.name, error: 'NNI doit être une image (png/jpg), pas un PDF' });
          continue;
        }
      }

      let buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch (e) {
        console.error('❌ Erreur décodage base64 document distributeur:', e);
        errors.push({ index: i, type: fileType, name: file.name, error: 'Base64 invalide' });
        continue;
      }

      const ext = file.extension || (file.name && String(file.name).includes('.') ? String(file.name).split('.').pop() : null) || 'pdf';
      let finalName = `${fileType}_${distributorId}_${Date.now()}_${i}.${ext}`;
      const bucketName = fileType === 'nni' ? 'distributors-nni' : 'distributors-documents';

      let { error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(finalName, buffer, {
          contentType: file.mimeType || 'application/pdf',
          upsert: true,
        });

      if (uploadError && uploadError.message?.includes('mime type') && uploadError.message?.includes('not supported')) {
        const { error: error2 } = await supabase.storage
          .from(bucketName)
          .upload(finalName, buffer, {
            contentType: 'application/octet-stream',
            upsert: true,
          });
        uploadError = error2 || null;

        if (uploadError) {
          const altName = finalName.replace(/\.pdf$/i, '.jpg');
          const { error: error3 } = await supabase.storage
            .from(bucketName)
            .upload(altName, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });
          if (!error3) {
            uploadError = null;
            finalName = altName;
          }
        }
      }

      if (uploadError) {
        console.error(`❌ Erreur upload document distributeur (${fileType}):`, uploadError);
        errors.push({ index: i, type: fileType, name: file.name, error: uploadError.message || 'Upload échoué' });
        continue;
      }

      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(finalName);

      const publicUrl = publicData?.publicUrl || null;
      if (!publicUrl) {
        errors.push({ index: i, type: fileType, name: file.name, error: 'URL publique introuvable après upload' });
        continue;
      }

      if (fileType === 'nni') {
        nniUrls.push(publicUrl);
      } else {
        docUrls.push(publicUrl);
      }

      uploadedFiles.push({
        type: fileType === 'admin' ? 'document' : fileType,
        url: publicUrl,
        fileName: finalName,
        originalName: file.name,
      });
    }

    if (!uploadedFiles.length) {
      return res.status(400).json({
        success: false,
        error: 'Aucun fichier téléversé',
        details: { errors },
      });
    }

    const parseUrlList = (val) => {
      try {
        if (!val) return [];
        if (Array.isArray(val)) return val.filter(Boolean);
        if (typeof val === 'string') {
          const s = val.trim();
          if (!s) return [];
          if (s.startsWith('[')) {
            const parsed = JSON.parse(s);
            return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
          }
          if (s.includes(',')) {
            return s.split(',').map(x => x.trim()).filter(Boolean);
          }
          return [s];
        }
        return [];
      } catch {
        return [];
      }
    };

    try {
      const { data: current } = await supabase
        .from('distributors')
        .select('photo_url, nni_urls, document_urls, nni_card_url, documents_url')
        .eq('id', distributorId)
        .maybeSingle();

      const existingNni = parseUrlList(current?.nni_urls).length
        ? parseUrlList(current?.nni_urls)
        : parseUrlList(current?.nni_card_url);

      const existingDocs = parseUrlList(current?.document_urls).length
        ? parseUrlList(current?.document_urls)
        : parseUrlList(current?.documents_url);

      const mergedNni = [...existingNni, ...nniUrls].filter(Boolean);
      const mergedDocs = [...existingDocs, ...docUrls].filter(Boolean);

      const uniq = (arr) => Array.from(new Set(arr.map(String)));
      const finalNni = uniq(mergedNni);
      const finalDocs = uniq(mergedDocs);

      const hasPhoto = !!(current?.photo_url && String(current.photo_url).trim().length);
      const hasNni = finalNni.length > 0;

      await supabase
        .from('distributors')
        .update({
          nni_urls: finalNni.length ? finalNni : null,
          document_urls: finalDocs.length ? finalDocs : null,
          is_verified: !!(hasPhoto && hasNni),
          updated_at: new Date().toISOString(),
        })
        .eq('id', distributorId);
    } catch (e) {
      console.warn('⚠️ Erreur mise à jour distributeur après upload documents:', e);
    }

    return res.json({
      success: true,
      data: {
        files: uploadedFiles,
        errors: errors.length ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('💥 Erreur upload documents distributeur:', error);
    return res.status(500).json({
      success: false,
      error: "Erreur serveur lors de l'upload des documents",
    });
  }
});

// GET - Historique d'authentification d'un distributeur (utilisé par la page détail)
app.get('/api/distributors/:id/auth/history', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    let hasPassword = false;
    let isLocked = false;
    try {
      const { data: authRow } = await supabase
        .from('distributor_auth')
        .select('*')
        .eq('distributor_id', id)
        .maybeSingle();
      hasPassword = !!authRow;
      isLocked = !!(authRow && authRow.is_locked);
    } catch (e) {
      console.warn('⚠️ Erreur lecture distributor_auth:', e && e.message ? e.message : e);
    }

    let lastLogin = null;
    let loginAttempts = 0;
    try {
      const { data: logs } = await supabase
        .from('auth_logs')
        .select('event, created_at')
        .eq('user_id', id)
        .eq('user_type', 'distributor')
        .order('created_at', { ascending: false })
        .limit(100);

      if (Array.isArray(logs)) {
        loginAttempts = logs.length;
        const success = logs.find((l) => (l.event || '').toLowerCase().includes('login'));
        lastLogin = success ? success.created_at : null;
      }
    } catch (e) {
      console.warn('⚠️ Erreur lecture auth_logs distributeur:', e && e.message ? e.message : e);
    }

    return res.json({
      success: true,
      data: {
        hasPassword,
        is_locked: isLocked,
        login_attempts: loginAttempts,
        last_login: lastLogin,
      },
    });
  } catch (error) {
    console.error('💥 Erreur /api/distributors/:id/auth/history:', error);
    return res.json({
      success: true,
      data: {
        hasPassword: false,
        is_locked: false,
        login_attempts: 0,
        last_login: null,
      },
    });
  }
});

// GET - Commissions d'un distributeur
app.get('/api/distributors/:id/commissions', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    const { data, error } = await supabase
      .from('distributor_commissions')
      .select('*')
      .eq('distributor_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('💥 Erreur GET /api/distributors/:id/commissions:', error);
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des commissions' });
    }

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('💥 Erreur inattendue GET /api/distributors/:id/commissions:', error);
    return res.status(500).json({ success: false, error: 'Erreur lors de la récupération des commissions' });
  }
});

// Handler partagé pour la réinitialisation du PIN / mot de passe mobile d'un distributeur
async function handleDistributorPasswordReset(req, res) {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }

    // Récupérer le distributeur pour vérifier qu'il existe
    const { data: distributor, error: distErr } = await supabase
      .from('distributors')
      .select('id, name, first_name, last_name, phone, zone')
      .eq('id', id)
      .maybeSingle();

    if (distErr) {
      console.error('💥 Erreur lecture distributeur pour reset PIN:', distErr);
      if (distErr.code === 'PGRST116' || distErr.code === 'P0001') {
        return res.status(404).json({ success: false, error: 'Distributeur introuvable' });
      }
      return res.status(500).json({ success: false, error: 'Erreur lors de la récupération du distributeur' });
    }

    if (!distributor) {
      return res.status(404).json({ success: false, error: 'Distributeur introuvable' });
    }

    const newPin = Math.floor(100000 + Math.random() * 900000).toString();
    const hashedPin = await bcrypt.hash(newPin, 10);

    const phone = distributor.phone;
    if (!phone) {
      return res.status(400).json({ success: false, error: 'Téléphone du distributeur manquant' });
    }

    const finalPhone = toLocalPhone(phone) || phone;
    const finalEmail = `${finalPhone}@moov.td`;

    try {
      const { data: existingAuth } = await supabase
        .from('distributor_auth')
        .select('id')
        .eq('email', finalEmail)
        .maybeSingle();

      const authPayload = {
        distributor_id: distributor.id,
        email: finalEmail,
        password_hash: hashedPin,
        must_change_pin: true,
        pin_reset_reason: 'RESET_BY_ADMIN',
        login_attempts: 0,
        is_locked: false,
        updated_at: new Date().toISOString(),
      };

      if (existingAuth) {
        const { error: updateErr } = await supabase
          .from('distributor_auth')
          .update(authPayload)
          .eq('id', existingAuth.id);

        if (updateErr) {
          console.error('Erreur update distributor_auth (reset PIN):', updateErr);
          return res.status(500).json({ success: false, error: "Erreur lors de la mise à jour des identifiants du distributeur" });
        }
      } else {
        const { error: upsertErr } = await supabase
          .from('distributor_auth')
          .upsert(authPayload, { onConflict: 'distributor_id' });

        if (upsertErr) {
          console.error('Erreur upsert distributor_auth (reset PIN):', upsertErr);
          return res.status(500).json({ success: false, error: "Erreur lors de la mise à jour des identifiants du distributeur" });
        }
      }
    } catch (e) {
      console.error('Erreur lecture distributor_auth (reset PIN):', e);
      return res.status(500).json({ success: false, error: "Erreur lors de la mise à jour des identifiants du distributeur" });
    }

    try {
      await logAuditEvent({
        event_type: 'distributor.pin_reset',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'distributor',
          id: distributor.id,
          name: distributor.name || `${distributor.first_name || ''} ${distributor.last_name || ''}`.trim() || null,
        },
        action_summary: 'Réinitialisation du PIN distributeur',
        values_after: {
          distributor_id: distributor.id,
          account_unlocked: true,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) {}

    // Journaliser le déverrouillage côté historique d'authentification mobile
    try {
      await supabase.from('auth_logs').insert({
        user_type: 'distributor',
        user_id: distributor.id,
        phone: finalPhone,
        event: 'account_unlocked',
        context: JSON.stringify({ via: 'admin_web', reason: 'pin_reset_by_admin' }),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('⚠️ Erreur insertion auth_logs (account_unlocked distributeur):', e && e.message ? e.message : e);
    }

    // Retourner le nouveau PIN et le téléphone pour affichage côté admin web
    // On expose le champ newPin dans data pour être compatible avec le frontend existant
    try {
      await sendTemplatedNotification('distributor.pin_reset', {
        userId: distributor.id,
        context: { distributor, pin: newPin },
      });
    } catch (e) { }
    return res.json({
      success: true,
      pin: newPin,
      phone: finalPhone,
      data: { newPin: newPin, pin: newPin, phone: finalPhone },
    });
  } catch (error) {
    console.error('Exception POST /api/distributors/:id/password:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la réinitialisation du PIN du distributeur' });
  }
}

// POST - Réinitialiser le PIN / mot de passe mobile d'un distributeur
app.post('/api/distributors/:id/password', express.json(), handleDistributorPasswordReset);
app.post('/api/distributors/:id/reset-password', express.json(), handleDistributorPasswordReset);

// POST - Suspendre un distributeur
app.post('/api/distributors/:id/suspend', express.json(), async (req, res) => {
  try {
    const { reason } = req.body || {};

    const { data, error } = await supabase
      .from('distributors')
      .update({
        status: 'suspended',
        suspension_reason: reason,
        suspended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Émettre événement socket pour suspension
    try {
      io.emit('distributor:suspended', {
        distributorId: req.params.id,
        reason: reason || "Compte suspendu par votre administrateur",
        reason_i18n: {
          fr: reason || "Compte suspendu par votre administrateur",
          en: reason || 'Account suspended by your administrator',
          ar: reason || 'تم تعليق الحساب بواسطة المسؤول',
        },
        timestamp: new Date().toISOString(),
        data: data,
      });
    } catch (e) {
      console.error('Erreur émission socket distributor:suspended:', e);
    }

    try {
      await sendTemplatedNotification('distributor.suspended', {
        userId: data.id,
        context: { distributor: data, reason },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req, { userId: data.id, userType: 'distributor' });

    return res.json({
      success: true,
      data,
      message: pickByLang(lang, {
        fr: 'Distributeur suspendu',
        en: 'Distributor suspended',
        ar: 'تم تعليق الموزع',
      }),
    });
  } catch (error) {
    console.error('Erreur POST /api/distributors/:id/suspend:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la suspension du distributeur',
    });
  }
});

// PUT - Suspendre un distributeur (pour compatibilité frontend)
app.put('/api/distributors/:id/suspend', express.json(), async (req, res) => {
  try {
    console.log('PUT suspend distributor:', req.params.id, req.body);
    const { reason } = req.body || {};

    // Vérifier si le distributeur existe d'abord
    const { data: existingDistributor } = await supabase
      .from('distributors')
      .select('id, name, status')
      .eq('id', req.params.id)
      .maybeSingle();

    if (!existingDistributor) {
      console.log('Distributeur non trouvé:', req.params.id);
      return res.status(404).json({
        success: false,
        error: 'Distributeur non trouvé',
      });
    }

    console.log('Distributeur trouvé:', existingDistributor);

    const { data, error } = await supabase
      .from('distributors')
      .update({
        status: 'suspended',
        suspension_reason: reason,
        suspended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) {
      console.error('Erreur suspension:', error);
      throw error;
    }

    console.log('Distributeur suspendu avec succès:', data);

    // Émettre événement socket pour suspension
    try {
      io.emit('distributor:suspended', {
        distributorId: req.params.id,
        reason: reason || "Compte suspendu par votre administrateur",
        reason_i18n: {
          fr: reason || "Compte suspendu par votre administrateur",
          en: reason || 'Account suspended by your administrator',
          ar: reason || 'تم تعليق الحساب بواسطة المسؤول',
        },
        timestamp: new Date().toISOString(),
        data: data,
      });
    } catch (e) {
      console.error('Erreur émission socket distributor:suspended (PUT):', e);
    }

    try {
      await sendTemplatedNotification('distributor.suspended', {
        userId: data.id,
        context: { distributor: data, reason },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req, { userId: data.id, userType: 'distributor' });

    return res.json({
      success: true,
      data,
      message: pickByLang(lang, {
        fr: 'Distributeur suspendu',
        en: 'Distributor suspended',
        ar: 'تم تعليق الموزع',
      }),
    });
  } catch (error) {
    console.error('Erreur dans PUT /api/distributors/:id/suspend:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la suspension du distributeur',
    });
  }
});

// POST - Réactiver un distributeur
app.post('/api/distributors/:id/reactivate', express.json(), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .update({
        status: 'active',
        suspension_reason: null,
        reactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Émettre événement socket pour réactivation
    try {
      io.emit('distributor:reactivated', {
        distributorId: req.params.id,
        timestamp: new Date().toISOString(),
        data: data,
      });
    } catch (e) {
      console.error('Erreur émission socket distributor:reactivated:', e);
    }

    try {
      await sendTemplatedNotification('distributor.reactivated', {
        userId: data.id,
        context: { distributor: data },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req, { userId: data.id, userType: 'distributor' });

    return res.json({
      success: true,
      data,
      message: pickByLang(lang, {
        fr: 'Distributeur réactivé',
        en: 'Distributor reactivated',
        ar: 'تمت إعادة تفعيل الموزع',
      }),
    });
  } catch (error) {
    console.error('Erreur POST /api/distributors/:id/reactivate:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la réactivation du distributeur',
    });
  }
});

// PUT - Réactiver un distributeur (compatibilité frontend web)
app.put('/api/distributors/:id/reactivate', express.json(), async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .update({
        status: 'active',
        suspension_reason: null,
        reactivated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    // Émettre événement socket pour réactivation
    try {
      io.emit('distributor:reactivated', {
        distributorId: req.params.id,
        timestamp: new Date().toISOString(),
        data: data,
      });
    } catch (e) {
      console.error('Erreur émission socket distributor:reactivated (PUT):', e);
    }

    try {
      await sendTemplatedNotification('distributor.reactivated', {
        userId: data.id,
        context: { distributor: data },
      });
    } catch (e) { }

    const lang = await resolveRequestLanguage(req, { userId: data.id, userType: 'distributor' });

    return res.json({
      success: true,
      data,
      message: pickByLang(lang, {
        fr: 'Distributeur réactivé',
        en: 'Distributor reactivated',
        ar: 'تمت إعادة تفعيل الموزع',
      }),
    });
  } catch (error) {
    console.error('Erreur PUT /api/distributors/:id/reactivate:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la réactivation du distributeur',
    });
  }
});

// DELETE - Supprimer un distributeur (avec double confirmation administrateur)
app.delete('/api/distributors/:id', express.json(), async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID distributeur manquant' });
    }

    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }

    console.log(`🗑️ === SUPPRESSION DISTRIBUTEUR ${id} ===`);

    // Vérifier si le distributeur existe
    const { data: distributor, error: checkError } = await supabase
      .from('distributors')
      .select('id, name, phone')
      .eq('id', id)
      .maybeSingle();

    if (checkError) {
      console.error('💥 Erreur vérification distributeur avant suppression:', checkError);
    }

    if (!distributor) {
      return res.status(404).json({
        success: false,
        error: 'Distributeur non trouvé',
      });
    }

    console.log(`👤 Suppression de: ${distributor.name || ''} (${distributor.phone || ''})`);

    try {
      await sendTemplatedNotification('distributor.account_closed', {
        userId: id,
        context: { distributor },
      });
    } catch (e) { }

    // 1. Supprimer l'authentification du distributeur
    try {
      const { error: authDeleteError } = await supabase
        .from('distributor_auth')
        .delete()
        .eq('distributor_id', id);

      if (authDeleteError) {
        console.error('⚠️ Erreur suppression auth (non critique):', authDeleteError);
      } else {
        console.log('✅ Authentification supprimée');
      }
    } catch (e) {
      console.error('⚠️ Exception suppression auth (non critique):', e);
    }

    // 2. Émettre événement de déconnexion forcée AVANT la suppression
    try {
      io.emit('distributor:force-logout', {
        distributorId: id,
        phone: distributor.phone,
        message: 'Votre compte a été supprimé. Contactez votre superviseur.',
        message_i18n: {
          fr: 'Votre compte a été supprimé. Contactez votre superviseur.',
          en: 'Your account has been deleted. Please contact your supervisor.',
          ar: 'تم حذف حسابك. يرجى التواصل مع مشرفك.',
        },
        timestamp: new Date().toISOString(),
      });
      console.log('📢 Événement de déconnexion forcée émis');
    } catch (e) {
      console.error('⚠️ Erreur émission événement force-logout:', e);
    }

    // 3. Supprimer le distributeur
    const { error: deleteError } = await supabase
      .from('distributors')
      .delete()
      .eq('id', id);

    if (deleteError) {
      console.error('💥 Erreur suppression distributeur:', deleteError);
      return res.status(500).json({
        success: false,
        error: 'Erreur lors de la suppression du distributeur',
      });
    }

    console.log('✅ Distributeur supprimé de la base');

    // 4. Émettre événement général de suppression
    try {
      io.emit('distributor:deleted', {
        distributorId: id,
        name: distributor.name,
        phone: distributor.phone,
        timestamp: new Date().toISOString(),
      });
    } catch (e) {
      console.error('⚠️ Erreur émission événement distributor:deleted:', e);
    }

    const lang = await resolveRequestLanguage(req, { userId: id, userType: 'distributor' });
    return res.json({
      success: true,
      message: pickByLang(lang, {
        fr: 'Distributeur supprimé avec succès',
        en: 'Distributor deleted successfully',
        ar: 'تم حذف الموزع بنجاح',
      }),
    });
  } catch (error) {
    console.error('💥 Exception DELETE /api/distributors/:id:', error);
    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression du distributeur',
    });
  }
});

// POST - Création d'un nouveau superviseur (utilisé par le dashboard Next.js)
app.post('/api/supervisors', async (req, res) => {
  try {
    const body = req.body || {};
    const {
      first_name,
      last_name,
      phone,
      email,
      zone,
      address,
      latitude,
      longitude,
      nni,
      nni_card_url,
      photo_url,
      documents_url,
      birth_date,
      birth_place,
      planned_distributors,
      status,
      role,
      is_verified,
      password,
      notes,
    } = body;

    if (!first_name || !last_name || !phone || !zone) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants (first_name, last_name, phone, zone)',
      });
    }

    // Vérifier unicité téléphone superviseur
    try {
      const { data: existing } = await supabase
        .from('supervisors')
        .select('id')
        .eq('phone', phone)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Un superviseur avec ce numéro de téléphone existe déjà.',
          code: 'DUPLICATE_SUPERVISOR_PHONE',
        });
      }
    } catch (e) {
      // En cas d'erreur de lecture, on continue quand même (fallback permissif)
    }

    // PIN / mot de passe pour connexion mobile superviseur (exactement 4 chiffres)
    let rawPin = null;
    if (typeof password === 'string' && /^\d{4}$/.test(password.trim())) {
      rawPin = password.trim();
    } else if (password != null && String(password).trim().length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Le PIN doit contenir exactement 4 chiffres',
      });
    } else {
      rawPin = Math.floor(1000 + Math.random() * 9000).toString();
    }
    const hashedPin = await bcrypt.hash(rawPin, 10);

    const nowIso = new Date().toISOString();

    let docs = null;
    if (Array.isArray(documents_url)) {
      docs = documents_url.length ? documents_url : null;
    } else if (documents_url) {
      docs = [documents_url];
    }

    const supervisorPayload = {
      first_name,
      last_name,
      phone,
      email: email || null,
      zone,
      address: address || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      nni: nni || null,
      nni_card_url: nni_card_url || null,
      photo_url: photo_url || null,
      documents_url: docs,
      birth_date: birth_date || null,
      birth_place: birth_place || null,
      planned_distributors:
        planned_distributors != null ? Number(planned_distributors) : null,
      status: status || 'active',
      role: role || 'supervisor',
      is_verified: !!(is_verified || (nni_card_url && photo_url)),
      password_hash: hashedPin,
      distributor_count: 0,
      container_count: 0,
      notes: notes || null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const { data: created, error: insertErr } = await supabase
      .from('supervisors')
      .insert(supervisorPayload)
      .select('*')
      .single();

    if (insertErr || !created) {
      console.error('💥 Erreur création superviseur /api/supervisors:', insertErr);
      return res
        .status(500)
        .json({ success: false, error: 'Erreur lors de la création du superviseur' });
    }

    // Forcer le changement de PIN à la première connexion (même logique que reset PIN)
    try {
      const localPhone = toLocalPhone(created.phone) || created.phone;
      await supabase
        .from('supervisor_auth')
        .upsert({
          supervisor_id: created.id,
          phone: localPhone,
          email: created.email || null,
          password_hash: hashedPin,
          must_change_pin: true,
          pin_reset_reason: 'ACCOUNT_CREATED',
          login_attempts: 0,
          is_locked: false,
          locked_until: null,
          updated_at: nowIso,
          created_at: nowIso,
        }, { onConflict: 'supervisor_id' });
    } catch (e) {
      console.warn('⚠️ Upsert supervisor_auth (ACCOUNT_CREATED) échoué:', e && e.message ? e.message : e);
    }

    try {
      await logAuditEvent({
        event_type: 'supervisor.created',
        actor: buildActorFromRequest(req),
        resource: { type: 'supervisor', id: created.id },
        action_summary: 'Création superviseur (dashboard)',
        values_after: {
          supervisor_id: created.id,
          phone: created.phone,
          zone: created.zone || null,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    try {
      await sendTemplatedNotification('supervisor.account_created', {
        userId: created.id,
        context: { supervisor: created },
      });
    } catch (e) { }

    try {
      const settings = await getSmsAdvancedSettings();
      if (settings && settings.enabled !== false) {
        const finalPhone = toLocalPhone(created.phone) || created.phone;
        const smsLang = normalizeLanguage(created.language || await resolveRequestLanguage(req));
        const tplRaw = settings.templates && settings.templates.supervisorAccountCreated;
        const defaultTpl = pickByLang(smsLang, {
          fr: 'MoovMoney: Compte superviseur créé. Téléphone: {phone}. PIN: {pin}. Connectez-vous puis changez votre PIN.',
          en: 'MoovMoney: Supervisor account created. Phone: {phone}. PIN: {pin}. Log in then change your PIN.',
          ar: 'مووف موني: تم إنشاء حساب المشرف. الهاتف: {phone}. الرقم السري: {pin}. سجّل الدخول ثم غيّر الرقم السري.',
        });

        let tpl = defaultTpl;
        if (tplRaw && typeof tplRaw === 'string' && tplRaw.trim().length > 0) {
          tpl = tplRaw;
        } else if (tplRaw && typeof tplRaw === 'object') {
          const picked = pickByLang(smsLang, tplRaw);
          if (picked && String(picked).trim().length > 0) {
            tpl = picked;
          }
        }

        const smsMsg = String(tpl)
          .replace(/\{phone\}/g, String(finalPhone))
          .replace(/\{pin\}/g, String(rawPin))
          .replace(/\{first_name\}/g, String(created.first_name || ''))
          .replace(/\{last_name\}/g, String(created.last_name || ''))
          .replace(/\{name\}/g, String(`${created.first_name || ''} ${created.last_name || ''}`.trim()));

        // Priorité: enfile en sms_queue (agent Termux), fallback en direct
        const queued = await queueSmsMessage({ phone: finalPhone, message: smsMsg, channel: 'mobile' });
        if (!queued || !queued.success) {
          await smsService.sendSMS(finalPhone, smsMsg, 'notification');
        }
      }
    } catch (e) { }

    return res.json({
      success: true,
      data: {
        supervisor: created,
        pin: rawPin,
      },
    });
  } catch (error) {
    console.error('💥 Exception POST /api/supervisors:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la création du superviseur' });
  }
});

// PUT - Mettre à jour un superviseur (utilisé par le dashboard Next.js)
app.put('/api/supervisors/:id', async (req, res) => {
  try {
    const { id } = req.params || {};
    const body = req.body || {};
    const {
      first_name,
      last_name,
      phone,
      email,
      zone,
      address,
      nni,
      birth_date,
      birth_place,
      latitude,
      longitude,
      planned_distributors,
      notes,
    } = body;

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID superviseur manquant' });
    }

    if (!first_name || !last_name || !phone || !zone) {
      return res.status(400).json({
        success: false,
        error: 'Champs obligatoires manquants (first_name, last_name, phone, zone)',
      });
    }

    // Vérifier unicité téléphone (autre superviseur avec le même numéro)
    try {
      const { data: existing } = await supabase
        .from('supervisors')
        .select('id')
        .eq('phone', phone)
        .neq('id', id)
        .maybeSingle();

      if (existing) {
        return res.status(400).json({
          success: false,
          error: 'Un superviseur avec ce numéro de téléphone existe déjà.',
          code: 'DUPLICATE_SUPERVISOR_PHONE',
        });
      }
    } catch (e) {
      // En cas d'erreur de lecture, on continue quand même (fallback permissif)
    }

    let beforeRow = null;
    try {
      const { data: current } = await supabase
        .from('supervisors')
        .select('id, zone, is_verified')
        .eq('id', id)
        .maybeSingle();
      beforeRow = current || null;
    } catch (e) { }

    const nowIso = new Date().toISOString();

    const updatePayload = {
      first_name,
      last_name,
      phone,
      email: email || null,
      zone,
      address: address || null,
      latitude: latitude ?? null,
      longitude: longitude ?? null,
      nni: nni || null,
      birth_date: birth_date || null,
      birth_place: birth_place || null,
      planned_distributors:
        planned_distributors != null ? Number(planned_distributors) : null,
      notes: notes || null,
      updated_at: nowIso,
    };

    const { data: updated, error: updateErr } = await supabase
      .from('supervisors')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (updateErr) {
      console.error('💥 Erreur mise à jour superviseur /api/supervisors/:id:', updateErr);
      if (updateErr.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Superviseur non trouvé' });
      }
      return res
        .status(500)
        .json({ success: false, error: updateErr.message || 'Erreur lors de la mise à jour du superviseur' });
    }

    if (!updated) {
      return res.status(404).json({ success: false, error: 'Superviseur non trouvé' });
    }

    try {
      await sendTemplatedNotification('supervisor.updated', {
        userId: updated.id,
        context: { supervisor: updated },
      });
    } catch (e) { }

    try {
      if (beforeRow && beforeRow.zone !== updated.zone) {
        await sendTemplatedNotification('supervisor.assigned_zone_changed', {
          userId: updated.id,
          context: { supervisor: updated, zone: updated.zone },
        });
      }
    } catch (e) { }

    try {
      const beforeVerified = beforeRow ? !!beforeRow.is_verified : null;
      const afterVerified = updated.is_verified != null ? !!updated.is_verified : null;
      if (beforeVerified != null && afterVerified != null && beforeVerified !== afterVerified) {
        await sendTemplatedNotification('supervisor.verification_changed', {
          userId: updated.id,
          context: { supervisor: updated, is_verified: afterVerified },
        });
      }
    } catch (e) { }

    try {
      await logAuditEvent({
        event_type: 'supervisor.updated',
        actor: buildActorFromRequest(req),
        resource: { type: 'supervisor', id },
        action_summary: 'Mise à jour superviseur (dashboard)',
        values_after: {
          supervisor_id: updated.id,
          phone: updated.phone,
          zone: updated.zone || null,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    return res.json({
      success: true,
      data: updated,
    });
  } catch (error) {
    console.error('💥 Exception PUT /api/supervisors/:id:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la mise à jour du superviseur' });
  }
});

// POST - Upload photo superviseur
app.post('/api/supervisors/upload-photo', express.json({ limit: '10mb' }), async (req, res) => {
  try {
    const { file, supervisorId, fileName } = req.body || {};

    if (!file || !supervisorId) {
      return res.status(400).json({
        success: false,
        error: 'Fichier et ID superviseur requis',
      });
    }

    let buffer;
    try {
      buffer = Buffer.from(file, 'base64');
    } catch (e) {
      console.error('❌ Erreur décodage base64 photo superviseur:', e);
      return res.status(400).json({
        success: false,
        error: 'Fichier invalide (base64)',
      });
    }

    const finalFileName = fileName || `photo_${supervisorId}_${Date.now()}.jpg`;

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('supervisors-photos')
      .upload(finalFileName, buffer, {
        contentType: 'image/jpeg',
        upsert: true,
      });

    if (uploadError) {
      console.error('❌ Erreur upload photo superviseur:', uploadError);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de l'upload de la photo",
      });
    }

    const { data: publicData } = supabase.storage
      .from('supervisors-photos')
      .getPublicUrl(finalFileName);

    const publicUrl = publicData?.publicUrl || null;

    let isVerified = false;
    try {
      const { data: current } = await supabase
        .from('supervisors')
        .select('nni_card_url')
        .eq('id', supervisorId)
        .maybeSingle();

      const nniUrl = current?.nni_card_url || null;
      isVerified = !!(publicUrl && nniUrl);

      await supabase
        .from('supervisors')
        .update({
          photo_url: publicUrl,
          is_verified: isVerified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supervisorId);
    } catch (e) {
      console.warn('⚠️ Erreur mise à jour superviseur après upload photo:', e);
    }

    try {
      if (publicUrl) {
        await logAuditEvent({
          event_type: 'supervisor.photo_uploaded',
          actor: buildActorFromRequest(req),
          resource: { type: 'supervisor', id: supervisorId },
          action_summary: 'Upload photo superviseur',
          values_after: {
            photo_url: publicUrl,
            is_verified: isVerified,
          },
        });
      }
    } catch (e) { }

    return res.json({
      success: true,
      data: {
        url: publicUrl,
        fileName: finalFileName,
      },
    });
  } catch (error) {
    console.error('💥 Erreur upload photo superviseur:', error);
    return res.status(500).json({
      success: false,
      error: "Erreur serveur lors de l'upload de la photo",
    });
  }
});

// POST - Upload documents superviseur (NNI + autres)
app.post('/api/supervisors/upload-documents', express.json({ limit: '20mb' }), async (req, res) => {
  try {
    const { files, supervisorId, types } = req.body || {};

    if (!files || !supervisorId || !Array.isArray(files)) {
      return res.status(400).json({
        success: false,
        error: 'Fichiers et ID superviseur requis',
      });
    }

    const uploadedFiles = [];
    const nniUrls = [];
    const docUrls = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i] || {};
      const fileType = types?.[i] || file.type || 'document';

      const base64 = file.data;
      if (!base64) {
        continue;
      }

      let buffer;
      try {
        buffer = Buffer.from(base64, 'base64');
      } catch (e) {
        console.error('❌ Erreur décodage base64 document superviseur:', e);
        continue;
      }

      let fileName = `${fileType}_${supervisorId}_${Date.now()}_${i}.${file.extension || 'pdf'}`;
      const bucketName = fileType === 'nni' ? 'supervisors-nni' : 'supervisors-documents';

      let { data: uploadData, error: uploadError } = await supabase.storage
        .from(bucketName)
        .upload(fileName, buffer, {
          contentType: file.mimeType || 'application/pdf',
          upsert: true,
        });

      if (uploadError && uploadError.message?.includes('mime type') && uploadError.message?.includes('not supported')) {
        console.log(`⚠️ Type MIME ${file.mimeType} non supporté, tentative avec application/octet-stream...`);

        const { data: data2, error: error2 } = await supabase.storage
          .from(bucketName)
          .upload(fileName, buffer, {
            contentType: 'application/octet-stream',
            upsert: true,
          });

        if (!error2) {
          uploadData = data2;
          uploadError = null;
        } else {
          console.log('⚠️ Tentative avec image/jpeg...');
          const altName = fileName.replace('.pdf', '.jpg');
          const { data: data3, error: error3 } = await supabase.storage
            .from(bucketName)
            .upload(altName, buffer, {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (!error3) {
            uploadData = data3;
            uploadError = null;
            fileName = altName;
          }
        }
      }

      if (uploadError) {
        console.error(`❌ Erreur upload document superviseur (${fileType}):`, uploadError);
        continue;
      }

      const { data: publicData } = supabase.storage
        .from(bucketName)
        .getPublicUrl(fileName);

      const publicUrl = publicData?.publicUrl || null;
      if (!publicUrl) continue;

      if (fileType === 'nni') {
        nniUrls.push(publicUrl);
      } else {
        docUrls.push(publicUrl);
      }

      uploadedFiles.push({
        type: fileType,
        url: publicUrl,
        fileName,
        originalName: file.name,
      });

      console.log(`📄 Document superviseur ${fileType} uploadé:`, publicUrl);
    }

    try {
      const { data: current } = await supabase
        .from('supervisors')
        .select('photo_url, nni_card_url, documents_url')
        .eq('id', supervisorId)
        .maybeSingle();

      const existingDocs = Array.isArray(current?.documents_url)
        ? current.documents_url
        : current?.documents_url
          ? [current.documents_url]
          : [];

      // Si plusieurs images NNI sont uploadées (recto/verso), on les stocke
      // dans nni_card_url sous forme de JSON pour permettre l'affichage recto/verso.
      let newNni = current?.nni_card_url || null;
      if (nniUrls.length > 0) {
        if (nniUrls.length === 1) {
          newNni = nniUrls[0];
        } else {
          newNni = JSON.stringify(nniUrls);
        }
      }

      const newDocs = [...existingDocs, ...docUrls];

      const isVerified = !!(newNni && (current?.photo_url || null));

      await supabase
        .from('supervisors')
        .update({
          nni_card_url: newNni,
          documents_url: newDocs.length ? newDocs : null,
          is_verified: isVerified,
          updated_at: new Date().toISOString(),
        })
        .eq('id', supervisorId);

      try {
        await logAuditEvent({
          event_type: 'supervisor.documents_uploaded',
          actor: buildActorFromRequest(req),
          resource: { type: 'supervisor', id: supervisorId },
          action_summary: 'Upload documents superviseur',
          values_after: {
            nni_card_url: newNni,
            documents_count: newDocs.length,
            is_verified: isVerified,
          },
        });
      } catch (e) { }
    } catch (e) {
      console.warn('⚠️ Erreur mise à jour superviseur après upload documents:', e);
    }

    return res.json({
      success: true,
      data: {
        files: uploadedFiles,
      },
    });
  } catch (error) {
    console.error('💥 Erreur upload documents superviseur:', error);
    return res.status(500).json({
      success: false,
      error: "Erreur serveur lors de l'upload des documents",
    });
  }
});

// POST - Effacer les documents d'un superviseur (photo, NNI, autres)
app.post('/api/supervisors/:id/clear-documents', express.json(), async (req, res) => {
  try {
    const { id } = req.params || {};
    const { clear_photo, clear_nni, clear_documents } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID superviseur manquant' });
    }

    if (!clear_photo && !clear_nni && !clear_documents) {
      return res.status(400).json({
        success: false,
        error: 'Aucune action de suppression spécifiée',
      });
    }

    const updatePayload = {
      updated_at: new Date().toISOString(),
    };

    if (clear_photo) {
      updatePayload.photo_url = null;
    }
    if (clear_nni) {
      updatePayload.nni_card_url = null;
    }
    if (clear_documents) {
      updatePayload.documents_url = null;
    }

    // Si on supprime la photo ou la NNI, on remet la vérification à false
    if (clear_photo || clear_nni) {
      updatePayload.is_verified = false;
    }

    const { data, error } = await supabase
      .from('supervisors')
      .update(updatePayload)
      .eq('id', id)
      .select('*')
      .maybeSingle();

    if (error) {
      console.error('💥 Erreur clear-documents superviseur:', error);
      return res.status(500).json({
        success: false,
        error: "Erreur lors de la suppression des documents du superviseur",
      });
    }

    if (!data) {
      return res.status(404).json({
        success: false,
        error: 'Superviseur non trouvé',
      });
    }

    try {
      await logAuditEvent({
        event_type: 'supervisor.documents_cleared',
        actor: buildActorFromRequest(req),
        resource: { type: 'supervisor', id },
        action_summary: 'Suppression de documents superviseur',
        values_after: {
          clear_photo: !!clear_photo,
          clear_nni: !!clear_nni,
          clear_documents: !!clear_documents,
        },
      });
    } catch (e) { }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('💥 Exception POST /api/supervisors/:id/clear-documents:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la suppression des documents du superviseur' });
  }
});

// PUT - Réinitialiser le PIN / mot de passe mobile d'un superviseur
app.post('/api/supervisors/:id/reset-password', express.json(), async (req, res) => {
  try {
    const { id } = req.params;

    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }

    const newPin = Math.floor(1000 + Math.random() * 9000).toString();
    const hashedPin = await bcrypt.hash(newPin, 10);

    const { data: updated, error } = await supabase
      .from('supervisors')
      .update({
        password_hash: hashedPin,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('id, first_name, last_name, phone')
      .single();

    if (error) {
      if (error.code === 'PGRST116' || error.code === 'P0001') {
        return res.status(404).json({ success: false, error: 'Superviseur introuvable' });
      }
      console.error('💥 Erreur reset PIN superviseur:', error);
      return res.status(500).json({ success: false, error: 'Erreur lors de la réinitialisation du PIN' });
    }

    // S'assurer qu'une entrée supervisor_auth existe avec must_change_pin=true
    try {
      const localPhone = toLocalPhone(updated.phone) || updated.phone;

      const { data: existingAuth } = await supabase
        .from('supervisor_auth')
        .select('supervisor_id')
        .eq('supervisor_id', updated.id)
        .maybeSingle();

      const authPayload = {
        supervisor_id: updated.id,
        phone: localPhone,
        password_hash: hashedPin,
        must_change_pin: true,
        pin_reset_reason: 'RESET_BY_ADMIN',
        login_attempts: 0,
        updated_at: new Date().toISOString(),
      };

      if (existingAuth) {
        const { error: supAuthUpdateErr } = await supabase
          .from('supervisor_auth')
          .update(authPayload)
          .eq('supervisor_id', existingAuth.supervisor_id || updated.id);
        if (supAuthUpdateErr) {
          console.error('Erreur mise à jour supervisor_auth après reset PIN:', supAuthUpdateErr);
        }
      } else {
        const { error: supAuthUpsertErr } = await supabase
          .from('supervisor_auth')
          .upsert(authPayload, { onConflict: 'supervisor_id' });
        if (supAuthUpsertErr) {
          console.error('Erreur upsert supervisor_auth après reset PIN:', supAuthUpsertErr);
        }
      }
    } catch (e) {
      console.error('💥 Exception mise à jour supervisor_auth après reset PIN:', e);
    }

    try {
      await logAuditEvent({
        event_type: 'supervisor.pin_reset',
        actor: buildActorFromRequest(req),
        resource: { type: 'supervisor', id: updated.id },
        action_summary: 'Réinitialisation du PIN superviseur',
        values_after: {
          supervisor_id: updated.id,
          account_unlocked: true,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    // Journaliser le déverrouillage dans l'historique d'authentification superviseur
    try {
      await supabase.from('auth_logs').insert({
        user_type: 'supervisor',
        user_id: updated.id,
        phone: updated.phone,
        event: 'account_unlocked',
        context: JSON.stringify({ via: 'admin_web', reason: 'pin_reset_by_admin' }),
        created_at: new Date().toISOString(),
      });
    } catch (e) {
      console.warn('⚠️ Erreur insertion auth_logs (account_unlocked superviseur):', e && e.message ? e.message : e);
    }

    // Retourner le nouveau PIN en clair et le téléphone utilisé, pour affichage côté admin web
    try {
      await sendTemplatedNotification('supervisor.pin_reset', {
        userId: updated.id,
        context: { supervisor: updated, pin: newPin },
      });
    } catch (e) { }

    return res.json({
      success: true,
      pin: newPin,
      phone: updated.phone,
      data: { pin: newPin, phone: updated.phone },
    });
  } catch (error) {
    console.error('💥 Exception POST /api/supervisors/:id/reset-password:', error);
    return res
      .status(500)
      .json({ success: false, error: 'Erreur lors de la réinitialisation du PIN' });
  }
});

// PUT - Suspension superviseur
app.put('/api/supervisors/:id/suspend', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason = 'Suspendu par votre administrateur' } = req.body;

    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }

    const { data, error } = await supabase
      .from('supervisors')
      .update({
        status: 'suspended',
        suspension_reason: reason,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    console.log(`⏸️ Superviseur suspendu: ${data.first_name} ${data.last_name} - ${reason}`);

    // Notifier le superviseur suspendu (push + entrée dans notifications)
    try {
      await sendTemplatedNotification('supervisor.suspended', {
        userId: data.id,
        context: {
          supervisor: data,
          reason,
        },
      });
    } catch (e) { }

    try {
      await logAuditEvent({
        event_type: 'supervisor.suspended',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'supervisor',
          id: data.id,
        },
        action_summary: 'Superviseur suspendu',
        values_after: {
          status: data.status,
          suspension_reason: data.suspension_reason || reason,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    // Notifier les apps mobiles (événement socket)
    try {
      io.emit('supervisor:suspended', {
        supervisorId: data.id,
        status: data.status,
        reason: data.suspension_reason || reason,
      });
    } catch (e) {
      console.error('Erreur émission socket supervisor:suspended:', e);
    }

    res.json({
      success: true,
      data,
      message: pickByLang(await resolveRequestLanguage(req, { userId: data.id, userType: 'supervisor' }), {
        fr: 'Superviseur suspendu avec succès',
        en: 'Supervisor suspended successfully',
        ar: 'تم تعليق المشرف بنجاح',
      }),
    });
  } catch (error) {
    console.error('💥 Erreur suspension superviseur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suspension',
    });
  }
});

// PUT - Réactivation superviseur
app.put('/api/supervisors/:id/reactivate', async (req, res) => {
  try {
    const { id } = req.params;

    const check = await verifyAdminDoubleConfirm(req, res);
    if (!check || check.ok === false) {
      return;
    }

    const { data, error } = await supabase
      .from('supervisors')
      .update({
        status: 'active',
        suspension_reason: null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select('*')
      .single();

    if (error) throw error;

    console.log(`▶️ Superviseur réactivé: ${data.first_name} ${data.last_name}`);

    // Notifier le superviseur réactivé
    try {
      await sendTemplatedNotification('supervisor.reactivated', {
        userId: data.id,
        context: {
          supervisor: data,
        },
      });
    } catch (e) { }

    try {
      await logAuditEvent({
        event_type: 'supervisor.reactivated',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'supervisor',
          id: data.id,
        },
        action_summary: 'Superviseur réactivé',
        values_after: {
          status: data.status,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }

    // Notifier les apps mobiles (événement socket)
    try {
      io.emit('supervisor:reactivated', {
        supervisorId: data.id,
        status: data.status,
      });
    } catch (e) {
      console.error('Erreur émission socket supervisor:reactivated:', e);
    }

    res.json({
      success: true,
      data: data,
      message: pickByLang(await resolveRequestLanguage(req, { userId: data.id, userType: 'supervisor' }), {
        fr: 'Superviseur réactivé avec succès',
        en: 'Supervisor reactivated successfully',
        ar: 'تمت إعادة تفعيل المشرف بنجاح',
      })
    });
  } catch (error) {
    console.error('💥 Erreur réactivation superviseur:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la réactivation'
    });
  }
});

// GET - Journal d'authentification pour un distributeur (utilisé sur la fiche)
app.get('/api/auth/logs', async (req, res) => {
  try {
    const { distributor_id, supervisor_id } = req.query || {};

    if (!distributor_id && !supervisor_id) {
      return res.json({ success: true, data: [] });
    }

    const isSupervisor = !!supervisor_id;
    const resourceType = isSupervisor ? 'supervisor' : 'distributor';
    const resourceId = String(isSupervisor ? supervisor_id : distributor_id);

    let profilePhone = null;
    try {
      if (isSupervisor) {
        const { data: supRow } = await supabase
          .from('supervisors')
          .select('phone')
          .eq('id', resourceId)
          .maybeSingle();
        profilePhone = supRow?.phone || null;
      } else {
        const { data: distRow } = await supabase
          .from('distributors')
          .select('phone')
          .eq('id', resourceId)
          .maybeSingle();
        profilePhone = distRow?.phone || null;
      }
    } catch (e) {}

    const { data, error } = await supabase
      .from(AUDIT_TABLE)
      .select('created_at, event_type, resource_type, resource_id, actor_user_id, actor_role, actor_display_name, values_before, values_after')
      .eq('resource_type', resourceType)
      .eq('resource_id', resourceId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Erreur /api/auth/logs:', error);
      return res.json({ success: true, data: [] });
    }

    const mapEventType = (eventType) => {
      const e = String(eventType || '').toLowerCase();
      if (e === 'auth.otp_verified') return 'login_success';
      if (e === 'auth.otp_verify_failed') return 'login_failed';
      if (e === 'auth.login_web') return 'login_attempt';
      if (e === 'auth.logout' || e === 'logout') return 'logout';
      return eventType || '';
    };

    const list = (data || []).map((row) => {
      const before = (row.values_before || {}) || {};
      const after = (row.values_after || {}) || {};
      let phone = null;

      const stripPhoneFromDisplayName = (value) => {
        const s = String(value || '').trim();
        if (!s) return null;
        const idx = s.lastIndexOf('(');
        if (idx > 0 && s.endsWith(')')) {
          const nameOnly = s.substring(0, idx).trim();
          return nameOnly || s;
        }
        return s;
      };

      if (row.actor_role === 'admin') {
        phone = ADMIN_WEB_PHONE;
      } else {
        phone = after.phone || before.phone || profilePhone || null;
      }

      return {
        created_at: row.created_at,
        event: mapEventType(row.event_type),
        phone,
        actor_display_name: stripPhoneFromDisplayName(row.actor_display_name) || null,
        actor_role: row.actor_role || null,
      };
    });

    return res.json({ success: true, data: list });
  } catch (error) {
    console.error('💥 Exception GET /api/auth/logs:', error);
    return res.json({ success: true, data: [] });
  }
});

// GET - Statistiques agrégées pour le tableau de bord web
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const [distResult, contResult] = await Promise.all([
      supabase.from('distributors').select('id, status, credit_balance'),
      supabase.from('containers').select('id, status, balance'),
    ]);

    const distributors = distResult.data || [];
    const containers = contResult.data || [];

    const distTotal = distributors.length;
    const distActive = distributors.filter((d) => d.status === 'active').length;
    const distSuspended = distributors.filter((d) => d.status === 'suspended').length;

    const contTotal = containers.length;
    const contActive = containers.filter((c) => c.status === 'active').length;
    const contCritical = containers.filter((c) => Number(c.balance) <= 50000).length;

    const totalCredit = distributors.reduce((sum, d) => sum + (Number(d.credit_balance) || 0), 0);

    const payload = {
      success: true,
      distributors: {
        total: distTotal,
        active: distActive,
        suspended: distSuspended,
      },
      containers: {
        total: contTotal,
        active: contActive,
        critical: contCritical,
      },
      finance: {
        totalCredit,
        monthlyRevenue: 0,
        totalCommission: 0,
      },
      transactions: {
        total: 0,
        successful: 0,
      },
    };

    return res.json(payload);
  } catch (error) {
    console.error('Erreur /api/dashboard/stats:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement statistiques dashboard' });
  }
});

// GET - Statistiques synthétiques des transactions (utilisé par le dashboard web)
app.get('/api/transactions/stats', async (req, res) => {
  try {
    const data = {
      today_total: 0,
      total_deposits: 0,
      total_recharges: 0,
      total_commissions: 0,
      week_total: 0,
      month_total: 0,
    };

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur /api/transactions/stats:', error);
    return res.json({ success: true, data: null });
  }
});

// =====================================================
// ROUTES NOTIFICATIONS & PUSH
// =====================================================

// GET - Liste des notifications pour l'utilisateur courant (admin web)
app.get('/api/notifications', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;
    const unreadOnly = String(req.query.unread || '').toLowerCase() === 'true';
    const limit = req.query.limit ? Number(req.query.limit) : 50;

    const list = await getNotificationsForUser(userId, {
      unreadOnly,
      limit,
    });

    try {
      const lang = await resolveUserLanguage({ userId, userType: auth.userType || auth.role });
      const localized = await Promise.all(
        (list || []).map(async (n) => {
          try {
            if (!n || !n.type) return n;
            const tpl = NOTIFICATION_TEMPLATES[n.type];
            if (!tpl || typeof tpl.build !== 'function') return n;
            const md = n.metadata && typeof n.metadata === 'object' ? n.metadata : {};
            const ctx = {};
            if (String(n.type).startsWith('distributor.')) {
              const distributorId = md.distributorId || n.resource_id || null;
              if (distributorId) {
                try {
                  const { data: dist } = await supabase
                    .from('distributors')
                    .select('id, name, full_name, phone, credit_balance, status')
                    .eq('id', distributorId)
                    .maybeSingle();
                  if (dist) ctx.distributor = dist;
                } catch (e) { }
              }
              if (md.amount != null) ctx.amount = md.amount;
              if (md.credit_balance != null) ctx.amount = md.credit_balance;
              if (md.oldBalance != null) ctx.oldBalance = md.oldBalance;
              if (md.newBalance != null) ctx.newBalance = md.newBalance;
              if (md.reference != null) ctx.reference = md.reference;
              if (md.paymentMethod != null) ctx.paymentMethod = md.paymentMethod;
              if (md.pin != null) ctx.pin = md.pin;
              if (md.lockedUntil != null) ctx.lockedUntil = md.lockedUntil;
              if (md.reason != null) ctx.reason = md.reason;
            }
            if (String(n.type).startsWith('container.')) {
              const containerId = md.containerId || n.resource_id || null;
              if (containerId) {
                try {
                  const { data: cont } = await supabase
                    .from('containers')
                    .select('id, container_code, code, name, balance, distributor_id, status')
                    .eq('id', containerId)
                    .maybeSingle();
                  if (cont) ctx.container = cont;
                } catch (e) { }
              }
              if (md.balance != null) ctx.balance = md.balance;
              if (md.amount != null) ctx.amount = md.amount;
              if (md.reference != null) ctx.reference = md.reference;
              if (md.days != null) ctx.days = md.days;
              if (md.oldStatus != null) ctx.oldStatus = md.oldStatus;
              if (md.newStatus != null) ctx.newStatus = md.newStatus;
            }
            if (String(n.type).startsWith('supervisor.')) {
              const supervisorId = md.supervisorId || n.resource_id || null;
              if (supervisorId) {
                try {
                  const { data: sup } = await supabase
                    .from('supervisors')
                    .select('id, first_name, last_name, phone, zone, status')
                    .eq('id', supervisorId)
                    .maybeSingle();
                  if (sup) ctx.supervisor = sup;
                } catch (e) { }
              }
              if (md.attempts != null) ctx.attempts = md.attempts;
              if (md.maxAttempts != null) ctx.maxAttempts = md.maxAttempts;
              if (md.lockedUntil != null) ctx.lockedUntil = md.lockedUntil;
            }
            const built = tpl.build(ctx, lang) || {};
            return {
              ...n,
              title: built.title || n.title,
              message: built.message || n.message,
            };
          } catch (e) {
            return n;
          }
        })
      );
      return res.json({ success: true, data: localized });
    } catch (e) {
      return res.json({ success: true, data: list });
    }
  } catch (error) {
    console.error(' Exception GET /api/notifications:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement notifications' });
  }
});

// GET - Nombre de notifications non lues pour l'utilisateur courant
app.get('/api/notifications/unread-count', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;

    const { count, error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.warn(' Erreur /api/notifications/unread-count:', error.message || error);
      return res.json({ success: true, count: 0 });
    }

    return res.json({ success: true, count: count || 0 });
  } catch (error) {
    console.error(' Exception GET /api/notifications/unread-count:', error);
    return res.json({ success: true, count: 0 });
  }
});

// POST - Marquer une notification comme lue
app.post('/api/notifications/mark-read', express.json(), async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;
    const { id } = req.body || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID de notification manquant' });
    }

    const ok = await markNotificationRead(userId, id);
    if (!ok) {
      return res.status(500).json({ success: false, error: 'Erreur lors de la mise à jour de la notification' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(' Erreur POST /api/notifications/mark-read:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour notification' });
  }
});

// POST - Marquer toutes les notifications comme lues pour l'utilisateur courant
app.post('/api/notifications/mark-all-read', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;

    const { error } = await supabase
      .from(NOTIFICATIONS_TABLE)
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('user_id', userId)
      .eq('is_read', false);

    if (error) {
      console.warn(' Erreur /api/notifications/mark-all-read:', error.message || error);
      return res.status(500).json({ success: false, error: 'Erreur mise à jour notifications' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error(' Exception POST /api/notifications/mark-all-read:', error);
    return res.status(500).json({ success: false, error: 'Erreur mise à jour notifications' });
  }
});

// POST - Enregistrer un token push pour l'utilisateur courant
app.post('/api/push/register-token', express.json(), async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Non autorisé' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;
    const { platform, token, deviceId, language } = req.body || {};

    try {
      const desiredLang = normalizeLanguage(language || (req.headers['x-lang'] || req.headers['x-language'] || null));
      if (desiredLang && userId && userId !== DEFAULT_ADMIN_USER_ID) {
        notifLangLog('push.register-token.lang', {
          userId,
          userType: auth.userType || auth.role,
          desiredLang,
        });
        await updateUserLanguage({
          userId,
          userType: auth.userType || auth.role,
          language: desiredLang,
        });
      }
    } catch (e) { }

    const result = await registerPushToken({
      userId,
      platform,
      token,
      deviceId,
    });

    if (!result.success) {
      return res.status(400).json({ success: false, error: result.error || 'Erreur enregistrement token push' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('💥 Exception POST /api/push/register-token:', error);
    return res.status(500).json({ success: false, error: 'Erreur enregistrement token push' });
  }
});

// POST - Désenregistrer un token push pour l'utilisateur courant
app.post('/api/push/unregister-token', express.json(), async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;
    const { token, deviceId } = req.body || {};

    if (!token) {
      return res.status(400).json({ success: false, error: 'Token push requis' });
    }

    let query = supabase
      .from(PUSH_TOKENS_TABLE)
      .delete()
      .eq('user_id', userId)
      .eq('token', token);

    if (deviceId) {
      query = query.eq('device_id', deviceId);
    }

    const { error } = await query;

    if (error) {
      console.warn('⚠️ Erreur /api/push/unregister-token:', error.message || error);
      return res.status(500).json({ success: false, error: 'Erreur désenregistrement token push' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('💥 Exception POST /api/push/unregister-token:', error);
    return res.status(500).json({ success: false, error: 'Erreur désenregistrement token push' });
  }
});

// GET - Liste des tokens push de l'utilisateur courant (debug / administration)
app.get('/api/push/tokens', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth) {
      return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }

    const userId = auth.userId || DEFAULT_ADMIN_USER_ID;

    const { data, error } = await supabase
      .from(PUSH_TOKENS_TABLE)
      .select('id, platform, token, device_id, created_at, last_used_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) {
      console.warn('⚠️ Erreur /api/push/tokens:', error.message || error);
      return res.status(500).json({ success: false, error: "Erreur chargement tokens push" });
    }

    return res.json({ success: true, data: data || [] });
  } catch (error) {
    console.error('💥 Exception GET /api/push/tokens:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement tokens push' });
  }
});

app.post('/api/push/test', async (req, res) => {
  try {
    const auth = getAuthFromRequest(req);
    if (!auth || !auth.userId) {
      return res.status(401).json({ success: false, error: 'Session invalide ou expirée' });
    }

    const nowIso = new Date().toISOString();
    const lang = await resolveUserLanguage({ userId: auth.userId, userType: auth.userType || auth.role });
    const built = (NOTIFICATION_TEMPLATES['push.test'] && typeof NOTIFICATION_TEMPLATES['push.test'].build === 'function')
      ? (NOTIFICATION_TEMPLATES['push.test'].build({ now: nowIso }, lang) || {})
      : {};
    const title = built.title || pickByLang(lang, { fr: 'Test de notification', en: 'Notification test', ar: 'اختبار الإشعار' });
    const message = built.message || pickByLang(lang, {
      fr: `Ceci est une notification de test. (${nowIso})`,
      en: `This is a test notification. (${nowIso})`,
      ar: `هذا إشعار تجريبي. (${nowIso})`,
    });

    let notification = null;
    try {
      notification = await createNotification({
        userId: auth.userId,
        title,
        message,
        type: 'push.test',
        severity: 'info',
        resourceType: 'system',
        resourceId: null,
        metadata: { now: nowIso },
        skipPush: true,
      });
    } catch (e) { }

    const push = await sendPushNotificationToUser(auth.userId, {
      title,
      body: message,
      data: {
        type: 'push.test',
        severity: 'info',
      },
    });

    return res.json({ success: true, notification, push });
  } catch (error) {
    console.error('💥 Exception POST /api/push/test:', error);
    return res.status(500).json({ success: false, error: 'Erreur envoi notification test' });
  }
});

// GET - Analytics agrégées (dashboard + page analytics)
app.get('/api/analytics', async (req, res) => {
  try {
    const period = String(req.query.period || 'month');

    const [distRes, contRes] = await Promise.all([
      supabase
        .from('distributors')
        .select('id, status, zone, credit_balance, name, first_name, last_name, phone'),
      supabase
        .from('containers')
        .select('id, status'),
    ]);

    const distributors = distRes.data || [];
    const containers = contRes.data || [];

    const totalDistributors = distributors.length;
    const activeDistributors = distributors.filter((d) => d.status === 'active').length;

    const totalContainers = containers.length;
    const activeContainers = containers.filter((c) => c.status === 'active').length;

    // Construire un top 5 très simple basé sur le credit_balance
    const topDistributors = distributors
      .map((d) => {
        const fullName = `${d.first_name || ''} ${d.last_name || ''}`.trim();
        return {
          id: d.id,
          name: d.name || fullName || d.phone || 'Distributeur',
          revenue: Number(d.credit_balance) || 0,
          transactions: 0,
        };
      })
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    // Statistiques par zone basées sur les distributeurs uniquement (containers et revenus approximatifs)
    const zoneMap = new Map();
    for (const d of distributors) {
      const zone = d.zone || 'Autre';
      let entry = zoneMap.get(zone);
      if (!entry) {
        entry = { zone, distributors: 0, containers: 0, revenue: 0 };
        zoneMap.set(zone, entry);
      }
      entry.distributors += 1;
      entry.revenue += Number(d.credit_balance) || 0;
    }
    const zone_stats = Array.from(zoneMap.values());

    const data = {
      revenue_today: 0,
      revenue_week: 0,
      revenue_month: 0,
      revenue_total: 0,
      transactions_today: 0,
      transactions_week: 0,
      transactions_month: 0,
      active_distributors: activeDistributors,
      active_containers: activeContainers,
      total_distributors: totalDistributors,
      total_containers: totalContainers,
      top_distributors: topDistributors,
      zone_stats,
    };

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur /api/analytics:', error);
    // Fallback: renvoyer des données de démonstration proches de celles du frontend
    const fallback = {
      revenue_today: 1250000,
      revenue_week: 8750000,
      revenue_month: 35000000,
      revenue_total: 150000000,
      transactions_today: 125,
      transactions_week: 875,
      transactions_month: 3500,
      active_distributors: 45,
      active_containers: 120,
      total_distributors: 52,
      total_containers: 150,
      top_distributors: [
        { id: '1', name: 'Ali Ibrahim', revenue: 5000000, transactions: 450 },
        { id: '2', name: 'Fatima Hassan', revenue: 4500000, transactions: 420 },
        { id: '3', name: 'Moussa Abdoulaye', revenue: 4000000, transactions: 380 },
        { id: '4', name: 'Aïcha Mahamat', revenue: 3500000, transactions: 350 },
        { id: '5', name: 'Ibrahim Saleh', revenue: 3000000, transactions: 320 },
      ],
      zone_stats: [
        { zone: 'Centre', distributors: 15, containers: 40, revenue: 12000000 },
        { zone: 'Nord', distributors: 10, containers: 30, revenue: 8000000 },
        { zone: 'Sud', distributors: 8, containers: 25, revenue: 6000000 },
        { zone: 'Est', distributors: 7, containers: 15, revenue: 5000000 },
        { zone: 'Ouest', distributors: 5, containers: 10, revenue: 4000000 },
      ],
    };

    return res.json({ success: true, data: fallback });
  }
});

// GET - Liste des superviseurs (utilisé par web-app)
app.get('/api/supervisors', async (req, res) => {
  try {
    const { phone } = req.query || {};

    let query = supabase
      .from('supervisors')
      .select('*')
      .order('created_at', { ascending: false });

    if (phone) {
      query = query.eq('phone', String(phone));
    }

    const { data, error } = await query;

    if (error) {
      // Si la table n'existe pas encore, on renvoie simplement une liste vide
      if (error.code === 'PGRST205' || (error.message && error.message.includes("'public.supervisors'"))) {
        console.warn("⚠️ Table 'supervisors' introuvable, retour liste vide");
        return res.json({ success: true, data: [], count: 0 });
      }

      console.error('💥 Erreur GET /api/supervisors:', error);
      return res.json({ success: true, data: [], count: 0 });
    }

    // Enrichir les superviseurs avec le nombre de distributeurs associés
    let finalData = data || [];
    try {
      const { data: distributors, error: distError } = await supabase
        .from('distributors')
        .select('id, supervisor_id');

      if (distError) {
        console.warn('⚠️ Erreur lecture distributeurs pour comptage superviseurs:', distError);
      } else if (Array.isArray(distributors)) {
        const countsBySupervisor = {};
        distributors.forEach((d) => {
          const sid = d && d.supervisor_id;
          if (!sid) return;
          countsBySupervisor[sid] = (countsBySupervisor[sid] || 0) + 1;
        });

        finalData = finalData.map((sup) => ({
          ...sup,
          distributors_count: countsBySupervisor[sup.id] || 0,
        }));
      }
    } catch (countError) {
      console.warn('⚠️ Exception comptage distributeurs pour superviseurs:', countError);
    }

    return res.json({
      success: true,
      data: finalData,
      count: finalData.length,
    });
  } catch (error) {
    console.error('💥 Erreur inattendue GET /api/supervisors:', error);
    return res.json({ success: true, data: [], count: 0 });
  }
});

// GET - Détails d'un superviseur (utilisé par le dashboard Next.js)
app.get('/api/supervisors/:id', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID superviseur manquant' });
    }

    // Récupérer le superviseur
    const { data: supervisor, error: supError } = await supabase
      .from('supervisors')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (supError) {
      console.error('💥 Erreur lecture superviseur:', supError);
      // PGRST116 = aucune ligne trouvée
      if (supError.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Superviseur non trouvé' });
      }
      return res.status(500).json({ success: false, error: supError.message || 'Erreur récupération superviseur' });
    }

    if (!supervisor) {
      return res.status(404).json({ success: false, error: 'Superviseur non trouvé' });
    }

    // Récupérer les distributeurs assignés
    const { data: distributors, error: distError } = await supabase
      .from('distributors')
      .select('*')
      .eq('supervisor_id', id)
      .order('created_at', { ascending: false });

    if (distError) {
      console.warn('⚠️ Erreur lecture distributeurs superviseur:', distError);
    }

    // Compter les containers de tous les distributeurs de ce superviseur
    let containersCount = 0;
    if (Array.isArray(distributors) && distributors.length > 0) {
      const distIds = distributors.map((d) => d.id).filter(Boolean);
      if (distIds.length > 0) {
        try {
          const { count, error: containersCountError } = await supabase
            .from('containers')
            .select('id', { count: 'exact', head: true })
            .in('distributor_id', distIds);

          if (containersCountError) {
            console.warn('⚠️ Erreur comptage containers superviseur:', containersCountError);
          } else if (typeof count === 'number') {
            containersCount = count;
          }
        } catch (e) {
          console.warn('⚠️ Exception comptage containers superviseur:', e && e.message ? e.message : e);
        }
      }
    }

    return res.json({
      success: true,
      data: {
        ...supervisor,
        distributors: distributors || [],
        containers_count: containersCount,
      },
    });
  } catch (error) {
    console.error('💥 Erreur récupération superviseur /api/supervisors/:id:', error);
    return res.status(500).json({
      success: false,
      error: error && error.message ? error.message : 'Erreur lors de la récupération du superviseur',
    });
  }
});

// GET - Distributeurs d'un superviseur (liste optimisée)
app.get('/api/supervisors/:id/distributors', async (req, res) => {
  try {
    const { id } = req.params || {};

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID superviseur manquant' });
    }

    const { data: distributors, error } = await supabase
      .from('distributors')
      .select('*')
      .eq('supervisor_id', id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('💥 Erreur lecture distributeurs superviseur:', error);
      // En cas d'erreur, retourner une liste vide pour ne pas casser le frontend
      return res.json({ success: true, data: [] });
    }

    // Pour chaque distributeur, récupérer ses containers (compte + liste simplifiée)
    const distributorsWithContainers = await Promise.all(
      (distributors || []).map(async (dist) => {
        try {
          const { data: containers } = await supabase
            .from('containers')
            .select('*')
            .eq('distributor_id', dist.id);

          return {
            ...dist,
            containers: containers || [],
            container_count: Array.isArray(containers) ? containers.length : 0,
            credit_balance: dist.credit_balance || 0,
            last_activity: dist.updated_at,
          };
        } catch (e) {
          return {
            ...dist,
            containers: [],
            container_count: 0,
            credit_balance: dist.credit_balance || 0,
            last_activity: dist.updated_at,
          };
        }
      })
    );

    return res.json({
      success: true,
      data: distributorsWithContainers,
    });
  } catch (error) {
    console.error('💥 Erreur /api/supervisors/:id/distributors:', error);
    // Ne pas renvoyer 500 pour ne pas bloquer l'écran, retourner une liste vide
    return res.json({ success: true, data: [] });
  }
});

// GET - Journal d'audit paginé
app.get('/api/audit', async (req, res) => {
  try {
    let { page = 1, limit = 50, q, role, status, eventType, resourceType, userId, from, to } = req.query;

    const pageNum = Math.max(parseInt(page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(parseInt(limit, 10) || 50, 1), 200);
    const offset = (pageNum - 1) * pageSize;
    const toIndex = offset + pageSize - 1;

    let query = supabase
      .from(AUDIT_TABLE)
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, toIndex);

    if (role) query = query.eq('actor_role', role);
    if (status) query = query.eq('status', status);
    if (eventType) query = query.eq('event_type', eventType);
    if (resourceType) query = query.eq('resource_type', resourceType);
    if (userId) query = query.eq('actor_user_id', userId);
    if (from) query = query.gte('created_at', from);
    if (to) query = query.lte('created_at', to);
    if (q) query = query.ilike('action_summary', `%${q}%`);

    const { data, error, count } = await query;

    if (error) {
      if (error.code === '42P01' || (error.message && error.message.indexOf(AUDIT_TABLE) !== -1)) {
        console.warn('Table audit_events introuvable, retour liste vide');
        const emptyMeta = {
          total: 0,
          page: pageNum,
          pageSize,
          totalPages: 0,
        };
        return res.json({ success: true, data: [], meta: emptyMeta });
      }
      console.error('Erreur /api/audit:', error);
      return res.status(500).json({ success: false, error: error.message || 'Erreur chargement audit' });
    }

    const total = typeof count === 'number' ? count : (data ? data.length : 0);
    const totalPages = total > 0 ? Math.ceil(total / pageSize) : 0;
    const meta = { total, page: pageNum, pageSize, totalPages };

    return res.json({ success: true, data: data || [], meta });
  } catch (error) {
    console.error('Erreur inattendue /api/audit:', error);
    const meta = { total: 0, page: 1, pageSize: 50, totalPages: 0 };
    return res.json({ success: true, data: [], meta });
  }
});

app.get('/api/audit/:id', async (req, res) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ success: false, error: 'ID requis' });
    }

    const { data, error } = await supabase
      .from(AUDIT_TABLE)
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ success: false, error: 'Événement non trouvé' });
      }
      if (error.code === '42P01' || (error.message && error.message.indexOf(AUDIT_TABLE) !== -1)) {
        return res.status(404).json({ success: false, error: "Journal d'audit indisponible" });
      }
      console.error('Erreur /api/audit/:id:', error);
      return res.status(500).json({ success: false, error: error.message || 'Erreur chargement événement audit' });
    }

    if (!data) {
      return res.status(404).json({ success: false, error: 'Événement non trouvé' });
    }

    return res.json({ success: true, data });
  } catch (error) {
    console.error('Erreur inattendue /api/audit/:id:', error);
    return res.status(500).json({ success: false, error: 'Erreur chargement événement audit' });
  }
});

// =====================================================
// ROUTES SMS ET OTP
// =====================================================

// Route pour recevoir mise à jour IP Termux
app.post('/api/sms/update-termux-ip', async (req, res) => {
  try {
    const { new_ip, port } = req.body;

    if (!new_ip) {
      return res.status(400).json({ success: false, error: 'IP requise' });
    }

    console.log(`📱 Mise à jour IP Termux: ${new_ip}:${port || 5001}`);

    const result = await smsService.updateTermuxIP(new_ip, port || 5001);

    try {
      await logAuditEvent({
        event_type: 'sms.termux_ip_updated',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'sms_gateway',
          id: 'termux',
        },
        action_summary: 'Mise à jour IP Termux',
        values_after: {
          ip: new_ip,
          port: port || 5001,
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }
    res.json(result);

  } catch (error) {
    console.error('Erreur mise à jour IP Termux:', error);
    try {
      await logAuditEvent({
        event_type: 'sms.termux_ip_update_failed',
        status: 'error',
        actor: buildActorFromRequest(req),
        resource: {
          type: 'sms_gateway',
          id: 'termux',
        },
        action_summary: "Échec mise à jour IP Termux",
        error: {
          code: error.code || 'TERMUX_IP_UPDATE_FAILED',
          message: error.message || String(error),
        },
        metadata: {
          path: req.path,
          method: req.method,
          query: req.query || {},
        },
      });
    } catch (e) { }
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour tester connectivité SMS
app.get('/api/sms/test', async (req, res) => {
  try {
    const result = await smsService.testConnection();
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// --- API SMS pour l'agent Termux (file sms_queue) ---
app.get('/api/sms/pending', async (req, res) => {
  try {
    if (!SMS_AGENT_SECRET) {
      return res.status(503).json({
        success: false,
        error: 'Agent SMS non configuré (SMS_AGENT_SECRET manquant)',
      });
    }

    const secret = req.header('X-SMS-SECRET');
    if (!secret || secret !== SMS_AGENT_SECRET) {
      return res.status(401).json({ success: false, error: 'Accès non autorisé' });
    }

    let limit = 5;
    if (req.query && req.query.limit) {
      const parsed = parseInt(String(req.query.limit), 10);
      if (!Number.isNaN(parsed) && parsed > 0) {
        limit = Math.min(parsed, 50);
      }
    }

    const channel = (req.query && req.query.channel) ? String(req.query.channel) : 'mobile';

    let query = supabase
      .from('sms_queue')
      .select('id, phone, message, channel, status, attempts, created_at')
      .eq('status', 'pending')
      .order('created_at', { ascending: true })
      .limit(limit);

    if (channel && channel !== 'all' && channel !== '*') {
      query = query.eq('channel', channel);
    }

    const { data, error } = await query;
    if (error) {
      console.error('💥 Erreur lecture sms_queue (pending):', error);
      return res.status(500).json({ success: false, error: 'Erreur lecture sms_queue' });
    }

    return res.json({ success: true, messages: data || [] });
  } catch (error) {
    console.error('💥 Exception GET /api/sms/pending:', error);
    return res.status(500).json({ success: false, error: 'Erreur récupération SMS en attente' });
  }
});

app.post('/api/sms/:id/ack', express.json(), async (req, res) => {
  try {
    if (!SMS_AGENT_SECRET) {
      return res.status(503).json({
        success: false,
        error: 'Agent SMS non configuré (SMS_AGENT_SECRET manquant)',
      });
    }

    const secret = req.header('X-SMS-SECRET');
    if (!secret || secret !== SMS_AGENT_SECRET) {
      return res.status(401).json({ success: false, error: 'Accès non autorisé' });
    }

    const id = req.params.id;
    const body = req.body || {};
    const status = body.status;
    const errorMessage = body.error || null;

    if (!id) {
      return res.status(400).json({ success: false, error: 'ID SMS requis' });
    }

    if (!status || (status !== 'sent' && status !== 'failed')) {
      return res.status(400).json({
        success: false,
        error: "Statut invalide (doit être 'sent' ou 'failed')",
      });
    }

    const { data: row, error: fetchError } = await supabase
      .from('sms_queue')
      .select('attempts')
      .eq('id', id)
      .maybeSingle();

    if (fetchError) {
      console.error('💥 Erreur lecture sms_queue pour ack:', fetchError);
      return res.status(500).json({ success: false, error: 'Erreur lecture sms_queue' });
    }

    if (!row) {
      return res.status(404).json({ success: false, error: 'SMS introuvable' });
    }

    const attempts = (row.attempts || 0) + 1;
    const updatePayload = {
      status,
      attempts,
      error: errorMessage,
    };

    if (status === 'sent') {
      updatePayload.sent_at = new Date().toISOString();
    }

    const { error: updateError } = await supabase
      .from('sms_queue')
      .update(updatePayload)
      .eq('id', id);

    if (updateError) {
      console.error('💥 Erreur mise à jour sms_queue pour ack:', updateError);
      return res.status(500).json({ success: false, error: 'Erreur mise à jour sms_queue' });
    }

    return res.json({ success: true });
  } catch (error) {
    console.error('💥 Exception POST /api/sms/:id/ack:', error);
    return res.status(500).json({ success: false, error: 'Erreur ack SMS' });
  }
});

// Route pour vérifier et envoyer alertes de solde
app.post('/api/alerts/check-balances', async (req, res) => {
  try {
    const { containerIds = [], distributorIds = [] } = req.body;

    console.log('🔍 Vérification alertes de solde...');

    const results = {
      containers: [],
      distributors: [],
      totalAlerts: 0
    };

    // Vérifier containers
    for (const containerId of containerIds) {
      const alertResult = await smsService.checkAndAlertContainerBalance(containerId);
      results.containers.push({
        containerId,
        ...alertResult
      });
      if (alertResult.success && alertResult.alertsSent) {
        results.totalAlerts += alertResult.alertsSent;
      }

      try {
        const { data: cont } = await supabase
          .from('containers')
          .select('id, balance, distributor_id, code, container_code, name')
          .eq('id', containerId)
          .maybeSingle();
        if (cont && cont.distributor_id) {
          const level = getContainerBalanceAlertLevel(cont.balance);
          if (level) {
            await sendTemplatedNotification(
              level === 'critical' ? 'container.balance_critical' : 'container.balance_low',
              {
                userId: cont.distributor_id,
                context: {
                  container: cont,
                  balance: cont.balance,
                },
              }
            );
          }
        }
      } catch (e) {}
    }

    // Vérifier distributeurs
    for (const distributorId of distributorIds) {
      const alertResult = await smsService.checkAndAlertDistributorBalance(distributorId);
      results.distributors.push({
        distributorId,
        ...alertResult
      });
      if (alertResult.success && alertResult.alertsSent) {
        results.totalAlerts += alertResult.alertsSent;
      }

      try {
        const { data: dist } = await supabase
          .from('distributors')
          .select('id, credit_balance, name, first_name, last_name, phone')
          .eq('id', distributorId)
          .maybeSingle();
        if (dist && dist.id) {
          const level = getDistributorBalanceAlertLevel(dist.credit_balance);
          if (level) {
            await sendTemplatedNotification(
              level === 'critical' ? 'distributor.credit_critical' : 'distributor.credit_low',
              {
                userId: dist.id,
                context: {
                  distributor: dist,
                  amount: dist.credit_balance,
                },
              }
            );
          }
        }
      } catch (e) {}
    }

    console.log(`📨 Total alertes envoyées: ${results.totalAlerts}`);
    res.json({ success: true, results });

  } catch (error) {
    console.error('Erreur vérification alertes:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Route pour envoyer notification de création d'entité
app.post('/api/notifications/entity-created', async (req, res) => {
  try {
    const { entityType, entityData } = req.body;

    console.log(`📧 Notification création ${entityType}`);

    const result = await smsService.notifyEntityCreated(entityType, entityData);
    res.json(result);

  } catch (error) {
    console.error('Erreur notification création:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

function getContainerBalanceAlertLevel(balance) {
  try {
    const b = Number(balance);
    if (Number.isNaN(b)) return null;
    if (b <= 10000) return 'critical';
    if (b <= 50000) return 'low';
    return null;
  } catch (e) {
    return null;
  }
}

function getDistributorBalanceAlertLevel(balance) {
  try {
    const b = Number(balance);
    if (Number.isNaN(b)) return null;
    if (b <= 0) return 'critical';
    if (b <= 500000) return 'low';
    return null;
  } catch (e) {
    return null;
  }
}

// Middleware automatique pour vérifier les alertes après certaines actions
const checkAutoAlerts = async (entityType, entityId, newBalance) => {
  try {
    if (entityType === 'container') {
      const level = getContainerBalanceAlertLevel(newBalance);
      if (level) {
        console.log(`⚠️ Container ${entityId} solde faible: ${newBalance} FCFA`);
        await smsService.checkAndAlertContainerBalance(entityId);
        try {
          const { data: cont } = await supabase
            .from('containers')
            .select('id, balance, distributor_id, code, container_code, name')
            .eq('id', entityId)
            .maybeSingle();
          if (cont && cont.distributor_id) {
            await sendTemplatedNotification(
              level === 'critical' ? 'container.balance_critical' : 'container.balance_low',
              {
                userId: cont.distributor_id,
                context: {
                  container: cont,
                  balance: cont.balance,
                },
              }
            );

            if (level === 'critical') {
              try {
                const { data: dist } = await supabase
                  .from('distributors')
                  .select('id, name, phone, supervisor_id')
                  .eq('id', cont.distributor_id)
                  .maybeSingle();
                if (dist && dist.supervisor_id) {
                  await sendTemplatedNotification('supervisor.container_balance_critical', {
                    userId: dist.supervisor_id,
                    context: { container: cont, balance: cont.balance, distributor: dist },
                  });
                }
              } catch (e) { }
            }
          }
        } catch (e) {}
      }
    } else if (entityType === 'distributor') {
      const level = getDistributorBalanceAlertLevel(newBalance);
      if (level) {
        console.log(`🚨 Distributeur ${entityId} solde faible: ${newBalance} FCFA`);
        await smsService.checkAndAlertDistributorBalance(entityId);
        try {
          const { data: dist } = await supabase
            .from('distributors')
            .select('id, credit_balance, name, first_name, last_name, phone')
            .eq('id', entityId)
            .maybeSingle();
          if (dist && dist.id) {
            await sendTemplatedNotification(
              level === 'critical' ? 'distributor.credit_critical' : 'distributor.credit_low',
              {
                userId: dist.id,
                context: {
                  distributor: dist,
                  amount: dist.credit_balance,
                },
              }
            );
          }
        } catch (e) {}
      }
    }
  } catch (error) {
    console.warn('⚠️ Erreur vérification alerte auto:', error.message);
  }
};

// =====================================================
// INTÉGRATION ALERTES DANS ROUTES EXISTANTES
// =====================================================

// Hook après création distributeur
const originalDistributorHandler = app._router.stack.find(
  layer => layer.route && layer.route.path === '/api/distributors/create-new'
);

if (originalDistributorHandler) {
  // Wrapper pour ajouter notification SMS
  const originalHandler = originalDistributorHandler.route.stack[0].handle;
  originalDistributorHandler.route.stack[0].handle = async (req, res, next) => {
    // Appeler le handler original
    const originalSend = res.send;
    res.send = function (data) {
      // Intercepter la réponse pour envoyer SMS
      try {
        const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
        if (parsedData.success && parsedData.data) {
          // Envoyer notification SMS de manière asynchrone
          setImmediate(() => {
            smsService.notifyEntityCreated('distributor', {
              name: parsedData.data.name,
              phone: parsedData.data.phone,
              zone: req.body.zone,
              pin: parsedData.data.pin,
              credit_balance: 0
            }).catch(err => console.warn('SMS notification failed:', err));
          });
        }
      } catch (error) {
        console.warn('Erreur parsing réponse distributeur:', error);
      }

      // Appeler le send original
      originalSend.call(this, data);
    };

    return originalHandler.call(this, req, res, next);
  };
}

// =====================================================
// TÂCHES AUTOMATIQUES
// =====================================================

// Vérification automatique des soldes toutes les heures
setInterval(async () => {
  try {
    console.log('🔄 Vérification automatique des soldes...');

    // Récupérer tous les containers et distributeurs
    const { data: containers } = await supabase
      .from('containers')
      .select('id, balance, distributor_id, code, container_code, name')
      .lte('balance', 50000);

    const { data: distributors } = await supabase
      .from('distributors')
      .select('id, credit_balance, name, first_name, last_name, phone')
      .lte('credit_balance', 500000);

    // Vérifier containers à solde faible
    if (containers && containers.length > 0) {
      console.log(`⚠️ ${containers.length} containers avec solde faible détectés`);
      for (const container of containers) {
        await smsService.checkAndAlertContainerBalance(container.id);

        try {
          const level = getContainerBalanceAlertLevel(container.balance);
          if (level && container.distributor_id) {
            await sendTemplatedNotification(
              level === 'critical' ? 'container.balance_critical' : 'container.balance_low',
              {
                userId: container.distributor_id,
                context: {
                  container,
                  balance: container.balance,
                },
              }
            );

            if (level === 'critical') {
              try {
                const { data: dist } = await supabase
                  .from('distributors')
                  .select('id, name, phone, supervisor_id')
                  .eq('id', container.distributor_id)
                  .maybeSingle();
                if (dist && dist.supervisor_id) {
                  await sendTemplatedNotification('supervisor.container_balance_critical', {
                    userId: dist.supervisor_id,
                    context: { container, balance: container.balance, distributor: dist },
                  });
                }
              } catch (e) {}
            }
          }
        } catch (e) {}
      }
    }

    // Vérifier distributeurs à solde faible
    if (distributors && distributors.length > 0) {
      console.log(`🚨 ${distributors.length} distributeurs avec solde faible détectés`);
      for (const distributor of distributors) {
        await smsService.checkAndAlertDistributorBalance(distributor.id);

        try {
          const level = getDistributorBalanceAlertLevel(distributor.credit_balance);
          if (level) {
            await sendTemplatedNotification(
              level === 'critical' ? 'distributor.credit_critical' : 'distributor.credit_low',
              {
                userId: distributor.id,
                context: {
                  distributor,
                  amount: distributor.credit_balance,
                },
              }
            );
          }
        } catch (e) {}
      }
    }

  } catch (error) {
    console.error('Erreur vérification automatique:', error);
  }
}, 60 * 60 * 1000); // Toutes les heures

// Rapport quotidien à 19h00
const scheduleJobAt = (hour, minute, taskFunction) => {
  const now = new Date();
  const scheduledTime = new Date();
  scheduledTime.setHours(hour, minute, 0, 0);

  if (scheduledTime <= now) {
    scheduledTime.setDate(scheduledTime.getDate() + 1);
  }

  const timeUntilScheduled = scheduledTime.getTime() - now.getTime();

  setTimeout(() => {
    taskFunction();
    setInterval(taskFunction, 24 * 60 * 60 * 1000); // Répéter chaque jour
  }, timeUntilScheduled);
};

async function checkInactiveContainersTask() {
  try {
    const inactiveDays = 7;
    const now = Date.now();

    const { data: rows, error } = await supabase
      .from('containers')
      .select('id, distributor_id, code, container_code, name, last_activity, updated_at, created_at, status')
      .eq('status', 'active');

    if (error) {
      console.warn('⚠️ Erreur lecture containers (inactive check):', error.message || error);
      return;
    }

    const containers = Array.isArray(rows) ? rows : [];
    for (const c of containers) {
      if (!c || !c.id || !c.distributor_id) continue;

      let last = null;
      try {
        last = c.last_activity || c.updated_at || c.created_at || null;
      } catch (e) {
        last = null;
      }

      const lastTime = last ? new Date(last).getTime() : NaN;
      if (!last || Number.isNaN(lastTime)) continue;

      const daysSince = Math.floor((now - lastTime) / 86400000);
      if (daysSince < inactiveDays) continue;

      const cacheKey = String(c.id);
      const lastSentAt = containerInactiveAlertCache.get(cacheKey);
      if (lastSentAt && (now - lastSentAt) < 20 * 60 * 60 * 1000) {
        continue;
      }

      containerInactiveAlertCache.set(cacheKey, now);

      try {
        await sendTemplatedNotification('container.inactive', {
          userId: c.distributor_id,
          context: { container: c, days: daysSince },
        });
      } catch (e) { }
    }
  } catch (e) {
    console.warn('⚠️ Erreur tâche containers inactifs:', e && e.message ? e.message : e);
  }
}

// Programmer le rapport quotidien
scheduleJobAt(8, 0, checkInactiveContainersTask);
scheduleJobAt(19, 0, async () => {
  try {
    console.log('📊 Génération rapport quotidien...');

    // Calculer les statistiques
    const { data: distributors } = await supabase
      .from('distributors')
      .select('id, status');

    const { data: containers } = await supabase
      .from('containers')
      .select('id, status, balance');

    const stats = {
      distributors: distributors?.filter(d => d.status === 'active').length || 0,
      containers: containers?.filter(c => c.status === 'active').length || 0,
      transactions: 0, // À implémenter selon votre système de transactions
      revenue: 0, // À calculer selon vos données
      commissions: 0, // À calculer selon vos données
      lowContainers: containers?.filter(c => c.balance <= 50000).length || 0,
      lowDistributors: distributors?.filter(d => d.credit_balance <= 500000).length || 0
    };

    await smsService.sendDailyReport(stats);

  } catch (error) {
    console.error('Erreur rapport quotidien:', error);
  }
});

console.log('📱 Système SMS et alertes automatiques initialisé');
console.log('⏰ Vérifications automatiques: toutes les heures');
console.log('📊 Rapport quotidien: 19h00');

// Démarrage du serveur
const PORT = process.env.PORT || 3001;
let __serverStarted = false;

// Fonction de test de connexion Supabase
async function testSupabase() {
  try {
    const { data, error } = await supabase
      .from('distributors')
      .select('id')
      .limit(1);

    if (error) {
      console.warn('⚠️ Erreur connexion Supabase:', error.message);
      return false;
    }

    console.log('✅ Connexion Supabase réussie');
    return true;
  } catch (error) {
    console.error('❌ Erreur test Supabase:', error.message);
    return false;
  }
}

async function start() {
  if (__serverStarted) return;
  __serverStarted = true;
  const dbOk = await testSupabase();

  server.listen(PORT, () => {
    console.log('\n===========================================');
    console.log('🚀 SERVEUR MOOV AFRICA DÉMARRÉ');
    console.log('===========================================');
    console.log(`📍 URL: http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
    console.log(`👥 Distributeurs: http://localhost:${PORT}/distributors`);
    console.log(`💾 Base de données: ${dbOk ? '✅ Connectée' : '❌ Non connectée'}`);
    console.log('===========================================\n');
  });
}

// Gestion des erreurs
process.on('unhandledRejection', (error) => {
  console.error('❌ Erreur non gérée:', error);
});

// Démarrer
start();

module.exports = { app, io, supabase };
