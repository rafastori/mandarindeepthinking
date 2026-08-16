import { callOpenRouterText, TEXT_MODEL } from "../lib/openrouter.js";

export default async function handler(req, res) {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(500).json({
        status: "ERRO",
        message: "OPENROUTER_API_KEY não foi encontrada no servidor."
      });
    }

    const response = await callOpenRouterText("Diga apenas a palavra: FUNCIONOU", "", false);

    return res.status(200).json({
      status: "SUCESSO",
      message: "Conexão com OpenRouter estabelecida!",
      model: TEXT_MODEL,
      resposta_ia: response
    });

  } catch (error) {
    return res.status(500).json({
      status: "ERRO CRÍTICO",
      tipo: error.name,
      mensagem: error.message
    });
  }
}
