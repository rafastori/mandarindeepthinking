import { GoogleGenerativeAI } from "@google/generative-ai";

export default async function handler(req, res) {
  try {
    // 1. Tenta pegar a chave
    const apiKey = process.env.VITE_API_KEY || process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      return res.status(500).json({ 
        status: "ERRO", 
        message: "A variável de ambiente (API KEY) não foi encontrada no servidor." 
      });
    }

    // 2. Tenta conectar
    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

    // 3. Tenta gerar algo simples
    const result = await model.generateContent("Diga apenas a palavra: FUNCIONOU");
    const response = result.response.text();

    return res.status(200).json({ 
      status: "SUCESSO", 
      message: "Conexão com Gemini estabelecida!", 
      resposta_ia: response 
    });

  } catch (error) {
    return res.status(500).json({ 
      status: "ERRO CRÍTICO", 
      tipo: error.name,
      mensagem: error.message,
      detalhes: JSON.stringify(error)
    });
  }
}