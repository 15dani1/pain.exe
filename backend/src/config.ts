import "dotenv/config";

export const config = {
  port: Number(process.env.PORT ?? 4000),
  mongoUri: process.env.MONGODB_URI ?? "",
  mongoDbName: process.env.MONGODB_DB_NAME ?? "painexe_hackathon",
  elevenLabsApiKey: process.env.ELEVENLABS_API_KEY ?? "",
  elevenLabsVoiceId: process.env.ELEVENLABS_VOICE_ID ?? "",
  elevenLabsModelId: process.env.ELEVENLABS_MODEL_ID ?? "eleven_flash_v2_5",
  openAiApiKey: process.env.OPENAI_API_KEY ?? "",
  openAiModel: process.env.OPENAI_MODEL ?? "gpt-4.1-mini",
  frontendOrigin: process.env.FRONTEND_ORIGIN ?? "http://localhost:3000"
};

if (!config.mongoUri) {
  console.warn("[warn] MONGODB_URI is not set. API and seed script will fail until you configure it.");
}
