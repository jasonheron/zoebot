const TelegramBot = require('node-telegram-bot-api');
const sharp = require('sharp');
const dotenv = require('dotenv');

// Load environment variables from .env file
dotenv.config();

// Replace with your bot token, ensure it's in an environment variable for security
const token = process.env.BOT_TOKEN;
if (!token) {
  console.error('Bot token is not defined. Set BOT_TOKEN in environment variables.');
  process.exit(1);
}

const bot = new TelegramBot(token, { polling: true });

console.log('Bot is starting...');

// Function to process the image
async function overlayMeme(inputImageBuffer) {
  try {
    console.log('Processing image...');
    // Get the dimensions of the input image
    const inputImageMetadata = await sharp(inputImageBuffer).metadata();
    
    // Calculate the height of the overlay (75% of the input image height)
    const overlayHeight = Math.round(inputImageMetadata.height * 0.75);
    
    // Load and resize the overlay image
    const overlay = await sharp('overlay.png')
      .resize({
        height: overlayHeight,
        width: Math.round(overlayHeight * (4 / 3)), // Assuming the original overlay has a 4:3 aspect ratio
        fit: 'inside'
      })
      .toBuffer();

    // Overlay the meme on the input image
    const result = await sharp(inputImageBuffer)
      .composite([
        {
          input: overlay,
          gravity: 'southeast' // Position in bottom right corner
        }
      ])
      .toBuffer();

    console.log('Image processing completed.');
    return result;
  } catch (error) {
    console.error('Error processing image:', error.message);
    throw error;
  }
}

// Handle /zoe command
bot.on('message', async (msg) => {
  try {
    const fetch = (await import('node-fetch')).default;

    // Check if the message is in a group and has a command directed at the bot
    if (msg.chat.type === 'group' || msg.chat.type === 'supergroup') {
      if (!msg.caption?.startsWith('/zoe') && !msg.text?.startsWith('/zoe@' + bot.username)) {
        return; // Ignore messages without the command
      }
    } else if (!msg.caption?.startsWith('/zoe') && !msg.text?.startsWith('/zoe')) {
      return; // Ignore messages without the command in private chat
    }

    // Check if the message contains a photo
    if (!msg.photo) {
      console.log(`User @${msg.from.username || msg.from.id} used /zoe without attaching an image.`);
      bot.sendMessage(msg.chat.id, 'Please send an image with the /zoe command.');
      return;
    }

    console.log(`Received /zoe command from user: ${msg.from.username || msg.from.id}`);

    // Get the photo file ID (use the highest resolution version)
    const photoId = msg.photo[msg.photo.length - 1].file_id;

    // Get photo file path
    console.log(`Fetching image for user: ${msg.from.username || msg.from.id}`);
    const file = await bot.getFile(photoId);
    const inputBuffer = await fetch(`https://api.telegram.org/file/bot${token}/${file.file_path}`).then(res => res.buffer());

    // Process the image
    const resultBuffer = await overlayMeme(inputBuffer);

    // Send the processed image back
    await bot.sendPhoto(msg.chat.id, resultBuffer, {
      reply_to_message_id: msg.message_id
    });

    console.log(`Successfully processed and sent image to user: ${msg.from.username || msg.from.id}`);
  } catch (error) {
    console.error(`Error handling message from user @${msg.from.username || msg.from.id}: ${error.message}`);
    bot.sendMessage(msg.chat.id, 'Sorry, there was an error processing your image.');
  }
});

console.log('Bot is running...');
