// Arquivo de teste simples para diagnosticar a API do Gemini na Vercel
import { GoogleGenAI } from "@google/genai";

export default async function handler(req, res) {
    // Headers CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        // Diagnóstico das variáveis de ambiente
        const envStatus = {
            GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
            API_KEY: !!process.env.API_KEY,
            VITE_API_KEY: !!process.env.VITE_API_KEY,
            NODE_ENV: process.env.NODE_ENV
        };

        const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY || process.env.VITE_API_KEY;

        if (!apiKey) {
            return res.status(500).json({
                status: "error",
                step: "env_check",
                message: "Nenhuma API Key encontrada nas variáveis de ambiente",
                envStatus
            });
        }

        // Inicializa o cliente (sintaxe correta para @google/genai)
        const genAI = new GoogleGenAI({ apiKey });

        // Teste simples usando a sintaxe correta do @google/genai
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash",
            contents: "Responda apenas com a palavra: FUNCIONOU",
        });

        const text = response.text;

        return res.status(200).json({
            status: "success",
            message: "Conexão com Gemini estabelecida!",
            apiKeyPrefix: apiKey.substring(0, 8) + "...",
            resposta_ia: text,
            envStatus
        });

    } catch (error) {
        console.error("Erro no teste da API na Vercel:", {
            name: error.name,
            message: error.message,
            stack: error.stack?.split('\n').slice(0, 5)
        });

        return res.status(500).json({
            status: "error",
            step: "gemini_call",
            message: "Ocorreu um erro interno ao conectar com a API."
        });
    }
}
