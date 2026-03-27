const { Telegraf, Markup } = require('telegraf');
const express = require('express');

const bot = new Telegraf(process.env.BOT_TOKEN);

// ADMIN VA KURYER
const ADMIN_ID = 7312694067;
const COURIERS = [
    { id: 111111111, name: "Ali" },
    { id: 222222222, name: "Vali" }
];

// MENU
const menu = [
    { id: 'b1', name: '🍔 Burger', price: 30000 },
    { id: 'b2', name: '🍔 Burger dvaynoy', price: 35000 },
    { id: 'b3', name: '🍔 Burger troynoy', price: 40000 },
    { id: 'l1', name: '🌯 Lavash', price: 32000 }
];

// DATA
let carts = {};
let orders = {};
let users = {};

// KEYBOARD
const mainKeyboard = Markup.keyboard([
    ['🍴 Menyu', '🛒 Savatcha'],
    ['📞 Aloqa']
]).resize();

// START
bot.start(ctx => ctx.reply("Xush kelibsiz 👋", mainKeyboard));

// MENU
bot.hears('🍴 Menyu', (ctx) => {
    const buttons = menu.map(i => [
        Markup.button.callback(`${i.name} - ${i.price}`, `add_${i.id}`)
    ]);
    ctx.reply("Taom tanlang:", Markup.inlineKeyboard(buttons));
});

// ADD
bot.action(/add_(.+)/, async (ctx) => {
    const item = menu.find(i => i.id === ctx.match[1]);
    const userId = ctx.from.id;

    if (!carts[userId]) carts[userId] = [];

    carts[userId].push({ ...item, uid: Date.now() + Math.random() });

    await ctx.answerCbQuery(`${item.name} qo‘shildi`);
});

// CART
bot.hears('🛒 Savatcha', (ctx) => {
    const cart = carts[ctx.from.id] || [];

    if (!cart.length) return ctx.reply("Bo‘sh 🛒");

    let text = "🛒 Savatchangiz:\n\n";
    let total = 0;

    cart.forEach((i, idx) => {
        text += `${idx + 1}. ${i.name} - ${i.price}\n`;
        total += i.price;
    });

    text += `\n💰 Jami: ${total} so'm`;

    ctx.reply(text, Markup.inlineKeyboard([
        [Markup.button.callback("✅ Buyurtma", "order")],
        [Markup.button.callback("🗑 Tozalash", "clear")]
    ]));
});

// CLEAR
bot.action('clear', async (ctx) => {
    carts[ctx.from.id] = [];
    await ctx.answerCbQuery();
    ctx.editMessageText("Savatcha tozalandi 🗑");
});

// ORDER
bot.action('order', (ctx) => {
    ctx.reply("📞 Raqam yuboring:", Markup.keyboard([
        [Markup.button.contactRequest("📞 Raqam")]
    ]).resize().oneTime());
});

// CONTACT
bot.on('contact', (ctx) => {
    users[ctx.from.id] = { phone: ctx.message.contact.phone_number };

    ctx.reply("📍 Lokatsiya yuboring:", Markup.keyboard([
        [Markup.button.locationRequest("📍 Lokatsiya")]
    ]).resize().oneTime());
});

// LOCATION (BUYURTMA)
bot.on('location', async (ctx) => {
    const userId = ctx.from.id;
    const cart = carts[userId] || [];

    if (!cart.length) return ctx.reply("Savatcha bo‘sh");

    const { latitude, longitude } = ctx.message.location;
    const orderId = Date.now().toString();

    let itemsText = "";
    let total = 0;

    cart.forEach(i => {
        itemsText += `- ${i.name}\n`;
        total += i.price;
    });

    orders[orderId] = {
        userId,
        phone: users[userId].phone,
        latitude,
        longitude,
        items: [...cart],
        total
    };

    const mapLink = `https://maps.google.com/?q=${latitude},${longitude}`;

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `🔔 BUYURTMA #${orderId}\n\n📞 +${users[userId].phone}\n\n${itemsText}\n💰 ${total} so'm\n📍 ${mapLink}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryer", `sd_${orderId}`)],
            [Markup.button.callback("⚠️ Tugagan", `ed_${orderId}`)],
            [Markup.button.callback("🚫 Bekor", `cn_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, latitude, longitude);

    carts[userId] = [];

    ctx.reply("✅ Buyurtma yuborildi", mainKeyboard);
});

// ❌ BEKOR
bot.action(/cn_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];
    if (!order) return;

    await ctx.answerCbQuery();

    await ctx.telegram.sendMessage(order.userId, "❌ Buyurtma bekor qilindi", mainKeyboard);
    await ctx.telegram.sendMessage(ADMIN_ID, `🚫 Bekor qilindi (#${orderId})`);

    ctx.editMessageText("Bekor qilindi");
});

