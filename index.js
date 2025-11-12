// index.js
import TelegramBot from "node-telegram-bot-api";
import sharp from "sharp";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";
dotenv.config();

// Create bot instance (polling mode)
const bot = new TelegramBot(process.env.BOT_TOKEN, { polling: true });
console.log("Bot token loaded:", process.env.BOT_TOKEN ? "✅ Found" : "❌ Missing");

// File paths
const POSTER_TEMPLATE = path.resolve("./poster_template.png"); // make sure this exists
const OUTPUT_DIR = path.resolve("./output");

// Ensure output folder exists
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR);

// /start command — greet user by name
bot.onText(/\/start/, (msg) => {
  const name = msg.from.first_name || "ጓደኛ"; // fallback if name missing

  bot.sendMessage(
    msg.chat.id,
    `ሰላም ${name}! 😊\n poster እንዲሰራ ፎቶ ያስገቡ እና ዝግጁ ይሁን።`
  );
});

// Handle received photos
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // Show typing animation
    await bot.sendChatAction(chatId, "typing");

    // Loading message
    await bot.sendMessage(chatId, "🔄 ፎቶዎ በሂደት ላይ ነው... እባክዎ ይጠብቁ 😊");

    // Get file info
    const file = await bot.getFile(fileId);
    const fileUrl = `https://api.telegram.org/file/bot${process.env.BOT_TOKEN}/${file.file_path}`;

    // Paths
    const inputPath = path.join(OUTPUT_DIR, `${msg.from.id}_input.jpg`);
    const outputColor = path.join(OUTPUT_DIR, `${msg.from.id}_poster_color.png`);
    const outputBW = path.join(OUTPUT_DIR, `${msg.from.id}_poster_bw.png`);

    // Download user image
    const res = await fetch(fileUrl);
    const arrayBuf = await res.arrayBuffer();
    fs.writeFileSync(inputPath, Buffer.from(arrayBuf));

    // Get poster size
    const posterMeta = await sharp(POSTER_TEMPLATE).metadata();
    const { width, height } = posterMeta;

    // Resize user image
    const userImage = await sharp(inputPath)
      .resize({ width, height, fit: "cover" })
      .toBuffer();

    // Composite poster overlay
    const finalImage = await sharp(userImage)
      .composite([{ input: POSTER_TEMPLATE, blend: "over" }])
      .png()
      .toBuffer();

    // Save both versions
    await sharp(finalImage).toFile(outputColor);
    await sharp(finalImage).grayscale().toFile(outputBW);

    // Send typing animation before upload
    await bot.sendChatAction(chatId, "upload_photo");

    // Send both results together
    await bot.sendMessage(chatId, "🎉 ፎቶዎ ዝግጁ ሆኗል! እባክዎ ይመልከቱ 👇");

    await bot.sendMediaGroup(chatId, [
      {
        type: "photo",
        media: { source: outputColor },
        caption: "🎨 color",
      },
      {
        type: "photo",
        media: { source: outputBW },
        caption: "🖤 black and white",
      },
    ]);

  } catch (err) {
    console.error("Error generating poster:", err);
    bot.sendMessage(chatId, "⚠️ ይቅርታ፣ ችግኝ ተፈጥሯል። እባክዎ እንደገና ይሞክሩ።");
  }
});
