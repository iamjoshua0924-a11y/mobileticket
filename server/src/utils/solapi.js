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

async function sendSms({ to, text, subject }) {
  const normalizedTo = normalizePhone(to);
  const normalizedFrom = normalizePhone(process.env.SEND_PHONE_NUMBER);

  if (!normalizedTo || !text) {
    return { ok: false, reason: 'invalid_payload', message: '문자 발송 대상 번호 또는 내용이 올바르지 않습니다.' };
  }

  if (!hasSolapiConfig() || !normalizedFrom) {
    return { ok: false, reason: 'not_configured', message: 'SOLAPI 환경변수 또는 발신번호가 설정되지 않았습니다.' };
  }

  try {
    const messageService = makeService();
    await messageService.send({
      to: normalizedTo,
      from: normalizedFrom,
      text,
      subject
    });

    return { ok: true, reason: 'sent', message: '문자 발송 완료' };
  } catch (err) {
    return {
      ok: false,
      reason: 'send_failed',
      message: err instanceof Error ? err.message : '문자 발송 실패'
    };
  }
}

module.exports = {
  normalizePhone,
  sendSms
};
