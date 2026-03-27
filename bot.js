const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios'); // Axios eng tepaga chiqdi

const bot = new Telegraf(process.env.BOT_TOKEN);

// --- SOZLAMALAR ---
const ADMIN_ID = 7312694067;
const MY_RENDER_URL = "https://coffee-food-bot.onrender.com"; 

const COURIERS = [
    { id: 111111111, name: "Ali" },
    { id: 222222222, name: "Vali" }
];

const menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

let carts = {};
let orders = {};
let users = {};

const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['📞 Aloqa']
]).resize();

// --- BOT LOGIKASI ---
bot.start(ctx => ctx.reply("Xush kelibsiz 👋", mainKeyboard));

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [
        Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)
    ]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, async (ctx) => {
    const item = menu.find(i => i.id === ctx.match[1]);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    await ctx.answerCbQuery(`${item.name} qo‘shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo‘sh 🛒");

    let text = "🛒 Savatchangiz:\n\n";
    let total = 0;
    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price} so'm\n`;
        total += i.price;
    });
    text += `\n💰 Jami: ${total} so'm`;

    ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma berish", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

bot.action('clear', async (ctx) => {
    carts[ctx.from.id] = [];
    await ctx.answerCbQuery();
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

bot.action('order', (ctx) => {
    ctx.reply("📞 Aloqa uchun telefon raqamingizni yuboring:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Raqamni yuborish")]
    ]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Yetkazib berish uchun lokatsiyangizni yuboring:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiyani yuborish")]
    ]).resize().oneTime());
});

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo‘sh");

    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString().slice(-6); // Qisqaroq ID

    let itemsText = "";
    let total = 0;
    cart.forEach(i => {
        itemsText += `- ${i.name}\n`;
        total += i.price;
    });

    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total };
    const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 YANGI BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );

    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz qabul qilindi, admin tasdiqlashini kuting.", mainKeyboard);
});

// Admin actionlari (SD, ED, CN, OK, RM, CH funksiyalari o'sha holicha qoladi...)
// [Bu yerda sizning qolgan bot.action kodingiz turadi]

// --- SERVER VA SELF-PING ---
const app = express();
app.get('/', (req, res) => res.send("Bot ishlayapti 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

// Self-ping tizimi (Har 14 daqiqada)
setInterval(() => {
    axios.get(MY_RENDER_URL)
        .then(() => console.log("Self-ping: Bot uyg'oq! ✅"))
        .catch((err) => console.log("Ping xatosi:", err.message));
}, 14 * 60 * 1000);

bot.catch(console.error);
bot.launch().then(() => console.log("Bot Render'da muvaffaqiyatli yoqildi!"));
