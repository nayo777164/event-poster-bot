// index.js
import TelegramBot from "node-telegram-bot-api";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// create bot instance (polling mode)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("Bot token loaded:", process.env.BOT_TOKEN ? "✅ Found" : "❌ Missing");


// file paths
const POSTER_TEMPLATE = path.resolve("./poster_template.png"); // make sure this exists
const OUTPUT_DIR = path.resolve("./output");

// ensure output exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// /start reply
bot.onText(/\/start/, (msg) => {
  bot.sendMessage(msg.chat.id, "🖐 ሰላም ቅዱሳን ለመቀጠል ፎቶ አስገቡ ");
});

// handle received photos
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // 💬 Step 1: Immediately reply
    const processingMessage = await bot.sendMessage(
      chatId,
      "⏳ ፎቶውን በመስራት ላይ ነው... ትንሽ ይጠብቁ።"
    );

    // Step 2: Download and process
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    const timestamp = Date.now();
    const inputPath = path.join(OUTPUT_DIR, `${msg.from.id}_${timestamp}_input.jpg`);
    const outputColor = path.join(OUTPUT_DIR, `${msg.from.id}_${timestamp}_poster_color.png`);
    const outputBW = path.join(OUTPUT_DIR, `${msg.from.id}_${timestamp}_poster_bw.png`);

    const res = await fetch(fileUrl);
    const arrayBuf = await res.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(arrayBuf));

    const posterMeta = await sharp(POSTER_TEMPLATE).metadata();
    const { width, height } = posterMeta;

    const userImage = await sharp(inputPath)
      .resize({ width, height, fit: "cover" })
      .toBuffer();

    const finalImageBuffer = await sharp(userImage)
      .composite([{ input: POSTER_TEMPLATE, blend: "over" }])
      .png()
      .toBuffer();

    fs.writeFileSync(outputColor, finalImageBuffer);
    await sharp(finalImageBuffer).grayscale().toFile(outputBW);

    // Step 3: Edit "processing" message to success
    await bot.editMessageText("✅ ተከናውኗል!", {
      chat_id: chatId,
      message_id: processingMessage.message_id,
    });

    // Step 4: Send both versions
    await bot.sendDocument(chatId, outputColor, { caption: "🎨 ባለ ቀለም" });
    await bot.sendDocument(chatId, outputBW, { caption: "🖤 ጥቁር ነጭ " });

  } catch (err) {
    console.error("Error processing image:", err);
    bot.sendMessage(chatId, "😔 ይቅርታ፣ ፎቶውን ማስተካከል አልተሳካም። እንደገና ይሞክሩ።");
  }
})
;


