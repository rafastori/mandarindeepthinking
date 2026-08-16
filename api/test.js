// Diagnóstico da API de texto (OpenRouter) na Vercel
import { callOpenRouterText, TEXT_MODEL } from "../lib/openrouter.js";

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const envStatus = {
            OPENROUTER_API_KEY: !!process.env.OPENROUTER_API_KEY,
            GEMINI_API_KEY: !!process.env.GEMINI_API_KEY,
            API_KEY: !!process.env.API_KEY,
            VITE_API_KEY: !!process.env.VITE_API_KEY,
            NODE_ENV: process.env.NODE_ENV
        };

        if (!process.env.OPENROUTER_API_KEY) {
            return res.status(500).json({
                status: "error",
                step: "env_check",
                message: "OPENROUTER_API_KEY não encontrada nas variáveis de ambiente",
                envStatus
            });
        }

        const text = await callOpenRouterText(
            "Responda apenas com a palavra: FUNCIONOU",
            "",
            false
        );

        return res.status(200).json({
            status: "success",
            message: "Conexão com OpenRouter estabelecida!",
            model: TEXT_MODEL,
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
            step: "openrouter_call",
            message: "Ocorreu um erro interno ao conectar com a API."
        });
    }
}
