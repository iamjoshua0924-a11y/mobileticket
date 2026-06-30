const { SolapiMessageService } = require('solapi');

function normalizePhone(phone) {
  return String(phone || '').replace(/\D/g, '');
}

function hasSolapiConfig() {
  return Boolean(process.env.SOLAPI_API_KEY && process.env.SOLAPI_SECRET_KEY && process.env.SEND_PHONE_NUMBER);
}

function makeService() {
  if (!hasSolapiConfig()) return null;
  return new SolapiMessageService(process.env.SOLAPI_API_KEY, process.env.SOLAPI_SECRET_KEY);
}

async function sendSms({ to, text }) {
  const normalizedTo = normalizePhone(to);
  const normalizedFrom = normalizePhone(process.env.SEND_PHONE_NUMBER);

  if (!normalizedTo || !text) {
    return { ok: false, reason: 'invalid_payload' };
  }

  if (!hasSolapiConfig() || !normalizedFrom) {
    return { ok: false, reason: 'not_configured' };
  }

  const messageService = makeService();
  await messageService.send({
    to: normalizedTo,
    from: normalizedFrom,
    text
  });

  return { ok: true };
}

module.exports = {
  normalizePhone,
  sendSms
};