// ⚠️ TUGAGAN
bot.action(/ed_(.+)/, async (ctx) => {
    const order = orders[ctx.match[1]];
    if (!order) return;

    const buttons = order.items.map(i => [
        Markup.button.callback(`❌ ${i.name}`, `rm_${ctx.match[1]}_${i.uid}`)
    ]);

    await ctx.answerCbQuery();
    ctx.editMessageText("Qaysi mahsulot yo‘q?", Markup.inlineKeyboard(buttons));
});

// REMOVE
bot.action(/rm_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const uid = Number(ctx.match[2]);
    const order = orders[orderId];

    const removed = order.items.find(i => i.uid === uid);

    order.items = order.items.filter(i => i.uid !== uid);

    let text = "";
    let total = 0;

    order.items.forEach(i => {
        text += `- ${i.name}\n`;
        total += i.price;
    });

    order.total = total;

    await ctx.answerCbQuery();

    await ctx.telegram.sendMessage(
        order.userId,
        `⚠️ "${removed.name}" yo‘q\n\n${text}\n💰 ${total}\n\nYuboraylikmi?`,
        Markup.inlineKeyboard([
            [Markup.button.callback("✅ Ha", `ok_${orderId}`)],
            [Markup.button.callback("❌ Yo‘q", `cn_${orderId}`)]
        ])
    );

    ctx.editMessageText("Mijozga yuborildi");
});

// ✅ MIJOZ ROZI
bot.action(/ok_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const order = orders[orderId];

    let text = "";
    order.items.forEach(i => text += `- ${i.name}\n`);

    await ctx.answerCbQuery();

    await ctx.telegram.sendMessage(
        ADMIN_ID,
        `✅ Mijoz rozi (#${orderId})\n📞 +${order.phone}\n\n${text}\n💰 ${order.total}`,
        Markup.inlineKeyboard([
            [Markup.button.callback("🚗 Kuryer", `sd_${orderId}`)]
        ])
    );

    await ctx.telegram.sendLocation(ADMIN_ID, order.latitude, order.longitude);

    ctx.editMessageText("Tasdiqlandi");
});

// 🚗 KURYER
bot.action(/sd_(.+)/, (ctx) => {
    const orderId = ctx.match[1];

    const buttons = COURIERS.map(c => [
        Markup.button.callback(c.name, `ch_${orderId}_${c.id}`)
    ]);

    ctx.reply("Kuryer tanlang:", Markup.inlineKeyboard(buttons));
});

// 🚚 YUBORISH
bot.action(/ch_(.+)_(.+)/, async (ctx) => {
    const orderId = ctx.match[1];
    const courierId = Number(ctx.match[2]);
    const order = orders[orderId];

    let text = "";
    order.items.forEach(i => text += `- ${i.name}\n`);

    await ctx.telegram.sendMessage(
        courierId,
        `🚚 BUYURTMA #${orderId}\n📞 +${order.phone}\n${text}\n💰 ${order.total}`
    );

    await ctx.telegram.sendLocation(courierId, order.latitude, order.longitude);

    await ctx.telegram.sendMessage(order.userId, "🚀 Kuryer yo‘lda", mainKeyboard);

    ctx.editMessageText("Yuborildi");
});

// 📞 ALOQA
bot.hears('📞 Aloqa', (ctx) => {
    ctx.reply(
        `🍔 Çukur burger\nFast food\n\n📞 +998 99 450 67 67\n⏰ 10:00 - 00:00`
    );
});

// EXPRESS
const app = express();
app.get('/', (req, res) => res.send("Bot ishlayapti 🚀"));
app.listen(process.env.PORT || 3000, '0.0.0.0');

bot.catch(console.error);
bot.launch();
const axios = require('axios'); // Agar axios tepada bo'lmasa, buni eng tepaga qo'shing

// Render dashboard'idan olgan URL manzilingizni shu yerga qo'ying
const MY_RENDER_URL = "https://coffee-food-bot.onrender.com"; 

// Har 14 daqiqada (Render 15 daqiqada uxlashini hisobga olib) o'z-o'ziga signal yuboradi
setInterval(() => {
    axios.get(MY_RENDER_URL)
        .then(() => console.log("Self-ping muvaffaqiyatli: Bot uyg'oq!"))
        .catch((err) => console.log("Ping xatosi:", err.message));
}, 14 * 60 * 1000); // 14 daqiqa = 14 * 60 * 1000 millisoniya

