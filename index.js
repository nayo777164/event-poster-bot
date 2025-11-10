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
  const name = msg.from.first_name || "";
  
  bot.sendMessage(
    msg.chat.id,
    `ሰላም ${name}! 😊\nእባኮ ፎቶ ያስገቡ`
  );
});


// handle received photos
bot.on("photo", async (msg) => {
  const chatId = msg.chat.id;
  const fileId = msg.photo[msg.photo.length - 1].file_id;

  try {
    // Show typing animation
    bot.sendChatAction(chatId, "typing");

    // Loading message
    await bot.sendMessage(chatId, "Processing your image... please wait 😊");

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

    // Read poster template size
    const posterMeta = await sharp(POSTER_TEMPLATE).metadata();
    const { width, height } = posterMeta;

    // Resize user image
    const userImage = await sharp(inputPath)
      .resize({ width, height, fit: "cover" })
      .toBuffer();

    // Composite
    const finalImage = await sharp(userImage)
      .composite([{ input: POSTER_TEMPLATE, blend: "over" }])
      .png()
      .toBuffer();

    // Save versions
    await sharp(finalImage).toFile(outputColor);
    await sharp(finalImage).grayscale().toFile(outputBW);

    // Send results
    await bot.sendDocument(chatId, outputColor, { caption: "✅ Color version" });
    await bot.sendDocument(chatId, outputBW, { caption: "✅ Black & White version" });

  } catch (err) {
    console.error("Error generating poster:", err);
    bot.sendMessage(chatId, "⚠️ Sorry, something went wrong.");
  }
});



