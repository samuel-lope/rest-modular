/**
 * Worker para gerenciar Módulos no Cloudflare KV.
 *
 * Endpoints:
 * - GET /kv/json -> Lista todas as chaves dos módulos.
 * - GET /kv/json?key=<SUA_CHAVE> -> Retorna o JSON de um módulo específico.
 * - PUT /kv/json -> Salva ou atualiza um módulo. O corpo deve ser { key: "...", value: "..." }.
 * - DELETE /kv/json?key=<SUA_CHAVE> -> Apaga um módulo específico.
 *
 * Lembre-se de configurar o binding do KV "CARD_MODULES" nas configurações do seu worker.
 */

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // Roteamento para o endpoint /kv/json
    if (path !== '/kv/json') {
      return new Response('Endpoint não encontrado. Use /kv/json', { status: 404 });
    }

    const { CARD_MODULES } = env;

    // Roteamento baseado no método HTTP
    switch (request.method) {
      case 'GET':
        return handleGetRequest(request, CARD_MODULES);
      case 'PUT':
        return handlePutRequest(request, CARD_MODULES);
      case 'DELETE':
        return handleDeleteRequest(request, CARD_MODULES);
      case 'OPTIONS':
        return handleOptions(request);
      default:
        return new Response('Método não permitido.', {
          status: 405,
          headers: { 'Allow': 'GET, PUT, DELETE, OPTIONS' },
        });
    }
  },
};

// Headers de CORS para permitir que o seu front-end se comunique com este worker.
const corsHeaders = {
  'Access-Control-Allow-Origin': '*', // Para produção, restrinja à sua URL.
  'Access-Control-Allow-Methods': 'GET, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function handleOptions(request) {
  if (
    request.headers.get('Origin') !== null &&
    request.headers.get('Access-Control-Request-Method') !== null &&
    request.headers.get('Access-Control-Request-Headers') !== null
  ) {
    // Responde ao pre-flight com os headers de permissão.
    return new Response(null, { headers: corsHeaders });
  } else {
    // Se não for uma requisição de pre-flight válida, nega.
    return new Response(null, { headers: { Allow: 'GET, PUT, DELETE, OPTIONS' } });
  }
}

/**
 * Lida com requisições GET para listar chaves ou obter um valor específico.
 * @param {Request} request
 * @param {KVNamespace} kvNamespace
 */
async function handleGetRequest(request, kvNamespace) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    try {
        if (key) {
            // Busca um valor específico
            const value = await kvNamespace.get(key, 'json');
            if (value === null) {
                return new Response('Módulo não encontrado.', { status: 404, headers: corsHeaders });
            }
            return new Response(JSON.stringify(value), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        } else {
            // Lista todas as chaves
            const list = await kvNamespace.list();
            return new Response(JSON.stringify(list.keys), {
                status: 200,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
        }
    } catch (error) {
        console.error('Erro no GET do Worker:', error);
        return new Response(`Erro interno do servidor: ${error.message}`, { status: 500, headers: corsHeaders });
    }
}


/**
 * Lida com requisições PUT para salvar/atualizar um módulo.
 * @param {Request} request
 * @param {KVNamespace} kvNamespace
 */
async function handlePutRequest(request, kvNamespace) {
  try {
    if (request.headers.get('Content-Type') !== 'application/json') {
      return new Response('Content-Type deve ser application/json.', { status: 400, headers: corsHeaders });
    }

    const { key, value } = await request.json();

    if (!key || !value) {
      return new Response('"key" e "value" são obrigatórios.', { status: 400, headers: corsHeaders });
    }

    // O valor já deve ser uma string JSON, então apenas o salvamos.
    await kvNamespace.put(key, value);

    return new Response(JSON.stringify({ success: true, message: `Módulo salvo com a chave: ${key}` }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Erro no PUT do Worker:', error);
    return new Response(`Erro interno do servidor: ${error.message}`, { status: 500, headers: corsHeaders });
  }
}

/**
 * Lida com requisições DELETE para apagar um módulo.
 * @param {Request} request
 * @param {KVNamespace} kvNamespace
 */
async function handleDeleteRequest(request, kvNamespace) {
    const url = new URL(request.url);
    const key = url.searchParams.get('key');

    if (!key) {
        return new Response('O parâmetro "key" é obrigatório para apagar.', { status: 400, headers: corsHeaders });
    }

    try {
        await kvNamespace.delete(key);
        return new Response(JSON.stringify({ success: true, message: `Módulo com a chave "${key}" foi apagado.` }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
    } catch (error) {
        console.error('Erro no DELETE do Worker:', error);
        return new Response(`Erro interno do servidor: ${error.message}`, { status: 500, headers: corsHeaders });
    }
}

