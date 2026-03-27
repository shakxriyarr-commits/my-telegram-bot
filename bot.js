const { Telegraf, Markup } = require('telegraf');
const express = require('express');
const axios = require('axios');

// 1. ASOSIY SOZLAMALAR
const bot = new Telegraf(process.env.BOT_TOKEN);
const ADMIN_ID = 7312694067; 
const MY_RENDER_URL = "https://coffee-food-bot.onrender.com"; 

// 2. MA'LUMOTLAR
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

// 3. ASOSIY KLAVIATURA
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['📞 Aloqa']
]).resize();

// --- MIJOZ LOGIKASI ---

bot.start(ctx => {
    // FAQAT COFFEE FOOD NOMI QOLDI
    ctx.reply("Xush kelibsiz Coffee Food botiga! 👋\n\nLazzatli taomlar va shinam muhit sari bir qadam.", mainKeyboard);
});

bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [
        Markup.button.callback(`${i.name} - ${i.price} so'm`, `add_${i.id}`)
    ]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/add_(.+)/, async (ctx) => {
    const itemId = ctx.match[1];
    const item = menu.find(i => i.id === itemId);
    const userId = ctx.from.id;
    if (!carts[userId]) carts[userId] = [];
    carts[userId].push({ ...item, uid: Date.now() + Math.random() });
    await ctx.answerCbQuery(`${item.name} savatchaga qo'shildi ✅`);
});

bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];
    if (!cart.length) return ctx.reply("Savatchangiz bo'sh 🛒");

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
    ctx.reply("📞 Aloqa uchun raqamingizni yuboring:", Markup.keyboard([[Markup.button.contactRequest("📞 Raqamni yuborish")]]).resize().oneTime());
});

bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };
    ctx.reply("📍 Yetkazib berish manzilingizni (lokatsiya) yuboring:", Markup.keyboard([[Markup.button.locationRequest("📍 Lokatsiyani yuborish")]]).resize().oneTime());
});

// --- BUYURTMA JARAYONI ---

bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];
    if (!cart.length) return ctx.reply("Savatcha bo'sh");

    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString().slice(-6);

    let itemsText = "";
    let total = 0;
    cart.forEach(i => {
        itemsText += `- ${i.name}\n`;
        total += i.price;
    });

    orders[orderId] = { userId, phone: users[userId].phone, latitude, longitude, items: [...cart], total };
    const mapLink = `https://maps.google.com{latitude},${longitude}`;

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 YANGI BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 Jami: ${total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Mahsulot tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);
    carts[userId] = [];
    ctx.reply("✅ Buyurtmangiz yuborildi, admin tasdiqlashini kuting.", mainKeyboard);
});

// --- ADMIN VA KURYER ACTIONLARI ---

bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];
    const buttons = COURIERS.map(c => [Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)]);
    ctx.editMessageText("🚗 Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Buyurtma topilmadi");

    let text = "";
    order.items.forEach(i => text += `- ${i.name}\n`);

    await ctx.telegram.sendMessage(courierId, `🚚 BUYURTMA #${orderId}\n📞 +${order.phone}\n${text}\n💰 Jami: ${order.total} so'm`);
    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);
    await ctx.telegram.sendMessage(order.userId, "🚀 Buyurtma tayyor, kuryer yo'lda!", mainKeyboard);
    ctx.editMessageText("✅ Kuryerga yuborildi");
});

bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (order) await ctx.telegram.sendMessage(order.userId, "❌ Uzr, buyurtmangiz bekor qilindi.", mainKeyboard);
    ctx.editMessageText("🚫 Buyurtma bekor qilindi");
});

bot.action(/ed_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return;
    const buttons = order.items.map(i => [Markup.button.callback(`❌ ${i.name} tugagan`, `rm_${orderId}_${i.uid}`)]);
    ctx.editMessageText("Qaysi mahsulot tugagan?", Markup.inlineKeyboard(buttons));
});

bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = Number(ctx.match[2]);
    const order = orders[orderId];
    const removed = order.items.find(i => i.uid === uid);
    order.items = order.items.filter(i => i.uid !== uid);

    let text = ""; let total = 0;
    order.items.forEach(i => { text += `- ${i.name}\n`; total += i.price; });
    order.total = total;

    await ctx.telegram.sendMessage(order.userId, `⚠️ "${removed.name}" tugabdi.\n\nQolganlari:\n${text}\n💰 Jami: ${total} so'm\n\nYuboraveraylikmi?`, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Ha", `ok_${orderId}`)],
        [Markup.button.callback("❌ Yo'q, bekor qil", `cn_${orderId}`)]
    ]));
    ctx.editMessageText("Mijozga so'rov yuborildi");
});

bot.action(/ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return ctx.answerCbQuery("Xato!");

    await ctx.answerCbQuery("Tasdiqlandi ✅");
    await ctx.editMessageText("✅ Rahmat! Buyurtmangiz qayta ishlanmoqda.");

    let itemsText = "";
    order.items.forEach(i => itemsText += `- ${i.name}\n`);
    const mapLink = `https://maps.google.com{order.latitude},${order.longitude}`;

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `✅ MIJOZ ROZI (#${orderId})\n\n📞 +${order.phone}\n\n${itemsText}\n💰 Jami: ${order.total} so'm\n📍 Xarita: ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryerga berish", `sd_${orderId}`)],
            [Markup.button.callback("🚫 Bekor qilish", `cn_${orderId}`)]
        ])
    );
    await ctx.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);
});

// ALOQA QISMI YANGILANDI
bot.hears('📞 Aloqa', (ctx) => ctx.reply(`☕️ Coffee Food\nPremium xizmat ko'rsatish\n\n📞 +998 95 440 64 44\n⏰ Ish vaqti: 10:00 - 00:00`));

// --- SERVER VA SELF-PING ---
const app = express();
app.get('/', (req, res) => res.send("Coffee Food Bot 24/7 Online 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

setInterval(() => {
    axios.get(MY_RENDER_URL).then(() => console.log("Self-ping ✅")).catch(() => console.log("Xato ❌"));
}, 14 * 60 * 1000);

bot.catch(console.error);
bot.launch().then(() => console.log("Coffee Food Bot ishga tushdi!"));
