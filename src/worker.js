/**
 * Bem-vindo ao seu Worker para salvar Módulos no Cloudflare KV.
 *
 * Este worker agora responde especificamente no endpoint: /kv/json
 *
 * Para este script funcionar, você precisa fazer duas coisas no seu ambiente Cloudflare:
 * 1. Criar um Namespace KV e nomeá-lo "CARD_MODULES".
 * 2. Adicionar um "KV Namespace Binding" nas configurações do seu Worker.
 * - Nome da variável (Variable name): CARD_MODULES
 * - Namespace KV (KV namespace): CARD_MODULES
 *
 */

export default {
  async fetch(request, env, ctx) {
    // Extrai o caminho da URL para criar um roteamento simples.
    const url = new URL(request.url);
    const path = url.pathname;

    // Roteamento: Verifica se a requisição é para o endpoint correto.
    if (path !== '/kv/json') {
      return new Response('Endpoint não encontrado. Use /kv/json', { status: 404 });
    }

    // O objeto 'env' contém os seus bindings, como o namespace KV.
    const { CARD_MODULES } = env;

    // Lida com a requisição de pre-flight (CORS) que o navegador envia primeiro.
    if (request.method === 'OPTIONS') {
      return handleOptions(request);
    }

    // Lida com a requisição PUT para salvar os dados.
    if (request.method === 'PUT') {
      return handlePutRequest(request, CARD_MODULES);
    }

    // Para qualquer outro método (GET, POST, etc.) no endpoint correto, retorna um erro.
    return new Response('Método não permitido. Use PUT para salvar dados.', {
      status: 405,
      headers: corsHeaders, // Adiciona headers de CORS mesmo no erro.
    });
  },
};

// Headers de CORS para permitir que o seu front-end se comunique com este worker.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Permite qualquer origem. Para mais segurança, substitua '*' pela URL da sua página.
  'Access-Control-Allow-Methods': 'PUT, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

/**
 * Lida com a requisição OPTIONS (pre-flight).
 * @param {Request} request
 */
function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Responde ao pre-flight com os headers de permissão.
    return new Response(null, {
      headers: corsHeaders,
    });
  } else {
    // Se não for uma requisição de pre-flight válida, nega.
    return new Response(null, {
      headers: {
        Allow: 'PUT, OPTIONS',
      },
    });
  }
}

/**
 * Lida com a requisição PUT para salvar o módulo no KV.
 * @param {Request} request
 * @param {KVNamespace} kvNamespace - O binding para o seu namespace KV.
 */
async function handlePutRequest(request, kvNamespace) {
  try {
    // Verifica se o header é do tipo JSON.
    if (request.headers.get('Content-Type') !== 'application/json') {
      return new Response('Requisição inválida. Content-Type deve ser application/json.', { status: 400, headers: corsHeaders });
    }

    // Lê e parseia o corpo da requisição.
    const { key, value } = await request.json();

    // Valida se a chave e o valor foram fornecidos.
    if (!key || !value) {
      return new Response('Requisição inválida. "key" e "value" são obrigatórios no corpo do JSON.', { status: 400, headers: corsHeaders });
    }

    // Grava os dados no KV. O valor é o seu JSON de módulo como string.
    await kvNamespace.put(key, value);

    // Retorna uma resposta de sucesso.
    return new Response(JSON.stringify({ success: true, message: `Módulo salvo com a chave: ${key}` }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json',
      },
    });

  } catch (error) {
    // Em caso de erro (JSON inválido, falha ao gravar no KV, etc.), retorna uma mensagem de erro.
    console.error('Erro no Worker:', error);
    return new Response(`Erro interno do servidor: ${error.message}`, {
      status: 500,
      headers: corsHeaders,
    });
  }
}

