import TelegramBot from "node-telegram-bot-api";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
import fetch from "node-fetch";
import express from "express";
import { fileURLToPath } from "url";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.get("/", (req, res) => {
  res.send("Bot is running");
});

app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});

const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });

console.log(
  "Bot token loaded:",
  process.env.BOT_TOKEN ? "✅ Found" : "❌ Missing"
);

const POSTER_TEMPLATE = path.resolve("./poster_template.png");
const OUTPUT_DIR = path.resolve("./output");

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "ጓደኛ";
  bot.sendMessage(
    msg.chat.id,
    `ሰላም ${name}! 😊\n poster እንዲሰራ ፎቶ ያስገቡ እና ዝግጁ ይሁን።`
  );
});

bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    await bot.sendChatAction(chatId, "typing");

    const processingMsg = await bot.sendMessage(
      chatId,
      "🔄 ፎቶዎ በሂደት ላይ ነው... እባክዎ ይጠብቁ 😊"
    );

    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const inputPath = path.join(OUTPUT_DIR, `${msg.from.id}_input.jpg`);
    const outputColor = path.join(OUTPUT_DIR, `${msg.from.id}_poster_color.jpg`);

    const res = await fetch(fileUrl);
    const arrayBuf = await res.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(arrayBuf));

    const posterMeta = await sharp(POSTER_TEMPLATE).metadata();
    const { width, height } = posterMeta;

    const userImage = await sharp(inputPath)
      .resize({ width, height, fit: "cover" })
      .toBuffer();

    const finalImage = await sharp(userImage)
      .composite([{ input: POSTER_TEMPLATE, blend: "over" }])
      .toBuffer();

    await sharp(finalImage)
      .jpeg({ quality: 85 })
      .toFile(outputColor);

    await bot.sendPhoto(chatId, outputColor, {
      caption: "🎨 This is your poster image",
    });

    await bot.deleteMessage(chatId, processingMsg.message_id);
  } catch (err) {
    console.error("Error generating poster:", err);
    bot.sendMessage(
      chatId,
      "⚠️ ይቅርታ፣ ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።"
    );
  }
});