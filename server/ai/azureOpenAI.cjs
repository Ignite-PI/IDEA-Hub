/**
 * Azure OpenAI Service client (Chat Completions REST API).
 * Credentials come only from environment variables (see .env.example) and never
 * leave the server.
 *
 *   AZURE_OPENAI_ENDPOINT     https://<resource>.openai.azure.com
 *   AZURE_OPENAI_DEPLOYMENT   model deployment name, e.g. gpt-4o-mini
 *   AZURE_OPENAI_API_KEY      resource key (store in .env / App Settings / Key Vault)
 *   AZURE_OPENAI_API_VERSION  optional, defaults to 2024-10-21 (GA)
 */
class AiError extends Error {
  constructor(code, message, status = 502) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

function config() {
  const endpoint = (process.env.AZURE_OPENAI_ENDPOINT || '').trim().replace(/\/+$/, '');
  const deployment = (process.env.AZURE_OPENAI_DEPLOYMENT || '').trim();
  const apiKey = (process.env.AZURE_OPENAI_API_KEY || '').trim();
  const apiVersion = (process.env.AZURE_OPENAI_API_VERSION || '2024-10-21').trim();
  const disabled = /^(0|false|no|off)$/i.test(process.env.AI_ENABLED || '');
  return { endpoint, deployment, apiKey, apiVersion, configured: !disabled && !!(endpoint && deployment && apiKey), disabled };
}

function status() {
  const c = config();
  return {
    configured: c.configured,
    provider: 'Azure OpenAI Service',
    deployment: c.configured ? c.deployment : null,
    reason: c.configured ? null : c.disabled ? 'AI assistance has been turned off by the administrator.' : 'The AI assistant has not been configured on the server yet.',
  };
}

async function chat(messages, { json = false, maxTokens = 900, temperature = 0.4 } = {}) {
  const c = config();
  if (!c.configured) throw new AiError('not_configured', status().reason, 503);

  const url = `${c.endpoint}/openai/deployments/${encodeURIComponent(c.deployment)}/chat/completions?api-version=${encodeURIComponent(c.apiVersion)}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.AI_TIMEOUT_MS) || 25000); // below the 30s Vercel function limit
  let res;
  try {
    res = await fetch(url, {
      method: 'POST',
      signal: controller.signal,
      headers: { 'Content-Type': 'application/json', 'api-key': c.apiKey },
      body: JSON.stringify({
        messages,
        temperature,
        max_tokens: maxTokens,
        ...(json ? { response_format: { type: 'json_object' } } : {}),
      }),
    });
  } catch (e) {
    if (e.name === 'AbortError') throw new AiError('timeout', 'The AI service took too long to respond. Please try again.', 504);
    throw new AiError('unavailable', 'The AI service could not be reached. Check the network connection and try again.', 502);
  } finally {
    clearTimeout(timer);
  }

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const code = body?.error?.code || '';
    console.warn(`[ai] Azure OpenAI ${res.status} ${code}`);
    if (res.status === 401 || res.status === 403) throw new AiError('auth', 'The AI service rejected the server credentials. Ask the administrator to check the Azure OpenAI configuration.', 502);
    if (res.status === 404) throw new AiError('not_found', 'The configured AI model deployment was not found. Ask the administrator to check the deployment name.', 502);
    if (res.status === 429) throw new AiError('rate_limited', 'The AI service is busy right now. Please wait a moment and try again.', 429);
    if (code === 'content_filter' || body?.error?.innererror?.code === 'ResponsibleAIPolicyViolation') {
      throw new AiError('content_filter', 'The AI service declined this request because of its content policy. Try rewording the text.', 422);
    }
    throw new AiError('unavailable', 'The AI service returned an error. Please try again later.', 502);
  }
  const choice = body.choices?.[0];
  if (choice?.finish_reason === 'content_filter') {
    throw new AiError('content_filter', 'The AI service declined this request because of its content policy. Try rewording the text.', 422);
  }
  const content = choice?.message?.content?.trim();
  if (!content) throw new AiError('bad_response', 'The AI service returned an empty response. Please try again.', 502);
  return content;
}

module.exports = { chat, status, AiError };
